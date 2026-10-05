import { HeaderRule } from "../model/header-rule.js";
import { REQUEST_METHODS } from "../model/rule-kinds.js";

const OPERATIONS = [
  { value: "set", label: "Set" },
  { value: "append", label: "Append" },
  { value: "remove", label: "Remove" },
];

const SCOPES = [
  { value: "all", label: "All sites" },
  { value: "domains", label: "Specific sites" },
  { value: "regex", label: "URL regex" },
];

const TRAFFIC = [
  {
    value: "all",
    label: "Every request",
    hint: "The page, plus its images, scripts, and API calls.",
  },
  {
    value: "document",
    label: "Page loads only",
    hint: "The page you open, including iframes. Images and API calls are left alone.",
  },
  {
    value: "document-and-fetch",
    label: "Page loads and API calls",
    hint: "The page plus fetch and XHR. Images, scripts, and stylesheets are left alone.",
  },
];

export class EditorView {
  constructor(root) {
    this.root = root;
    this.onRules = () => {};
    this.onEnabled = () => {};
    this.status = null;
    this.rulesTimer = 0;
  }

  bind(handlers) {
    this.onEnabled = handlers.onEnabled ?? (() => {});
    const notify = handlers.onRules ?? (() => {});
    this.onRules = () => {
      clearTimeout(this.rulesTimer);
      this.rulesTimer = setTimeout(() => notify(), 200);
    };
  }

  render(profile) {
    const previous = this.status
      ? { message: this.status.textContent, tone: this.status.dataset.tone || "ok" }
      : null;
    const rules = profile.rules ?? [];

    const master = h("input", { id: "master", type: "checkbox" });
    master.checked = profile.enabled !== false;
    master.addEventListener("change", () => this.onEnabled(master.checked));

    this.status = h("p", { class: "status", role: "status", "aria-live": "polite" });
    const list = h("div", { class: "rules" });
    if (rules.length > 1) {
      list.append(h("p", { class: "hint priority-note" }, "Higher in the list wins when two rules change the same header."));
    }
    if (rules.length === 0) {
      list.append(h("p", { class: "empty" }, "Add a rule for the sites you want to change. Nothing is sent until you do."));
    }
    rules.forEach((rule, index) => list.append(this.#card(rule, index, rules.length)));

    const add = h("button", { class: "primary", type: "button" }, "Add rule");
    add.addEventListener("click", () => this.#add());

    this.root.replaceChildren(h("div", { class: "page" },
      h("header", { class: "mast" },
        h("div", { class: "brand" },
          h("div", {},
            h("h1", {}, "Header Modifier"),
            h("p", { class: "lede" }, "Request headers you set yourself, for the sites you choose."),
          ),
        ),
        h("label", { class: "master" }, "Apply overrides", h("span", { class: "switch" }, master, h("span", { class: "track" }))),
      ),
      this.status,
      list,
      h("div", { class: "page-actions" }, add),
      h("p", { class: "hint footnote" }, "Rules save automatically in this browser profile and are never sent anywhere. Chrome refuses Host, Content-Length, Connection, and Proxy-* headers. Check the result in Chrome DevTools, on the request headers."),
    ));

    if (previous?.message) this.setStatus(previous);
  }

  readRules() {
    return [...this.root.querySelectorAll(".rule")].map((card) => this.#readCard(card));
  }

  setEnabled(enabled) {
    const input = this.root.querySelector("#master");
    if (input) input.checked = Boolean(enabled);
  }

  setStatus(status) {
    if (!this.status || !status?.message) return;
    this.status.textContent = status.message;
    this.status.dataset.tone = status.tone || "ok";
  }

  #add() {
    const rules = this.readRules();
    rules.push(HeaderRule.fromInput({ scope: "domains" }).toJSON());
    this.render({ enabled: this.#enabled(), rules });
    this.root.querySelector(".rule:last-of-type .domains")?.focus();
    this.onRules();
  }

  #remove(id) {
    const rules = this.readRules().filter((rule) => rule.id !== id);
    this.render({ enabled: this.#enabled(), rules });
    this.onRules();
  }

  #move(id, delta) {
    const rules = this.readRules();
    const index = rules.findIndex((rule) => rule.id === id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= rules.length) return;
    const [rule] = rules.splice(index, 1);
    rules.splice(target, 0, rule);
    this.render({ enabled: this.#enabled(), rules });
    this.onRules();
  }

  #enabled() {
    return Boolean(this.root.querySelector("#master")?.checked);
  }

  #addHeader(id) {
    const rules = this.readRules();
    const rule = rules.find((item) => item.id === id);
    if (!rule) return;
    rule.headers.push({ operation: "set", header: "", value: "" });
    this.render({ enabled: this.#enabled(), rules });
    this.root.querySelector(`[data-id="${CSS.escape(id)}"] .header-row:last-of-type .header-name`)?.focus();
    this.onRules();
  }

  #removeHeader(id, index) {
    const rules = this.readRules();
    const rule = rules.find((item) => item.id === id);
    if (!rule || rule.headers.length <= 1) return;
    rule.headers.splice(index, 1);
    this.render({ enabled: this.#enabled(), rules });
    this.onRules();
  }

  #card(rule, index, total) {
    const enabled = h("input", {
      class: "rule-enabled",
      type: "checkbox",
      title: "Turn this rule on or off",
      "aria-label": "Turn this rule on or off",
    });
    enabled.checked = rule.enabled !== false;

    const headers = rule.headers?.length ? rule.headers : [{ operation: "set", header: "", value: "" }];
    const scope = selectControl("scope", SCOPES, rule.scope || "all");
    const traffic = selectControl("traffic", TRAFFIC, rule.traffic || "all");

    const higher = h("button", {
      class: "quiet higher",
      type: "button",
      title: "Wins over the rules below",
    }, "Higher");
    const lower = h("button", {
      class: "quiet lower",
      type: "button",
      title: "Yields to the rules above",
    }, "Lower");
    higher.disabled = index === 0;
    lower.disabled = index === total - 1;
    const remove = h("button", { class: "quiet danger", type: "button" }, "Delete");

    const card = h("article", { class: "rule" },
      h("div", { class: "rule-top" },
        h("span", { class: "rank" }, String(index + 1)),
        h("span", { class: "switch" }, enabled, h("span", { class: "track" })),
        h("input", {
          class: "label-input",
          type: "text",
          placeholder: "Label",
          value: rule.label || "",
          maxlength: "80",
          autocomplete: "off",
        }),
        h("div", { class: "rule-actions" }, higher, lower, remove),
      ),
      h("div", { class: "header-rows" }, ...headers.map((change) => headerRow(change, headers.length))),
      h("div", {}, h("button", { class: "quiet add-header", type: "button" }, "Add header")),
      h("p", { class: "hint append-hint", hidden: true }, "Chrome can append only to list headers such as accept-language, cookie, and user-agent."),
      h("div", { class: "scope-row" },
        h("label", { class: "field" }, "Where", scope),
        h("label", { class: "field domains-field" }, "Sites",
          h("input", {
            class: "domains mono",
            type: "text",
            placeholder: "example.com, api.example.com",
            value: rule.domainsText || "",
            spellcheck: "false",
            autocomplete: "off",
          }),
          h("span", { class: "hint" }, "Several sites, separated by commas or spaces. Subdomains are included. Ports are not."),
        ),
        h("label", { class: "field regex-field" }, "URL regex",
          h("input", {
            class: "regex mono",
            type: "text",
            placeholder: "^https://api\\.example\\.com/",
            value: rule.urlPattern || "",
            spellcheck: "false",
            autocomplete: "off",
          }),
          h("span", { class: "hint" }, "RE2 syntax, matched against the full URL."),
        ),
      ),
      h("div", { class: "extra-row" },
        h("label", { class: "field" }, "Requests", traffic, h("span", { class: "hint traffic-hint" })),
        h("div", { class: "field" }, "Methods", chips(rule.methods || []), h("span", { class: "hint" }, "Leave unchecked to match every method.")),
      ),
      h("p", { class: "rule-error" }),
    );
    card.dataset.id = rule.id;

    higher.addEventListener("click", () => this.#move(rule.id, -1));
    lower.addEventListener("click", () => this.#move(rule.id, 1));
    remove.addEventListener("click", () => this.#remove(rule.id));
    card.querySelector(".add-header").addEventListener("click", () => this.#addHeader(rule.id));
    card.querySelectorAll(".remove-header").forEach((button, headerIndex) => {
      button.addEventListener("click", () => this.#removeHeader(rule.id, headerIndex));
    });
    card.addEventListener("input", () => {
      this.#refresh(card);
      this.onRules();
    });
    card.addEventListener("change", () => {
      this.#refresh(card);
      this.onRules();
    });
    this.#refresh(card);
    return card;
  }

  #refresh(card) {
    const rule = HeaderRule.fromInput(this.#readCard(card));
    const issues = rule.headerIssues();
    card.querySelectorAll(".header-row").forEach((row, index) => {
      const change = rule.headers[index];
      row.querySelector(".value-field").hidden = change.operation === "remove";
      row.querySelector(".value").placeholder = change.operation === "append" ? "value to add" : "value";
      row.querySelector(".row-error").textContent = issues[index] ?? "";
    });
    const scope = rule.scopeProblems();
    card.querySelector(".rule-error").textContent = scope[0] ?? "";
    card.classList.toggle("has-error", scope.length > 0 || issues.some(Boolean));
    card.classList.toggle("is-off", !card.querySelector(".rule-enabled").checked);
    card.querySelector(".append-hint").hidden = !rule.headers.some((change) => change.operation === "append");
    card.querySelector(".domains-field").hidden = rule.scope !== "domains";
    card.querySelector(".regex-field").hidden = rule.scope !== "regex";
    const traffic = TRAFFIC.find((item) => item.value === rule.traffic);
    card.querySelector(".traffic-hint").textContent = traffic?.hint ?? "";
  }

  #readCard(card) {
    return {
      id: card.dataset.id,
      enabled: card.querySelector(".rule-enabled").checked,
      label: card.querySelector(".label-input").value,
      headers: [...card.querySelectorAll(".header-row")].map((row) => ({
        header: row.querySelector(".header-name").value,
        operation: row.querySelector(".operation").value,
        value: row.querySelector(".value").value,
      })),
      scope: card.querySelector(".scope").value,
      domainsText: card.querySelector(".domains").value,
      urlPattern: card.querySelector(".regex").value,
      traffic: card.querySelector(".traffic").value,
      methods: [...card.querySelectorAll(".method:checked")].map((input) => input.value),
    };
  }
}

function headerRow(change, count) {
  const operation = selectControl("operation", OPERATIONS, change.operation || "set");
  const remove = h("button", { class: "quiet danger remove-header", type: "button" }, "Remove");
  remove.disabled = count === 1;
  return h("div", { class: "header-row" },
    h("label", { class: "field" }, "Header", h("input", {
      class: "header-name mono",
      type: "text",
      placeholder: "x-debug",
      value: change.header || "",
      spellcheck: "false",
      autocapitalize: "off",
      autocomplete: "off",
    })),
    h("label", { class: "field" }, "Operation", operation),
    h("label", { class: "field value-field" }, "Value", h("input", {
      class: "value mono",
      type: "text",
      placeholder: "value",
      value: change.value || "",
      spellcheck: "false",
      autocomplete: "off",
    })),
    remove,
    h("p", { class: "row-error" }),
  );
}

function selectControl(className, items, current) {
  const known = items.some((item) => item.value === current);
  const choices = known ? items : [{ value: current, label: current }, ...items];
  const control = h("select", { class: className }, ...choices.map((item) =>
    h("option", { value: item.value }, item.label),
  ));
  control.value = current;
  return control;
}

function chips(selected) {
  const chosen = new Set(selected);
  return h("div", { class: "chips" }, ...REQUEST_METHODS.map((method) => {
    const input = h("input", { class: "method", type: "checkbox", value: method });
    input.checked = chosen.has(method);
    return h("label", {}, input, method);
  }));
}

function h(tag, attrs, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (typeof value === "boolean" && key in node) node[key] = value;
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}
