window.registerTool('markdown', {
    title: 'Markdown',
    template: `
  <div class="markdown-body" style="padding:16px">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
      <button class="btn" id="md-clear">Clear</button>
      <button class="btn" id="md-copy">Copy</button>
      <button class="btn" id="md-sample">Load Sample</button>
    </div>
  </div>
  <div class="container md-container">
    <div class="pane">
      <textarea id="md-input" class="input" placeholder="Paste Markdown here"></textarea>
    </div>
    <div id="md-divider" class="divider" role="separator" aria-orientation="vertical" aria-label="Resize panes"></div>
    <div class="pane preview">
      <div id="md-output" class="markdown-body"></div>
      <div id="md-empty" class="markdown-body" style="display:none">Paste Markdown on the left to render here.</div>
      <div style="height:24px"></div>
      <div class="markdown-body" style="opacity:.6">Rendered with Marked + DOMPurify + Highlight.js</div>
      <div style="height:24px"></div>
      <div class="markdown-body" style="opacity:.6">This page stores your input locally in the browser.</div>
      <div style="height:24px"></div>
    </div>
  </div>
    `,
    init: function() {
        const mdInput = document.getElementById('md-input');
        const mdOutput = document.getElementById('md-output');
        const mdEmpty = document.getElementById('md-empty');
        const mdContainer = document.querySelector('.md-container');
        const mdDivider = document.getElementById('md-divider');
        const mdClear = document.getElementById('md-clear');
        const mdCopy = document.getElementById('md-copy');
        const mdSample = document.getElementById('md-sample');
        const key = 'markdown_renderer_input_v1';
        const widthKey = 'markdown_renderer_left_px_v1';

        function render(value) {
            if (!value) {
                mdOutput.style.display = 'none';
                mdEmpty.style.display = 'block';
                mdOutput.innerHTML = '';
                return;
            }
            mdEmpty.style.display = 'none';
            mdOutput.style.display = 'block';
            marked.setOptions({ gfm: true, breaks: true });
            const html = marked.parse(value);
            const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
            mdOutput.innerHTML = clean;
            hljs.highlightAll();
        }

        function save() {
            try { localStorage.setItem(key, mdInput.value); } catch (e) { }
        }

        function load() {
            try {
                const v = localStorage.getItem(key);
                if (v) { mdInput.value = v; render(v); }
                const w = localStorage.getItem(widthKey);
                if (w) { mdContainer.style.setProperty('--left', w + 'px'); }
            } catch (e) { }
        }

        mdInput.addEventListener('input', () => { render(mdInput.value); save(); });
        mdClear.addEventListener('click', () => { mdInput.value = ''; render(''); save(); });
        mdCopy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(mdInput.value); } catch (e) { } });
        mdSample.addEventListener('click', () => {
            const sample = "# Markdown Preview\\n\\nPaste or type Markdown in the left pane.\\n\\n## Features\\n\\n- GitHub-flavored Markdown\\n- Sanitized HTML output\\n- Syntax highlighting\\n\\n### Code\\n\\n```javascript\\nfunction greet(name){\\n  console.log(`Hello, ${name}`);\\n}\\ngreet('world');\\n```\\n\\n> Blockquotes and lists work too.\\n\\n1. One\\n2. Two\\n3. Three\\n";
            mdInput.value = sample; render(sample); save();
        });

        let dragging = false;
        function onMove(e) {
            const rect = mdContainer.getBoundingClientRect();
            let left = e.clientX - rect.left;
            const min = 240;
            const max = rect.width - 240;
            if (left < min) left = min; if (left > max) left = max;
            mdContainer.style.setProperty('--left', left + 'px');
            try { localStorage.setItem(widthKey, left); } catch (err) { }
        }
        function onUp() {
            dragging = false;
            mdDivider.classList.remove('active');
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
        }
        mdDivider.addEventListener('mousedown', () => {
            dragging = true;
            mdDivider.classList.add('active');
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        });
        mdDivider.addEventListener('dblclick', () => {
            const rect = mdContainer.getBoundingClientRect();
            const left = Math.round(rect.width / 2);
            mdContainer.style.setProperty('--left', left + 'px');
            try { localStorage.setItem(widthKey, left); } catch (err) { }
        });
        load();
    }
});
