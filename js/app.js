window.Tools = {};
window.registerTool = function(name, config) {
    window.Tools[name] = config;
};

document.addEventListener('DOMContentLoaded', () => {
    const tabsContainer = document.querySelector('.tabs');
    const mainContainer = document.querySelector('.main');
    const activeKey = 'web_tools_active_v1';

    // Sort tools if needed, or rely on script load order. 
    // We'll use the order in which they registered or a predefined list if we want specific order.
    // For now, let's just iterate the Tools object.
    const toolNames = ['markdown', 'json', 'regex', 'url', 'base64', 'uuid', 'time', 'diff'];
    
    toolNames.forEach(name => {
        const config = window.Tools[name];
        if (!config) return;

        // Create Tab
        const btn = document.createElement('button');
        btn.className = 'tab';
        btn.dataset.tool = name;
        btn.textContent = config.title || name.charAt(0).toUpperCase() + name.slice(1);
        tabsContainer.appendChild(btn);

        // Create Container
        const div = document.createElement('div');
        div.id = 'tool-' + name;
        div.className = 'tool';
        div.innerHTML = config.template;
        mainContainer.appendChild(div);

        // Init Logic
        if (config.init) {
            config.init();
        }
    });

    const tabs = document.querySelectorAll('.tab');
    const tools = document.querySelectorAll('.tool');

    function showTool(name) {
        tools.forEach(el => { el.style.display = el.id === 'tool-' + name ? 'block' : 'none' });
        tabs.forEach(btn => { btn.classList.toggle('active', btn.dataset.tool === name) });
        try { localStorage.setItem(activeKey, name); } catch (e) { }
    }

    tabs.forEach(btn => { btn.addEventListener('click', () => showTool(btn.dataset.tool)) });

    try {
        const saved = localStorage.getItem(activeKey);
        if (saved && window.Tools[saved]) {
            showTool(saved);
        } else {
            showTool('markdown');
        }
    } catch (e) {
        showTool('markdown');
    }
});
