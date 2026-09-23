const TOOLS_PATH = "index.html";

async function openTools() {
  const url = chrome.runtime.getURL(TOOLS_PATH);
  const existing = await chrome.tabs.query({ url });
  if (existing[0]) {
    await chrome.tabs.update(existing[0].id, { active: true });
    await chrome.windows.update(existing[0].windowId, { focused: true });
    return;
  }
  await chrome.tabs.create({ url });
}

chrome.action.onClicked.addListener(openTools);
