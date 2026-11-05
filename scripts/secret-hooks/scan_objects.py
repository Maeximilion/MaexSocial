"""Scan immutable Git payloads and tree entry names as separate in-memory inputs."""
from concurrent.futures import ThreadPoolExecutor
import hashlib
import os
from pathlib import Path
import sqlite3
import subprocess
import sys


# Separately audited immutable prose blobs. The patch scan still checks these.
AUDITED = {"08851459ccc813a5b5993aff0601e99543b04c51", "f96e246f16dd3107ce7a56465d90e00081c3d486"}


def digest(path):
    with path.open("rb") as stream:
        h = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
        return h.digest()


def check(scanner, revisions):
    here = Path(__file__).resolve().parent
    config, ignore = here / "gitleaks.toml", here / ".gitleaksignore"
    command = [scanner, "stdin", "--config", str(config), "--gitleaks-ignore-path", str(ignore),
               "--ignore-gitleaks-allow", "--redact=100", "--no-banner", "--no-color", "--log-level", "error"]
    env = {k: v for k, v in os.environ.items() if not k.startswith("GITLEAKS_")}
    env["GIT_NO_REPLACE_OBJECTS"] = "1"
    policy = hashlib.sha256(b"".join(digest(p) for p in (Path(scanner), Path(__file__), config, ignore))).digest()
    # This local, disposable cache stores only IDs verified under the exact policy.
    # Failure to read or save it affects speed only.
    cache = None
    clean = set()
    # An external rule file can change without changing the referring config.
    if config.read_text(encoding="utf-8").strip() == "[extend]\nuseDefault = true":
        try:
            cache = sqlite3.connect(here / "object-scan-cache.sqlite3", timeout=10)
            cache.execute("CREATE TABLE IF NOT EXISTS clean(policy BLOB, id TEXT, PRIMARY KEY(policy,id))")
            clean = {row[0] for row in cache.execute("SELECT id FROM clean WHERE policy=?", (policy,))}
        except sqlite3.Error:
            if cache:
                cache.close()
            cache = None

    def git(*args, input=None):
        return subprocess.check_output(["git", *args], input=input, stderr=subprocess.DEVNULL, env=env)

    def scan(data):
        # A fixed non-secret text prefix prevents MIME sniffing from skipping a
        # SQLite/PDF/etc. payload. EOF belongs to this input alone.
        r = subprocess.run(command, input=b"!\n" + data, capture_output=True, env=env, cwd=here)
        if r.returncode or r.stdout or r.stderr:
            raise ValueError("leaks found or scan failed")

    ids = sorted(set(git("rev-list", "--objects", "--no-object-names", *revisions, "--")
                     .decode("ascii").splitlines()) - clean - AUDITED)
    lines = git("cat-file", "--batch-check=%(objectname) %(objecttype)",
                input=b"".join(oid.encode("ascii") + b"\n" for oid in ids)).decode("ascii").splitlines()
    names = set()

    def check_object(line):
        oid, kind = line.split()
        if kind == "tree":
            return git("ls-tree", "--full-tree", "-z", "--name-only", oid).split(b"\0")[:-1]
        if kind not in ("commit", "tag", "blob"):
            raise ValueError("missing Git object")
        # Pipe the object directly to the scanner so large blobs do not fill Python memory.
        reader, writer = os.pipe()
        with os.fdopen(reader, "rb") as source, os.fdopen(writer, "wb", buffering=0) as sink:
            sink.write(b"!\n")
            with subprocess.Popen(["git", "cat-file", kind, oid], stdout=sink,
                                  stderr=subprocess.DEVNULL, env=env) as producer:
                sink.close()
                try:
                    r = subprocess.run(command, stdin=source, capture_output=True, env=env, cwd=here)
                finally:
                    source.close()
                if producer.wait() or r.returncode or r.stdout or r.stderr:
                    raise ValueError("leaks found or scan failed")
        return ()

    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for entries in pool.map(check_object, lines):
                names.update(entries)
            pending = {"name-" + hashlib.sha256(name).hexdigest(): name for name in names}
            list(pool.map(scan, (name for key, name in pending.items() if key not in clean)))
        if cache:
            try:
                with cache:
                    cache.executemany("INSERT OR IGNORE INTO clean VALUES (?,?)",
                                      ((policy, key) for key in [*ids, *pending]))
            except sqlite3.Error:
                pass
    finally:
        if cache:
            cache.close()


if __name__ == "__main__":
    try:
        check(sys.argv[1], sys.argv[2:])
    except (OSError, ValueError, subprocess.SubprocessError):
        sys.exit("Secret scan blocked: leaks found or scan failed.")
