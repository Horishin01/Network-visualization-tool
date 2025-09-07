// ==============================
//  状態
// ==============================
const state = {
    wifi: { ssid: null, password: null, enc: null, b24: true, b5: false, configured: false },
    poolWlan: { base: "192.168.0.", next: 100 },
    poolLan: { base: "192.168.10.", next: 10 },
    devices: {},                 // id -> {type, ip, mode:'wlan'|'lan'}
    connections: [],             // {id,lineEl,a:'routerPort1'|'routerWan'|'wanAnchor', b:deviceId, kind:'lan'|'fiber'}
    selectedId: null,            // device/router id
    selectedCableId: null,       // cable id
    cableMode: false,
    cableTool: null,             // 'rj45' | 'fiber'
    pendingAnchor: null,         // click 接続の開始点
    tempCable: null              // drag 中の仮ケーブル
};

// DOM ショートカット
const $ = (q) => document.querySelector(q);
const houseBody = $("#houseBody");
const cableSvg = $("#cableSvg");
const wanAnchor = $("#wanAnchor");

// デバイス画像（存在しない場合は文字だけ表示）
const IMG = {
    pc: "../img/devices/pc.png",
    phone: "../img/devices/phone.png",
    tablet: "../img/devices/tablet.png",
    game: "../img/devices/game.png",
    printer: "../img/devices/printer.png",
    router: "../img/devices/router.png",
    onu: "../img/devices/onu.png"
};

// ログ（任意）
const log = (msg) => {
    const el = $("#log");
    if (!el) return;
    el.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}<br>` + el.innerHTML;
};
const setStatus = (txt, cls = "") => {
    const b = $("#cableStatus");
    b.textContent = `接続ステータス: ${txt}`;
    b.className = `badge ${cls}`;
};

// ==============================
//  Wi-Fi 設定
// ==============================
$("#wifiForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const ssid = $("#ssid").value.trim();
    const pw = $("#password").value;
    const enc = $("#enc").value;
    const b24 = $("#b24").checked;
    const b5 = $("#b5").checked;
    const hint = $("#wifiHint");

    if (!ssid || pw.length < 8 || (!b24 && !b5)) {
        hint.textContent = "SSID/パスワード/周波数帯を確認してください。";
        return;
    }

    state.wifi = { ssid, password: pw, enc, b24, b5, configured: true };
    const lbl = document.querySelector("#routerBadge .router-label");
    if (lbl) lbl.innerHTML = `Router<br><small>${ssid} / ${enc}${b5 ? " / 5GHz" : ""}${b24 ? " / 2.4GHz" : ""}</small>`;
    hint.textContent = "適用しました。";
});

// ==============================
//  パレット（機器生成 & ケーブルツール）
// ==============================
document.querySelectorAll(".palette-item").forEach(btn => {
    btn.addEventListener("pointerdown", (ev) => {
        const tool = btn.dataset.tool;
        if (tool) { enableCableTool(btn, tool); return; }
        const el = spawnDevice(btn.dataset.type);
        if (el) startDrag(el, ev);
    });
});

function enableCableTool(node, tool) {
    state.cableMode = true;
    state.cableTool = tool; // 'rj45' | 'fiber'
    $("#cableToggle").checked = true;
    document.querySelectorAll(".palette-item.tool").forEach(el => {
        el.classList.toggle("tool-active", el.dataset.tool === tool);
    });
    state.pendingAnchor = null;

    const next = (tool === "rj45")
        ? "ルータのポートをクリック → 接続先をクリック"
        : "左の『光』をクリック → ONU をクリック";
    setStatus(`${tool.toUpperCase()} 選択。${next}`, "on step");
}

$("#cableToggle").addEventListener("change", (e) => {
    state.cableMode = e.target.checked;
    if (!state.cableMode) {
        state.cableTool = null;
        state.pendingAnchor = null;
        document.querySelectorAll(".palette-item.tool").forEach(el => el.classList.remove("tool-active"));
        setStatus("OFF");
    } else {
        enableCableTool(document.querySelector('.palette-item.tool[data-tool="rj45"]'), "rj45");
    }
});

// ==============================
//  機器生成
// ==============================
let uid = 0, cableUid = 0;

function spawnDevice(type) {
    // ルーターは1台制限
    if (type === "router") {
        if (document.getElementById("routerBadge")) { alert("ルーターは1台までです。"); return null; }
        const el = document.createElement("div");
        el.className = "router";
        el.id = "routerBadge";
        el.style.left = "140px"; el.style.top = "220px";
        el.innerHTML = `
      <img class="router-img" src="${IMG.router}" onerror="this.style.display='none'" alt="">
      <div class="router-label">Router<br><small>${state.wifi.configured ? (state.wifi.ssid + " / " + state.wifi.enc) : "未設定"}</small></div>
      <span id="routerWan"  class="port wan" title="WANポート"></span>
      <span id="routerPort1" class="port"     title="LANポート"></span>
      <button class="close" title="削除">×</button>
    `;
        houseBody.appendChild(el);
        bindRouterEvents();
        el.querySelector(".close").addEventListener("click", (e) => { e.stopPropagation(); deleteRouter(); });
        return el;
    }

    const id = `dev-${type}-${++uid}`;
    const el = document.createElement("div");
    el.className = "device wlan" + (type === "onu" ? " onu" : "");
    el.dataset.type = type;
    el.id = id;

    const img = IMG[type]
        ? `<div class="thumb"><img src="${IMG[type]}" onerror="this.style.display='none'" alt=""></div>`
        : `<div class="thumb"></div>`;

    el.innerHTML = `
    ${img}
    <div class="label">${labelOf(type)}</div>
    <span class="ip">${type === "onu" ? "WAN未接続" : "未接続"}</span>
    <button class="close" title="削除">×</button>
  `;
    el.style.left = "330px";
    el.style.top = "120px";

    houseBody.appendChild(el);
    state.devices[id] = { type, ip: null, mode: (type === "printer" ? "lan" : "wlan") };

    el.querySelector(".close").addEventListener("click", (e) => { e.stopPropagation(); deleteDevice(id); });
    makeDraggable(el);
    assignIpIfNeeded(id);
    return el;
}

// ==============================
//  ドラッグ＆ドロップ
// ==============================
function makeDraggable(el) {
    el.addEventListener("pointerdown", (ev) => startDrag(el, ev));
    el.addEventListener("click", (ev) => { ev.stopPropagation(); selectNode(el.id); });
}

function startDrag(el, ev) {
    if (ev.target.closest(".close")) return;
    ev.preventDefault();

    const rect = houseBody.getBoundingClientRect();
    const sx = ev.clientX, sy = ev.clientY;
    const ox = parseFloat(el.style.left || 0), oy = parseFloat(el.style.top || 0);

    el.setPointerCapture(ev.pointerId);
    el.classList.add("dragging");

    const move = (e) => {
        let nx = ox + (e.clientX - sx);
        let ny = oy + (e.clientY - sy);
        const maxX = rect.width - el.offsetWidth - 6;
        const maxY = rect.height - el.offsetHeight - 6;
        nx = Math.max(6, Math.min(maxX, nx));
        ny = Math.max(6, Math.min(maxY, ny));
        el.style.left = nx + "px";
        el.style.top = ny + "px";
        updateLinesFor(el.id);
    };
    const up = () => {
        el.classList.remove("dragging");
        el.releasePointerCapture(ev.pointerId);
        document.removeEventListener("pointermove", move);
        document.removeEventListener("pointerup", up);
        if (el.classList.contains("device")) assignIpIfNeeded(el.id);
    };

    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
}

// ==============================
//  ケーブル（クリック / ドラッグ）
// ==============================
function bindRouterEvents() {
    const r = document.getElementById("routerBadge");
    if (!r) return;

    // ルータ本体ドラッグ
    r.addEventListener("pointerdown", (ev) => {
        if (ev.target.classList.contains("port") || ev.target.closest(".close")) return;
        startDrag(r, ev);
    });
    r.addEventListener("click", (ev) => {
        if (ev.target.classList.contains("port") || ev.target.closest(".close")) return;
        selectNode("routerBadge");
    });

    // LAN
    const lan = document.getElementById("routerPort1");
    lan.addEventListener("click", (e) => {
        if (!(state.cableMode && state.cableTool === "rj45")) { setStatus("RJ45ツールを選択してください"); return; }
        state.pendingAnchor = "routerPort1";
        setStatus("RJ45：接続先の機器をクリック", "on step");
        e.stopPropagation();
    });
    lan.addEventListener("pointerdown", (e) => {
        if (!(state.cableMode && state.cableTool === "rj45")) return;
        e.stopPropagation(); startCableDrag("lan", "routerPort1", e);
    });

    // WAN
    const wan = document.getElementById("routerWan");
    wan.addEventListener("click", (e) => {
        if (!(state.cableMode && state.cableTool === "rj45")) { setStatus("RJ45ツールを選択してください"); return; }
        state.pendingAnchor = "routerWan";
        setStatus("RJ45：ONU をクリックして接続", "on step");
        e.stopPropagation();
    });
    wan.addEventListener("pointerdown", (e) => {
        if (!(state.cableMode && state.cableTool === "rj45")) return;
        e.stopPropagation(); startCableDrag("lan", "routerWan", e);
    });
}

// 光アンカー（常時表示）
wanAnchor.addEventListener("click", () => {
    if (!(state.cableMode && state.cableTool === "fiber")) {
        setStatus("光ファイバーを選択してください");
        return;
    }
    state.pendingAnchor = "wanAnchor";
    setStatus("光：ONU をクリック", "on step");
});
wanAnchor.addEventListener("pointerdown", (e) => {
    if (!(state.cableMode && state.cableTool === "fiber")) return;
    startCableDrag("fiber", "wanAnchor", e);
});

// クリックで終端接続（安全に要素取得）
houseBody.addEventListener("click", (e) => {
    if (!state.cableMode || !state.pendingAnchor) return;
    const t = e.target.closest(".device") || document.elementFromPoint(e.clientX, e.clientY)?.closest(".device");
    if (!t) return;

    if (state.pendingAnchor === "routerPort1" && state.cableTool === "rj45") {
        createCable("routerPort1", t.id, "lan");
        setDeviceMode(t.id, "lan");
        setStatus("RJ45：完了", "on");
    } else if (state.pendingAnchor === "routerWan" && state.cableTool === "rj45") {
        const d = state.devices[t.id];
        if (!d || d.type !== "onu") { alert("ONU を選択してください。"); return; }
        createCable("routerWan", t.id, "lan");
        t.querySelector(".ip").textContent = "WAN接続済み";
        setStatus("RJ45：WAN 接続完了", "on");
    } else if (state.pendingAnchor === "wanAnchor" && state.cableTool === "fiber") {
        const d = state.devices[t.id];
        if (!d || d.type !== "onu") { alert("ONU を選択してください。"); return; }
        createCable("wanAnchor", t.id, "fiber");
        t.querySelector(".ip").textContent = "WAN接続済み";
        setStatus("光：完了", "on");
    }
    state.pendingAnchor = null;
});

// ドラッグ配線（仮の線を引き、UP で確定）
function startCableDrag(kind, startAnchor, ev) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("cable", kind === "fiber" ? "fiber" : "lan");
    // 仮線はクリックを拾わせない（下のデバイスを正しく検出するため）
    line.style.pointerEvents = "none";
    cableSvg.appendChild(line);
    state.tempCable = { kind, startAnchor, line };

    const move = (e) => {
        const p1 = anchorXY(startAnchor);
        const cv = houseBody.getBoundingClientRect();
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

        // SVGや線が前面でも確実に終端要素を拾う
        const elAt = document.elementFromPoint(e.clientX, e.clientY);
        const t = elAt && elAt.closest(".device");
        if (!t) return;

        if (startAnchor === "routerPort1" && kind === "lan") {
            createCable("routerPort1", t.id, "lan");
            setDeviceMode(t.id, "lan");
            setStatus("RJ45：完了", "on");
        } else if (startAnchor === "routerWan" && kind === "lan") {
            const d = state.devices[t.id]; if (!d || d.type !== "onu") { alert("ONU を選択してください。"); return; }
            createCable("routerWan", t.id, "lan");
            t.querySelector(".ip").textContent = "WAN接続済み";
            setStatus("RJ45：WAN 接続完了", "on");
        } else if (startAnchor === "wanAnchor" && kind === "fiber") {
            const d = state.devices[t.id]; if (!d || d.type !== "onu") { alert("ONU を選択してください。"); return; }
            createCable("wanAnchor", t.id, "fiber");
            t.querySelector(".ip").textContent = "WAN接続済み";
            setStatus("光：完了", "on");
        }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
}

// 実線の生成
function createCable(a, b, kind) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("cable", kind === "fiber" ? "fiber" : "lan");
    // 実線は選択できるように（クリック有効）
    line.style.pointerEvents = "";
    cableSvg.appendChild(line);

    const id = `cable-${++cableUid}`;
    const conn = { id, lineEl: line, a, b, kind };
    state.connections.push(conn);
    updateLine(conn);

    line.addEventListener("click", (ev) => { ev.stopPropagation(); selectCable(id); });
}

// 選択表示
function selectCable(id) {
    state.selectedCableId = id;
    state.selectedId = null;
    document.querySelectorAll(".cable").forEach(l => l.classList.remove("selected"));
    const c = state.connections.find(v => v.id === id);
    if (c) c.lineEl.classList.add("selected");
    document.querySelectorAll(".device,.router").forEach(d => d.classList.remove("selected"));
}

// ラインの更新
function updateLinesFor(elId) {
    // ルーター移動時は WAN/LAN 両方の接続を更新
    if (elId === "routerBadge") {
        state.connections
            .filter(c => c.a === "routerPort1" || c.a === "routerWan")
            .forEach(updateLine);
        return;
    }
    state.connections.filter(c => c.a === elId || c.b === elId).forEach(updateLine);
}
function updateLine(c) {
    const p1 = anchorXY(c.a), p2 = anchorXY(c.b);
    if (!p1 || !p2) return;
    c.lineEl.setAttribute("x1", p1.x);
    c.lineEl.setAttribute("y1", p1.y);
    c.lineEl.setAttribute("x2", p2.x);
    c.lineEl.setAttribute("y2", p2.y);
}

// アンカー座標（ステージ左上を原点）
function anchorXY(a) {
    const cv = houseBody.getBoundingClientRect();

    if (a === "routerPort1") {
        const n = document.getElementById("routerPort1"); if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
    }
    if (a === "routerWan") {
        const n = document.getElementById("routerWan"); if (!n) return null;
        const r = n.getBoundingClientRect();
        return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
    }
    if (a === "wanAnchor") {
        const r = wanAnchor.getBoundingClientRect();
        return { x: r.right - cv.left, y: r.top - cv.top + r.height / 2 };
    }
    const el = document.getElementById(a); if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - cv.left + 8, y: r.top - cv.top + r.height / 2 };
}

// ==============================
//  IP 割当・表示
// ==============================
function assignIpIfNeeded(id) {
    const d = state.devices[id]; if (!d) return;
    if (d.ip) return;
    if (d.mode === "wlan" && !state.wifi.configured) return;

    const ip = nextIp(d.mode === "lan" ? state.poolLan : state.poolWlan);
    d.ip = ip;
    const el = document.querySelector(`#${id} .ip`);
    if (el) el.textContent = ip;
}
function setDeviceMode(id, mode) {
    const d = state.devices[id]; if (!d) return;
    d.mode = mode;
    const el = document.getElementById(id);
    el.classList.remove("wlan", "lan");
    el.classList.add(mode);
    d.ip = null;
    assignIpIfNeeded(id);
}
const nextIp = (pool) => (pool.base + (pool.next++));

function labelOf(t) {
    return { pc: "PC", phone: "スマホ", game: "ゲーム機", tablet: "タブレット", printer: "プリンタ(有線)", onu: "ONU" }[t] || t;
}

// ==============================
//  選択・削除
// ==============================
function selectNode(id) {
    state.selectedId = id;
    state.selectedCableId = null;
    document.querySelectorAll(".cable").forEach(l => l.classList.remove("selected"));
    document.querySelectorAll(".device").forEach(d => d.classList.toggle("selected", d.id === id));
    const r = document.getElementById("routerBadge");
    if (r) r.classList.toggle("selected", id === "routerBadge");
}

function deleteDevice(id) {
    const el = document.getElementById(id); if (!el) return;
    // 関連ケーブル削除
    state.connections = state.connections.filter(c => {
        const hit = (c.a === id || c.b === id);
        if (hit) c.lineEl.remove();
        return !hit;
    });
    delete state.devices[id];
    el.remove();
    if (state.selectedId === id) state.selectedId = null;
}

function deleteRouter() {
    const r = document.getElementById("routerBadge"); if (!r) return;
    state.connections.slice().forEach(c => {
        if (c.a === "routerPort1" || c.a === "routerWan") { c.lineEl.remove(); }
    });
    state.connections = state.connections.filter(c => c.a !== "routerPort1" && c.a !== "routerWan");
    r.remove();
    if (state.selectedId === "routerBadge") state.selectedId = null;
    state.pendingAnchor = null;
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
        if (state.selectedCableId) { e.preventDefault(); deleteCable(state.selectedCableId); return; }
        if (state.selectedId) { e.preventDefault(); (state.selectedId === "routerBadge" ? deleteRouter() : deleteDevice(state.selectedId)); }
    }
});

// ==============================
//  ユーティリティ
// ==============================
$("#powerCycle").addEventListener("click", () => {
    const id = state.selectedId;
    if (!id || id === "routerBadge") { alert("端末を選択してください。"); return; }
    const d = state.devices[id]; if (!d) return;
    d.ip = null; assignIpIfNeeded(id);
});

$("#showIPs").addEventListener("click", () => {
    const s = Object.values(state.devices).map(v => `${labelOf(v.type)} (${v.mode}) : ${v.ip ?? "未接続"}`).join("\n");
    alert("現在の IP 一覧:\n" + (s || "デバイスが未配置です"));
});

// 初期ステータス
setStatus("OFF");
