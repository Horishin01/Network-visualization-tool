/* =========================================================
 * home_store_bridge.js
 * Home配線イベント → AppStore 永続化ブリッジ（ログは error）
 * ========================================================= */
(function (global) {
    'use strict';

    const CH = 'error';
    const out = (...a) => ((console[CH] || console.log).apply(console, ['[HOME-BRIDGE]', ...a]));
    const warn = (...a) => console.warn('[HOME-BRIDGE]', ...a);

    function ensureRoot() {
        if (!global.AppStore) { warn('AppStore 未定義'); return null; }
        const cur = AppStore.get();
        if (cur) { out('ensureRoot: 既存ストア', { edges: cur.home?.edges, reach: cur.home?.reach }); return cur; }
        const seed = {
            v: 1,
            updatedAt: new Date().toISOString(),
            home: { edges: { fiberOnu: false, onuRouter: false, routerPc: false }, reach: { internet: false, count: 0 } },
            company: {},
            summary: { homeOK: false, companyOK: false }
        };
        AppStore.set(seed);
        out('ensureRoot: 初期化 set()', seed);
        return seed;
    }

    function hardSetEdges(edges) {
        const s = ensureRoot(); if (!s) return;
        const before = JSON.parse(JSON.stringify(s.home?.edges || {}));
        s.home = s.home || {};
        s.home.edges = {
            fiberOnu: !!edges.fiberOnu,
            onuRouter: !!edges.onuRouter,
            routerPc: !!edges.routerPc
        };
        const e = s.home.edges;
        s.home.reach = {
            internet: !!(e.fiberOnu && e.onuRouter && e.routerPc),
            count: (e.fiberOnu ? 1 : 0) + (e.onuRouter ? 1 : 0) + (e.routerPc ? 1 : 0)
        };
        s.summary = s.summary || {};
        s.summary.homeOK = !!(e.fiberOnu && e.onuRouter && e.routerPc);
        s.updatedAt = new Date().toISOString();
        AppStore.set(s);
        out('hardSetEdges: before→after', before, '→', s.home.edges, 'reach=', s.home.reach, 'homeOK=', s.summary.homeOK);
    }

    function normalize(k) {
        const m = {
            'fiber': 'fiberOnu', 'wanOnu': 'fiberOnu',
            'onu-router': 'onuRouter', 'router-wan': 'onuRouter',
            'router-pc': 'routerPc'
        };
        return m[k] || k;
    }

    const HomeEdges = {
        set(payload) {
            out('HomeEdges.set()', payload);
            hardSetEdges(payload || {});
            const snap = AppStore.get();
            out('Store snapshot', { edges: snap?.home?.edges, reach: snap?.home?.reach, homeOK: snap?.summary?.homeOK });
        },
        mark(edge, value) {
            const k = normalize(edge);
            if (!['fiberOnu', 'onuRouter', 'routerPc'].includes(k)) { warn('未知edge:', edge); return; }
            const s = ensureRoot(); if (!s) return;
            const cur = { ...(s.home?.edges || {}) };
            cur[k] = !!value;
            out('HomeEdges.mark()', k, '=>', !!value);
            hardSetEdges(cur);
            const snap = AppStore.get();
            out('Store snapshot', { edges: snap?.home?.edges, reach: snap?.home?.reach, homeOK: snap?.summary?.homeOK });
        },
        read() { return (global.AppStore && AppStore.get()) || null; },
        reset() {
            if (!global.AppStore) return;
            const blank = {
                v: 1, updatedAt: new Date().toISOString(),
                home: { edges: { fiberOnu: false, onuRouter: false, routerPc: false }, reach: { internet: false, count: 0 } },
                company: {},
                summary: { homeOK: false, companyOK: false }
            };
            AppStore.set(blank);
            out('reset → set(blank)');
        }
    };

    document.addEventListener('home:edge', (e) => {
        const { edge, value } = e.detail || {};
        out('event home:edge', { edge, value });
        HomeEdges.mark(edge, value);
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureRoot, { once: true });
    } else {
        ensureRoot();
    }

    global.HomeEdges = HomeEdges;
})(window);
