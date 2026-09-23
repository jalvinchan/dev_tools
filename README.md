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

The Protobuf tab can decode without a schema (field numbers) or with a pasted `.proto` (field names). Multiple schemas are saved in the browser via New / Save / Delete.

## Open as a normal page

Double-click `index.html`, or serve the folder with any static file server.
