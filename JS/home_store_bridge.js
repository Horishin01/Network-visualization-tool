/* =========================================================
 * home_store_bridge.js
 * Home(自宅)キャンバスの配線状態 → AppStore へ同期
 * - HomeEdges.set({ fiberOnu, onuRouter, routerPc })
 * - 起動時に空なら最小スナップショットを初期化
 * ========================================================= */
(function (global) {
    'use strict';

    // 空/未初期化を強制初期化
    function forceInit() {
        if (!global.AppStore) return;
        if (!AppStore.get()) {
            AppStore.set({
                home: { edges: {}, reach: { internet: false, count: 0 } },
                company: { edges: {}, reach: {} },
                summary: { homeOK: false, companyOK: false }
            });
        }
    }
    forceInit();

    function normalize(edge) {
        const map = {
            'fiber': 'fiberOnu', 'wanOnu': 'fiberOnu',
            'onu-router': 'onuRouter', 'router-wan': 'onuRouter',
            'router-pc': 'routerPc'
        };
        return map[edge] || edge;
    }

    const HomeEdges = {
        mark(edge, value) {
            if (!global.AppStore) return;
            forceInit();
            const k = normalize(edge);
            if (!['fiberOnu', 'onuRouter', 'routerPc'].includes(k)) return;
            AppStore.updateHomeEdges({ [k]: !!value });
        },
        set(payload) {
            if (!global.AppStore) return;
            forceInit();
            const out = {};
            if ('fiberOnu' in payload) out.fiberOnu = !!payload.fiberOnu;
            if ('onuRouter' in payload) out.onuRouter = !!payload.onuRouter;
            if ('routerPc' in payload) out.routerPc = !!payload.routerPc;
            AppStore.updateHomeEdges(out);
        },
        read() { return AppStore.get() || null; },
        reset() {
            if (!global.AppStore) return;
            AppStore.set({
                home: { edges: {}, reach: { internet: false, count: 0 } },
                company: { edges: {}, reach: {} },
                summary: { homeOK: false, companyOK: false }
            });
        }
    };

    document.addEventListener('home:edge', (e) => {
        const { edge, value } = e.detail || {};
        HomeEdges.mark(edge, value);
    });

    global.HomeEdges = HomeEdges;
})(window);
