/* =========================================================
 * training_boot.js ― training.html のストア初期化とUI同期
 *  - ストアの現在値を読み込み UI に反映
 *  - onChange と pageshow で再描画
 * ========================================================= */

const $ = (q) => document.querySelector(q);

function renderDiagFromStore() {
    const diag = $('#diag');
    const s = AppStore.get();
    if (!diag) return;

    if (!s) {
        diag.textContent = '未保存';
        return;
    }
    const home = s.home?.edges || {};
    const companyOK = !!s.summary?.companyOK;
    const homeOK = !!s.summary?.homeOK;

    diag.textContent = JSON.stringify({
        homeEdges: home,
        homeOK,
        companyOK,
        updatedAt: s.updatedAt
    });
}

document.addEventListener('DOMContentLoaded', () => {
    renderDiagFromStore();

    AppStore.onChange(() => renderDiagFromStore());

    $('#btn-reload')?.addEventListener('click', renderDiagFromStore);
    $('#btn-save-home-ok')?.addEventListener('click', () => {
        AppStore.updateHomeEdges({ fiberOnu: true, onuRouter: true, routerPc: true });
    });
    $('#btn-save-company-ok')?.addEventListener('click', () => {
        AppStore.updateCompanyEdges({ minOK: true });
    });
    $('#btn-clear')?.addEventListener('click', () => {
        AppStore.clear();
    });
});

window.addEventListener('pageshow', () => {
    renderDiagFromStore();
});
