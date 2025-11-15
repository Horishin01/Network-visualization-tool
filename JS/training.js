/* =========================================================
 * training.js  日本地図ページ
 *  - ストアのスナップショットを読み取りバッジ更新
 *  - 空/壊れていれば自動初期化
 * ========================================================= */
(function () {
    'use strict';

    const INITIAL_Z = 5;
    const JAPAN_BOUNDS = L.latLngBounds([24.0, 122.0], [46.2, 146.0]);
    const map = L.map('map', {
        minZoom: INITIAL_Z, maxZoom: 12,
        maxBounds: JAPAN_BOUNDS, maxBoundsViscosity: 1.0
    }).setView([36.5, 137.0], INITIAL_Z);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }
    ).addTo(map);

    const tokyo = L.marker([35.6812, 139.7671], { title: 'Tokyo' })
        .addTo(map).bindTooltip('Home', { direction: 'top', offset: [0, -8] })
        .on('click', () => location.href = 'home.html');

    const fukuoka = L.marker([33.5902, 130.4017], { title: 'Fukuoka' })
        .addTo(map).bindTooltip('Company', { direction: 'top', offset: [0, -8] })
        .on('click', () => location.href = 'company.html');

    const diagEl = document.getElementById('diag');
    const pcBadge = document.getElementById('pcConnBadge');
    const pcScreen = document.getElementById('pcScreen');
    const pcAddress = document.getElementById('pcAddress');
    const companyBadge = document.getElementById('companyConnBadge');
    const companyIframe = document.getElementById('companyPreview');
    const companyLock = document.getElementById('companyLock');
    const ftpStatusEl = document.getElementById('ftpStatus');
    let lastSnapshotJson = '';

    function ensureStoreSnapshot() {
        if (!window.AppStore) return null;
        const cur = AppStore.get();
        if (!cur || typeof cur !== 'object') {
            AppStore.set({
                home: { edges: {}, reach: { internet: false, count: 0 } },
                company: { edges: {}, reach: {} },
                summary: { homeOK: false, companyOK: false }
            });
            return AppStore.get();
        }
        return cur;
    }

    function pickState(s) {
        const he = s?.home?.edges || {};
        let ce = s?.company?.edges || {};
        if (!ce || Object.keys(ce).length === 0) {
            try {
                const fallback = window.localStorage.getItem('company:lastEdges');
                if (fallback) ce = JSON.parse(fallback);
            } catch (err) {
                console.warn('[TRAINING] fallback edges read error', err);
            }
        }
        const fiberEdge = typeof ce.fiberOnu === 'boolean' ? ce.fiberOnu : !!ce.fiber;
        const routerEdge = typeof ce.onuRouter === 'boolean' ? ce.onuRouter : !!ce.routerWan;
        const clientEdge = typeof ce.routerPc === 'boolean' ? ce.routerPc : !!ce.routerWeb;
        const companyStatus = Object.assign({}, s?.company?.status);
        if (!companyStatus || typeof companyStatus !== 'object') {
            companyStatus.webReachable = clientEdge;
            companyStatus.routerWanLink = routerEdge;
            companyStatus.fiberLink = fiberEdge;
            companyStatus.ftpReachable = companyStatus.ftpReachable ?? (fiberEdge && routerEdge && clientEdge);
            companyStatus.ok = fiberEdge && routerEdge && clientEdge;
        }
        const homeOK =
            (typeof s?.summary?.homeOK === 'boolean')
                ? s.summary.homeOK
                : (!!he.fiberOnu && !!he.onuRouter && !!he.routerPc);
        const companyOK =
            (typeof s?.summary?.companyOK === 'boolean')
                ? s.summary.companyOK
                : (fiberEdge && routerEdge && clientEdge);
        const homeCount = (he.fiberOnu ? 1 : 0) + (he.onuRouter ? 1 : 0) + (he.routerPc ? 1 : 0);
        return {
            he,
            homeOK: !!homeOK,
            companyOK: !!companyOK,
            homeCount,
            companyStatus: Object.assign({}, companyStatus, {
                fiberLink: fiberEdge,
                routerWanLink: routerEdge,
                webReachable: clientEdge,
                ok: fiberEdge && routerEdge && clientEdge
            })
        };
    }

    function setTooltipAndColor(marker, label, okText, ngText, ok) {
        marker.setTooltipContent(`${label}: ${ok ? okText : ngText}`);
        if (marker._icon) marker._icon.style.filter = ok ? '' : 'grayscale(100%) brightness(0.8)';
    }

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
        setTooltipAndColor(tokyo, 'Home', `OK (${st.homeCount}/3)`, 'NG', st.homeOK);
        setTooltipAndColor(fukuoka, 'Company', 'OK', 'NG', st.companyOK);

        renderPcWindow(st.homeCount, st.homeOK);
        renderCompanyPanel(st.companyOK, st.companyStatus);

        if (diagEl) {
            diagEl.textContent = JSON.stringify({
                homeEdges: st.he,
                homeOK: st.homeOK,
                companyOK: st.companyOK,
                updatedAt: snap?.updatedAt
            });
        }
    }

    renderFromStore(true);
    const updateDriver = () => renderFromStore(true);
    window.addEventListener('focus', updateDriver);
    window.addEventListener('pageshow', updateDriver);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) updateDriver(); });
    window.addEventListener('storage', (e) => {
        if (!window.AppStore || !AppStore._conf) return;
        if (e.key === AppStore._conf.key || e.key === 'company:lastEdges' || e.key === 'company:canvas:snapshot') {
            updateDriver();
        }
    });
    setInterval(() => renderFromStore(), 1500);

    function setBadgeState(el, ok) {
        if (!el) return;
        el.textContent = ok ? 'T' : 'F';
        el.classList.toggle('badge-ok', ok);
        el.classList.toggle('badge-ng', !ok);
    }

    function renderPcWindow(count, ok) {
        if (!pcScreen) return;
        setBadgeState(pcBadge, ok && count === 3);
        pcScreen.classList.toggle('online', ok && count === 3);
        if (ok && count === 3) {
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

    function renderCompanyPanel(ok, status) {
        setBadgeState(companyBadge, ok);
        const ftpOK = ok && !!status?.ftpReachable;
        setBadgeState(ftpStatusEl, ftpOK);

        if (ok) {
            if (companyLock) companyLock.hidden = true;
            if (companyIframe) {
                companyIframe.hidden = false;
                if (!companyIframe.dataset.loaded) {
                    companyIframe.src = './company.html';
                    companyIframe.dataset.loaded = '1';
                }
            }
        } else {
            if (companyLock) companyLock.hidden = false;
            if (companyIframe) {
                companyIframe.hidden = true;
                companyIframe.removeAttribute('src');
                delete companyIframe.dataset.loaded;
            }
        }
    }
})();
