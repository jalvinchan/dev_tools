window.registerTool('url', {
    title: 'URL',
    template: `
  <div class="markdown-body">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn" id="url-encode">Encode</button>
      <button class="btn" id="url-decode">Decode</button>
      <button class="btn" id="url-clear">Clear</button>
      <button class="btn" id="url-copy">Copy</button>
    </div>
    <textarea id="url-input" class="input" placeholder="Raw text" style="height:160px"></textarea>
    <textarea id="url-output" class="input" placeholder="Encoded text" style="height:160px"></textarea>
  </div>
    `,
    init: function() {
        const inp = document.getElementById('url-input');
        const out = document.getElementById('url-output');
        const enc = document.getElementById('url-encode');
        const dec = document.getElementById('url-decode');
        const clr = document.getElementById('url-clear');
        const cpy = document.getElementById('url-copy');
        const k1 = 'url_input_v1';
        const k2 = 'url_output_v1';
        function save() { try { localStorage.setItem(k1, inp.value); localStorage.setItem(k2, out.value) } catch (e) { } }
        try { const a = localStorage.getItem(k1); if (a) inp.value = a; const b = localStorage.getItem(k2); if (b) out.value = b } catch (e) { }
        enc.addEventListener('click', () => { try { out.value = encodeURIComponent(inp.value); save() } catch (e) { } });
        dec.addEventListener('click', () => { try { out.value = decodeURIComponent(inp.value); save() } catch (e) { } });
        clr.addEventListener('click', () => { inp.value = ''; out.value = ''; save() });
        cpy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(out.value) } catch (e) { } });
    }
});
