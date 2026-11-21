"""Check the offline evaluator against fictional, versioned job observations."""

import json
from pathlib import Path
import subprocess
import sys
import unittest

from scripts.media_evaluation import evaluate


ROOT = Path(__file__).resolve().parents[1]
FIXTURE = Path("tests/fixtures/media-evaluation-v1.json")


class MediaEvaluationTests(unittest.TestCase):
    def setUp(self):
        self.fixture = json.loads((ROOT / FIXTURE).read_text(encoding="utf-8"))
        self.captured = self.fixture["observations"][0]

    def test_cli_reports_five_unique_jobs_and_their_verdicts(self):
        result = subprocess.run(
            [sys.executable, "scripts/media_evaluation.py", str(FIXTURE)],
            cwd=ROOT,
            capture_output=True,
            text=True,
            timeout=10,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report["schema_version"], 1)
        self.assertEqual(report["observation_count"], 6)
        self.assertEqual(report["unique_jobs"], 5)
        self.assertEqual(
            {job_id: job["verdict"] for job_id, job in report["jobs"].items()},
            {
                "captured": "complete",
                "missing-source-rights": "incomplete",
                "conflicting-rights": "failed",
                "cancel-requested": "incomplete",
                "cancel-confirmed": "complete",
            },
        )
        jobs = report["jobs"]
        self.assertIn("source_missing", jobs["missing-source-rights"]["findings"])
        self.assertIn("rights_missing", jobs["missing-source-rights"]["findings"])
        self.assertIn("rights_scope_conflict", jobs["conflicting-rights"]["findings"])

    def test_pending_lifecycle_and_missing_measurements_remain_explicit(self):
        jobs = evaluate(self.fixture)["jobs"]
        requested = jobs["cancel-requested"]
        self.assertEqual(requested["cancellation"], "requested")
        self.assertIs(requested["output_reported"], True)
        self.assertIs(requested["private_capture"], False)
        self.assertIn("cancellation_unconfirmed", requested["findings"])
        self.assertIn("private_capture_unconfirmed", requested["findings"])
        self.assertIn("charge_unmeasured", requested["findings"])
        self.assertEqual(requested["measurements"]["charge_minor"], "unmeasured")

        confirmed = jobs["cancel-confirmed"]
        self.assertEqual(confirmed["cancellation"], "confirmed")
        self.assertEqual(confirmed["measurements"]["charge_minor"], 0)
        self.assertEqual(confirmed["measurements"]["latency_ms"], 320)
        self.assertEqual(
            jobs["captured"]["measurements"],
            {
                "charge_minor": 120,
                "latency_ms": "unmeasured",
                "human_quality": "unmeasured",
                "approved_thresholds": "unmeasured",
            },
        )

    def test_editing_source_or_capture_changes_the_verdict(self):
        for changes, verdict, finding in (
            ({}, "complete", None),
            ({"source_id": "different-paper-hill"}, "failed", "rights_scope_conflict"),
            ({"revision_id": "different-revision"}, "failed", "rights_scope_conflict"),
            ({"rights": None}, "incomplete", "rights_missing"),
            ({"private_capture": False}, "incomplete", "private_capture_unconfirmed"),
            ({"cancellation": "confirmed"}, "failed", "cancellation_outcome_conflict"),
        ):
            with self.subTest(changes=changes):
                data = {"schema_version": 1, "observations": [self.captured | changes]}
                job = evaluate(data)["jobs"]["captured"]
                self.assertEqual(job["verdict"], verdict)
                if finding is not None:
                    self.assertIn(finding, job["findings"])

    def test_repeating_an_observation_does_not_increase_the_job_sample(self):
        def report(*observations):
            return evaluate({"schema_version": 1, "observations": list(observations)})

        single = report(self.captured)
        repeated = report(self.captured, self.captured | {"latency_ms": None})
        self.assertEqual(repeated["observation_count"], 2)
        self.assertEqual(repeated["unique_jobs"], 1)
        self.assertEqual(repeated["jobs"], single["jobs"])

        changed = self.captured | {"charge_minor": 0}
        for observations in ((self.captured, changed), (changed, self.captured)):
            with self.subTest(observations=observations):
                conflicting = report(*observations)
                self.assertEqual(conflicting["unique_jobs"], 1)
                job = conflicting["jobs"]["captured"]
                self.assertEqual(job["verdict"], "failed")
                self.assertEqual(job["findings"], ["conflicting_observations"])
                self.assertEqual(job["measurements"]["charge_minor"], "unmeasured")

    def test_invalid_measurements_are_rejected(self):
        for charge in (True, -1, "0"):
            with self.subTest(charge=charge):
                with self.assertRaises(ValueError):
                    evaluate({
                        "schema_version": 1,
                        "observations": [self.captured | {"charge_minor": charge}],
                    })
