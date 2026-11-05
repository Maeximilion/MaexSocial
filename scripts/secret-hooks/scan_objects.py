"""Scan immutable Git payloads and tree entry names as separate in-memory inputs."""
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from itertools import islice
import codecs
import hashlib
import os
from pathlib import Path
import sqlite3
import subprocess
import sys


# Separately audited immutable prose blobs. The patch scan still checks these.
AUDITED = {"08851459ccc813a5b5993aff0601e99543b04c51", "f96e246f16dd3107ce7a56465d90e00081c3d486"}


# Gitleaks 8.30.1 sniffs MIME in its first 100,000-byte read. Keep object bytes
# beyond that entire read; its first newline ends the initial sniff even on a short read.
PREFIX = b"!\n" + b" " * 99_997 + b"\n"


def bounded(pool, operation, items):
    items = iter(items)
    pending = {pool.submit(operation, item) for item in islice(items, 4)}
    while pending:
        done, pending = wait(pending, return_when=FIRST_COMPLETED)
        results = [future.result() for future in done]
        yield from results
        pending.update(pool.submit(operation, item) for item in islice(items, len(done)))


def digest(path):
    with path.open("rb") as stream:
        h = hashlib.sha256()
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
        return h.digest()


def drain_diagnostics(stream):
    # Consume concurrently with stdin. Only the presence of output leaves this pipe.
    has_output = False
    while stream.read(65536):
        has_output = True
    return has_output


def check(scanner, git_binary, revisions):
    git_path = Path(git_binary)
    if not git_path.is_absolute():
        raise ValueError("Git path must be absolute")
    git_path = git_path.resolve(strict=True)
    if Path.cwd().resolve() in git_path.parents:
        raise ValueError("Git must be outside the worktree")
    git_binary = str(git_path)
    here = Path(__file__).resolve().parent
    config, ignore = here / "gitleaks.toml", here / ".gitleaksignore"
    command = [scanner, "stdin", "--config", str(config), "--gitleaks-ignore-path", str(ignore),
               "--ignore-gitleaks-allow", "--redact=100", "--no-banner", "--no-color", "--log-level", "error"]
    env = {k: v for k, v in os.environ.items() if not k.startswith("GITLEAKS_")}
    env["GIT_NO_REPLACE_OBJECTS"] = "1"
    policy = hashlib.sha256(b"".join(digest(p) for p in (Path(scanner), git_path, Path(__file__), config, ignore))).digest()
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
        return subprocess.check_output([git_binary, *args], input=input, stderr=subprocess.DEVNULL, env=env)

    def scan(data):
        # A fixed non-secret text prefix prevents MIME sniffing from skipping a
        # SQLite/PDF/etc. payload. EOF belongs to this input alone.
        r = subprocess.run(command, input=PREFIX + data, capture_output=True, env=env, cwd=here)
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
        # Scan the original bytes first. For BOM-marked text, replay the blob as UTF-8.
        encodings = [None]
        while encodings:
            encoding = encodings.pop()
            decoder = codecs.getincrementaldecoder(encoding)(errors="replace") if encoding else None
            with ThreadPoolExecutor(max_workers=1) as drain, subprocess.Popen(
                [git_binary, "cat-file", kind, oid], stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, env=env
            ) as producer:
                with subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                      stderr=subprocess.STDOUT, env=env, cwd=here) as detector:
                    diagnostics = drain.submit(drain_diagnostics, detector.stdout)
                    try:
                        detector.stdin.write(PREFIX)
                        block = producer.stdout.read(65536)
                        if kind == "blob" and not decoder:
                            # FF FE 00 00 is also a UTF-16LE BOM followed by a NUL.
                            if block.startswith((codecs.BOM_UTF16_LE, codecs.BOM_UTF16_BE)):
                                encodings.append("utf-16")
                            if block.startswith((codecs.BOM_UTF32_LE, codecs.BOM_UTF32_BE)):
                                encodings.append("utf-32")
                        while block:
                            detector.stdin.write(decoder.decode(block).encode() if decoder else block)
                            block = producer.stdout.read(65536)
                        if decoder:
                            detector.stdin.write(decoder.decode(b"", final=True).encode())
                        detector.stdin.close()
                        if diagnostics.result() or detector.wait() or producer.wait():
                            raise ValueError("leaks found or scan failed")
                    finally:
                        producer.stdout.close()
                        detector.stdin.close()
        return ()

    try:
        with ThreadPoolExecutor(max_workers=4) as pool:
            for entries in bounded(pool, check_object, lines):
                names.update(entries)
            pending = {"name-" + hashlib.sha256(name).hexdigest(): name for name in names}
            for _ in bounded(pool, scan, (name for key, name in pending.items() if key not in clean)):
                pass
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
        check(sys.argv[1], sys.argv[2], sys.argv[3:])
    except (OSError, ValueError, subprocess.SubprocessError):
        sys.exit("Secret scan blocked: leaks found or scan failed.")
