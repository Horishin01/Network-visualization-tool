/* ===============================
   会社ネットワーク構築 – 簡易/完全
   =============================== */
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);

const state = {
    mode: 'simple',
    tool: null,                 // 'rj45' | 'fiber'
    connectMode: false,
    nodes: {},                 // id -> {type, el, ipWan, ipLan, flags, ports}
    connections: [],           // {id, kind, a:{id,port}, b:{id,port|null}, el}
    pools: { wan: { base: '203.0.113.', next: 10 }, lan: { base: '10.0.0.', next: 20 } },
    temp: null
};

const stage = $('#officeStage');
const svg = $('#cableSvg');
const fiberDot = $('#fiberAnchor');
const palBtns = $$('.pal');
const connectToggle = $('#connectToggle');
const statusEl = $('#connectStatus');

function status(txt) { statusEl.textContent = `接続: ${txt}`; }
function nextIp(pool) { return pool.base + (pool.next++); }
function byId(id) { return document.getElementById(id); }

// パレット
palBtns.forEach(btn => {
    const tool = btn.dataset.tool;
    if (tool) {
        btn.addEventListener('click', () => { if (!connectToggle.checked) { connectToggle.checked = true; state.connectMode = true; } setTool(tool); });
    } else {
        btn.addEventListener('click', () => spawnNode(btn.dataset.type));
    }
});
function setTool(tool) {
    state.tool = tool;
    $$('.pal.tool').forEach(b => b.classList.toggle('active', b.dataset.tool === tool));
    status(tool ? `${tool.toUpperCase()} 選択中` : (state.connectMode ? 'ON' : 'OFF'));
}

// モード切替
$('#modeSimple').addEventListener('change', () => setUIMode('simple'));
$('#modePro').addEventListener('change', () => setUIMode('pro'));
function setUIMode(mode) {
    state.mode = mode;
    $$('.palette > *').forEach(el => {
        const m = el.dataset?.mode || (el.tagName === 'HR' ? el.getAttribute('data-mode') : 'both');
        const show = (m === 'both') || (m === 'pro' && mode === 'pro');
        el.classList.toggle('hidden', !show);
    });
}

// 接続モード
connectToggle.addEventListener('change', (e) => {
    state.connectMode = e.target.checked;
    if (!state.connectMode) setTool(null);
    status(state.connectMode ? (state.tool ? state.tool.toUpperCase() + ' 選択中' : 'ON') : 'OFF');
});

// ノード生成
let uid = 0;
function spawnNode(type) {
    const id = `n${++uid}`;
    const el = document.createElement('div');
    el.className = `node ${type} ${(['pc', 'web', 'dns', 'db', 'mail'].includes(type)) ? 'dev' : ''}`;
    el.id = id;

    const titleMap = { onu: 'ONU', router: '社内ルータ', pc: '社員PC', web: 'Webサーバ', dns: 'DNSサーバ', db: 'DBサーバ', mail: 'Mailサーバ', fw: 'Firewall' };
    el.innerHTML = `
    <button class="close" title="削除">×</button>
    <div class="title">${titleMap[type] || type.toUpperCase()}</div>
    <div class="body"></div>`;
    stage.appendChild(el);

    el.style.left = (140 + Math.random() * 140) + 'px';
    el.style.top = (120 + Math.random() * 120) + 'px';

    const ports = {};
    if (type === 'onu') {
        const rj = document.createElement('span'); rj.className = 'anchor rj'; rj.dataset.port = 'rj45'; el.appendChild(rj); ports.rj45 = rj;
    } else if (type === 'router') {
        const wan = document.createElement('span'); wan.className = 'anchor wan'; wan.dataset.port = 'wan'; el.appendChild(wan); ports.wan = wan;
        const lan = document.createElement('span'); lan.className = 'anchor rj'; lan.dataset.port = 'lan'; el.appendChild(lan); ports.lan = lan;
    } else {
        const lan = document.createElement('span'); lan.className = 'anchor rj'; lan.dataset.port = 'lan'; el.appendChild(lan); ports.lan = lan;
    }

    const node = state.nodes[id] = { id, type, el, ports, ipWan: null, ipLan: null, flags: { wanUp: false, wanConnected: false } };
    refreshLabel(node);
    bindNodeEvents(node);
}
function refreshLabel(n) {
    const b = n.el.querySelector('.body');
    if (n.type === 'onu') {
        b.innerHTML = n.flags.wanUp ? `WAN接続済み / IP:<br>${n.ipWan}` : `WAN未接続`;
    } else if (n.type === 'router') {
        const wan = n.flags.wanConnected ? `WAN接続 / IP: ${n.ipWan}` : `WAN未接続`;
        const lan = n.ipLan ? ` / LAN: ${n.ipLan}` : ` / LAN: 未割当`;
        b.innerHTML = `${wan}${lan}`;
    } else {
        b.textContent = n.ipLan ? `IP: ${n.ipLan}` : `未設定`;
    }
}
function bindNodeEvents(n) {
    const el = n.el;
    el.addEventListener('pointerdown', (e) => {
        if (e.target.classList.contains('anchor')) return;
        if (e.target.classList.contains('close')) return;
        startDragNode(n, e);
    });
    el.querySelector('.close').addEventListener('click', () => removeNode(n.id));
    Object.values(n.ports).forEach(anchor => {
        anchor.addEventListener('pointerdown', (e) => {
            if (!state.connectMode || !state.tool) return;
            e.stopPropagation();
            startCableDragFromAnchor(n.id, anchor.dataset.port, e);
        });
    });
}
function startDragNode(n, ev) {
    ev.preventDefault();
    const el = n.el;
    el.classList.add('dragging');
    const rect = stage.getBoundingClientRect();
    const sx = ev.clientX, sy = ev.clientY;
    const ox = parseFloat(el.style.left || 0), oy = parseFloat(el.style.top || 0);

    const move = (e) => {
        let nx = ox + (e.clientX - sx);
        let ny = oy + (e.clientY - sy);
        nx = Math.max(12, Math.min(nx, rect.width - el.offsetWidth - 12));
        ny = Math.max(12, Math.min(ny, rect.height - el.offsetHeight - 12));
        el.style.left = nx + 'px'; el.style.top = ny + 'px';
        updateLinesFor(n.id);
    };
    const up = () => {
        el.classList.remove('dragging');
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
}

// アンカー座標
function anchorXY(id, port) {
    if (id === 'fiber') {
        const r = fiberDot.getBoundingClientRect(); const cv = stage.getBoundingClientRect();
        return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
    }
    const n = state.nodes[id]; if (!n) return null;
    const ref = port ? n.ports[port] : n.el; if (!ref) return null;
    const r = ref.getBoundingClientRect(); const cv = stage.getBoundingClientRect();
    return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
}

// 仮線（RJ45）
function startCableDragFromAnchor(nodeId, port, ev) {
    const kind = state.tool; if (!kind) return;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('cable', kind === 'fiber' ? 'fiber' : 'rj45');
    line.style.pointerEvents = 'none';
    svg.appendChild(line);

    state.temp = { kind, lineEl: line, start: { id: nodeId, port } };

    const move = (e) => {
        const p1 = anchorXY(nodeId, port);
        const cv = stage.getBoundingClientRect();
        line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
        line.setAttribute('x2', e.clientX - cv.left); line.setAttribute('y2', e.clientY - cv.top);
    };
    const up = (e) => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        line.remove(); state.temp = null;

        if (kind === 'fiber') return; // 光は左起点のみ

        const elAt = document.elementFromPoint(e.clientX, e.clientY);
        const anc = elAt?.closest('.anchor');
        const ne = elAt?.closest('.node');
        if (anc && ne) {
            createRj45({ id: nodeId, port }, { id: ne.id, port: anc.dataset.port });
        } else {
            status('失敗：RJ45終端が見つかりません');
        }
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
}

// 光（左の点）からドラッグ
fiberDot.addEventListener('pointerdown', (ev) => {
    if (!state.connectMode || state.tool !== 'fiber') return;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('cable', 'fiber'); line.style.pointerEvents = 'none'; svg.appendChild(line);
    state.temp = { kind: 'fiber', lineEl: line, start: { id: 'fiber', port: null } };

    const move = (e) => {
        const p1 = anchorXY('fiber'); const cv = stage.getBoundingClientRect();
        line.setAttribute('x1', p1.x); line.setAttribute('y1', p1.y);
        line.setAttribute('x2', e.clientX - cv.left); line.setAttribute('y2', e.clientY - cv.top);
    };
    const up = (e) => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        line.remove(); state.temp = null;

        const nodeEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('.node');
        const targetId = nodeEl?.id;
        if (targetId && state.nodes[targetId]?.type === 'onu') {
            createFiber(targetId);
        } else {
            status('失敗：光はONUにのみ接続可能');
        }
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up, { once: true });
});

let cid = 0;
function existsConn(a, b, kind) {
    return state.connections.some(c => {
        const s = c.kind === kind &&
            ((c.a.id === a.id && c.a.port === a.port && c.b.id === b.id && c.b.port === b.port) ||
                (c.a.id === b.id && c.a.port === b.port && c.b.id === a.id && c.b.port === a.port));
        return s;
    });
}

// 光：fiber → ONU
function createFiber(onuId) {
    const onu = state.nodes[onuId]; if (!onu) { status('失敗：ONUが見つかりません'); return; }
    if (onu.flags.wanUp) { status('失敗：既に光接続済み'); return; }

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.classList.add('cable', 'fiber'); svg.appendChild(line);

    const conn = { id: `c${++cid}`, kind: 'fiber', a: { id: 'fiber', port: null }, b: { id: onu.id, port: null }, el: line };
    state.connections.push(conn);
    updateLine(conn);

    onu.flags.wanUp = true;
    onu.ipWan = nextIp(state.pools.wan);
    refreshLabel(onu);
    status('光：接続完了');
}

// RJ45：ONU rj45 ↔ Router WAN、Router LAN ↔ 端末 LAN
function createRj45(a, b) {
    const nA = state.nodes[a.id], nB = state.nodes[b.id];
    if (!nA || !nB) { status('失敗：ノードが不明'); return; }

    // ONU ↔ Router(WAN)
    if ((nA.type === 'onu' && a.port === 'rj45' && nB.type === 'router' && b.port === 'wan') ||
        (nB.type === 'onu' && b.port === 'rj45' && nA.type === 'router' && a.port === 'wan')) {
        const router = (nA.type === 'router') ? nA : nB;
        const onu = (nA.type === 'onu') ? nA : nB;

        if (!onu.flags.wanUp) { status('失敗：先に光をONUへ接続してください'); return; }
        if (router.flags.wanConnected) { status('失敗：ルータWANは既に接続済み'); return; }
        if (existsConn(a, b, 'rj45')) { status('失敗：同一RJ45接続が存在'); return; }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cable', 'rj45'); svg.appendChild(line);
        const conn = { id: `c${++cid}`, kind: 'rj45', a, b, el: line };
        state.connections.push(conn);
        updateLine(conn);

        router.flags.wanConnected = true;
        router.ipWan = nextIp(state.pools.wan);
        refreshLabel(router);
        status('RJ45：ONU→ルータWAN 接続完了');
        return;
    }

    // Router(LAN) ↔ 端末(LAN)
    const routerLanToDev =
        (nA.type === 'router' && a.port === 'lan' && b.port === 'lan' && nB.type !== 'onu') ||
        (nB.type === 'router' && b.port === 'lan' && a.port === 'lan' && nA.type !== 'onu');

    if (routerLanToDev) {
        const dev = (nA.type === 'router') ? nB : nA;
        if (existsConn(a, b, 'rj45')) { status('失敗：同一RJ45接続が存在'); return; }

        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cable', 'rj45'); svg.appendChild(line);
        const conn = { id: `c${++cid}`, kind: 'rj45', a, b, el: line };
        state.connections.push(conn);
        updateLine(conn);

        const router = (nA.type === 'router') ? nA : nB;
        if (!router.ipLan) { router.ipLan = '10.0.0.1'; refreshLabel(router); }
        if (!dev.ipLan) { dev.ipLan = nextIp(state.pools.lan); refreshLabel(dev); }
        status('RJ45：LAN 配下接続完了');
        return;
    }

    status('失敗：RJ45の組み合わせが不正です');
}

// 線更新
function updateLine(c) {
    const p1 = anchorXY(c.a.id, c.a.port);
    const p2 = anchorXY(c.b.id, c.b.port);
    if (!p1 || !p2) return;
    c.el.setAttribute('x1', p1.x); c.el.setAttribute('y1', p1.y);
    c.el.setAttribute('x2', p2.x); c.el.setAttribute('y2', p2.y);
}
function updateLinesFor(nodeId) {
    state.connections.forEach(c => {
        if (c.a.id === nodeId || c.b.id === nodeId) updateLine(c);
    });
}

// 削除
function removeNode(id) {
    const n = state.nodes[id]; if (!n) return;
    state.connections.slice().forEach(c => {
        if (c.a.id === id || c.b.id === id) { c.el.remove(); state.connections = state.connections.filter(x => x.id !== c.id); }
    });
    n.el.remove(); delete state.nodes[id];
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        const last = state.connections.pop();
        if (last) { last.el.remove(); status('ケーブル削除'); }
    }
});

// 補助
$('#btnShowIp').addEventListener('click', () => {
    const lines = Object.values(state.nodes).map(n => {
        if (n.type === 'onu') return `ONU : ${n.flags.wanUp ? `WAN ${n.ipWan}` : 'WAN未接続'}`;
        if (n.type === 'router') return `社内ルータ : ${n.flags.wanConnected ? `WAN ${n.ipWan}` : 'WAN未接続'} / LAN ${n.ipLan || '未割当'}`;
        return `${n.el.querySelector('.title').textContent} : ${n.ipLan || '未設定'}`;
    });
    alert(lines.join('\n') || 'ノードなし');
});
$('#btnReset').addEventListener('click', () => {
    state.connections.forEach(c => c.el.remove());
    state.connections = [];
    Object.values(state.nodes).forEach(n => n.el.remove());
    state.nodes = {};
    state.pools.wan.next = 10; state.pools.lan.next = 20;
    setTool(null); connectToggle.checked = false; state.connectMode = false; status('OFF');
});

// 起動
(function boot() {
    setUIMode('simple');
    setTool(null);
    connectToggle.checked = false; state.connectMode = false; status('OFF');
})();
