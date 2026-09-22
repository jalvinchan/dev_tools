window.registerTool('time', {
    title: 'Timestamp',
    template: `
  <div class="markdown-body">
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
      <button class="btn" id="time-now">Now</button>
      <button class="btn" id="time-clear">Clear</button>
    </div>
    <div style="display:grid;gap:12px;max-width:400px">
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Unix Timestamp (Seconds)</label>
        <input id="time-unix" class="input" style="height:auto;padding:8px">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Unix Timestamp (Millis)</label>
        <input id="time-ms" class="input" style="height:auto;padding:8px">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">ISO String</label>
        <input id="time-iso" class="input" style="height:auto;padding:8px">
      </div>
      <div>
        <label style="font-size:12px;font-weight:600;display:block;margin-bottom:4px">Local String</label>
        <input id="time-local" class="input" style="height:auto;padding:8px">
      </div>
    </div>
  </div>
    `,
    init: function() {
        const nowBtn = document.getElementById('time-now');
        const clrBtn = document.getElementById('time-clear');
        const unix = document.getElementById('time-unix');
        const ms = document.getElementById('time-ms');
        const iso = document.getElementById('time-iso');
        const loc = document.getElementById('time-local');
        const k = 'time_input_v1';
        function update(d) {
            if (isNaN(d.getTime())) return;
            unix.value = Math.floor(d.getTime() / 1000);
            ms.value = d.getTime();
            iso.value = d.toISOString();
            loc.value = d.toLocaleString();
            try { localStorage.setItem(k, ms.value) } catch (e) { }
        }
        nowBtn.addEventListener('click', () => update(new Date()));
        clrBtn.addEventListener('click', () => { unix.value = ''; ms.value = ''; iso.value = ''; loc.value = ''; try { localStorage.removeItem(k) } catch (e) { } });
        unix.addEventListener('input', () => { const v = parseInt(unix.value); if (v) update(new Date(v * 1000)) });
        ms.addEventListener('input', () => { const v = parseInt(ms.value); if (v) update(new Date(v)) });
        iso.addEventListener('input', () => { const d = new Date(iso.value); update(d) });
        try { const v = localStorage.getItem(k); if (v) update(new Date(parseInt(v))) } catch (e) { update(new Date()) }
    }
});
