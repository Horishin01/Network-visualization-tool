/* =========================================================
 * training.js
 * - Leaflet地図の初期化（正方形 #map は CSS 側で担保）
 * - AppStore を読んで東京/福岡ピンのツールチップに ✅/⚠ を反映
 * - 右側プレビュー見出しにステータスピルを表示（位置修正）
 * - 保存状態ビューア（localStorageの JSON ダンプ、テスト保存/消去、トースト）
 * - storage イベントでライブ更新
 * ========================================================= */

(function () {
    'use strict';

    // ---------- 小ユーティリティ ----------
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    function showToast(msg) {
        const toast = $('#toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('on');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toast.classList.remove('on'), 1800);
    }

    function safeJSON(obj) {
        try { return JSON.stringify(obj, null, 2); }
        catch { return String(obj); }
    }

    // ---------- ステータスの読み取り ----------
    function readStatus() {
        const s = (window.AppStore && window.AppStore.readSummary())
            || { homeOK: false, companyOK: false };
        return s;
    }

    // 見出しに付けるピル（タイトルの <span> の直後に入れる）
    function setPillOnHead(headEl, which, ok, labelText) {
        if (!headEl) return;
        const titleSpan = headEl.querySelector('span') || headEl;
        const existed = headEl.querySelector(`[data-pill="${which}"]`);

        const pill = document.createElement('span');
        pill.dataset.pill = which;
        pill.textContent = `${labelText}: ${ok ? 'OK' : '未達'}`;
        pill.style.cssText =
            'margin-left:8px;padding:2px 8px;border-radius:999px;font-size:12px;' +
            'border:1px solid;white-space:nowrap;';

        if (ok) {
            pill.style.background = '#ecfdf5';
            pill.style.color = '#065f46';
            pill.style.borderColor = '#a7f3d0';
        } else {
            pill.style.background = '#fff7ed';
            pill.style.color = '#7c2d12';
            pill.style.borderColor = '#fed7aa';
        }

        if (existed) existed.replaceWith(pill);
        else titleSpan.appendChild(pill);
    }

    // ---------- ステータスUI反映 ----------
    function updateStatusUI(markers) {
        const { homeOK, companyOK } = readStatus();

        // ピンのツールチップ
        if (markers?.home) {
            markers.home.bindTooltip(
                `東京（クリックでホームへ） / Home: ${homeOK ? '✅OK' : '⚠未達'}`,
                { direction: 'top', offset: [0, -8] }
            );
        }
        if (markers?.company) {
            markers.company.bindTooltip(
                `福岡（クリックで会社へ） / Company: ${companyOK ? '✅OK' : '⚠未達'}`,
                { direction: 'top', offset: [0, -8] }
            );
        }

        //  位置修正：プレビュー側の見出し（タイトルの右隣）にのみピルを付ける
        const homeHead = document.querySelector('.preview-col .card:nth-of-type(1) .card-head');
        const compHead = document.querySelector('.preview-col .card:nth-of-type(2) .card-head');
        setPillOnHead(homeHead, 'home', homeOK, 'Home');
        setPillOnHead(compHead, 'company', companyOK, 'Company');
    }

    // ---------- 保存状態ダンプ ----------
    function dumpStore() {
        const el = $('#storeDump');
        if (!el) return;
        const s = window.AppStore?.get();
        el.textContent = s ? safeJSON(s) : '(保存なし)';
    }

    // ---------- 地図初期化 ----------
    function initMap() {
        const INITIAL_ZOOM = 5;
        const JAPAN_BOUNDS = L.latLngBounds([24.0, 122.0], [46.2, 146.0]);

        const map = L.map('map', {
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

        const pin = (name, lat, lng) => L.marker([lat, lng], { title: name }).addTo(map);

        const homeMarker = pin('東京（クリックでホームへ）', 35.6812, 139.7671);
        const compMarker = pin('福岡（クリックで会社へ）', 33.5902, 130.4017);

        homeMarker.on('click', () => { window.location.href = 'home.html'; });
        compMarker.on('click', () => { window.location.href = 'company.html'; });

        const setPointer = (m) => m.on('add', () => { if (m._icon) m._icon.style.cursor = 'pointer'; });
        setPointer(homeMarker); setPointer(compMarker);

        // 正方形レイアウトでの再計算
        window.addEventListener('load', () => setTimeout(() => map.invalidateSize(), 0));
        window.addEventListener('resize', () => map.invalidateSize());

        return { home: homeMarker, company: compMarker };
    }

    // ---------- 起動 ----------
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.AppStore) {
            console.warn('[training] AppStore が見つかりません。store.js を読み込んでください。');
        }

        const markers = initMap();

        // 初回描画
        updateStatusUI(markers);
        dumpStore();

        // UIイベント（保存状態ビューア）
        $('#btnReloadStore')?.addEventListener('click', () => {
            dumpStore();
            updateStatusUI(markers);
            showToast('保存状態を再読み込みしました。');
        });

        $('#btnMarkHomeOK')?.addEventListener('click', () => {
            window.AppStore?.patch((s) => {
                s.summary = s.summary || {};
                s.summary.homeOK = true;
                return s;
            });
            dumpStore();
            updateStatusUI(markers);
            showToast('Home 到達（テスト）を保存しました。');
        });

        $('#btnMarkCompanyOK')?.addEventListener('click', () => {
            window.AppStore?.patch((s) => {
                s.summary = s.summary || {};
                s.summary.companyOK = true;
                return s;
            });
            dumpStore();
            updateStatusUI(markers);
            showToast('Company 到達（テスト）を保存しました。');
        });

        $('#btnClearStore')?.addEventListener('click', () => {
            window.AppStore?.clear();
            dumpStore();
            updateStatusUI(markers);
            showToast('localStorage を全消去しました。');
        });

        // 他タブでの保存変更をライブ反映
        window.addEventListener('storage', (e) => {
            if (e.key === window.AppStore?.KEY) {
                dumpStore();
                updateStatusUI(markers);
                showToast('保存が更新されました。');
            }
        });
    });
})();
