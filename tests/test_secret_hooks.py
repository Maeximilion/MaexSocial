"""Real Git/Gitleaks integration; set MAEXSOCIAL_TEST_GITLEAKS to run locally."""

import os
from pathlib import Path
import secrets
import shutil
import shlex
import string
import subprocess
import sys
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
        for name in ("pre-commit", "pre-applypatch", "pre-merge-commit", "pre-push"):
            source = ROOT / "scripts/git-secret-hook.sh"
            shutil.copyfile(source, hooks / name)
            (hooks / name).chmod(0o755)
        for name in ("gitleaks.toml", ".gitleaksignore", "scan_objects.py"):
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
        self.git("config", "color.ui", "always")
        self.git("config", "color.diff", "always")
        self.stage_secret()
        (self.repo / "settings.txt").write_text("Clean working copy.\n")
        result = self.git("-c", "color.diff=always", "commit", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(result.returncode, 0, "Staged secret was committed")
        self.assertNotIn(self.token, result.stdout + result.stderr)
        self.assertIn("leaks found", result.stdout + result.stderr)

    def test_clean_index_allows_commit_despite_unstaged_secret(self):
        (self.repo / "settings.txt").write_text("Safe staged value.\n")
        self.git("add", "settings.txt")
        (self.repo / "settings.txt").write_text("token=" + self.token + "\n")
        self.git("commit", "-qm", "Clean index")

    def assert_script_blocked(self, data):
        (self.repo / "settings.ps1").write_bytes(data)
        self.git("add", "settings.ps1")
        result = self.git("commit", "-qm", "Unsafe script", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("leaks found", result.stderr)
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported script")
        self.assert_push_rejected("HEAD")

    def test_bom_marked_script_is_blocked_on_commit_and_push(self):
        self.assert_script_blocked(("token=" + self.token).encode("utf-16"))

    def test_ambiguous_bom_does_not_hide_a_utf16_script(self):
        self.assert_script_blocked(b"\xff\xfe" + ("\0token=" + self.token).encode("utf-16-le"))

    def test_ambiguous_bom_still_scans_a_utf32_script(self):
        self.assert_script_blocked(b"\xff\xfe\0\0" + ("token=" + self.token).encode("utf-32-le"))

    def test_verbose_scanner_error_blocks_without_hanging_or_printing_details(self):
        hooks = self.repo / ".git/hooks"
        config = "[[rules]]\nid='bad'\ndescription='bad'\nregex='(" + "x" * 150000 + "'\n"
        (hooks / "gitleaks.toml").write_text(config)
        result = subprocess.run([sys.executable, "-I", "-B", str(hooks / "scan_objects.py"),
                                 str(Path(SCANNER).resolve()), shutil.which("git"), "HEAD"],
                                cwd=self.repo, capture_output=True, text=True, timeout=12)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        self.assertEqual(result.stderr.strip(), "Secret scan blocked: leaks found or scan failed.")

    def test_unsafe_patch_import_and_automatic_merge_leave_head_unchanged(self):
        base = self.git("rev-parse", "HEAD").stdout.strip()
        self.git("checkout", "-qb", "import")
        self.stage_secret()
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported patch")
        patch = Path(self.temp.name) / "import.patch"
        with patch.open("wb") as stream:
            subprocess.run(["git", "format-patch", "-1", "--stdout"], cwd=self.repo, stdout=stream, check=True)
        self.git("checkout", "-q", "--detach", base)
        for operation in (("am", str(patch)), ("merge", "--no-ff", "import")):
            with self.subTest(operation=operation[0]):
                result = self.git(*operation, check=False)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn("leaks found", result.stderr)
                self.assertEqual(self.git("rev-parse", "HEAD").stdout.strip(), base)
                self.git(operation[0], "--abort")

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

    def test_nul_does_not_hide_an_ascii_token_in_the_index(self):
        (self.repo / ".gitattributes").write_text("settings.dat diff\n")
        (self.repo / "settings.dat").write_bytes(b"\0token=" + self.token.encode() + b"\n")
        self.git("add", "settings.dat")
        r = self.git("commit", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(self.token, r.stdout + r.stderr)

    def test_push_scans_decoded_imported_commit_message(self):
        tree = self.git("rev-parse", "HEAD^{tree}").stdout.strip()
        identity = "%PDF-1.4 <hooks@example.invalid> 2100000000 +0000"
        # A valid ASCII reset splits the token on disk but decodes away.
        split = self.token[:2].encode() + b"\x1b(B" + self.token[2:].encode()
        for field in ("author", "body"):
            with self.subTest(field=field):
                author = (b"token=" + split + b" <hooks@example.invalid> 1700000000 +0000"
                          if field == "author" else identity.encode())
                body = b"clean" if field == "author" else b"token=" + split
                raw = (f"tree {tree}\nauthor ".encode() + author
                       + f"\ncommitter {identity}\nencoding ISO-2022-JP\n\n".encode() + body + b"\n")
                oid = subprocess.check_output(["git", "hash-object", "-t", "commit", "-w", "--stdin"],
                                              cwd=self.repo, input=raw).decode().strip()
                self.assertIn(self.token, self.git("log", "-1", "--format=%an%n%B",
                                                   "--encoding=UTF-8", oid).stdout)
                self.assert_push_rejected(oid)

    def test_push_scans_tag_and_commit_messages(self):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        self.git("tag", "-a", "annotated", "-m", "token=" + self.token)
        r = self.git("push", str(remote), "refs/tags/annotated", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(self.token, r.stderr)
        self.git("config", "i18n.logOutputEncoding", "UTF-16LE")
        self.git("commit", "--allow-empty", "-qm", "token=" + self.token)
        r = self.git("push", str(remote), "HEAD:refs/heads/main", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(self.token, r.stderr)

    def test_push_scans_a_binary_removed_before_push(self):
        self.git("config", "log.showRoot", "false")
        self.git("checkout", "--orphan", "imported-root")
        (self.repo / "capture.bin").write_bytes(b"\0token=" + self.token.encode())
        self.git("add", "capture.bin")
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported binary")
        self.git("rm", "capture.bin")
        self.git("commit", "-qm", "Remove binary")
        self.assert_push_rejected("HEAD")

    def test_local_textconv_cannot_strip_staged_secrets(self):
        (self.repo / ".git/info/attributes").write_text("settings.txt diff=filtered\n")
        self.git("config", "diff.filtered.textconv", "true")
        self.stage_secret()
        result = self.git("commit", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn(self.token, result.stderr)

    @unittest.skipIf(os.name == "nt", "Colon is not a Windows filename character")
    def test_colon_in_binary_filename_cannot_alias_another_index_entry(self):
        (self.repo / "a.bin").write_text("clean")
        (self.repo / "0:a.bin").write_bytes(b"\0token=" + self.token.encode())
        self.git("add", "a.bin", "0:a.bin")
        self.assertNotEqual(self.git("commit", "-qm", "Must be blocked", check=False).returncode, 0)

    def test_staged_and_historical_names_are_scanned(self):
        self.token = "api_key=" + "".join(secrets.SystemRandom().sample(string.ascii_letters + string.digits, 48))
        (self.repo / self.token).touch()
        self.git("add", self.token)
        r = self.git("commit", "-qm", "Empty file", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(self.token, r.stderr)
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported filename")
        self.git("rm", self.token)
        self.git("commit", "-qm", "Remove filename")
        self.assert_push_rejected("HEAD")

    def test_clean_object_does_not_match_the_next_git_header(self):
        (self.repo / "first.txt").write_text("token=")
        (self.repo / "second.txt").write_text("ordinary prose")
        self.git("add", "first.txt", "second.txt")
        self.git("commit", "-qm", "Two clean blobs")

    def test_imported_application_blob_is_scanned_independently(self):
        (self.repo / "capture.bin").write_bytes(b"SQLite format 3\0token=" + self.token.encode())
        self.git("add", "capture.bin")
        self.git("-c", "core.hooksPath=", "commit", "-qm", "Imported application object")
        self.assert_push_rejected("HEAD")

    def test_changed_scan_policy_invalidates_cached_clean_objects(self):
        key = "api_key=" + "".join(secrets.SystemRandom().sample(string.ascii_letters + string.digits, 48))
        (self.repo / key).touch()
        self.git("add", key)
        ignore = self.repo / ".git/hooks/.gitleaksignore"
        original = ignore.read_text()
        ignore.write_text(original + "\n:generic-api-key:3\n")
        self.git("commit", "-qm", "Allowed under first policy")
        ignore.write_text(original)
        self.assertNotEqual(self.git("hook", "run", "pre-commit", check=False).returncode, 0)

    def test_shifted_tar_signature_cannot_hide_plaintext_token(self):
        data = b"\0" * 255 + b"ustar\0" + b"\0" * 260 + b"token=" + self.token.encode()
        (self.repo / "capture.bin").write_bytes(data)
        self.git("add", "capture.bin")
        r = self.git("commit", "-qm", "Must be blocked", check=False)
        self.assertNotEqual(r.returncode, 0)
        self.assertNotIn(self.token, r.stderr)

    def test_unusable_python3_falls_back_to_working_python(self):
        stub_dir = Path(self.temp.name) / "stubs"
        stub_dir.mkdir()
        stub = stub_dir / "python3"
        stub.write_bytes(b"#!/bin/sh\nexit 1\n")
        stub.chmod(0o755)
        fallback = stub_dir / "python"
        fallback.write_bytes(("#!/bin/sh\nexec " + shlex.quote(Path(sys.executable).as_posix())
                              + ' "$@"\n').encode())
        fallback.chmod(0o755)
        env = dict(os.environ, PATH=str(stub_dir) + os.pathsep + os.environ["PATH"])
        r = subprocess.run(["git", "hook", "run", "pre-commit"], cwd=self.repo, env=env,
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    @unittest.skipUnless(os.name == "nt", "Windows executable search regression")
    def test_worktree_git_executable_is_never_launched_by_python(self):
        executable = shutil.which("git")
        (self.repo / "git.exe").write_bytes(b"invalid, deliberately not an executable")
        r = subprocess.run([sys.executable, "-I", "-B", str(self.repo / ".git/hooks/scan_objects.py"),
                            str(Path(SCANNER).resolve()), executable, "HEAD"], cwd=self.repo,
                           capture_output=True, text=True)
        self.assertEqual(r.returncode, 0, r.stderr)

    def test_push_rejects_secret_in_new_remote_ref(self):
        self.assert_destination_blocked(self.token)

    def test_push_rejects_secret_spanning_destination_components(self):
        token = "gl" + "c_" + secrets.token_hex(10) + "/" + secrets.token_hex(10)
        self.assert_destination_blocked(token)

    def assert_destination_blocked(self, token):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        ref = "refs/heads/" + token
        result = self.git("push", str(remote), "HEAD:" + ref, check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.git("ls-remote", str(remote), ref).stdout, "")

    def test_clean_push_succeeds(self):
        remote = Path(self.temp.name) / "remote.git"
        self.git("init", "--bare", "-q", str(remote))
        self.git("push", str(remote), "HEAD:refs/heads/main")


if __name__ == "__main__":
    unittest.main()
