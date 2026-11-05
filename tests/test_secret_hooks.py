"""Real Git/Gitleaks integration; set MAEXSOCIAL_TEST_GITLEAKS to run locally."""

import os
from pathlib import Path
import secrets
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
SCANNER = os.environ.get("MAEXSOCIAL_TEST_GITLEAKS") or shutil.which("gitleaks")


@unittest.skipUnless(SCANNER, "Gitleaks is not installed; set MAEXSOCIAL_TEST_GITLEAKS")
class SecretHooksTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="secret hooks ")
        self.addCleanup(self.temp.cleanup)
        self.repo = Path(self.temp.name) / "repo"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Hook Test")
        self.git("config", "user.email", "hooks@example.invalid")
        self.git("config", "commit.gpgsign", "false")
        self.git("config", "core.hooksPath", str(self.repo / ".git/hooks"))
        self.git("config", "maexsocial.gitleaksPath", str(Path(SCANNER).resolve()))
        hooks = self.repo / ".git/hooks"
        for name in ("pre-commit", "pre-push"):
            source = ROOT / "scripts/git-secret-hook.sh"
            shutil.copyfile(source, hooks / name)
            (hooks / name).chmod(0o755)
        for name in ("gitleaks.toml", ".gitleaksignore"):
            source = ROOT / "scripts/secret-hooks" / name
            shutil.copyfile(source, hooks / name)
        (self.repo / "README.md").write_text("Clean repository.\n")
        self.git("add", ".")
        self.git("commit", "-qm", "Initial clean commit")
        # Deliberately synthetic, assembled so the test source is not a credential.
        self.token = "gh" + "p_" + secrets.token_hex(18)

    def git(self, *args, check=True):
        result = subprocess.run(["git", *args], cwd=self.repo, capture_output=True, text=True)
        if check:
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        return result

    def stage_secret(self):
        (self.repo / "settings.txt").write_text("token=" + self.token + "\n")
        self.git("add", "settings.txt")

    def test_staged_secret_blocks_commit_even_with_clean_working_copy(self):
        self.stage_secret()
        (self.repo / "settings.txt").write_text("Clean working copy.\n")
        result = self.git("commit", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(result.returncode, 0, "Staged secret was committed")
        self.assertNotIn(self.token, result.stdout + result.stderr)
        self.assertIn("leaks found", result.stdout + result.stderr)

    def test_clean_index_allows_commit_despite_unstaged_secret(self):
        (self.repo / "settings.txt").write_text("Safe staged value.\n")
        self.git("add", "settings.txt")
        (self.repo / "settings.txt").write_text("token=" + self.token + "\n")
        self.git("commit", "-qm", "Clean index")

    def test_linked_worktree_commit_all_scans_the_temporary_index(self):
        linked = Path(self.temp.name) / "linked worktree"
        self.git("worktree", "add", "-q", "-b", "linked", str(linked))
        (linked / "README.md").write_text("token=" + self.token + "\n")
        r = self.git("-C", str(linked), "commit", "-qam", "Must be blocked", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("leaks found", r.stderr)
        self.assertNotIn(self.token, r.stderr)

    def test_missing_scanner_blocks_commit(self):
        self.git("config", "maexsocial.gitleaksPath", str(self.repo / "missing scanner"))
        result = self.git("commit", "--allow-empty", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(result.returncode, 0)

    def test_push_blocks_secret_removed_from_latest_commit(self):
        self.stage_secret()
        # Simulate an imported commit which never ran this clone's commit hook.
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported unsafe commit")
        (self.repo / "settings.txt").write_text("Clean latest revision.\n")
        self.git("add", "settings.txt")
        self.git("commit", "-qm", "Remove synthetic token")
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        result = self.git("push", str(remote), "HEAD:refs/heads/main", check=False)
        self.assertNotEqual(result.returncode, 0, "Historical secret was pushed")
        self.assertNotIn(self.token, result.stdout + result.stderr)
        self.assertIn("leaks found", result.stdout + result.stderr)

    def assert_push_rejected(self, source):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        result = self.git("push", str(remote), source + ":refs/heads/main", check=False)
        self.assertNotEqual(result.returncode, 0, "Unsafe object was pushed")
        self.assertIn("leaks found", result.stderr)
        self.assertNotIn(self.token, result.stderr)

    def test_push_scans_an_unreferenced_source_commit(self):
        self.git("checkout", "--detach", "-q")
        self.stage_secret()
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Import")
        oid = self.git("rev-parse", "HEAD").stdout.strip()
        self.git("checkout", "-q", "-")
        self.assert_push_rejected(oid)

    def test_push_scans_secrets_introduced_only_at_merge(self):
        self.git("branch", "side")
        self.git("commit", "--allow-empty", "-qm", "First parent")
        self.git("branch", "first-parent-test")
        self.git("checkout", "-q", "side")
        self.git("commit", "--allow-empty", "-qm", "Other parent")
        self.git("merge", "--no-commit", "--no-ff", "first-parent-test")
        self.stage_secret()
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported merge")
        self.assertEqual(len(self.git("rev-list", "--parents", "-n", "1", "HEAD").stdout.split()), 3)
        self.assert_push_rejected("HEAD")

    def test_worktree_ignore_cannot_suppress_the_staged_scan(self):
        (self.repo / ".gitleaksignore").write_text("settings.txt:github-pat:1\n")
        self.stage_secret()
        r = self.git("commit", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("worktree .gitleaksignore", r.stderr)

    def test_internal_git_failure_blocks_push(self):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        self.git("config", "diff.orderFile", "missing-order-file")
        r = self.git("push", str(remote), "HEAD:refs/heads/main", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("scan failed", r.stderr)

    def test_diff_attribute_cannot_hide_staged_or_pushed_text(self):
        (self.repo / ".gitattributes").write_text("settings.txt -diff\n")
        self.stage_secret()
        r = self.git("commit", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported")
        self.assert_push_rejected("HEAD")

    def test_push_scans_tag_and_commit_messages(self):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        self.git("tag", "-a", "annotated", "-m", "token=" + self.token)
        r = self.git("push", str(remote), "refs/tags/annotated", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(self.token, r.stderr)
        self.git("commit", "--allow-empty", "-qm", "token=" + self.token)
        r = self.git("push", str(remote), "HEAD:refs/heads/main", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(self.token, r.stderr)

    def test_clean_push_succeeds(self):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        self.git("push", str(remote), "HEAD:refs/heads/main")


if __name__ == "__main__":
    unittest.main()
