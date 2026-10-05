const MAX_DOMAINS = 100;

export class SitePattern {
  static parse(text) {
    const errors = [];
    const domains = [];
    const seen = new Set();

    for (const raw of String(text ?? "").split(/[\s,]+/)) {
      if (!raw) continue;
      const parsed = SitePattern.#one(raw);
      if (parsed.error) {
        errors.push(parsed.error);
        continue;
      }
      if (!seen.has(parsed.domain)) {
        seen.add(parsed.domain);
        domains.push(parsed.domain);
      }
    }

    if (domains.length > MAX_DOMAINS) {
      errors.push(`Use ${MAX_DOMAINS} domains or fewer on one rule.`);
    }

    return { domains: domains.slice(0, MAX_DOMAINS), errors };
  }

  static #one(raw) {
    let hostport = raw.replace(/^[a-z][a-z0-9+.-]*:\/\//i, "");
    hostport = hostport.split(/[/?#]/)[0];
    if (hostport.includes("@")) hostport = hostport.split("@").pop();

    if (hostport.startsWith("*.")) {
      const bare = hostport.slice(2);
      return {
        error: `${hostport}: drop the *. ${bare} already includes subdomains.`,
      };
    }
    if (hostport.startsWith("[")) {
      return {
        error: `${raw}: IPv6 is not supported in the site list. Use a URL regex.`,
      };
    }
    if (/:\d+$/.test(hostport)) {
      return {
        error: `${raw}: the site list ignores ports. Use a URL regex to match a port.`,
      };
    }
    if (hostport.includes(":")) {
      return {
        error: `${raw}: the site list cannot match this host. Use a URL regex.`,
      };
    }

    hostport = hostport.replace(/\.$/, "");
    let host;
    try {
      host = new URL(`http://${hostport}`).hostname.toLowerCase();
    } catch {
      return { error: `${raw} is not a domain Chrome can match.` };
    }

    if (!SitePattern.#isHost(host)) {
      return { error: `${raw} is not a domain Chrome can match.` };
    }
    if (host !== "localhost" && !SitePattern.#isIpv4(host) && !host.includes(".")) {
      return {
        error: `${raw}: use a full domain like example.com. A single label would match too broadly.`,
      };
    }
    return { domain: host };
  }

  static #isIpv4(host) {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
    return host.split(".").every((part) => Number(part) <= 255);
  }

  static #isHost(host) {
    if (!host || host.length > 253) return false;
    if (host === "localhost") return true;
    if (SitePattern.#isIpv4(host)) return true;
    return host.split(".").every((label) =>
      /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label),
    );
  }
}
