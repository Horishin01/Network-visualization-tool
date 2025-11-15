(function () {
    'use strict';

    const FTP_KEY = 'app:network:ftpUploads:v1';
    const STORE_KEY = 'app:network:saves:default';
    const uploads = loadUploads();
    let currentBlobUrl = null;
    let autoRefresh = false;
    let autoTimer = null;

    const ftpForm = document.getElementById('ftpForm');
    const ftpList = document.getElementById('ftpList');
    const uploadSelect = document.getElementById('uploadSelect');
    const openUploadBtn = document.getElementById('openUploadInBrowser');
    const frame = document.getElementById('virtualFrame');
    const bridgeLine = document.getElementById('bridgeLine');
    const statusHome = document.querySelector('[data-status-home]');
    const statusCompany = document.querySelector('[data-status-company]');
    const homeDetail = document.getElementById('homeDetail');
    const companyDetail = document.getElementById('companyDetail');
    const dnsDetail = document.getElementById('dnsDetail');
    const refreshBtn = document.getElementById('refreshStatus');
    const autoToggle = document.getElementById('autoRefreshToggle');
    const toastEl = document.getElementById('toast');

    renderUploads();
    refreshBridgeStatus();

    if (ftpForm) {
        ftpForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const file = document.getElementById('ftpFile')?.files?.[0];
            if (!file) {
                showToast('アップロードするファイルを選択してください');
                return;
            }
            const host = document.getElementById('ftpHost')?.value?.trim() || 'ftp.local';
            const user = document.getElementById('ftpUser')?.value?.trim() || 'anonymous';
            const pass = document.getElementById('ftpPass')?.value || '';
            const text = await file.text();
            const newId = (globalThis.crypto && typeof crypto.randomUUID === 'function')
                ? crypto.randomUUID()
                : `upload-${Date.now()}`;
            const entry = {
                id: newId,
                name: file.name,
                size: file.size,
                type: file.type || 'text/html',
                host,
                user,
                passHint: pass ? '••••' : '',
                uploadedAt: new Date().toISOString(),
                content: text
            };
            uploads.unshift(entry);
            saveUploads();
            renderUploads();
            ftpForm.reset();
            showToast(`${file.name} を仮想 FTP に保存しました`);
        });
    }

    if (ftpList) {
        ftpList.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-action]');
            if (!btn) return;
            const id = btn.dataset.id;
            const entry = uploads.find(u => u.id === id);
            if (!entry) return;
            if (btn.dataset.action === 'preview') {
                openUpload(entry);
            } else if (btn.dataset.action === 'delete') {
                const index = uploads.findIndex(u => u.id === id);
                if (index >= 0) {
                    uploads.splice(index, 1);
                    saveUploads();
                    renderUploads();
                    showToast(`${entry.name} を削除しました`);
                }
            } else if (btn.dataset.action === 'download') {
                const blob = new Blob([entry.content], { type: entry.type || 'text/html' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = entry.name;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(url), 500);
            }
        });
    }

    if (openUploadBtn) {
        openUploadBtn.addEventListener('click', () => {
            const id = uploadSelect?.value;
            const entry = uploads.find(u => u.id === id);
            if (!entry) {
                showToast('アップロード済みファイルを選択してください');
                return;
            }
            openUpload(entry);
        });
    }

    document.querySelectorAll('[data-view]').forEach((btn) => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (view === 'home') {
                setFrameSrc('home.html');
            } else if (view === 'company') {
                setFrameSrc('company.html');
            } else {
                setFrameSrc('../index.html');
            }
        });
    });

    if (refreshBtn) {
        refreshBtn.addEventListener('click', refreshBridgeStatus);
    }

    if (autoToggle) {
        autoToggle.addEventListener('click', () => {
            autoRefresh = !autoRefresh;
            autoToggle.textContent = `自動更新: ${autoRefresh ? 'ON' : 'OFF'}`;
            if (autoTimer) {
                clearInterval(autoTimer);
                autoTimer = null;
            }
            if (autoRefresh) {
                autoTimer = setInterval(refreshBridgeStatus, 5000);
                refreshBridgeStatus();
            }
        });
    }

    window.addEventListener('storage', (event) => {
        if (event.key === FTP_KEY) {
            uploads.splice(0, uploads.length, ...loadUploads());
            renderUploads();
        } else if (event.key === STORE_KEY) {
            refreshBridgeStatus();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
        if (autoTimer) clearInterval(autoTimer);
    });

    function refreshBridgeStatus() {
        if (!statusHome || !statusCompany) return;
        const snap = (window.AppStore && AppStore.get()) || null;
        const summary = snap?.summary || {};
        const homeReach = snap?.home?.reach;
        const companyInfo = snap?.company?.status;
        const dnsInfo = snap?.company?.lastDnsCheck;
        const homeOK = !!summary.homeOK;
        const companyOK = !!summary.companyOK;

        statusHome.textContent = homeOK ? 'ONLINE' : 'OFFLINE';
        statusCompany.textContent = companyOK ? 'ONLINE' : 'OFFLINE';
        statusHome.classList.toggle('on', homeOK);
        statusHome.classList.toggle('off', !homeOK);
        statusCompany.classList.toggle('on', companyOK);
        statusCompany.classList.toggle('off', !companyOK);

        bridgeLine?.classList.toggle('active', homeOK && companyOK);
        if (homeDetail) {
            homeDetail.textContent = homeReach
                ? `接続 ${homeReach.count} / インターネット ${homeReach.internet ? 'OK' : 'NG'}`
                : '未構築';
        }

        if (companyDetail) {
            if (companyInfo) {
                companyDetail.textContent =
                    `光${companyInfo.fiberLink ? 'OK' : 'NG'} / WAN${companyInfo.routerWanLink ? 'OK' : 'NG'} / LAN端末 ${companyInfo.lanClients}`;
            } else {
                companyDetail.textContent = '未構築';
            }
        }

        if (dnsDetail) {
            if (dnsInfo) {
                const when = new Date(dnsInfo.timestamp).toLocaleString();
                dnsDetail.textContent = `${dnsInfo.ok ? 'OK' : 'NG'} (${dnsInfo.domain}, ${when})`;
            } else {
                dnsDetail.textContent = '未実行';
            }
        }
    }

    function renderUploads() {
        if (!ftpList) return;
        ftpList.innerHTML = '';
        if (!uploads.length) {
            ftpList.innerHTML = '<li class="upload-card">アップロード済みファイルはまだありません。</li>';
        } else {
            uploads.forEach((entry) => {
                const li = document.createElement('li');
                li.className = 'upload-card';
                li.innerHTML = `
                    <header>
                        <span>${entry.name}</span>
                        <span>${(entry.size / 1024).toFixed(1)} KB</span>
                    </header>
                    <div class="meta">
                        Host: ${entry.host} / User: ${entry.user} / 更新: ${new Date(entry.uploadedAt).toLocaleString()}
                    </div>
                    <div class="actions">
                        <button data-action="preview" data-id="${entry.id}">仮想ブラウザで表示</button>
                        <button data-action="download" data-id="${entry.id}">ダウンロード</button>
                        <button data-action="delete" data-id="${entry.id}">削除</button>
                    </div>`;
                ftpList.appendChild(li);
            });
        }

        if (uploadSelect) {
            uploadSelect.innerHTML = '<option value=\"\">--- ファイルを選択 ---</option>';
            uploads.forEach((entry) => {
                const opt = document.createElement('option');
                opt.value = entry.id;
                opt.textContent = `${entry.name} (${new Date(entry.uploadedAt).toLocaleTimeString()})`;
                uploadSelect.appendChild(opt);
            });
        }
    }

    function openUpload(entry) {
        if (!entry) return;
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
        const blob = new Blob([entry.content], { type: entry.type || 'text/html' });
        currentBlobUrl = URL.createObjectURL(blob);
        if (frame) frame.src = currentBlobUrl;
        showToast(`${entry.name} を仮想ブラウザにロードしました`);
    }

    function setFrameSrc(relativePath) {
        if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
            currentBlobUrl = null;
        }
        if (frame) frame.src = relativePath;
        showToast(`ブラウザに ${relativePath} を読み込みました`);
    }

    function loadUploads() {
        try {
            const raw = window.localStorage.getItem(FTP_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch (err) {
            console.warn('[ADVANCED] loadUploads failed', err);
            return [];
        }
    }

    function saveUploads() {
        window.localStorage.setItem(FTP_KEY, JSON.stringify(uploads));
    }

    function showToast(message) {
        if (!toastEl) return;
        toastEl.textContent = message;
        toastEl.classList.add('on');
        setTimeout(() => toastEl.classList.remove('on'), 2500);
    }
})();
