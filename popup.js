const url = chrome.runtime.getURL("index.html");

(async () => {
  const existing = await chrome.tabs.query({ url });
  if (existing[0]) {
    await chrome.tabs.update(existing[0].id, { active: true });
    await chrome.windows.update(existing[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url });
  }
  window.close();
})();
