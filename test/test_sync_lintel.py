"""Exercise sync safety using isolated Git repositories, never the real Lintel."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sync_lintel", ROOT / "scripts/sync_lintel.py")
sync_lintel = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync_lintel)


def git(root, *args):
    return subprocess.run(["git", *args], cwd=root, check=True, capture_output=True, text=True).stdout.strip()


def commit(root):
    git(root, "add", ".")
    git(root, "-c", "user.name=Sync Test", "-c", "user.email=sync-test@example.invalid", "commit", "-m", "Fixture update")


class SyncTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory(prefix="lintel-sync-test-")
        self.addCleanup(temporary.cleanup)
        self.host = Path(temporary.name) / "dev_tools"
        self.source = Path(temporary.name) / "lintel"
        self.host.mkdir()
        for name in ("js", "css", "icons", "vendor", "test", "integrations"):
            shutil.copytree(ROOT / name, self.host / name)
        for name in ("manifest.json", "index.html", "popup.html", "popup.js"):
            shutil.copyfile(ROOT / name, self.host / name)
        # Reconstruct a committed upstream fixture from the checked-in import.
        for name in sync_lintel.FILES:
            target = self.source / "src" / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / sync_lintel.FEATURE / name, target)
        git(self.source / "src", "apply", "--reverse", str(sync_lintel.PATCH))
        git(self.source, "init")
        commit(self.source)
        git(self.host, "init")
        commit(self.host)
        root_patch = patch.object(sync_lintel, "ROOT", self.host)
        root_patch.start()
        self.addCleanup(root_patch.stop)

    def snapshot(self):
        return {path.relative_to(self.host): path.read_bytes() for path in (self.host / sync_lintel.FEATURE).rglob("*") if path.is_file()}

    def sync(self, check=False):
        with contextlib.redirect_stdout(io.StringIO()) as output:
            result = sync_lintel.sync(self.source, check)
        return result, output.getvalue()

    def change_source(self, relative="model/profile.js"):
        path = self.source / "src" / relative
        path.write_text(path.read_text() + "\n// Upstream update.\n")
        commit(self.source)

    def test_preview_sync_and_repeat_preserve_host_adapters(self):
        # Exercise bootstrap without a previously recorded import.
        (self.host / sync_lintel.RECORD).unlink()
        commit(self.host)
        before = self.snapshot()
        self.change_source()
        self.assertEqual(self.sync(check=True)[0], 1)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.sync()[0], 0)
        after = self.snapshot()
        self.assertIn(b"// Upstream update.", after[sync_lintel.FEATURE / "model/profile.js"])
        for name in ("entrypoint/editor.js", "entrypoint/background.js"):
            self.assertEqual(after[sync_lintel.FEATURE / name], before[sync_lintel.FEATURE / name])
        record = json.loads(after[sync_lintel.RECORD])
        self.assertEqual(record["revision"], git(self.source, "rev-parse", "HEAD"))
        self.assertEqual(self.sync(check=True)[0], 0)
        self.assertIn("Already synced", self.sync()[1])
        self.assertEqual(self.snapshot(), after)

    def test_local_edits_and_dirty_upstream_stop_before_writing(self):
        edited = self.host / sync_lintel.FEATURE / "model/profile.js"
        edited.write_text(edited.read_text() + "\n// Local change.\n")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "Local edit"):
            self.sync()
        self.assertEqual(self.snapshot(), before)
        edited.write_bytes((ROOT / sync_lintel.FEATURE / "model/profile.js").read_bytes())
        path = self.source / "src/model/profile.js"
        path.write_text(path.read_text() + "\n// Uncommitted.\n")
        before = self.snapshot()
        with self.assertRaisesRegex(ValueError, "uncommitted changes"):
            self.sync()
        self.assertEqual(self.snapshot(), before)

    def test_incompatible_patch_stops_before_writing(self):
        path = self.source / "src/presentation/editor-view.js"
        path.write_text(path.read_text().replace('h("h1", {}, "Lintel")', 'h("h1", {}, "Changed title")'))
        commit(self.source)
        before = self.snapshot()
        with self.assertRaises(subprocess.CalledProcessError):
            self.sync()
        self.assertEqual(self.snapshot(), before)

    def test_failing_acceptance_tests_stop_before_writing(self):
        self.change_source()
        path = self.host / sync_lintel.INTEGRATION / "test/header-rule.test.mjs"
        path.write_text(path.read_text() + '\ntest("reject this staged update", () => assert.fail("deliberate failure"));\n')
        before = self.snapshot()
        with self.assertRaises(subprocess.CalledProcessError) as failure:
            self.sync()
        self.assertIn("deliberate failure", failure.exception.stdout)
        self.assertEqual(self.snapshot(), before)

    def test_failed_replacement_rolls_back_previous_files(self):
        self.change_source()
        before = self.snapshot()
        replace_file = sync_lintel.replace_file
        count = 0

        def fail_second_write(path, data):
            nonlocal count
            count += 1
            if count == 2:
                raise OSError("simulated write failure")
            replace_file(path, data)

        with patch.object(sync_lintel, "replace_file", fail_second_write):
            with self.assertRaisesRegex(OSError, "simulated write failure"):
                self.sync()
        self.assertEqual(self.snapshot(), before)

    def test_new_upstream_module_can_be_added_to_the_file_list(self):
        added = "model/new-helper.js"
        (self.source / "src" / added).write_text('export const helper = "new";\n')
        commit(self.source)
        with patch.object(sync_lintel, "FILES", (*sync_lintel.FILES, added)):
            self.assertEqual(self.sync()[0], 0)
            self.assertEqual((self.host / sync_lintel.FEATURE / added).read_text(), 'export const helper = "new";\n')
            self.assertIn("Already synced", self.sync()[1])


if __name__ == "__main__":
    unittest.main()
