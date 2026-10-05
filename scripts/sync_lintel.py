#!/usr/bin/env python3
"""Refresh the inactive Lintel integration without enabling it in Dev Tools."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
INTEGRATION = Path("integrations/lintel")
FEATURE = INTEGRATION / "js/headers"
RECORD = FEATURE / "lintel-source.json"
PATCH = ROOT / "scripts/lintel-integration.patch"
# Entry points, tool registration, and CSS belong to Dev Tools.
FILES = (
    "app/extension-app.js",
    "app/extension-client.js",
    "app/extension-controller.js",
    "app/extension-messages.js",
    "core/rule-compiler.js",
    "model/header-constraints.js",
    "model/header-rule.js",
    "model/profile.js",
    "model/rule-kinds.js",
    "model/site-pattern.js",
    "net/chrome-dynamic-rule-gateway.js",
    "presentation/apply-status.js",
    "presentation/editor-view.js",
    "storage/chrome-rule-repository.js",
)


def run(args, cwd):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout


def digest(data):
    return hashlib.sha256(data).hexdigest()


def replace_file(path, data):
    """Use a sibling temporary file so readers never see a half-written file."""
    with tempfile.NamedTemporaryFile(dir=path.parent, delete=False) as out:
        temporary = Path(out.name)
        out.write(data)
    try:
        os.chmod(temporary, path.stat().st_mode & 0o777 if path.exists() else 0o644)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def sync(source, check=False):
    source = source.resolve()
    revision = run(["git", "rev-parse", "HEAD"], source).strip()
    if run(["git", "status", "--porcelain", "--untracked-files=all"], source):
        raise ValueError("Lintel has uncommitted changes. Commit them first so the imported revision is reproducible.")

    originals = {
        FEATURE / name: (ROOT / FEATURE / name).read_bytes() if (ROOT / FEATURE / name).exists() else None
        for name in FILES
    }
    record_path = ROOT / RECORD
    old_record = record_path.read_bytes() if record_path.exists() else None
    if old_record is not None:
        record = json.loads(old_record)
        for name in FILES:
            original = originals[FEATURE / name]
            expected = record["files"].get(name)
            if expected is None and original is None:
                continue  # A newly added upstream module.
            if original is None or digest(original) != expected:
                raise ValueError(f"Local edit in {FEATURE / name}. Move the change into Lintel or lintel-integration.patch before syncing.")
    elif run(["git", "status", "--porcelain", "--untracked-files=all", "--", str(FEATURE)], ROOT):
        raise ValueError(f"The first sync requires a clean {FEATURE} directory. Commit or restore local edits first.")

    with tempfile.TemporaryDirectory(prefix="dev-tools-lintel-") as temporary:
        stage = Path(temporary)
        # Validate the imported feature against the actual host and its tests.
        for name in ("js", "css", "icons", "vendor", "test", "integrations"):
            shutil.copytree(ROOT / name, stage / name)
        for name in ("manifest.json", "index.html", "popup.html", "popup.js"):
            shutil.copyfile(ROOT / name, stage / name)
        for name in FILES:
            # Read the recorded commit rather than a checkout that can change
            # while tests run.
            contents = run(["git", "show", f"{revision}:src/{name}"], source)
            target = stage / FEATURE / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(contents, encoding="utf-8")
        run(["git", "apply", "--check", str(PATCH)], stage / FEATURE)
        run(["git", "apply", str(PATCH)], stage / FEATURE)
        for path in sorted((stage / FEATURE).rglob("*.js")):
            run(["node", "--check", str(path)], stage)
        tests = sorted(str(path) for directory in (stage / "test", stage / INTEGRATION / "test") for path in directory.glob("*.test.mjs"))
        if not tests:
            raise ValueError("No header acceptance tests found.")
        print("Checking the staged integration…", flush=True)
        run(["node", "--test", *tests], stage)
        print("Header acceptance tests passed.")
        updates = {FEATURE / name: (stage / FEATURE / name).read_bytes() for name in FILES}

    record = {
        "repository": "lintel",
        "revision": revision,
        "patch_sha256": digest(PATCH.read_bytes()),
        "files": {name: digest(updates[FEATURE / name]) for name in FILES},
    }
    updates[RECORD] = (json.dumps(record, indent=2) + "\n").encode()
    originals[RECORD] = old_record
    changed = [path for path, data in updates.items() if originals[path] != data]
    if not changed:
        print(f"Already synced with Lintel {revision[:12]}.")
        return 0
    for path in changed:
        print(f"{'Would update' if check else 'Update'} {path}")
    if check:
        return 1

    written = []
    try:
        for path in changed:
            current = (ROOT / path).read_bytes() if (ROOT / path).exists() else None
            if current != originals[path]:
                raise ValueError(f"{path} changed during sync. Retry after resolving the local edit.")
            (ROOT / path).parent.mkdir(parents=True, exist_ok=True)
            replace_file(ROOT / path, updates[path])
            written.append(path)
    except (OSError, ValueError):
        # Restore the previous integration if any replacement fails.
        for path in reversed(written):
            if originals[path] is None:
                (ROOT / path).unlink(missing_ok=True)
            else:
                replace_file(ROOT / path, originals[path])
        raise
    print(f"Synced Lintel {revision[:12]}; acceptance tests passed. Review git diff. The integration remains inactive.")
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", nargs="?", type=Path, default=ROOT.parent / "lintel", help="Lintel checkout (default: ../lintel)")
    parser.add_argument("--check", action="store_true", help="Validate without writing; exit 1 when an update is available")
    args = parser.parse_args()
    try:
        # Prevent two sync commands from publishing different snapshots at once.
        with Path(__file__).open("rb") as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            return sync(args.source, args.check)
    except subprocess.CalledProcessError as error:
        print(f"Sync failed: {' '.join(error.cmd)}\n{error.stdout}{error.stderr}", file=sys.stderr)
    except (OSError, ValueError, KeyError) as error:
        print(f"Sync failed: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
    sys.exit(main())
