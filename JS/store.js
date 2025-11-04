/* =========================================================
 *  AppStore (localStorage / sessionStorage ユーティリティ)
 *  - スキーマ: { v, updatedAt, home:{reach}, company:{reach}, summary:{homeOK, companyOK} }
 *  - 使い方:
 *      AppStore.get(), AppStore.patch(mutator), AppStore.clear()
 *      AppStore.readSummary() -> {homeOK, companyOK}
 *      AppStore.saveDraft(scope, data), loadDraft(scope), clearDraft(scope)
 * ========================================================= */
(function (global) {
    'use strict';

    const KEY = 'app:network:saves:default';
    const V = 1;

    const safeParse = (raw) => {
        try { return JSON.parse(raw); } catch { return null; }
    };

    function get() {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const obj = safeParse(raw);
        return obj && obj.v === V ? obj : null;
    }

    function set(val) {
        localStorage.setItem(KEY, JSON.stringify(val));
    }

    function deepClone(obj) {
        if (typeof structuredClone === 'function') return structuredClone(obj);
        return safeParse(JSON.stringify(obj));
    }

    /** 既存値に対して変更を加えて保存（存在しなければ雛形で作成） */
    function patch(mutator) {
        const cur = get() || { v: V };
        const base = deepClone(cur) || { v: V };
        const next = mutator ? (mutator(base) || base) : base;
        next.v = V;
        next.updatedAt = new Date().toISOString();
        set(next);
        return next;
    }

    function clear() {
        localStorage.removeItem(KEY);
    }

    function readSummary() {
        const s = get();
        return {
            homeOK: !!s?.summary?.homeOK,
            companyOK: !!s?.summary?.companyOK
        };
    }

    // ---- Draft APIs (作業中は sessionStorage に保存) ----
    const DRAFT_PREFIX = 'app:network:session:';

    function saveDraft(scope, data) {
        const payload = { v: V, updatedAt: new Date().toISOString(), ...data };
        sessionStorage.setItem(DRAFT_PREFIX + scope, JSON.stringify(payload));
        return payload;
    }

    function loadDraft(scope) {
        const raw = sessionStorage.getItem(DRAFT_PREFIX + scope);
        return raw ? safeParse(raw) : null;
    }

    function clearDraft(scope) {
        sessionStorage.removeItem(DRAFT_PREFIX + scope);
    }

    // 公開
    global.AppStore = {
        KEY, V,
        get, set, patch, clear,
        readSummary,
        saveDraft, loadDraft, clearDraft
    };
})(window);
