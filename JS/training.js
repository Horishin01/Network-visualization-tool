// training.js
// ==========================================================
// ・Leaflet で日本地図を初期化（正方形は CSS 側）
// ・東京=home.html、福岡=company.html へ遷移するマーカー
// ・AppStore と連携し、保存サマリの可視化とメモリ診断を表示
// ・同一タブ／他タブ更新を購読して自動反映
// ・レガシーキー（appnetwork:saves:default）を自動移行
// ==========================================================
(function () {
    'use strict';

    // ---- 依存（AppStoreが無い場合の安全ガード） ----
    const Store = window.AppStore || {
        readSummary: () => ({ homeOK: false, companyOK: false }),
        patch: (fn) => fn({}) || {},
        onUpdate: () => () => { },
        get: () => null,
        clear: () => { }
    };

    // ---- レガシーキーの自動移行（コロン無し → 正式キー） ----
    try {
        const LEGACY = 'appnetwork:saves:default';
        const OFFICIAL = 'app:network:saves:default';
        const legacyVal = localStorage.getItem(LEGACY);
        if (legacyVal && !localStorage.getItem(OFFICIAL)) {
            localStorage.setItem(OFFICIAL, legacyVal);
        }
        // 念のため Store 側のキーも明示（未実装環境は無視される）
        if (typeof Store.configure === 'function') {
            Store.configure({ key: OFFICIAL, version: 1 });
        }
    } catch { }

    // ---- 簡易トースト ----
    function toast(msg) {
        const box = document.getElementById('toast');
        if (!box) return;
        box.textContent = msg;
        box.style.display = 'block';
        setTimeout(() => { box.style.display = 'none'; }, 2000);
    }

    // ---- 地図 ----
    const INITIAL_ZOOM = 5;
    const JAPAN_BOUNDS = L.latLngBounds([24.0, 122.0], [46.2, 146.0]);

    const PT_TOKYO = [35.6812, 139.7671];
    const PT_FUKUOKA = [33.5902, 130.4017];

    let map, badgeHome, badgeCompany;

    function makeBadge(text, ok) {
        const html = `
      <div style="
        display:inline-flex;align-items:center;gap:6px;
        padding:4px 8px;border-radius:10px;
        background:${ok ? '#0a7d34' : '#999'};
        color:#fff;font:12px/1.2 system-ui,sans-serif;
        box-shadow:0 1px 3px rgba(0,0,0,.25);
      ">
        <span style="width:8px;height:8px;border-radius:50%;
                     background:${ok ? '#4cff81' : '#ddd'}"></span>
        <span>${text}</span>
      </div>`;
        return L.divIcon({ className: 'status-badge', html, iconSize: [1, 1], iconAnchor: [-10, 12] });
    }

    function updateBadgesAndSummary() {
        const s = Store.readSummary();

        if (badgeHome) badgeHome.remove();
        if (badgeCompany) badgeCompany.remove();

        // Tokyo 側バッジ（重なり防止のため少しオフセット）
        badgeHome = L.marker(
            [PT_TOKYO[0] + 0.12, PT_TOKYO[1] - 0.25],
            { icon: makeBadge(`Home 接続: ${s.homeOK ? 'OK' : 'NG'}`, s.homeOK) }
        ).addTo(map);

        // Fukuoka 側バッジ
        badgeCompany = L.marker(
            [PT_FUKUOKA[0] - 0.15, PT_FUKUOKA[1] - 0.25],
            { icon: makeBadge(`Company 接続: ${s.companyOK ? 'OK' : 'NG'}`, s.companyOK) }
        ).addTo(map);

        // テキストサマリ
        const el = document.getElementById('txtSummary');
        if (el) {
            const cur = Store.get();
            const t = cur?.updatedAt ? new Date(cur.updatedAt).toLocaleString() : '未保存';
            el.textContent = `Home: ${s.homeOK ? 'OK' : 'NG'} / Company: ${s.companyOK ? 'OK' : 'NG'}（最終保存: ${t}）`;
        }

        dumpStore(); // ダンプも更新
    }

    function dumpStore() {
        const out = document.getElementById('storeDump');
        if (!out) return;
        const cur = Store.get();
        if (!cur) {
            out.textContent = '未保存（localStorage にデータなし）';
            return;
        }
        out.textContent = JSON.stringify(cur, null, 2);
    }

    function initMap() {
        map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
            minZoom: INITIAL_ZOOM,
            maxZoom: 12,
            maxBounds: JAPAN_BOUNDS,
            maxBoundsViscosity: 1.0
        }).setView([36.5, 137.0], INITIAL_ZOOM);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        // 東京マーカー
        L.marker(PT_TOKYO, { title: '東京（クリックで Home へ）' })
            .addTo(map)
            .bindTooltip('東京（クリックで Home へ）', { direction: 'top', offset: [0, -8] })
            .on('click', () => { window.location.href = 'home.html'; });

        // 福岡マーカー
        L.marker(PT_FUKUOKA, { title: '福岡（クリックで Company へ）' })
            .addTo(map)
            .bindTooltip('福岡（クリックで Company へ）', { direction: 'top', offset: [0, -8] })
            .on('click', () => { window.location.href = 'company.html'; });

        // 正方形表示時の再計算
        window.addEventListener('load', () => setTimeout(() => map.invalidateSize(), 0));
        window.addEventListener('resize', () => map.invalidateSize());
    }

    function wireButtons() {
        const $ = (id) => document.getElementById(id);

        const btnReload = $('btnReloadStore');
        if (btnReload) btnReload.addEventListener('click', () => {
            updateBadgesAndSummary();
            toast('保存状態を再読み込みしました。');
        });

        const btnHome = $('btnMarkHomeOK');
        if (btnHome) btnHome.addEventListener('click', () => {
            Store.patch(d => {
                d.summary = d.summary || {};
                d.summary.homeOK = true;
                d.home = d.home || {};
                d.home.reach = { ok: true, at: new Date().toISOString() };
            });
            toast('Home 接続を OK として保存しました。');
            updateBadgesAndSummary();
        });

        const btnCompany = $('btnMarkCompanyOK');
        if (btnCompany) btnCompany.addEventListener('click', () => {
            Store.patch(d => {
                d.summary = d.summary || {};
                d.summary.companyOK = true;
                d.company = d.company || {};
                d.company.reach = { ok: true, at: new Date().toISOString() };
            });
            toast('Company 接続を OK として保存しました。');
            updateBadgesAndSummary();
        });

        const btnClear = $('btnClearStore');
        if (btnClear) btnClear.addEventListener('click', () => {
            Store.clear();
            toast('保存データを消去しました。');
            updateBadgesAndSummary();
        });
    }

    function boot() {
        if (!document.getElementById('map')) return;
        initMap();
        wireButtons();
        updateBadgesAndSummary();

        // 他タブ・同一タブからの更新を購読
        Store.onUpdate(() => {
            updateBadgesAndSummary();
            toast('保存内容が更新されました。');
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
