/* =========================================================
 * company_store_bridge.js
 * Company の edges/reach/canvas を AppStore に保存し、更新を通知
 * 変更点:
 *  - 旧 routerWan/webServer → routerPc の自動移行
 *  - summary.companyOK を一貫更新
 *  - BroadcastChannel('network-app') と window.dispatchEvent で更新通知
 * ========================================================= */
(function (global) {
    'use strict';

    const PREFIX = '[COMPANY-BRIDGE]';
    const log  = (...a) => ((console.error || console.log).apply(console, [PREFIX, ...a]));
    const warn = (...a) => console.warn(PREFIX, ...a);

    const DEF_STATE = Object.freeze({
        v: 1,
        updatedAt: new Date(0).toISOString(),
        home:    { edges:{ fiberOnu:false, onuRouter:false, routerPc:false }, reach:{ internet:false, count:0 } },
        company: { edges:{ fiberOnu:false, onuRouter:false, routerPc:false }, reach:{ internet:false, count:0 }, canvas:null },
        summary: { homeOK:false, companyOK:false }
    });

    const BC_NAME = 'network-app';
    function broadcastUpdated(){
        try { const ch = new BroadcastChannel(BC_NAME); ch.postMessage({ type:'store-updated', at: Date.now() }); ch.close(); } catch {}
        try { window.dispatchEvent(new CustomEvent('appstore:updated', { detail:{ at: Date.now() } })); } catch {}
    }
    function clone(x){ return JSON.parse(JSON.stringify(x)); }

    function ensureRoot(){
        if (!global.AppStore){ warn('AppStore missing'); return null; }
        let cur = AppStore.get();
        if (!cur){ AppStore.set(DEF_STATE); cur = AppStore.get(); }
        if (!cur.company){ AppStore.patch(d => { d.company = clone(DEF_STATE.company); }); cur = AppStore.get(); }
        if (!cur.company.edges){
            AppStore.patch(d => { d.company = d.company || {}; d.company.edges = clone(DEF_STATE.company.edges); });
            cur = AppStore.get();
        } else {
            const e = cur.company.edges;
            if (typeof e.routerPc === 'undefined'){
                AppStore.patch(d => {
                    const src = d.company.edges || {};
                    const migrated = !!(src.routerWan && src.webServer);
                    d.company.edges = Object.assign({}, src, { routerPc: migrated });
                });
                cur = AppStore.get();
            }
        }
        if (!cur.company.reach){
            AppStore.patch(d => { d.company = d.company || {}; d.company.reach = clone(DEF_STATE.company.reach); });
            cur = AppStore.get();
        }
        if (!cur.summary){ AppStore.patch(d => { d.summary = clone(DEF_STATE.summary); }); cur = AppStore.get(); }
        return cur;
    }

    function hardSetEdges(edges){
        ensureRoot();
        if (!global.AppStore || typeof AppStore.patch !== 'function'){ warn('AppStore.patch unavailable'); return; }
        const next = {
            fiberOnu:  !!edges.fiberOnu,
            onuRouter: !!edges.onuRouter,
            routerPc:  !!edges.routerPc
        };
        const reach = {
            internet: next.fiberOnu && next.onuRouter && next.routerPc,
            count: (next.fiberOnu?1:0) + (next.onuRouter?1:0) + (next.routerPc?1:0)
        };
        AppStore.patch(d => {
            d.company = d.company || {};
            d.company.edges = next;
            d.company.reach = reach;
            d.summary = d.summary || {};
            d.summary.companyOK = reach.internet;
        });
        broadcastUpdated();
        log('set edges', next, reach);
    }

    const CompanyEdges = {
        set(payload){
            hardSetEdges(payload || {});
            try{
                const snap = AppStore.get();
                log('snapshot', { edges: snap?.company?.edges, reach: snap?.company?.reach, ok: snap?.summary?.companyOK });
            } catch(e){ warn('snapshot failed', e); }
        },
        mark(edge, value){
            const snap = ensureRoot(); if (!snap) return;
            const cur = Object.assign({}, snap.company?.edges || {});
            if (!['fiberOnu','onuRouter','routerPc'].includes(edge)){ warn('unknown edge', edge); return; }
            cur[edge] = !!value;
            hardSetEdges(cur);
        },
        read(){ return (global.AppStore && AppStore.get()) || null; },
        reset(){ hardSetEdges({ fiberOnu:false, onuRouter:false, routerPc:false }); }
    };

    if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', ensureRoot, { once:true });
    } else {
        ensureRoot();
    }

    global.CompanyEdges = CompanyEdges;
})(window);
