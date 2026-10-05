import assert from "node:assert/strict";
import { test } from "node:test";
import { ExtensionController } from "../js/headers/app/extension-controller.js";
import { handleExtensionMessage } from "../js/headers/app/extension-messages.js";
import { ExtensionClient } from "../js/headers/app/extension-client.js";
import { RuleCompiler } from "../js/headers/core/rule-compiler.js";
import { ChromeDynamicRuleGateway } from "../js/headers/net/chrome-dynamic-rule-gateway.js";
import { ChromeRuleRepository } from "../js/headers/storage/chrome-rule-repository.js";

function memoryStorage(initial = {}) {
  const data = structuredClone(initial);
  return {
    async get(keys) {
      const result = {};
      for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(data, key)) result[key] = data[key];
      }
      return result;
    },
    async set(values) {
      Object.assign(data, structuredClone(values));
    },
    snapshot() {
      return data;
    },
  };
}

class FakeGateway {
  constructor() {
    this.rules = [];
    this.calls = 0;
    this.regex = new Map();
  }

  async replaceAll(rules) {
    this.calls += 1;
    this.rules = rules;
  }

  async isRegexSupported(regex) {
    return this.regex.get(regex) ?? { isSupported: true };
  }
}

function controllerWith(storage = memoryStorage(), gateway = new FakeGateway()) {
  return {
    storage,
    gateway,
    controller: new ExtensionController({
      repository: new ChromeRuleRepository(storage),
      gateway,
      compiler: new RuleCompiler(),
    }),
  };
}

const debugRule = {
  id: "debug",
  header: "x-debug",
  operation: "set",
  value: "1",
  scope: "all",
};

test("saving rules applies them and keeps a separate enabled flag", async () => {
  const { controller, gateway, storage } = controllerWith();
  const result = await controller.saveRules([debugRule]);
  assert.equal(result.applied, 1);
  assert.equal(result.paused, false);
  assert.equal(gateway.rules[0].action.requestHeaders[0].header, "x-debug");
  assert.equal(gateway.rules[0].priority, 1);

  await controller.setEnabled(false);
  assert.deepEqual(gateway.rules, []);
  assert.equal(storage.snapshot().headerOverridesEnabled, false);
  assert.equal(storage.snapshot().headerOverridesRules.length, 1);

  const loaded = await controller.load();
  assert.equal(loaded.enabled, false);
  assert.equal(loaded.rules[0].headers[0].header, "x-debug");
});

test("a rejected regex does not drop the other rules", async () => {
  const gateway = new FakeGateway();
  gateway.regex.set("(", { isSupported: false, reason: "URL regex has a syntax error." });
  const { controller } = controllerWith(memoryStorage(), gateway);
  const result = await controller.saveRules([
    { id: "bad", header: "x-bad", value: "1", scope: "regex", urlPattern: "(" },
    debugRule,
  ]);
  assert.equal(result.applied, 1);
  assert.equal(result.skipped.length, 1);
  assert.match(result.skipped[0].reason, /syntax/);
  assert.equal(gateway.rules[0].action.requestHeaders[0].header, "x-debug");
  assert.equal(gateway.rules[0].priority, 1);
});

test("a failed update does not wedge the next one", async () => {
  const gateway = new FakeGateway();
  let fail = true;
  gateway.replaceAll = async (rules) => {
    if (fail) {
      fail = false;
      throw new Error("nope");
    }
    gateway.rules = rules;
  };
  const { controller } = controllerWith(memoryStorage(), gateway);
  await assert.rejects(() => controller.saveRules([debugRule]), /nope/);
  const result = await controller.saveRules([debugRule]);
  assert.equal(result.applied, 1);
  assert.equal(gateway.rules.length, 1);
});

test("a later update waits until the in-flight update finishes", async () => {
  const gateway = new FakeGateway();
  const pending = [];
  gateway.replaceAll = (rules) => {
    gateway.calls += 1;
    gateway.rules = rules;
    return new Promise((resolve) => pending.push(resolve));
  };
  const { controller } = controllerWith(memoryStorage(), gateway);
  const first = controller.saveRules([debugRule]);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(gateway.calls, 1);
  const second = controller.setEnabled(false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(gateway.calls, 1);
  pending[0]();
  await first;
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(gateway.calls, 2);
  pending[1]();
  const result = await second;
  assert.equal(result.paused, true);
  assert.deepEqual(gateway.rules, []);
});

test("messages round-trip through the client", async () => {
  const { controller } = controllerWith();
  const client = new ExtensionClient({
    async sendMessage(message) {
      try {
        return { ok: true, result: await handleExtensionMessage(controller, message) };
      } catch (error) {
        return { ok: false, error: error.message };
      }
    },
  });
  await client.saveRules([debugRule]);
  const loaded = await client.load();
  assert.equal(loaded.rules[0].headers[0].value, "1");
  const synced = await client.sync();
  assert.equal(synced.applied, 1);
});

test("unknown messages fail clearly", async () => {
  const { controller } = controllerWith();
  await assert.rejects(() => handleExtensionMessage(controller, { type: "nope" }), /Unknown Header overrides/);
});

test("chrome gateway replaces the whole dynamic ruleset", async () => {
  const dnr = {
    dynamic: [{ id: 4 }, { id: 9 }],
    async getDynamicRules() {
      return this.dynamic;
    },
    async updateDynamicRules({ removeRuleIds, addRules }) {
      this.lastRemove = removeRuleIds;
      this.dynamic = addRules;
    },
    async isRegexSupported() {
      return { isSupported: false, reason: "memoryLimitExceeded" };
    },
  };
  const gateway = new ChromeDynamicRuleGateway(dnr);
  await gateway.replaceAll([{ id: 1, priority: 1, action: {}, condition: {} }]);
  assert.deepEqual(dnr.lastRemove, [4, 9]);
  assert.equal(dnr.dynamic.length, 1);

  const support = await gateway.isRegexSupported("^(");
  assert.equal(support.isSupported, false);
  assert.match(support.reason, /too complex/);
});

test("chrome gateway skips an empty update", async () => {
  let updates = 0;
  const gateway = new ChromeDynamicRuleGateway({
    async getDynamicRules() {
      return [];
    },
    async updateDynamicRules() {
      updates += 1;
    },
  });
  await gateway.replaceAll([]);
  assert.equal(updates, 0);
});

test("a missing background response is reported", async () => {
  const client = new ExtensionClient({
    async sendMessage() {
      return undefined;
    },
  });
  await assert.rejects(() => client.load(), /did not respond/);
});
