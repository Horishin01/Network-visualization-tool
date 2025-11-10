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
        const ce = s?.company?.edges || {};
        const homeOK = (s?.summary?.homeOK) ?? (!!he.fiberOnu && !!he.onuRouter && !!he.routerPc);
        const companyOK = (s?.summary?.companyOK) ?? (!!ce.minOK);
        const homeCount = (he.fiberOnu ? 1 : 0) + (he.onuRouter ? 1 : 0) + (he.routerPc ? 1 : 0);
        return { he, ce, homeOK: !!homeOK, companyOK: !!companyOK, homeCount };
    }

    function setTooltipAndColor(marker, label, okText, ngText, ok) {
        marker.setTooltipContent(`${label}: ${ok ? okText : ngText}`);
        if (marker._icon) marker._icon.style.filter = ok ? '' : 'grayscale(100%) brightness(0.8)';
    }

    function renderFromStore() {
        const snap = ensureStoreSnapshot() || {};
        const st = pickState(snap);
        setTooltipAndColor(tokyo, 'Home', `OK (${st.homeCount}/3)`, 'NG', st.homeOK);
        setTooltipAndColor(fukuoka, 'Company', 'OK', 'NG', st.companyOK);

        if (diagEl) {
            diagEl.textContent = JSON.stringify({
                homeEdges: st.he, homeOK: st.homeOK, companyOK: st.companyOK, updatedAt: snap?.updatedAt
            });
        }
    }

    renderFromStore();
    if (window.AppStore && typeof AppStore.onChange === 'function') {
        AppStore.onChange(() => renderFromStore());
    }
})();
