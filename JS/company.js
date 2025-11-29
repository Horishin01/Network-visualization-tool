/* =========================================================
 * company.js - Office Network Builder (rewritten 2025-11)
 *  1) ノード配置/ドラッグ/削除
 *  2) 光ファイバー・RJ45 配線
 *  3) AppStore 永続化（Home と同一構造）
 *  4) DNS 疎通チェック / デバッグ
 *  5) Chrome / Firefox 対応
 *  主修正:
 *   - routerPc 判定を「router→pc」を正とし、互換で「router→web」も許容
 *   - 判定→保存の順序を直列化（restore 時の揺れ防止）
 * ========================================================= */
(function (global) {
    'use strict';

    const CH = 'error';
    const log = (...a) => ((console[CH] || console.log).apply(console, ['[COMPANY]', ...a]));
    const warn = (...a) => console.warn('[COMPANY]', ...a);

    const STORAGE_KEY_EDGES  = 'company:lastEdges';
    const STORAGE_KEY_CANVAS = 'company:canvas:snapshot';

    // ノード定義
    const NODE_DEFS = {
    onu:    { label:'ONU',          description:'Optical terminal (ONU)', ports:[{id:'fiber',kind:'fiber',label:'FIBER'}, {id:'lan',kind:'rj45',label:'LAN'}] },
    router: { label:'Router',       description:'WAN / LAN gateway',      ports:[{id:'wan',  kind:'rj45',label:'WAN'}, {id:'lan',kind:'rj45',label:'LAN'}] },
    web:    { label:'Web Server',   description:'Internal publishing',    ports:[{id:'lan',kind:'rj45',label:'LAN'}] },
    ftp:    { label:'FTP Server',   description:'Upload destination',     ports:[{id:'lan',kind:'rj45',label:'LAN'}] },
    pc:     { label:'Client PC',    description:'User endpoint',          ports:[{id:'lan',kind:'rj45',label:'LAN'}] },
    dns:    { label:'DNS',          description:'Name resolution',        ports:[{id:'lan',kind:'rj45',label:'LAN'}] },
    db:     { label:'DB',           description:'Optional',               ports:[{id:'lan',kind:'rj45',label:'LAN'}] },
    mail:   { label:'Mail',         description:'Optional',               ports:[{id:'lan',kind:'rj45',label:'LAN'}] }
};

    const state = {
        nodes: {},                // id -> node
        connections: [],          // {id,kind,a:{nodeId,port},b:{nodeId,port},el}
        tool: null,
        connectFrom: null
    };
    let uid = 0, cid = 0;
    let restoring = false;

    // --- DOM 取得 ---
    const stage        = document.getElementById('companyStage');
    const svg          = document.getElementById('companyCables');
    const fiberAnchor  = document.getElementById('fiberAnchor');
    const palette      = document.getElementById('companyPalette');
    const toolButtons  = document.querySelectorAll('.tool-btn');
    const statusBadge  = document.getElementById('companyStatusBadge');
    const dnsForm      = document.getElementById('dnsCheckForm');
    const dnsInput     = document.getElementById('dnsHost');
    const dnsResult    = document.getElementById('dnsResult');
    const debugDump    = document.getElementById('debugDump');
    const btnDump      = document.getElementById('btnDumpState');
    const btnClear     = document.getElementById('btnClearAll');

    // --- 初期化 ---
    initPalette();
    initTools();
    setTool('rj45');
    wireUpDnsForm();
    wireUpDebug();
    restoreCanvasFromStore();       // canvas → 再構築
    syncConnectivity('boot', { force:true, destructive:true }); // 判定を強制実行

    // ========== UI ==========
    function initPalette(){
        if (!palette) return;
        palette.addEventListener('click', e => {
            const btn = e.target.closest('button[data-node-type]');
            if (!btn) return;
            e.preventDefault();
            spawnNode(btn.dataset.nodeType);
        });
    }
    function initTools(){
        toolButtons.forEach(btn => {
            btn.addEventListener('click', () => setTool(btn.dataset.tool));
        });
        if (fiberAnchor) {
            fiberAnchor.addEventListener('click', () => {
                if (state.tool !== 'fiber') setTool('fiber');
                selectPort({ nodeId:'fiber', portId:'fiber', kind:'fiber' });
            });
        }
        if (btnClear) btnClear.addEventListener('click', clearAll);
    }
    function setTool(tool){
        state.tool = tool;
        state.connectFrom = null;
        toolButtons.forEach(btn => btn.classList.toggle('active', btn.dataset.tool === tool));
    }

    // ========== ノード ==========
    function spawnNode(type, preset = {}){
        const def = NODE_DEFS[type];
        if (!def){ warn('unknown node type', type); return null; }
        const id = preset.id || `node-${++uid}`;
        const node = {
            id, type,
            el: document.createElement('div'),
            ports: {}, flags: preset.flags || {}
        };
        node.el.className = `node node-${type}`;
        node.el.dataset.id = id;
        node.el.style.left = `${preset.x ?? (120 + Math.random()*260)}px`;
        node.el.style.top  = `${preset.y ?? ( 60 + Math.random()*260)}px`;
        node.el.innerHTML = `
          <div class="node-header"><span>${def.label}</span>
            <button class="node-delete" title="削除">&times;</button>
          </div>
          <div class="node-body">${def.description}</div>
          <div class="node-ports"></div>`;
        const box = node.el.querySelector('.node-ports');
        def.ports.forEach(p => {
            const b = document.createElement('button');
            b.type='button'; b.className=`port port-${p.kind}`; b.textContent=p.label||p.id.toUpperCase();
            b.addEventListener('click', (e)=>{ e.stopPropagation(); handlePortClick(node.id, p.id, p.kind); });
            box.appendChild(b); node.ports[p.id]=b;
        });
        node.el.querySelector('.node-delete').addEventListener('click', (e)=>{ e.stopPropagation(); removeNode(id); });
        node.el.addEventListener('pointerdown', e => startDrag(node, e));
        stage.appendChild(node.el);
        state.nodes[id]=node;

        if (!restoring && type==='onu'){
            // 起点 fiber→ONU を自動生成
            createConnection({nodeId:'fiber',portId:'fiber',kind:'fiber'}, {nodeId:id,portId:'fiber',kind:'fiber'}, 'fiber');
        }
        return node;
    }

    function startDrag(node, ev){
        if (ev.target.closest('.port') || ev.target.closest('.node-delete')) return;
        ev.preventDefault();
        const rect = stage.getBoundingClientRect();
        const startX = ev.clientX, startY = ev.clientY;
        const origX = parseFloat(node.el.style.left || 0);
        const origY = parseFloat(node.el.style.top  || 0);
        node.el.setPointerCapture(ev.pointerId);
        node.el.classList.add('dragging');
        const move = e => {
            let nx = origX + (e.clientX - startX);
            let ny = origY + (e.clientY - startY);
            nx = Math.max(60, Math.min(rect.width  - 160, nx));
            ny = Math.max(20, Math.min(rect.height - 120, ny));
            node.el.style.left = `${nx}px`; node.el.style.top = `${ny}px`;
            updateLinesFor(node.id);
        };
        const up = e => {
            node.el.classList.remove('dragging');
            node.el.releasePointerCapture(ev.pointerId);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            persistCanvas('drag');
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up, { once:true });
    }

    function removeNode(id){
        const n = state.nodes[id]; if (!n) return;
        state.connections.slice().forEach(c=>{
            if (c.a.nodeId===id || c.b.nodeId===id){ c.el.remove(); state.connections = state.connections.filter(x=>x.id!==c.id); }
        });
        n.el.remove(); delete state.nodes[id];
        state.connectFrom = null;
        syncConnectivity('remove-node', { force:true });
        persistCanvas('remove-node');
    }

    function clearAll(){
        const was = restoring;
        Object.values(state.nodes).forEach(n=>n.el.remove());
        state.nodes = {};
        state.connections.forEach(c=>c.el.remove());
        state.connections = [];
        state.connectFrom = null;
        if (!was){
            syncConnectivity('clear', { force:true, destructive:true });
            persistCanvas('clear');
        }
    }

    // ========== 配線 ==========
    function handlePortClick(nodeId, portId, kind){
        if (!state.tool) setTool(kind);
        if (state.tool !== kind){ warn('ツール不一致', state.tool, kind); return; }
        const cur = state.connectFrom;
        if (!cur){ selectPort({nodeId,portId,kind}); return; }
        if (cur.nodeId===nodeId && cur.portId===portId){ highlightPort(cur,false); state.connectFrom=null; return; }
        if (cur.kind !== kind){ warn('ポート種別不一致'); return; }
        createConnection(cur, {nodeId,portId,kind}, kind);
        highlightPort(cur,false); state.connectFrom = null;
    }
    function selectPort(t){ state.connectFrom=t; highlightPort(t,true); }
    function highlightPort(ref,on){
        if (ref.nodeId==='fiber'){ if (fiberAnchor) fiberAnchor.classList.toggle('selected',on); return; }
        const n = state.nodes[ref.nodeId]; if (!n) return;
        const b = n.ports[ref.portId]; if (b) b.classList.toggle('selected',on);
    }

    function createConnection(a,b,kind){
        if (!validateConnection(a,b,kind)) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.classList.add('cable', kind==='fiber'?'fiber':'rj45');
        svg.appendChild(line);
        const conn = { id:`conn-${++cid}`, kind, a, b, el:line };
        state.connections.push(conn);
        updateLine(conn);
        syncConnectivity(`connect-${kind}`, { force:true }); // 作成直後に判定
        persistCanvas('connect');
    }

    function validateConnection(a,b,kind){
        if (kind==='fiber'){
            const target = state.nodes[b.nodeId] || state.nodes[a.nodeId];
            if (!target || target.type!=='onu'){ warn('光はONUのみ'); return false; }
        }
        if (kind==='rj45' && a.nodeId===b.nodeId){ warn('自己接続は不可'); return false; }
        const dup = state.connections.some(c =>
            c.kind===kind && (
              (c.a.nodeId===a.nodeId && c.a.portId===a.portId && c.b.nodeId===b.nodeId && c.b.portId===b.portId) ||
              (c.a.nodeId===b.nodeId && c.a.portId===b.portId && c.b.nodeId===a.nodeId && c.b.portId===a.portId)
            )
        );
        if (dup){ warn('同一接続が存在'); return false; }
        return true;
    }

    function updateLinesFor(nodeId){ state.connections.forEach(c=>{ if (c.a.nodeId===nodeId || c.b.nodeId===nodeId) updateLine(c); }); }
    function updateLine(c){
        const pa = portPosition(c.a), pb = portPosition(c.b); if (!pa||!pb) return;
        c.el.setAttribute('x1',pa.x); c.el.setAttribute('y1',pa.y);
        c.el.setAttribute('x2',pb.x); c.el.setAttribute('y2',pb.y);
    }
    function portPosition(ref){
        const sr = stage.getBoundingClientRect();
        if (ref.nodeId==='fiber'){
            const r = fiberAnchor.getBoundingClientRect();
            return { x: r.left - sr.left + r.width/2, y: r.top - sr.top + r.height/2 };
        }
        const n = state.nodes[ref.nodeId]; if (!n) return null;
        const b = n.ports[ref.portId]; if (!b) return null;
        const r = b.getBoundingClientRect();
        return { x: r.left - sr.left + r.width/2, y: r.top - sr.top + r.height/2 };
    }

    // ========== 永続化 ==========
    function snapshotCanvas(){
        const nodes = {};
        Object.values(state.nodes).forEach(n => {
            nodes[n.id] = { type:n.type, x:parseFloat(n.el.style.left||0), y:parseFloat(n.el.style.top||0) };
        });
        const connections = state.connections.map(c => ({ id:c.id, kind:c.kind, a:c.a, b:c.b }));
        return { nodes, connections };
    }
    function persistCanvas(reason){
        if (restoring) return;
        const snap = snapshotCanvas();
        try { localStorage.setItem(STORAGE_KEY_CANVAS, JSON.stringify(snap)); }
        catch(e){ console.warn('[COMPANY] localStorage persist failed', e); }
        if (global.AppStore && typeof AppStore.patch==='function'){
            AppStore.patch(d => { d.company = d.company || {}; d.company.canvas = snap; });
        }
        log('persist', reason, snap);
    }
    function restoreCanvasFromStore(){
        let stored = null;
        if (global.AppStore && typeof AppStore.get==='function'){
            stored = AppStore.get()?.company?.canvas || null;
        }
        if (!stored){
            try{ const raw = localStorage.getItem(STORAGE_KEY_CANVAS); if (raw) stored = JSON.parse(raw); }
            catch(e){ console.warn('[COMPANY] read fallback failed', e); }
        }
        if (!stored) return;
        restoring = true;
        // 既存クリア（判定はあとで force 実行）
        Object.values(state.nodes).forEach(n=>n.el.remove());
        state.nodes = {};
        state.connections.forEach(c=>c.el.remove());
        state.connections = [];
        state.connectFrom = null;

        Object.entries(stored.nodes || {}).forEach(([id,info])=>{
            spawnNode(info.type, { id, x:info.x, y:info.y });
            const n = parseInt(String(id).replace(/\D/g,''),10);
            if (!Number.isNaN(n)) uid = Math.max(uid,n);
        });
        (stored.connections || []).forEach(rec => createConnectionFromSnapshot(rec));
        restoring = false;
        syncConnectivity('restore', { force:true }); // 復元後に一度だけ判定
    }
    function createConnectionFromSnapshot(rec){
        const line = document.createElementNS('http://www.w3.org/2000/svg','line');
        line.classList.add('cable', rec.kind==='fiber'?'fiber':'rj45');
        svg.appendChild(line);
        const conn = { id: rec.id || `conn-${++cid}`, kind:rec.kind, a:rec.a, b:rec.b, el:line };
        state.connections.push(conn);
        updateLine(conn);
        const n = parseInt(String(conn.id).replace(/\D/g,''),10);
        if (!Number.isNaN(n)) cid = Math.max(cid,n);
    }

    // ========== 接続判定 ==========
    function computeEdges(){
        // fiber ↔ ONU
        const fiberOnu = state.connections.some(conn => {
            if (conn.kind!=='fiber') return false;
            const aType = conn.a.nodeId==='fiber' ? 'fiber' : state.nodes[conn.a.nodeId]?.type;
            const bType = conn.b.nodeId==='fiber' ? 'fiber' : state.nodes[conn.b.nodeId]?.type;
            return (aType==='fiber' && bType==='onu') || (aType==='onu' && bType==='fiber');
        });
        // RJ45 graph
        const graph = buildRj45Graph();
        const onuRouter = hasTypePath(graph, 'onu', 'router');
        // router->pc ?????? router->web ???
        const routerPc = hasTypePath(graph, 'router', 'pc') || hasTypePath(graph, 'router', 'web');
        // router->ftp ? FTP ???????
        const routerFtp = hasTypePath(graph, 'router', 'ftp');

        return { fiberOnu, onuRouter, routerPc, routerFtp };
    }
    function buildRj45Graph(){
        const g = new Map();
        const touch = id => { if (!g.has(id)) g.set(id,new Set()); return g.get(id); };
        state.connections.forEach(c=>{
            if (c.kind!=='rj45') return;
            if (!state.nodes[c.a.nodeId] || !state.nodes[c.b.nodeId]) return;
            touch(c.a.nodeId).add(c.b.nodeId);
            touch(c.b.nodeId).add(c.a.nodeId);
        });
        return g;
    }
    function hasTypePath(graph, typeA, typeB){
        const starts  = Object.values(state.nodes).filter(n=>n.type===typeA);
        const targets = new Set(Object.values(state.nodes).filter(n=>n.type===typeB).map(n=>n.id));
        if (!starts.length || !targets.size) return false;
        for (const s of starts){
            const vis = new Set([s.id]); const q=[s.id];
            while(q.length){
                const id = q.shift(); if (targets.has(id)) return true;
                const ns = graph.get(id); if (!ns) continue;
                ns.forEach(n=>{ if(!vis.has(n)){ vis.add(n); q.push(n); }});
            }
        }
        return false;
    }

    function syncConnectivity(reason='update', opts={}){
        const { force=false } = opts;
        const edges = computeEdges();
        const json  = JSON.stringify(edges);
        const prev  = localStorage.getItem(STORAGE_KEY_EDGES);
        if (!force && json===prev){ updateBadge(edges); return; }

        try{ localStorage.setItem(STORAGE_KEY_EDGES, json); }
        catch(e){ console.warn('[COMPANY] edge save failed', e); }

        const ok = edges.fiberOnu && edges.onuRouter && edges.routerPc;
        const ftpOK = ok && edges.routerFtp;
        const reach = { internet: ok, count: (edges.fiberOnu?1:0)+(edges.onuRouter?1:0)+(edges.routerPc?1:0) };

        if (global.CompanyEdges && typeof CompanyEdges.set==='function'){
            CompanyEdges.set(edges);
        } else if (global.AppStore && typeof AppStore.patch==='function'){
            AppStore.patch(d=>{
                d.company = d.company || {};
                d.company.edges = Object.assign({}, edges);
                d.company.reach = reach;
                d.company.status = Object.assign({}, d.company.status, {
                    fiberLink: edges.fiberOnu,
                    routerWanLink: edges.onuRouter,
                    webReachable: edges.routerPc,
                    ftpReachable: ftpOK,
                    lanClients: Object.values(state.nodes).filter(n => n.type && n.type !== 'onu' && n.type !== 'router').length
                });
                d.summary = d.summary || {}; d.summary.companyOK = ok;
            });
        }
        updateBadge(edges);
        emitDebugSnapshot(`sync:${reason}`, { edges, force });
    }
    function updateBadge(edges){
        if (!statusBadge) return;
        const ok = edges.fiberOnu && edges.onuRouter && edges.routerPc;
        statusBadge.textContent = ok ? 'T' : 'F';
        statusBadge.classList.toggle('on', ok);
    }

    // ========== DNS ==========
    function wireUpDnsForm(){
        if (!dnsForm) return;
        dnsForm.addEventListener('submit', e=>{
            e.preventDefault();
            const domain = dnsInput.value.trim();
            if (!domain){ dnsResult.textContent='ドメイン名を入力してください。'; return; }
            dnsResult.textContent = '通信中...';
            testDomainReachability(domain).then(ms=>{
                dnsResult.textContent = `${domain} へ ${ms}ms で到達しました。`;
            }).catch(err=>{
                dnsResult.textContent = `到達できません: ${err.message || err}`;
            });
        });
    }
    function testDomainReachability(domain){
        const url = `https://${domain.replace(/^https?:\/\//i,'')}/?network-check=${Date.now()}`;
        if (!window.fetch){
            return new Promise((resolve,reject)=>{
                const img = new Image();
                const timer = setTimeout(()=>reject(new Error('timeout')),6000);
                img.onload = ()=>{ clearTimeout(timer); resolve(0); };
                img.onerror = ()=>{ clearTimeout(timer); reject(new Error('blocked')); };
                img.src = url;
            });
        }
        return new Promise((resolve,reject)=>{
            const started = performance.now();
            const ctrl = window.AbortController ? new AbortController() : null;
            const timer = setTimeout(()=>{ ctrl?.abort(); reject(new Error('timeout')); },6000);
            fetch(url, { mode:'no-cors', cache:'no-store', signal:ctrl?.signal })
                .then(()=>{ clearTimeout(timer); resolve(Math.round(performance.now()-started)); })
                .catch(err=>{ clearTimeout(timer); reject(err); });
        });
    }

    // ========== デバッグ ==========
    function wireUpDebug(){ if (btnDump) btnDump.addEventListener('click', ()=>emitDebugSnapshot('manual')); }
    function emitDebugSnapshot(source='auto', extra={}){
        const payload = {
            source, timestamp:new Date().toISOString(),
            edges: computeEdges(),
            snapshot: snapshotCanvas(),
            connections: state.connections,
            extra
        };
        if (global.AppStore && typeof AppStore.get==='function') payload.store = AppStore.get();
        if (debugDump) debugDump.textContent = JSON.stringify(payload, null, 2);
        log('debug snapshot', payload);
        return payload;
    }

    global.CompanyDebug = { dump:emitDebugSnapshot, snapshot:snapshotCanvas, edges:computeEdges };
})(window);
