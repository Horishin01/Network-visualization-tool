/* =========================================================
 * training.js  日本地図ページ
 *  - AppStore のスナップショットを読み取りバッジ更新
 *  - BroadcastChannel / storage / CustomEvent で更新を監視
 *  - FTP バッジは companyOK と同一に更新（配線3本=即 T）
 * ========================================================= */
(function () {
    'use strict';


    function renderFtpPanel(companyOK, ftpOnline) {
        if (!ftpConsole) return;
        ftpUploads = loadUploads();
        ftpDeploy = loadDeployments();
        ftpConsoleEnabled = companyOK && ftpOnline;
        ftpConsole.hidden = !companyOK;
        ftpConsole.classList.toggle('disabled', !ftpConsoleEnabled);
        if (!selectedSlot) selectedSlot = FTP_SITES[0].id;
        renderFtpSlots();
        renderUploadOptions();
        const hasDeploy = Object.values(ftpDeploy || {}).some(Boolean);
        const ftpOK = ftpConsoleEnabled && hasDeploy;
        setBadgeState(ftpStatusEl, ftpOK);
        if (!ftpConsoleEnabled && ftpPreview) {
            ftpPreview.removeAttribute('src');
            if (ftpPreviewUrl){ URL.revokeObjectURL(ftpPreviewUrl); ftpPreviewUrl = null; }
        }
    }

    function renderUploadOptions() {
        if (!ftpUploadSelect) return;
        ftpUploadSelect.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = ftpConsoleEnabled ? '--- アップロードを選択 ---' : '会社側を T にすると解禁';
        ftpUploadSelect.appendChild(placeholder);
        if (!ftpUploads.length) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'アップロードがありません';
            ftpUploadSelect.appendChild(opt);
        } else {
            ftpUploads.forEach((u) => {
                const opt = document.createElement('option');
                opt.value = u.id;
                opt.textContent = `${u.name} (${(u.size/1024).toFixed(1)} KB)`;
                ftpUploadSelect.appendChild(opt);
            });
        }
        ftpUploadSelect.disabled = !ftpConsoleEnabled || !ftpUploads.length;
        if (ftpAssignBtn) ftpAssignBtn.disabled = ftpUploadSelect.disabled;
    }

    function renderFtpSlots() {
        if (!ftpSlotsEl) return;
        ftpSlotsEl.innerHTML = '';
        FTP_SITES.forEach((site) => {
            const id = site.id;
            const entry = pickUpload(ftpDeploy[id]);
            const card = document.createElement('div');
            card.className = 'ftp-slot';
            if (id === selectedSlot) card.classList.add('active');
            card.dataset.slot = id;
            card.innerHTML = `
                <div class="ftp-slot__head">
                    <div>
                        <div class="ftp-slot__title">${site.label}</div>
                        <div class="ftp-slot__hint">${site.hint}</div>
                    </div>
                    <span class="badge ${entry ? 'badge-ok' : 'badge-ng'}">${entry ? 'OK' : '空'}</span>
                </div>
                <div class="ftp-slot__body">
                    <div class="ftp-slot__file">${entry ? entry.name : '未割り当て'}</div>
                    <div class="ftp-slot__actions">
                        <button data-action="select" data-slot="${id}" ${ftpConsoleEnabled ? '' : 'disabled'}>選択</button>
                        <button data-action="preview" data-slot="${id}" ${entry && ftpConsoleEnabled ? '' : 'disabled'}>プレビュー</button>
                    </div>
                </div>`;
            ftpSlotsEl.appendChild(card);
        });
    }

    function previewSlot(slotId) {
        const entry = pickUpload(ftpDeploy[slotId]);
        if (!entry) {
            showToast('このスロットにファイルがありません');
            return;
        }
        if (ftpPreviewUrl) {
            URL.revokeObjectURL(ftpPreviewUrl);
            ftpPreviewUrl = null;
        }
        ftpPreviewUrl = URL.createObjectURL(new Blob([entry.content], { type: entry.type || 'text/html' }));
        if (ftpPreview) ftpPreview.src = ftpPreviewUrl;
        if (ftpPreviewLabel) ftpPreviewLabel.textContent = `${slotLabel(slotId)}: ${entry.name}`;
        showToast(`${slotLabel(slotId)} を表示しました`);
    }

    function slotLabel(id) {
        const found = FTP_SITES.find((s) => s.id === id);
        return found ? found.label : id;
    }

    async function addInlineUpload(file) {
        if (!file) return;
        const text = await file.text();
        const newId = (globalThis.crypto && typeof crypto.randomUUID === 'function')
            ? crypto.randomUUID()
            : `upload-${Date.now()}`;
        const entry = {
            id: newId,
            name: file.name,
            size: file.size,
            type: file.type || 'text/html',
            uploadedAt: new Date().toISOString(),
            content: text
        };
        ftpUploads.unshift(entry);
        saveUploads(ftpUploads);
        if (ftpInlineFile) ftpInlineFile.value = '';
        showToast(`${file.name} を仮想FTPに追加しました`);
        renderFtpPanel(lastCompanyOK, lastCompanyStatus?.ftpReachable);
    }

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
    const ftpConsole     = document.getElementById('ftpConsole');
    const ftpSlotsEl     = document.getElementById('ftpSlots');
    const ftpUploadSelect= document.getElementById('ftpUploadSelect');
    const ftpAssignBtn   = document.getElementById('ftpAssignBtn');
    const ftpInlineFile  = document.getElementById('ftpInlineFile');
    const ftpPreview     = document.getElementById('ftpPreview');
    const ftpPreviewLabel= document.getElementById('ftpPreviewLabel');
    const ftpToast       = document.getElementById('toast');

    // ---- 共有キー/チャンネル ----
    const STORE_KEY = 'app:network:saves:default';
    const BC_NAME   = 'network-app';
    const FTP_KEY   = 'app:network:ftpUploads:v1';
    const FTP_DEPLOY_KEY = 'app:network:ftpDeploy:v1';

    let lastSnapshotJson = '';
    let lastCompanyOK = false;
    let lastCompanyStatus = null;
    const FTP_SITES = [
        { id: 'siteA', label: 'Site A', hint: 'corp-a.local' },
        { id: 'siteB', label: 'Site B', hint: 'corp-b.local' },
        { id: 'siteC', label: 'Site C', hint: 'corp-c.local' }
    ];
    let ftpUploads = [];
    let ftpDeploy = {};
    let selectedSlot = 'siteA';
    let ftpPreviewUrl = null;
    let ftpConsoleEnabled = false;

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
            company: { edges:{ fiberOnu:false, onuRouter:false, routerPc:false }, reach:{ internet:false, count:0 }, status:{ ftpReachable:false }, canvas:null },
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
        const fiberEdge  = typeof ce.fiberOnu   === 'boolean' ? ce.fiberOnu   : !!ce.fiber;
        const routerEdge = typeof ce.onuRouter  === 'boolean' ? ce.onuRouter  : !!ce.routerWan;
        const clientEdge = typeof ce.routerPc   === 'boolean' ? ce.routerPc   : !!ce.routerWeb;
        const ftpEdge    = typeof ce.routerFtp  === 'boolean' ? ce.routerFtp  : false;

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
        const ftpReachable =
            (typeof companyStatus?.ftpReachable === 'boolean')
                ? companyStatus.ftpReachable
                : (fiberEdge && routerEdge && ftpEdge);
        companyStatus.fiberLink    = fiberEdge;
        companyStatus.routerWanLink= routerEdge;
        companyStatus.webReachable = clientEdge;
        companyStatus.ftpReachable = ftpReachable;
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

    function showToast(message) {
        if (!ftpToast) return;
        ftpToast.textContent = message;
        ftpToast.classList.add('on');
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => ftpToast.classList.remove('on'), 2200);
    }

    function loadUploads() {
        try {
            const raw = localStorage.getItem(FTP_KEY);
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function saveUploads(list) {
        localStorage.setItem(FTP_KEY, JSON.stringify(list));
    }

    function loadDeployments() {
        try {
            const raw = localStorage.getItem(FTP_DEPLOY_KEY);
            const parsed = raw ? JSON.parse(raw) : {};
            return parsed && typeof parsed === 'object' ? parsed : {};
        } catch {
            return {};
        }
    }

    function saveDeployments(map) {
        localStorage.setItem(FTP_DEPLOY_KEY, JSON.stringify(map));
        if (window.AppStore && typeof AppStore.patch === 'function') {
            AppStore.patch((d) => {
                d.company = d.company || {};
                d.company.status = d.company.status || {};
                d.company.status.ftpDeployed = map;
            });
        }
    }

    function pickUpload(id) {
        return ftpUploads.find((u) => u.id === id) || null;
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
        lastCompanyOK = companyOK;
        lastCompanyStatus = status;
        setBadgeState(companyBadge, companyOK);

        const ftpOnline = !!(status && status.ftpReachable);
        const hasDeploy = Object.values(ftpDeploy || {}).some(Boolean);
        const ftpOK = ftpOnline && hasDeploy;
        setBadgeState(ftpStatusEl, ftpOK);

        if (companyOK) {
            if (companyLock)  companyLock.hidden  = true;
            if (companyIframe){
                companyIframe.hidden = true;
                companyIframe.removeAttribute('src');
                delete companyIframe.dataset.loaded;
            }
            renderFtpPanel(companyOK, ftpOnline);
        } else {
            if (companyLock)  companyLock.hidden  = false;
            if (companyIframe){
                companyIframe.hidden = true;
                companyIframe.removeAttribute('src');
                delete companyIframe.dataset.loaded;
            }
            if (ftpConsole){
                ftpConsole.hidden = true;
            }
            setBadgeState(ftpStatusEl, false);
        }
    }


    // ---- 初期化 ----
    ftpUploads = loadUploads();
    ftpDeploy = loadDeployments();
    renderFromStore(true);

    const driveRender = () => renderFromStore(true);
    window.addEventListener('focus', driveRender);
    window.addEventListener('pageshow', driveRender);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) driveRender(); });

    // 他タブ更新（storage）
    window.addEventListener('storage', (e) => {
        if (e.key === STORE_KEY || e.key === 'company:lastEdges' || e.key === 'company:canvas:snapshot') {
            driveRender();
        } else if (e.key === FTP_KEY || e.key === FTP_DEPLOY_KEY) {
            ftpUploads = loadUploads();
            ftpDeploy = loadDeployments();
            renderFtpPanel(lastCompanyOK, lastCompanyStatus?.ftpReachable);
        }
    });

    if (ftpSlotsEl) {
        ftpSlotsEl.addEventListener('click', (ev) => {
            const btn = ev.target.closest('button[data-action]');
            if (!btn) return;
            const slot = btn.dataset.slot;
            if (!slot) return;
            selectedSlot = slot;
            if (btn.dataset.action === 'preview') {
                if (!ftpConsoleEnabled) { showToast('会社側を T にすると利用できます'); return; }
                previewSlot(slot);
            } else if (btn.dataset.action === 'select') {
                if (!ftpConsoleEnabled) { showToast('会社側を T にすると利用できます'); return; }
                showToast(`${slotLabel(slot)} を選択しました`);
            }
            renderFtpPanel(lastCompanyOK, lastCompanyStatus?.ftpReachable);
        });
    }

    if (ftpAssignBtn) {
        ftpAssignBtn.addEventListener('click', () => {
            if (!ftpConsoleEnabled) { showToast('会社側を T にすると利用できます'); return; }
            const uploadId = ftpUploadSelect?.value;
            const entry = pickUpload(uploadId);
            if (!uploadId || !entry) {
                showToast('アップロード済みファイルを選んでください');
                return;
            }
            ftpDeploy = Object.assign({}, ftpDeploy, { [selectedSlot]: uploadId });
            saveDeployments(ftpDeploy);
            renderFtpPanel(lastCompanyOK, lastCompanyStatus?.ftpReachable);
            showToast(`${slotLabel(selectedSlot)} に ${entry.name} を割り当てました`);
        });
    }

    if (ftpInlineFile) {
        ftpInlineFile.addEventListener('change', (ev) => {
            const file = ev.target?.files?.[0];
            if (file) addInlineUpload(file);
        });
    }

    window.addEventListener('beforeunload', () => {
        if (ftpPreviewUrl) {
            URL.revokeObjectURL(ftpPreviewUrl);
            ftpPreviewUrl = null;
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
