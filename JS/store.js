/* =========================================================
 * store.js  ― クロスタブ共有ストア（localStorage / sessionStorage 切替）
 *
 * 目的:
 *  - 1キー=1 JSON のスナップショット保存（整合性重視）
 *  - set/patch で同タブの購読者へ即時通知（onChange）
 *  - 他タブ共有が必要な場合のみ window.storage を利用（local のみ）
 *  - 単一タブ内でのページ遷移共有は session を使う（推奨）
 * ========================================================= */
(function (global) {
    'use strict';

    // ---- 内部状態 ----
    let KEY = 'app:network:saves:default';
    let V = 1;
    let SCOPE = 'local';                 // 'local' | 'session'
    let STORAGE = window.localStorage;
    let IMPORT_ON_START = false;

    const listeners = new Set();

    // ---- util ----
    const safeParse = (raw) => { try { return JSON.parse(raw); } catch { return null; } };
    const nowIso = () => new Date().toISOString();
    const chooseStorage = (scope) => {
        SCOPE = (scope === 'session') ? 'session' : 'local';
        STORAGE = (SCOPE === 'session') ? window.sessionStorage : window.localStorage;
    };
    const emitChange = (source, data) => {
        listeners.forEach(cb => { try { cb({ data, source }); } catch { } });
    };

    // ---- I/O ----
    function getRaw() {
        let obj = null;
        const raw = STORAGE.getItem(KEY);
        obj = raw ? safeParse(raw) : null;

        // session を使う時のみ、初回は local → session を取り込み
        if (!obj && SCOPE === 'session' && IMPORT_ON_START) {
            const lraw = window.localStorage.getItem(KEY);
            const lobj = lraw ? safeParse(lraw) : null;
            if (lobj && lobj.v === V) {
                window.sessionStorage.setItem(KEY, JSON.stringify(lobj));
                obj = lobj;
            }
        }
        return (obj && obj.v === V) ? obj : null;
    }

    function setRaw(obj, source = 'local') {
        STORAGE.setItem(KEY, JSON.stringify(obj));
        emitChange(source, obj);
    }

    // ---- public API ----
    function configure({ key, version, scope = 'local', importOnStart = false } = {}) {
        if (key) KEY = key;
        if (typeof version === 'number') V = version;
        chooseStorage(scope);
        IMPORT_ON_START = !!importOnStart;

        window.addEventListener('storage', (e) => {
            if (SCOPE !== 'local') return;          // session は他タブ連携なし
            if (e.key !== KEY) return;
            const obj = safeParse(e.newValue);
            if (obj && obj.v === V) emitChange('storage', obj);
        });
    }

    function onChange(cb) { if (typeof cb === 'function') listeners.add(cb); }
    function offChange(cb) { listeners.delete(cb); }

    function get() { return getRaw(); }

    function set(val) {
        if (!val || typeof val !== 'object') throw new Error('set() にはオブジェクトを渡してください');
        val.v = V;
        val.updatedAt = nowIso();
        setRaw(val, 'local');
    }

    function patch(mutator) {
        const cur = getRaw() || { v: V };
        const draft = (typeof structuredClone === 'function') ? structuredClone(cur) : safeParse(JSON.stringify(cur));
        const next = mutator ? (mutator(draft) || draft) : draft;
        next.v = V;
        next.updatedAt = nowIso();
        setRaw(next, 'local');
        return next;
    }

    function clear() {
        STORAGE.removeItem(KEY);
        emitChange('local', null);
    }

    // 任意：明示永続
    function persistToLocal() {
        const raw = (SCOPE === 'session') ? window.sessionStorage.getItem(KEY) : STORAGE.getItem(KEY);
        if (raw) window.localStorage.setItem(KEY, raw);
    }
    function persistToSession() {
        const raw = (SCOPE === 'local') ? window.localStorage.getItem(KEY) : STORAGE.getItem(KEY);
        if (raw) window.sessionStorage.setItem(KEY, raw);
    }

    // ---- ドメインヘルパ（Home / Company） ----
    function updateHomeEdges(payload = {}) {
        return patch(d => {
            d.home = d.home || {};
            d.home.edges = { ...(d.home.edges || {}), ...payload };

            const e = d.home.edges;
            const count =
                (e?.fiberOnu ? 1 : 0) +
                (e?.onuRouter ? 1 : 0) +
                (e?.routerPc ? 1 : 0);

            d.home.reach = {
                internet: !!(e?.fiberOnu && e?.onuRouter),
                count
            };

            d.summary = d.summary || {};
            d.summary.homeOK = !!(e?.fiberOnu && e?.onuRouter && e?.routerPc);
        });
    }

    function updateCompanyEdges(payload = {}) {
        return patch(d => {
            d.company = d.company || {};
            d.company.edges = { ...(d.company.edges || {}), ...payload };

            const e = d.company.edges || {};
            d.summary = d.summary || {};
            d.summary.companyOK = !!e.minOK;
        });
    }

    function readSummary() {
        const s = getRaw();
        return {
            homeOK: !!s?.summary?.homeOK,
            companyOK: !!s?.summary?.companyOK
        };
    }

    global.AppStore = {
        configure, get, set, patch, clear, onChange, offChange,
        readSummary, updateHomeEdges, updateCompanyEdges,
        persistToLocal, persistToSession,
        get KEY() { return KEY; },
        get V() { return V; },
        get SCOPE() { return SCOPE; }
    };
})(window);
