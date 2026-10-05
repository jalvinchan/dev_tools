import { RuleCompiler } from "../core/rule-compiler.js";
import { ChromeDynamicRuleGateway } from "../net/chrome-dynamic-rule-gateway.js";
import { ChromeRuleRepository } from "../storage/chrome-rule-repository.js";
import { ExtensionController } from "./extension-controller.js";

export function createExtensionApp(chrome) {
  if (!chrome?.storage?.local || !chrome?.declarativeNetRequest) {
    throw new Error("Header overrides need the Chrome extension APIs.");
  }
  return new ExtensionController({
    repository: new ChromeRuleRepository(chrome.storage.local),
    gateway: new ChromeDynamicRuleGateway(chrome.declarativeNetRequest),
    compiler: new RuleCompiler(),
  });
}
