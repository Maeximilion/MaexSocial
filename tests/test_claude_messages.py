"""Failures publish only local categories, never a partial review or remote diagnostics."""

from contextlib import redirect_stdout
from http.client import IncompleteRead
from io import StringIO
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from scripts import claude_messages as client


def message(result=None):
    return {"type": "message", "role": "assistant", "model": client.MODEL, "stop_reason": "end_turn",
            "content": [{"type": "text", "text": json.dumps(result if result is not None else
                        {"summary": "fixture", "findings": []})}],
            "usage": {"input_tokens": 17, "output_tokens": 24, "speed": "standard"}}


class MessagesFailureTests(unittest.TestCase):
    def failure(self, connect, expected, key="opaque-fixture", data="data"):
        with tempfile.TemporaryDirectory() as directory:
            folder = Path(directory)
            (folder / "claude-input.json").write_text(json.dumps(["system", data]), "utf-8")
            output = folder / "outputs"
            with patch.dict(os.environ, {"GITHUB_OUTPUT": str(output), "RUNNER_TEMP": directory,
                                         "ANTHROPIC_API_KEY": key}, clear=True), redirect_stdout(StringIO()) as logs:
                self.assertEqual(client.main(), 1)
            self.assertEqual(output.read_text("utf-8").strip(), f"failure={expected}")
            self.assertEqual(logs.getvalue().strip(), f"::error::Claude review failed: {expected}")
            self.assertFalse((folder / "claude-result.json").exists())
            self.assertLessEqual(connect.return_value.request.call_count, 1)

    def test_http_errors_never_read_diagnostics_or_follow_redirects(self):
        for status, category in [(301, "http_unknown"), (307, "http_unknown"), (400, "invalid_request"),
                                 (401, "authentication"), (402, "billing"), (403, "permission"),
                                 (404, "resource_unavailable"), (429, "rate_or_spend_limit"), (529, "overloaded")]:
            with self.subTest(status=status), patch.object(client, "HTTPSConnection") as connect:
                response = connect.return_value.getresponse.return_value
                response.status = status
                response.headers = {"Location": "https://example.invalid/opaque-fixture"}
                response.read.return_value = b"opaque-fixture"
                self.failure(connect, f"{category} (HTTP {status})")
                response.read.assert_not_called()
                connect.assert_called_once()
                connect.return_value.request.assert_called_once()

    def test_rejected_result_never_reaches_publisher(self):
        for raw, category in [
            (b"opaque-fixture", "invalid_response_json"), (b"{}", "invalid_envelope"),
            (b"[" * 1100, "invalid_response_json"), (b"x" * (client.MAX_RESPONSE_BYTES + 1), "response_size"),
            (message() | {"model": "other"}, "invalid_envelope"),
            (message() | {"stop_reason": "max_tokens"}, "output_truncated"),
            (message() | {"stop_reason": "refusal"}, "refused"),
            (message() | {"stop_reason": "opaque-fixture"}, "unexpected_stop"),
            (message() | {"content": [{"type": "tool_use"}]}, "unexpected_content"),
            (message() | {"content": []}, "missing_result"),
            (message() | {"content": [{"type": "text", "text": "opaque-fixture"}]}, "invalid_schema"),
            (message() | {"usage": {"input_tokens": "opaque-fixture", "output_tokens": 0}}, "invalid_usage"),
            (message({"summary": "opaque-fixture", "findings": []}), "unsafe_result"),
            (message({"summary": "S" * 4001, "findings": []}), "invalid_schema"),
            (message({"summary": "fixture", "findings": [{}] * 11}), "invalid_schema"),
            (message({"summary": "fixture", "findings": [{"path": "a", "line": True, "side": "RIGHT",
                                                          "body": "fixture"}]}), "invalid_schema"),
        ]:
            with self.subTest(category=category), patch.object(client, "HTTPSConnection") as connect:
                response = connect.return_value.getresponse.return_value
                response.status, response.length = 200, 0
                response.read.return_value = raw if isinstance(raw, bytes) else json.dumps(raw).encode()
                self.failure(connect, category)

    def test_early_limits_and_transport_failures(self):
        for key, data, category in [("", "data", "credential_missing_or_invalid"),
                                    ("opaque-fixture", "x" * client.MAX_REQUEST_BYTES, "input_budget")]:
            with patch.object(client, "HTTPSConnection") as connect:
                self.failure(connect, category, key, data)
                connect.assert_not_called()
        for exc, category in [(TimeoutError("opaque-fixture"), "transport"),
                              (IncompleteRead(b"opaque-fixture"), "truncated_transport")]:
            with patch.object(client, "HTTPSConnection") as connect:
                connect.return_value.getresponse.side_effect = exc
                self.failure(connect, category)
