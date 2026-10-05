# Dev Tools

A small local toolbox (Markdown, JSON, Regex, URL, Base64, Protobuf, UUID, time, diff). It runs as a **Chrome extension** or as a plain HTML file.

## Load as a Chrome extension

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked**
4. Select this folder (`personal/dev_tools`)
5. Pin **Dev Tools** on the toolbar and click it — it opens (or focuses) the tools tab

No extra permissions. Third-party JS/CSS is copied into `vendor/` (see `vendor/lock.json` for name, version, and source URL).

To refresh those files after you bump a version in the lockfile:

```bash
python3 scripts/sync_vendor.py
```

Nothing auto-updates. Chrome would otherwise keep serving the copies you last committed until you change them.

The Protobuf tab uses protobuf.js only to parse `.proto` text. Its encoder/decoder is hand-written against the parsed schema, because protobuf.js builds its codecs with `new Function`, which the extension's Content Security Policy blocks.

The Protobuf tab can decode and encode. Decode without a schema uses field numbers; with a pasted `.proto` it uses field names. Encode takes JSON (with a `.proto` and message type) or the field-number dump (no schema) and writes base64 or hex. Multiple schemas are saved in the browser via New / Save / Delete.

## Open as a normal page

Double-click `index.html`, or serve the folder with any static file server.

## Lintel integration for future use

Header editing belongs to the separate Lintel extension. Dev Tools does not load a header editor or background worker and requests no site-access permissions. The reusable feature and its adapters are kept inactive in `integrations/lintel/`.

If updating an installation that previously included Headers, click **Reload** on the Dev Tools card in `chrome://extensions` and reopen the tools tab. Existing browser settings are retained; no saved header rules are deleted.

Commit your changes in the Lintel checkout, then run:

```bash
python3 scripts/sync_lintel.py
```

The default source is the sibling `../lintel` repository. Pass another checkout as a positional argument if needed. Requires macOS or Linux, Git, Python 3.8+, and Node.js 22.7+. The script also works when launched from another working directory.

The command refreshes the inactive header engine and editor, applies `scripts/lintel-integration.patch`, and runs the toolbox and header tests in a temporary copy before replacing files. The patch preserves Dev Tools' branding, message names, storage keys, and header input class. `integrations/lintel/js/headers/lintel-source.json` records the imported commit, patch hash, and generated file hashes. Syncing does not enable Headers or change the active manifest, sidebar, or permissions.

To preview an update without writing:

```bash
python3 scripts/sync_lintel.py --check
```

Check mode exits 0 when already synced and 1 when changes are available or validation fails. A dirty Lintel checkout, local edits to generated files, a patch conflict, or failing tests stops the update. Repeated syncs are a no-op. If Lintel changes the integration points or adds a module, update the patch or file list and the relevant acceptance tests before retrying. New editor styling belongs in `integrations/lintel/css/headers.css`.

Treat the synced JavaScript as generated code: develop shared behavior in Lintel and keep Dev Tools adaptations in the patch. After syncing, review `git diff` and commit the update. Git can restore the previous files and `lintel-source.json` together to roll back a sync; saved browser rules are untouched. A future integration will require explicitly wiring the archived adapter, stylesheet, background worker, and Chrome permissions back into Dev Tools.

## Checks

Run the toolbox and inactive integration tests with Node.js 22.7 or newer:

```bash
node --test test/*.test.mjs integrations/lintel/test/*.test.mjs
```

To check the sync command's update, conflict, and rollback behavior:

```bash
python3 -B -m unittest discover -s test -p 'test_sync_lintel.py' -v
```

## License

Project-owned code is licensed under the [MIT License](LICENSE). Bundled third-party libraries retain their respective licenses; full license texts and copyright notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Include both files in source releases and the Chrome extension package. When updating a library in `vendor/lock.json`, refresh its entry and license text in `THIRD_PARTY_NOTICES.md` from the matching release, and preserve existing license headers in the vendor files.
