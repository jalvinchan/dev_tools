export const ExtensionMessage = Object.freeze({
  load: "headers:load",
  saveRules: "headers:saveRules",
  setEnabled: "headers:setEnabled",
  sync: "headers:sync",
});

export async function handleExtensionMessage(app, message) {
  switch (message?.type) {
    case ExtensionMessage.load:
      return app.load();
    case ExtensionMessage.saveRules:
      return app.saveRules(message.rules);
    case ExtensionMessage.setEnabled:
      return app.setEnabled(message.enabled);
    case ExtensionMessage.sync:
      return app.sync();
    default:
      throw new Error("Unknown Header overrides message.");
  }
}
