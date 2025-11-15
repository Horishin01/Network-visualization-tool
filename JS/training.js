/* =========================================================
 * training.js  日本地図ページ
 *  - AppStore のスナップショットを読み取りバッジ更新
 *  - BroadcastChannel / storage / CustomEvent で更新を監視
 *  - FTP バッジは companyOK と同一に更新（配線3本=即 T）
 * ========================================================= */
(function () {
    'use strict';

    // ---- 地図設定 ----
    const INITIAL_Z = 5;
    const JAPAN_BOUNDS = L.latLngBounds([24.0, 122.0], [46.2, 146.0]);
    const map = L.map('map', {
        minZoom: INITIAL_Z,
        maxZoom: 12,
        maxBounds: JAPAN_BOUNDS,
        maxBoundsViscosity: 1.0
    }).setView([36.5, 137.0], INITIAL_Z);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    const tokyo = L.marker([35.6812, 139.7671], { title: 'Tokyo' })
        .addTo(map).bindTooltip('Home', { direction: 'top', offset: [0, -8] })
        .on('click', () => location.href = 'home.html');

    const fukuoka = L.marker([33.5902, 130.4017], { title: 'Fukuoka' })
        .addTo(map).bindTooltip('Company', { direction: 'top', offset: [0, -8] })
        .on('click', () => location.href = 'company.html');

    // ---- DOM 取得 ----
    const diagEl         = document.getElementById('diag');
    const pcBadge        = document.getElementById('pcConnBadge');
    const pcScreen       = document.getElementById('pcScreen');
    const pcAddress      = document.getElementById('pcAddress');
    const companyBadge   = document.getElementById('companyConnBadge');
    const companyIframe  = document.getElementById('companyPreview');
    const companyLock    = document.getElementById('companyLock');
    const ftpStatusEl    = document.getElementById('ftpStatus');

    // ---- 共有キー/チャンネル ----
    const STORE_KEY = 'app:network:saves:default';
    const BC_NAME   = 'network-app';

    let lastSnapshotJson = '';

    // ---- ユーティリティ ----
    function safeJSON(s) { try { return JSON.parse(s); } catch { return null; } }
    function readStoreRaw() {
        if (window.AppStore && typeof AppStore.get === 'function') return AppStore.get();
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? safeJSON(raw) : null;
    }
    function ensureStoreSnapshot() {
        const cur = readStoreRaw();
        if (cur && typeof cur === 'object') return cur;
        const init = {
            v: 1,
            updatedAt: new Date().toISOString(),
            home:    { edges: { fiberOnu:false, onuRouter:false, routerPc:false }, reach:{ internet:false, count:0 } },
            company: { edges:{ fiberOnu:false, onuRouter:false, routerPc:false }, reach:{ internet:false, count:0 }, canvas:null },
            summary: { homeOK:false, companyOK:false }
        };
        if (window.AppStore && typeof AppStore.set === 'function') {
            AppStore.set(init);
        } else {
            localStorage.setItem(STORE_KEY, JSON.stringify(init));
        }
        return init;
    }

    // 現在の論理状態へ正規化
    function pickState(s) {
        const he = s?.home?.edges || {};
        let ce   = s?.company?.edges || {};
        // 旧キー/フォールバック（あれば）
        if (!ce || Object.keys(ce).length === 0) {
            const fb = safeJSON(localStorage.getItem('company:lastEdges'));
            if (fb) ce = fb;
        }
        const fiberEdge  = typeof ce.fiberOnu  === 'boolean' ? ce.fiberOnu  : !!ce.fiber;
        const routerEdge = typeof ce.onuRouter === 'boolean' ? ce.onuRouter : !!ce.routerWan;
        const clientEdge = typeof ce.routerPc  === 'boolean' ? ce.routerPc  : !!ce.routerWeb;

        const homeOK =
            (typeof s?.summary?.homeOK === 'boolean')
                ? s.summary.homeOK
                : (he.fiberOnu && he.onuRouter && he.routerPc);

        const companyOK =
            (typeof s?.summary?.companyOK === 'boolean')
                ? s.summary.companyOK
                : (fiberEdge && routerEdge && clientEdge);

        const homeCount = (he.fiberOnu ? 1 : 0) + (he.onuRouter ? 1 : 0) + (he.routerPc ? 1 : 0);

        // 会社側の補助ステータス（表示用）
        const companyStatus = Object.assign({}, s?.company?.status);
        companyStatus.fiberLink    = fiberEdge;
        companyStatus.routerWanLink= routerEdge;
        companyStatus.webReachable = clientEdge;
        // FTP は配線3本＝OK として扱う（= companyOK）。別サブチェックが必要ならここを差し替える。
        companyStatus.ftpReachable = companyOK;
        companyStatus.ok           = companyOK;

        return { he, homeOK: !!homeOK, companyOK: !!companyOK, homeCount, companyStatus };
    }

    function setTooltipAndColor(marker, label, okText, ngText, ok) {
        marker.setTooltipContent(`${label}: ${ok ? okText : ngText}`);
        if (marker._icon) marker._icon.style.filter = ok ? '' : 'grayscale(100%) brightness(0.85)';
    }

    function setBadgeState(el, ok) {
        if (!el) return;
        el.textContent = ok ? 'T' : 'F';
        el.classList.toggle('badge-ok', ok);
        el.classList.toggle('badge-ng', !ok);
        el.classList.toggle('on',  ok);
        el.classList.toggle('off', !ok);
    }

    // ---- レンダリング ----
    function renderFromStore(force = false) {
        const snap = ensureStoreSnapshot() || {};
        const snapshotJson = JSON.stringify({
            homeEdges: snap?.home?.edges || {},
            companyEdges: snap?.company?.edges || {},
            summary: snap?.summary || {}
        });
        if (!force && snapshotJson === lastSnapshotJson) return;
        lastSnapshotJson = snapshotJson;

        const st = pickState(snap);

        // マップのバッジ
        setTooltipAndColor(tokyo,   'Home',    `OK (${st.homeCount}/3)`, 'NG', st.homeOK);
        setTooltipAndColor(fukuoka, 'Company', 'OK',                     'NG', st.companyOK);

        // パネル
        renderPcWindow(st.homeCount, st.homeOK);
        renderCompanyPanel(st.companyOK, st.companyStatus);

        // 診断出力
        if (diagEl) {
            diagEl.textContent = JSON.stringify({
                homeEdges: st.he,
                homeOK: st.homeOK,
                companyOK: st.companyOK,
                updatedAt: snap?.updatedAt
            });
        }
    }

    function renderPcWindow(count, ok) {
        if (!pcScreen) return;
        const allOK = ok && count === 3;
        setBadgeState(pcBadge, allOK);
        pcScreen.classList.toggle('online', allOK);

        if (allOK) {
            pcScreen.innerHTML = `
                <div class="pc-screen__google">
                    <h3>Google</h3>
                    <div class="search">
                        <input type="text" value="ネットワーク構築 成功" readonly />
                        <button>Google 検索</button>
                    </div>
                    <ul>
                        <li>接続状態: 安定 (3/3)</li>
                        <li>SSL: 有効 / DNS 応答済み</li>
                        <li>ブラウザ: Virtual Windows Edge</li>
                    </ul>
                </div>`;
            if (pcAddress) pcAddress.textContent = 'https://www.google.com/';
        } else {
            pcScreen.innerHTML = `
                <div class="pc-screen__error">
                    <strong>接続エラー (F)</strong>
                    <p>光→ONU→ルーター→PC の 3 つを接続してください。</p>
                    <small>ローカルストレージの Home 診断は自動で更新されます。</small>
                </div>`;
            if (pcAddress) pcAddress.textContent = 'https://www.google.com/ (blocked)';
        }
    }

    function renderCompanyPanel(companyOK, status) {
        setBadgeState(companyBadge, companyOK);

        // FTP は companyOK と同一（= 三本配線で即 T）
        const ftpOK = !!companyOK;
        setBadgeState(ftpStatusEl, ftpOK);

        if (companyOK) {
            if (companyLock)  companyLock.hidden  = true;
            if (companyIframe){
                companyIframe.hidden = false;
                if (!companyIframe.dataset.loaded) {
                    companyIframe.src = './company.html';
                    companyIframe.dataset.loaded = '1';
                }
            }
        } else {
            if (companyLock)  companyLock.hidden  = false;
            if (companyIframe){
                companyIframe.hidden = true;
                companyIframe.removeAttribute('src');
                delete companyIframe.dataset.loaded;
            }
        }
    }

    // ---- 起動・監視 ----
    renderFromStore(true);

    const driveRender = () => renderFromStore(true);
    window.addEventListener('focus', driveRender);
    window.addEventListener('pageshow', driveRender);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) driveRender(); });

    // 他タブ更新（storage）
    window.addEventListener('storage', (e) => {
        if (e.key === STORE_KEY || e.key === 'company:lastEdges' || e.key === 'company:canvas:snapshot') {
            driveRender();
        }
    });

    // 同タブ/別タブ両対応（BroadcastChannel）
    try {
        const ch = new BroadcastChannel(BC_NAME);
        ch.onmessage = (ev) => { if (ev?.data?.type === 'store-updated') driveRender(); };
    } catch {}

    // 同タブイベント（store.js / bridge が投げる CustomEvent）
    window.addEventListener('appstore:updated', driveRender);

    // 最終フォールバック（軽ポーリング）
    setInterval(() => renderFromStore(false), 1500);
})();
