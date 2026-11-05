"""Exercise the Stop hook without starting a paid agent session."""

import io
import json
import os
from pathlib import Path
import runpy
import shutil
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
HOOK = ROOT / ".claude/hooks/check_repository.py"
STOP = {"hook_event_name": "Stop", "stop_hook_active": False}


class RepositoryHookTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(HOOK.is_file(), "The shared repository Stop hook is missing")
        self.temp = tempfile.TemporaryDirectory(prefix="hook paths with spaces ' ")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.hook = self.root / ".claude/hooks/check_repository.py"
        self.hook.parent.mkdir(parents=True)
        shutil.copyfile(HOOK, self.hook)
        (self.root / "scripts").mkdir()
        self.nested = self.root / "nested folder with spaces"
        self.nested.mkdir()

    def checker(self, source):
        (self.root / "scripts/check_repo.py").write_text(source, encoding="utf-8")

    def run_hook(self, payload, command=None):
        raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        result = subprocess.run(
            command or [sys.executable, "-B", str(self.hook)],
            input=raw, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            cwd=self.nested, timeout=15, check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr.decode(errors="replace"))
        self.assertEqual(result.stderr, b"")
        self.assertLess(len(result.stdout), 4096)
        output = json.loads(result.stdout)
        self.assertLessEqual(set(output), {"systemMessage"}, "Hook output must not control the task")
        return output

    def test_success_uses_script_root_not_payload_or_session_cwd(self):
        self.checker(
            "from pathlib import Path\n"
            "assert Path.cwd() == Path(__file__).resolve().parents[1]\n"
            "print('checker output must not corrupt the hook JSON')\n"
        )
        self.assertEqual(self.run_hook({**STOP, "cwd": "untrusted/nonexistent"}), {})

    def test_failure_warns_without_blocking_or_echoing_checker_output(self):
        self.checker("print('private fixture ' * 100000)\nraise SystemExit(1)\n")
        result = self.run_hook(STOP)
        self.assertIn("scripts/check_repo.py", result["systemMessage"])
        self.assertNotIn("private fixture", result["systemMessage"])

    def test_repeated_stop_cannot_create_a_continuation_loop(self):
        self.checker("raise SystemExit(1)\n")
        self.assertEqual(self.run_hook({**STOP, "stop_hook_active": True}), {})

    def test_unrelated_and_invalid_events_do_not_run_the_checker(self):
        self.checker("raise SystemExit(1)\n")
        for payload in (
            {}, [], {"hook_event_name": "PreToolUse"},
            {**STOP, "stop_hook_active": "false"},
            b"not JSON", b"\xff", b"[" * 2000,
        ):
            with self.subTest(payload=str(payload)[:80]):
                self.assertEqual(self.run_hook(payload), {})

    def test_oversized_input_is_skipped_before_running_the_checker(self):
        self.checker("raise SystemExit(1)\n")
        self.assertEqual(self.run_hook({**STOP, "padding": "x" * 300000}), {})

    def test_checker_does_not_create_python_cache_files(self):
        (self.root / "scripts/helper.py").write_text("value = 1\n", encoding="utf-8")
        self.checker("import helper\nassert helper.value == 1\n")
        self.assertEqual(self.run_hook(STOP), {})
        self.assertEqual(list(self.root.rglob("__pycache__")), [])

    def test_missing_checker_is_reported_as_failure(self):
        self.assertIn("failed", self.run_hook(STOP)["systemMessage"])

    def test_timeout_is_reported_with_valid_bounded_json(self):
        self.checker("import time\ntime.sleep(2)\n")
        module = runpy.run_path(str(self.hook))
        with patch.dict(module["evaluate"].__globals__, CHECK_TIMEOUT_SECONDS=0.05):
            result = module["evaluate"](io.BytesIO(json.dumps(STOP).encode()))
        self.assertEqual(set(result), {"systemMessage"})
        self.assertIn("timed out", result["systemMessage"])
        self.assertLess(len(json.dumps(result)), 4096)

    def test_spawn_error_is_reported_without_raw_system_details(self):
        module = runpy.run_path(str(self.hook))
        with patch.object(module["sys"], "executable", str(self.root / "private local path")):
            result = module["evaluate"](io.BytesIO(json.dumps(STOP).encode()))
        self.assertEqual(set(result), {"systemMessage"})
        self.assertNotIn("private local path", result["systemMessage"])

    def test_claude_registered_command_works_from_a_nested_path_with_spaces(self):
        self.checker("raise SystemExit(1)\n")
        settings = json.loads((ROOT / ".claude/settings.json").read_text(encoding="utf-8"))
        handler = settings["hooks"]["Stop"][0]["hooks"][0]
        command = [handler["command"], *[
            arg.replace("${CLAUDE_PROJECT_DIR}", str(self.root)) for arg in handler["args"]
        ]]
        self.assertIn("failed", self.run_hook(STOP, command)["systemMessage"])

    def test_codex_registered_command_resolves_git_root_from_nested_path(self):
        self.checker("raise SystemExit(1)\n")
        subprocess.run(["git", "init", "--quiet"], cwd=self.root, check=True)
        config = json.loads((ROOT / ".codex/hooks.json").read_text(encoding="utf-8"))
        handler = config["hooks"]["Stop"][0]["hooks"][0]
        command = (
            ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", handler["commandWindows"]]
            if os.name == "nt" else ["sh", "-c", handler["command"]]
        )
        self.assertIn("failed", self.run_hook(STOP, command)["systemMessage"])


if __name__ == "__main__":
    unittest.main()
