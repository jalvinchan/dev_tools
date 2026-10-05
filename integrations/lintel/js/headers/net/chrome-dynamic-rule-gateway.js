
const REGEX_REASONS = Object.freeze({
  syntaxError: "URL regex has a syntax error.",
  memoryLimitExceeded: "URL regex is too complex for Chrome.",
});

export class ChromeDynamicRuleGateway {
  constructor(declarativeNetRequest) {
    this.dnr = declarativeNetRequest;
  }

  async replaceAll(rules) {
    let existing;
    try {
      existing = await this.dnr.getDynamicRules();
    } catch (error) {
      throw new Error(`read dynamic header rules: ${error.message}`);
    }

    const removeRuleIds = existing.map((rule) => rule.id);
    if (removeRuleIds.length === 0 && rules.length === 0) return;

    try {
      await this.dnr.updateDynamicRules({ removeRuleIds, addRules: rules });
    } catch (error) {
      throw new Error(`update dynamic header rules: ${error.message}`);
    }
  }

  async isRegexSupported(regex) {
    try {
      const result = await this.dnr.isRegexSupported({
        regex,
        isCaseSensitive: false,
        requireCapturing: false,
      });
      if (result.isSupported) return { isSupported: true };
      return {
        isSupported: false,
        reason: REGEX_REASONS[result.reason] ?? "Chrome rejected this URL regex.",
      };
    } catch (error) {
      return { isSupported: false, reason: error.message };
    }
  }
}
