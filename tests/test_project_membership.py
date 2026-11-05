"""Project inventory misses must be resolved on the issue or PR before writing."""

import unittest
from unittest.mock import patch

from scripts import project_sync as sync


def page(nodes, cursor=None):
    return {"nodes": nodes, "pageInfo": {"hasNextPage": cursor is not None, "endCursor": cursor}}


class ProjectMembershipTests(unittest.TestCase):
    def run_sync(self, replies, *, is_pr=True):
        path = "pull" if is_pr else "issues"
        self.url = f"https://github.com/{sync.REPOSITORY}/{path}/31"
        record = {"html_url": self.url, "node_id": "content", "state": "closed", "merged_at": "2026-11-05"}
        fields = [{"name": "Status", "id": "status", "options": [{"id": "done", "name": "Done"}]}]
        self.writes = []

        def graphql(query, **variables):
            if query.startswith("mutation"):
                self.writes.append((query, variables))
            reply = next(responses)
            if isinstance(reply, Exception):
                raise reply
            return reply

        responses = iter(replies)
        records = ([], [record]) if is_pr else ([record], [])
        with patch.object(sync, "project_inventory", return_value=(fields, [])), \
             patch.object(sync, "api_pages", side_effect=records), \
             patch.object(sync, "gh", return_value=[]), \
             patch.object(sync, "graphql", side_effect=graphql) as api:
            self.api = api
            sync.reconcile()

    def membership(self, project_id=sync.PROJECT_ID, *, archived=False):
        return {"id": "existing", "project": {"id": project_id}, "isArchived": archived}

    def memberships(self, nodes, cursor=None):
        return {"node": {"id": "content", "projectItems": page(nodes, cursor)}}

    def values(self, status):
        return {"node": {"id": "existing", "fieldValues": page([
            {"field": {"name": "Status"}, "name": status},
            {"field": {"name": "Manual choice"}, "name": "Keep"},
        ])}}

    def mutation_result(self, item_id):
        return {"result": {"item": {"id": item_id}}}

    def test_existing_pr_on_second_page_already_done(self):
        self.run_sync([self.memberships([self.membership("other")], "next"),
                       self.memberships([self.membership()]), self.values("Done")])
        self.assertEqual(self.api.call_args_list[1].kwargs["after"], "next")
        self.assertEqual(self.writes, [])

    def test_existing_issue_updates_its_status_only(self):
        self.run_sync([self.memberships([self.membership()]), self.values("Todo"), self.mutation_result("existing")], is_pr=False)
        self.assertEqual(self.writes, [(sync.UPDATE_VALUE, {
            "project": sync.PROJECT_ID, "item": "existing", "field": "status", "option": "done",
        })])

    def test_new_issue_in_another_project_is_added_to_target(self):
        self.run_sync([self.memberships([self.membership("other")]),
                       self.mutation_result("new"), self.mutation_result("new")], is_pr=False)
        self.assertEqual(self.writes, [
            (sync.ADD_ITEM, {"project": sync.PROJECT_ID, "content": "content"}),
            (sync.UPDATE_VALUE, {"project": sync.PROJECT_ID, "item": "new", "field": "status", "option": "done"}),
        ])

    def test_archived_membership_is_preserved(self):
        self.run_sync([self.memberships([self.membership(archived=True)])])
        self.assertEqual(self.writes, [])

    def test_incomplete_or_unavailable_lookup_stops_before_writing(self):
        for reply in ({"node": None}, self.memberships([None]),
                      {"node": {"id": "content", "projectItems": {"nodes": [], "pageInfo": {"hasNextPage": None}}}},
                      self.memberships([self.membership(archived=None)]),
                      self.memberships([{"id": "redacted", "project": None}]), RuntimeError("API failure")):
            with self.subTest(reply=reply), self.assertRaisesRegex(RuntimeError, r"membership.*pull/31"):
                self.run_sync([reply])
            self.assertEqual(self.writes, [])

    def test_failed_mutation_reports_target_without_retry(self):
        with self.assertRaisesRegex(RuntimeError, r"(?i)update.*Status.*pull/31.*API failure"):
            self.run_sync([self.memberships([self.membership()]), self.values("Todo"), RuntimeError("API failure")])
        self.assertEqual(len(self.writes), 1)

    def test_unreadable_field_value_stops_before_writing(self):
        values = {"node": {"id": "existing", "fieldValues": page([None])}}
        with self.assertRaisesRegex(RuntimeError, r"membership.*pull/31"):
            self.run_sync([self.memberships([self.membership()]), values])
        self.assertEqual(self.writes, [])

    def test_unconfirmed_mutation_stops_without_retry(self):
        for reply in ({"result": {"item": None}}, {"result": None}, self.mutation_result("wrong")):
            with self.subTest(reply=reply), self.assertRaisesRegex(RuntimeError, r"Update Status.*pull/31"):
                self.run_sync([self.memberships([self.membership()]), self.values("Todo"), reply])
            self.assertEqual(len(self.writes), 1)
        with self.assertRaisesRegex(RuntimeError, r"Add Project item.*pull/31"):
            self.run_sync([self.memberships([]), {"result": {"item": None}}])
        self.assertEqual(len(self.writes), 1)
