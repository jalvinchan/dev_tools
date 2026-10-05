import assert from "node:assert/strict";
import { test } from "node:test";
import { HeaderRule } from "../js/headers/model/header-rule.js";
import { SitePattern } from "../js/headers/model/site-pattern.js";

test("parses domains and folds in subdomains by the bare name", () => {
  const parsed = SitePattern.parse(" https://Example.com/path, api.example.com ");
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.domains, ["example.com", "api.example.com"]);
});

test("converts international domains to punycode", () => {
  const parsed = SitePattern.parse("münchen.de");
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.domains[0], "xn--mnchen-3ya.de");
});

test("rejects wildcard prefixes, ports, and single labels", () => {
  const parsed = SitePattern.parse("*.example.com example.com:8443 com");
  assert.equal(parsed.domains.length, 0);
  assert.match(parsed.errors[0], /drop the \*\./);
  assert.match(parsed.errors[1], /ports/);
  assert.match(parsed.errors[2], /full domain/);
});

test("accepts localhost and ipv4", () => {
  const parsed = SitePattern.parse("localhost, 127.0.0.1");
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.domains, ["localhost", "127.0.0.1"]);
});

test("a set rule for a custom header is sendable", () => {
  const rule = HeaderRule.fromInput({
    header: "X-Debug",
    operation: "set",
    value: "1",
    scope: "all",
  });
  assert.deepEqual(rule.problems(), []);
});

test("append is limited to chrome's multi-value headers", () => {
  const custom = HeaderRule.fromInput({
    header: "x-debug",
    operation: "append",
    value: "1",
  });
  assert.match(custom.problems()[0], /Append only works/);

  const language = HeaderRule.fromInput({
    header: "Accept-Language",
    operation: "append",
    value: "fr",
  });
  assert.deepEqual(language.problems(), []);
});

test("blocked headers and broken values are refused", () => {
  assert.match(HeaderRule.fromInput({ header: "Host", value: "evil.test" }).problems()[0], /Host/);
  assert.match(
    HeaderRule.fromInput({ header: "Proxy-Authorization", value: "x" }).problems()[0],
    /Proxy-/,
  );
  assert.match(
    HeaderRule.fromInput({ header: "x-debug", value: "a\nb" }).problems()[0],
    /new line/,
  );
  assert.match(
    HeaderRule.fromInput({
      header: "x-http-method-override",
      value: "TRACE",
    }).problems()[0],
    /TRACE/,
  );
});

test("domain scope requires a usable domain", () => {
  const rule = HeaderRule.fromInput({
    header: "x-debug",
    value: "1",
    scope: "domains",
    domainsText: "",
  });
  assert.match(rule.problems()[0], /Add a domain/);
});

test("remove does not need a value", () => {
  const rule = HeaderRule.fromInput({
    header: "x-debug",
    operation: "remove",
    value: "ignored\n",
    scope: "all",
  });
  assert.deepEqual(rule.problems(), []);
});
