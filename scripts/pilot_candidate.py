"""Capture or verify a revision-bound local pilot candidate record."""

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path


REPO = "Maeximilion/MaexSocial"
RUN_URL = f"https://github.com/{REPO}/actions/runs/"
WORKFLOWS = {"foundation": "ci.yml", "pilot": "pilot.yml"}
ARTIFACTS = (
    "package.json",
    "package-lock.json",
    "tsconfig.pilot.json",
    "ops/local/compose.yaml",
    "ops/local/keycloak-realm.json",
    "ops/local/keycloak-step-up.json",
    "ops/local/pg_hba.conf",
    "ops/local/stack.ts",
    "ops/local/start-postgres.sh",
    "scripts/pilot-db.ts",
)
PRODUCTION = {
    "authorizedTarget": None,
    "promotionIdentity": None,
    "deployableArtifactSha256": None,
    "rollbackArtifactSha256": None,
    "signatureEvidence": None,
    "releaseApproval": None,
}


def git(*args):
    return subprocess.run(
        ["git", "--no-replace-objects", *args],
        capture_output=True, check=True, timeout=30,
    ).stdout


def candidate_inputs(revision):
    if not isinstance(revision, str) or not re.fullmatch(r"[0-9a-f]{40}", revision):
        raise ValueError("Revision must be a full lowercase Git commit SHA.")
    if git("cat-file", "-t", revision) != b"commit\n":
        raise ValueError("Revision must identify a commit.")

    paths = git("ls-tree", "-rz", "--name-only", revision, "--", "db/migrations").decode().split("\0")
    up = sorted(path.removesuffix(".up.sql") for path in paths if path.endswith(".up.sql"))
    down = sorted(path.removesuffix(".down.sql") for path in paths if path.endswith(".down.sql"))
    if not up or up != down:
        raise ValueError("Candidate migrations must have matching up and down files.")
    for index, path in enumerate(up, 1):
        if not re.fullmatch(rf"db/migrations/{index:03d}_[a-z0-9_]+", path):
            raise ValueError("Candidate migrations must have consecutive revision prefixes.")
    migrations = [f"{path}.{direction}.sql" for path in up for direction in ("up", "down")]
    return {
        "migrationRevision": Path(up[-1]).name,
        "artifacts": {
            path: {"sha256": hashlib.sha256(git("cat-file", "blob", f"{revision}:{path}")).hexdigest()}
            for path in sorted([*ARTIFACTS, *migrations])
        },
    }


def action_run(run_id, attempt):
    result = subprocess.run(
        ["gh", "api", "--hostname", "github.com",
         f"repos/{REPO}/actions/runs/{run_id}/attempts/{attempt}"],
        capture_output=True, check=True, timeout=30,
    )
    return json.loads(result.stdout)


def verify_evidence(revision, evidence):
    if not isinstance(evidence, dict) or evidence.keys() != WORKFLOWS.keys():
        raise ValueError("Foundation and pilot proof links are required.")
    attempt_url = re.compile(re.escape(RUN_URL) + r"([1-9][0-9]*)/attempts/([1-9][0-9]*)")
    for name, workflow in WORKFLOWS.items():
        url = evidence[name]
        match = attempt_url.fullmatch(url) if isinstance(url, str) else None
        if not match:
            raise ValueError(f"{name}: expected a MaexSocial workflow attempt link.")
        run_id, attempt = map(int, match.groups())
        try:
            run = action_run(run_id, attempt)
        except (OSError, subprocess.SubprocessError, ValueError) as error:
            raise ValueError(f"{name}: GitHub proof is unavailable.") from error
        expected = {
            "id": run_id,
            "run_attempt": attempt,
            "path": f".github/workflows/{workflow}",
            "event": "push",
            "head_branch": "main",
            "head_sha": revision,
            "status": "completed",
            "conclusion": "success",
        }
        if not isinstance(run, dict) or any(run.get(key) != value for key, value in expected.items()):
            raise ValueError(f"{name}: expected a successful main push run for the candidate revision.")


def image_pins(revision):
    source = git("cat-file", "blob", f"{revision}:ops/local/compose.yaml")
    try:
        result = subprocess.run(
            ["docker", "compose", "--env-file", os.devnull, "--profile", "*", "-f", "-", "config",
             "--no-interpolate", "--no-env-resolution", "--no-path-resolution", "--format", "json"],
            input=source, capture_output=True, check=True, timeout=30,
        )
        services = json.loads(result.stdout)["services"]
    except (OSError, subprocess.SubprocessError, ValueError, KeyError) as error:
        raise ValueError("Docker Compose could not resolve the candidate image pins.") from error
    if not services:
        raise ValueError("The candidate Compose file has no services.")

    pins = {}
    for service, config in sorted(services.items()):
        image = config.get("image", "")
        if "build" in config or not re.fullmatch(r"[^\s@]+@sha256:[0-9a-f]{64}", image):
            raise ValueError(f"{service}: expected a digest-pinned fixture image.")
        pins[service] = {"reference": image}
    return pins


def capture(revision, evidence):
    inputs = candidate_inputs(revision)
    verify_evidence(revision, evidence)
    return {"format": 1, "revision": revision, **inputs, "imagePins": image_pins(revision),
            "evidence": evidence, "production": PRODUCTION.copy()}


def verify(record):
    fields = {"format", "revision", "migrationRevision", "artifacts", "imagePins", "evidence", "production"}
    if (not isinstance(record, dict) or record.keys() != fields
            or type(record["format"]) is not int or record["format"] != 1
            or record["production"] != PRODUCTION):
        raise ValueError("Expected a format-1 local candidate record with unresolved production fields.")

    inputs = candidate_inputs(record["revision"])
    if inputs["migrationRevision"] != record["migrationRevision"]:
        raise ValueError("Migration revision does not match the candidate.")
    if inputs["artifacts"] != record["artifacts"]:
        raise ValueError("Artifact paths or SHA-256 digests do not match the candidate.")
    verify_evidence(record["revision"], record["evidence"])
    if image_pins(record["revision"]) != record["imagePins"]:
        raise ValueError("Compose image pins do not match the candidate.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("capture", help="Write the verified record to stdout.")
    create.add_argument("revision")
    create.add_argument("foundation", help="GitHub Foundation workflow attempt URL")
    create.add_argument("pilot", help="GitHub pilot workflow attempt URL")
    check = commands.add_parser("verify", help="Verify a record against Git and GitHub.")
    check.add_argument("manifest", type=Path)
    args = parser.parse_args()

    try:
        if args.command == "capture":
            record = capture(args.revision, {"foundation": args.foundation, "pilot": args.pilot})
            print(json.dumps(record, indent=2))
        else:
            verify(json.loads(args.manifest.read_text(encoding="utf-8")))
            print("Local pilot candidate verified.")
    except (OSError, subprocess.SubprocessError, ValueError) as error:
        print(f"Candidate manifest verification failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
