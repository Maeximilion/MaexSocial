import json
import subprocess
import unittest
from unittest.mock import patch

from scripts import pilot_candidate as candidate


class PilotCandidateTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.revision = candidate.git("rev-parse", "HEAD").decode().strip()
        cls.evidence = {
            "foundation": candidate.RUN_URL + "1/attempts/2",
            "pilot": candidate.RUN_URL + "2/attempts/1",
        }

    def run_record(self, run_id, attempt):
        workflow = {1: "ci.yml", 2: "pilot.yml"}[run_id]
        return {
            "id": run_id,
            "run_attempt": attempt,
            "path": f".github/workflows/{workflow}",
            "event": "push",
            "head_branch": "main",
            "head_sha": self.revision,
            "status": "completed",
            "conclusion": "success",
        }

    def test_matching_record_and_changed_inputs(self):
        pins = {"runner": {"reference": f"fixture:1@sha256:{'a' * 64}"}}
        with (patch.object(candidate, "action_run", side_effect=self.run_record) as github,
              patch.object(candidate, "image_pins", return_value=pins)):
            record = candidate.capture(self.revision, self.evidence)
            candidate.verify(record)
            artifact = "ops/local/compose.yaml"
            for field, bad_value, message in (
                ("artifacts", record["artifacts"] | {artifact: {"sha256": "0" * 64}}, "digests"),
                ("migrationRevision", "000_wrong", "Migration revision"),
                ("evidence", {"foundation": self.evidence["foundation"]}, "proof links"),
                ("revision", self.revision[:7], "full lowercase Git commit SHA"),
                ("production", {"releaseApproval": True}, "unresolved production fields"),
            ):
                with self.subTest(field=field), self.assertRaisesRegex(ValueError, message):
                    candidate.verify(record | {field: bad_value})
            self.assertEqual(github.call_count, 4)
            with self.assertRaisesRegex(ValueError, "Compose image pins"):
                candidate.verify(record | {"imagePins": {}})

    def test_images_require_digest_pins_and_include_profile_services(self):
        reference = f"fixture:1@sha256:{'b' * 64}"
        compose = {"services": {"runner": {"image": reference, "profiles": ["tools"]}}}
        with (patch.object(candidate, "git", return_value=b"fixture Compose content"),
              patch.object(candidate.subprocess, "run") as run):
            run.return_value = subprocess.CompletedProcess([], 0, json.dumps(compose).encode())
            self.assertEqual(candidate.image_pins(self.revision), {"runner": {"reference": reference}})
            self.assertIn("--profile", run.call_args.args[0])
            self.assertEqual(run.call_args.kwargs["input"], b"fixture Compose content")
            compose["services"]["runner"]["image"] = "fixture:1"
            run.return_value.stdout = json.dumps(compose).encode()
            with self.assertRaisesRegex(ValueError, "digest-pinned fixture image"):
                candidate.image_pins(self.revision)

    def test_observed_run_must_match_attempt_workflow_and_candidate(self):
        for field, value in (
            ("head_sha", "f" * 40),
            ("conclusion", "failure"),
            ("run_attempt", 9),
            ("event", "pull_request"),
            ("path", ".github/workflows/ci.yml"),
        ):
            with self.subTest(field=field, value=value):
                foundation = self.run_record(1, 2)
                pilot = self.run_record(2, 1) | {field: value}
                with patch.object(candidate, "action_run", side_effect=[foundation, pilot]):
                    with self.assertRaisesRegex(ValueError, "pilot: expected a successful main push run"):
                        candidate.verify_evidence(self.revision, self.evidence)

    def test_missing_or_unavailable_proof_fails(self):
        evidence = self.evidence | {"foundation": "https://example.test/1/attempts/2"}
        with patch.object(candidate, "action_run") as github:
            with self.assertRaisesRegex(ValueError, "expected a MaexSocial workflow attempt link"):
                candidate.verify_evidence(self.revision, evidence)
            github.assert_not_called()
        with patch.object(candidate, "action_run", side_effect=OSError):
            with self.assertRaisesRegex(ValueError, "GitHub proof is unavailable"):
                candidate.verify_evidence(self.revision, self.evidence)
