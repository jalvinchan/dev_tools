const TOKEN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/;

const BLOCKED = Object.freeze({
  "content-length": "Chrome sets Content-Length from the request body.",
  host: "Chrome sets Host from the URL.",
  trailer: "Chrome does not allow extensions to change Trailer.",
  te: "Chrome does not allow extensions to change TE.",
  upgrade: "Chrome does not allow extensions to change Upgrade.",
  cookie2: "Cookie2 is obsolete, and Chrome blocks it.",
  "keep-alive": "Chrome manages Keep-Alive itself.",
  "transfer-encoding": "Chrome manages Transfer-Encoding itself.",
  "set-cookie": "Set-Cookie is a response header. This tool changes request headers.",
  "available-dictionary": "Chrome manages Available-Dictionary itself.",
  connection: "Chrome manages Connection itself.",
});

// Chrome's kDNRRequestHeaderAppendAllowList. Append on anything else is rejected
// and would fail the whole ruleset update.
const APPENDABLE = new Set([
  "accept",
  "accept-encoding",
  "accept-language",
  "access-control-request-headers",
  "cache-control",
  "connection",
  "content-language",
  "cookie",
  "forwarded",
  "if-match",
  "if-none-match",
  "keep-alive",
  "range",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "user-agent",
  "via",
  "want-digest",
  "x-forwarded-for",
]);

const METHOD_OVERRIDE = new Set([
  "x-http-method",
  "x-http-method-override",
  "x-method-override",
]);

const FORBIDDEN_OVERRIDE_METHODS = new Set(["connect", "trace", "track"]);

export class HeaderConstraints {
  static problem(rule) {
    const name = rule.header.trim().toLowerCase();
    if (!name) return "Name the header.";
    if (name.length > 256) return "Header name is too long.";
    if (!TOKEN.test(rule.header.trim())) {
      return "Header name contains a character Chrome will reject.";
    }
    if (BLOCKED[name]) return BLOCKED[name];
    if (name.startsWith("proxy-")) {
      return "Proxy- headers are reserved for the proxy.";
    }
    if (rule.operation === "append" && !APPENDABLE.has(name)) {
      return "Append only works for headers that already take multiple values, such as accept-language, cookie, and user-agent. Use Set for a custom header.";
    }
    if (rule.operation !== "set" && rule.operation !== "append") return null;

    if (
      rule.value.includes("\0") ||
      rule.value.includes("\r") ||
      rule.value.includes("\n")
    ) {
      return "Header value cannot contain a new line.";
    }
    if (rule.value.length > 8192) return "Header value is longer than 8 KB.";

    if (name === "accept-encoding" && HeaderConstraints.#blocksEncoding(rule.value)) {
      return "Chrome blocks Accept-Encoding values that negotiate * or shared-dictionary encodings.";
    }
    if (METHOD_OVERRIDE.has(name) && HeaderConstraints.#blocksMethodOverride(rule.value)) {
      return "Chrome blocks CONNECT, TRACE, and TRACK in method-override headers.";
    }
    return null;
  }

  static #blocksEncoding(value) {
    return value
      .toLowerCase()
      .split(",")
      .some((part) => {
        const coding = part.trim().split(";")[0].trim();
        return coding === "*" || coding === "dcb" || coding === "dcz";
      });
  }

  static #blocksMethodOverride(value) {
    return value
      .split(",")
      .some((part) => FORBIDDEN_OVERRIDE_METHODS.has(part.trim().toLowerCase()));
  }
}
