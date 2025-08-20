// =================== 状態管理 ===================
const state = {
  wifi: { ssid:null, password:null, enc:null, b24:true, b5:false, configured:false },
  poolWlan: { base:"192.168.0.", next:100 },
  poolLan:  { base:"192.168.10.", next:10 },
  devices: {},         // id -> {type, ip, mode:'wlan'|'lan'}
  connections: [],     // {lineEl, a:'routerPort1', b:deviceId}
  selectedId: null,    // クリックで選択
  cableMode: false,
  pendingAnchor: null  // ルータポート選択中
};

const $ = (q) => document.querySelector(q);
const houseBody = $("#houseBody");
const cableSvg = $("#cableSvg");
const routerPort = $("#routerPort1");

// =================== ログユーティリティ ===================
const log = (msg) => {
  const el = $("#log");
  const time = new Date().toLocaleTimeString();
  el.innerHTML = `[${time}] ${msg}<br>` + el.innerHTML;
};

// =================== Wi-Fi 設定 ===================
$("#wifiForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const ssid = $("#ssid").value.trim();
  const password = $("#password").value;
  const enc = $("#enc").value;
  const b24 = $("#b24").checked;
  const b5  = $("#b5").checked;
  const hint = $("#wifiHint");

  if (!ssid || password.length < 8 || (!b24 && !b5)) {
    hint.className = "hint warn";
    hint.textContent = "SSID/パスワード/周波数帯を確認してください。";
    return;
  }
  state.wifi = { ssid, password, enc, b24, b5, configured:true };
  $("#routerBadge").innerHTML = `Router<br><small>${ssid} / ${enc}${b5?" / 5GHz":""}${b24?" / 2.4GHz":""}</small>`;
  hint.className = "hint ok";
  hint.textContent = enc === "WPA2-TKIP"
    ? "適用：WPA2-TKIP は非推奨。可能なら WPA2-AES / WPA3 を選択。"
    : "適用：良い設定です。デバイスを配置して接続しましょう。";
  log(`Wi-Fi 設定: SSID=${ssid}, ENC=${enc}, 2.4GHz=${b24}, 5GHz=${b5}`);
});

// =================== パレット → デバイス生成 ===================
document.querySelectorAll(".palette-item").forEach(item=>{
  item.addEventListener("pointerdown",(ev)=>{
    const type = item.dataset.type;
    const dev = spawnDevice(type, ev.clientX, ev.clientY);
    startDrag(dev, ev);
  });
});

// 既存デバイスもドラッグ可
function makeDraggable(el){
  el.addEventListener("pointerdown", (ev)=> startDrag(el, ev));
  el.addEventListener("click", (ev)=>{
    ev.stopPropagation();
    selectDevice(el.id);
  });
}

// 生成
let uid=0;
function spawnDevice(type, clientX, clientY){
  const id = `dev-${type}-${++uid}`;
  const el = document.createElement("div");
  el.className = "device wlan"; // まずは無線
  el.dataset.type = type;
  el.id = id;
  el.innerHTML = `${labelOf(type)}<br><span class="ip" data-ip="">未接続</span>`;
  el.style.left = "180px"; el.style.top = "120px";
  houseBody.appendChild(el);
  state.devices[id] = { type, ip:null, mode:"wlan" };
  makeDraggable(el);
  // 初回配置時にIP割当（Wi-Fi設定済みなら）
  assignIpIfNeeded(id);
  return el;
}

// =================== ドラッグ＆ドロップ（機器） ===================
function startDrag(el, ev){
  ev.preventDefault();
  const rect = houseBody.getBoundingClientRect();
  const startX = ev.clientX, startY = ev.clientY;
  const offLeft = parseFloat(el.style.left || 0);
  const offTop  = parseFloat(el.style.top  || 0);
  el.setPointerCapture(ev.pointerId);
  el.classList.add("dragging");

  const move = (e)=>{
    const dx = e.clientX - startX, dy = e.clientY - startY;
    let nx = offLeft + dx, ny = offTop + dy;

    // 枠からはみ出さない
    const maxX = rect.width - el.offsetWidth - 6;
    const maxY = rect.height - el.offsetHeight - 6;
    nx = Math.max(6, Math.min(maxX, nx));
    ny = Math.max(6, Math.min(maxY, ny));

    el.style.left = nx + "px";
    el.style.top  = ny + "px";
    updateLinesFor(el.id);
  };

  const up = ()=>{
    el.classList.remove("dragging");
    el.releasePointerCapture(ev.pointerId);
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", up);
    // ドロップ後：もしケーブル無しならWi-FiとしてIP付与（1回だけ）
    assignIpIfNeeded(el.id);
  };

  document.addEventListener("pointermove", move);
  document.addEventListener("pointerup", up);
}

// =================== ケーブル接続 ===================
$("#cableToggle").addEventListener("change", e=>{
  state.cableMode = e.target.checked;
  houseBody.classList.toggle("snap-area", state.cableMode);
  state.pendingAnchor = null;
});

// ルータポート → クリックで始点
routerPort.addEventListener("click", (e)=>{
  if(!state.cableMode) return;
  state.pendingAnchor = "routerPort1";
  log("LANケーブル：ルーターポートを選択。次に機器をクリック。");
});

// デバイスを終点に
houseBody.addEventListener("click", (e)=>{
  if(!state.cableMode || !state.pendingAnchor) return;

  const target = e.target.closest(".device");
  if(!target) return;

  createCable("routerPort1", target.id);
  // 有線IPへ切替
  setDeviceMode(target.id, "lan");
  state.pendingAnchor = null;
});

function createCable(a, b){
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.classList.add("cable","lan");
  cableSvg.appendChild(line);
  const conn = { lineEl: line, a, b };
  state.connections.push(conn);
  updateLine(conn);
  log(`LANケーブルを接続: ${labelOf(state.devices[b].type)} ←→ ルーター`);
}

function updateLinesFor(deviceId){
  state.connections
    .filter(c=>c.b===deviceId || c.a===deviceId)
    .forEach(updateLine);
}

function updateLine(conn){
  const p1 = anchorXY(conn.a);
  const p2 = anchorXY(conn.b);
  conn.lineEl.setAttribute("x1", p1.x);
  conn.lineEl.setAttribute("y1", p1.y);
  conn.lineEl.setAttribute("x2", p2.x);
  conn.lineEl.setAttribute("y2", p2.y);
}

function anchorXY(anchorIdOrElId){
  const canvasRect = houseBody.getBoundingClientRect();
  if(anchorIdOrElId === "routerPort1"){
    const portRect = routerPort.getBoundingClientRect();
    return { x: portRect.left - canvasRect.left + portRect.width/2,
             y: portRect.top  - canvasRect.top  + portRect.height/2 };
  }
  // device: 左辺中央をアンカーに
  const el = document.getElementById(anchorIdOrElId);
  const r = el.getBoundingClientRect();
  return { x: r.left - canvasRect.left + 8, y: r.top - canvasRect.top + r.height/2 };
}

// =================== IP 割当 / 切替 ===================
function assignIpIfNeeded(id){
  const dev = state.devices[id];
  if (!dev) return;
  if (dev.ip) return;                 // 既に付与済みなら何もしない
  if (dev.mode === "wlan" && !state.wifi.configured) return; // Wi-Fi未設定なら保留
  const ip = nextIp(dev.mode==="lan" ? state.poolLan : state.poolWlan);
  dev.ip = ip;
  const el = document.querySelector(`#${id} .ip`);
  el.dataset.ip = ip; el.textContent = ip;
  log(`${labelOf(dev.type)} を ${dev.mode.toUpperCase()} で接続: IP=${ip}`);
}

function setDeviceMode(id, mode){
  const dev = state.devices[id]; if(!dev) return;
  dev.mode = mode;
  const el = document.getElementById(id);
  el.classList.remove("wlan","lan");
  el.classList.add(mode);
  // 既存IPは切替時に再取得
  dev.ip = null;
  assignIpIfNeeded(id);
}

function nextIp(pool){ const ip = pool.base + pool.next; pool.next++; return ip; }
function labelOf(type){
  return { pc:"PC", phone:"スマホ", game:"ゲーム機", tablet:"タブレット", printer:"プリンタ(有線)"}[type] || type;
}

// =================== 選択 & 電源入れ直し（DHCP再取得） ===================
function selectDevice(id){
  state.selectedId = id;
  document.querySelectorAll(".device").forEach(d=>d.classList.toggle("selected", d.id===id));
}

$("#powerCycle").addEventListener("click", ()=>{
  const id = state.selectedId;
  if(!id){ alert("デバイスをクリックして選択してください。"); return; }
  const dev = state.devices[id];
  if(!dev){ return; }
  dev.ip = null;      // 再取得
  assignIpIfNeeded(id);
  log(`${labelOf(dev.type)} の電源を再投入 → DHCP 再取得`);
});

$("#showIPs").addEventListener("click", ()=>{
  const lines = Object.entries(state.devices)
    .map(([id,v]) => `${labelOf(v.type)} (${v.mode}) : ${v.ip ?? "未接続"}`)
    .join("\n");
  alert("現在の IP 一覧:\n" + (lines || "デバイスが未配置です"));
});

// =================== WEB 表示時間の比較（そのまま） ===================
$("#runTest").addEventListener("click", () => {
  const selected = [...document.querySelectorAll(".site:checked")].map(i => i.value);
  if (selected.length === 0) { alert("比較するサイトを選んでください"); return; }

  const tbody = $("#latencyTable tbody");
  tbody.innerHTML = "";
  const defs = {
    domestic: { name:"国内A（東京）", base:120, hops:["家のルータ","プロバイダ","東京DC"] },
    oversea:  { name:"海外B（米国）", base:320, hops:["家のルータ","国際回線","US IX","US DC"] },
    congested:{ name:"国内C（混雑）", base:220, hops:["家のルータ","ISP（混雑）","国内DC"] }
  };

  selected.forEach(key => {
    const d = defs[key];
    const jitter = Math.round((Math.random()*80)-40); // ±40ms
    const ms = Math.max(60, d.base + jitter);

    const tr = document.createElement("tr");
    const hops = d.hops.join(" → ");
    tr.innerHTML = `<td>${d.name}</td><td>${ms}</td><td>${hops}</td>`;
    tbody.appendChild(tr);
  });

  log("WEB 表示時間の比較テストを実施：距離や混雑で遅延が増えることを観察。");
});

// =================== ルーター本体のドラッグ対応 ===================
function makeRouterDraggable(){
  const el = document.getElementById('routerBadge');
  if(!el) return;

  el.addEventListener('pointerdown', (ev)=>{
    // ポート自体をクリックしたときはケーブル操作を優先
    if (ev.target.classList.contains('port')) return;

    ev.preventDefault();
    const rect = houseBody.getBoundingClientRect();
    const style = getComputedStyle(el);
    const startX = ev.clientX, startY = ev.clientY;
    const offLeft = parseFloat(style.left);
    const offTop  = parseFloat(style.top);

    el.setPointerCapture(ev.pointerId);
    el.classList.add('dragging');

    const move = (e)=>{
      let nx = offLeft + (e.clientX - startX);
      let ny = offTop  + (e.clientY - startY);

      // 家の枠からはみ出さない
      const maxX = rect.width  - el.offsetWidth  - 6;
      const maxY = rect.height - el.offsetHeight - 6;
      nx = Math.max(6, Math.min(maxX, nx));
      ny = Math.max(6, Math.min(maxY, ny));

      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';

      // ルーターポートに接続されている全ケーブルを更新
      updateLinesFor('routerPort1');
    };

    const up = ()=>{
      el.classList.remove('dragging');
      el.releasePointerCapture(ev.pointerId);
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
  });
}

// 初期化：ルーターもドラッグ可能に
makeRouterDraggable();
