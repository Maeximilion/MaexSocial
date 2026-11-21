"""Assess fictional media job observations from a local versioned JSON file."""

import argparse
import json
from pathlib import Path


STATES = {
    "outcome": ("succeeded", "failed", "cancelled"),
    "cancellation": ("not_requested", "requested", "confirmed"),
    "human_quality": ("pass", "fail"),
}
TRACE_FIELDS = ("source_id", "revision_id")
OUTPUT_FIELDS = ("output_reported", "private_capture")
MEASUREMENTS = ("charge_minor", "latency_ms", "human_quality")
OBSERVATION_FIELDS = (
    "job_id", *TRACE_FIELDS, "rights", "outcome", "cancellation", *OUTPUT_FIELDS, *MEASUREMENTS
)


def optional_id(value):
    return value is None or (isinstance(value, str) and bool(value.strip()) and value == value.strip())


def normalize_observation(raw, index):
    if not isinstance(raw, dict) or raw.keys() - set(OBSERVATION_FIELDS):
        raise ValueError(f"observation {index}: expected a job snapshot with version 1 fields")
    record = {field: raw.get(field) for field in OBSERVATION_FIELDS}
    for field in ("job_id", *TRACE_FIELDS):
        if not optional_id(record[field]) or (field == "job_id" and record[field] is None):
            raise ValueError(f"observation {index}: invalid {field}")
    for field, states in STATES.items():
        if record[field] is not None and record[field] not in states:
            raise ValueError(f"observation {index}: invalid {field}")
    for field in OUTPUT_FIELDS:
        if record[field] is not None and type(record[field]) is not bool:
            raise ValueError(f"observation {index}: invalid {field}")
    for field in ("charge_minor", "latency_ms"):
        value = record[field]
        if value is not None and (type(value) is not int or value < 0):
            raise ValueError(f"observation {index}: invalid {field}")

    rights = record["rights"]
    if rights is not None:
        if not isinstance(rights, dict) or rights.keys() - {"state", *TRACE_FIELDS}:
            raise ValueError(f"observation {index}: invalid rights")
        if rights.get("state") not in (None, "granted", "denied"):
            raise ValueError(f"observation {index}: invalid rights state")
        if not all(optional_id(rights.get(field)) for field in TRACE_FIELDS):
            raise ValueError(f"observation {index}: invalid rights scope")
        record["rights"] = {field: rights.get(field) for field in ("state", *TRACE_FIELDS)}
    return record


def measurements(record):
    return {
        **{field: record[field] if record.get(field) is not None else "unmeasured" for field in MEASUREMENTS},
        "approved_thresholds": "unmeasured",
    }


def assess_job(record):
    incomplete = [f"{field.removesuffix('_id')}_missing" for field in TRACE_FIELDS if record[field] is None]
    failed = []
    rights = record["rights"] or {}
    if any(rights.get(field) is None for field in ("state", *TRACE_FIELDS)):
        incomplete.append("rights_missing")
    if rights.get("state") == "denied":
        failed.append("rights_denied")
    if any(record[field] is not None and rights.get(field) not in (None, record[field]) for field in TRACE_FIELDS):
        failed.append("rights_scope_conflict")

    outcome, cancellation = record["outcome"], record["cancellation"]
    reported, captured = record["output_reported"], record["private_capture"]
    if outcome is None:
        incomplete.append("outcome_unmeasured")
    if outcome == "failed":
        failed.append("job_failed")
    if cancellation in (None, "requested") or (outcome == "cancelled" and cancellation == "not_requested"):
        incomplete.append("cancellation_unconfirmed")
    if cancellation == "confirmed" and outcome in ("succeeded", "failed"):
        failed.append("cancellation_outcome_conflict")
    if captured is True and reported is False:
        failed.append("capture_without_reported_output")
    if outcome == "succeeded" or reported is True:
        if reported is not True:
            incomplete.append("output_unconfirmed")
        if captured is not True:
            incomplete.append("private_capture_unconfirmed")
    if outcome == "cancelled" and (reported is not False or captured is not False):
        incomplete.append("cancelled_output_unresolved")
    if record["charge_minor"] is None:
        incomplete.append("charge_unmeasured")

    if failed:
        verdict = "failed"
    elif incomplete:
        verdict = "incomplete"
    else:
        verdict = "complete"
    return {
        "verdict": verdict,
        "findings": failed + incomplete,
        **{field: record[field] for field in (*TRACE_FIELDS, "rights", "outcome", "cancellation", *OUTPUT_FIELDS)},
        "measurements": measurements(record),
    }


def evaluate(data):
    if not isinstance(data, dict) or data.keys() != {"schema_version", "observations"}:
        raise ValueError("expected schema_version and observations")
    if type(data["schema_version"]) is not int or data["schema_version"] != 1:
        raise ValueError("expected schema_version 1")
    observations = data["observations"]
    if not isinstance(observations, list) or not observations:
        raise ValueError("expected a nonempty observations array")

    records = {}
    conflicts = set()
    for index, raw in enumerate(observations, start=1):
        record = normalize_observation(raw, index)
        job_id = record["job_id"]
        if records.setdefault(job_id, record) != record:
            conflicts.add(job_id)
    jobs = {}
    for job_id, record in records.items():
        if job_id in conflicts:
            jobs[job_id] = {
                "verdict": "failed",
                "findings": ["conflicting_observations"],
                "measurements": measurements({}),
            }
        else:
            jobs[job_id] = assess_job(record)
    return {"schema_version": 1, "observation_count": len(observations), "unique_jobs": len(jobs), "jobs": jobs}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("fixture", type=Path, help="local JSON containing invented job observations")
    args = parser.parse_args()
    try:
        report = evaluate(json.loads(args.fixture.read_text(encoding="utf-8")))
    except (OSError, ValueError) as error:
        parser.error(str(error))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
