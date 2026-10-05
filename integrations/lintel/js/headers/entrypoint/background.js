import { createExtensionApp } from "../app/extension-app.js";
import { ExtensionMessage, handleExtensionMessage } from "../app/extension-messages.js";

const app = createExtensionApp(globalThis.chrome);

function report(error) {
  console.error(error);
}

globalThis.chrome.runtime.onInstalled.addListener(() => {
  app.sync().catch(report);
});

globalThis.chrome.runtime.onStartup.addListener(() => {
  app.sync().catch(report);
});

globalThis.chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!Object.values(ExtensionMessage).includes(message?.type)) return false;
  handleExtensionMessage(app, message).then(
    (result) => sendResponse({ ok: true, result }),
    (error) => {
      report(error);
      sendResponse({ ok: false, error: error.message });
    },
  );
  return true;
});
