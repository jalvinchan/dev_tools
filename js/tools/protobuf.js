(function () {
window.registerTool('protobuf', {
    title: 'Protobuf',
    template: `
  <div class="markdown-body">
    <p style="margin:0 0 12px;color:#57606a;font-size:13px">Decode: paste base64 (or hex) into the payload box. Encode: put JSON (needs a <code>.proto</code>) or a field-number dump into the result box. Saved schemas stay in this browser.</p>
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
      <label style="font-size:13px;display:flex;align-items:center;gap:6px">Wire
        <select id="pb-encoding" class="btn" style="padding:4px 8px">
          <option value="base64" selected>Base64</option>
          <option value="hex">Hex</option>
        </select>
      </label>
      <button class="btn" id="pb-decode">Decode</button>
      <button class="btn" id="pb-encode">Encode</button>
      <button class="btn" id="pb-clear">Clear payload</button>
      <button class="btn" id="pb-copy">Copy result</button>
    </div>
    <textarea id="pb-input" class="input" placeholder="Base64-encoded protobuf" style="height:140px"></textarea>
    <div id="pb-used" class="pb-status" style="margin:8px 0 0;display:none"></div>
    <textarea id="pb-output" class="input proto-output" placeholder="Decoded JSON or field dump — edit and Encode" style="height:200px;margin-top:12px"></textarea>
    <div id="pb-error" style="color:#cf222e;display:none;margin-top:8px"></div>
  </div>
    `,
    init: function() {
        const inp = document.getElementById('pb-input');
        const out = document.getElementById('pb-output');
        const enc = document.getElementById('pb-encoding');
        const dec = document.getElementById('pb-decode');
        const encBtn = document.getElementById('pb-encode');
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
                localStorage.setItem(kOut, out.value);
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
                    out.value = '';
                    showError('');
                    showUsed('');
                    savePayload();
                    return;
                }
                const parsed = parseProto(protoInp.value);
                const named = parsed.ok ? decodeNamed(parsed, bytes, msgSel.value) : null;
                if (named) {
                    out.value = named.text;
                    showUsed(named.used);
                    showError('');
                } else {
                    const fields = decodeMessage(bytes, true);
                    out.value = formatFields(fields, 0);
                    showUsed(parsed.ok ? 'Schema did not match; showing field numbers' : '');
                    showError('');
                }
                savePayload();
                writeActiveToStore();
            } catch (e) {
                out.value = '';
                showUsed('');
                showError(String(e.message || e));
                savePayload();
            }
        }

        function encode() {
            try {
                const src = out.value;
                const trimmed = String(src || '').trim();
                if (!trimmed) throw new Error('result box is empty — paste JSON or a field dump to encode');
                let bytes;
                let used;
                if (trimmed[0] === '{') {
                    const parsed = parseProto(protoInp.value);
                    if (parsed.empty) throw new Error('paste a .proto to encode JSON, or paste a field dump instead');
                    if (!parsed.ok) throw new Error(parsed.error);
                    const named = encodeNamed(parsed, src, msgSel.value);
                    bytes = named.bytes;
                    used = named.used;
                } else {
                    bytes = encodeDump(src);
                    used = 'Encoded with field numbers';
                }
                inp.value = enc.value === 'hex' ? toHex(bytes) : toBase64(bytes);
                showUsed(used);
                showError('');
                savePayload();
                writeActiveToStore();
            } catch (e) {
                showError(String(e.message || e));
            }
        }

        function encodeNamed(parsed, jsonText, selectedName) {
            const types = parsed.types;
            if (!types.length) throw new Error('no message types in .proto');
            let type = null;
            if (selectedName) {
                type = types.find((t) => typeName(t) === selectedName) || lookupType(parsed.root, selectedName);
                if (!type) throw new Error('unknown message type ' + selectedName);
            } else if (types.length === 1) {
                type = types[0];
            } else {
                throw new Error('select a message type to encode');
            }
            let obj;
            try {
                obj = JSON.parse(jsonText);
            } catch (e) {
                throw new Error('JSON to encode is invalid: ' + (e.message || e));
            }
            if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
                throw new Error('JSON to encode must be an object');
            }
            const bytes = encodeType(type, obj, '');
            return { bytes, used: 'Encoded as ' + typeName(type) };
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
            const obj = decodeType(type, bytes);
            return {
                text: JSON.stringify(obj, null, 2),
                used: (auto ? 'Auto-detected as ' : 'Decoded as ') + typeName(type)
            };
        }

        dec.addEventListener('click', decode);
        encBtn.addEventListener('click', encode);
        inp.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') decode();
        });
        out.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') encode();
        });
        clr.addEventListener('click', () => {
            inp.value = '';
            out.value = '';
            showError('');
            showUsed('');
            savePayload();
        });
        cpy.addEventListener('click', async () => {
            try { await navigator.clipboard.writeText(out.value) } catch (e) { }
        });
        out.addEventListener('input', () => { savePayload(); });
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
            if (c) out.value = c;
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
        // No resolveAll(): it generates message constructors with new Function,
        // which the extension CSP blocks. Field types are looked up on demand.
        const parsed = protobuf.parse(src, { keepCase: true });
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
            const score = countKeys(decodeType(t, bytes));
            if (score > bestScore) {
                bestScore = score;
                best = t;
            }
        } catch (e) { }
    });
    return { type: best, score: bestScore };
}

// protobuf.js generates its codecs with new Function, which the Chrome extension
// CSP forbids, so schema-aware encode/decode walk the reflection model instead.
const SCALAR_WIRE = {
    double: 1, float: 5,
    int32: 0, int64: 0, uint32: 0, uint64: 0, sint32: 0, sint64: 0, bool: 0,
    fixed32: 5, sfixed32: 5, fixed64: 1, sfixed64: 1,
    string: 2, bytes: 2
};

const LONG_TYPES = { int64: 1, uint64: 1, sint64: 1, fixed64: 1, sfixed64: 1 };

function has(obj, k) {
    return Object.prototype.hasOwnProperty.call(obj, k);
}

function fieldInfo(f) {
    let rt = null;
    if (!has(SCALAR_WIRE, f.type)) {
        try {
            rt = f.parent.lookupTypeOrEnum(f.type);
        } catch (e) {
            throw new Error('cannot resolve type ' + f.type + ' of field ' + f.name + ' (imported files are not loaded)');
        }
    }
    const isEnum = !!(rt && rt.valuesById);
    return {
        id: f.id,
        name: f.name,
        type: f.type,
        rt: rt,
        isEnum: isEnum,
        isMessage: !!rt && !isEnum,
        wire: rt ? (isEnum ? 0 : 2) : SCALAR_WIRE[f.type],
        repeated: !!f.repeated,
        map: !!f.map,
        keyType: f.keyType || null,
        packed: f.packed !== false
    };
}

function scalarInfo(id, type) {
    if (!has(SCALAR_WIRE, type)) throw new Error('unsupported map key type ' + type);
    return {
        id: id, name: type, type: type, rt: null, isEnum: false, isMessage: false,
        wire: SCALAR_WIRE[type], repeated: false, map: false, keyType: null, packed: false
    };
}

function isPacked(info) {
    return info.repeated && !info.map && info.wire !== 2 && info.packed;
}

function camelCase(s) {
    return String(s).replace(/_+([a-z0-9])/g, (m, c) => c.toUpperCase());
}

function at(path, key) {
    return path ? path + '.' + key : String(key);
}

function encodeType(type, obj, path) {
    const fields = (type.fieldsArray || []).slice().sort((a, b) => a.id - b.id);
    const byName = {};
    fields.forEach((f) => {
        byName[f.name] = f;
        const alias = camelCase(f.name);
        if (!has(byName, alias)) byName[alias] = f;
    });
    Object.keys(obj).forEach((k) => {
        if (!has(byName, k)) throw new Error(at(path, k) + ': no such field in ' + typeName(type));
    });
    const w = new Writer();
    fields.forEach((f) => {
        const alias = camelCase(f.name);
        if (alias !== f.name && has(obj, f.name) && has(obj, alias)) {
            throw new Error(at(path, f.name) + ' is given twice (also as ' + alias + ')');
        }
        const key = has(obj, f.name) ? f.name : (has(obj, alias) ? alias : null);
        if (key === null) return;
        const v = obj[key];
        if (v === null || v === undefined) return;
        writeField(w, fieldInfo(f), v, at(path, key));
    });
    return w.finish();
}

function writeField(w, info, v, path) {
    if (info.map) {
        if (typeof v !== 'object' || Array.isArray(v)) throw new Error(path + ' must be an object');
        const keyInfo = scalarInfo(1, info.keyType);
        const valInfo = Object.assign({}, info, { id: 2, repeated: false, map: false });
        Object.keys(v).forEach((k) => {
            const e = new Writer();
            writeTagged(e, keyInfo, k, path + '[' + JSON.stringify(k) + '] key');
            const mv = v[k];
            if (mv !== null && mv !== undefined) writeTagged(e, valInfo, mv, at(path, k));
            w.key(info.id, 2);
            w.ld(e.finish());
        });
        return;
    }
    if (info.repeated) {
        if (!Array.isArray(v)) throw new Error(path + ' must be an array');
        if (isPacked(info)) {
            const e = new Writer();
            v.forEach((item, i) => writeBody(e, info, item, path + '[' + i + ']'));
            const bytes = e.finish();
            if (bytes.length) {
                w.key(info.id, 2);
                w.ld(bytes);
            }
            return;
        }
        v.forEach((item, i) => writeTagged(w, info, item, path + '[' + i + ']'));
        return;
    }
    writeTagged(w, info, v, path);
}

function writeTagged(w, info, v, path) {
    w.key(info.id, info.wire);
    writeBody(w, info, v, path);
}

function writeBody(w, info, v, path) {
    if (info.isMessage) {
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(path + ' must be an object');
        w.ld(encodeType(info.rt, v, path));
        return;
    }
    if (info.isEnum) {
        w.varint(enumNumber(info.rt, v, path));
        return;
    }
    switch (info.type) {
        case 'string':
            if (typeof v !== 'string') throw new Error(path + ' must be a string');
            w.ld(new TextEncoder().encode(v));
            return;
        case 'bytes':
            w.ld(toBytesValue(v, path));
            return;
        case 'bool':
            w.varint(toBoolValue(v, path) ? 1 : 0);
            return;
        case 'int32':
            w.varint(fitInt(toBig(v, path), 32, true, path));
            return;
        case 'uint32':
            w.varint(fitInt(toBig(v, path), 32, false, path));
            return;
        case 'sint32':
            w.varint(zigzag(fitInt(toBig(v, path), 32, true, path)));
            return;
        case 'int64':
            w.varint(fitInt(toBig(v, path), 64, true, path));
            return;
        case 'uint64':
            w.varint(fitInt(toBig(v, path), 64, false, path));
            return;
        case 'sint64':
            w.varint(zigzag(fitInt(toBig(v, path), 64, true, path)));
            return;
        case 'fixed32':
            w.u32(Number(fitInt(toBig(v, path), 32, false, path)));
            return;
        case 'sfixed32':
            w.u32(Number(BigInt.asUintN(32, fitInt(toBig(v, path), 32, true, path))));
            return;
        case 'fixed64':
            w.u64(fitInt(toBig(v, path), 64, false, path));
            return;
        case 'sfixed64':
            w.u64(BigInt.asUintN(64, fitInt(toBig(v, path), 64, true, path)));
            return;
        case 'float':
            w.f32(toNum(v, path));
            return;
        case 'double':
            w.f64(toNum(v, path));
            return;
    }
    throw new Error(path + ': unsupported field type ' + info.type);
}

function decodeType(type, bytes) {
    const infos = {};
    (type.fieldsArray || []).forEach((f) => { infos[f.id] = fieldInfo(f) });
    const r = new Reader(bytes);
    const obj = {};
    while (r.remaining() > 0) {
        const tag = r.varint();
        const id = Number(tag >> 3n);
        const wire = Number(tag & 7n);
        if (id < 1 || id > 536870911) throw new Error('invalid field number ' + id);
        const info = infos[id];
        if (!info) {
            skipWire(r, wire);
            continue;
        }
        if (info.map) {
            readMapEntry(r, wire, info, obj);
            continue;
        }
        if (info.repeated) {
            const arr = has(obj, info.name) ? obj[info.name] : (obj[info.name] = []);
            if (wire === 2 && isPacked(info)) {
                const sub = new Reader(readLD(r));
                while (sub.remaining() > 0) arr.push(readBody(sub, info));
                continue;
            }
            arr.push(readTagged(r, info, wire));
            continue;
        }
        obj[info.name] = readTagged(r, info, wire);
    }
    return obj;
}

function readMapEntry(r, wire, info, obj) {
    if (wire !== 2) throw new Error('field ' + info.name + ': map entry must be length-delimited');
    const keyInfo = scalarInfo(1, info.keyType);
    const valInfo = Object.assign({}, info, { id: 2, repeated: false, map: false });
    const sub = new Reader(readLD(r));
    let key = null;
    let value = null;
    while (sub.remaining() > 0) {
        const tag = sub.varint();
        const id = Number(tag >> 3n);
        const w = Number(tag & 7n);
        if (id === 1) key = readTagged(sub, keyInfo, w);
        else if (id === 2) value = readTagged(sub, valInfo, w);
        else skipWire(sub, w);
    }
    const map = has(obj, info.name) ? obj[info.name] : (obj[info.name] = {});
    map[String(key === null ? zeroValue(keyInfo) : key)] = value === null ? zeroValue(valInfo) : value;
}

function readTagged(r, info, wire) {
    if (wire !== info.wire) {
        throw new Error('field ' + info.name + ': expected wire type ' + info.wire + ', got ' + wire);
    }
    return readBody(r, info);
}

function readBody(r, info) {
    if (info.isMessage) return decodeType(info.rt, readLD(r));
    if (info.isEnum) {
        const n = Number(BigInt.asIntN(32, r.varint()));
        return info.rt.valuesById[n] !== undefined ? info.rt.valuesById[n] : n;
    }
    switch (info.type) {
        case 'string': return decodeUtf8(readLD(r));
        case 'bytes': return toBase64(readLD(r));
        case 'bool': return r.varint() !== 0n;
        case 'int32': return Number(BigInt.asIntN(32, r.varint()));
        case 'uint32': return Number(BigInt.asUintN(32, r.varint()));
        case 'sint32': return Number(BigInt.asIntN(32, unzigzag(r.varint())));
        case 'int64': return BigInt.asIntN(64, r.varint()).toString();
        case 'uint64': return BigInt.asUintN(64, r.varint()).toString();
        case 'sint64': return unzigzag(r.varint()).toString();
        case 'fixed32': return u32le(r.slice(4));
        case 'sfixed32': return u32le(r.slice(4)) | 0;
        case 'fixed64': return u64le(r.slice(8)).toString();
        case 'sfixed64': return BigInt.asIntN(64, u64le(r.slice(8))).toString();
        case 'float': return f32le(r.slice(4));
        case 'double': return f64le(r.slice(8));
    }
    throw new Error('unsupported field type ' + info.type);
}

function zeroValue(info) {
    if (info.isMessage) return {};
    if (info.isEnum) return info.rt.valuesById[0] !== undefined ? info.rt.valuesById[0] : 0;
    if (info.type === 'string' || info.type === 'bytes') return '';
    if (info.type === 'bool') return false;
    if (has(LONG_TYPES, info.type)) return '0';
    return 0;
}

function readLD(r) {
    const n = r.varint();
    if (n > BigInt(r.remaining())) throw new Error('length-delimited field overruns buffer');
    return r.slice(n);
}

function skipWire(r, wire) {
    if (wire === 0) { r.varint(); return }
    if (wire === 1) { r.slice(8); return }
    if (wire === 2) { readLD(r); return }
    if (wire === 5) { r.slice(4); return }
    throw new Error('invalid wire type ' + wire);
}

function decodeUtf8(bytes) {
    try {
        return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch (e) {
        throw new Error('invalid UTF-8 in string field');
    }
}

function zigzag(n) {
    return BigInt.asUintN(64, (n << 1n) ^ (n >> 63n));
}

function unzigzag(u) {
    return (u >> 1n) ^ -(u & 1n);
}

function toBig(v, path) {
    if (typeof v === 'boolean') return v ? 1n : 0n;
    if (typeof v === 'number') {
        if (!Number.isInteger(v)) throw new Error(path + ' must be an integer');
        return BigInt(v);
    }
    if (typeof v === 'string' && /^\s*-?\d+\s*$/.test(v)) return BigInt(v.trim());
    throw new Error(path + ' must be an integer');
}

function fitInt(n, bits, signed, path) {
    const fit = signed ? BigInt.asIntN(bits, n) : BigInt.asUintN(bits, n);
    if (fit !== n) throw new Error(path + ': ' + n + ' does not fit in ' + (signed ? 'int' : 'uint') + bits);
    return n;
}

function toNum(v, path) {
    if (typeof v === 'number') return v;
    if (typeof v === 'string') {
        const s = v.trim();
        if (s === 'NaN') return NaN;
        if (s === 'Infinity') return Infinity;
        if (s === '-Infinity') return -Infinity;
        if (s !== '' && !isNaN(Number(s))) return Number(s);
    }
    throw new Error(path + ' must be a number');
}

function toBoolValue(v, path) {
    if (typeof v === 'boolean') return v;
    if (v === 0 || v === 1) return !!v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    throw new Error(path + ' must be a boolean');
}

function toBytesValue(v, path) {
    if (Array.isArray(v)) return new Uint8Array(v);
    if (typeof v === 'string') {
        try {
            return fromBase64(v);
        } catch (e) {
            throw new Error(path + ' must be base64-encoded bytes');
        }
    }
    throw new Error(path + ' must be base64-encoded bytes');
}

function enumNumber(en, v, path) {
    if (typeof v === 'string') {
        if (!has(en.values, v)) throw new Error(path + ': ' + JSON.stringify(v) + ' is not a value of enum ' + typeName(en));
        return en.values[v];
    }
    if (typeof v === 'number' && Number.isInteger(v)) return v;
    throw new Error(path + ' must be an enum name or number');
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

function toBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
}

function Writer() {
    this.chunks = [];
}

Writer.prototype.u8 = function(b) {
    this.chunks.push(b & 255);
};

Writer.prototype.varint = function(n) {
    n = BigInt(n);
    if (n < 0n) n = BigInt.asUintN(64, n);
    while (n > 0x7fn) {
        this.u8(Number(n & 0x7fn) | 0x80);
        n >>= 7n;
    }
    this.u8(Number(n));
};

Writer.prototype.key = function(field, wire) {
    this.varint((BigInt(field) << 3n) | BigInt(wire));
};

Writer.prototype.ld = function(bytes) {
    this.varint(bytes.length);
    for (let i = 0; i < bytes.length; i++) this.u8(bytes[i]);
};

Writer.prototype.u32 = function(n) {
    n = Number(n) >>> 0;
    this.u8(n);
    this.u8(n >>> 8);
    this.u8(n >>> 16);
    this.u8(n >>> 24);
};

Writer.prototype.f32 = function(n) {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setFloat32(0, n, true);
    for (let i = 0; i < 4; i++) this.u8(b[i]);
};

Writer.prototype.f64 = function(n) {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, n, true);
    for (let i = 0; i < 8; i++) this.u8(b[i]);
};

Writer.prototype.u64 = function(n) {
    n = BigInt(n);
    for (let i = 0; i < 8; i++) {
        this.u8(Number(n & 0xffn));
        n >>= 8n;
    }
};

Writer.prototype.finish = function() {
    return new Uint8Array(this.chunks);
};

function encodeDump(text) {
    const fields = parseDump(text);
    return encodeDumpFields(fields);
}

function encodeDumpFields(fields) {
    const w = new Writer();
    fields.forEach((f) => encodeDumpField(w, f));
    return w.finish();
}

function encodeDumpField(w, f) {
    if (f.kind === 'message') {
        w.key(f.field, 2);
        w.ld(encodeDumpFields(f.fields));
        return;
    }
    if (f.kind === 'string') {
        w.key(f.field, 2);
        w.ld(new TextEncoder().encode(f.value));
        return;
    }
    if (f.kind === 'bytes') {
        w.key(f.field, 2);
        w.ld(f.value);
        return;
    }
    if (f.kind === 'fixed32') {
        w.key(f.field, 5);
        w.u32(f.value);
        return;
    }
    if (f.kind === 'fixed64') {
        w.key(f.field, 1);
        w.u64(f.value);
        return;
    }
    w.key(f.field, 0);
    w.varint(f.value);
}

function parseDump(text) {
    const p = { s: String(text || ''), i: 0 };
    const fields = parseDumpFields(p);
    skipDumpSpace(p);
    if (p.i < p.s.length) throw new Error('trailing text in field dump at offset ' + p.i);
    return fields;
}

function skipDumpSpace(p) {
    while (p.i < p.s.length) {
        const c = p.s[p.i];
        if (c === '#') {
            while (p.i < p.s.length && p.s[p.i] !== '\n') p.i++;
            continue;
        }
        if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
            p.i++;
            continue;
        }
        break;
    }
}

function parseDumpFields(p) {
    const fields = [];
    while (true) {
        skipDumpSpace(p);
        if (p.i >= p.s.length || p.s[p.i] === '}') break;
        fields.push(parseDumpField(p));
    }
    return fields;
}

function parseDumpField(p) {
    skipDumpSpace(p);
    if (!/[0-9]/.test(p.s[p.i] || '')) throw new Error('expected field number in dump');
    const start = p.i;
    while (/[0-9]/.test(p.s[p.i] || '')) p.i++;
    const field = Number(p.s.slice(start, p.i));
    if (field < 1) throw new Error('invalid field number ' + field);
    skipDumpSpace(p);
    if (p.s[p.i] === '{') {
        p.i++;
        const nested = parseDumpFields(p);
        skipDumpSpace(p);
        if (p.s[p.i] !== '}') throw new Error('missing } for field ' + field);
        p.i++;
        return { field, kind: 'message', fields: nested };
    }
    if (p.s[p.i] !== ':') throw new Error('expected : after field ' + field);
    p.i++;
    skipDumpSpace(p);
    return Object.assign({ field }, parseDumpValue(p));
}

function parseDumpValue(p) {
    if (p.s[p.i] === '"') {
        let i = p.i + 1;
        while (i < p.s.length) {
            if (p.s[i] === '\\') {
                i += 2;
                continue;
            }
            if (p.s[i] === '"') {
                i++;
                break;
            }
            i++;
        }
        const raw = p.s.slice(p.i, i);
        p.i = i;
        return { kind: 'string', value: JSON.parse(raw) };
    }
    if (p.s.startsWith('<hex:', p.i)) {
        p.i += 5;
        skipDumpSpace(p);
        const hs = p.i;
        while (p.i < p.s.length && p.s[p.i] !== '>') p.i++;
        const hex = p.s.slice(hs, p.i).trim();
        if (p.s[p.i] !== '>') throw new Error('unterminated <hex: ...>');
        p.i++;
        return { kind: 'bytes', value: fromHex(hex) };
    }
    if (p.s.startsWith('0x', p.i) || p.s.startsWith('0X', p.i)) {
        p.i += 2;
        const hs = p.i;
        while (/[0-9a-fA-F]/.test(p.s[p.i] || '')) p.i++;
        const hex = p.s.slice(hs, p.i);
        if (!hex) throw new Error('invalid hex value');
        if (hex.length <= 8) return { kind: 'fixed32', value: parseInt(hex, 16) >>> 0 };
        if (hex.length <= 16) return { kind: 'fixed64', value: BigInt('0x' + hex) };
        throw new Error('hex value too wide for fixed32/fixed64');
    }
    const neg = p.s[p.i] === '-';
    if (neg) p.i++;
    if (!/[0-9]/.test(p.s[p.i] || '')) throw new Error('expected value after field');
    const ns = p.i;
    while (/[0-9]/.test(p.s[p.i] || '')) p.i++;
    const n = BigInt(p.s.slice(ns, p.i));
    return { kind: 'varint', value: neg ? -n : n };
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
