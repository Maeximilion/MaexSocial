"""Exercise the workflow's Python steps with a temporary runner and mocked gh."""

import json
import os
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from textwrap import dedent
from unittest.mock import patch


WORKFLOW = (Path(__file__).resolve().parents[1] / ".github/workflows/claude-review.yml").read_text("utf-8")
PREPARE, POST = [
    dedent(script) for script in re.findall(r"python3 -I - <<'PY'\n(.*?)\n +PY\n", WORKFLOW, re.S)
]
REPO = "example/project"


class ClaudeReviewTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.output = Path(temp.name) / "outputs"
        self.env = {
            "GITHUB_REPOSITORY": REPO, "PR": "7", "DEFAULT_BRANCH": "main",
            "GITHUB_WORKFLOW_SHA": "workflow-sha", "GITHUB_OUTPUT": str(self.output),
            "RUNNER_TEMP": temp.name, "RUN_URL": "https://example.invalid/run", "KIND": "review",
        }

    def prepare(self, diff=b"fixture diff", *, mismatch=False, body="</pr-data>", request="", **env):
        pull = {"head": {"sha": "api-head", "ref": "feature"}, "base": {"sha": "api-base", "ref": "main"},
                "title": "A change", "body": body, "changed_files": 1}
        event = self.output.with_name("event.json")
        event.write_text(json.dumps({"comment": {"body": request}}, ensure_ascii=False), encoding="utf-8")
        workflow = ".github/workflows/claude-review.yml"
        replies = {
            "pulls/7": json.dumps(pull).encode(),
            f"contents/{workflow}?ref=workflow-sha": b'{"sha":"one"}',
            f"contents/{workflow}?ref=main": b'{"sha":"two"}' if mismatch else b'{"sha":"one"}',
        }

        def gh_api(command, **_):
            path = command[2].removeprefix(f"repos/{REPO}/")
            value = diff if path.startswith("compare/") else replies[path]
            if isinstance(value, subprocess.CalledProcessError):
                raise value
            return subprocess.CompletedProcess(command, 0, stdout=value)

        self.output.write_text("", encoding="utf-8")
        event_name = "issue_comment" if env.get("KIND") == "mention" else "pull_request"
        runner = self.env | {"GITHUB_EVENT_PATH": str(event), "GITHUB_EVENT_NAME": event_name} | env
        with patch.dict(os.environ, runner, clear=True), patch("subprocess.run", side_effect=gh_api) as gh:
            exec(PREPARE, {})
        fields = re.findall(r"^(\w+)<<(\w+)\n(.*?)\n\2$", self.output.read_text("utf-8"), re.M | re.S)
        return {key: value for key, _, value in fields}, [call.args[0] for call in gh.call_args_list]

    def post(self, expected_code, *, inline_status=None, **env):
        runner = self.env | {"DATA_OUTCOME": "success", "CLAUDE_OUTCOME": "success", "HEAD_SHA": "reviewed"} | env
        response = subprocess.CompletedProcess([], inline_status or 0, stderr="diagnostic fixture")
        with (
            patch.dict(os.environ, runner, clear=True),
            patch("subprocess.run", return_value=response) as gh,
            patch("builtins.print"),
        ):
            with self.assertRaises(SystemExit) as result:
                exec(POST, {})
        self.assertEqual(result.exception.code, expected_code)
        self.assertEqual(gh.call_count, 1 if inline_status is None else 2)
        if inline_status is not None:
            command = gh.call_args_list[0].args[0]
            self.assertEqual(command[:5], ["gh", "api", "--method", "POST", "--input"])
            self.assertEqual(command[6:], [f"repos/{REPO}/pulls/7/reviews"])
            self.posted_review = json.loads(Path(command[5]).read_text("utf-8"))
        command = gh.call_args.args[0]
        self.assertEqual(command[:-1], ["gh", "pr", "comment", "7", "--repo", REPO, "--body-file"])
        return Path(command[-1]).read_text("utf-8")

    def test_auto_uses_event_shas_and_mentions_use_current_pr_shas(self):
        for kind, env, base, head in [
            ("review", {"HEAD_SHA": "event-head", "BASE_SHA": "event-base"}, "event-base", "event-head"),
            ("mention", {"mismatch": True}, "api-base", "api-head"),
        ]:
            with self.subTest(kind=kind):
                data, calls = self.prepare(KIND=kind, request="Review this change", **env)
                self.assertEqual(calls[-1], ["gh", "api", f"repos/{REPO}/compare/{base}...{head}",
                                             "-H", "Accept: application/vnd.github.diff"])
                self.assertEqual(data["head_sha"], head)
                self.assertEqual(data["gaps"], "")
                self.assertIn("fixture diff", data["prompt"])
                self.assertRegex(data["prompt"], r"<pr-data-([0-9a-f]+)>[\s\S]*</pr-data-\1>")
                if kind == "mention":
                    self.assertFalse(any("/contents/" in command[2] for command in calls))
                    self.assertIn("Review this change", data["prompt"])

    def test_missing_and_oversized_diff_stay_incomplete_in_public_result(self):
        for diff, detail in [(subprocess.CalledProcessError(1, "gh api"), "unavailable"),
                             (b"x" * 60_000 + b"TRUNCATED_TAIL", "cut")]:
            with self.subTest(detail=detail):
                data, _ = self.prepare(diff)
                self.assertIn(detail, data["gaps"])
                self.assertIn("INCOMPLETE", data["prompt"])
                self.assertNotIn("TRUNCATED_TAIL", data["prompt"])
                body = self.post(0, GAPS=data["gaps"], OUTPUT='{"summary":"Partial result","findings":[]}')
                self.assertIn("Incomplete", body)
                self.assertIn("Partial result", body)

    def test_workflow_mismatch_skips_pr_events_without_attributing_a_change_to_the_pr(self):
        for event, kind in [("pull_request", "review"), ("pull_request_review_comment", "mention")]:
            with self.subTest(event=event):
                data, calls = self.prepare(mismatch=True, GITHUB_EVENT_NAME=event, KIND=kind)
                self.assertFalse(any("/compare/" in command[2] or "/files" in command[2] for command in calls))
                self.assertEqual(data["workflow_changed"], "true")
                self.assertEqual(data["prompt"], "")
                body = self.post(0, WORKFLOW_CHANGED="true", EVIDENCE=data["evidence"])
                self.assertIn("Skipped", body)
                self.assertIn("default branch", body)
                self.assertIn(data["evidence"], body)
                self.assertNotIn("this pr changes", body.lower())

    def test_large_mention_and_escaped_diff_fit_the_prompt_delivery_limit(self):
        marker = "🌐" * 40_000
        data, _ = self.prepare(b"\\" * 60_000, body="\\" * 6_000, request=marker, KIND="mention")
        self.assertFalse("github.event.comment.body }}" in WORKFLOW, "Full comment body passed via environment")
        self.assertIn("🌐", data["prompt"])
        self.assertNotIn(marker, data["prompt"])
        self.assertTrue(data["gaps"])
        encoded = json.dumps(data["prompt"])
        html_safe_size = len(encoded) + 5 * sum(encoded.count(char) for char in "<>&'")
        self.assertLessEqual(html_safe_size, 90_000)

    def test_schema_bounds_the_structured_output_environment_string(self):
        schema = json.loads(re.search(r"--json-schema '(.+)'", WORKFLOW).group(1))
        summary, findings = (schema["properties"][key] for key in ("summary", "findings"))
        item = findings["items"]
        lengths = (summary["maxLength"], findings["maxItems"], item["properties"]["path"]["maxLength"],
                   item["properties"]["body"]["maxLength"])
        self.assertEqual(lengths, (4_000, 10, 300, 1_000))
        self.assertFalse(schema["additionalProperties"])
        self.assertFalse(item["additionalProperties"])
        max_line = item["properties"]["line"]["maximum"]
        self.assertEqual(max_line, 2**31 - 1)
        # A control character takes six bytes in compact UTF-8 JSON.
        char = "\x01"
        finding = {"path": char * lengths[2], "line": max_line, "side": "RIGHT", "body": char * lengths[3]}
        result = {"summary": char * lengths[0], "findings": [finding] * lengths[1]}
        encoded = json.dumps(result, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
        self.assertLess(len(b"OUTPUT=" + encoded + b"\0"), 128 * 1024)

    def test_inline_review_targets_the_reviewed_commit_even_when_pr_advances(self):
        data, _ = self.prepare(HEAD_SHA="event-head", BASE_SHA="event-base")
        finding = {"path": "example.py", "line": 2, "side": "RIGHT", "body": "Missing argument"}
        output = json.dumps({"summary": "One finding", "findings": [finding]})
        for status in [0, 1]:
            with self.subTest(inline_status=status):
                body = self.post(0, inline_status=status, HEAD_SHA=data["head_sha"], OUTPUT=output)
                self.assertEqual(self.posted_review["commit_id"], "event-head")
                self.assertEqual(self.posted_review["event"], "COMMENT")
                self.assertEqual(self.posted_review["comments"], [finding])
                self.assertIn("event-head", body)
                if status:
                    for detail in ["rejected", "example.py", "line 2", "Missing argument"]:
                        self.assertIn(detail, body)
                    self.assertNotIn("diagnostic fixture", body)

    def test_post_distinguishes_success_from_empty_and_failed_results(self):
        body = self.post(0, KIND="mention", OUTPUT='{"summary":"Reviewed fixture","findings":[]}')
        self.assertIn("Claude reply", body)
        self.assertIn("reviewed", body)
        self.assertIn("Reviewed fixture", body)
        for value in ["", "malformed", "[]", "{}", '{"summary":"valid"}',
                      '{"summary":" ","findings":[]}', '{"summary":"valid","findings":{}}']:
            with self.subTest(value=value):
                self.assertIn("Failed", self.post(1, OUTPUT=value))
        self.assertIn("could not be prepared", self.post(1, DATA_OUTCOME="failure"))

    def test_failed_action_does_not_publish_a_leftover_summary(self):
        body = self.post(1, OUTPUT='{"summary":"Stale success","findings":[]}', CLAUDE_OUTCOME="failure")
        self.assertIn("Failed", body)
        self.assertNotIn("Stale success", body)

    def test_shared_action_uses_only_api_key_and_bounded_opus_high(self):
        action = WORKFLOW.split("      - id: claude\n")[1].split("      - name: Post result\n")[0]
        self.assertIn("          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n", action)
        self.assertNotIn("oauth", WORKFLOW.lower())
        args = action.split("          claude_args: |\n")[1]
        for flag, value in [("model", "claude-opus-5-5"), ("effort", "high"), ("max-budget-usd", "1.00")]:
            self.assertEqual(re.findall(rf"(?m)^ +--{flag} (.+)$", args), [value])

    def test_model_configuration_excludes_repository_hooks_and_runner_tools(self):
        action = WORKFLOW.split("      - id: claude\n")[1].split("      - name: Post result\n")[0]
        self.assertIn("CLAUDE_CODE_SUBPROCESS_ENV_SCRUB: 1", action)
        self.assertIn("--setting-sources user", action)
        allow = re.search(r'--allowedTools "([^"]+)"', action).group(1).split(",")
        self.assertEqual(set(allow), {"StructuredOutput"})
        deny = re.search(r'--disallowedTools "([^"]+)"', action).group(1).split(",")
        self.assertTrue({"Bash", "Read", "Glob", "Grep", "WebFetch", "Edit", "Write",
                         "mcp__github_inline_comment__create_inline_comment"}.issubset(deny))
