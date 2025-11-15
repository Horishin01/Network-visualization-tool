/* =========================================================
 * company.js - Office Network Builder (rewritten 2025)
 * ---------------------------------------------------------
 *  1. ノードの配置/ドラッグ/削除
 *  2. 光ファイバー・RJ45 ケーブルでの配線
 *  3. AppStore + localStorage への永続化 (Home と同一構造)
 *  4. DNS 疎通チェックとデバッグダンプ
 *  5. Chrome / Firefox 両対応
 * ========================================================= */
(function (global) {
    'use strict';

    const CH = 'error';
    const log = (...args) => ((console[CH] || console.log).apply(console, ['[COMPANY]', ...args]));
    const warn = (...args) => console.warn('[COMPANY]', ...args);

    const STORAGE_KEY_EDGES = 'company:lastEdges';
    const STORAGE_KEY_CANVAS = 'company:canvas:snapshot';

    // ノードの定義 (表示名・ポート構成)
    const NODE_DEFS = {
        onu: {
            label: 'ONU',
            description: '光回線終端装置。光ポートと LAN ポートを持ちます。',
            ports: [
                { id: 'fiber', kind: 'fiber', label: '光' },
                { id: 'lan', kind: 'rj45', label: 'LAN' }
            ]
        },
        router: {
            label: '社内ルーター',
            description: 'WAN / LAN ポートを持ちます。',
            ports: [
                { id: 'wan', kind: 'rj45', label: 'WAN' },
                { id: 'lan', kind: 'rj45', label: 'LAN' }
            ]
        },
        web: {
            label: 'Web サーバー',
            description: '社内公開用のサーバー。LAN ポートを持ちます。',
            ports: [{ id: 'lan', kind: 'rj45', label: 'LAN' }]
        },
        pc: {
            label: '社員PC',
            description: '社内端末 (チェック用途)。',
            ports: [{ id: 'lan', kind: 'rj45', label: 'LAN' }]
        },
        dns: {
            label: 'DNS サーバー',
            description: 'DNS 応答確認用。',
            ports: [{ id: 'lan', kind: 'rj45', label: 'LAN' }]
        },
        db: {
            label: 'DB サーバー',
            description: '社内データベース (任意)。',
            ports: [{ id: 'lan', kind: 'rj45', label: 'LAN' }]
        },
        mail: {
            label: 'Mail サーバー',
            description: 'メール配送サーバー (任意)。',
            ports: [{ id: 'lan', kind: 'rj45', label: 'LAN' }]
        }
    };

    const state = {
        nodes: {},           // id -> node info
        connections: [],     // [{ id, kind, a:{nodeId,port}, b:{nodeId,port}, el }]
        tool: null,
        connectFrom: null
    };
    let uid = 0;
    let cid = 0;
    let restoring = false;

    // --- DOM ---------------------------------------------------------------
    const stage = document.getElementById('companyStage');
    const svg = document.getElementById('companyCables');
    const fiberAnchor = document.getElementById('fiberAnchor');
    const palette = document.getElementById('companyPalette');
    const toolButtons = document.querySelectorAll('.tool-btn');
    const statusBadge = document.getElementById('companyStatusBadge');
    const dnsForm = document.getElementById('dnsCheckForm');
    const dnsInput = document.getElementById('dnsHost');
    const dnsResult = document.getElementById('dnsResult');
    const debugDump = document.getElementById('debugDump');
    const btnDump = document.getElementById('btnDumpState');
    const btnClear = document.getElementById('btnClearAll');

    // --- 初期化 -----------------------------------------------------------
    initPalette();
    initTools();
    setTool('rj45');
    wireUpDnsForm();
    wireUpDebug();
    restoreCanvasFromStore();
    syncConnectivity('boot', { force: true, destructive: true });

    // --- UI 構築 ----------------------------------------------------------
    function initPalette() {
        if (!palette) return;
        palette.addEventListener('click', (e) => {
            const btn = e.target.closest('button[data-node-type]');
            if (!btn) return;
            e.preventDefault();
            spawnNode(btn.dataset.nodeType);
        });
    }

    function initTools() {
        toolButtons.forEach((btn) => {
            btn.addEventListener('click', () => {
                const tool = btn.dataset.tool;
                setTool(tool);
            });
        });
        if (fiberAnchor) {
            fiberAnchor.addEventListener('click', () => {
                if (state.tool !== 'fiber') setTool('fiber');
                selectPort({ nodeId: 'fiber', portId: 'fiber', kind: 'fiber' });
            });
        }
        if (btnClear) {
            btnClear.addEventListener('click', clearAll);
        }
    }

    function setTool(tool) {
        state.tool = tool;
        state.connectFrom = null;
        toolButtons.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
    }

    // --- ノード管理 -------------------------------------------------------
    function spawnNode(type, preset = {}) {
        const def = NODE_DEFS[type];
        if (!def) { warn('unknown node type', type); return null; }

        const id = preset.id || `node-${++uid}`;
        const node = {
            id,
            type,
            el: document.createElement('div'),
            ports: {},
            flags: preset.flags || {}
        };
        node.el.className = `node node-${type}`;
        node.el.dataset.id = id;
        node.el.style.left = `${preset.x ?? (120 + Math.random() * 260)}px`;
        node.el.style.top = `${preset.y ?? (60 + Math.random() * 260)}px`;
        node.el.innerHTML = `
            <div class="node-header">
                <span>${def.label}</span>
                <button class="node-delete" title="削除">&times;</button>
            </div>
            <div class="node-body">${def.description}</div>
            <div class="node-ports"></div>
        `;
        const portsBox = node.el.querySelector('.node-ports');
        def.ports.forEach((port) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `port port-${port.kind}`;
            btn.textContent = port.label || port.id.toUpperCase();
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                handlePortClick(node.id, port.id, port.kind);
            });
            portsBox.appendChild(btn);
            node.ports[port.id] = btn;
        });
        node.el.querySelector('.node-delete').addEventListener('click', (e) => {
            e.stopPropagation();
            removeNode(id);
        });
        node.el.addEventListener('pointerdown', (e) => startDrag(node, e));
        stage.appendChild(node.el);
        state.nodes[id] = node;

        if (!restoring && type === 'onu') {
            createConnection(
                { nodeId: 'fiber', portId: 'fiber', kind: 'fiber' },
                { nodeId: id, portId: 'fiber', kind: 'fiber' },
                'fiber'
            );
        }
        return node;
    }

    function startDrag(node, ev) {
        if (ev.target.closest('.port') || ev.target.closest('.node-delete')) return;
        ev.preventDefault();
        const rect = stage.getBoundingClientRect();
        const startX = ev.clientX;
        const startY = ev.clientY;
        const origX = parseFloat(node.el.style.left || 0);
        const origY = parseFloat(node.el.style.top || 0);
        node.el.setPointerCapture(ev.pointerId);
        node.el.classList.add('dragging');

        const move = (e) => {
            let nextX = origX + (e.clientX - startX);
            let nextY = origY + (e.clientY - startY);
            nextX = Math.max(60, Math.min(rect.width - 160, nextX));
            nextY = Math.max(20, Math.min(rect.height - 120, nextY));
            node.el.style.left = `${nextX}px`;
            node.el.style.top = `${nextY}px`;
            updateLinesFor(node.id);
        };
        const up = (e) => {
            node.el.classList.remove('dragging');
            node.el.releasePointerCapture(ev.pointerId);
            document.removeEventListener('pointermove', move);
            document.removeEventListener('pointerup', up);
            persistCanvas('drag');
        };
        document.addEventListener('pointermove', move);
        document.addEventListener('pointerup', up, { once: true });
    }

    function removeNode(id) {
        const node = state.nodes[id];
        if (!node) return;
        state.connections.slice().forEach((conn) => {
            if (conn.a.nodeId === id || conn.b.nodeId === id) {
                conn.el.remove();
                state.connections = state.connections.filter((c) => c.id !== conn.id);
            }
        });
        node.el.remove();
        delete state.nodes[id];
        state.connectFrom = null;
        syncConnectivity('remove-node', { force: true });
        persistCanvas('remove-node');
    }

    function clearAll() {
        const wasRestoring = restoring;
        Object.values(state.nodes).forEach((node) => node.el.remove());
        state.nodes = {};
        state.connections.forEach((conn) => conn.el.remove());
        state.connections = [];
        state.connectFrom = null;
        if (!wasRestoring) {
            syncConnectivity('clear', { force: true, destructive: true });
            persistCanvas('clear');
        }
    }

    // --- 配線 -------------------------------------------------------------
    function handlePortClick(nodeId, portId, kind) {
        if (!state.tool) {
            setTool(kind);
        }
        if (state.tool !== kind) {
            warn('ツールが一致していません', state.tool, kind);
            return;
        }
        const current = state.connectFrom;
        if (!current) {
            selectPort({ nodeId, portId, kind });
            return;
        }
        if (current.nodeId === nodeId && current.portId === portId) {
            highlightPort(current, false);
            state.connectFrom = null;
            return;
        }
        if (current.kind !== kind) {
            warn('ポート種別が一致しません');
            return;
        }
        createConnection(current, { nodeId, portId, kind });
        highlightPort(current, false);
        state.connectFrom = null;
    }

    function selectPort(target) {
        state.connectFrom = target;
        highlightPort(target, true);
    }

    function highlightPort(portRef, on) {
        if (portRef.nodeId === 'fiber') {
            fiberAnchor.classList.toggle('selected', on);
            return;
        }
        const node = state.nodes[portRef.nodeId];
        if (!node) return;
        const portBtn = node.ports[portRef.portId];
        if (portBtn) portBtn.classList.toggle('selected', on);
    }

    function createConnection(a, b, kind) {
        if (!validateConnection(a, b, kind)) return;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cable', kind === 'fiber' ? 'fiber' : 'rj45');
        svg.appendChild(line);
        const conn = { id: `conn-${++cid}`, kind, a, b, el: line };
        state.connections.push(conn);
        updateLine(conn);
        syncConnectivity(`connect-${kind}`);
        persistCanvas('connect');
    }

    function validateConnection(a, b, kind) {
        if (kind === 'fiber') {
            const targetNode = state.nodes[b.nodeId] || state.nodes[a.nodeId];
            if (!targetNode || targetNode.type !== 'onu') {
                warn('光ファイバーは ONU のみに接続できます');
                return false;
            }
        }
        if (kind === 'rj45') {
            if (a.nodeId === b.nodeId) {
                warn('同一ノードは接続できません');
                return false;
            }
        }
        const dup = state.connections.some((conn) => {
            return (
                conn.kind === kind &&
                ((conn.a.nodeId === a.nodeId && conn.a.portId === a.portId &&
                    conn.b.nodeId === b.nodeId && conn.b.portId === b.portId) ||
                    (conn.a.nodeId === b.nodeId && conn.a.portId === b.portId &&
                        conn.b.nodeId === a.nodeId && conn.b.portId === a.portId))
            );
        });
        if (dup) {
            warn('すでに同じ接続が存在します');
            return false;
        }
        return true;
    }

    function updateLinesFor(nodeId) {
        state.connections.forEach((conn) => {
            if (conn.a.nodeId === nodeId || conn.b.nodeId === nodeId) updateLine(conn);
        });
    }

    function updateLine(conn) {
        const posA = portPosition(conn.a);
        const posB = portPosition(conn.b);
        if (!posA || !posB) return;
        conn.el.setAttribute('x1', posA.x);
        conn.el.setAttribute('y1', posA.y);
        conn.el.setAttribute('x2', posB.x);
        conn.el.setAttribute('y2', posB.y);
    }

    function portPosition(portRef) {
        if (portRef.nodeId === 'fiber') {
            const rect = fiberAnchor.getBoundingClientRect();
            const stageRect = stage.getBoundingClientRect();
            return {
                x: rect.left - stageRect.left + rect.width / 2,
                y: rect.top - stageRect.top + rect.height / 2
            };
        }
        const node = state.nodes[portRef.nodeId];
        if (!node) return null;
        const portBtn = node.ports[portRef.portId];
        if (!portBtn) return null;
        const rect = portBtn.getBoundingClientRect();
        const stageRect = stage.getBoundingClientRect();
        return {
            x: rect.left - stageRect.left + rect.width / 2,
            y: rect.top - stageRect.top + rect.height / 2
        };
    }

    // --- 永続化 (canvas) --------------------------------------------------
    function snapshotCanvas() {
        const nodes = {};
        Object.values(state.nodes).forEach((node) => {
            nodes[node.id] = {
                type: node.type,
                x: parseFloat(node.el.style.left || 0),
                y: parseFloat(node.el.style.top || 0)
            };
        });
        const connections = state.connections.map((conn) => ({
            id: conn.id,
            kind: conn.kind,
            a: conn.a,
            b: conn.b
        }));
        return { nodes, connections };
    }

    function persistCanvas(reason) {
        if (restoring) return;
        const snap = snapshotCanvas();
        try {
            window.localStorage.setItem(STORAGE_KEY_CANVAS, JSON.stringify(snap));
        } catch (err) {
            console.warn('[COMPANY] localStorage persist failed', err);
        }
        if (global.AppStore && typeof AppStore.patch === 'function') {
            AppStore.patch((draft) => {
                draft.company = draft.company || {};
                draft.company.canvas = snap;
            });
        }
        log('persist', reason, snap);
    }

    function restoreCanvasFromStore() {
        let stored = null;
        if (global.AppStore && typeof AppStore.get === 'function') {
            stored = AppStore.get()?.company?.canvas || null;
        }
        if (!stored) {
            try {
                const raw = window.localStorage.getItem(STORAGE_KEY_CANVAS);
                if (raw) stored = JSON.parse(raw);
            } catch (err) {
                console.warn('[COMPANY] read fallback failed', err);
            }
        }
        if (!stored) return;
        restoring = true;
        clearAll();
        Object.entries(stored.nodes || {}).forEach(([id, info]) => {
            spawnNode(info.type, { id, x: info.x, y: info.y });
            const idNum = parseInt(String(id).replace(/\D/g, ''), 10);
            if (!Number.isNaN(idNum)) uid = Math.max(uid, idNum);
        });
        (stored.connections || []).forEach((conn) => {
            createConnectionFromSnapshot(conn);
        });
        restoring = false;
        syncConnectivity('restore', { force: true });
    }

    function createConnectionFromSnapshot(record) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.classList.add('cable', record.kind === 'fiber' ? 'fiber' : 'rj45');
        svg.appendChild(line);
        const conn = {
            id: record.id || `conn-${++cid}`,
            kind: record.kind,
            a: record.a,
            b: record.b,
            el: line
        };
        state.connections.push(conn);
        updateLine(conn);
        const idNum = parseInt(String(conn.id).replace(/\D/g, ''), 10);
        if (!Number.isNaN(idNum)) cid = Math.max(cid, idNum);
    }

    // --- 接続判定 --------------------------------------------------------
    function computeEdges() {
        const nodes = state.nodes;
        const fiberOnu = state.connections.some((conn) => {
            if (conn.kind !== 'fiber') return false;
            const aType = conn.a.nodeId === 'fiber' ? 'fiber' : nodes[conn.a.nodeId]?.type;
            const bType = conn.b.nodeId === 'fiber' ? 'fiber' : nodes[conn.b.nodeId]?.type;
            return (aType === 'fiber' && bType === 'onu') || (aType === 'onu' && bType === 'fiber');
        });

        const graph = buildRj45Graph();
        const onuRouter = hasTypePath(graph, 'onu', 'router');
        const routerPc = hasTypePath(graph, 'router', 'web');

        return { fiberOnu, onuRouter, routerPc };
    }

    function buildRj45Graph() {
        const graph = new Map();
        const ensure = (id) => { if (!graph.has(id)) graph.set(id, new Set()); return graph.get(id); };
        state.connections.forEach((conn) => {
            if (conn.kind !== 'rj45') return;
            if (!state.nodes[conn.a.nodeId] || !state.nodes[conn.b.nodeId]) return;
            ensure(conn.a.nodeId).add(conn.b.nodeId);
            ensure(conn.b.nodeId).add(conn.a.nodeId);
        });
        return graph;
    }

    function hasTypePath(graph, typeA, typeB) {
        const starts = Object.values(state.nodes).filter((n) => n.type === typeA);
        const targets = new Set(Object.values(state.nodes).filter((n) => n.type === typeB).map((n) => n.id));
        if (!starts.length || !targets.size) return false;
        for (const start of starts) {
            const visited = new Set([start.id]);
            const queue = [start.id];
            while (queue.length) {
                const id = queue.shift();
                if (targets.has(id)) return true;
                const neighbors = graph.get(id);
                if (!neighbors) continue;
                neighbors.forEach((next) => {
                    if (!visited.has(next)) {
                        visited.add(next);
                        queue.push(next);
                    }
                });
            }
        }
        return false;
    }

    function syncConnectivity(reason = 'update', opts = {}) {
        const { force = false, destructive = false } = opts;
        const edges = computeEdges();
        const json = JSON.stringify(edges);
        const prev = window.localStorage.getItem(STORAGE_KEY_EDGES);
        if (!force && json === prev) {
            updateBadge(edges);
            return;
        }
        try {
            window.localStorage.setItem(STORAGE_KEY_EDGES, json);
        } catch (err) {
            console.warn('[COMPANY] fallback edge save failed', err);
        }
        if (global.CompanyEdges && typeof CompanyEdges.set === 'function') {
            CompanyEdges.set(edges);
        } else if (global.AppStore && typeof AppStore.patch === 'function') {
            AppStore.patch((draft) => {
                draft.company = draft.company || {};
                draft.company.edges = Object.assign({}, edges);
                const ok = edges.fiberOnu && edges.onuRouter && edges.routerPc;
                draft.company.reach = {
                    internet: ok,
                    count: (edges.fiberOnu ? 1 : 0) + (edges.onuRouter ? 1 : 0) + (edges.routerPc ? 1 : 0)
                };
                draft.summary = draft.summary || {};
                draft.summary.companyOK = ok;
            });
        }
        updateBadge(edges);
        emitDebugSnapshot(`sync:${reason}`, { edges, force, destructive });
    }

    function updateBadge(edges) {
        if (!statusBadge) return;
        const ok = edges.fiberOnu && edges.onuRouter && edges.routerPc;
        statusBadge.textContent = ok ? 'T' : 'F';
        statusBadge.classList.toggle('on', ok);
    }

    // --- DNS --------------------------------------------------------------
    function wireUpDnsForm() {
        if (!dnsForm) return;
        dnsForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const domain = dnsInput.value.trim();
            if (!domain) {
                dnsResult.textContent = 'ドメイン名を入力してください。';
                return;
            }
            dnsResult.textContent = '通信中...';
            testDomainReachability(domain)
                .then((ms) => {
                    dnsResult.textContent = `${domain} へ ${ms}ms で到達しました。`;
                })
                .catch((err) => {
                    dnsResult.textContent = `到達できません: ${err.message || err}`;
                });
        });
    }

    function testDomainReachability(domain) {
        const url = `https://${domain.replace(/^https?:\/\//i, '')}/?network-check=${Date.now()}`;
        if (!window.fetch) {
            return new Promise((resolve, reject) => {
                const img = new Image();
                const timer = setTimeout(() => { reject(new Error('timeout')); }, 6000);
                img.onload = () => { clearTimeout(timer); resolve(0); };
                img.onerror = () => { clearTimeout(timer); reject(new Error('blocked')); };
                img.src = url;
            });
        }
        return new Promise((resolve, reject) => {
            const started = performance.now();
            const ctrl = window.AbortController ? new AbortController() : null;
            const timer = setTimeout(() => {
                if (ctrl) ctrl.abort();
                reject(new Error('timeout'));
            }, 6000);
            fetch(url, { mode: 'no-cors', cache: 'no-store', signal: ctrl?.signal })
                .then(() => {
                    clearTimeout(timer);
                    resolve(Math.round(performance.now() - started));
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });
    }

    // --- デバッグ --------------------------------------------------------
    function wireUpDebug() {
        if (btnDump) btnDump.addEventListener('click', () => emitDebugSnapshot('manual'));
    }

    function emitDebugSnapshot(source = 'auto', extra = {}) {
        const payload = {
            source,
            timestamp: new Date().toISOString(),
            edges: computeEdges(),
            snapshot: snapshotCanvas(),
            connections: state.connections,
            extra
        };
        if (global.AppStore && typeof AppStore.get === 'function') {
            payload.store = AppStore.get();
        }
        if (debugDump) {
            debugDump.textContent = JSON.stringify(payload, null, 2);
        }
        log('debug snapshot', payload);
        return payload;
    }

    global.CompanyDebug = {
        dump: emitDebugSnapshot,
        snapshot: snapshotCanvas,
        edges: computeEdges
    };
})(window);
