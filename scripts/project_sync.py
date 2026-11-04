"""Reconcile issues and PRs with MaexSocial Project. Requires gh with project scope.

Run locally: python scripts/project_sync.py
Actions use PROJECT_TOKEN only after PROJECT_SYNC_ENABLED is set to true.
Existing Iteration assignments are deliberately preserved.
"""

import json
import re
import subprocess


OWNER = "Maeximilion"
REPOSITORY = f"{OWNER}/MaexSocial"
PROJECT_NUMBER = "5"
PROJECT_OWNER = "@me"


def gh(*args):
    result = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"GitHub CLI exited with {result.returncode}")
    return json.loads(result.stdout) if result.stdout.strip() else None


def labels_of(record):
    return {label["name"].lower() for label in record.get("labels", [])}


def desired_status(record, is_pr=False, active_issue_numbers=frozenset()):
    labels = labels_of(record)
    if record["state"].lower() == "closed":
        if is_pr:
            return "Done" if record.get("merged_at") else None
        return None if record.get("state_reason") == "not_planned" else "Done"
    if "status: blocked" in labels:
        return "Blocked"
    if is_pr or "status: in-review" in labels:
        return "In review"
    if "status: in-progress" in labels or record.get("number") in active_issue_numbers:
        return "In Progress"
    return "Todo"


def desired_gate(record):
    labels = labels_of(record)
    for index in range(6):
        if f"gate:g{index}" in labels or f"stufe-{index}" in labels:
            return f"G{index}"
    return None


def desired_priority(record):
    labels = labels_of(record)
    for index, word in enumerate(("high", "medium", "low")):
        if f"priority:p{index}" in labels or f"priority: {word}" in labels:
            return f"P{index}"
    return None


def api_pages(endpoint):
    return [item for page in gh("api", "--paginate", "--slurp", endpoint) for item in page]


def reconcile():
    project = gh("project", "view", PROJECT_NUMBER, "--owner", PROJECT_OWNER, "--format", "json")
    if project["id"] != "PVT_kwHOBYWY284BqPE8":
        raise RuntimeError("The credential does not resolve to the MaexSocial Project.")
    fields = gh("project", "field-list", PROJECT_NUMBER, "--owner", PROJECT_OWNER, "--format", "json", "--limit", "100")["fields"]
    by_name = {field["name"]: field for field in fields}
    items = gh("project", "item-list", PROJECT_NUMBER, "--owner", PROJECT_OWNER, "--format", "json", "--limit", "10000")
    if items["totalCount"] > len(items["items"]):
        raise RuntimeError("Project inventory truncated; increase item limit before reconciliation.")
    by_url = {item.get("content", {}).get("url"): item for item in items["items"]}
    issues = [item for item in api_pages(f"repos/{REPOSITORY}/issues?state=all&per_page=100") if "pull_request" not in item]
    prs = api_pages(f"repos/{REPOSITORY}/pulls?state=all&per_page=100")
    open_prs = gh("pr", "list", "--repo", REPOSITORY, "--state", "open", "--limit", "1000", "--json", "number,closingIssuesReferences")
    if len(open_prs) != sum(pr["state"] == "open" for pr in prs):
        raise RuntimeError("Open PR reference inventory is incomplete; increase the PR limit before reconciliation.")
    active_issue_numbers = {
        issue["number"]
        for pr in open_prs
        for issue in pr["closingIssuesReferences"]
        if issue.get("url") == f'https://github.com/{REPOSITORY}/issues/{issue["number"]}'
    }
    active_issue_numbers.update(
        int(match.group(1))
        for pr in prs
        if pr["state"] == "open"
        for match in re.finditer(r"\b(?:refs|references)\s+#(\d+)\b", pr.get("body") or "", re.IGNORECASE)
    )
    for record, is_pr in [(item, False) for item in issues] + [(item, True) for item in prs]:
        url = record["html_url"]
        item = by_url.get(url)
        if item is None:
            item = gh("project", "item-add", PROJECT_NUMBER, "--owner", PROJECT_OWNER, "--url", url, "--format", "json")
        status = desired_status(record, is_pr, active_issue_numbers)
        for name, desired in (("Status", status), ("Gate", desired_gate(record)), ("Priority", desired_priority(record))):
            field = by_name.get(name)
            if field is None:
                continue
            current = item.get(name.lower()) or item.get(name)
            # A cancellation must clear a stale Done status after a reopen/close cycle.
            if name == "Status" and desired is None:
                if current:
                    gh("project", "item-edit", "--id", item["id"], "--project-id", project["id"], "--field-id", field["id"], "--clear")
                continue
            if not desired:
                continue
            option = next((option for option in field.get("options", []) if option["name"].lower() == desired.lower() or (name == "Gate" and option["name"].split()[0] == desired)), None)
            if option is None:
                raise RuntimeError(f"Project field {name} has no option for {desired}")
            if current != option["name"]:
                gh("project", "item-edit", "--id", item["id"], "--project-id", project["id"], "--field-id", field["id"], "--single-select-option-id", option["id"])
    print(f"Reconciled {len(issues)} issues and {len(prs)} pull requests. Iteration assignments preserved.")


if __name__ == "__main__":
    reconcile()

