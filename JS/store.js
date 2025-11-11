/* =========================================================
 * store.js  AppStore (localStorage / sessionStorage ラッパ)
 * ========================================================= */
(function (global) {
    'use strict';

    const PREFIX = '[STORE]';
    const DEF = Object.freeze({
        v: 0,
        updatedAt: new Date(0).toISOString(),
        home: { edges: { fiberOnu: false, onuRouter: false, routerPc: false }, reach: { internet: false, count: 0 } },
        company: {},
        summary: { homeOK: false, companyOK: false }
    });

    function nowISO() { return new Date().toISOString(); }
    function clone(x) { return JSON.parse(JSON.stringify(x)); }

    const AppStore = {
        _conf: { key: 'app:network:saves:default', version: 1, scope: 'local', importOnStart: false },
        _storage: window.localStorage,

        configure(conf) {
            this._conf = Object.assign({}, this._conf, conf || {});
            this._storage = (this._conf.scope === 'session') ? window.sessionStorage : window.localStorage;
            console.error(`${PREFIX} configure: key=${this._conf.key} v=${this._conf.version} scope=${this._conf.scope}`);
            try { this.get(); } catch (e) {
                console.error(`${PREFIX} parse error -> clear and reinit`, e);
                this._storage.removeItem(this._conf.key);
                this._ensureRoot();
            }
            this._ensureRoot();
        },

        _ensureRoot() {
            const cur = this._rawRead();
            if (!cur) {
                const init = clone(DEF);
                init.v = this._conf.version;
                init.updatedAt = nowISO();
                this._rawWrite(init);
                console.error('[HOME-BRIDGE] ensureRoot: 初期化 set()');
                return init;
            }
            if (typeof cur.v !== 'number' || cur.v !== this._conf.version) {
                cur.v = this._conf.version;
                cur.updatedAt = nowISO();
                this._rawWrite(cur);
            }
            let patched = false;
            if (!cur.home) { cur.home = clone(DEF.home); patched = true; }
            if (!cur.company) { cur.company = clone(DEF.company); patched = true; }
            if (!cur.summary) { cur.summary = clone(DEF.summary); patched = true; }
            if (patched) {
                cur.updatedAt = nowISO();
                this._rawWrite(cur);
            }
            return cur;
        },

        _rawRead() {
            const s = this._storage.getItem(this._conf.key);
            if (!s) return null;
            return JSON.parse(s);
        },

        _rawWrite(obj) { this._storage.setItem(this._conf.key, JSON.stringify(obj)); },

        get() {
            const o = this._rawRead();
            return o ? clone(o) : null;
        },

        set(obj) {
            const next = clone(obj);
            next.v = this._conf.version;
            next.updatedAt = nowISO();
            this._rawWrite(next);
            return clone(next);
        },

        patch(mutator) {
            const base = this._ensureRoot();
            const draft = clone(base);
            const ret = (typeof mutator === 'function') ? mutator(draft) : undefined;
            const next = ret && typeof ret === 'object' ? ret : draft;
            next.v = this._conf.version;
            next.updatedAt = nowISO();
            this._rawWrite(next);
            return clone(next);
        },

        clear() {
            this._storage.removeItem(this._conf.key);
            console.error(`${PREFIX} cleared`);
        },

        readSummary() {
            const o = this._ensureRoot();
            const s = o.summary || DEF.summary;
            return { homeOK: !!s.homeOK, companyOK: !!s.companyOK };
        },

        saveDraft(scope, data) {
            if (!scope || typeof data !== 'object') {
                console.error(`${PREFIX} saveDraft invalid args`);
                return this.get();
            }
            return this.patch((d) => {
                if (!d[scope]) d[scope] = {};
                Object.assign(d[scope], clone(data));
            });
        }
    };

    global.AppStore = AppStore;
})(window);
