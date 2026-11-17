"""Offline lifecycle tests: no GitHub writes or paid requests."""

from contextlib import redirect_stdout
from copy import deepcopy
from io import StringIO
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

from scripts import claude_protected_review as route


REPO = "example/project"
HEAD, BASE, TRUSTED, MERGE, ANCESTOR = [c * 40 for c in "abcde"]
DIFF = b"diff --git a/scripts/claude_input.py b/scripts/claude_input.py\n--- a/scripts/claude_input.py\n+++ b/scripts/claude_input.py\n@@ -1 +1 @@\n-old\n+new\n"


class ProtectedReviewTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.folder = Path(temp.name)
        self.env = {
            "GITHUB_REPOSITORY": REPO, "PR": "7", "HEAD_SHA": HEAD, "BASE_SHA": BASE,
            "TARGET_REF": "main", "REVIEWER_COMMIT": TRUSTED, "CHECKOUT_SHA": TRUSTED,
            "GITHUB_SHA": TRUSTED, "GITHUB_WORKFLOW_SHA": TRUSTED,
            "GITHUB_WORKFLOW_REF": f"{REPO}/.github/workflows/claude-protected-review.yml@refs/heads/main",
            "GITHUB_REF": "refs/heads/main", "GITHUB_EVENT_NAME": "workflow_dispatch",
            "GITHUB_RUN_ATTEMPT": "1", "GITHUB_RUN_ID": "123", "GITHUB_ACTOR": "maintainer",
            "GITHUB_TRIGGERING_ACTOR": "maintainer", "RUNNER_TEMP": temp.name,
            "GITHUB_OUTPUT": str(self.folder / "output"), "KIND": "review",
            "DATA_OUTCOME": "success", "CLAUDE_OUTCOME": "success",
        }
        self.pull = {
            "number": 7, "state": "open", "merged": False, "mergeable": True,
            "merge_commit_sha": MERGE, "changed_files": 1, "title": "Fix input", "body": "A real change",
            "user": {"login": "author"},
            "head": {"sha": HEAD, "ref": "feature", "repo": {"full_name": REPO}},
            "base": {"sha": BASE, "ref": "main", "repo": {"full_name": REPO}},
        }
        self.compare = {"merge_base_commit": {"sha": ANCESTOR},
                        "files": [{"filename": "scripts/claude_input.py", "status": "modified"}]}
        self.responses = {
            f"repos/{REPO}": {"default_branch": "main"},
            f"repos/{REPO}/git/ref/heads/main": {"object": {"sha": TRUSTED}},
            f"repos/{REPO}/pulls/7": self.pull,
            f"repos/{REPO}/compare/{BASE}...{HEAD}?per_page=1": self.compare,
            f"repos/{REPO}/git/commits/{MERGE}": {"parents": [{"sha": BASE}, {"sha": HEAD}]},
            f"repos/{REPO}/collaborators/maintainer/permission": {"permission": "write"},
        }
        # The target and default are the same ref in production; model them consistently.
        self.env["BASE_SHA"] = TRUSTED
        self.pull["base"]["sha"] = TRUSTED
        self.responses[f"repos/{REPO}/compare/{TRUSTED}...{HEAD}?per_page=1"] = self.compare
        self.responses[f"repos/{REPO}/git/commits/{MERGE}"]["parents"][0]["sha"] = TRUSTED
        self.diff = DIFF
        self.writes = []
        self.write_failure = False
        self.fail_inline_only = False
        self.after_write = None
        self.api_mock = patch.object(route.source, "api", side_effect=self.api).start()
        self.addCleanup(patch.stopall)
        patch.object(route.subprocess, "run", side_effect=self.run_gh).start()

    def api(self, path, accept=None):
        if accept:
            return self.diff
        return json.dumps(self.responses[path]).encode()

    def run_gh(self, command, **kwargs):
        self.assertTrue(kwargs.get("capture_output"))
        payload = json.loads(Path(command[command.index("--input") + 1]).read_text("utf-8"))
        self.writes.append((command[-1], payload))
        if self.after_write:
            self.after_write()
        failed = self.write_failure or self.fail_inline_only and command[-1].endswith("/reviews")
        return subprocess.CompletedProcess(command, int(failed), stdout=b"", stderr=b"PRIVATE ERROR")

    def result(self, **fields):
        (self.folder / "claude-result.json").write_text(json.dumps(
            {"findings": [], "overflow": False} | fields), "utf-8")

    def prepare(self):
        route.prepare(self.env)
        self.result()

    def assert_denied(self):
        with self.assertRaises(route.Denied):
            route.prepare(self.env)
        self.assertFalse((self.folder / "claude-input.json").exists())
        self.assertFalse(self.writes)

    def test_valid_protected_diff_reuses_input_builder_and_publishes_exact_evidence(self):
        self.prepare()
        system, data = json.loads((self.folder / "claude-input.json").read_text("utf-8"))
        self.assertIn(DIFF.decode(), data)
        self.assertIn("untrusted data", system)
        self.assertEqual(route.publish(self.env), 0)
        self.assertEqual(len(self.writes), 1)
        body = self.writes[0][1]["body"]
        for value in [HEAD, TRUSTED, MERGE, ANCESTOR, "actions/runs/123", "Complete", "0 findings"]:
            self.assertIn(value, body)

    def test_public_reviewer_commit_evidence_contains_no_credentials(self):
        with patch.dict(self.env, {"GH_TOKEN": "PRIVATE-GITHUB-FIXTURE", "ANTHROPIC_API_KEY": "PRIVATE-PROVIDER-FIXTURE"}):
            self.prepare()
            evidence = json.loads((self.folder / "claude-protected-state.json").read_text("utf-8"))
            self.assertEqual(evidence["reviewer_commit"], TRUSTED)
            route.publish(self.env)
        for path in self.folder.glob("*.json"):
            self.assertNotIn("PRIVATE-", path.read_text("utf-8"))

    def test_rejects_closed_fork_retarget_moved_and_unknown_candidate(self):
        original = deepcopy(self.pull)
        for change in [lambda p: p.update(state="closed"), lambda p: p.update(merged=True),
                       lambda p: p["head"]["repo"].update(full_name="fork/project"),
                       lambda p: p["base"]["repo"].update(full_name="other/project"),
                       lambda p: p["head"].update(sha="f" * 40),
                       lambda p: p["base"].update(sha=BASE),
                       lambda p: p["base"].update(ref="release"),
                       lambda p: p.update(mergeable=None), lambda p: p.update(mergeable=False)]:
            self.pull.clear()
            self.pull.update(deepcopy(original))
            change(self.pull)
            self.assert_denied()

    def test_dispatch_trust_authorization_and_rerun_guards(self):
        for name, value in [("PR", "7/evil"), ("HEAD_SHA", ""), ("BASE_SHA", "bad"),
                            ("TARGET_REF", ""), ("CHECKOUT_SHA", BASE), ("REVIEWER_COMMIT", BASE),
                            ("GITHUB_SHA", BASE), ("GITHUB_WORKFLOW_SHA", BASE),
                            ("GITHUB_WORKFLOW_REF", "other/workflow"), ("GITHUB_REF", "refs/heads/feature"),
                            ("GITHUB_EVENT_NAME", "pull_request"), ("GITHUB_RUN_ATTEMPT", "2")]:
            with self.subTest(name=name), patch.dict(self.env, {name: value}):
                self.assert_denied()
        self.responses[f"repos/{REPO}/collaborators/maintainer/permission"] = {"permission": "read"}
        self.assert_denied()

    def test_rejects_changed_default_tip_and_wrong_merge_parents(self):
        self.responses[f"repos/{REPO}/git/ref/heads/main"]["object"]["sha"] = BASE
        self.assert_denied()
        self.responses[f"repos/{REPO}/git/ref/heads/main"]["object"]["sha"] = TRUSTED
        self.responses[f"repos/{REPO}/git/commits/{MERGE}"]["parents"][0]["sha"] = BASE
        with self.assertRaisesRegex(route.Denied, "^candidate_parents_mismatch$"):
            route.prepare(self.env)

    def test_distinct_target_branch_and_revoked_triggering_actor(self):
        self.env["TARGET_REF"] = "release/next"
        self.pull["base"]["ref"] = "release/next"
        self.responses[f"repos/{REPO}/git/ref/heads/release%2Fnext"] = {"object": {"sha": TRUSTED}}
        self.prepare()
        self.env["GITHUB_TRIGGERING_ACTOR"] = "revoked"
        self.responses[f"repos/{REPO}/collaborators/revoked/permission"] = {"permission": "read"}
        self.assert_denied()

    def test_self_changes_and_renames_and_unprotected_pr_are_denied(self):
        for name in [".github/workflows/claude-protected-review.yml", "scripts/claude_protected_review.py"]:
            for field in ["filename", "previous_filename"]:
                self.compare["files"] = [{"filename": "scripts/claude_input.py", field: name}]
                self.assert_denied()
        self.compare["files"] = [{"filename": "docs/readme.md"}]
        self.assert_denied()
        self.compare["files"] = [{"filename": "new.py", "previous_filename": "scripts/claude_input.py"}]
        self.prepare()

    def test_path_cap_and_incomplete_diff_or_metadata_are_denied(self):
        self.compare["files"] *= 300
        self.pull["changed_files"] = 300
        self.assert_denied()
        self.compare["files"] = self.compare["files"][:1]
        self.assert_denied()
        self.pull["changed_files"] = 1
        for diff in [b"", b"x" * 120001, b"Binary files a/x and b/x differ\n", b"bad\xff", b"bad\0"]:
            self.diff = diff
            self.assert_denied()
        self.diff = DIFF
        self.pull["body"] = "x" * 6001
        self.assert_denied()

    def test_prepare_removes_previous_result_and_rechecks_after_input(self):
        self.result()
        original = route.source.build_input
        def moving_input(*args):
            result = original(*args)
            self.pull["head"]["sha"] = "f" * 40
            return result
        with patch.object(route.source, "build_input", side_effect=moving_input):
            self.assert_denied()
        self.assertFalse((self.folder / "claude-result.json").exists())

    def test_inline_and_summary_are_bound_to_head(self):
        self.prepare()
        self.result(findings=[{"path": "scripts/claude_input.py", "line": 1, "side": "RIGHT", "body": "Concrete defect"}])
        self.assertEqual(route.publish(self.env), 0)
        self.assertEqual(len(self.writes), 2)
        self.assertEqual(self.writes[0][1]["commit_id"], HEAD)
        self.assertEqual(self.writes[0][1]["comments"][0]["side"], "RIGHT")

    def test_stale_before_publication_or_between_writes_never_claims_complete(self):
        self.prepare()
        self.pull["body"] = "Changed review request"
        with self.assertRaises(route.Denied):
            route.publish(self.env)
        self.assertFalse(self.writes)
        self.pull["body"] = "A real change"
        self.result(findings=[{"path": "scripts/claude_input.py", "line": 1, "side": "RIGHT", "body": "Defect"}])
        self.after_write = lambda: self.pull["head"].update(sha="f" * 40)
        with self.assertRaises(route.Denied):
            route.publish(self.env)
        self.assertEqual(len(self.writes), 1)
        self.assertNotIn("Complete", self.writes[0][1]["body"])

    def test_api_failure_cannot_reuse_old_valid_result(self):
        self.prepare()
        for field in ["DATA_OUTCOME", "CLAUDE_OUTCOME"]:
            for value in ["failure", "skipped", "cancelled", ""]:
                with self.subTest(field=field, value=value), patch.dict(self.env, {field: value}):
                    self.assertEqual(route.publish(self.env), 1)
                    self.assertIn("Incomplete", self.writes[-1][1]["body"])
                    self.assertNotIn("0 findings", self.writes[-1][1]["body"])

    def test_missing_invalid_overflow_and_inline_failure_remain_incomplete(self):
        self.prepare()
        for raw in ["", "{}", '{"findings":[],"overflow":false,"overflow":false}']:
            (self.folder / "claude-result.json").write_text(raw, "utf-8")
            self.assertEqual(route.publish(self.env), 1)
            self.assertIn("Incomplete", self.writes[-1][1]["body"])
        self.result(overflow=True)
        self.assertEqual(route.publish(self.env), 1)
        self.result(findings=[{"path": "scripts/claude_input.py", "line": 1, "side": "RIGHT", "body": "Defect"}])
        self.write_failure = True
        with self.assertRaises(route.Denied):
            route.publish(self.env)
        self.assertNotIn("Complete", self.writes[-1][1]["body"])

    def test_inline_rejection_preserves_findings_in_incomplete_overview(self):
        self.prepare()
        self.result(findings=[{"path": "scripts/claude_input.py", "line": 999, "side": "RIGHT", "body": "Defect"}])
        self.fail_inline_only = True
        self.assertEqual(route.publish(self.env), 1)
        self.assertIn("Inline placement failed", self.writes[-1][1]["body"])
        self.assertIn("Defect", self.writes[-1][1]["body"])

    def test_real_client_entrypoint_with_mock_transport_proves_outcome_boundary(self):
        for stop in ["end_turn", "max_tokens"]:
            route.prepare(self.env)
            message = {"type": "message", "role": "assistant", "model": route.source.client.MODEL,
                       "stop_reason": stop, "usage": {"input_tokens": 17, "output_tokens": 42},
                       "content": [{"type": "thinking", "thinking": "HIDDEN THINKING"},
                                   {"type": "text", "text": '{"findings":[],"overflow":false}'}]}
            with patch.object(route.source.client, "HTTPSConnection") as connect, patch.dict(
                    os.environ, self.env | {"ANTHROPIC_API_KEY": "SECRET-FIXTURE"}, clear=True), redirect_stdout(StringIO()) as logs:
                response = connect.return_value.getresponse.return_value
                response.status, response.length = 200, 0
                response.read.return_value = json.dumps(message).encode()
                outcome = route.source.client.main()
                connect.return_value.request.assert_called_once()
                self.assertNotIn("SECRET", logs.getvalue())
                self.assertNotIn("HIDDEN", logs.getvalue())
            self.env["CLAUDE_OUTCOME"] = "success" if outcome == 0 else "failure"
            self.assertEqual(route.publish(self.env), int(stop != "end_turn"))
            self.assertIn("Complete" if stop == "end_turn" else "Incomplete", self.writes[-1][1]["body"])

    def test_unavailable_github_diff_has_fixed_diagnostic(self):
        with patch.object(route.source, "api", side_effect=subprocess.CalledProcessError(1, "gh", stderr=b"SECRET")), patch.dict(
                os.environ, self.env, clear=True), redirect_stdout(StringIO()) as logs:
            self.assertEqual(route.main(["prepare"]), 1)
        self.assertEqual(logs.getvalue().strip(), "::error::Protected Claude review incomplete: local_failure")

    def test_errors_never_log_external_content(self):
        with patch.dict(os.environ, self.env, clear=True), patch.object(route, "prepare", side_effect=RuntimeError("SECRET RAW THINKING")), redirect_stdout(StringIO()) as logs:
            self.assertEqual(route.main(["prepare"]), 1)
        self.assertNotIn("SECRET", logs.getvalue())
        self.assertIn("local_failure", logs.getvalue())


class WorkflowContractTests(unittest.TestCase):
    def test_workflow_scopes_credentials_and_never_selects_pr_code(self):
        root = Path(__file__).resolve().parents[1]
        workflow = (root / ".github/workflows/claude-protected-review.yml").read_text("utf-8")
        prepare, api, publish = workflow.split("      - name: ")[1:]
        self.assertNotIn("ANTHROPIC_API_KEY", prepare + publish)
        self.assertNotIn("GH_TOKEN", api)
        self.assertIn("run: python3 -I scripts/claude_messages.py", api)
        self.assertIn("if: steps.data.outputs.ready == 'true'", api)
        self.assertIn("ref: ${{ github.event.repository.default_branch }}", workflow)
        self.assertNotIn("ref: ${{ inputs.", workflow)
        self.assertIn("persist-credentials: false", workflow)
        self.assertIn("timeout-minutes: 20", workflow)
        self.assertIn("github.run_attempt == 1", workflow)
        self.assertNotIn("pull_request_target:", workflow)
        self.assertNotIn("continue-on-error", workflow)
        self.assertEqual(workflow.count("secrets.ANTHROPIC_API_KEY"), 1)

    def test_isolated_cli_imports_trusted_siblings(self):
        script = Path(__file__).resolve().parents[1] / "scripts/claude_protected_review.py"
        with tempfile.TemporaryDirectory() as folder:
            result = subprocess.run([sys.executable, "-I", str(script), "--help"], cwd=folder,
                                    capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("prepare,publish", result.stdout)


if __name__ == "__main__":
    unittest.main()
