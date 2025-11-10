/* =========================================================
 * home.js  自宅Wi-Fiミニシミュレータ
 * 目的:
 *  - 機器生成/移動/削除、RJ45/光ケーブル接続
 *  - 配線状態を AppStore へ同期（HomeEdges.set）
 * ========================================================= */

// ---- 状態 ----
const state = {
    wifi: { ssid: null, password: null, enc: null, b24: true, b5: false, configured: false },
    poolWlan: { base: '192.168.0.', next: 100 },
    poolLan: { base: '192.168.10.', next: 10 },
    devices: {},               // id -> {type, ip, mode}
    connections: [],           // {id,lineEl,a,b,kind}
    selectedId: null,
    selectedCableId: null,
    cableMode: false,
    cableTool: null,           // 'rj45' | 'fiber'
    pendingAnchor: null,
    tempCable: null
};

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
const setStatus = (txt, cls = '') => {
    const b = $('#cableStatus'); if (!b) return;
    b.textContent = `接続ステータス: ${txt}`;
    b.className = `badge ${cls}`;
};

// ---- Wi-Fi 設定 ----
$('#wifiForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const ssid = $('#ssid').value.trim();
    const pw = $('#password').value;
    const enc = $('#enc').value;
    const b24 = $('#b24').checked;
    const b5 = $('#b5').checked;
    const hint = $('#wifiHint');

    if (!ssid || pw.length < 8 || (!b24 && !b5)) {
        hint.textContent = 'SSID/パスワード/周波数帯を確認してください。';
        return;
    }
    state.wifi = { ssid, password: pw, enc, b24, b5, configured: true };
    const lbl = document.querySelector('#routerBadge .router-label');
    if (lbl) lbl.innerHTML = `Router<br><small>${ssid} / ${enc}${b5 ? ' / 5GHz' : ''}${b24 ? ' / 2.4GHz' : ''}</small>`;
    hint.textContent = '適用しました。';
});

// ---- パレット ----
document.querySelectorAll('.palette-item').forEach(btn => {
    btn.addEventListener('pointerdown', (ev) => {
        const tool = btn.dataset.tool;
        if (tool) { enableCableTool(btn, tool); return; }
        const el = spawnDevice(btn.dataset.type);
        if (el) startDrag(el, ev);
    });
});

function enableCableTool(node, tool) {
    state.cableMode = true;
    state.cableTool = tool;
    $('#cableToggle').checked = true;
    document.querySelectorAll('.palette-item.tool').forEach(el => {
        el.classList.toggle('tool-active', el.dataset.tool === tool);
    });
    state.pendingAnchor = null;
    setStatus(`${tool.toUpperCase()} 選択`, 'on step');
}

$('#cableToggle').addEventListener('change', (e) => {
    state.cableMode = e.target.checked;
    if (!state.cableMode) {
        state.cableTool = null;
        state.pendingAnchor = null;
        document.querySelectorAll('.palette-item.tool').forEach(el => el.classList.remove('tool-active'));
        setStatus('OFF');
    } else {
        enableCableTool(document.querySelector('.palette-item.tool[data-tool="rj45"]'), 'rj45');
    }
});

// ---- 機器生成 ----
let uid = 0, cableUid = 0;

function spawnDevice(type) {
    // ルータは1台まで
    if (type === 'router') {
        if (document.getElementById('routerBadge')) { alert('ルーターは1台までです。'); return null; }
        const el = document.createElement('div');
        el.className = 'router';
        el.id = 'routerBadge';
        el.style.left = '140px'; el.style.top = '220px';
        el.innerHTML = `
      <img class="router-img" src="${IMG.router}" onerror="this.style.display='none'" alt="">
      <div class="router-label">Router<br><small>${state.wifi.configured ? (state.wifi.ssid + ' / ' + state.wifi.enc) : '未設定'}</small></div>
      <span id="routerWan"  class="port wan" title="WANポート"></span>
      <span id="routerPort1" class="port" title="LANポート"></span>
      <button class="close" title="削除">×</button>`;
        houseBody.appendChild(el);
        bindRouterEvents();
        el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); deleteRouter(); });
        return el;
    }

    const id = `dev-${type}-${++uid}`;
    const el = document.createElement('div');
    el.className = 'device wlan' + (type === 'onu' ? ' onu' : '');
    el.dataset.type = type;
    el.id = id;

    const img = IMG[type]
        ? `<div class="thumb"><img src="${IMG[type]}" onerror="this.style.display='none'" alt=""></div>`
        : `<div class="thumb"></div>`;

    el.innerHTML = `
    ${img}
    <div class="label">${labelOf(type)}</div>
    <span class="ip">${type === 'onu' ? 'WAN未接続' : '未接続'}</span>
    <button class="close" title="削除">×</button>`;
    el.style.left = '330px';
    el.style.top = '120px';

    houseBody.appendChild(el);
    state.devices[id] = { type, ip: null, mode: (type === 'printer' ? 'lan' : 'wlan') };

    el.querySelector('.close').addEventListener('click', (e) => { e.stopPropagation(); deleteDevice(id); });
    makeDraggable(el);
    assignIpIfNeeded(id);
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

    el.setPointerCapture(ev.pointerId);
    el.classList.add('dragging');

    const move = (e) => {
        let nx = ox + (e.clientX - sx);
        let ny = oy + (e.clientY - sy);
        const maxX = rect.width - el.offsetWidth - 6;
        const maxY = rect.height - el.offsetHeight - 6;
        nx = Math.max(6, Math.min(maxX, nx));
        ny = Math.max(6, Math.min(maxY, ny));
        el.style.left = nx + 'px';
        el.style.top = ny + 'px';
        updateLinesFor(el.id);
    };
    const up = () => {
        el.classList.remove('dragging');
        el.releasePointerCapture(ev.pointerId);
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        if (el.classList.contains('device')) assignIpIfNeeded(el.id);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
}

// ---- ルータイベント/配線 ----
function bindRouterEvents() {
    const r = document.getElementById('routerBadge');
    if (!r) return;

    r.addEventListener('pointerdown', (ev) => {
        if (ev.target.classList.contains('port') || ev.target.closest('.close')) return;
        startDrag(r, ev);
    });
    r.addEventListener('click', (ev) => {
        if (ev.target.classList.contains('port') || ev.target.closest('.close')) return;
        selectNode('routerBadge');
    });

    const lan = document.getElementById('routerPort1');
    lan.addEventListener('click', (e) => {
        if (!(state.cableMode && state.cableTool === 'rj45')) { setStatus('RJ45ツールを選択してください'); return; }
        state.pendingAnchor = 'routerPort1';
        setStatus('RJ45：接続先の機器をクリック', 'on step');
        e.stopPropagation();
    });
    lan.addEventListener('pointerdown', (e) => {
        if (!(state.cableMode && state.cableTool === 'rj45')) return;
        e.stopPropagation(); startCableDrag('lan', 'routerPort1', e);
    });

    const wan = document.getElementById('routerWan');
    wan.addEventListener('click', (e) => {
        if (!(state.cableMode && state.cableTool === 'rj45')) { setStatus('RJ45ツールを選択してください'); return; }
        state.pendingAnchor = 'routerWan';
        setStatus('RJ45：ONU をクリックして接続', 'on step');
        e.stopPropagation();
    });
    wan.addEventListener('pointerdown', (e) => {
        if (!(state.cableMode && state.cableTool === 'rj45')) return;
        e.stopPropagation(); startCableDrag('lan', 'routerWan', e);
    });
}

// 光アンカー
wanAnchor.addEventListener('click', () => {
    if (!(state.cableMode && state.cableTool === 'fiber')) { setStatus('光ファイバーを選択してください'); return; }
    state.pendingAnchor = 'wanAnchor';
    setStatus('光：ONU をクリック', 'on step');
});
wanAnchor.addEventListener('pointerdown', (e) => {
    if (!(state.cableMode && state.cableTool === 'fiber')) return;
    startCableDrag('fiber', 'wanAnchor', e);
});

// クリック終端
houseBody.addEventListener('click', (e) => {
    if (!state.cableMode || !state.pendingAnchor) return;
    const t = e.target.closest('.device') || document.elementFromPoint(e.clientX, e.clientY)?.closest('.device');
    if (!t) return;

    if (state.pendingAnchor === 'routerPort1' && state.cableTool === 'rj45') {
        createCable('routerPort1', t.id, 'lan');
        setDeviceMode(t.id, 'lan');
        setStatus('RJ45：完了', 'on');
    } else if (state.pendingAnchor === 'routerWan' && state.cableTool === 'rj45') {
        const d = state.devices[t.id];
        if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
        createCable('routerWan', t.id, 'lan');
        t.querySelector('.ip').textContent = 'WAN接続済み';
        setStatus('RJ45：WAN 接続完了', 'on');
    } else if (state.pendingAnchor === 'wanAnchor' && state.cableTool === 'fiber') {
        const d = state.devices[t.id];
        if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
        createCable('wanAnchor', t.id, 'fiber');
        t.querySelector('.ip').textContent = 'WAN接続済み';
        setStatus('光：完了', 'on');
    }
    state.pendingAnchor = null;
});

// 仮線 → 確定
function startCableDrag(kind, startAnchor, ev) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('cable', kind === 'fiber' ? 'fiber' : 'lan');
    line.style.pointerEvents = 'none';
    cableSvg.appendChild(line);
    state.tempCable = { kind, startAnchor, line };

    const move = (e) => {
        const p1 = anchorXY(startAnchor);
        const cv = houseBody.getBoundingClientRect();
        line.setAttribute('x1', p1.x);
        line.setAttribute('y1', p1.y);
        line.setAttribute('x2', e.clientX - cv.left);
        line.setAttribute('y2', e.clientY - cv.top);
    };
    const up = (e) => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        line.remove();
        state.tempCable = null;

        const elAt = document.elementFromPoint(e.clientX, e.clientY);
        const t = elAt && elAt.closest('.device');
        if (!t) return;

        if (startAnchor === 'routerPort1' && kind === 'lan') {
            createCable('routerPort1', t.id, 'lan');
            setDeviceMode(t.id, 'lan');
            setStatus('RJ45：完了', 'on');
        } else if (startAnchor === 'routerWan' && kind === 'lan') {
            const d = state.devices[t.id]; if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
            createCable('routerWan', t.id, 'lan');
            t.querySelector('.ip').textContent = 'WAN接続済み';
            setStatus('RJ45：WAN 接続完了', 'on');
        } else if (startAnchor === 'wanAnchor' && kind === 'fiber') {
            const d = state.devices[t.id]; if (!d || d.type !== 'onu') { alert('ONU を選択してください。'); return; }
            createCable('wanAnchor', t.id, 'fiber');
            t.querySelector('.ip').textContent = 'WAN接続済み';
            setStatus('光：完了', 'on');
        }
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
}

// 実線生成
function createCable(a, b, kind) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('cable', kind === 'fiber' ? 'fiber' : 'lan');
    line.style.pointerEvents = '';
    cableSvg.appendChild(line);

    const id = `cable-${++cableUid}`;
    const conn = { id, lineEl: line, a, b, kind };
    state.connections.push(conn);
    updateLine(conn);
    syncEdgesToStore("createCable");


    line.addEventListener('click', (ev) => { ev.stopPropagation(); selectCable(id); });

    // 配線確定 => ストア同期
    syncEdgesToStore();
}

// 選択
function selectCable(id) {
    state.selectedCableId = id;
    state.selectedId = null;
    document.querySelectorAll('.cable').forEach(l => l.classList.remove('selected'));
    const c = state.connections.find(v => v.id === id);
    if (c) c.lineEl.classList.add('selected');
    document.querySelectorAll('.device,.router').forEach(d => d.classList.remove('selected'));
}

// 線再計算
function updateLinesFor(elId) {
    if (elId === 'routerBadge') {
        state.connections
            .filter(c => c.a === 'routerPort1' || c.a === 'routerWan')
            .forEach(updateLine);
        return;
    }
    state.connections.filter(c => c.a === elId || c.b === elId).forEach(updateLine);
}
function updateLine(c) {
    const p1 = anchorXY(c.a), p2 = anchorXY(c.b);
    if (!p1 || !p2) return;
    c.lineEl.setAttribute('x1', p1.x);
    c.lineEl.setAttribute('y1', p1.y);
    c.lineEl.setAttribute('x2', p2.x);
    c.lineEl.setAttribute('y2', p2.y);
}

// アンカー座標
function anchorXY(a) {
    const cv = houseBody.getBoundingClientRect();

    if (a === 'routerPort1') {
        const n = document.getElementById('routerPort1'); if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
    }
    if (a === 'routerWan') {
        const n = document.getElementById('routerWan'); if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
    }
    if (a === 'wanAnchor') {
        const r = wanAnchor.getBoundingClientRect();
        return { x: r.right - cv.left, y: r.top - cv.top + r.height / 2 };
    }
    const el = document.getElementById(a); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - cv.left + 8, y: r.top - cv.top + r.height / 2 };
}

// IP割当
function assignIpIfNeeded(id) {
    const d = state.devices[id]; if (!d) return;
    if (d.ip) return;
    if (d.mode === 'wlan' && !state.wifi.configured) return;

    const ip = nextIp(d.mode === 'lan' ? state.poolLan : state.poolWlan);
    d.ip = ip;
    const el = document.querySelector(`#${id} .ip`);
    if (el) el.textContent = ip;
}
function setDeviceMode(id, mode) {
    const d = state.devices[id]; if (!d) return;
    d.mode = mode;
    const el = document.getElementById(id);
    el.classList.remove('wlan', 'lan');
    el.classList.add(mode);
    d.ip = null;
    assignIpIfNeeded(id);
}
const nextIp = (pool) => (pool.base + (pool.next++));

// ラベル
const labelOf = (t) =>
    ({ pc: 'PC', phone: 'スマホ', game: 'ゲーム機', tablet: 'タブレット', printer: 'プリンタ(有線)', onu: 'ONU' }[t] || t);

// 選択/削除
function selectNode(id) {
    state.selectedId = id;
    state.selectedCableId = null;
    document.querySelectorAll('.cable').forEach(l => l.classList.remove('selected'));
    document.querySelectorAll('.device').forEach(d => d.classList.toggle('selected', d.id === id));
    const r = document.getElementById('routerBadge');
    if (r) r.classList.toggle('selected', id === 'routerBadge');
}

function deleteDevice(id) {
    const el = document.getElementById(id); if (!el) return;
    state.connections = state.connections.filter(c => {
        const hit = (c.a === id || c.b === id);
        if (hit) c.lineEl.remove();
        return !hit;
    });
    delete state.devices[id];
    el.remove();
    if (state.selectedId === id) state.selectedId = null;
    syncEdgesToStore("deleteDevice");
}

function deleteRouter() {
    const r = document.getElementById('routerBadge'); if (!r) return;
    state.connections.slice().forEach(c => {
        if (c.a === 'routerPort1' || c.a === 'routerWan') c.lineEl.remove();
    });
    state.connections = state.connections.filter(c => c.a !== 'routerPort1' && c.a !== 'routerWan');
    r.remove();
    if (state.selectedId === 'routerBadge') state.selectedId = null;
    state.pendingAnchor = null;
    syncEdgesToStore("deleteRouter");
}

function deleteCable(id) {
    const i = state.connections.findIndex(c => c.id === id);
    if (i >= 0) {
        state.connections[i].lineEl.remove();
        state.connections.splice(i, 1);
        state.selectedCableId = null;
        setStatus('ケーブル削除', 'on');
        syncEdgesToStore("deleteCable");
    }
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.selectedCableId) { e.preventDefault(); deleteCable(state.selectedCableId); return; }
        if (state.selectedId) { e.preventDefault(); (state.selectedId === 'routerBadge' ? deleteRouter() : deleteDevice(state.selectedId)); }
    }
});

// ユーティリティ
$('#powerCycle').addEventListener('click', () => {
    const id = state.selectedId;
    if (!id || id === 'routerBadge') { alert('端末を選択してください。'); return; }
    const d = state.devices[id]; if (!d) return;
    d.ip = null; assignIpIfNeeded(id);
});
$('#showIPs').addEventListener('click', () => {
    const s = Object.values(state.devices).map(v => `${labelOf(v.type)} (${v.mode}) : ${v.ip ?? '未接続'}`).join('\n');
    alert('現在の IP 一覧:\n' + (s || 'デバイスが未配置です'));
});

// 初期
setStatus('OFF');

// ストア同期
// ====== 追記：差分検知つきストア同期 ======
let _lastSentEdgesJson = "";
let _syncTimer = null;

/**
 * 現在の state.connections からエッジを再計算し、必要時のみ AppStore へ反映
 * @param {string} reason - デバッグ用の同期理由（createCable/deleteCable等）
 * @param {boolean} force - true で差分が無くても強制同期
 */
function syncEdgesToStore(reason = "manual", force = false) {
    if (!window.HomeEdges || !window.AppStore) return;

    // 現在の配線からエッジを再計算
    const edges = { fiberOnu: false, onuRouter: false, routerPc: false };
    for (const c of state.connections) {
        // 光(外部) ⇄ ONU
        if (c.kind === "fiber" && (c.a === "wanAnchor" || c.b === "wanAnchor")) {
            const other = (c.a === "wanAnchor") ? c.b : c.a;
            if (state.devices[other]?.type === "onu") edges.fiberOnu = true;
        }
        // ルータWAN ⇄ ONU
        if (c.kind === "lan" && (c.a === "routerWan" || c.b === "routerWan")) {
            const other = (c.a === "routerWan") ? c.b : c.a;
            if (state.devices[other]?.type === "onu") edges.onuRouter = true;
        }
        // ルータLAN ⇄ PC
        if (c.kind === "lan" && (c.a === "routerPort1" || c.b === "routerPort1")) {
            const other = (c.a === "routerPort1") ? c.b : c.a;
            if (state.devices[other]?.type === "pc") edges.routerPc = true;
        }
    }

    // 差分チェック
    const json = JSON.stringify(edges);
    if (!force && json === _lastSentEdgesJson) return;

    // 1タスクにまとめる（連続操作の書き込みを1回へ）
    if (_syncTimer) cancelAnimationFrame(_syncTimer);
    _syncTimer = requestAnimationFrame(() => {
        try {
            HomeEdges.set(edges); // ← summary/homeOK は store 側で自動計算
            // 任意のメタ（最終同期理由/時刻）を付与しておくと診断が楽
            AppStore.patch(d => {
                d.home = d.home || {};
                d.home.meta = d.home.meta || {};
                d.home.meta.lastSyncAt = new Date().toISOString();
                d.home.meta.lastSyncReason = reason;
            });
            _lastSentEdgesJson = json;
            // 同タブ内UIへフックしたい場合（任意）
            document.dispatchEvent(new CustomEvent("home:edges-synced", { detail: { edges, reason } }));
        } finally {
            _syncTimer = null;
        }
    });
}
window.addEventListener("beforeunload", () => { try { syncEdgesToStore("beforeunload", true); } catch (e) { } });
window.addEventListener('load', () => { try { syncEdgesToStore(); } catch { } });
