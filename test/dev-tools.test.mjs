import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";

const root = new URL("../", import.meta.url);

test("Dev Tools loads local utilities without header permissions or a worker", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
  for (const key of ["permissions", "optional_permissions", "host_permissions", "optional_host_permissions", "background", "content_scripts"]) {
    assert.equal(manifest[key], undefined, key);
  }
  const html = readFileSync(new URL("index.html", root), "utf8");
  assert.doesNotMatch(html, /headers\.js|headers\.css|integrations\/lintel/);
  const tools = [...html.matchAll(/src="js\/tools\/([^".]+)\.js"/g)].map((match) => match[1]);
  assert.deepEqual(tools, ["markdown", "json", "regex", "url", "base64", "protobuf", "uuid", "time", "diff"]);
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    assert.ok(existsSync(new URL(match[1], root)), match[1]);
  }
});

test("a previously selected Headers tab falls back to Markdown", () => {
  const tabs = [];
  const tools = [];
  let ready;
  let saved = "headers";
  const context = {
    window: {},
    localStorage: { getItem: () => saved, setItem: (_key, value) => { saved = value; } },
    document: {
      addEventListener: (_name, handler) => { ready = handler; },
      querySelector: (selector) => ({ appendChild: (element) => (selector === ".tabs" ? tabs : tools).push(element) }),
      querySelectorAll: (selector) => selector === ".tab" ? tabs : tools,
      createElement: () => ({ dataset: {}, style: {}, classList: { toggle() {} }, addEventListener() {} }),
    },
  };
  runInNewContext(readFileSync(new URL("js/app.js", root), "utf8"), context);
  for (const name of ["markdown", "json", "regex", "url", "base64", "protobuf", "uuid", "time", "diff"]) {
    context.window.registerTool(name, { template: "" });
  }
  ready();
  assert.equal(tabs.length, 9);
  assert.ok(tabs.every((tab) => tab.dataset.tool !== "headers"));
  assert.equal(tools.find((tool) => tool.id === "tool-markdown").style.display, "block");
  assert.equal(saved, "markdown");
});
