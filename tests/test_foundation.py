"""Regression checks for documentation parsing and Project status transitions."""

import unittest
import subprocess
from copy import deepcopy
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from scripts.check_repo import local_targets
from scripts.project_sync import desired_gate, desired_priority, desired_status
from scripts import check_repo, project_sync


class FoundationTests(unittest.TestCase):
    def test_manual_anatomy_command_wiring(self):
        root = Path(__file__).resolve().parents[1]
        skill = root / ".agents/skills/source-command-anatomy"
        command = ".claude/commands/anatomy.md"
        self.assertTrue((root / command).is_file())
        self.assertIn(command, (skill / "SKILL.md").read_text(encoding="utf-8"))
        policy = (skill / "agents/openai.yaml").read_text(encoding="utf-8")
        self.assertRegex(policy, r"(?m)^policy:\n  allow_implicit_invocation: false$")

    def test_wrong_project_stops_before_mutation(self):
        with patch.object(project_sync, "gh", return_value={"data": {"node": {"id": "different-project"}}}) as cli:
            with self.assertRaisesRegex(RuntimeError, "MaexSocial Project"):
                project_sync.reconcile()
            self.assertEqual(cli.call_count, 1)

    def test_cli_failure_preserves_diagnostic(self):
        result = subprocess.CompletedProcess(["gh"], 1, "", "GraphQL: missing project scope\n")
        with patch.object(project_sync.subprocess, "run", return_value=result):
            with self.assertRaisesRegex(RuntimeError, "missing project scope"):
                project_sync.gh("api", "graphql")

    def test_project_inventory_paginates_fields_items_and_values(self):
        def page(nodes, cursor=None):
            return {"nodes": nodes, "pageInfo": {"hasNextPage": cursor is not None, "endCursor": cursor}}

        responses = [
            {"node": {"id": project_sync.PROJECT_ID, "fields": page([{}], "fields-1")}},
            {"node": {"id": project_sync.PROJECT_ID, "fields": page([{"id": "status", "name": "Status"}])}},
            {"node": {"id": project_sync.PROJECT_ID, "items": page([
                {"id": "item-1", "content": None, "fieldValues": page([{}], "values-1")}
            ], "items-1")}},
            {"node": {"id": project_sync.PROJECT_ID, "items": page([
                {"id": "item-2", "content": {"url": "https://example.com"}, "fieldValues": page([])}
            ])}},
            {"node": {"id": "item-1", "fieldValues": page([
                {"name": "In Progress", "field": {"name": "Status"}}
            ])}},
        ]
        with patch.object(project_sync, "gh", side_effect=[{"data": response} for response in responses]) as cli:
            fields, items = project_sync.project_inventory()
        self.assertEqual(fields, [{"id": "status", "name": "Status"}])
        self.assertEqual([item["id"] for item in items], ["item-1", "item-2"])
        self.assertEqual(items[0]["status"], "In Progress")
        calls = [call.args for call in cli.call_args_list]
        self.assertIn("after=fields-1", calls[1])
        self.assertIn("after=items-1", calls[3])
        self.assertIn("after=values-1", calls[4])
        self.assertTrue(all(call[:2] == ("api", "graphql") for call in calls))
        self.assertFalse(any("mutation" in argument for call in calls for argument in call))

    def test_markdown_targets(self):
        text = '[doc](docs/a.md#section) ![img](<assets/a b.svg>) [web](https://example.com) [anchor](#id)\n```md\n[example](missing.md)\n```\n'
        self.assertEqual(list(local_targets(text)), ["docs/a.md", "assets/a b.svg"])

    def test_toml_configuration_syntax_is_checked(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            config = root / "reviewer.toml"
            with patch.object(check_repo.subprocess, "check_output", return_value=b"reviewer.toml\0"):
                config.write_text('name = "reviewer"\nmodel_reasoning_effort = "high"\n', encoding="utf-8")
                self.assertEqual(check_repo.check(root), [])
                config.write_text('name = [\n', encoding="utf-8")
                errors = check_repo.check(root)
                self.assertEqual(len(errors), 1)
                self.assertIn("reviewer.toml:", errors[0])

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
            if args[0] == "api":
                return [deepcopy(issues if "/issues?" in args[-1] else prs)]
            if args[:2] == ("pr", "list"):
                return [{"number": 11, "closingIssuesReferences": []}]
            self.fail(f"Unexpected GitHub mutation or request: {args}")

        def fake_graphql(query, **variables):
            if query == project_sync.FIELDS_QUERY:
                nodes = [{"id": "status-field", "name": "Status", "options": options}]
                return {"node": {"id": project_sync.PROJECT_ID, "fields": {
                    "nodes": nodes, "pageInfo": {"hasNextPage": False, "endCursor": None}
                }}}
            if query == project_sync.ITEMS_QUERY:
                nodes = []
                for item in project_items:
                    values = [{"name": item["status"], "field": {"name": "Status"}}] if "status" in item else []
                    nodes.append({"id": item["id"], "content": item["content"], "fieldValues": {
                        "nodes": values, "pageInfo": {"hasNextPage": False, "endCursor": None}
                    }})
                return {"node": {"id": project_sync.PROJECT_ID, "items": {
                    "nodes": nodes, "pageInfo": {"hasNextPage": False, "endCursor": None}
                }}}
            if query == project_sync.UPDATE_VALUE:
                mutations.append(variables)
                self.assertEqual(variables["project"], project_sync.PROJECT_ID)
                next(item for item in project_items if item["id"] == variables["item"])["status"] = variables["option"]
                return {"updateProjectV2ItemFieldValue": {"projectV2Item": {"id": variables["item"]}}}
            self.fail(f"Unexpected GraphQL mutation or request: {query}")

        with patch.object(project_sync, "gh", side_effect=fake_gh), patch.object(project_sync, "graphql", side_effect=fake_graphql):
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
