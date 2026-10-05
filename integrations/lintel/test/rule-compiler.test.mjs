import assert from "node:assert/strict";
import { test } from "node:test";
import { RuleCompiler } from "../js/headers/core/rule-compiler.js";
import { Profile } from "../js/headers/model/profile.js";

function profile(rules, enabled = true) {
  return Profile.fromInput({ enabled, rules });
}

test("compiles an enabled rule into a modifyHeaders action", () => {
  const compiled = new RuleCompiler().compile(profile([
    {
      id: "a",
      header: "X-Debug",
      operation: "set",
      value: "1",
      scope: "domains",
      domainsText: "Example.com",
      traffic: "document-and-fetch",
      methods: ["GET", "POST"],
    },
  ]));

  assert.equal(compiled.skipped.length, 0);
  const rule = compiled.entries[0].rule;
  assert.equal(rule.action.type, "modifyHeaders");
  assert.deepEqual(rule.action.requestHeaders, [
    { header: "x-debug", operation: "set", value: "1" },
  ]);
  assert.deepEqual(rule.condition.requestDomains, ["example.com"]);
  assert.deepEqual(rule.condition.requestMethods, ["get", "post"]);
  assert.ok(rule.condition.resourceTypes.includes("xmlhttprequest"));
  assert.equal(rule.condition.urlFilter, undefined);
});

test("remove omits the value and all-sites uses a star filter", () => {
  const compiled = new RuleCompiler().compile(profile([
    { id: "a", header: "cookie", operation: "remove", value: "nope", scope: "all" },
  ]));
  const modification = compiled.entries[0].rule.action.requestHeaders[0];
  assert.equal(modification.operation, "remove");
  assert.equal(Object.hasOwn(modification, "value"), false);
  assert.equal(compiled.entries[0].rule.condition.urlFilter, "*");
});

test("all requests includes the top-level page load", () => {
  const compiled = new RuleCompiler().compile(profile([
    { id: "a", header: "x-debug", value: "1", scope: "all", traffic: "all" },
  ]));
  const types = compiled.entries[0].rule.condition.resourceTypes;
  assert.ok(types.includes("main_frame"));
  assert.ok(types.includes("xmlhttprequest"));
});

test("disabled rules and a paused profile are not sent", () => {
  const compiler = new RuleCompiler();
  const offRule = compiler.compile(profile([
    { id: "a", enabled: false, header: "x-debug", value: "1", scope: "all" },
    { id: "b", header: "Host", value: "nope", scope: "all" },
  ]));
  assert.equal(offRule.entries.length, 0);
  assert.equal(offRule.skipped.length, 1);
  assert.equal(offRule.skipped[0].id, "b");

  const paused = compiler.compile(profile([
    { id: "a", header: "x-debug", value: "1", scope: "all" },
  ], false));
  assert.deepEqual(paused, { entries: [], skipped: [] });
});

test("one rule can set several headers, and a bad one stays out", () => {
  const compiled = new RuleCompiler().compile(profile([
    {
      id: "a",
      scope: "domains",
      domainsText: "httpbin.org, example.com",
      headers: [
        { header: "x-tt-env", operation: "set", value: "ppe" },
        { header: "Host", operation: "set", value: "nope" },
        { header: "x-debug", operation: "set", value: "1" },
      ],
    },
  ]));
  assert.equal(compiled.entries.length, 1);
  assert.deepEqual(compiled.entries[0].rule.action.requestHeaders, [
    { header: "x-tt-env", operation: "set", value: "ppe" },
    { header: "x-debug", operation: "set", value: "1" },
  ]);
  assert.deepEqual(compiled.entries[0].rule.condition.requestDomains, ["httpbin.org", "example.com"]);
  assert.equal(compiled.skipped.length, 1);
  assert.equal(compiled.skipped[0].header, "Host");
});

test("a blank extra header does not block the ones already filled in", () => {
  const compiled = new RuleCompiler().compile(profile([
    {
      id: "a",
      scope: "all",
      headers: [
        { header: "x-debug", value: "1" },
        { header: "", operation: "set", value: "" },
      ],
    },
  ]));
  assert.equal(compiled.skipped.length, 0);
  assert.equal(compiled.entries[0].rule.action.requestHeaders.length, 1);
});

test("earlier rules get the higher priority", () => {
  const compiler = new RuleCompiler();
  const compiled = compiler.compile(profile([
    { id: "high", header: "x-a", value: "1", scope: "all" },
    { id: "low", header: "x-b", value: "2", scope: "regex", urlPattern: "^https://example\\.com/" },
  ]));
  const numbered = compiler.number(compiled.entries);
  assert.equal(numbered[0].rule.priority, 2);
  assert.equal(numbered[0].rule.id, 1);
  assert.equal(numbered[1].rule.priority, 1);
  assert.equal(numbered[1].rule.condition.regexFilter, "^https://example\\.com/");
  assert.equal(numbered[1].sourceId, "low");
});
