import { HeaderConstraints } from "./header-constraints.js";
import {
  OPERATIONS,
  REQUEST_METHODS,
  SCOPES,
  TRAFFIC_KINDS,
} from "./rule-kinds.js";
import { SitePattern } from "./site-pattern.js";

function headerChange(source = {}) {
  const item = source && typeof source === "object" ? source : {};
  return {
    operation: typeof item.operation === "string" ? item.operation : "set",
    header: typeof item.header === "string" ? item.header.trim() : "",
    value: typeof item.value === "string" ? item.value : "",
  };
}

export class HeaderRule {
  constructor(props) {
    this.id = props.id;
    this.enabled = props.enabled;
    this.label = props.label;
    this.headers = props.headers;
    this.scope = props.scope;
    this.domainsText = props.domainsText;
    this.urlPattern = props.urlPattern;
    this.traffic = props.traffic;
    this.methods = props.methods;
  }

  static fromInput(input = {}) {
    const source = input && typeof input === "object" ? input : {};
    const listed = Array.isArray(source.headers) ? source.headers.map(headerChange) : [];
    const headers = listed.length
      ? listed
      : [headerChange({ operation: source.operation, header: source.header, value: source.value })];
    return new HeaderRule({
      id: typeof source.id === "string" && source.id ? source.id : crypto.randomUUID(),
      enabled: source.enabled !== false,
      label: typeof source.label === "string" ? source.label.trim() : "",
      headers,
      scope: typeof source.scope === "string" ? source.scope : "all",
      domainsText: typeof source.domainsText === "string" ? source.domainsText : "",
      urlPattern: typeof source.urlPattern === "string" ? source.urlPattern : "",
      traffic: typeof source.traffic === "string" ? source.traffic : "all",
      methods: Array.isArray(source.methods)
        ? source.methods
            .filter((method) => typeof method === "string")
            .map((method) => method.toLowerCase())
        : [],
    });
  }

  scopeProblems() {
    const found = [];
    if (!SCOPES.includes(this.scope)) {
      found.push("Choose where this rule applies.");
    } else if (this.scope === "domains") {
      const parsed = SitePattern.parse(this.domainsText);
      if (parsed.errors.length) found.push(...parsed.errors);
      else if (parsed.domains.length === 0) {
        found.push("Add a domain, or switch this rule to all sites.");
      }
    } else if (this.scope === "regex") {
      if (!this.urlPattern) found.push("Add a URL regex, or switch this rule to all sites.");
      else if (!/^[\u0000-\u007f]*$/.test(this.urlPattern)) {
        found.push("URL regex must use ASCII characters.");
      } else if (this.urlPattern.length > 2000) {
        found.push("URL regex is longer than Chrome allows.");
      }
    }

    if (!TRAFFIC_KINDS.includes(this.traffic)) {
      found.push("Choose which requests this rule covers.");
    }

    for (const method of this.methods) {
      if (!REQUEST_METHODS.includes(method)) {
        found.push(`Chrome rules cannot match the ${method} method here.`);
      }
    }

    if (this.label.length > 80) found.push("Label must be 80 characters or fewer.");
    return found;
  }

  headerIssues() {
    const seen = new Set();
    return this.headers.map((change) => {
      if (change.operation === "set" && !change.header && !change.value) return null;
      if (!OPERATIONS.includes(change.operation)) return "Choose set, append, or remove.";
      const constraint = HeaderConstraints.problem(change);
      if (constraint) return constraint;
      const name = change.header.trim().toLowerCase();
      if (seen.has(name)) return "This header is already in this rule.";
      seen.add(name);
      return null;
    });
  }

  problems() {
    return [...this.scopeProblems(), ...this.headerIssues().filter(Boolean)];
  }

  toJSON() {
    return {
      id: this.id,
      enabled: this.enabled,
      label: this.label,
      headers: this.headers.map((change) => ({ ...change })),
      scope: this.scope,
      domainsText: this.domainsText,
      urlPattern: this.urlPattern,
      traffic: this.traffic,
      methods: [...this.methods],
    };
  }
}
