import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { ExtensionClient } from "../js/headers/app/extension-client.js";

const root = new URL("../../../", import.meta.url);

test("the host does not enable the archived header feature", () => {
  const manifest = JSON.parse(readFileSync(new URL("manifest.json", root), "utf8"));
  assert.equal(manifest.background, undefined);
  assert.equal(manifest.permissions, undefined);
  assert.equal(manifest.host_permissions, undefined);
  for (const path of [manifest.action.default_popup, ...Object.values(manifest.icons)]) {
    assert.ok(existsSync(new URL(path, root)), path);
  }
  const html = readFileSync(new URL("index.html", root), "utf8");
  for (const match of html.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
    assert.ok(existsSync(new URL(match[1], root)), match[1]);
  }
  assert.doesNotMatch(html, /headers\.js|headers\.css/);
  assert.match(html, /js\/tools\/protobuf\.js/);
});

test("the archived tool adapter can still explain its extension requirement", async () => {
  const view = { textContent: "" };
  const context = {
    window: {},
    document: { addEventListener() {}, querySelector: () => view },
    location: { protocol: "file:" },
  };
  runInNewContext(readFileSync(new URL("js/app.js", root), "utf8"), context);
  runInNewContext(readFileSync(new URL("../js/tools/headers.js", import.meta.url), "utf8"), context);
  assert.equal(context.window.Tools.headers.title, "Headers");
  await context.window.Tools.headers.init();
  assert.match(view.textContent, /require the Chrome extension/);
});

test("the worker applies saved edits, pauses, resumes, and restores rules at startup", async (t) => {
  const previousChrome = globalThis.chrome;
  t.after(() => { globalThis.chrome = previousChrome; });
  const data = { otherTool: { value: "keep me" } };
  let dynamic = [];
  const listeners = {};
  const event = (name) => ({ addListener(listener) { listeners[name] = listener; } });
  const runtime = {
    onInstalled: event("installed"),
    onStartup: event("startup"),
    onMessage: event("message"),
    sendMessage(message) {
      return new Promise((resolve) => {
        if (!listeners.message(message, {}, resolve)) resolve(undefined);
      });
    },
  };
  globalThis.chrome = {
    runtime,
    storage: {
      local: {
        async get(keys) { return Object.fromEntries(keys.map((key) => [key, data[key]])); },
        async set(values) { Object.assign(data, structuredClone(values)); },
      },
    },
    declarativeNetRequest: {
      async getDynamicRules() { return structuredClone(dynamic); },
      async updateDynamicRules({ removeRuleIds, addRules }) {
        dynamic = [...dynamic.filter((rule) => !removeRuleIds.includes(rule.id)), ...structuredClone(addRules)];
      },
      async isRegexSupported({ regex }) { return { isSupported: regex !== "(", reason: "syntaxError" }; },
    },
  };
  await import("../js/headers/entrypoint/background.js");
  const client = new ExtensionClient(runtime);
  assert.deepEqual(await client.load(), { enabled: true, rules: [] });
  assert.equal(listeners.message({ type: "other-tool:load" }, {}, () => assert.fail("Unexpected response")), false);
  const result = await client.saveRules([
    {
      id: "api", scope: "domains", domainsText: "example.com", methods: ["GET"],
      traffic: "document-and-fetch",
      headers: [
        { header: "X-Debug", operation: "set", value: "1" },
        { header: "Accept-Language", operation: "append", value: "fr" },
        { header: "Cookie", operation: "remove" },
        { header: "Host", operation: "set", value: "blocked.test" },
      ],
    },
    { id: "bad-regex", scope: "regex", urlPattern: "(", header: "x-bad", value: "1" },
  ]);
  assert.equal(result.applied, 1);
  assert.equal(result.skipped.length, 2);
  assert.deepEqual(dynamic[0].action.requestHeaders, [
    { header: "x-debug", operation: "set", value: "1" },
    { header: "accept-language", operation: "append", value: "fr" },
    { header: "cookie", operation: "remove" },
  ]);
  assert.deepEqual(dynamic[0].condition.requestDomains, ["example.com"]);
  assert.deepEqual(dynamic[0].condition.requestMethods, ["get"]);
  assert.equal(data.headerOverridesRules.length, 2);
  assert.deepEqual(data.otherTool, { value: "keep me" });

  await client.setEnabled(false);
  assert.deepEqual(dynamic, []);
  assert.equal((await client.load()).rules.length, 2);
  await client.saveRules([{ id: "replacement", scope: "all", header: "x-debug", value: "2" }]);
  assert.deepEqual(dynamic, []);
  await client.setEnabled(true);
  assert.equal(dynamic[0].action.requestHeaders[0].value, "2");

  for (const name of ["startup", "installed"]) {
    dynamic = [];
    listeners[name]();
    // load shares the worker's queue, so it waits for the lifecycle sync.
    await client.load();
    assert.equal(dynamic[0].action.requestHeaders[0].value, "2");
  }
  await assert.rejects(() => client.setEnabled("false"), /must be true or false/);
  await assert.rejects(() => client.saveRules(null), /expected a list/);
});
