"""Regression checks for documentation parsing and Project status transitions."""

import unittest

from scripts.check_repo import local_targets
from scripts.project_sync import desired_gate, desired_priority, desired_status


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


if __name__ == "__main__":
    unittest.main()
