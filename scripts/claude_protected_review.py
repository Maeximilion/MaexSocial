"""Trusted manual review preparation/publication. Run with isolated Python; never execute PR code."""

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import quote


spec = importlib.util.spec_from_file_location("claude_input", Path(__file__).resolve().with_name("claude_input.py"))
source = importlib.util.module_from_spec(spec)
spec.loader.exec_module(source)
SELF = {".github/workflows/claude-protected-review.yml", "scripts/claude_protected_review.py"}
WORKFLOW = ".github/workflows/claude-protected-review.yml"


class Denied(Exception):
    """Only fixed local categories may be passed to this exception."""


def require(condition, category):
    if not condition:
        raise Denied(category)


def sha(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value)


def get(path):
    return json.loads(source.api(path), object_pairs_hook=source.client.unique_fields)


def snapshot(env):
    """Validate live trust, PR identity and its actual test merge candidate."""
    repo = env["GITHUB_REPOSITORY"]
    require(re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", repo), "invalid_repository")
    require(re.fullmatch(r"[1-9][0-9]*", env.get("PR", "")), "invalid_pr")
    require(all(sha(env.get(k)) for k in ("HEAD_SHA", "BASE_SHA", "REVIEWER_COMMIT")), "invalid_revision")
    target = env.get("TARGET_REF", "")
    require(target and len(target) <= 300 and all(c.isprintable() for c in target), "invalid_target")
    require(env.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and env.get("GITHUB_RUN_ATTEMPT") == "1",
            "dispatch_required_no_reruns")
    require(env.get("KIND") == "review" and re.fullmatch(r"[1-9][0-9]*", env.get("GITHUB_RUN_ID", "")),
            "invalid_run")
    default = get(f"repos/{repo}")["default_branch"]
    require(env.get("GITHUB_REF") == f"refs/heads/{default}" and
            env.get("GITHUB_WORKFLOW_REF") == f"{repo}/{WORKFLOW}@refs/heads/{default}", "untrusted_workflow_ref")
    # Public Git object ID for the reviewed code, never a credential.
    reviewer_commit = env["REVIEWER_COMMIT"]
    require(all(env.get(k) == reviewer_commit for k in ("CHECKOUT_SHA", "GITHUB_SHA", "GITHUB_WORKFLOW_SHA")),
            "untrusted_revision")
    default_tip = get(f"repos/{repo}/git/ref/heads/{quote(default, safe='')}")["object"]["sha"]
    require(default_tip == reviewer_commit, "default_branch_moved")
    for actor in {env.get("GITHUB_ACTOR", ""), env.get("GITHUB_TRIGGERING_ACTOR", "")}:
        require(re.fullmatch(r"[A-Za-z0-9_-]+(?:\[bot\])?", actor), "invalid_actor")
        permission = get(f"repos/{repo}/collaborators/{quote(actor, safe='')}/permission")["permission"]
        require(permission in {"write", "maintain", "admin"}, "unauthorized_actor")
    pull = get(f"repos/{repo}/pulls/{env['PR']}")
    require(pull["number"] == int(env["PR"]) and pull["state"] == "open" and pull.get("merged") is False,
            "pr_not_open")
    require(all((pull[k].get("repo") or {}).get("full_name") == repo for k in ("head", "base")), "foreign_pr")
    require(pull["head"]["sha"] == env["HEAD_SHA"] and pull["base"]["sha"] == env["BASE_SHA"] and
            pull["base"]["ref"] == target, "pr_identity_moved")
    target_tip = default_tip if target == default else get(
        f"repos/{repo}/git/ref/heads/{quote(target, safe='')}")["object"]["sha"]
    require(target_tip == env["BASE_SHA"], "target_branch_moved")
    candidate = pull.get("merge_commit_sha")
    require(pull.get("mergeable") is True and sha(candidate), "candidate_unavailable")
    parents = get(f"repos/{repo}/git/commits/{candidate}")["parents"]
    require([p["sha"] for p in parents] == [env["BASE_SHA"], env["HEAD_SHA"]], "candidate_parents_mismatch")
    compare = get(f"repos/{repo}/compare/{env['BASE_SHA']}...{env['HEAD_SHA']}?per_page=1")
    merge_base = compare["merge_base_commit"]["sha"]
    require(sha(merge_base), "invalid_merge_base")
    evidence = {"pr": env["PR"], "repo": repo, "head": env["HEAD_SHA"], "base": env["BASE_SHA"],
                "target": target, "reviewer_commit": reviewer_commit, "merge_base": merge_base, "candidate": candidate,
                "run": env["GITHUB_RUN_ID"], "files": compare["files"],
                "metadata_sha256": hashlib.sha256(json.dumps(
                    [pull.get("title"), pull.get("body"), pull.get("user"), pull["head"]["ref"],
                     pull.get("changed_files")], sort_keys=True).encode()).hexdigest()}
    return pull, evidence


def recheck(env, expected):
    _, current = snapshot(env)
    require(current == expected, "review_state_changed")


def prepare(env):
    folder = Path(env["RUNNER_TEMP"])
    for name in ("claude-input.json", "claude-result.json", "claude-protected-state.json"):
        (folder / name).unlink(missing_ok=True)
    pull, evidence = snapshot(env)
    files = evidence["files"]
    require(isinstance(files, list) and 0 < len(files) < 300 and
            type(pull.get("changed_files")) is int and len(files) == pull["changed_files"], "incomplete_paths")
    paths = {f[k] for f in files for k in ("filename", "previous_filename") if k in f}
    require(not paths.intersection(SELF), "self_change_not_reviewed")
    require(paths.intersection(source.PROTECTED), "ordinary_route_required")
    details, payload = source.build_input(env, pull)
    require(not details["gaps"], "incomplete_input")
    recheck(env, evidence)
    (folder / "claude-protected-state.json").write_text(json.dumps(evidence), "utf-8")
    (folder / "claude-input.json").write_text(json.dumps(payload), "utf-8")
    with open(env["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
        output.write("ready=true\n")


def write(env, endpoint, payload):
    path = Path(env["RUNNER_TEMP"]) / "claude-protected-publication.json"
    path.write_text(json.dumps(payload), "utf-8")
    result = subprocess.run(["gh", "api", "--method", "POST", "--input", str(path),
                             f"repos/{env['GITHUB_REPOSITORY']}/{endpoint}"], capture_output=True)
    return result.returncode == 0


def publish(env):
    folder = Path(env["RUNNER_TEMP"])
    _, current = snapshot(env)
    state_path = folder / "claude-protected-state.json"
    evidence = json.loads(state_path.read_text("utf-8")) if state_path.exists() else current
    require(current == evidence, "review_state_changed")
    receipt = ("**Claude protected review**\n\n"
               f"Run: https://github.com/{evidence['repo']}/actions/runs/{evidence['run']}\n\n"
               f"Head `{evidence['head']}`; base `{evidence['base']}`; target `{evidence['target']}`.\n\n"
               f"Merge base `{evidence['merge_base']}`; test merge `{evidence['candidate']}`; "
               f"trusted reviewer `{evidence['reviewer_commit']}`.")
    complete = False
    if env.get("DATA_OUTCOME") != "success" or not state_path.exists():
        body = "**Incomplete / not reviewed:** preparation failed; no API request authorized."
    elif env.get("CLAUDE_OUTCOME") != "success":
        body = "**Incomplete / not reviewed:** API step did not succeed; consult the run's fixed failure category."
    else:
        try:
            text = (folder / "claude-result.json").read_text("utf-8")
            # Schema revalidation only. Provider completion is established by the successful unchanged API step.
            result = source.client.result_from({"stop_reason": "end_turn", "content": [{"type": "text", "text": text}]},
                                               "review")
        except (OSError, ValueError, source.client.ReviewFailure):
            body = "**Incomplete / not reviewed:** result missing or invalid."
        else:
            findings = result["findings"]
            complete = not result["overflow"]
            overview = f"{len(findings)} findings reported."
            if findings:
                recheck(env, evidence)
                posted = write(env, f"pulls/{env['PR']}/reviews", {
                    "commit_id": evidence["head"], "event": "COMMENT", "comments": findings,
                    "body": receipt + "\n\nInline findings; completion status is in the separate overview."})
                if not posted:
                    complete = False
                    overview += " Inline placement failed."
                overview += "\n" + "\n".join(
                    f"- `{f['path']}` line {f['line']} ({f['side']}): {f['body']}" for f in findings)
            body = ("**Complete**" if complete else "**Incomplete:** overflow or inline publication failure") + "\n\n" + overview
    recheck(env, evidence)
    require(write(env, f"issues/{env['PR']}/comments", {"body": receipt + "\n\n" + body}), "publication_failed")
    return int(not complete)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=("prepare", "publish"))
    args = parser.parse_args(argv)
    try:
        if args.action == "prepare":
            prepare(os.environ)
            return 0
        return publish(os.environ)
    except Denied as error:
        category = str(error)
    except Exception:
        category = "local_failure"
    print(f"::error::Protected Claude review incomplete: {category}")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
