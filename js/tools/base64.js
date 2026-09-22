window.registerTool('base64', {
    title: 'Base64',
    template: `
  <div class="markdown-body">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn" id="b64-encode">Encode</button>
      <button class="btn" id="b64-decode">Decode</button>
      <button class="btn" id="b64-clear">Clear</button>
      <button class="btn" id="b64-copy">Copy</button>
    </div>
    <textarea id="b64-input" class="input" placeholder="Raw text" style="height:160px"></textarea>
    <textarea id="b64-output" class="input" placeholder="Base64 text" style="height:160px"></textarea>
    <div id="b64-error" style="color:#cf222e;display:none"></div>
  </div>
    `,
    init: function() {
        const inp = document.getElementById('b64-input');
        const out = document.getElementById('b64-output');
        const enc = document.getElementById('b64-encode');
        const dec = document.getElementById('b64-decode');
        const clr = document.getElementById('b64-clear');
        const cpy = document.getElementById('b64-copy');
        const err = document.getElementById('b64-error');
        const k1 = 'b64_input_v1';
        const k2 = 'b64_output_v1';
        function toBase64(str) { const bytes = new TextEncoder().encode(str); let bin = ''; for (let i = 0; i < bytes.length; i++) { bin += String.fromCharCode(bytes[i]) } return btoa(bin) }
        function fromBase64(b64) { const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i) } return new TextDecoder().decode(bytes) }
        function save() { try { localStorage.setItem(k1, inp.value); localStorage.setItem(k2, out.value) } catch (e) { } }
        try { const a = localStorage.getItem(k1); if (a) inp.value = a; const b = localStorage.getItem(k2); if (b) out.value = b } catch (e) { }
        enc.addEventListener('click', () => { try { out.value = toBase64(inp.value); err.style.display = 'none'; save() } catch (e) { err.textContent = String(e.message || e); err.style.display = 'block' } });
        dec.addEventListener('click', () => { try { out.value = fromBase64(inp.value); err.style.display = 'none'; save() } catch (e) { err.textContent = String(e.message || e); err.style.display = 'block' } });
        clr.addEventListener('click', () => { inp.value = ''; out.value = ''; err.style.display = 'none'; save() });
        cpy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(out.value) } catch (e) { } });
    }
});
