"""Regression checks for documentation parsing and Project status transitions."""

import unittest
from copy import deepcopy
from unittest.mock import patch

from scripts.check_repo import local_targets
from scripts.project_sync import desired_gate, desired_priority, desired_status
from scripts import project_sync


class FoundationTests(unittest.TestCase):
    def test_markdown_targets(self):
        text = '[doc](docs/a.md#section) ![img](<assets/a b.svg>) [web](https://example.com) [anchor](#id)\n```md\n[example](missing.md)\n```\n'
        self.assertEqual(list(local_targets(text)), ["docs/a.md", "assets/a b.svg"])

    def test_cancelled_work_never_becomes_done(self):
        self.assertIsNone(desired_status({"state": "closed", "state_reason": "not_planned"}))
        self.assertIsNone(desired_status({"state": "closed", "merged_at": None}, is_pr=True))
        self.assertEqual(desired_status({"state": "closed", "merged_at": "2026-11-04"}, is_pr=True), "Done")

    def test_blocked_overrides_open_pr(self):
        record = {"state": "open", "labels": [{"name": "status: blocked"}]}
        self.assertEqual(desired_status(record, is_pr=True), "Blocked")
        self.assertEqual(desired_status({"state": "open"}, is_pr=True), "In review")

    def test_gate_and_priority_labels(self):
        record = {"labels": [{"name": "gate:g2"}, {"name": "priority:p1"}]}
        self.assertEqual(desired_gate(record), "G2")
        self.assertEqual(desired_priority(record), "P1")

    def test_linked_issue_progress_preserves_blocked_status(self):
        record = {"number": 7, "state": "open", "labels": []}
        self.assertEqual(desired_status(record, active_issue_numbers={7}), "In Progress")
        self.assertEqual(desired_status(record, active_issue_numbers={8}), "Todo")
        record["labels"] = [{"name": "status: blocked"}]
        self.assertEqual(desired_status(record, active_issue_numbers={7}), "Blocked")

    def test_reconcile_partial_references_is_idempotent(self):
        base = f"https://github.com/{project_sync.REPOSITORY}"
        issues = [
            {"number": number, "state": "open", "html_url": f"{base}/issues/{number}", "labels": []}
            for number in (7, 8, 9, 10)
        ]
        issues[1]["labels"] = [{"name": "status: blocked"}]
        prs = [
            {"number": 11, "state": "open", "html_url": f"{base}/pull/11", "labels": [],
             "body": "Refs #7\nReferences #8\nRefs other/repo#9"},
            {"number": 12, "state": "closed", "html_url": f"{base}/pull/12", "labels": [],
             "body": "Refs #10", "merged_at": None},
        ]
        project_items = [
            {"id": str(record["number"]), "content": {"url": record["html_url"]},
             "status": "Todo", "iteration": {"title": "Sprint 1"}}
            for record in issues + prs
        ]
        project_items[4]["status"] = "In review"
        project_items[5].pop("status")
        options = [{"id": name, "name": name} for name in ("Todo", "In Progress", "In review", "Blocked", "Done")]
        mutations = []

        def fake_gh(*args):
            if args[:2] == ("project", "view"):
                return {"id": "project"}
            if args[:2] == ("project", "field-list"):
                return {"fields": [{"id": "status-field", "name": "Status", "options": options}]}
            if args[:2] == ("project", "item-list"):
                return {"items": deepcopy(project_items), "totalCount": len(project_items)}
            if args[0] == "api":
                return [deepcopy(issues if "/issues?" in args[-1] else prs)]
            if args[:2] == ("pr", "list"):
                return [{"number": 11, "closingIssuesReferences": []}]
            if args[:2] == ("project", "item-edit"):
                mutations.append(args)
                item_id = args[args.index("--id") + 1]
                option = args[args.index("--single-select-option-id") + 1]
                next(item for item in project_items if item["id"] == item_id)["status"] = option
                return None
            self.fail(f"Unexpected GitHub mutation or request: {args}")

        with patch.object(project_sync, "gh", side_effect=fake_gh):
            project_sync.reconcile()
            self.assertEqual([item.get("status") for item in project_items],
                             ["In Progress", "Blocked", "Todo", "Todo", "In review", None])
            self.assertEqual(len(mutations), 2)
            mutations.clear()
            project_sync.reconcile()
            self.assertEqual(mutations, [])
        self.assertTrue(all(item["iteration"] == {"title": "Sprint 1"} for item in project_items))
        self.assertTrue(all(issue["state"] == "open" for issue in issues))


if __name__ == "__main__":
    unittest.main()
