"""Check committed Markdown links and JSON syntax without external dependencies."""

import json
import re
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit


LINK = re.compile(r"!?\[[^\]]*\]\((<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)")


def local_targets(markdown):
    # Examples inside fenced code are instructions, not document navigation.
    prose = re.sub(r"^```[^\n]*\n.*?^```\s*$", "", markdown, flags=re.M | re.S)
    for match in LINK.finditer(prose):
        target = match.group(1).strip("<>")
        parsed = urlsplit(target)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        yield unquote(parsed.path)


def check(root):
    paths = subprocess.check_output(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=root,
    ).decode().split("\0")
    errors = []
    for name in sorted(set(paths) - {""}):
        path = root / name
        if not path.is_file():
            errors.append(f"Missing tracked file: {name}")
            continue
        if path.suffix == ".json":
            try:
                json.loads(path.read_text(encoding="utf-8-sig"))
            except (ValueError, UnicodeError) as error:
                errors.append(f"{name}: {error}")
        if path.suffix.lower() == ".md":
            for target in local_targets(path.read_text(encoding="utf-8-sig")):
                destination = root / target.lstrip("/") if target.startswith("/") else path.parent / target
                if not destination.exists():
                    errors.append(f"{name}: missing link target {target}")
    return errors


if __name__ == "__main__":
    failures = check(Path(__file__).resolve().parents[1])
    print("\n".join(failures) if failures else "Repository links and JSON are valid.")
    raise SystemExit(bool(failures))
