import { ExtensionMessage } from "./extension-messages.js";

export class ExtensionClient {
  constructor(runtime) {
    this.runtime = runtime;
  }

  load() {
    return this.#send({ type: ExtensionMessage.load });
  }

  saveRules(rules) {
    return this.#send({ type: ExtensionMessage.saveRules, rules });
  }

  setEnabled(enabled) {
    return this.#send({ type: ExtensionMessage.setEnabled, enabled });
  }

  sync() {
    return this.#send({ type: ExtensionMessage.sync });
  }

  async #send(message) {
    let response;
    try {
      response = await this.runtime.sendMessage(message);
    } catch (error) {
      throw new Error(`Could not reach the header overrides background: ${error.message}`);
    }
    if (!response?.ok) {
      throw new Error(response?.error || "The header overrides background did not respond.");
    }
    return response.result;
  }
}
