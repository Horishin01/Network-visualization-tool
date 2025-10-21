/* company.js
 * 会社ネットワーク構築シミュレータ（home.js を流用し拡張）
 * - ドラッグ＆ドロップで機器配置
 * - RJ45 / 光ファイバー配線（クリック or ドラッグで接続）
 * - 端末へ IP 割当（LAN / サーバセグメント）
 * - 選択 / 削除 / 再起動(DHCP再取得) / IP一覧
 */

/* ==============================
 * 状態
 * ============================== */
const state = {
    // アドレスプール（用途で分割）
    poolLan: { base: "192.168.50.", next: 10 }, // クライアント等
    poolServer: { base: "192.168.60.", next: 10 }, // サーバ群
    devices: {},      // id -> {type, ip, segment:'lan'|'server'}
    connections: [],    // {id,lineEl,a,b,kind}  a/b はアンカーキー
    selectedId: null,   // device/router id
    selectedCableId: null,
    cableMode: false,
    cableTool: null,    // 'rj45' | 'fiber'
    pendingAnchor: null,
    tempCable: null
};

/* ==============================
 * DOM 参照
 * ============================== */
const $ = (q) => document.querySelector(q);
const corpBody = $("#corpBody");
const cableSvg = $("#cableSvg");
const wanAnchor = $("#wanAnchor");
const cableBadge = $("#cableStatus");

/* ==============================
 * 補助
 * ============================== */
const setStatus = (txt, cls = "") => {
    cableBadge.textContent = `接続ステータス: ${txt}`;
    cableBadge.className = `badge ${cls}`;
};
const labelOf = (t) => ({
    router: "社内ルータ",
    firewall: "ファイアウォール",
    coresw: "コアSW",
    accesssw: "アクセスSW",
    onu: "ONU",
    webserver: "Webサーバ",
    dbserver: "DBサーバ",
    dnsserver: "DNSサーバ",
    mailserver: "メールサーバ",
    adserver: "AD/認証",
    proxy: "Proxy",
    fileserver: "ファイルサーバ",
    backup: "バックアップ",
    monitor: "監視サーバ",
    pc: "社員PC",
    printer: "プリンタ"
}[t] || t);

const isServer = (t) =>
    ["webserver", "dbserver", "dnsserver", "mailserver", "fileserver", "adserver", "proxy", "backup", "monitor"].includes(t);

/* ==============================
 * パレット（機器生成 & ケーブルツール）
 * ============================== */
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
    document.querySelectorAll(".palette-item.tool").forEach(el =>
        el.classList.toggle("tool-active", el.dataset.tool === tool)
    );
    state.pendingAnchor = null;
    const hint = (tool === "rj45")
        ? "ルータのLAN/WANポート → 接続先をクリック"
        : "左の『WAN』→ ONU をクリック";
    setStatus(`${tool.toUpperCase()} 選択。${hint}`, "on step");
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

/* ==============================
 * 機器生成
 * ============================== */
let uid = 0, cableUid = 0;

function spawnDevice(type) {
    const id = `node-${type}-${++uid}`;

    // ルータは特別（WAN/LAN ポートを持つ）
    if (type === "router") {
        const el = document.createElement("div");
        el.className = "router";
        el.id = id;
        el.style.left = "180px";
        el.style.top = "220px";
        el.innerHTML = `
      <div class="router-label">${labelOf(type)}</div>
      <span class="port wan" title="WAN" data-anchor="router:${id}:wan"></span>
      <span class="port"     title="LAN" data-anchor="router:${id}:lan"></span>
      <button class="close" title="削除">×</button>
    `;
        corpBody.appendChild(el);

        // ルータ自身のドラッグ
        el.addEventListener("pointerdown", (ev) => {
            if (ev.target.classList.contains("port") || ev.target.closest(".close")) return;
            startDrag(el, ev);
        });
        el.addEventListener("click", (ev) => {
            if (ev.target.classList.contains("port") || ev.target.closest(".close")) return;
            selectNode(id);
        });

        // ポート（クリック配線）
        el.querySelectorAll(".port").forEach(p => {
            const anchorKey = p.dataset.anchor;
            p.addEventListener("click", (e) => {
                if (!state.cableMode) return;
                if (state.cableTool !== "rj45") { setStatus("RJ45ツールを選択してください"); return; }
                state.pendingAnchor = anchorKey;
                setStatus("RJ45：接続先の機器をクリック", "on step");
                e.stopPropagation();
            });
            // ドラッグ配線
            p.addEventListener("pointerdown", (e) => {
                if (!(state.cableMode && state.cableTool === "rj45")) return;
                e.stopPropagation();
                startCableDrag("lan", anchorKey, e);
            });
        });

        // 削除
        el.querySelector(".close").addEventListener("click", (e) => {
            e.stopPropagation();
            deleteDevice(id);
        });

        state.devices[id] = { type, ip: null, segment: "lan" };
        return el;
    }

    // その他の機器
    const el = document.createElement("div");
    el.className = "device";
    el.dataset.type = type;
    el.id = id;
    el.innerHTML = `
    <div class="label">${labelOf(type)}</div>
    <span class="ip">未接続</span>
    <button class="close" title="削除">×</button>
  `;
    el.style.left = "380px";
    el.style.top = "140px";

    corpBody.appendChild(el);
    state.devices[id] = { type, ip: null, segment: isServer(type) ? "server" : "lan" };

    el.querySelector(".close").addEventListener("click", (e) => {
        e.stopPropagation();
        deleteDevice(id);
    });
    makeDraggable(el);
    return el;
}

/* ==============================
 * ドラッグ＆ドロップ（機器）
 * ============================== */
function makeDraggable(el) {
    el.addEventListener("pointerdown", (ev) => startDrag(el, ev));
    el.addEventListener("click", (ev) => { ev.stopPropagation(); selectNode(el.id); });
}

function startDrag(el, ev) {
    if (ev.target.closest(".close")) return;
    ev.preventDefault();

    const rect = corpBody.getBoundingClientRect();
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
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
}

/* ==============================
 * ケーブル（クリック / ドラッグ）
 * ============================== */

// WAN アンカー
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

// クリックによる終端接続
corpBody.addEventListener("click", (e) => {
    if (!state.cableMode || !state.pendingAnchor) return;

    // ONU・その他端末を安全に取得
    const target = e.target.closest(".device,.router");
    if (!target) return;

    const pa = state.pendingAnchor;

    // 光：WAN → ONU
    if (pa === "wanAnchor" && state.cableTool === "fiber") {
        const info = state.devices[target.id];
        if (!info || info.type !== "onu") { alert("ONU を選択してください。"); return; }
        createCable("wanAnchor", target.id, "fiber");
        target.querySelector(".ip").textContent = "WAN接続済み";
        setStatus("光：完了", "on");
        state.pendingAnchor = null;
        return;
    }

    // RJ45：ポート → 機器
    if (state.cableTool === "rj45" && pa.startsWith("router:")) {
        // WAN 側
        if (pa.endsWith(":wan")) {
            const info = state.devices[target.id];
            if (!info || info.type !== "onu") { alert("ONU を選択してください。"); return; }
            createCable(pa, target.id, "lan");
            target.querySelector(".ip").textContent = "WAN接続済み";
            setStatus("RJ45：WAN 接続完了", "on");
            state.pendingAnchor = null;
            return;
        }
        // LAN 側
        if (pa.endsWith(":lan")) {
            createCable(pa, target.id, "lan");
            assignIpIfNeeded(target.id);
            setStatus("RJ45：完了", "on");
            state.pendingAnchor = null;
            return;
        }
    }
});

// ドラッグで配線（開始ポート → 指を離した位置の要素に確定）
function startCableDrag(kind, startAnchor, ev) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("cable", kind === "fiber" ? "fiber" : "lan");
    line.style.pointerEvents = "none"; // 仮線はヒットさせない
    cableSvg.appendChild(line);
    state.tempCable = { kind, startAnchor, line };

    const move = (e) => {
        const p1 = anchorXY(startAnchor);
        const cv = corpBody.getBoundingClientRect();
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
        const t = elAt && elAt.closest(".device,.router");
        if (!t) return;

        if (startAnchor === "wanAnchor" && kind === "fiber") {
            const d = state.devices[t.id];
            if (!d || d.type !== "onu") { alert("ONU を選択してください。"); return; }
            createCable("wanAnchor", t.id, "fiber");
            t.querySelector(".ip").textContent = "WAN接続済み";
            setStatus("光：完了", "on");
            return;
        }

        if (kind === "lan" && startAnchor.startsWith("router:")) {
            if (startAnchor.endsWith(":wan")) {
                const d = state.devices[t.id];
                if (!d || d.type !== "onu") { alert("ONU を選択してください。"); return; }
                createCable(startAnchor, t.id, "lan");
                t.querySelector(".ip").textContent = "WAN接続済み";
                setStatus("RJ45：WAN 接続完了", "on");
            } else {
                createCable(startAnchor, t.id, "lan");
                assignIpIfNeeded(t.id);
                setStatus("RJ45：完了", "on");
            }
        }
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up, { once: true });
}

/* 実線生成 */
function createCable(a, b, kind) {
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.classList.add("cable", kind === "fiber" ? "fiber" : "lan");
    line.style.pointerEvents = ""; // 実線は選択可
    cableSvg.appendChild(line);

    const id = `cable-${++cableUid}`;
    const conn = { id, lineEl: line, a, b, kind };
    state.connections.push(conn);
    updateLine(conn);

    line.addEventListener("click", (ev) => {
        ev.stopPropagation();
        selectCable(id);
    });
}

/* 選択表示 */
function selectCable(id) {
    state.selectedCableId = id;
    state.selectedId = null;
    document.querySelectorAll(".cable").forEach(l => l.classList.remove("selected"));
    const c = state.connections.find(v => v.id === id);
    if (c) c.lineEl.classList.add("selected");
    document.querySelectorAll(".device,.router").forEach(d => d.classList.remove("selected"));
}

/* ライン更新 */
function updateLinesFor(elId) {
    // ルータの場合（その id を含むアンカーを更新）
    state.connections
        .filter(c => c.a.includes(elId) || c.b === elId || c.a === elId || c.b.includes(elId))
        .forEach(updateLine);
}
function updateLine(c) {
    const p1 = anchorXY(c.a), p2 = anchorXY(c.b);
    if (!p1 || !p2) return;
    c.lineEl.setAttribute("x1", p1.x);
    c.lineEl.setAttribute("y1", p1.y);
    c.lineEl.setAttribute("x2", p2.x);
    c.lineEl.setAttribute("y2", p2.y);
}

/* アンカー座標 */
function anchorXY(key) {
    const cv = corpBody.getBoundingClientRect();

    if (key === "wanAnchor") {
        const r = wanAnchor.getBoundingClientRect();
        return { x: r.right - cv.left, y: r.top - cv.top + r.height / 2 };
    }

    // router:<id>:wan|lan
    if (key.startsWith("router:")) {
        const [, rid, port] = key.split(":");
        const rEl = document.getElementById(rid);
        if (!rEl) return null;
        const node = rEl.querySelector(port === "wan" ? ".port.wan" : ".port:not(.wan)");
        if (!node) return null;
        const r = node.getBoundingClientRect();
        return { x: r.left - cv.left + r.width / 2, y: r.top - cv.top + r.height / 2 };
    }

    // その他はデバイス矩形の左辺中央へ
    const el = document.getElementById(key);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left - cv.left + 8, y: r.top - cv.top + r.height / 2 };
}

/* ==============================
 * IP 割当 / ユーティリティ
 * ============================== */
function nextIp(pool) { return pool.base + (pool.next++); }

function assignIpIfNeeded(id) {
    const d = state.devices[id]; if (!d) return;
    if (d.type === "onu") return; // ONU は IP 表示を使わない
    if (!d.ip) {
        const pool = (d.segment === "server") ? state.poolServer : state.poolLan;
        d.ip = nextIp(pool);
    }
    const el = document.querySelector(`#${id} .ip`);
    if (el) el.textContent = d.ip;
}

$("#powerCycle").addEventListener("click", () => {
    const id = state.selectedId;
    if (!id) { alert("デバイスを選択してください。"); return; }
    const d = state.devices[id]; if (!d || d.type === "onu") return;
    d.ip = null;
    assignIpIfNeeded(id);
});

$("#showIPs").addEventListener("click", () => {
    const lines = Object.entries(state.devices).map(([id, d]) => {
        const name = labelOf(d.type);
        return `${name} : ${d.ip ?? "未接続"}`;
    });
    alert(lines.length ? lines.join("\n") : "機器が未配置です");
});

/* ==============================
 * 選択 / 削除
 * ============================== */
function selectNode(id) {
    state.selectedId = id;
    state.selectedCableId = null;
    document.querySelectorAll(".cable").forEach(l => l.classList.remove("selected"));
    document.querySelectorAll(".device,.router").forEach(d => d.classList.toggle("selected", d.id === id));
}

function deleteDevice(id) {
    const el = document.getElementById(id); if (!el) return;
    // 関連ケーブル削除
    state.connections = state.connections.filter(c => {
        const hit = (c.a.includes(id) || c.b === id || c.a === id || c.b.includes(id));
        if (hit) c.lineEl.remove();
        return !hit;
    });
    delete state.devices[id];
    el.remove();
    if (state.selectedId === id) state.selectedId = null;
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
        if (state.selectedId) { e.preventDefault(); deleteDevice(state.selectedId); }
    }
});

/* 初期表示 */
setStatus("OFF");
