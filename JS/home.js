/* =========================================================
 * home.js  自宅Wi-Fiミニシミュレータ + AppStore同期（ログは error）
 * 追加: ノード/配線/Wi-Fi を home.canvas に永続化し復元
 * 修正: パレットは click + preventDefault、生成要素は絶対配置と z-index 付与、
 *      安全配置 positionSafe、復元時の保存抑止(restoring)
 * 重要: 初期ロードでは判定を書き込まない。非破壊イベントではダウングレード禁止。
 * ========================================================= */
(function (global) {
    'use strict';

    const CH = 'error';
    const log = (...a) => ((console[CH] || console.log).apply(console, ['[HOME]', ...a]));
    const warn = (...a) => console.warn('[HOME]', ...a);

    // ---- 状態 ----
    const state = {
        wifi: { ssid: null, password: null, enc: null, b24: true, b5: false, configured: false },
        poolWlan: { base: '192.168.0.', next: 100 },
        poolLan: { base: '192.168.10.', next: 10 },
        devices: {},                 // {id:{type, mode, ip}}
        connections: [],             // [{id,a,b,kind,lineEl}]
        selectedId: null, selectedCableId: null,
        cableMode: false, cableTool: null, pendingAnchor: null, tempCable: null
    };
    let restoring = false;         // 復元中の書き込み抑止
    let uid = 0, cableUid = 0;

    // ---- DOM ----
    const $ = (q) => document.querySelector(q);
    const houseBody = $('#houseBody');
    const cableSvg = $('#cableSvg');
    const wanAnchor = $('#wanAnchor');

    // ---- 画像 ----
    const IMG = {
        pc: '../img/devices/pc.png',
        phone: '../img/devices/phone.png',
        tablet: '../img/devices/tablet.png',
        game: '../img/devices/game.png',
        printer: '../img/devices/printer.png',
        router: '../img/devices/router.png',
        onu: '../img/devices/onu.png'
    };

    // ---- UI ----
    const setStatus = (t, cls = '') => { const b = $('#cableStatus'); if (!b) return; b.textContent = `接続ステータス: ${t}`; b.className = `badge ${cls}`; };

    // ---- Wi-Fi ----
    const wifiForm = $('#wifiForm');
    if (wifiForm) {
        wifiForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const ssid = $('#ssid').value.trim(), pw = $('#password').value, enc = $('#enc').value;
            const b24 = $('#b24').checked, b5 = $('#b5').checked, hint = $('#wifiHint');
            if (!ssid || pw.length < 8 || (!b24 && !b5)) { hint.textContent = 'SSID/パスワード/周波数帯を確認してください。'; return; }
            state.wifi = { ssid, password: pw, enc, b24, b5, configured: true };
            const lbl = document.querySelector('#routerBadge .router-label');
            if (lbl) lbl.innerHTML = `Router<br><small>${ssid} / ${enc}${b5 ? ' / 5GHz' : ''}${b24 ? ' / 2.4GHz' : ''}</small>`;
            persistCanvas('wifi');
            log('Wi-Fi適用', state.wifi);
        });
    }

    // ---- パレット（clickのみ、常にpreventDefault / type=button） ----
    initPalette();
    function initPalette() {
        const root = document.getElementById('palette') || document;
        root.querySelectorAll('.palette-item').forEach(el => {
            if (el.tagName === 'BUTTON' && el.type !== 'button') el.type = 'button';
        });
        root.addEventListener('click', (e) => {
            const btn = e.target.closest('.palette-item');
            if (!btn) return;
            e.preventDefault(); e.stopPropagation();
            const tool = btn.dataset.tool;
            const type = btn.dataset.type;
            if (tool) { enableCableTool(btn, tool); return; }
            if (!type) return;
            const el = spawnDevice(type);
            if (!el) return;
            positionSafe(el);
            persistCanvas('spawn');
        });
    }

    // ---- ケーブルツール ----
    function enableCableTool(_, tool) {
        state.cableMode = true; state.cableTool = tool; const tgl = $('#cableToggle'); if (tgl) tgl.checked = true;
        document.querySelectorAll('.palette-item.tool').forEach(el => el.classList.toggle('tool-active', el.dataset.tool === tool));
        state.pendingAnchor = null; setStatus(`${tool.toUpperCase()} 選択`, 'on step');
        log('cableTool=', tool);
    }
    const cableToggle = $('#cableToggle');
    if (cableToggle) {
        cableToggle.addEventListener('change', (e) => {
            state.cableMode = e.target.checked;
            if (!state.cableMode) {
                state.cableTool = null; state.pendingAnchor = null;
                document.querySelectorAll('.palette-item.tool').forEach(el => el.classList.remove('tool-active'));
                setStatus('OFF'); log('cable mode OFF');
            } else {
                enableCableTool(document.querySelector('.palette-item.tool[data-tool="rj45"]'), 'rj45');
            }
        });
    }

    // ---- 安全配置 ----
    function positionSafe(el, x, y) {
        const rect = houseBody.getBoundingClientRect();
        const nx = Math.max(6, Math.min(rect.width - el.offsetWidth - 6, (x ?? Math.floor(rect.width * 0.45))));
        const ny = Math.max(6, Math.min(rect.height - el.offsetHeight - 6, (y ?? Math.floor(rect.height * 0.25))));
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
    }

    // ---- 機器生成 ----
    function spawnRouterAt(x, y) {
        if (document.getElementById('routerBadge')) return document.getElementById('routerBadge');
        const el = document.createElement('div');
        el.className = 'router';
        el.id = 'routerBadge';
        el.style.position = 'absolute';
        el.style.zIndex = '10';
        el.style.left = (x ?? 140) + 'px';
        el.style.top = (y ?? 220) + 'px';
        el.innerHTML = `
      <img class="router-img" src="${IMG.router}" onerror="this.style.display='none'">
      <div class="router-label">Router<br><small>${state.wifi.configured ? (state.wifi.ssid + ' / ' + state.wifi.enc) : '未設定'}</small></div>
      <span id="routerWan"  class="port wan" title="WANポート"></span>
      <span id="routerPort1" class="port"     title="LANポート"></span>
      <button class="close" title="削除">×</button>`;
        houseBody.appendChild(el);
        bindRouterEvents();
        el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); deleteRouter(); });
        return el;
    }

    function spawnDevice(type) {
        if (type === 'router') { const r = spawnRouterAt(); persistCanvas('spawnRouter'); return r; }
        const id = `dev-${type}-${++uid}`;
        return spawnDeviceSnapshot(id, { type, mode: (type === 'printer' ? 'lan' : 'wlan'), ip: null, x: 330, y: 120 });
    }

    function spawnDeviceSnapshot(id, rec) {
        const el = document.createElement('div');
        el.className = 'device ' + (rec.mode || 'wlan') + (rec.type === 'onu' ? ' onu' : '');
        el.dataset.type = rec.type; el.id = id;
        el.style.position = 'absolute';
        el.style.zIndex = '10';
        const img = IMG[rec.type] ? `<div class="thumb"><img src="${IMG[rec.type]}" onerror="this.style.display='none'"></div>` : `<div class="thumb"></div>`;
        el.innerHTML = `${img}
      <div class="label">${labelOf(rec.type)}</div>
      <span class="ip">${rec.type === 'onu' ? (rec.ip || 'WAN未接続') : (rec.ip || '未接続')}</span>
      <button class="close" title="削除">×</button>`;
        houseBody.appendChild(el);
        if (typeof rec.x === 'number' && typeof rec.y === 'number') {
            el.style.left = rec.x + 'px'; el.style.top = rec.y + 'px';
        } else {
            positionSafe(el);
        }
        state.devices[id] = { type: rec.type, ip: rec.ip || null, mode: rec.mode || 'wlan' };
        el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); deleteDevice(id); });
        makeDraggable(el);
        if (!rec.ip) assignIpIfNeeded(id);
        return el;
    }

    // ---- DnD ----
    function makeDraggable(el) {
        el.addEventListener('pointerdown', (ev) => startDrag(el, ev));
        el.addEventListener('click', (ev) => { ev.stopPropagation(); selectNode(el.id); });
    }
    function startDrag(el, ev) {
        if (ev.target.closest('.close')) return;
        ev.preventDefault();
        const rect = houseBody.getBoundingClientRect();
        const sx = ev.clientX, sy = ev.clientY;
        const ox = parseFloat(el.style.left || 0), oy = parseFloat(el.style.top || 0);
        try { el.setPointerCapture(ev.pointerId); } catch (_) { }
        el.classList.add('dragging');
        const move = (e) => {
            let nx = ox + (e.clientX - sx), ny = oy + (e.clientY - sy);
            const maxX = rect.width - el.offsetWidth - 6, maxY = rect.height - el.offsetHeight - 6;
            nx = Math.max(6, Math.min(maxX, nx)); ny = Math.max(6, Math.min(maxY, ny));
            el.style.left = nx + 'px'; el.style.top = ny + 'px'; updateLinesFor(el.id);
        };
        const up = () => {
            el.classList.remove('dragging');
            try { el.releasePointerCapture(ev.pointerId); } catch (_) { }
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
            if (el.classList.contains('device')) assignIpIfNeeded(el.id);
            if (!restoring) persistCanvas('drag');
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up);
    }

    // ---- ルータ/配線 ----
    function bindRouterEvents() {
        const r = document.getElementById('routerBadge'); if (!r) return;
        r.addEventListener('pointerdown', (ev) => { if (ev.target.classList.contains('port') || ev.target.closest('.close')) return; startDrag(r, ev); });
        r.addEventListener('click', (ev) => { if (ev.target.classList.contains('port') || ev.target.closest('.close')) return; selectNode('routerBadge'); });

        const lan = document.getElementById('routerPort1');
        lan.addEventListener('click', (e) => {
            if (!(state.cableMode && state.cableTool === 'rj45')) { setStatus('RJ45ツールを選択してください'); return; }
            state.pendingAnchor = 'routerPort1'; setStatus('RJ45：接続先の機器をクリック', 'on step'); e.stopPropagation();
        });
        lan.addEventListener('pointerdown', (e) => { if (!(state.cableMode && state.cableTool === 'rj45')) return; e.stopPropagation(); startCableDrag('lan', 'routerPort1', e); });

        const wan = document.getElementById('routerWan');
        wan.addEventListener('click', (e) => {
            if (!(state.cableMode && state.cableTool === 'rj45')) { setStatus('RJ45ツールを選択してください'); return; }
            state.pendingAnchor = 'routerWan'; setStatus('RJ45：ONU をクリックして接続', 'on step'); e.stopPropagation();
        });
        wan.addEventListener('pointerdown', (e) => { if (!(state.cableMode && state.cableTool === 'rj45')) return; e.stopPropagation(); startCableDrag('lan', 'routerWan', e); });
    }

    // 光アンカー
    if (wanAnchor) {
        wanAnchor.addEventListener('click', () => {
            if (!(state.cableMode && state.cableTool === 'fiber')) { setStatus('光ファイバーを選択してください'); return; }
            state.pendingAnchor = 'wanAnchor'; setStatus('光：ONU をクリック', 'on step');
        });
        wanAnchor.addEventListener('pointerdown', (e) => { if (!(state.cableMode && state.cableTool === 'fiber')) return; startCableDrag('fiber', 'wanAnchor', e); });
    }

    // クリック終端
    houseBody.addEventListener('click', (e) => {
        if (!state.cableMode || !state.pendingAnchor) return;
        const t = e.target.closest('.device') || document.elementFromPoint(e.clientX, e.clientY)?.closest('.device'); if (!t) return;

        if (state.pendingAnchor === 'routerPort1' && state.cableTool === 'rj45') {
            createCable('routerPort1', t.id, 'lan'); setDeviceMode(t.id, 'lan'); setStatus('RJ45：完了', 'on');
        } else if (state.pendingAnchor === 'routerWan' && state.cableTool === 'rj45') {
            const d = state.devices[t.id]; if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
            createCable('routerWan', t.id, 'lan'); t.querySelector('.ip').textContent = 'WAN接続済み'; setStatus('RJ45：WAN 接続完了', 'on');
        } else if (state.pendingAnchor === 'wanAnchor' && state.cableTool === 'fiber') {
            const d = state.devices[t.id]; if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
            createCable('wanAnchor', t.id, 'fiber'); t.querySelector('.ip').textContent = 'WAN接続済み'; setStatus('光：完了', 'on');
        }
        state.pendingAnchor = null;
    });

    // 仮線→確定
    function startCableDrag(kind, startAnchor, ev) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cable', kind === 'fiber' ? 'fiber' : 'lan'); line.style.pointerEvents = 'none';
        cableSvg.appendChild(line); state.tempCable = { kind, startAnchor, line };
        const move = (e) => {
            const p1 = anchorXY(startAnchor); const cv = houseBody.getBoundingClientRect();
            line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y); line.setAttribute('x2', e.clientX - cv.left); line.setAttribute('y2', e.clientY - cv.top);
        };
        const up = (e) => {
            document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up);
            line.remove(); state.tempCable = null;
            const t = document.elementFromPoint(e.clientX, e.clientY)?.closest('.device'); if (!t) return;
            if (startAnchor === 'routerPort1' && kind === 'lan') { createCable('routerPort1', t.id, 'lan'); setDeviceMode(t.id, 'lan'); setStatus('RJ45：完了', 'on'); }
            else if (startAnchor === 'routerWan' && kind === 'lan') {
                const d = state.devices[t.id]; if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
                createCable('routerWan', t.id, 'lan'); t.querySelector('.ip').textContent = 'WAN接続済み'; setStatus('RJ45：WAN 接続完了', 'on');
            }
            else if (startAnchor === 'wanAnchor' && kind === 'fiber') {
                const d = state.devices[t.id]; if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
                createCable('wanAnchor', t.id, 'fiber'); t.querySelector('.ip').textContent = 'WAN接続済み'; setStatus('光：完了', 'on');
            }
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up, { once: true });
    }

    // 実線生成
    function createCable(a, b, kind) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cable', kind === 'fiber' ? 'fiber' : 'lan'); line.style.pointerEvents = '';
        cableSvg.appendChild(line);
        const id = `cable-${++cableUid}`;
        const conn = { id, lineEl: line, a, b, kind }; state.connections.push(conn);
        updateLine(conn);
        log('createCable', { id, a, b, kind }, 'connections=', dumpConnections());
        if (!restoring) {
            syncEdgesToStore('createCable', { force: true });
            persistCanvas('createCable');
        }
        line.addEventListener('click', (ev) => { ev.stopPropagation(); selectCable(id); });
    }

    // 選択
    function selectCable(id) {
        state.selectedCableId = id; state.selectedId = null;
        document.querySelectorAll('.cable').forEach(l => l.classList.remove('selected'));
        const c = state.connections.find(v => v.id === id); if (c) c.lineEl.classList.add('selected');
        document.querySelectorAll('.device,.router').forEach(d => d.classList.remove('selected'));
    }

    // 線再計算
    function updateLinesFor(elId) {
        if (elId === 'routerBadge') { state.connections.filter(c => c.a === 'routerPort1' || c.a === 'routerWan').forEach(updateLine); return; }
        state.connections.filter(c => c.a === elId || c.b === elId).forEach(updateLine);
    }
    function updateLine(c) {
        const p1 = anchorXY(c.a), p2 = anchorXY(c.b); if (!p1 || !p2) return;
        c.lineEl.setAttribute('x1', p1.x); c.lineEl.setAttribute('y1', p1.y);
        c.lineEl.setAttribute('x2', p2.x); c.lineEl.setAttribute('y2', p2.y);
    }

    // アンカー座標
    function anchorXY(a) {
        const cv = houseBody.getBoundingClientRect();
        if (a === 'routerPort1') { const n = document.getElementById('routerPort1'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 }; }
        if (a === 'routerWan') { const n = document.getElementById('routerWan'); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 }; }
        if (a === 'wanAnchor') { const r = wanAnchor.getBoundingClientRect(); return { x: r.right - cv.left, y: r.top - cv.top + r.height / 2 }; }
        const el = document.getElementById(a); if (!el) return null; const r = el.getBoundingClientRect();
        return { x: r.left - cv.left + 8, y: r.top - cv.top + r.height / 2 };
    }

    // IP割当
    function assignIpIfNeeded(id) {
        const d = state.devices[id]; if (!d) return;
        if (d.ip) return;
        if (d.mode === 'wlan' && !state.wifi.configured) return;
        const pool = (d.mode === 'lan' ? state.poolLan : state.poolWlan);
        d.ip = pool.base + (pool.next++);
        const el = document.querySelector(`#${id} .ip`); if (el) el.textContent = d.ip;
        if (!restoring) persistCanvas('ip-assign');
    }
    function setDeviceMode(id, mode) {
        const d = state.devices[id]; if (!d) return;
        d.mode = mode;
        const el = document.getElementById(id);
        el.classList.remove('wlan', 'lan'); el.classList.add(mode);
        d.ip = null; assignIpIfNeeded(id);
        if (!restoring) persistCanvas('mode');
    }

    const labelOf = (t) => ({ pc: 'PC', phone: 'スマホ', game: 'ゲーム機', tablet: 'タブレット', printer: 'プリンタ(有線)', onu: 'ONU' }[t] || t);

    // 選択/削除
    function selectNode(id) {
        state.selectedId = id; state.selectedCableId = null;
        document.querySelectorAll('.cable').forEach(l => l.classList.remove('selected'));
        document.querySelectorAll('.device').forEach(d => d.classList.toggle('selected', d.id === id));
        const r = document.getElementById('routerBadge'); if (r) r.classList.toggle('selected', id === 'routerBadge');
    }
    function deleteDevice(id) {
        const el = document.getElementById(id); if (!el) return;
        state.connections = state.connections.filter(c => { const hit = (c.a === id || c.b === id); if (hit) c.lineEl.remove(); return !hit; });
        delete state.devices[id]; el.remove();
        if (state.selectedId === id) state.selectedId = null;
        log('deleteDevice', id, 'connections=', dumpConnections());
        syncEdgesToStore('deleteDevice', { force: true, destructive: true });
        if (!restoring) persistCanvas('deleteDevice');
    }
    function deleteRouter() {
        const r = document.getElementById('routerBadge'); if (!r) return;
        state.connections.slice().forEach(c => { if (c.a === 'routerPort1' || c.a === 'routerWan') c.lineEl.remove(); });
        state.connections = state.connections.filter(c => c.a !== 'routerPort1' && c.a !== 'routerWan');
        r.remove(); if (state.selectedId === 'routerBadge') state.selectedId = null; state.pendingAnchor = null;
        log('deleteRouter', 'connections=', dumpConnections());
        syncEdgesToStore('deleteRouter', { force: true, destructive: true });
        if (!restoring) persistCanvas('deleteRouter');
    }
    function deleteCable(id) {
        const i = state.connections.findIndex(c => c.id === id);
        if (i >= 0) {
            state.connections[i].lineEl.remove(); state.connections.splice(i, 1); state.selectedCableId = null; setStatus('ケーブル削除', 'on');
            log('deleteCable', id, 'connections=', dumpConnections());
            syncEdgesToStore('deleteCable', { force: true, destructive: true });
            if (!restoring) persistCanvas('deleteCable');
        }
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (state.selectedCableId) { e.preventDefault(); deleteCable(state.selectedCableId); return; }
            if (state.selectedId) { e.preventDefault(); (state.selectedId === 'routerBadge' ? deleteRouter() : deleteDevice(state.selectedId)); }
        }
    });

    // ---- 判定・保存 ----
    function dumpConnections() {
        return state.connections.map(c => ({
            id: c.id, kind: c.kind, a: c.a, b: c.b,
            aType: (state.devices[c.a]?.type) || c.a,
            bType: (state.devices[c.b]?.type) || c.b
        }));
    }
    function computeEdges() {
        const edges = { fiberOnu: false, onuRouter: false, routerPc: false };
        log('computeEdges: START', dumpConnections());
        for (const c of state.connections) {
            if (c.kind === 'fiber' && (c.a === 'wanAnchor' || c.b === 'wanAnchor')) {
                const other = (c.a === 'wanAnchor') ? c.b : c.a; const t = state.devices[other]?.type;
                log('  chk fiber wanAnchor <->', other, 'type=', t);
                if (t === 'onu') edges.fiberOnu = true;
            }
            if (c.kind === 'lan' && (c.a === 'routerWan' || c.b === 'routerWan')) {
                const other = (c.a === 'routerWan') ? c.b : c.a; const t = state.devices[other]?.type;
                log('  chk RJ45 routerWan <->', other, 'type=', t);
                if (t === 'onu') edges.onuRouter = true;
            }
            if (c.kind === 'lan' && (c.a === 'routerPort1' || c.b === 'routerPort1')) {
                const other = (c.a === 'routerPort1') ? c.b : c.a; const t = state.devices[other]?.type;
                log('  chk RJ45 routerPort1 <->', other, 'type=', t);
                if (t === 'pc') edges.routerPc = true;
            }
        }
        log('computeEdges: RESULT', edges);
        return edges;
    }

    function anyTrue(e) { return !!(e?.fiberOnu || e?.onuRouter || e?.routerPc); }
    function allFalse(e) { return !e?.fiberOnu && !e?.onuRouter && !e?.routerPc; }

    let _lastJson = '';

    function hardWrite(edges) {
        if (!global.AppStore) { warn('AppStore 未定義'); return; }
        const s = AppStore.get() || { v: 1 };
        const before = JSON.parse(JSON.stringify(s.home?.edges || {}));
        s.home = s.home || {};
        s.home.edges = { fiberOnu: !!edges.fiberOnu, onuRouter: !!edges.onuRouter, routerPc: !!edges.routerPc };
        const e = s.home.edges;
        s.home.reach = {
            internet: !!(e.fiberOnu && e.onuRouter && e.routerPc),
            count: (e.fiberOnu ? 1 : 0) + (e.onuRouter ? 1 : 0) + (e.routerPc ? 1 : 0)
        };
        s.summary = s.summary || {};
        s.summary.homeOK = !!(e.fiberOnu && e.onuRouter && e.routerPc);
        s.updatedAt = new Date().toISOString();
        AppStore.set(s);
        log('hardWrite set(): before→after', before, '→', s.home.edges, 'reach=', s.home.reach, 'homeOK=', s.summary.homeOK);
    }

    function syncEdgesToStore(reason = 'manual', opts = {}) {
        const { force = false, destructive = false } = opts;
        const computed = computeEdges();
        const prev = (global.AppStore && AppStore.get())?.home?.edges || null;

        let next = computed;
        if (!destructive && prev && anyTrue(prev)) {
            next = {
                fiberOnu: prev.fiberOnu || computed.fiberOnu,
                onuRouter: prev.onuRouter || computed.onuRouter,
                routerPc: prev.routerPc || computed.routerPc
            };
            if (allFalse(computed) && anyTrue(prev)) {
                log('syncEdgesToStore: 非破壊 → 既存Trueを保持（ダウングレード禁止）');
            }
        }

        const json = JSON.stringify(next);
        if (!force && json === _lastJson) { log('syncEdgesToStore: 変更なし skip'); return; }
        log('syncEdgesToStore:', reason, next);

        if (global.HomeEdges && typeof HomeEdges.set === 'function') {
            try { HomeEdges.set(next); log('via HomeEdges.set'); }
            catch (err) { warn('HomeEdges.set 失敗 → hardWrite', err); hardWrite(next); }
        } else {
            hardWrite(next);
        }

        _lastJson = json;
        try {
            const snap = (global.AppStore && AppStore.get()) || null;
            log('after write snapshot', { edges: snap?.home?.edges, reach: snap?.home?.reach, homeOK: snap?.summary?.homeOK, updatedAt: snap?.updatedAt });
        } catch (e) { warn('snapshot失敗', e); }
    }

    // ---- キャンバス保存/復元 ----
    function elementXY(id) {
        const el = (id === 'routerBadge') ? document.getElementById('routerBadge') : document.getElementById(id);
        if (!el) return { x: 0, y: 0 };
        return { x: parseFloat(el.style.left || 0), y: parseFloat(el.style.top || 0) };
    }

    function snapshotCanvas() {
        const routerEl = document.getElementById('routerBadge');
        const router = routerEl ? { x: parseFloat(routerEl.style.left || 0), y: parseFloat(routerEl.style.top || 0) } : null;
        const devices = {};
        Object.keys(state.devices).forEach(id => {
            const d = state.devices[id];
            const pos = elementXY(id);
            devices[id] = { type: d.type, mode: d.mode, ip: d.ip, x: pos.x, y: pos.y };
        });
        const connections = state.connections.map(c => ({ a: c.a, b: c.b, kind: c.kind }));
        return { router, devices, connections, wifi: state.wifi };
    }

    function persistCanvas(reason) {
        if (restoring) return;
        const snap = snapshotCanvas();
        if (!global.AppStore || !AppStore.patch) { warn('AppStore.patch 未定義'); return; }
        AppStore.patch(d => {
            if (!d.home) d.home = {};
            d.home.canvas = snap;
        });
        log('persistCanvas:', reason, snap);
    }

    function restoreCanvasFromStore() {
        const s = global.AppStore && AppStore.get();
        const cv = s?.home?.canvas;
        if (!cv) return;
        restoring = true;

        if (cv.wifi) state.wifi = cv.wifi;
        if (cv.router) spawnRouterAt(cv.router.x, cv.router.y);

        const ids = Object.keys(cv.devices || {});
        const maxIdNum = (ids.map(x => (x.match(/-(\d+)$/)?.[1] || 0)).map(n => +n).reduce((a, b) => Math.max(a, b), 0)) || 0;
        uid = Math.max(uid, maxIdNum);
        ids.forEach(id => spawnDeviceSnapshot(id, cv.devices[id]));

        (cv.connections || []).forEach(c => { createCable(c.a, c.b, c.kind); });

        restoring = false;
        persistCanvas('restore');
        syncEdgesToStore('restore', { force: true });
        log('restoreCanvasFromStore: done');
    }

    // ---- 初期化 ----
    document.addEventListener('DOMContentLoaded', restoreCanvasFromStore);

    // ---- 手動デバッグ ----
    global.HomeDebug = {
        dump() {
            const diag = {
                devices: JSON.parse(JSON.stringify(state.devices)),
                connections: dumpConnections(),
                edges: computeEdges(),
                canvas: snapshotCanvas(),
                store: (global.AppStore && AppStore.get()) || null
            };
            (console[CH] || console.log).call(console, '[HOME][DUMP]', diag);
            return diag;
        },
        syncNow() { syncEdgesToStore('manualSync', { force: true }); },
        saveNow() { persistCanvas('manual'); }
    };

})(window);
