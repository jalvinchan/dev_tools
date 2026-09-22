window.registerTool('regex', {
    title: 'Regex',
    template: `
  <div class="markdown-body">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <input id="re-pattern" class="input" placeholder="Pattern" style="height:auto;padding:6px;width:260px">
      <input id="re-flags" class="input" placeholder="Flags (e.g. gim)" style="height:auto;padding:6px;width:120px">
      <button class="btn" id="re-clear">Clear</button>
    </div>
    <textarea id="re-input" class="input" placeholder="Test text" style="height:200px"></textarea>
    <div id="re-output" class="markdown-body"></div>
    <div id="re-error" style="color:#cf222e;display:none"></div>
  </div>
    `,
    init: function() {
        const pattern = document.getElementById('re-pattern');
        const flags = document.getElementById('re-flags');
        const input = document.getElementById('re-input');
        const output = document.getElementById('re-output');
        const err = document.getElementById('re-error');
        const clearBtn = document.getElementById('re-clear');
        const k1 = 'regex_pattern_v1';
        const k2 = 'regex_flags_v1';
        const k3 = 'regex_input_v1';
        function test() {
            const p = pattern.value || '';
            const f = flags.value || '';
            const t = input.value || '';
            output.innerHTML = '';
            err.style.display = 'none';
            if (!p || !t) { return }
            let re;
            try { re = new RegExp(p, f) } catch (e) { err.textContent = String(e.message || e); err.style.display = 'block'; return }
            let m; let i = 0;
            while ((m = re.exec(t))) {
                const item = document.createElement('div');
                item.style.marginBottom = '8px';
                item.style.padding = '8px';
                item.style.background = '#f6f8fa';
                item.style.borderRadius = '6px';
                
                const head = document.createElement('div');
                head.style.fontWeight = 'bold';
                head.textContent = 'Match ' + (++i) + ' at index ' + m.index;
                item.appendChild(head);
                
                if (m.length > 1) {
                    const groups = document.createElement('div');
                    groups.style.marginTop = '4px';
                    let s = 'Groups: ';
                    for (let g = 1; g < m.length; g++) { s += g + ': "' + String(m[g]) + '"' + (g < m.length - 1 ? ', ' : '') }
                    groups.textContent = s;
                    item.appendChild(groups);
                }
                output.appendChild(item);
                if (!re.global) break;
            }
            if (i === 0) { output.textContent = 'No matches' }
            try { localStorage.setItem(k1, p); localStorage.setItem(k2, f); localStorage.setItem(k3, t) } catch (e) { }
        }
        try { const p = localStorage.getItem(k1); if (p) pattern.value = p; const f = localStorage.getItem(k2); if (f) flags.value = f; const t = localStorage.getItem(k3); if (t) input.value = t } catch (e) { }
        pattern.addEventListener('input', test);
        flags.addEventListener('input', test);
        input.addEventListener('input', test);
        clearBtn.addEventListener('click', () => { pattern.value = ''; flags.value = ''; input.value = ''; output.innerHTML = ''; err.style.display = 'none'; try { localStorage.removeItem(k1); localStorage.removeItem(k2); localStorage.removeItem(k3) } catch (e) { } });
        test();
    }
});
