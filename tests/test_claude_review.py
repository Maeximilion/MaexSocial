"""Exercise the workflow's Python steps with a temporary runner and mocked gh."""

import io
import json
import os
import re
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path
from textwrap import dedent
from unittest.mock import patch

from scripts import claude_input


WORKFLOW = (Path(__file__).resolve().parents[1] / ".github/workflows/claude-review.yml").read_text("utf-8")
POST, = [
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
            "GITHUB_WORKFLOW_SHA": "workflow-sha", "TRUSTED_SHA": "default-sha", "GITHUB_OUTPUT": str(self.output),
            "RUNNER_TEMP": temp.name, "RUN_URL": "https://example.invalid/run", "KIND": "review",
        }

    def prepare(self, diff=b"fixture diff", *, mismatch=False, files=None, body="</pr-data>", request="", pull_fields=None, **env):
        pull = {"head": {"sha": "api-head", "ref": "feature"}, "base": {"sha": "api-base", "ref": "main"},
                "title": "A change", "body": body, "changed_files": len(files) if files is not None else 1}
        pull.update(pull_fields or {})
        event = self.output.with_name("event.json")
        event.write_text(json.dumps({"comment": {"body": request}}, ensure_ascii=False), encoding="utf-8")
        workflow = ".github/workflows/claude-review.yml"
        replies = {
            "pulls/7": json.dumps(pull).encode(),
            f"contents/{workflow}?ref=workflow-sha": b'{"sha":"one"}',
            f"contents/{workflow}?ref=default-sha": b'{"sha":"two"}' if mismatch else b'{"sha":"one"}',
        }

        def gh_api(command, **_):
            path = command[2].removeprefix(f"repos/{REPO}/")
            if path.endswith("?per_page=1"):
                value = json.dumps({"files": files or []}).encode()
            else:
                value = diff if path.startswith("compare/") else replies[path]
            if isinstance(value, subprocess.CalledProcessError):
                raise value
            return subprocess.CompletedProcess(command, 0, stdout=value)

        self.output.write_text("", encoding="utf-8")
        input_file = self.output.with_name("claude-input.json")
        input_file.unlink(missing_ok=True)
        event_name = "issue_comment" if env.get("KIND") == "mention" else "pull_request_target"
        runner = self.env | {"GITHUB_EVENT_PATH": str(event), "GITHUB_EVENT_NAME": event_name} | env
        with patch.dict(os.environ, runner, clear=True), patch("subprocess.run", side_effect=gh_api) as gh:
            self.assertEqual(claude_input.main([]), 0)
        fields = re.findall(r"^(\w+)<<(\w+)\n(.*?)\n\2$", self.output.read_text("utf-8"), re.M | re.S)
        self.system, self.frames = json.loads(input_file.read_text("utf-8")) if input_file.exists() else ("", "")
        return {key: value for key, _, value in fields} | {"prompt": self.system + self.frames}, [call.args[0] for call in gh.call_args_list]

    def post(self, expected_code, *, inline_status=None, **env):
        self.output.with_name("claude-result.json").write_text(env.pop("OUTPUT", ""), encoding="utf-8")
        runner = self.env | {"DATA_OUTCOME": "success", "CLAUDE_OUTCOME": "success",
                             "HEAD_SHA": "reviewed", "BASE_SHA": "base"} | env
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
            ("mention", {"GITHUB_WORKFLOW_SHA": "default-sha"}, "api-base", "api-head"),
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

    def test_missing_auto_diff_skips_paid_step_and_posts_notice(self):
        self.assertIn("if: steps.data.outputs.ready == 'true'", WORKFLOW)
        for diff in [subprocess.CalledProcessError(1, "gh api"), b"", b"  "]:
            data, _ = self.prepare(diff)
            self.assertEqual(data["ready"], "false")
            self.assertFalse(self.output.with_name("claude-input.json").exists())
            body = self.post(1, GAPS=data["gaps"], HEAD_SHA=data["head_sha"], CLAUDE_OUTCOME="skipped")
            self.assertIn("No API request sent", body)
            self.assertIn("Incomplete", body)
            self.assertIn(data["head_sha"], body)

    def test_mention_can_answer_with_an_explicit_empty_diff_gap(self):
        data, _ = self.prepare(b"", KIND="mention", request="What does the PR body say?")
        self.assertEqual(data["ready"], "true")
        self.assertIn("no reviewable diff", data["gaps"])
        self.assertIn("INCOMPLETE", self.system)
        result = {"summary": "The body describes the change.", "findings": [], "overflow": False}
        body = self.post(0, KIND="mention", GAPS=data["gaps"], OUTPUT=json.dumps(result))
        for expected in ["Incomplete", "no reviewable diff", result["summary"]]:
            self.assertIn(expected, body)

    def test_binary_sections_are_not_reviewed_as_text(self):
        binary = b"diff --git a/logo.png b/logo.png\nBinary files a/logo.png and b/logo.png differ\n"
        patch = b"diff --git a/logo.png b/logo.png\nGIT binary patch\nliteral 3\nOPAQUE\n"
        text = b"diff --git a/f b/f\n@@ -1 +1 @@\n-old\n+new\n"
        rename = b"diff --git a/b b/c\nsimilarity index 100%\nrename from b\nrename to c\n"
        for opaque in [binary, patch]:
            for tail in [b"", text, rename]:
                with self.subTest(opaque=opaque, tail=tail):
                    data, _ = self.prepare(opaque + tail)
                    self.assertIn("binary file content unavailable", data["gaps"])
                    self.assertEqual(data["ready"], "false")
                    self.assertEqual(self.frames, "")
                    self.assertFalse(self.output.with_name("claude-input.json").exists())

    def test_invalid_diff_bytes_remain_visible_as_a_coverage_gap(self):
        for bad in [b"\xa3", b"\0"]:
            data, _ = self.prepare(b"diff --git a/f b/f\n@@ -1 +1 @@\n-old\n+fee=5" + bad + b"\n")
            self.assertIn("replaced", data["gaps"])
            self.assertEqual(self.frames, "")
            self.assertEqual(data["ready"], "false")

    def test_clipped_input_skips_paid_review_and_publishes_pinned_guidance(self):
        for diff, body_text in [(b"x" * (claude_input.max_diff + 1) + b"TRUNCATED_TAIL", "body"), (b"diff", "x" * 6001)]:
            data, _ = self.prepare(diff, body=body_text)
            self.assertEqual(data["ready"], "false")
            self.assertIn("cut", data["gaps"])
            self.assertFalse(self.output.with_name("claude-input.json").exists())
            # A stale success must not become a reviewed/zero-findings notice.
            body = self.post(1, GAPS=data["gaps"], HEAD_SHA=data["head_sha"], BASE_SHA=data["base_sha"],
                             CLAUDE_OUTCOME="skipped", OUTPUT='{"overflow":false,"findings":[]}')
            for expected in ["Incomplete", "not reviewed", "No API request sent", data["gaps"],
                             "scripts/claude_input.py", "--base api-base --head api-head"]:
                self.assertIn(expected, body)
            self.assertNotIn("0 findings", body)

    def test_exact_escaped_diff_boundaries_match_read_only_preflight(self):
        base, head = "a" * 40, "b" * 40
        self.assertEqual(claude_input.escaped('🌐é\\"<>&\''), 46)
        prefix = 'diff --git a/f b/f\n@@ -0,0 +1 @@\n+🌐é\\"<>&\' '
        for limit in [119_999, 120_000, 120_001]:
            diff = (prefix + "x" * (limit - claude_input.escaped(prefix))).encode("utf-8")
            with self.subTest(limit=limit):
                data, _ = self.prepare(diff, BASE_SHA=base, HEAD_SHA=head)
                self.assertEqual(data["ready"], "false" if limit > 120_000 else "true")
                pull = {"title": "A change", "body": "</pr-data>", "changed_files": 1,
                        "head": {"ref": "feature"}, "base": {"ref": "main"}}
                with (patch.object(claude_input, "api", side_effect=[json.dumps(pull).encode(), diff]) as api,
                      patch("sys.stdout", new_callable=io.StringIO) as stdout,
                      patch("http.client.HTTPSConnection") as paid):
                    code = claude_input.main(["--repo", REPO, "--pr", "7", "--base", base, "--head", head])
                result = json.loads(stdout.getvalue())
                self.assertEqual(code, int(limit > 120_000))
                self.assertEqual({k: result[k] for k in ("status", "base_sha", "head_sha", "gaps", "diff_escaped_bytes", "diff_limit")},
                                 {"status": "incomplete" if code else "complete", "base_sha": base,
                                  "head_sha": head, "gaps": data["gaps"], "diff_escaped_bytes": limit, "diff_limit": 120_000})
                self.assertEqual((result["prompt_limit"], result["request_limit"]), (140_000, 150_000))
                if not code:
                    self.assertEqual(result["prompt_escaped_bytes"], claude_input.escaped(self.system) + claude_input.escaped(self.frames))
                    self.assertEqual(result["request_bytes"], len(claude_input.client.request_body(self.system, self.frames, "review")))
                api.assert_called_with(f"repos/{REPO}/compare/{base}...{head}", "application/vnd.github.diff")
                paid.assert_not_called()

    def test_preflight_requires_pinned_revisions_and_reports_unavailable_input(self):
        with patch.object(claude_input, "api") as api, patch("sys.stderr", new_callable=io.StringIO):
            with self.assertRaises(SystemExit) as error:
                claude_input.main(["--repo", REPO, "--pr", "7", "--base", "main", "--head", "HEAD"])
            self.assertEqual(error.exception.code, 2)
            api.assert_not_called()
        pull = {"head": {"ref": "feature"}, "base": {"ref": "main"}}
        for responses in [[subprocess.CalledProcessError(1, "gh")],
                          [json.dumps(pull).encode(), subprocess.CalledProcessError(1, "gh")]]:
            with (patch.object(claude_input, "api", side_effect=responses),
                  patch("sys.stdout", new_callable=io.StringIO) as stdout):
                self.assertEqual(claude_input.main(["--repo", REPO, "--pr", "7", "--base", "a" * 40,
                                                    "--head", "b" * 40]), 1)
            self.assertIn("incomplete", stdout.getvalue().lower())

    def test_removed_metadata_characters_are_not_silently_complete(self):
        for body in ["before\0after", "before\ud800after"]:
            data, _ = self.prepare(body=body)
            self.assertEqual(data["ready"], "false")
            self.assertIn("PR body contains unavailable", data["gaps"])

    def test_workflow_mismatch_skips_pr_events_without_attributing_a_change_to_the_pr(self):
        for event, kind in [("pull_request_target", "review"), ("issue_comment", "mention")]:
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
        self.assertLessEqual(html_safe_size, claude_input.prompt_budget)

    def test_complete_pilot_sized_diff_and_maximum_metadata_reach_transport(self):
        from scripts import claude_messages as client

        def fill(size, alphabet):
            text = alphabet * (size // claude_input.escaped(alphabet))
            return text + "x" * (size - claude_input.escaped(text))

        for kind in ("review", "mention"):
            for alphabet in ("x", '🌐é\\"<>&\''):
                for size in (90_142, 120_000):
                    with self.subTest(kind=kind, alphabet=alphabet, size=size):
                        prefix = "diff --git a/package-lock.json b/package-lock.json\n@@ -0,0 +1 @@\n+"
                        tail = "\ndiff --git a/tests/storage.ts b/tests/storage.ts\n@@ -0,0 +1 @@\n+// TAIL 🌐\n"
                        diff = prefix + fill(size - claude_input.escaped(prefix + tail), alphabet) + tail
                        self.assertEqual(claude_input.escaped(diff), size)
                        fields = {"title": fill(1000, alphabet), "user": {"login": fill(300, alphabet)},
                                  "base": {"sha": "a" * 40, "ref": fill(300, alphabet)},
                                  "head": {"sha": "b" * 40, "ref": fill(300, alphabet), "repo": {"full_name": fill(300, alphabet)}}}
                        data, _ = self.prepare(diff.encode(), body=fill(6000, alphabet), request=fill(6000, alphabet),
                                               pull_fields=fields, KIND=kind)
                        self.assertEqual((data["ready"], data["gaps"]), ("true", ""))
                        self.assertIn(diff, self.frames)
                        self.assertLessEqual(claude_input.escaped(self.system) + claude_input.escaped(self.frames), 140_000)
                        raw = client.request_body(self.system, self.frames, kind)
                        self.assertLessEqual(len(raw), 150_000)
                        self.assertEqual(raw, claude_input.client.request_body(self.system, self.frames, kind))
                        self.assertEqual(json.loads(raw)["messages"][0]["content"], self.frames)
                        fields = {"findings": [], "overflow": False}
                        if kind == "mention":
                            fields["summary"] = "fixture"
                        self.transport(fields, kind=kind)

    def test_prompt_and_serialized_request_boundaries_skip_without_input_file(self):
        for kind in ("review", "mention"):
            data, _ = self.prepare(b"x", KIND=kind)
            prompt_overhead = claude_input.escaped(self.system) + claude_input.escaped(self.frames) - 1
            request_overhead = len(claude_input.client.request_body(self.system, self.frames, kind)) - 1
            for metric, limit, overhead in (("prepared input", 140_000, prompt_overhead),
                                            ("serialized request", 150_000, request_overhead)):
                for delta in (-1, 0, 1):
                    with self.subTest(kind=kind, metric=metric, delta=delta), patch.object(claude_input, "max_diff", 160_000):
                        # Permit the synthetic input to reach each independent guard.
                        with patch.object(claude_input, "prompt_budget", 140_000 if metric == "prepared input" else 160_000):
                            data, _ = self.prepare(b"x" * (limit + delta - overhead), KIND=kind)
                        self.assertEqual(data["ready"], "false" if delta == 1 else "true")
                        self.assertEqual(self.output.with_name("claude-input.json").exists(), delta != 1)
                        if delta == 1:
                            self.assertIn(metric + " exceeds", data["gaps"])
                            notice = self.post(1, KIND=kind, GAPS=data["gaps"], CLAUDE_OUTCOME="skipped")
                            self.assertIn("No API request sent", notice)

    def test_isolated_python_loads_serializer_only_from_trusted_sibling(self):
        folder = self.output.parent
        (folder / "claude_messages.py").write_text("raise RuntimeError('untrusted sibling')", "utf-8")
        script = Path(claude_input.__file__).resolve()
        code = ("import runpy,sys; m=runpy.run_path(sys.argv[1]); "
                "print(m['client'].request_body('system', '🌐é', 'review').decode('ascii'))")
        result = subprocess.run([sys.executable, "-I", "-c", code, str(script)], cwd=folder,
                                env=os.environ | {"PYTHONPATH": str(folder)}, check=True, capture_output=True)
        self.assertEqual(result.stdout.strip(), claude_input.client.request_body("system", "🌐é", "review"))

    def test_self_skip_all_events_including_script_rename_and_capped_paths(self):
        for kind in ("mention", "review"):
            for files in ([{"filename": "scripts/claude_messages.py"}],
                          [{"filename": "scripts/claude_input.py"}],
                          [{"filename": "new.py", "previous_filename": "scripts/claude_input.py"}],
                          [{"filename": "new.py", "previous_filename": ".github/workflows/claude-review.yml"}],
                          [{"filename": "other.py"}] * 300):
                data, calls = self.prepare(files=files, KIND=kind)
                self.assertEqual(data["workflow_changed"], "true")
                self.assertEqual(data["prompt"], "")
                self.assertFalse(any("application/vnd.github.diff" in cmd for cmd in calls))

    def test_inline_review_targets_the_reviewed_commit_even_when_pr_advances(self):
        data, _ = self.prepare(HEAD_SHA="event-head", BASE_SHA="event-base")
        finding = {"path": "example.py", "line": 2, "side": "RIGHT", "body": "Missing argument"}
        output = json.dumps({"overflow": False, "findings": [finding]})
        for status in [0, 1]:
            with self.subTest(inline_status=status):
                body = self.post(0, inline_status=status, HEAD_SHA=data["head_sha"], OUTPUT=output)
                self.assertEqual(self.posted_review["commit_id"], "event-head")
                self.assertEqual(self.posted_review["event"], "COMMENT")
                self.assertEqual(self.posted_review["comments"], [finding])
                self.assertIn("event-head", body)
                for detail in ["example.py", "line 2", "RIGHT", "Missing argument"]:
                    self.assertIn(detail, body)
                self.assertEqual(body.count("Missing argument"), 1)
                if status:
                    for detail in ["rejected", "example.py", "line 2", "Missing argument"]:
                        self.assertIn(detail, body)
                    self.assertNotIn("diagnostic fixture", body)

    def test_post_distinguishes_success_from_empty_and_failed_results(self):
        body = self.post(0, KIND="mention", OUTPUT='{"summary":"Reviewed fixture","overflow":false,"findings":[]}')
        self.assertIn("Claude reply", body)
        self.assertIn("reviewed", body)
        self.assertIn("Reviewed fixture", body)
        for kind in ("review", "mention"):
            result = {"findings": [], "overflow": True}
            if kind == "mention":
                result["summary"] = "Request answered."
            body = self.post(0, KIND=kind, OUTPUT=json.dumps(result))
            self.assertIn("Incomplete", body)
            self.assertIn("omitted", body)
        body = self.post(0, OUTPUT='{"findings":[],"overflow":false}')
        self.assertIn("0 findings", body)
        self.assertNotIn("Incomplete", body)
        self.assertIn("Failed", self.post(1, KIND="mention", OUTPUT='{"findings":[],"overflow":false}'))
        for value in ["", "malformed", "[]", "{}", '{"summary":"valid"}',
                      '{"summary":" ","findings":[]}', '{"summary":"valid","findings":{}}']:
            with self.subTest(value=value):
                self.assertIn("Failed", self.post(1, OUTPUT=value))
        self.assertIn("could not be prepared", self.post(1, DATA_OUTCOME="failure"))

    def test_failed_action_does_not_publish_a_leftover_summary(self):
        body = self.post(1, OUTPUT='{"summary":"Stale success","findings":[]}', CLAUDE_OUTCOME="failure")
        self.assertIn("Failed", body)
        self.assertNotIn("Stale success", body)

    def test_provider_stops_cannot_publish_a_clean_verdict(self):
        from scripts import claude_messages as client

        clean = {"findings": [], "overflow": False}
        for stop, category in [("max_tokens", "output_token_limit"),
                               ("model_context_window_exceeded", "context_window_limit")]:
            with self.subTest(stop=stop), patch.object(client, "HTTPSConnection") as connect:
                self.prepare()
                result_file = self.output.with_name("claude-result.json")
                result_file.unlink(missing_ok=True)
                response = connect.return_value.getresponse.return_value
                response.status, response.length = 200, 0
                response.read.return_value = json.dumps({
                    "type": "message", "role": "assistant", "model": client.MODEL, "stop_reason": stop,
                    "content": [{"type": "text", "text": json.dumps(clean)}],
                    "usage": {"input_tokens": 17, "output_tokens": 32_768},
                }).encode()
                with patch.dict(os.environ, self.env | {"ANTHROPIC_API_KEY": "fixture-key"}, clear=True), \
                        patch("sys.stdout", new_callable=io.StringIO):
                    self.assertEqual(client.main(), 1)
                self.assertFalse(result_file.exists())
                self.assertIn(f"failure={category}", self.output.read_text("utf-8"))
                connect.return_value.request.assert_called_once()
                notice = self.post(1, CLAUDE_OUTCOME="failure", FAILURE=category, OUTPUT=json.dumps(clean))
                for expected in ("Incomplete", "reviewed", category):
                    self.assertIn(expected, notice)
                self.assertNotIn("0 findings", notice)

    def test_106_historical_diff_fits_without_clipping(self):
        base = "075f68325d83acc9d6129b48fff792c9d37e1085"
        head = "4a3e4ca909912e4073d3e1b61e035a7319a47eb0"
        offline = os.environ | {"GIT_NO_LAZY_FETCH": "1"}
        root = Path(__file__).resolve().parents[1]
        for sha in (base, head):
            probe = subprocess.run(["git", "rev-parse", "--verify", "--quiet", sha + "^{commit}"],
                                   cwd=root, env=offline, capture_output=True)
            if probe.returncode == 1:
                self.skipTest("historical #106 objects unavailable in this checkout")
            probe.check_returncode()
        diff = subprocess.check_output(["git", "-c", "diff.suppressBlankEmpty=false", "diff", "--no-ext-diff",
                                        "--no-textconv", "--no-color", "--abbrev=7", "--diff-algorithm=myers",
                                        "--indent-heuristic", "--inter-hunk-context=0", "--src-prefix=a/",
                                        "--dst-prefix=b/", "-U3", base + "..." + head],
                                       cwd=root, env=offline)
        decoded = diff.decode("utf-8")
        size = len(json.dumps(decoded)) - 2 + 5 * sum(decoded.count(c) for c in "<>&'")
        self.assertEqual(size, 49_210)
        paths = re.findall(r"^diff --git a/.+ b/(.+)$", decoded, re.M)
        self.assertEqual(len(paths), 8)
        self.assertEqual(len(re.findall(r"^@@ ", decoded, re.M)), 15)
        data, _ = self.prepare(diff, BASE_SHA=base, HEAD_SHA=head, files=[{"filename": p} for p in paths])
        self.assertEqual((data["ready"], data["gaps"], data["head_sha"]), ("true", "", head))
        self.assertTrue(decoded in self.frames, "incomplete historical diff")
        output = self.transport({"findings": [], "overflow": False})
        body = self.post(0, HEAD_SHA=head, OUTPUT=json.dumps(output))
        for expected in [head, "0 findings reported."]:
            self.assertIn(expected, body)
        self.assertNotIn("Incomplete", body)

    def transport(self, result, kind="review"):
        from scripts import claude_messages as client

        response = {"type": "message", "role": "assistant", "model": client.MODEL, "stop_reason": "end_turn",
                    "content": [{"type": "thinking", "thinking": "PRIVATE"}, {"type": "text", "text": json.dumps(result)}],
                    "usage": {"input_tokens": 17, "output_tokens": 42, "speed": "standard"}}
        with patch.object(client, "HTTPSConnection") as connect:
            reply = connect.return_value.getresponse.return_value
            reply.status, reply.length = 200, 0
            reply.read.return_value = json.dumps(response).encode()
            with patch.dict(os.environ, self.env | {"ANTHROPIC_API_KEY": "fixture-key", "KIND": kind}, clear=True):
                self.assertEqual(client.main(), 0)
            output = json.loads(self.output.with_name("claude-result.json").read_text("ascii"))
            connect.assert_called_once_with("api.anthropic.com", timeout=960)
            request = connect.return_value.request
            request.assert_called_once()
            method, path, body, headers = request.call_args.args
            self.assertEqual(body, claude_input.client.request_body(self.system, self.frames, kind))
            self.assertEqual((method, path), ("POST", "/v1/messages"))
            self.assertEqual(headers, {"x-api-key": "fixture-key", "content-type": "application/json",
                                       "anthropic-version": "2023-06-01"})
            payload = json.loads(body)
            self.assertEqual(set(payload), {"model", "speed", "service_tier", "system", "messages", "max_tokens", "output_config"})
            self.assertEqual(payload["messages"], [{"role": "user", "content": self.frames}])
            self.assertLessEqual(len(body), client.MAX_REQUEST_BYTES)
            self.assertEqual(payload["model"], "claude-opus-5-5")
            self.assertEqual(payload["speed"], "standard")
            self.assertEqual(payload["service_tier"], "standard_only")
            self.assertEqual(payload["output_config"]["effort"], "high")
            self.assertEqual(payload["output_config"]["format"]["type"], "json_schema")
            self.assertEqual(set(payload["output_config"]["format"]["schema"]["required"]), set(client.RESULT_FIELDS[kind]))
            self.assertEqual(payload["max_tokens"], 32_768)
        return output

    def test_60_fixture_through_transport_and_publisher(self):
        diff = (Path(__file__).with_name("fixtures") / "pr60.diff").read_bytes()
        data, _ = self.prepare(diff=diff)
        self.assertIn("return value % 2 == 1", self.frames)
        self.assertNotIn("return value % 2 == 1", self.system)
        self.assertNotIn("return value", self.output.read_text("utf-8"))
        finding = {"path": "tests/fixtures/claude_publication_probe.py", "line": 6,
                   "side": "RIGHT", "body": "is_even(2) returns False."}
        output = self.transport({"overflow": False, "findings": [finding | {"side": "Right"}]})
        body = self.post(0, inline_status=0, HEAD_SHA=data["head_sha"], OUTPUT=json.dumps(output))
        self.assertEqual(self.posted_review["comments"], [finding])
        self.assertEqual(self.posted_review["commit_id"], data["head_sha"])
        self.assertIn("is_even(2) returns False.", body)
        self.assertNotIn("PRIVATE", body)

    def test_workflow_runs_default_branch_client(self):
        self.assertNotIn("pull_request_review_comment:", WORKFLOW)
        self.assertIn("  pull_request_target:", WORKFLOW)
        self.assertIn("ref: ${{ github.event.repository.default_branch }}", WORKFLOW)
        self.assertEqual(WORKFLOW.count("secrets.ANTHROPIC_API_KEY"), 1)
        self.assertIn("run: python3 -I scripts/claude_messages.py", WORKFLOW)
        self.assertIn("run: python3 -I scripts/claude_input.py", WORKFLOW)
        self.assertNotIn("id-token: write", WORKFLOW)
