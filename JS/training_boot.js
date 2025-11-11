/* =========================================================
 * training_boot.js
 * AppStore 読取り → #diag 表示（読み取り専用、書き込まない）
 * ========================================================= */
(function (global) {
    'use strict';

    if (!global.AppStore) { console.error('[TRAINING] AppStore 未読込'); return; }

    function render() {
        const s = AppStore.get();
        const payload = {
            homeEdges: s?.home?.edges || { fiberOnu: false, onuRouter: false, routerPc: false },
            homeOK: !!(s?.summary?.homeOK),
            companyOK: !!(s?.summary?.companyOK),
            v: s?.v ?? null,
            updatedAt: s?.updatedAt ?? null
        };
        const el = document.querySelector('#diag');
        if (el) el.textContent = JSON.stringify(payload, null, 2);
        console.error('[TRAINING] render', payload);
        return payload;
    }

    document.addEventListener('DOMContentLoaded', render);
    window.addEventListener('storage', (e) => {
        if (e.key === AppStore._conf.key) render();
    });

    global.TrainingDebug = { read() { const p = render(); console.error('[DEBUG] TrainingDebug.read()', p); return p; } };
})(window);
