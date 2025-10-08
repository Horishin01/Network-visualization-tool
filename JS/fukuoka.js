// ==============================
// 状態管理
// ==============================
const state = {
    poolLan: { base: "192.168.50.", next: 10 },
    devices: {},                 // id -> {type, ip, mode:'lan'}
    connections: [],             // {id,lineEl,a,b,kind}
    selectedId: null,
    selectedCableId: null,
    cableMode: false,
    cableTool: null,             // 'rj45' | 'fiber'
    tempCable: null,
};

const $ = (q) => document.querySelector(q);
const branchBody = $("#branchBody");
const cableSvg = $("#cableSvg");
const wanAnchor = $("#wanAnchor");

let uid = 0, cableUid = 0;

// ==============================
// デバイス画像
// ==============================
const IMG = {
    router: "../img/devices/router.png",
    onu: "../img/devices/onu.png",
    pc: "../img/devices/pc.png",
    printer: "../img/devices/printer.png",
    dbserver: "../img/devices/db.png",
    webserver: "../img/devices/web.png",
    dnsserver: "../img/devices/dns.png",
    mailserver: "../img/devices/mail.png",
    fileserver: "../img/devices/file.png",
    monitor: "../img/devices/monitor.png",
    backup: "../img/devices/backup.png",
    firewall: "../img/devices/fw.png",
};

// ==============================
// ステータス表示
// ==============================
const setStatus = (txt, cls = "") => {
    const b = $("#cableStatus");
    b.textContent = `接続ステータス: ${txt}`;
    b.className = `badge ${cls}`;
};

// ==============================
// 機器生成
// ==============================
function spawnDevice(type) {
    if (type === "router" && document.getElementById("routerBadge")) {
        alert("ルータは1台までです。");
        return null;
    }

    const id = (type === "router") ? "routerBadge" : `dev-${type}-${++uid}`;
    const el = document.createElement("div");
    el.className = (type === "router") ? "router" : "device";
    el.dataset.type = type;
    el.id = id;

    if (type === "router") {
        el.innerHTML = `
          <img class="router-img" src="${IMG.router}" alt="">
          <div class="router-label">社内ルータ</div>
          <span id="routerWan" class="port wan" title="WANポート"></span>
          <span id="routerPort1" class="port lan" title="LANポート"></span>
          <button class="close">×</button>
        `;
    } else {
        el.innerHTML = `
          <img class="dev-img" src="${IMG[type] || ""}" alt="">
          <div class="label">${labelOf(type)}</div>
          <span class="ip">未接続</span>
          <button class="close">×</button>
        `;
    }

    el.style.left = "150px";
    el.style.top = "150px";
    branchBody.appendChild(el);

    state.devices[id] = { type, ip: null, mode: "lan" };

    makeDraggable(el);
    el.querySelector(".close").addEventListener("click", (e) => {
        e.stopPropagation();
        (id === "routerBadge") ? deleteRouter() : deleteDevice(id);
    });

    return el;
}

function labelOf(t) {
    return {
        router: "社内ルータ",
        onu: "ONU",
        pc: "社員PC",
        printer: "プリンタ",
        dbserver: "DBサーバ",
        webserver: "Webサーバ",
        dnsserver: "DNSサーバ",
        mailserver: "メールサーバ",
        fileserver: "ファイルサーバ",
        monitor: "監視サーバ",
        backup: "バックアップサーバ",
        firewall: "ファイアウォール",
    }[t] || t;
}

// ==============================
// ドラッグ＆ドロップ移動
// ==============================
function makeDraggable(el) {
    el.addEventListener("pointerdown", (ev) => startDrag(el, ev));
    el.addEventListener("click", (ev) => { ev.stopPropagation(); selectNode(el.id); });
}

function startDrag(el, ev) {
    if (ev.target.closest(".close") || ev.target.classList.contains("port")) return;

    const rect = branchBody.getBoundingClientRect();
    const sx = ev.clientX, sy = ev.clientY;
    const ox = parseFloat(el.style.left || 0), oy = parseFloat(el.style.top || 0);

    el.setPointerCapture(ev.pointerId);

    const move = (e) => {
        let nx = ox + (e.clientX - sx);
        let ny = oy + (e.clientY - sy);
        el.style.left = nx + "px";
        el.style.top = ny + "px";
        updateLinesFor(el.id);
    };
    const up = () => document.removeEventListener("pointermove", move);

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
}

// ==============================
// ケーブル接続（ドラッグ専用）
// ==============================
function startCableDrag(kind, startAnchor, ev) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("cable", kind === "fiber" ? "fiber" : "lan");
    line.style.pointerEvents = "none";
    cableSvg.appendChild(line);

    state.tempCable = { kind, startAnchor, line };

    const move = (e) => {
        const p1 = anchorXY(startAnchor);
        const cv = branchBody.getBoundingClientRect();
        line.setAttribute("x1", p1.x);
        line.setAttribute("y1", p1.y);
        line.setAttribute("x2", e.clientX - cv.left);
        line.setAttribute("y2", e.clientY - cv.top);
    };
    const up = (e) => {
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        line.remove();
        state.tempCable = null;

        const elAt = document.elementFromPoint(e.clientX, e.clientY);
        const t = elAt && elAt.closest(".device");
        if (!t) return;

        if (startAnchor === "routerPort1" && kind === "lan") {
            createCable("routerPort1", t.id, "lan");
            assignIpIfNeeded(t.id);
            setStatus("RJ45：LAN接続完了", "on");
        } else if (startAnchor === "routerWan" && kind === "lan") {
            const d = state.devices[t.id];
            if (!d || d.type !== "onu") { alert("ONUを選択してください"); return; }
            createCable("routerWan", t.id, "lan");
            t.querySelector(".ip").textContent = "WAN接続済み";
            setStatus("RJ45：WAN接続完了", "on");
        } else if (startAnchor === "wanAnchor" && kind === "fiber") {
            const d = state.devices[t.id];
            if (!d || d.type !== "onu") { alert("ONUを選択してください"); return; }
            createCable("wanAnchor", t.id, "fiber");
            t.querySelector(".ip").textContent = "WAN接続済み";
            setStatus("光ファイバー接続完了", "on");
        }
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
}

// ==============================
// ケーブル生成
// ==============================
function createCable(a, b, kind) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("cable", kind === "fiber" ? "fiber" : "lan");
    cableSvg.appendChild(line);

    const id = `cable-${++cableUid}`;
    const conn = { id, lineEl: line, a, b, kind };
    state.connections.push(conn);
    updateLine(conn);
}

// ==============================
// 座標計算
// ==============================
function anchorXY(a) {
    const cv = branchBody.getBoundingClientRect();
    if (a === "routerPort1" || a === "routerWan") {
        const n = document.getElementById(a);
        const r = n.getBoundingClientRect();
        return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
    }
    if (a === "wanAnchor") {
        const r = wanAnchor.getBoundingClientRect();
        return { x: r.right - cv.left, y: r.top - cv.top + r.height / 2 };
    }
    const el = document.getElementById(a);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - cv.left + 8, y: r.top - cv.top + r.height / 2 };
}

function updateLine(c) {
    const p1 = anchorXY(c.a), p2 = anchorXY(c.b);
    if (!p1 || !p2) return;
    c.lineEl.setAttribute("x1", p1.x);
    c.lineEl.setAttribute("y1", p1.y);
    c.lineEl.setAttribute("x2", p2.x);
    c.lineEl.setAttribute("y2", p2.y);
}

function updateLinesFor(elId) {
    state.connections.filter(c => c.a === elId || c.b === elId).forEach(updateLine);
}

// ==============================
// IP 割当
// ==============================
function assignIpIfNeeded(id) {
    const d = state.devices[id];
    if (!d || d.ip) return;
    const ip = nextIp(state.poolLan);
    d.ip = ip;
    const el = document.querySelector(`#${id} .ip`);
    if (el) el.textContent = ip;
}
const nextIp = (pool) => (pool.base + (pool.next++));

// ==============================
// 選択・削除
// ==============================
function selectNode(id) {
    state.selectedId = id;
    state.selectedCableId = null;
    document.querySelectorAll(".device,.router").forEach(d => d.classList.remove("selected"));
    const el = document.getElementById(id);
    if (el) el.classList.add("selected");
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
}

function deleteRouter() {
    const r = document.getElementById("routerBadge"); if (!r) return;
    state.connections = state.connections.filter(c => {
        const hit = (c.a === "routerPort1" || c.a === "routerWan");
        if (hit) c.lineEl.remove();
        return !hit;
    });
    r.remove();
}

function deleteCable(id) {
    const i = state.connections.findIndex(c => c.id === id);
    if (i >= 0) {
        state.connections[i].lineEl.remove();
        state.connections.splice(i, 1);
        state.selectedCableId = null;
        setStatus("ケーブル削除", "on");
    }
}

document.addEventListener("keydown", (e) => {
    if (e.key === "Delete" || e.key === "Backspace") {
        if (state.selectedCableId) { deleteCable(state.selectedCableId); return; }
        if (state.selectedId) { (state.selectedId === "routerBadge" ? deleteRouter() : deleteDevice(state.selectedId)); }
    }
});

// ==============================
// ユーティリティ
// ==============================
$("#powerCycle").addEventListener("click", () => {
    const id = state.selectedId;
    if (!id) { alert("端末を選択してください"); return; }
    const d = state.devices[id]; if (!d) return;
    d.ip = null; assignIpIfNeeded(id);
});

$("#showIPs").addEventListener("click", () => {
    const s = Object.values(state.devices)
        .map(v => `${labelOf(v.type)} : ${v.ip ?? "未接続"}`)
        .join("\n");
    alert("現在の IP 一覧:\n" + (s || "デバイスが未配置です"));
});

// ==============================
// パレット操作
// ==============================
document.querySelectorAll(".palette-item").forEach(btn => {
    btn.addEventListener("click", () => {
        if (btn.dataset.tool) {
            state.cableMode = true;
            state.cableTool = btn.dataset.tool;
            setStatus(`${state.cableTool.toUpperCase()}ツール選択中`, "on");
        } else {
            spawnDevice(btn.dataset.type);
        }
    });
});

// ==============================
// ポート操作開始
// ==============================
branchBody.addEventListener("pointerdown", (ev) => {
    if (!state.cableMode) return;
    const id = ev.target.id;
    if (id === "routerPort1" && state.cableTool === "rj45") {
        startCableDrag("lan", "routerPort1", ev);
    }
    if (id === "routerWan" && state.cableTool === "rj45") {
        startCableDrag("lan", "routerWan", ev);
    }
    if (id === "wanAnchor" && state.cableTool === "fiber") {
        startCableDrag("fiber", "wanAnchor", ev);
    }
});
