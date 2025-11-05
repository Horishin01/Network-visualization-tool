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
    /** 単一要素取得のショートハンド */
    const $ = (s, r = document) => r.querySelector(s);
    /** 複数要素取得のショートハンド（Array化） */
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

    /**
     * 画面右下などに出す簡易トースト
     * - #toast 要素が存在しない場合は黙って無視
     * - 表示は1.8秒で自動消滅
     */
    function showToast(msg) {
        const toast = $('#toast');
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.add('on');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => toast.classList.remove('on'), 1800);
    }

    /**
     * JSON.stringify の安全ラッパ
     * - 循環参照などで例外時は toString にフォールバック
     */
    function safeJSON(obj) {
        try { return JSON.stringify(obj, null, 2); }
        catch { return String(obj); }
    }

    // ---------- ステータスの読み取り ----------
    /**
     * AppStore からサマリ（homeOK / companyOK）を取得
     * - AppStore 未読込や未保存時は false でデフォルト
     */
    function readStatus() {
        const s = (window.AppStore && window.AppStore.readSummary())
            || { homeOK: false, companyOK: false };
        return s;
    }

    /**
     * 見出し要素にステータスピルを付ける/置き換える
     * @param {HTMLElement} headEl  見出し .card-head
     * @param {string} which        識別子 'home' | 'company'
     * @param {boolean} ok          状態
     * @param {string} labelText    表示ラベル
     *
     * 仕様:
     * - 見出し内の先頭<span>の直後にピルを設置（存在しなければ headEl に付与）
     * - 同じ data-pill の要素があれば置き換え
     */
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

        // 成否で配色を切替（淡色の成功/警告バッジ）
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
    /**
     * マーカーのツールチップと右ペインの見出しピルを最新化
     * @param {{home:L.Marker, company:L.Marker}} markers Leafletマーカー集合
     */
    function updateStatusUI(markers) {
        const { homeOK, companyOK } = readStatus();

        // ピンのツールチップ（到達状態を即時可視化）
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

        // ★ 位置修正: プレビュー側見出しの右にのみピルを付与
        const homeHead = document.querySelector('.preview-col .card:nth-of-type(1) .card-head');
        const compHead = document.querySelector('.preview-col .card:nth-of-type(2) .card-head');
        setPillOnHead(homeHead, 'home', homeOK, 'Home');
        setPillOnHead(compHead, 'company', companyOK, 'Company');
    }

    // ---------- 保存状態ダンプ ----------
    /**
     * localStorage 内の AppStore 本体を #storeDump にJSON整形表示
     * - 未保存時は "(保存なし)" を表示
     */
    function dumpStore() {
        const el = $('#storeDump');
        if (!el) return;
        const s = window.AppStore?.get();
        el.textContent = s ? safeJSON(s) : '(保存なし)';
    }

    // ---------- 地図初期化 ----------
    /**
     * Leaflet マップ初期化と主要マーカー設置
     * - #map 要素が正方形で配置済みである前提（CSSで保証）
     * - 初期表示は日本全域（やや広め）
     * - bounds 逸脱時にバウンド（maxBoundsViscosity=1.0）
     * @returns {{home:L.Marker, company:L.Marker}}
     */
    function initMap() {
        const INITIAL_ZOOM = 5;
        // 日本の概形をカバーする緯度経度範囲（おおよそ）
        const JAPAN_BOUNDS = L.latLngBounds([24.0, 122.0], [46.2, 146.0]);

        const map = L.map('map', {
            zoomControl: true,
            attributionControl: true,
            minZoom: INITIAL_ZOOM,
            maxZoom: 12,
            maxBounds: JAPAN_BOUNDS,
            maxBoundsViscosity: 1.0
        }).setView([36.5, 137.0], INITIAL_ZOOM);

        // OSM タイル（商用はクレジットと利用規約に留意）
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; OpenStreetMap contributors'
        }).addTo(map);

        /** マーカー生成のヘルパ */
        const pin = (name, lat, lng) => L.marker([lat, lng], { title: name }).addTo(map);

        // 主要地点のピン（東京駅周辺 / 福岡天神周辺）
        const homeMarker = pin('東京（クリックでホームへ）', 35.6812, 139.7671);
        const compMarker = pin('福岡（クリックで会社へ）', 33.5902, 130.4017);

        // クリックで各ページへ遷移
        homeMarker.on('click', () => { window.location.href = 'home.html'; });
        compMarker.on('click', () => { window.location.href = 'company.html'; });

        // マーカー上でポインタ形状に（アクセシビリティ改善）
        const setPointer = (m) => m.on('add', () => { if (m._icon) m._icon.style.cursor = 'pointer'; });
        setPointer(homeMarker); setPointer(compMarker);

        // 正方形レイアウトに伴う Leaflet のサイズ再計算
        window.addEventListener('load', () => setTimeout(() => map.invalidateSize(), 0));
        window.addEventListener('resize', () => map.invalidateSize());

        return { home: homeMarker, company: compMarker };
    }

    // ---------- 起動 ----------
    /**
     * DOM構築完了後に初期化
     * - AppStore の存在チェック（未読込ならコンソール警告）
     * - 地図初期化 → 状態反映 → ダンプ
     * - ボタン群のイベントバインド
     * - storage イベントで他タブ更新を反映
     */
    document.addEventListener('DOMContentLoaded', () => {
        if (!window.AppStore) {
            console.warn('[training] AppStore が見つかりません。store.js を読み込んでください。');
        }

        // 地図とマーカーを初期化
        const markers = initMap();

        // 初回描画
        updateStatusUI(markers);
        dumpStore();

        // ---- UIイベント（保存状態ビューア） ----

        // 再読み込み: 画面に保存内容を反映
        $('#btnReloadStore')?.addEventListener('click', () => {
            dumpStore();
            updateStatusUI(markers);
            showToast('保存状態を再読み込みしました。');
        });

        // Home 到達のテスト保存（summary.homeOK=true）
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

        // Company 到達のテスト保存（summary.companyOK=true）
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

        // localStorage の AppStore エントリを全削除
        $('#btnClearStore')?.addEventListener('click', () => {
            window.AppStore?.clear();
            dumpStore();
            updateStatusUI(markers);
            showToast('localStorage を全消去しました。');
        });

        // ---- 他タブ/ウィンドウでの変更をライブ反映 ----
        // storage イベントは「別コンテキストでの変更時」にのみ発火
        window.addEventListener('storage', (e) => {
            if (e.key === window.AppStore?.KEY) {
                dumpStore();
                updateStatusUI(markers);
                showToast('保存が更新されました。');
            }
        });
    });
})();
