import { HeaderRule } from "../model/header-rule.js";

export class ExtensionController {
  constructor({ repository, gateway, compiler }) {
    this.repository = repository;
    this.gateway = gateway;
    this.compiler = compiler;
    this.chain = Promise.resolve();
  }

  load() {
    return this.#enqueue(async () => {
      const profile = await this.repository.load();
      return profile.toJSON();
    });
  }

  saveRules(rules) {
    return this.#enqueue(async () => {
      if (!Array.isArray(rules)) {
        throw new Error("save header rules: expected a list of rules");
      }
      const normalized = rules.map((rule) => HeaderRule.fromInput(rule).toJSON());
      await this.repository.saveRules(normalized);
      return this.#apply();
    });
  }

  setEnabled(enabled) {
    return this.#enqueue(async () => {
      if (typeof enabled !== "boolean") {
        throw new Error("save header rules: enabled must be true or false");
      }
      await this.repository.saveEnabled(enabled);
      return this.#apply();
    });
  }

  sync() {
    return this.#enqueue(() => this.#apply());
  }

  #enqueue(task) {
    const run = this.chain.then(() => task());
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async #apply() {
    const profile = await this.repository.load();
    if (!profile.enabled) {
      await this.gateway.replaceAll([]);
      return { applied: 0, skipped: [], paused: true };
    }

    const compiled = this.compiler.compile(profile);
    const kept = [];
    const skipped = [...compiled.skipped];
    for (const entry of compiled.entries) {
      const regex = entry.rule.condition.regexFilter;
      if (!regex) {
        kept.push(entry);
        continue;
      }
      const support = await this.gateway.isRegexSupported(regex);
      if (!support.isSupported) {
        skipped.push({
          id: entry.sourceId,
          header: entry.header,
          reason: support.reason || "Chrome rejected this URL regex.",
        });
        continue;
      }
      kept.push(entry);
    }

    const numbered = this.compiler.number(kept);
    await this.gateway.replaceAll(numbered.map((entry) => entry.rule));
    return { applied: numbered.length, skipped, paused: false };
  }
}
