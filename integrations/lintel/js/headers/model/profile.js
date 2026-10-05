import { HeaderRule } from "./header-rule.js";

export class Profile {
  constructor(enabled, rules) {
    this.enabled = enabled;
    this.rules = rules;
  }

  static fromInput(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const enabled = source.enabled !== false;
    const rules = Array.isArray(source.rules)
      ? source.rules.map((rule) => HeaderRule.fromInput(rule))
      : [];
    return new Profile(enabled, Profile.#uniqueIds(rules));
  }

  static fromStorage(stored = {}) {
    return Profile.fromInput({
      enabled: stored?.enabled !== false,
      rules: Array.isArray(stored?.rules) ? stored.rules : [],
    });
  }

  static #uniqueIds(rules) {
    const seen = new Set();
    return rules.map((rule) => {
      if (!seen.has(rule.id)) {
        seen.add(rule.id);
        return rule;
      }
      return HeaderRule.fromInput({ ...rule.toJSON(), id: crypto.randomUUID() });
    });
  }

  toJSON() {
    return {
      enabled: this.enabled,
      rules: this.rules.map((rule) => rule.toJSON()),
    };
  }
}
