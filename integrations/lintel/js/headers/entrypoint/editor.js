import { ExtensionClient } from "../app/extension-client.js";
import { describeApplyResult } from "../presentation/apply-status.js";
import { EditorView } from "../presentation/editor-view.js";

export async function mountEditor(root) {
  const client = new ExtensionClient(globalThis.chrome.runtime);
  const view = new EditorView(root);
  const profile = await client.load();
  view.render(profile);
  view.bind({
    onRules: async () => {
      try {
        view.setStatus(describeApplyResult(await client.saveRules(view.readRules())));
      } catch (error) {
        view.setStatus({ message: error.message, tone: "error" });
      }
    },
    onEnabled: async (enabled) => {
      try {
        view.setStatus(describeApplyResult(await client.setEnabled(enabled)));
      } catch (error) {
        view.setStatus({ message: error.message, tone: "error" });
      }
    },
  });
  globalThis.chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local" || !Object.hasOwn(changes, "headerOverridesEnabled")) return;
    view.setEnabled(changes.headerOverridesEnabled.newValue !== false);
  });
  try {
    view.setStatus(describeApplyResult(await client.sync()));
  } catch (error) {
    view.setStatus({ message: error.message, tone: "error" });
  }
}
