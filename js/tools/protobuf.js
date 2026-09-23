(function () {
window.registerTool('protobuf', {
    title: 'Protobuf',
    template: `
  <div class="markdown-body">
    <p style="margin:0 0 12px;color:#57606a;font-size:13px">Paste base64 (or hex) protobuf. Optionally paste a <code>.proto</code> so the output uses field names. Saved schemas stay in this browser.</p>
    <div class="pb-row">
      <label style="font-size:13px;display:flex;align-items:center;gap:6px">Schema
        <select id="pb-schema-list" class="btn" style="padding:4px 8px;min-width:160px"></select>
      </label>
      <button class="btn" id="pb-schema-new">New</button>
      <button class="btn" id="pb-schema-save">Save</button>
      <button class="btn" id="pb-schema-delete">Delete</button>
    </div>
    <div class="pb-row">
      <input id="pb-schema-name" class="input pb-input-sm" placeholder="Schema name">
    </div>
    <textarea id="pb-proto" class="input" placeholder="Optional .proto source (syntax, package, messages). Paste imports into the same box." style="height:140px;margin-bottom:8px"></textarea>
    <div id="pb-proto-status" class="pb-status">No .proto loaded — decode uses field numbers</div>
    <div class="pb-row">
      <label style="font-size:13px;display:flex;align-items:center;gap:6px">Message
        <select id="pb-message" class="btn" style="padding:4px 8px;min-width:180px">
          <option value="">Auto-detect</option>
        </select>
      </label>
      <label style="font-size:13px;display:flex;align-items:center;gap:6px">Input
        <select id="pb-encoding" class="btn" style="padding:4px 8px">
          <option value="base64" selected>Base64</option>
          <option value="hex">Hex</option>
        </select>
      </label>
      <button class="btn" id="pb-decode">Decode</button>
      <button class="btn" id="pb-clear">Clear payload</button>
      <button class="btn" id="pb-copy">Copy</button>
    </div>
    <textarea id="pb-input" class="input" placeholder="Base64-encoded protobuf" style="height:140px"></textarea>
    <div id="pb-used" class="pb-status" style="margin:8px 0 0;display:none"></div>
    <pre id="pb-output" class="proto-output"></pre>
    <div id="pb-error" style="color:#cf222e;display:none;margin-top:8px"></div>
  </div>
    `,
    init: function() {
        const inp = document.getElementById('pb-input');
        const out = document.getElementById('pb-output');
        const enc = document.getElementById('pb-encoding');
        const dec = document.getElementById('pb-decode');
        const clr = document.getElementById('pb-clear');
        const cpy = document.getElementById('pb-copy');
        const err = document.getElementById('pb-error');
        const protoInp = document.getElementById('pb-proto');
        const protoStatus = document.getElementById('pb-proto-status');
        const schemaList = document.getElementById('pb-schema-list');
        const schemaName = document.getElementById('pb-schema-name');
        const msgSel = document.getElementById('pb-message');
        const usedEl = document.getElementById('pb-used');
        const kIn = 'pb_input_v1';
        const kEnc = 'pb_encoding_v1';
        const kOut = 'pb_output_v1';
        const kSchemas = 'pb_schemas_v1';
        const kActive = 'pb_schema_id_v1';
        let activeId = '';
        let saveTimer = 0;
        let typeTimer = 0;

        function showError(msg) {
            err.textContent = msg;
            err.style.display = msg ? 'block' : 'none';
        }

        function showUsed(msg) {
            usedEl.textContent = msg || '';
            usedEl.style.display = msg ? 'block' : 'none';
        }

        function loadSchemas() {
            try {
                const raw = localStorage.getItem(kSchemas);
                const arr = raw ? JSON.parse(raw) : [];
                return Array.isArray(arr) ? arr : [];
            } catch (e) {
                return [];
            }
        }

        function persistSchemas(arr) {
            try { localStorage.setItem(kSchemas, JSON.stringify(arr)) } catch (e) { }
        }

        function persistActiveId(id) {
            try { localStorage.setItem(kActive, id || '') } catch (e) { }
        }

        function savePayload() {
            try {
                localStorage.setItem(kIn, inp.value);
                localStorage.setItem(kEnc, enc.value);
                localStorage.setItem(kOut, out.textContent);
            } catch (e) { }
        }

        function renderSchemaList(selectedId) {
            const schemas = loadSchemas();
            schemaList.innerHTML = '';
            if (!schemas.length) {
                const o = document.createElement('option');
                o.value = '';
                o.textContent = 'No saved schemas';
                schemaList.appendChild(o);
                schemaList.value = '';
                return;
            }
            schemas.forEach((s) => {
                const o = document.createElement('option');
                o.value = s.id;
                o.textContent = s.name || 'Untitled';
                schemaList.appendChild(o);
            });
            if (selectedId && schemas.some((s) => s.id === selectedId)) schemaList.value = selectedId;
            else schemaList.value = schemas[0].id;
        }

        function fillEditor(schema) {
            schemaName.value = schema && schema.name ? schema.name : '';
            protoInp.value = schema && schema.proto ? schema.proto : '';
            refreshTypes(schema && schema.message ? schema.message : '');
        }

        function snapshotEditor() {
            return {
                name: schemaName.value.trim() || 'Untitled',
                proto: protoInp.value,
                message: msgSel.value
            };
        }

        function writeActiveToStore() {
            if (!activeId) return;
            const all = loadSchemas();
            const i = all.findIndex((s) => s.id === activeId);
            if (i < 0) return;
            const snap = snapshotEditor();
            all[i].name = snap.name;
            all[i].proto = snap.proto;
            all[i].message = snap.message;
            persistSchemas(all);
            const keep = schemaList.value;
            renderSchemaList(activeId);
            schemaList.value = keep === activeId ? activeId : keep;
        }

        function scheduleSave() {
            clearTimeout(saveTimer);
            saveTimer = setTimeout(writeActiveToStore, 250);
        }

        function newSchema() {
            writeActiveToStore();
            const s = { id: newId(), name: 'Untitled', proto: '', message: '' };
            const all = loadSchemas();
            all.push(s);
            persistSchemas(all);
            activeId = s.id;
            persistActiveId(activeId);
            renderSchemaList(activeId);
            fillEditor(s);
        }

        function saveSchema() {
            const snap = snapshotEditor();
            const all = loadSchemas();
            if (!activeId) {
                const s = { id: newId(), name: snap.name, proto: snap.proto, message: snap.message };
                all.push(s);
                persistSchemas(all);
                activeId = s.id;
                persistActiveId(activeId);
            } else {
                const i = all.findIndex((s) => s.id === activeId);
                if (i < 0) {
                    all.push({ id: activeId, name: snap.name, proto: snap.proto, message: snap.message });
                } else {
                    all[i].name = snap.name;
                    all[i].proto = snap.proto;
                    all[i].message = snap.message;
                }
                persistSchemas(all);
            }
            renderSchemaList(activeId);
        }

        function deleteSchema() {
            if (!activeId) return;
            const all = loadSchemas().filter((s) => s.id !== activeId);
            persistSchemas(all);
            activeId = all[0] ? all[0].id : '';
            persistActiveId(activeId);
            renderSchemaList(activeId);
            fillEditor(all[0] || { name: '', proto: '', message: '' });
        }

        function refreshTypes(preferred) {
            const prev = preferred !== undefined ? preferred : msgSel.value;
            msgSel.innerHTML = '';
            const auto = document.createElement('option');
            auto.value = '';
            auto.textContent = 'Auto-detect';
            msgSel.appendChild(auto);
            const parsed = parseProto(protoInp.value);
            if (!parsed.ok) {
                if (parsed.empty) {
                    protoStatus.textContent = 'No .proto loaded — decode uses field numbers';
                    protoStatus.classList.remove('error');
                } else {
                    protoStatus.textContent = parsed.error;
                    protoStatus.classList.add('error');
                }
                return parsed;
            }
            parsed.types.forEach((t) => {
                const o = document.createElement('option');
                o.value = typeName(t);
                o.textContent = typeName(t);
                msgSel.appendChild(o);
            });
            if ([].some.call(msgSel.options, (o) => o.value === prev)) msgSel.value = prev;
            const n = parsed.types.length;
            protoStatus.textContent = n ? ('Parsed ' + n + ' message type' + (n === 1 ? '' : 's')) : 'Proto parsed, but no message types found';
            protoStatus.classList.remove('error');
            return parsed;
        }

        function decode() {
            try {
                const bytes = enc.value === 'hex' ? fromHex(inp.value) : fromBase64(inp.value);
                if (!bytes.length) {
                    out.textContent = '';
                    showError('');
                    showUsed('');
                    savePayload();
                    return;
                }
                const parsed = parseProto(protoInp.value);
                const named = parsed.ok ? decodeNamed(parsed, bytes, msgSel.value) : null;
                if (named) {
                    out.textContent = named.text;
                    showUsed(named.used);
                    showError('');
                } else {
                    const fields = decodeMessage(bytes, true);
                    out.textContent = formatFields(fields, 0);
                    showUsed(parsed.ok ? 'Schema did not match; showing field numbers' : '');
                    showError('');
                }
                savePayload();
                writeActiveToStore();
            } catch (e) {
                out.textContent = '';
                showUsed('');
                showError(String(e.message || e));
                savePayload();
            }
        }

        function decodeNamed(parsed, bytes, selectedName) {
            const types = parsed.types;
            if (!types.length) return null;
            let type = null;
            let auto = false;
            if (selectedName) {
                type = types.find((t) => typeName(t) === selectedName) || lookupType(parsed.root, selectedName);
                if (!type) throw new Error('unknown message type ' + selectedName);
            } else {
                const picked = pickBestType(types, bytes);
                type = picked.type;
                auto = true;
                if (!type || picked.score <= 0) return null;
            }
            const obj = type.toObject(type.decode(bytes), {
                longs: String,
                enums: String,
                bytes: String,
                defaults: false,
                arrays: true,
                objects: true,
                oneofs: true,
                json: true
            });
            return {
                text: JSON.stringify(obj, null, 2),
                used: (auto ? 'Auto-detected as ' : 'Decoded as ') + typeName(type)
            };
        }

        dec.addEventListener('click', decode);
        inp.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') decode();
        });
        clr.addEventListener('click', () => {
            inp.value = '';
            out.textContent = '';
            showError('');
            showUsed('');
            savePayload();
        });
        cpy.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(out.textContent) } catch (e) { }
        });
        enc.addEventListener('change', () => {
            inp.placeholder = enc.value === 'hex' ? 'Hex-encoded protobuf' : 'Base64-encoded protobuf';
            savePayload();
        });
        document.getElementById('pb-schema-new').addEventListener('click', newSchema);
        document.getElementById('pb-schema-save').addEventListener('click', saveSchema);
        document.getElementById('pb-schema-delete').addEventListener('click', deleteSchema);
        schemaList.addEventListener('change', () => {
            writeActiveToStore();
            activeId = schemaList.value;
            persistActiveId(activeId);
            const s = loadSchemas().find((x) => x.id === activeId);
            fillEditor(s || { name: '', proto: '', message: '' });
        });
        schemaName.addEventListener('input', scheduleSave);
        protoInp.addEventListener('input', () => {
            clearTimeout(typeTimer);
            typeTimer = setTimeout(() => refreshTypes(), 200);
            scheduleSave();
        });
        msgSel.addEventListener('change', scheduleSave);

        try {
            const a = localStorage.getItem(kIn);
            if (a) inp.value = a;
            const b = localStorage.getItem(kEnc);
            if (b === 'hex' || b === 'base64') enc.value = b;
            const c = localStorage.getItem(kOut);
            if (c) out.textContent = c;
            inp.placeholder = enc.value === 'hex' ? 'Hex-encoded protobuf' : 'Base64-encoded protobuf';
            const schemas = loadSchemas();
            activeId = localStorage.getItem(kActive) || '';
            if (activeId && !schemas.some((s) => s.id === activeId)) activeId = '';
            if (!activeId && schemas[0]) activeId = schemas[0].id;
            renderSchemaList(activeId);
            const current = schemas.find((s) => s.id === activeId);
            fillEditor(current || { name: '', proto: '', message: '' });
        } catch (e) { }
    }
});

function newId() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return 's-' + Date.now() + '-' + Math.random().toString(16).slice(2);
}

function typeName(t) {
    return String(t.fullName || t.name || '').replace(/^\./, '');
}

function lookupType(root, name) {
    if (!root || !name) return null;
    try { return root.lookupType(name) } catch (e) { return null }
}

function collectTypes(ns, acc) {
    acc = acc || [];
    (ns.nestedArray || []).forEach((child) => {
        if (child.fieldsArray) {
            acc.push(child);
            collectTypes(child, acc);
        } else if (child.nestedArray && !child.values) {
            collectTypes(child, acc);
        }
    });
    return acc;
}

function parseProto(src) {
    if (!String(src || '').trim()) return { ok: false, empty: true, error: '' };
    if (typeof protobuf === 'undefined' || !protobuf.parse) {
        return { ok: false, error: 'protobufjs failed to load' };
    }
    try {
        const parsed = protobuf.parse(src, { keepCase: true });
        parsed.root.resolveAll();
        return { ok: true, root: parsed.root, types: collectTypes(parsed.root) };
    } catch (e) {
        return { ok: false, error: String(e.message || e) };
    }
}

function countKeys(v) {
    if (v === null || v === undefined) return 0;
    if (Array.isArray(v)) return v.reduce((n, x) => n + Math.max(1, countKeys(x)), 0);
    if (typeof v === 'object') return Object.keys(v).reduce((n, k) => n + 1 + countKeys(v[k]), 0);
    return 1;
}

function pickBestType(types, bytes) {
    let best = null;
    let bestScore = -1;
    types.forEach((t) => {
        try {
            const obj = t.toObject(t.decode(bytes), {
                defaults: false,
                longs: String,
                enums: String,
                bytes: String,
                arrays: true,
                objects: true
            });
            const score = countKeys(obj);
            if (score > bestScore) {
                bestScore = score;
                best = t;
            }
        } catch (e) { }
    });
    return { type: best, score: bestScore };
}

function fromBase64(raw) {
    let s = String(raw || '').trim().replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!s) return new Uint8Array(0);
    const pad = s.length % 4;
    if (pad === 1) throw new Error('invalid base64 length');
    if (pad) s += '='.repeat(4 - pad);
    let bin;
    try {
        bin = atob(s);
    } catch (e) {
        throw new Error('invalid base64');
    }
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

function fromHex(raw) {
    const s = String(raw || '').trim().replace(/^0x/i, '').replace(/[\s:_-]/g, '');
    if (!s) return new Uint8Array(0);
    if (s.length % 2) throw new Error('invalid hex length');
    if (!/^[0-9a-fA-F]+$/.test(s)) throw new Error('invalid hex');
    const bytes = new Uint8Array(s.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(s.slice(i * 2, i * 2 + 2), 16);
    return bytes;
}

function Reader(bytes) {
    this.bytes = bytes;
    this.pos = 0;
}

Reader.prototype.remaining = function() {
    return this.bytes.length - this.pos;
};

Reader.prototype.u8 = function() {
    if (this.pos >= this.bytes.length) throw new Error('unexpected end of protobuf');
    return this.bytes[this.pos++];
};

Reader.prototype.varint = function() {
    let result = 0n;
    let shift = 0n;
    for (let i = 0; i < 10; i++) {
        const b = this.u8();
        result |= BigInt(b & 0x7f) << shift;
        if ((b & 0x80) === 0) return result;
        shift += 7n;
    }
    throw new Error('varint too long');
};

Reader.prototype.slice = function(n) {
    n = Number(n);
    if (n < 0 || this.pos + n > this.bytes.length) throw new Error('unexpected end of protobuf');
    const slice = this.bytes.subarray(this.pos, this.pos + n);
    this.pos += n;
    return slice;
};

function decodeMessage(bytes, requireComplete) {
    const r = new Reader(bytes);
    const fields = [];
    while (r.remaining() > 0) {
        const key = r.varint();
        const field = Number(key >> 3n);
        const wire = Number(key & 7n);
        if (field < 1 || field > 536870911) throw new Error('invalid field number ' + field);
        if (wire === 0) {
            fields.push({ field, wire: 'varint', value: r.varint() });
        } else if (wire === 1) {
            const slice = r.slice(8);
            fields.push({ field, wire: 'fixed64', value: slice });
        } else if (wire === 2) {
            const n = r.varint();
            if (n > BigInt(r.remaining())) throw new Error('length-delimited field overruns buffer');
            const slice = r.slice(n);
            fields.push({ field, wire: 'bytes', value: decodeLengthDelimited(slice) });
        } else if (wire === 5) {
            const slice = r.slice(4);
            fields.push({ field, wire: 'fixed32', value: slice });
        } else if (wire === 3 || wire === 4) {
            throw new Error('deprecated group wire type ' + wire);
        } else {
            throw new Error('invalid wire type ' + wire);
        }
    }
    if (requireComplete && r.remaining() !== 0) throw new Error('trailing bytes after protobuf message');
    return fields;
}

function decodeLengthDelimited(bytes) {
    if (!bytes.length) return { kind: 'string', value: '' };
    try {
        const nested = decodeMessage(bytes, true);
        if (nested.length) return { kind: 'message', fields: nested };
    } catch (e) { }
    try {
        const s = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        if (isMostlyText(s)) return { kind: 'string', value: s };
    } catch (e) { }
    return { kind: 'hex', value: toHex(bytes) };
}

function isMostlyText(s) {
    let bad = 0;
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        const ok = c === 9 || c === 10 || c === 13 || (c >= 32 && c !== 127);
        if (!ok) bad++;
    }
    return bad === 0 || bad / s.length < 0.1;
}

function toHex(bytes) {
    let s = '';
    for (let i = 0; i < bytes.length; i++) s += bytes[i].toString(16).padStart(2, '0');
    return s;
}

function u32le(bytes) {
    return (bytes[0] | (bytes[1] << 8) | (bytes[2] << 16) | (bytes[3] << 24)) >>> 0;
}

function u64le(bytes) {
    let n = 0n;
    for (let i = 7; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
    return n;
}

function f32le(bytes) {
    return new DataView(bytes.buffer, bytes.byteOffset, 4).getFloat32(0, true);
}

function f64le(bytes) {
    return new DataView(bytes.buffer, bytes.byteOffset, 8).getFloat64(0, true);
}

function formatFields(fields, indent) {
    const pad = '  '.repeat(indent);
    return fields.map((f) => pad + formatField(f, indent)).join('\n');
}

function formatField(f, indent) {
    if (f.wire === 'varint') return f.field + ': ' + f.value.toString();
    if (f.wire === 'fixed32') {
        const u = u32le(f.value) >>> 0;
        const fl = f32le(f.value);
        let line = f.field + ': 0x' + u.toString(16).padStart(8, '0');
        if (Number.isFinite(fl)) line += '  # float ' + fl;
        return line;
    }
    if (f.wire === 'fixed64') {
        const u = u64le(f.value);
        const fl = f64le(f.value);
        let line = f.field + ': 0x' + u.toString(16).padStart(16, '0');
        if (Number.isFinite(fl)) line += '  # double ' + fl;
        return line;
    }
    const inner = f.value;
    if (inner.kind === 'message') {
        return f.field + ' {\n' + formatFields(inner.fields, indent + 1) + '\n' + '  '.repeat(indent) + '}';
    }
    if (inner.kind === 'string') return f.field + ': ' + JSON.stringify(inner.value);
    return f.field + ': <hex: ' + inner.value + '>';
}
})();
