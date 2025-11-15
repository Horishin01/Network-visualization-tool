/* =========================================================
 * training.js  トレーニング画面のステータス連動
 *  - AppStore.summary.companyOK を監視し「FTPサーバーアクセス」バッジを更新
 *  - storage/BroadcastChannel/CustomEvent のいずれでも反応
 * ========================================================= */
(function (global) {
    'use strict';

    const BADGE_FTP = document.getElementById('ftpAccessBadge'); // 例: <span id="ftpAccessBadge" class="badge">F</span>
    const KEY = 'app:network:saves:default';
    const BC_NAME = 'network-app';

    function setBadge(el, ok){
        if (!el) return;
        el.textContent = ok ? 'T' : 'F';
        el.classList.toggle('on', ok);
        el.classList.toggle('off', !ok);
    }

    function readCompanyOK(){
        try {
            if (global.AppStore && typeof AppStore.readSummary === 'function'){
                const s = AppStore.readSummary();
                return !!s.companyOK;
            }
            // AppStore が未ロードでも最終値を読む
            const raw = (global.localStorage && global.localStorage.getItem(KEY)) || null;
            if (!raw) return false;
            const obj = JSON.parse(raw);
            return !!(obj?.summary?.companyOK);
        } catch { return false; }
    }

    function render(){
        setBadge(BADGE_FTP, readCompanyOK());
    }

    // 初期描画
    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', render, { once:true });
    } else {
        render();
    }

    // 変更監視: storage（他タブ）/ BroadcastChannel / CustomEvent（同タブ）
    window.addEventListener('storage', (e) => { if (e.key === KEY) render(); });
    try {
        const ch = new BroadcastChannel(BC_NAME);
        ch.onmessage = (ev) => { if (ev?.data?.type === 'store-updated') render(); };
    } catch {}
    window.addEventListener('appstore:updated', render);
})(window);
