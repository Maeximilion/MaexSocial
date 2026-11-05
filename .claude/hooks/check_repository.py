"""Read-only Stop check shared by the Claude and Codex hook registrations."""

import json
from pathlib import Path
import subprocess
import sys


MAX_INPUT_BYTES = 256 * 1024
CHECK_TIMEOUT_SECONDS = 20
ROOT = Path(__file__).resolve().parents[2]
RETRY = "Run python scripts/check_repo.py from the repository root and fix its reported failures."


def evaluate(stream):
    """Skip irrelevant/invalid events and request at most one corrective turn."""
    try:
        raw = stream.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            return {}
        event = json.loads(raw)
    except (ValueError, UnicodeError, RecursionError, OSError):
        return {}
    if not isinstance(event, dict) or event.get("hook_event_name") != "Stop":
        return {}
    active = event.get("stop_hook_active", False)
    if not isinstance(active, bool) or active:
        return {}

    try:
        # Discard checker output rather than buffering unbounded or sensitive text.
        # -B also prevents imported checkers from writing Python cache files.
        result = subprocess.run(
            [sys.executable, "-B", str(ROOT / "scripts/check_repo.py")],
            cwd=ROOT, stdin=subprocess.DEVNULL,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
            timeout=CHECK_TIMEOUT_SECONDS, check=False,
        )
    except subprocess.TimeoutExpired:
        return {"decision": "block", "reason": f"Repository validation timed out. {RETRY}"}
    except OSError:
        return {"decision": "block", "reason": f"Repository validation could not start. {RETRY}"}
    if result.returncode:
        return {"decision": "block", "reason": f"Repository validation failed. {RETRY}"}
    return {}


if __name__ == "__main__":
    print(json.dumps(evaluate(sys.stdin.buffer)))
