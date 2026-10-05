import { Profile } from "../model/profile.js";

const ENABLED_KEY = "headerOverridesEnabled";
const RULES_KEY = "headerOverridesRules";

export class ChromeRuleRepository {
  constructor(storageArea) {
    this.storage = storageArea;
  }

  async load() {
    try {
      const stored = await this.storage.get([ENABLED_KEY, RULES_KEY]);
      return Profile.fromStorage({ enabled: stored?.[ENABLED_KEY], rules: stored?.[RULES_KEY] });
    } catch (error) {
      throw new Error(`load header rules: ${error.message}`);
    }
  }

  async saveRules(rules) {
    try {
      await this.storage.set({ [RULES_KEY]: rules });
    } catch (error) {
      throw new Error(`save header rules: ${error.message}`);
    }
  }

  async saveEnabled(enabled) {
    try {
      await this.storage.set({ [ENABLED_KEY]: enabled });
    } catch (error) {
      throw new Error(`save header rules: ${error.message}`);
    }
  }
}
