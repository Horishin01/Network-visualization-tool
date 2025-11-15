/* =========================================================
 * company_store_bridge.js
 * Home の bridge と同様の仕様で company.edges / reach を AppStore に保存
 * ========================================================= */
(function (global) {
    'use strict';

    const PREFIX = '[COMPANY-BRIDGE]';
    const log = (...args) => ((console.error || console.log).apply(console, [PREFIX, ...args]));
    const warn = (...args) => console.warn(PREFIX, ...args);

    const DEF_STATE = Object.freeze({
        v: 1,
        updatedAt: new Date(0).toISOString(),
        home: { edges: { fiberOnu: false, onuRouter: false, routerPc: false }, reach: { internet: false, count: 0 } },
        company: {
            edges: { fiberOnu: false, onuRouter: false, routerPc: false },
            reach: { internet: false, count: 0 },
            canvas: null
        },
        summary: { homeOK: false, companyOK: false }
    });

    function ensureRoot() {
        if (!global.AppStore) { warn('AppStore missing'); return null; }
        const cur = AppStore.get();
        if (!cur) {
            AppStore.set(DEF_STATE);
            return AppStore.get();
        }
        if (!cur.company) {
            cur.company = JSON.parse(JSON.stringify(DEF_STATE.company));
            AppStore.set(cur);
            return cur;
        }
        if (!cur.company.edges) {
            AppStore.patch((draft) => {
                draft.company = draft.company || {};
                draft.company.edges = JSON.parse(JSON.stringify(DEF_STATE.company.edges));
            });
        } else {
            const edges = cur.company.edges;
            if (typeof edges.routerPc === 'undefined') {
                AppStore.patch((draft) => {
                    draft.company.edges = Object.assign({}, draft.company.edges, {
                        routerPc: !!(draft.company.edges?.routerWan && draft.company.edges?.webServer)
                    });
                });
            }
        }
        if (!cur.company.reach) {
            AppStore.patch((draft) => {
                draft.company = draft.company || {};
                draft.company.reach = JSON.parse(JSON.stringify(DEF_STATE.company.reach));
            });
        }
        if (!cur.summary) {
            AppStore.patch((draft) => {
                draft.summary = JSON.parse(JSON.stringify(DEF_STATE.summary));
            });
        }
        return AppStore.get();
    }

    function hardSetEdges(edges) {
        ensureRoot();
        if (!global.AppStore || typeof AppStore.patch !== 'function') {
            warn('AppStore.patch unavailable');
            return;
        }
        const next = {
            fiberOnu: !!edges.fiberOnu,
            onuRouter: !!edges.onuRouter,
            routerPc: !!edges.routerPc
        };
        const reach = {
            internet: next.fiberOnu && next.onuRouter && next.routerPc,
            count: (next.fiberOnu ? 1 : 0) + (next.onuRouter ? 1 : 0) + (next.routerPc ? 1 : 0)
        };
        AppStore.patch((draft) => {
            draft.company = draft.company || {};
            draft.company.edges = next;
            draft.company.reach = draft.company.reach || {};
            draft.company.reach.internet = reach.internet;
            draft.company.reach.count = reach.count;
            draft.summary = draft.summary || {};
            draft.summary.companyOK = reach.internet;
        });
        log('set edges', next, reach);
    }

    const CompanyEdges = {
        set(payload) {
            hardSetEdges(payload || {});
            try {
                const snap = AppStore.get();
                log('snapshot', { edges: snap?.company?.edges, reach: snap?.company?.reach, ok: snap?.summary?.companyOK });
            } catch (e) { warn('snapshot failed', e); }
        },
        mark(edge, value) {
            const snap = ensureRoot();
            if (!snap) return;
            const cur = Object.assign({}, snap.company?.edges || {});
            if (!['fiberOnu', 'onuRouter', 'routerPc'].includes(edge)) {
                warn('unknown edge', edge);
                return;
            }
            cur[edge] = !!value;
            hardSetEdges(cur);
        },
        read() { return (global.AppStore && AppStore.get()) || null; },
        reset() {
            hardSetEdges({ fiberOnu: false, onuRouter: false, routerPc: false });
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', ensureRoot, { once: true });
    } else {
        ensureRoot();
    }

    global.CompanyEdges = CompanyEdges;
})(window);
