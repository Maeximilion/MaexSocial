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
PROJECT_ID = "PVT_kwHOBYWY284BqPE8"

FIELDS_QUERY = """query($id:ID!, $after:String) {
  node(id:$id) { id ... on ProjectV2 {
    fields(first:100, after:$after) {
      nodes { ... on ProjectV2SingleSelectField { id name options { id name } } }
      pageInfo { hasNextPage endCursor }
    }
  } }
}"""

ITEMS_QUERY = """query($id:ID!, $after:String) {
  node(id:$id) { id ... on ProjectV2 {
    items(first:100, after:$after) {
      nodes { id content { ... on Issue { url } ... on PullRequest { url } }
        fieldValues(first:100) {
          nodes { ... on ProjectV2ItemFieldSingleSelectValue {
            name field { ... on ProjectV2SingleSelectField { name } }
          } }
          pageInfo { hasNextPage endCursor }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  } }
}"""

VALUES_QUERY = """query($id:ID!, $after:String) {
  node(id:$id) { id ... on ProjectV2Item {
    fieldValues(first:100, after:$after) {
      nodes { ... on ProjectV2ItemFieldSingleSelectValue {
        name field { ... on ProjectV2SingleSelectField { name } }
      } }
      pageInfo { hasNextPage endCursor }
    }
  } }
}"""

ADD_ITEM = """mutation($project:ID!, $content:ID!) {
  addProjectV2ItemById(input:{projectId:$project,contentId:$content}) { item { id } }
}"""
UPDATE_VALUE = """mutation($project:ID!, $item:ID!, $field:ID!, $option:String!) {
  updateProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field,
    value:{singleSelectOptionId:$option}}) { projectV2Item { id } }
}"""
CLEAR_VALUE = """mutation($project:ID!, $item:ID!, $field:ID!) {
  clearProjectV2ItemFieldValue(input:{projectId:$project,itemId:$item,fieldId:$field}) {
    projectV2Item { id }
  }
}"""


def gh(*args):
    result = subprocess.run(["gh", *args], capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        raise RuntimeError(result.stderr.strip() or f"GitHub CLI exited with {result.returncode}")
    return json.loads(result.stdout) if result.stdout.strip() else None


def graphql(query, **variables):
    args = ["api", "graphql", "-f", f"query={query}"]
    for key, value in variables.items():
        if value is not None:
            args.extend(["-f", f"{key}={value}"])
    result = gh(*args)
    if result.get("errors"):
        raise RuntimeError(f"GitHub GraphQL failed: {result['errors']}")
    return result["data"]


def connection_nodes(query, node_id, connection, after=None):
    nodes = []
    seen_cursors = set()
    while True:
        node = graphql(query, id=node_id, after=after)["node"]
        if not node or node["id"] != node_id or connection not in node:
            raise RuntimeError("The credential cannot read the expected MaexSocial Project connection.")
        page = node[connection]
        nodes.extend(page["nodes"])
        if not page["pageInfo"]["hasNextPage"]:
            return nodes
        after = page["pageInfo"]["endCursor"]
        if not after or after in seen_cursors:
            raise RuntimeError("GitHub returned an invalid pagination cursor.")
        seen_cursors.add(after)


def project_inventory():
    fields = connection_nodes(FIELDS_QUERY, PROJECT_ID, "fields")
    items = connection_nodes(ITEMS_QUERY, PROJECT_ID, "items")
    for item in items:
        values = item.pop("fieldValues")
        field_values = values["nodes"]
        if values["pageInfo"]["hasNextPage"]:
            cursor = values["pageInfo"]["endCursor"]
            if not cursor:
                raise RuntimeError("GitHub returned a missing field-value pagination cursor.")
            field_values.extend(connection_nodes(VALUES_QUERY, item["id"], "fieldValues", after=cursor))
        for value in field_values:
            if (value.get("field") or {}).get("name"):
                item[value["field"]["name"].lower()] = value["name"]
    return [field for field in fields if "name" in field], items


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
    fields, items = project_inventory()
    by_name = {field["name"]: field for field in fields}
    by_url = {(item.get("content") or {}).get("url"): item for item in items}
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
            item = graphql(ADD_ITEM, project=PROJECT_ID, content=record["node_id"])["addProjectV2ItemById"]["item"]
        status = desired_status(record, is_pr, active_issue_numbers)
        for name, desired in (("Status", status), ("Gate", desired_gate(record)), ("Priority", desired_priority(record))):
            field = by_name.get(name)
            if field is None:
                continue
            current = item.get(name.lower()) or item.get(name)
            # A cancellation must clear a stale Done status after a reopen/close cycle.
            if name == "Status" and desired is None:
                if current:
                    graphql(CLEAR_VALUE, project=PROJECT_ID, item=item["id"], field=field["id"])
                continue
            if not desired:
                continue
            option = next((option for option in field.get("options", []) if option["name"].lower() == desired.lower() or (name == "Gate" and option["name"].split()[0] == desired)), None)
            if option is None:
                raise RuntimeError(f"Project field {name} has no option for {desired}")
            if current != option["name"]:
                graphql(UPDATE_VALUE, project=PROJECT_ID, item=item["id"], field=field["id"], option=option["id"])
    print(f"Reconciled {len(issues)} issues and {len(prs)} pull requests. Iteration assignments preserved.")


if __name__ == "__main__":
    reconcile()

