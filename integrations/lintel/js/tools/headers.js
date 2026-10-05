window.registerTool('headers', {
    title: 'Headers',
    template: '<div class="headers-editor" role="region" aria-label="Header modifier">Loading header rules…</div>',
    init: async function() {
        const root = document.querySelector('#tool-headers .headers-editor');
        if (location.protocol !== 'chrome-extension:' || !globalThis.chrome?.runtime?.id) {
            root.textContent = 'Header overrides require the Chrome extension. Load this folder in chrome://extensions, then open Dev Tools from the toolbar.';
            return;
        }
        try {
            const { mountEditor } = await import(chrome.runtime.getURL('integrations/lintel/js/headers/entrypoint/editor.js'));
            await mountEditor(root);
        } catch (error) {
            root.textContent = `Could not load header rules: ${error.message}`;
        }
    }
});
