export const OPERATIONS = Object.freeze(["set", "append", "remove"]);

export const SCOPES = Object.freeze(["all", "domains", "regex"]);

export const TRAFFIC_KINDS = Object.freeze([
  "all",
  "document",
  "document-and-fetch",
]);

// Chrome skips main_frame when a rule omits resourceTypes, so "all" lists every type.
export const TRAFFIC_RESOURCE_TYPES = Object.freeze({
  all: Object.freeze([
    "main_frame",
    "sub_frame",
    "stylesheet",
    "script",
    "image",
    "font",
    "object",
    "xmlhttprequest",
    "ping",
    "csp_report",
    "media",
    "websocket",
    "webtransport",
    "webbundle",
    "other",
  ]),
  document: Object.freeze(["main_frame", "sub_frame"]),
  "document-and-fetch": Object.freeze([
    "main_frame",
    "sub_frame",
    "xmlhttprequest",
    "websocket",
    "webtransport",
  ]),
});

export const REQUEST_METHODS = Object.freeze([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);
