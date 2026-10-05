import { SitePattern } from "../model/site-pattern.js";
import { TRAFFIC_RESOURCE_TYPES } from "../model/rule-kinds.js";

export class RuleCompiler {
  compile(profile) {
    if (!profile.enabled) return { entries: [], skipped: [] };

    const entries = [];
    const skipped = [];
    for (const rule of profile.rules) {
      if (!rule.enabled) continue;
      const scope = rule.scopeProblems();
      if (scope.length) {
        skipped.push({ id: rule.id, header: rule.headers[0]?.header ?? "", reason: scope[0] });
        continue;
      }
      const entry = this.#entry(rule, skipped);
      if (entry) entries.push(entry);
    }
    return { entries, skipped };
  }

  number(entries) {
    const count = entries.length;
    return entries.map((entry, index) => ({
      ...entry,
      rule: {
        id: index + 1,
        priority: count - index,
        action: entry.rule.action,
        condition: entry.rule.condition,
      },
    }));
  }

  #entry(rule, skipped) {
    const issues = rule.headerIssues();
    const modifications = [];
    rule.headers.forEach((change, index) => {
      if (change.operation === "set" && !change.header && !change.value) return;
      if (issues[index]) {
        skipped.push({ id: rule.id, header: change.header, reason: issues[index] });
        return;
      }
      const modification = {
        header: change.header.toLowerCase(),
        operation: change.operation,
      };
      if (change.operation !== "remove") modification.value = change.value;
      modifications.push(modification);
    });
    if (modifications.length === 0) return null;

    const condition = {};
    if (rule.scope === "all") condition.urlFilter = "*";
    if (rule.scope === "domains") {
      condition.requestDomains = SitePattern.parse(rule.domainsText).domains;
    }
    if (rule.scope === "regex") {
      condition.regexFilter = rule.urlPattern;
      condition.isUrlFilterCaseSensitive = false;
    }

    const resourceTypes = TRAFFIC_RESOURCE_TYPES[rule.traffic];
    if (resourceTypes) condition.resourceTypes = [...resourceTypes];
    if (rule.methods.length) {
      condition.requestMethods = [...new Set(rule.methods.map((method) => method.toLowerCase()))];
    }

    return {
      sourceId: rule.id,
      header: modifications.map((modification) => modification.header).join(", "),
      rule: {
        action: {
          type: "modifyHeaders",
          requestHeaders: modifications,
        },
        condition,
      },
    };
  }
}
