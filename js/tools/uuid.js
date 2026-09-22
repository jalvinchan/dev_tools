window.registerTool('uuid', {
    title: 'UUID',
    template: `
  <div class="markdown-body">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn" id="uuid-one">Generate</button>
      <button class="btn" id="uuid-ten">Generate 10</button>
      <button class="btn" id="uuid-clear">Clear</button>
      <button class="btn" id="uuid-copy">Copy</button>
    </div>
    <textarea id="uuid-output" class="input" placeholder="UUIDs" style="height:200px"></textarea>
  </div>
    `,
    init: function() {
        const one = document.getElementById('uuid-one');
        const ten = document.getElementById('uuid-ten');
        const clr = document.getElementById('uuid-clear');
        const cpy = document.getElementById('uuid-copy');
        const out = document.getElementById('uuid-output');
        const k = 'uuid_output_v1';
        function gen() { if (crypto && crypto.randomUUID) { return crypto.randomUUID() } const s = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).slice(1); return s() + s() + "-" + s() + "-" + s() + "-" + s() + "-" + s() + s() + s() }
        one.addEventListener('click', () => { const u = gen(); out.value = (out.value ? out.value + '\n' : '') + u; try { localStorage.setItem(k, out.value) } catch (e) { } });
        ten.addEventListener('click', () => { let t = ''; for (let i = 0; i < 10; i++) { t += gen(); if (i < 9) t += '\n' } out.value = (out.value ? out.value + '\n' : '') + t; try { localStorage.setItem(k, out.value) } catch (e) { } });
        clr.addEventListener('click', () => { out.value = ''; try { localStorage.setItem(k, '') } catch (e) { } });
        cpy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(out.value) } catch (e) { } });
        try { const v = localStorage.getItem(k); if (v) out.value = v } catch (e) { }
    }
});
