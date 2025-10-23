/* =========================
   状態
========================= */
const state = {
    devices: {},               // id -> {type:'onu'|'router', ipWan, ipLan, flags:{}}
    connections: [],           // {id, kind:'rj45'|'fiber', a:{id,port}|'wan', b:{id,port}, el}
    selectedNodeId: null,
    selectedCableId: null,
    tool: null,                // 'rj45' | 'fiber'
    connectMode: false,
    draggingTemp: null,        // {kind,start, line}
    uid: 0,
    cuid: 0
};

/* =========================
   DOM
========================= */
const $ = q => document.querySelector(q);
const stage = $("#stage");
const svg = $("#cableSvg");
const wanAnchor = $("#wanAnchor");
const connectToggle = $("#connectToggle");
const statusEl = $("#connectStatus");

/* =========================
   右ペイン：追加/ツール
========================= */
document.querySelectorAll(".pal").forEach(btn => {
    btn.addEventListener("click", () => {
        const type = btn.dataset.type;
        const tool = btn.dataset.tool;
        if (tool) { setTool(tool); return; }
        spawnNode(type);
    });
});

connectToggle.addEventListener("change", e => {
    state.connectMode = e.target.checked;
    if (!state.connectMode) { setTool(null); status("OFF"); }
    else { setTool("rj45"); }
});

function setTool(tool) {
    state.tool = tool;
    document.querySelectorAll(".pal.tool").forEach(p => {
        p.classList.toggle("tool-active", p.dataset.tool === tool);
    });
    if (!tool) { status("OFF"); return; }
    status(tool === "rj45"
        ? "RJ45：始点ポートを押し → 目的ノードへドラッグ"
        : "光：左の『光』から ONU(光) へドラッグ");
}

/* =========================
   便利表示
========================= */
function status(t) { statusEl.textContent = "接続: " + t; }
$("#showIPs")?.addEventListener("click", () => {
    const lines = Object.values(state.devices).map(d => {
        if (d.type === "onu") return `ONU : WAN ${d.flags.wanUp ? d.ipWan : "(未接続)"}`;
        if (d.type === "router") {
            const wan = d.flags.wanConnected ? `接続(${d.ipWan})` : "未接続";
            const lan = d.ipLan || "(未割当)";
            return `社内ルータ : WAN ${wan} / LAN ${lan}`;
        }
        return "";
    });
    alert(lines.join("\n") || "ノードなし");
});

/* =========================
   ノード生成
========================= */
function nextId(prefix) { return `${prefix}-${++state.uid}`; }

function spawnNode(type) {
    const id = nextId(type);
    const el = document.createElement("div");
    el.className = `node ${type}`;
    el.id = id;
    el.style.left = (220 + Math.random() * 160 | 0) + "px";
    el.style.top = (140 + Math.random() * 160 | 0) + "px";

    const title = type === "onu" ? "ONU" : "社内ルータ";
    el.innerHTML = `
    <button class="close" title="削除">×</button>
    <div class="title">${title}</div>
    <div class="small" id="${id}-info">未設定</div>
  `;

    // ポート
    if (type === "onu") {
        el.appendChild(makePortEl(id, "fiber", "fiber")); // 光
        el.appendChild(makePortEl(id, "lan", "wan"));     // RJ45 (橙)
    } else {
        el.appendChild(makePortEl(id, "wan", "wan"));     // WAN(橙)
        el.appendChild(makePortEl(id, "lan", "lan"));     // LAN(緑)
    }

    stage.appendChild(el);

    state.devices[id] = {
        id, type, ipWan: null, ipLan: null,
        flags: { wanUp: false, rj45ToOnu: false, wanConnected: false }
    };

    enableDrag(el);
    el.addEventListener("click", ev => {
        if (ev.target.classList.contains("close")) return;
        selectNode(id);
    });
    el.querySelector(".close").addEventListener("click", ev => {
        ev.stopPropagation(); removeNode(id);
    });

    refreshInfo(id);
    return el;
}

function makePortEl(id, port, cls) {
    const p = document.createElement("span");
    p.className = `port ${cls}`;
    p.dataset.id = id;
    p.dataset.port = port;

    // ドラッグ開始
    p.addEventListener("pointerdown", e => {
        if (!state.connectMode || !state.tool) return;

        if (state.tool === "rj45") {
            if (!isRj45StartAllowed(id, port)) return;
            e.preventDefault();
            state.draggingTemp = { kind: "rj45", start: { id, port }, line: makeTempLine("rj45") };
            followPointerDrag(e);
            status("RJ45：目的ノードへドラッグして離す");
        } else {
            status("光は左の『光』から開始してください");
        }
    });

    return p;
}

/* =========================
   ノードのドラッグ
========================= */
function enableDrag(el) {
    el.addEventListener("pointerdown", e => {
        if (e.target.classList.contains("port") || e.target.classList.contains("close")) return;
        e.preventDefault();
        const rect = stage.getBoundingClientRect();
        const sx = e.clientX, sy = e.clientY;
        const ox = parseFloat(el.style.left || 0), oy = parseFloat(el.style.top || 0);
        el.setPointerCapture(e.pointerId);
        el.classList.add("dragging");
        const move = ev => {
            let nx = ox + (ev.clientX - sx), ny = oy + (ev.clientY - sy);
            const maxX = rect.width - el.offsetWidth - 4;
            const maxY = rect.height - el.offsetHeight - 4;
            nx = Math.max(4, Math.min(maxX, nx));
            ny = Math.max(4, Math.min(maxY, ny));
            el.style.left = nx + "px"; el.style.top = ny + "px";
            updateLinesFor(el.id);
        };
        const up = () => {
            el.classList.remove("dragging");
            el.releasePointerCapture(e.pointerId);
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", up);
        };
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", up);
    });
}

/* =========================
   ケーブル：ドラッグ（光開始）
========================= */
wanAnchor.addEventListener("pointerdown", e => {
    if (!(state.connectMode && state.tool === "fiber")) return;
    e.preventDefault();
    state.draggingTemp = { kind: "fiber", start: "wan", line: makeTempLine("fiber") };
    followPointerDrag(e);
    status("光：ONU(光) へドラッグして離す");
});

/* 共通：ポインタ追従して確定 */
function followPointerDrag(startEvent) {
    const move = ev => {
        const p1 = getAnchorXY(state.draggingTemp.start);
        const p2 = pointerXY(ev);
        drawLine(state.draggingTemp.line, p1, p2);
    };
    const up = ev => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);

        if (!state.draggingTemp) { return; }
        const kind = state.draggingTemp.kind;

        if (kind === "rj45") {
            const start = state.draggingTemp.start;
            const end = resolveRj45DropTarget(ev, start);
            if (end) { finalizeRJ45(start, end); }
            else { cancelTemp(); status("RJ45：始点ポートから目的ノードへドラッグ"); }
        } else {
            const end = resolveFiberDropTarget(ev);
            if (end) { finalizeFiber(end); }
            else { cancelTemp(); status("光：左の『光』→ ONU(光)"); }
        }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
}

function pointerXY(ev) {
    const r = stage.getBoundingClientRect();
    return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

function cancelTemp() {
    if (state.draggingTemp?.line) state.draggingTemp.line.remove();
    state.draggingTemp = null;
}

/* ---- ドロップ判定：RJ45 ---- */
function resolveRj45DropTarget(ev, start) {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const portEl = hit?.closest?.(".port");
    if (portEl) {
        const target = { id: portEl.dataset.id, port: portEl.dataset.port };
        if (isPairRj45(start, target)) return target;
    }
    const nodeEl = hit?.closest?.(".node");
    if (nodeEl) {
        const tid = nodeEl.id;
        const ttype = state.devices[tid]?.type;
        if (start && state.devices[start.id]) {
            const stype = state.devices[start.id].type;
            if (stype === "onu" && start.port === "lan" && ttype === "router") return { id: tid, port: "wan" };
            if (stype === "router" && start.port === "wan" && ttype === "onu") return { id: tid, port: "lan" };
        }
    }
    return null;
}
function finalizeRJ45(a, b) {
    if (connectionExists("rj45", a, b)) { cancelTemp(); status("RJ45：既に接続済み"); return; }
    createCable({ kind: "rj45", a, b });
    cancelTemp();
    recomputeLinks();
    status("RJ45：接続完了");
}

/* ---- ドロップ判定：光 ---- */
function resolveFiberDropTarget(ev) {
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    const portEl = hit?.closest?.(".port");
    if (portEl && state.devices[portEl.dataset.id]?.type === "onu" && portEl.dataset.port === "fiber") {
        return { id: portEl.dataset.id, port: "fiber" };
    }
    const nodeEl = hit?.closest?.(".node");
    if (nodeEl && state.devices[nodeEl.id]?.type === "onu") { return { id: nodeEl.id, port: "fiber" }; }
    return null;
}
function finalizeFiber(end) {
    if (connectionExists("fiber", "wan", end)) { cancelTemp(); status("光：既に接続済み"); return; }
    createCable({ kind: "fiber", a: "wan", b: end });
    cancelTemp();
    recomputeLinks();
    status("光：接続完了");
}

function isRj45StartAllowed(id, port) {
    const t = state.devices[id]?.type;
    return (t === "onu" && port === "lan") || (t === "router" && port === "wan");
}
function isPairRj45(a, b) {
    const ta = state.devices[a.id]?.type;
    const tb = state.devices[b.id]?.type;
    return ta === "onu" && a.port === "lan" && tb === "router" && b.port === "wan";
}

/* =========================
   ケーブル生成・更新
========================= */
function makeTempLine(kind) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("cable", kind === "fiber" ? "fiber" : "rj45");
    line.style.pointerEvents = "none";
    svg.appendChild(line);
    const p = { x: 0, y: 0 }; drawLine(line, p, p);
    return line;
}
function createCable({ kind, a, b }) {
    const id = `c${++state.cuid}`;
    const el = document.createElementNS("http://www.w3.org/2000/svg", "line");
    el.classList.add("cable", kind === "fiber" ? "fiber" : "rj45");
    el.id = id;
    svg.appendChild(el);
    const conn = { id, kind, a, b, el };
    state.connections.push(conn);
    el.addEventListener("click", ev => { ev.stopPropagation(); selectCable(id); });
    updateLine(conn);
}
function updateLinesFor(nodeId) {
    state.connections.filter(c => c.a?.id === nodeId || c.b?.id === nodeId).forEach(updateLine);
}
function updateLine(c) {
    const p1 = getAnchorXY(c.a);
    const p2 = getAnchorXY(c.b);
    drawLine(c.el, p1, p2);
}
function drawLine(el, p1, p2) {
    el.setAttribute("x1", p1.x); el.setAttribute("y1", p1.y);
    el.setAttribute("x2", p2.x); el.setAttribute("y2", p2.y);
}
function getAnchorXY(arg) {
    const rect = stage.getBoundingClientRect();
    if (arg === "wan") {
        const r = wanAnchor.getBoundingClientRect();
        return { x: r.right - rect.left, y: r.top - rect.top + r.height / 2 };
    }
    const { id, port } = arg;
    const node = document.getElementById(id);
    const p = node.querySelector(`.port[data-port="${port}"]`);
    const r = p.getBoundingClientRect();
    return { x: r.left - rect.left + r.width / 2, y: r.top - rect.top + r.height / 2 };
}

/* =========================
   接続の再計算（判定の中枢）
========================= */
function recomputeLinks() {
    // 初期化
    Object.values(state.devices).forEach(d => {
        d.flags.wanUp = false;
        d.flags.rj45ToOnu = false;
        d.flags.wanConnected = false;
        if (d.type === "onu") d.ipWan = null;
        if (d.type === "router") d.ipWan = null;
    });

    // 接続スキャン
    const r2o = new Map(); // routerId -> onuId（RJ45）
    state.connections.forEach(c => {
        if (c.kind === "fiber" && c.b && state.devices[c.b.id]?.type === "onu") {
            const onu = state.devices[c.b.id];
            onu.flags.wanUp = true;
            onu.ipWan = "203.0.113.10";
        }
        if (c.kind === "rj45") {
            const rid = state.devices[c.a.id]?.type === "router" ? c.a.id : c.b.id;
            const oid = state.devices[c.a.id]?.type === "onu" ? c.a.id : c.b.id;
            if (rid && oid) { r2o.set(rid, oid); }
        }
    });

    // 依存判定（RJ45 + ONUのWANUp で Router WAN接続）
    r2o.forEach((oid, rid) => {
        const r = state.devices[rid];
        const o = state.devices[oid];
        r.flags.rj45ToOnu = true;
        if (o?.flags.wanUp) {
            r.flags.wanConnected = true;
            r.ipWan = o.ipWan;
        }
    });

    // 表示更新
    Object.keys(state.devices).forEach(refreshInfo);
}

function connectionExists(kind, a, b) {
    // 端点の順序を正規化
    const key = (x) => (x === "wan") ? "wan" : `${x.id}:${x.port}`;
    const A = key(a), B = key(b);
    return state.connections.some(c => {
        if (c.kind !== kind) return false;
        const cA = key(c.a), cB = key(c.b);
        return (A === cA && B === cB) || (A === cB && B === cA);
    });
}

/* =========================
   選択/削除
========================= */
function selectNode(id) {
    state.selectedNodeId = id; state.selectedCableId = null;
    document.querySelectorAll(".node").forEach(n => n.classList.toggle("selected", n.id === id));
    document.querySelectorAll(".cable").forEach(c => c.classList.remove("selected"));
}
function selectCable(id) {
    state.selectedCableId = id; state.selectedNodeId = null;
    document.querySelectorAll(".node").forEach(n => n.classList.remove("selected"));
    document.querySelectorAll(".cable").forEach(c => c.classList.toggle("selected", c.id === id));
}

document.addEventListener("keydown", e => {
    if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selectedCableId) { removeCable(state.selectedCableId); }
        else if (state.selectedNodeId) { removeNode(state.selectedNodeId); }
    }
});

function removeCable(id) {
    const i = state.connections.findIndex(c => c.id === id);
    if (i < 0) return;
    state.connections[i].el.remove();
    state.connections.splice(i, 1);
    state.selectedCableId = null;
    recomputeLinks();
}

function removeNode(id) {
    state.connections.filter(c => c.a?.id === id || c.b?.id === id).map(c => c.id).forEach(removeCable);
    document.getElementById(id)?.remove();
    delete state.devices[id];
    state.selectedNodeId = null;
    recomputeLinks();
}

/* =========================
   ラベル更新
========================= */
function refreshInfo(id) {
    const d = state.devices[id]; if (!d) return;
    const info = document.getElementById(`${id}-info`);
    if (d.type === "onu") {
        info.textContent = d.flags.wanUp ? `WAN接続済み / IP: ${d.ipWan}` : "WAN未接続";
    } else if (d.type === "router") {
        const wan = d.flags.wanConnected ? `WAN接続 / IP: ${d.ipWan}` : "WAN未接続";
        const lan = d.ipLan ? `LAN: ${d.ipLan}` : "LAN: 未割当";
        info.textContent = `${wan} / ${lan}`;
    }
}

/* =========================
   初期
========================= */
status("OFF");
