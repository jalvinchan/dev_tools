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
      <div class="markdown-body" style="opacity:.6">Rendered with Marked + DOMPurify + Highlight.js + Mermaid</div>
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
        let renderToken = 0;
        let diagramChain = Promise.resolve();

        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({
                startOnLoad: false,
                securityLevel: 'strict',
                suppressErrorRendering: true
            });
        }

        function sanitizeSvg(svg) {
            return DOMPurify.sanitize(svg, {
                USE_PROFILES: { svg: true, svgFilters: true },
                ADD_TAGS: ['foreignObject', 'style']
            });
        }

        function showDiagramError(el, err) {
            const pre = document.createElement('pre');
            pre.className = 'mermaid-error';
            pre.textContent = err && err.message ? err.message : String(err || 'Invalid Mermaid diagram');
            el.replaceWith(pre);
        }

        function takeDiagrams() {
            const slots = [];
            mdOutput.querySelectorAll('pre > code.language-mermaid').forEach((code, index) => {
                const slot = document.createElement('div');
                slot.className = 'mermaid-diagram';
                slot.setAttribute('role', 'img');
                slot.setAttribute('aria-label', 'Mermaid diagram');
                code.parentElement.replaceWith(slot);
                slots.push({ el: slot, source: code.textContent.replace(/\n$/, ''), index: index });
            });
            return slots;
        }

        async function drawDiagrams(token, slots) {
            for (const slot of slots) {
                if (token !== renderToken) return;
                const source = slot.source.trim();
                if (!source) {
                    showDiagramError(slot.el, 'Empty Mermaid diagram');
                    continue;
                }
                const id = 'md-mermaid-' + token + '-' + slot.index;
                try {
                    const rendered = await mermaid.render(id, source);
                    if (token !== renderToken) return;
                    slot.el.innerHTML = sanitizeSvg(rendered.svg);
                    const orphan = document.getElementById(id);
                    if (orphan && !slot.el.contains(orphan)) orphan.remove();
                } catch (err) {
                    if (token !== renderToken) return;
                    showDiagramError(slot.el, err);
                }
            }
        }

        function render(value) {
            const token = ++renderToken;
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
            const slots = typeof mermaid === 'undefined' ? [] : takeDiagrams();
            mdOutput.querySelectorAll('pre code').forEach(block => hljs.highlightElement(block));
            if (!slots.length) return;
            diagramChain = diagramChain.then(() => drawDiagrams(token, slots), () => drawDiagrams(token, slots));
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
            const sample = [
                '# Markdown Preview',
                '',
                'Paste or type Markdown in the left pane.',
                '',
                '## Features',
                '',
                '- GitHub-flavored Markdown',
                '- Sanitized HTML output',
                '- Syntax highlighting',
                '- Mermaid diagrams',
                '',
                '### Code',
                '',
                '```javascript',
                'function greet(name){',
                '  console.log(`Hello, ${name}`);',
                '}',
                "greet('world');",
                '```',
                '',
                '```mermaid',
                'classDiagram',
                '  class Order {',
                '    +submit()',
                '  }',
                '  class Payment',
                '  Order --> Payment',
                '```',
                '',
                '> Blockquotes and lists work too.',
                '',
                '1. One',
                '2. Two',
                '3. Three',
                ''
            ].join('\n');
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
