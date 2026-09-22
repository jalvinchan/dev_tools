window.registerTool('json', {
    title: 'JSON',
    template: `
  <div class="container">
    <div class="pane">
      <textarea id="json-input" class="input" placeholder="Paste JSON here"></textarea>
    </div>
    <div class="divider" id="json-divider"></div>
    <div class="pane preview" style="padding:0;display:flex;flex-direction:column">
       <div style="padding:8px;border-bottom:1px solid #d0d7de;display:flex;gap:8px;flex-wrap:wrap;background:#f6f8fa;align-items:center">
          <button class="btn" id="json-format">Format</button>
          <button class="btn" id="json-minify">Minify</button>
          <button class="btn" id="json-clear">Clear</button>
          <button class="btn" id="json-copy">Copy</button>
          <div style="flex:1"></div>
          <button class="btn" id="json-expand">Expand</button>
          <button class="btn" id="json-collapse">Collapse</button>
       </div>
       <div id="json-output" class="json-tree" style="padding:16px;flex:1;overflow:auto"></div>
       <div id="json-error" style="padding:16px;color:#cf222e;display:none;border-top:1px solid #d0d7de"></div>
    </div>
  </div>
    `,
    init: function() {
        const input = document.getElementById('json-input');
        const output = document.getElementById('json-output');
        const err = document.getElementById('json-error');
        const formatBtn = document.getElementById('json-format');
        const minifyBtn = document.getElementById('json-minify');
        const clearBtn = document.getElementById('json-clear');
        const copyBtn = document.getElementById('json-copy');
        const expandBtn = document.getElementById('json-expand');
        const collapseBtn = document.getElementById('json-collapse');
        const divider = document.getElementById('json-divider');
        const container = divider.parentElement;
        const key = 'json_input_v1';
        const widthKey = 'json_split_pos_v1';

        // Split pane logic
        let isDragging = false;
        divider.addEventListener('mousedown', () => { isDragging = true; divider.classList.add('active'); document.body.style.cursor = 'col-resize'; });
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const containerRect = container.getBoundingClientRect();
            let newWidth = e.clientX - containerRect.left;
            if (newWidth < 100) newWidth = 100;
            if (newWidth > containerRect.width - 100) newWidth = containerRect.width - 100;
            container.style.gridTemplateColumns = `${newWidth}px 8px 1fr`;
            localStorage.setItem(widthKey, newWidth);
        });
        document.addEventListener('mouseup', () => { if (isDragging) { isDragging = false; divider.classList.remove('active'); document.body.style.cursor = ''; } });
        const savedWidth = localStorage.getItem(widthKey);
        if (savedWidth) container.style.gridTemplateColumns = `${savedWidth}px 8px 1fr`;

        function createNode(key, value) {
            const item = document.createElement('div');
            item.className = 'json-tree-item';
            
            if (value === null) {
                item.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-null">null</span>`;
                return item;
            }
            
            const type = typeof value;
            if (type === 'string') {
                const safeStr = JSON.stringify(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
                 item.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-string">${safeStr}</span>`;
                 return item;
            }
            if (type === 'number') {
                 item.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-number">${value}</span>`;
                 return item;
            }
            if (type === 'boolean') {
                 item.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-boolean">${value}</span>`;
                 return item;
            }
            
            if (Array.isArray(value)) {
                if (value.length === 0) {
                     item.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-bracket">[]</span>`;
                     return item;
                }
                const toggler = document.createElement('span');
                toggler.className = 'json-toggler';
                toggler.onclick = (e) => {
                    e.stopPropagation();
                    toggler.classList.toggle('collapsed');
                    childrenContainer.classList.toggle('hidden');
                };
                
                const label = document.createElement('span');
                label.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-bracket">[</span>`;
                
                const placeholder = document.createElement('span');
                placeholder.className = 'json-placeholder';
                placeholder.textContent = `Array(${value.length})`;
                placeholder.onclick = () => toggler.click();

                const childrenContainer = document.createElement('div');
                childrenContainer.className = 'json-children';
                
                value.forEach(v => {
                    childrenContainer.appendChild(createNode(null, v));
                });
                
                const closing = document.createElement('span');
                closing.className = 'json-bracket';
                closing.textContent = ']';
                
                item.appendChild(toggler);
                item.appendChild(label);
                item.appendChild(childrenContainer);
                item.appendChild(placeholder);
                item.appendChild(closing);
                return item;
            }
            
            // Object
            if (Object.keys(value).length === 0) {
                 item.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-bracket">{}</span>`;
                 return item;
            }
            
            const toggler = document.createElement('span');
            toggler.className = 'json-toggler';
            toggler.onclick = (e) => {
                e.stopPropagation();
                toggler.classList.toggle('collapsed');
                childrenContainer.classList.toggle('hidden');
            };
            
            const label = document.createElement('span');
            label.innerHTML = `${key ? `<span class="json-key">"${key}":</span>` : ''}<span class="json-bracket">{</span>`;
            
            const placeholder = document.createElement('span');
            placeholder.className = 'json-placeholder';
            placeholder.textContent = `{...}`;
            placeholder.onclick = () => toggler.click();

            const childrenContainer = document.createElement('div');
            childrenContainer.className = 'json-children';
            
            Object.keys(value).forEach(k => {
                childrenContainer.appendChild(createNode(k, value[k]));
            });
            
            const closing = document.createElement('span');
            closing.className = 'json-bracket';
            closing.textContent = '}';
            
            item.appendChild(toggler);
            item.appendChild(label);
            item.appendChild(childrenContainer);
            item.appendChild(placeholder);
            item.appendChild(closing);
            
            return item;
        }

        function render() {
            const v = input.value;
            if (!v) { output.innerHTML = ''; err.style.display = 'none'; return }
            try { 
                const o = JSON.parse(v); 
                output.innerHTML = '';
                const root = createNode(null, o);
                root.classList.add('json-tree-root');
                output.appendChild(root);
                err.style.display = 'none'; 
            } catch (e) { 
                err.textContent = String(e.message || e); 
                err.style.display = 'block'; 
                output.innerHTML = '';
            }
        }
        
        function save() { try { localStorage.setItem(key, input.value) } catch (e) { } }
        
        try { const v = localStorage.getItem(key); if (v) { input.value = v } } catch (e) { }
        
        input.addEventListener('input', () => { render(); save() });
        
        formatBtn.addEventListener('click', () => { try { const o = JSON.parse(input.value); input.value = JSON.stringify(o, null, 2); render(); save() } catch (e) { err.textContent = String(e.message || e); err.style.display = 'block' } });
        
        minifyBtn.addEventListener('click', () => { try { const o = JSON.parse(input.value); input.value = JSON.stringify(o); render(); save() } catch (e) { err.textContent = String(e.message || e); err.style.display = 'block' } });
        
        clearBtn.addEventListener('click', () => { input.value = ''; render(); save() });
        
        copyBtn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(JSON.stringify(JSON.parse(input.value), null, 2)) } catch (e) { } });
        
        expandBtn.addEventListener('click', () => {
             document.querySelectorAll('.json-children').forEach(el => el.classList.remove('hidden'));
             document.querySelectorAll('.json-toggler').forEach(el => el.classList.remove('collapsed'));
        });
        
        collapseBtn.addEventListener('click', () => {
             document.querySelectorAll('.json-children').forEach(el => el.classList.add('hidden'));
             document.querySelectorAll('.json-toggler').forEach(el => el.classList.add('collapsed'));
        });

        render();
    }
});
