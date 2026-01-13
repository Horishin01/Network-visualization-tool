import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  useCallback,
  useLayoutEffect
} from 'react';
import AppShell from '../components/AppShell.jsx';
import { createId, loadState, saveState } from '../utils/storage.js';
import { syncCompanyEdges } from '../utils/appStore.js';
import { buildCompanyExplanation } from '../utils/pageExplanations.js';
import {
  FTP_DEPLOY_KEY,
  FTP_UPLOADS_KEY,
  PREVIEW_SLOT_ID,
  findUpload,
  loadDeployments,
  loadUploads,
  saveDeployments,
  saveUploads
} from '../utils/ftpStore.js';

const STORAGE_KEY = 'network:company:v1';

const DEVICE_TYPES = [
  { type: 'router', label: 'ルータ' },
  { type: 'pc', label: 'PC' }
];

const PALETTE_TYPES = [
  { type: 'router', label: 'ルータ' },
  { type: 'pc', label: 'PC' }
];

const PC_ROLES = [
  { type: 'work', label: '仕事用' },
  { type: 'server', label: 'サーバ用' }
];

const PC_ROLE_TYPES = PC_ROLES.map((role) => role.type);
const PC_ROLE_LABELS = PC_ROLES.reduce((acc, role) => {
  acc[role.type] = role.label;
  return acc;
}, {});

const STEP_STATE_LABELS = {
  done: '完了',
  doing: '進行中',
  todo: '未着手'
};

const SERVER_APPS = [
  { type: 'web', label: 'WEB' },
  { type: 'ftp', label: 'FTP' },
  { type: 'dns', label: 'DNS' }
];

const SERVER_APP_TYPES = SERVER_APPS.map((app) => app.type);
const SERVER_APP_LABELS = SERVER_APPS.reduce((acc, app) => {
  acc[app.type] = app.label;
  return acc;
}, {});

const PRESET_UPLOADS = [
  {
    id: 'preset-basic',
    name: 'company-basic.html',
    label: 'ベーシック',
    description: '会社概要 + ニュース',
    content: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>会社HP - ベーシック</title>
  <style>
    body{font-family:"Hiragino Kaku Gothic ProN", Meiryo, sans-serif;margin:0;background:#f8f7f3;color:#1f2933}
    header{background:#20323f;color:#fff;padding:24px}
    main{padding:24px}
    .hero{background:#fff;border:1px solid #d2d4d8;border-radius:12px;padding:20px;margin-bottom:18px}
    .grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
    .card{background:#fff;border:1px solid #d2d4d8;border-radius:10px;padding:12px}
    footer{padding:18px;text-align:center;color:#6b6b6b}
  </style>
</head>
<body>
  <header>
    <h1>Network Learning Co.</h1>
    <p>信頼されるネットワーク支援を提供します。</p>
  </header>
  <main>
    <section class="hero">
      <h2>会社概要</h2>
      <p>安定運用とセキュリティを軸に、企業ネットワークを支援します。</p>
    </section>
    <section class="grid">
      <div class="card"><h3>サービス</h3><p>設計 / 運用 / 監視</p></div>
      <div class="card"><h3>実績</h3><p>150社以上の導入支援</p></div>
      <div class="card"><h3>ニュース</h3><p>新拠点を開設しました。</p></div>
    </section>
  </main>
  <footer>© 2025 Network Learning Co.</footer>
</body>
</html>`
  },
  {
    id: 'preset-services',
    name: 'company-services.html',
    label: 'サービス紹介',
    description: '提供メニューを一覧化',
    content: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>会社HP - サービス</title>
  <style>
    body{font-family:"Yu Gothic", Meiryo, sans-serif;margin:0;background:#f2f5f9;color:#1f2933}
    header{background:#0f4c81;color:#fff;padding:22px}
    main{padding:22px}
    .list{display:grid;gap:12px}
    .item{background:#fff;border:1px solid #d8e1ea;border-radius:12px;padding:14px}
    .item h3{margin:0 0 6px}
  </style>
</head>
<body>
  <header>
    <h1>Service Lineup</h1>
    <p>企業ネットワークの運用をワンストップで支援</p>
  </header>
  <main class="list">
    <div class="item"><h3>ネットワーク設計</h3><p>要件整理から構成設計まで。</p></div>
    <div class="item"><h3>運用監視</h3><p>24h 監視と障害一次対応。</p></div>
    <div class="item"><h3>セキュリティ</h3><p>脆弱性診断とポリシー整備。</p></div>
  </main>
</body>
</html>`
  },
  {
    id: 'preset-recruit',
    name: 'company-recruit.html',
    label: '採用案内',
    description: '募集要項 + カルチャー',
    content: `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>会社HP - 採用</title>
  <style>
    body{font-family:"Noto Sans JP", Meiryo, sans-serif;margin:0;background:#fff7f0;color:#2f2a24}
    header{background:#d97a4b;color:#fff;padding:22px}
    main{padding:22px}
    .block{border:1px solid #e9d3c7;border-radius:12px;padding:14px;margin-bottom:12px;background:#fff}
  </style>
</head>
<body>
  <header>
    <h1>採用情報</h1>
    <p>インフラエンジニアを募集しています。</p>
  </header>
  <main>
    <div class="block"><h3>働き方</h3><p>リモート併用 / 学習支援あり</p></div>
    <div class="block"><h3>募集要項</h3><p>ネットワーク設計・運用 / 経験者歓迎</p></div>
    <div class="block"><h3>応募方法</h3><p>採用ページからエントリーしてください。</p></div>
  </main>
</body>
</html>`
  }
];

const createPresetEntry = (preset) => ({
  id: preset.id,
  name: preset.name,
  size: preset.content.length,
  type: 'text/html',
  uploadedAt: new Date().toISOString(),
  content: preset.content
});

const createDefaultState = () => ({
  devices: [],
  selectedId: null
});

const normalizeApps = (apps, preferredType = null) => {
  const next = { web: false, ftp: false, dns: false };
  if (apps && typeof apps === 'object') {
    SERVER_APP_TYPES.forEach((type) => {
      next[type] = !!apps[type];
    });
  }
  let chosen = null;
  if (preferredType && next[preferredType]) {
    chosen = preferredType;
  } else {
    chosen = SERVER_APP_TYPES.find((type) => next[type]) || null;
  }
  SERVER_APP_TYPES.forEach((type) => {
    next[type] = type === chosen;
  });
  return next;
};

const normalizeRole = (role, apps) => {
  if (PC_ROLE_TYPES.includes(role)) {
    return role;
  }
  const hasApps = Object.values(apps).some(Boolean);
  return hasApps ? 'server' : 'work';
};

const normalizePcMeta = (meta, extraApps = {}) => {
  const baseMeta = meta && typeof meta === 'object' ? meta : {};
  const rawApps = {
    ...(baseMeta.apps && typeof baseMeta.apps === 'object' ? baseMeta.apps : {})
  };
  if (baseMeta.ftpInstalled) {
    rawApps.ftp = true;
  }
  Object.keys(extraApps).forEach((type) => {
    if (SERVER_APP_TYPES.includes(type)) {
      rawApps[type] = rawApps[type] || !!extraApps[type];
    }
  });
  const preferred = SERVER_APP_TYPES.find((type) => extraApps[type])
    || (baseMeta.ftpInstalled ? 'ftp' : null);
  const apps = normalizeApps(rawApps, preferred);
  const role = normalizeRole(baseMeta.role, apps);
  return { ...baseMeta, role, apps };
};

const normalizeCompanyState = (value) => {
  if (!value || typeof value !== 'object') {
    return createDefaultState();
  }

  const rawDevices = Array.isArray(value.devices) ? value.devices : [];
  const devices = [];
  let hasRouter = false;

  rawDevices.forEach((device) => {
    if (!device || typeof device !== 'object') {
      return;
    }
    const rawType = typeof device.type === 'string' ? device.type : 'pc';
    const id = typeof device.id === 'string' ? device.id : createId(rawType === 'router' ? 'router' : 'pc');
    let normalized = null;
    if (rawType === 'router') {
      if (hasRouter) {
        return;
      }
      normalized = { id, type: 'router' };
      hasRouter = true;
    } else if (rawType === 'pc') {
      normalized = { id, type: 'pc', meta: normalizePcMeta(device.meta) };
    } else if (SERVER_APP_TYPES.includes(rawType)) {
      normalized = {
        id,
        type: 'pc',
        meta: normalizePcMeta(device.meta, { [rawType]: true })
      };
    } else {
      normalized = { id, type: 'pc', meta: normalizePcMeta(device.meta) };
    }
    if (normalized) {
      devices.push(normalized);
    }
  });

  const selectedId = typeof value.selectedId === 'string' && devices.some((d) => d.id === value.selectedId)
    ? value.selectedId
    : (devices[0]?.id ?? null);

  return { devices, selectedId };
};

export default function CompanyPage() {
  const [state, setState] = useState(() =>
    normalizeCompanyState(loadState(STORAGE_KEY, createDefaultState()))
  );
  const [cables, setCables] = useState([]);
  const [uploads, setUploads] = useState(() => loadUploads());
  const [deployments, setDeployments] = useState(() => loadDeployments());
  const [selectedUploadId, setSelectedUploadId] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const stageRef = useRef(null);
  const onuRef = useRef(null);
  const previewUrlRef = useRef(null);

  useEffect(() => {
    saveState(STORAGE_KEY, state);
  }, [state]);

  const pcs = useMemo(
    () => state.devices.filter((device) => device.type === 'pc'),
    [state.devices]
  );
  const hasRouter = state.devices.some((device) => device.type === 'router');
  const hasPc = pcs.length > 0;
  const serverPcs = useMemo(
    () => pcs.filter((device) => device.meta?.role === 'server'),
    [pcs]
  );
  const hasServerPc = serverPcs.length > 0;
  const serverApps = useMemo(() => {
    const flags = { web: false, ftp: false, dns: false };
    serverPcs.forEach((device) => {
      const apps = device.meta?.apps;
      if (!apps) {
        return;
      }
      SERVER_APP_TYPES.forEach((type) => {
        if (apps[type]) {
          flags[type] = true;
        }
      });
    });
    return flags;
  }, [serverPcs]);
  const hasWebServer = serverApps.web;
  const hasFtpServer = serverApps.ftp;
  const hasDnsServer = serverApps.dns;
  const hasServer = hasWebServer || hasFtpServer || hasDnsServer;
  const serverLabels = useMemo(() => {
    if (!hasServerPc) {
      return '未設定';
    }
    const labels = SERVER_APP_TYPES.filter((type) => serverApps[type]).map((type) => SERVER_APP_LABELS[type]);
    return labels.length ? labels.join(' / ') : '未導入';
  }, [serverApps, hasServerPc]);

  const companyEdges = useMemo(() => ({
    fiberOnu: hasRouter,
    onuRouter: hasRouter,
    routerPc: hasRouter && hasPc,
    routerFtp: hasRouter && hasFtpServer
  }), [hasRouter, hasPc, hasFtpServer]);

  const lanClients = useMemo(
    () => pcs.length,
    [pcs]
  );

  useEffect(() => {
    syncCompanyEdges(companyEdges, { lanClients });
  }, [companyEdges, lanClients]);

  useEffect(() => {
    const sync = () => {
      setUploads(loadUploads());
      setDeployments(loadDeployments());
    };
    sync();

    const onStorage = (event) => {
      if (event.key === FTP_UPLOADS_KEY || event.key === FTP_DEPLOY_KEY) {
        sync();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('ftp:updated', sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ftp:updated', sync);
    };
  }, []);

  useEffect(() => {
    if (!uploads.length) {
      setSelectedUploadId('');
      return;
    }
    const assigned = deployments[PREVIEW_SLOT_ID];
    if (assigned && uploads.some((item) => item.id === assigned)) {
      setSelectedUploadId(assigned);
      return;
    }
    if (!uploads.some((item) => item.id === selectedUploadId)) {
      setSelectedUploadId(uploads[0].id);
    }
  }, [uploads, deployments, selectedUploadId]);

  const status = {
    wan: hasRouter ? 'OK' : '未接続',
    servers: serverLabels,
    ftp: hasRouter && hasFtpServer ? 'OK' : '未確認'
  };

  const ftpEnabled = status.ftp === 'OK';
  const previewReady = hasRouter && hasWebServer;
  const ftpServerReady = hasRouter && hasFtpServer;
  const activeUpload = useMemo(
    () => findUpload(uploads, deployments[PREVIEW_SLOT_ID]),
    [uploads, deployments]
  );

  const previewBadge = useMemo(() => {
    if (!previewReady) {
      return { state: 'locked', label: 'LOCK' };
    }
    if (activeUpload) {
      return { state: 'ok', label: 'OK' };
    }
    return { state: 'idle', label: '待機' };
  }, [previewReady, activeUpload]);

  const previewMessage = useMemo(() => {
    if (!hasRouter) {
      return 'ルータを配置して WAN を OK にしてください。';
    }
    if (!hasServerPc) {
      return 'PC をサーバ用に切り替えるとプレビュー準備ができます。';
    }
    if (!hasWebServer) {
      return 'WEB サーバアプリを PC に入れるとプレビューが表示されます。';
    }
    if (!activeUpload) {
      return ftpServerReady
        ? '用意された HTML を FTP でアップロードして割り当ててください。'
        : 'FTP サーバアプリを入れると用意された HTML をアップロードできます。';
    }
    return '';
  }, [hasRouter, hasServerPc, hasWebServer, activeUpload, ftpServerReady]);

  useEffect(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    if (!previewReady || !activeUpload) {
      setPreviewUrl('');
      return;
    }
    const url = URL.createObjectURL(
      new Blob([activeUpload.content], { type: activeUpload.type || 'text/html' })
    );
    previewUrlRef.current = url;
    setPreviewUrl(url);
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, [previewReady, activeUpload]);

  const explanation = useMemo(() => buildCompanyExplanation({
    hasRouter,
    hasPc,
    hasServerPc,
    hasServer,
    hasWebServer,
    hasFtpServer,
    hasDnsServer,
    status,
    ftpEnabled,
    activeUpload,
    lanClients
  }), [
    hasRouter,
    hasPc,
    hasServerPc,
    hasServer,
    hasWebServer,
    hasFtpServer,
    hasDnsServer,
    status,
    ftpEnabled,
    activeUpload,
    lanClients
  ]);

  const routerDevice = useMemo(
    () => state.devices.find((device) => device.type === 'router') || null,
    [state.devices]
  );
  const otherDevices = useMemo(
    () => state.devices.filter((device) => device.type !== 'router'),
    [state.devices]
  );

  const selected = state.devices.find((device) => device.id === state.selectedId) || null;
  const selectedRole = selected?.type === 'pc' && PC_ROLE_TYPES.includes(selected.meta?.role)
    ? selected.meta.role
    : (selected?.type === 'pc' ? 'work' : null);

  const updateCables = useCallback(() => {
    const stageEl = stageRef.current;
    const onuEl = onuRef.current;
    if (!stageEl || !onuEl) {
      setCables((prev) => (prev.length ? [] : prev));
      return;
    }
    const stageRect = stageEl.getBoundingClientRect();
    const centerOf = (el) => {
      const rect = el.getBoundingClientRect();
      return {
        x: rect.left + rect.width / 2 - stageRect.left,
        y: rect.top + rect.height / 2 - stageRect.top
      };
    };

    const router = state.devices.find((device) => device.type === 'router') || null;
    const routerEl = router
      ? stageEl.querySelector(`[data-device-id="${router.id}"]`)
      : null;

    const nextCables = [];
    if (routerEl) {
      const from = centerOf(onuEl);
      const to = centerOf(routerEl);
      nextCables.push({
        id: `wan-${router.id}`,
        kind: 'fiber',
        x1: from.x,
        y1: from.y,
        x2: to.x,
        y2: to.y
      });

      const lanTargets = state.devices.filter((device) => device.type !== 'router');
      const routerPos = centerOf(routerEl);
      lanTargets.forEach((device) => {
        const targetEl = stageEl.querySelector(`[data-device-id="${device.id}"]`);
        if (!targetEl) {
          return;
        }
        const targetPos = centerOf(targetEl);
        nextCables.push({
          id: `lan-${router.id}-${device.id}`,
          kind: 'lan',
          x1: routerPos.x,
          y1: routerPos.y,
          x2: targetPos.x,
          y2: targetPos.y
        });
      });
    }
    setCables((prev) => {
      if (prev.length !== nextCables.length) {
        return nextCables;
      }
      for (let i = 0; i < prev.length; i += 1) {
        const a = prev[i];
        const b = nextCables[i];
        if (
          a.id !== b.id ||
          a.kind !== b.kind ||
          a.x1 !== b.x1 ||
          a.y1 !== b.y1 ||
          a.x2 !== b.x2 ||
          a.y2 !== b.y2
        ) {
          return nextCables;
        }
      }
      return prev;
    });
  }, [state.devices]);

  useLayoutEffect(() => {
    updateCables();
  }, [updateCables]);

  useEffect(() => {
    window.addEventListener('resize', updateCables);
    return () => {
      window.removeEventListener('resize', updateCables);
    };
  }, [updateCables]);

  const handleAdd = (type) => {
    setState((prev) => {
      if (type === 'router') {
        const existing = prev.devices.find((device) => device.type === 'router');
        if (existing) {
          return { ...prev, selectedId: existing.id };
        }
      }
      const id = createId(type);
      const meta = type === 'pc' ? { role: 'work', apps: normalizeApps() } : undefined;
      return {
        ...prev,
        devices: [...prev.devices, { id, type, meta }],
        selectedId: id
      };
    });
  };

  const handleSelect = (id) => {
    setState((prev) => ({
      ...prev,
      selectedId: id
    }));
  };

  const handleRemove = (id) => {
    setState((prev) => {
      const nextDevices = prev.devices.filter((device) => device.id !== id);
      const nextSelected = prev.selectedId === id ? (nextDevices[0]?.id ?? null) : prev.selectedId;
      return {
        ...prev,
        devices: nextDevices,
        selectedId: nextSelected
      };
    });
  };

  const handlePresetUpload = (preset) => {
    if (!ftpEnabled) {
      return;
    }
    const entry = createPresetEntry(preset);
    const next = [entry, ...uploads.filter((item) => item.id !== entry.id)].slice(0, 12);
    setUploads(next);
    saveUploads(next);
    setSelectedUploadId(entry.id);
  };

  const handleAssign = () => {
    if (!ftpEnabled || !selectedUploadId) {
      return;
    }
    const next = { ...deployments, [PREVIEW_SLOT_ID]: selectedUploadId };
    setDeployments(next);
    saveDeployments(next);
  };

  const setPcRole = (role) => {
    if (!selected || selected.type !== 'pc') {
      return;
    }
    if (!PC_ROLE_TYPES.includes(role)) {
      return;
    }
    setState((prev) => ({
      ...prev,
      devices: prev.devices.map((device) => {
        if (device.id !== selected.id) {
          return device;
        }
        return {
          ...device,
          meta: {
            ...device.meta,
            role,
            apps: normalizeApps(device.meta?.apps)
          }
        };
      })
    }));
  };

  const toggleApp = (appType) => {
    if (!selected || selected.type !== 'pc') {
      return;
    }
    if (selected.meta?.role !== 'server') {
      return;
    }
    if (!SERVER_APP_TYPES.includes(appType)) {
      return;
    }
    setState((prev) => ({
      ...prev,
      devices: prev.devices.map((device) => {
        if (device.id !== selected.id) {
          return device;
        }
        const apps = normalizeApps(device.meta?.apps);
        const isOn = apps[appType];
        const nextApps = isOn ? normalizeApps(null) : normalizeApps({ [appType]: true }, appType);
        return {
          ...device,
          meta: {
            ...device.meta,
            apps: {
              ...nextApps
            }
          }
        };
      })
    }));
  };

  const renderDetail = () => {
    if (!selected) {
      return '機器をクリックすると設定内容を表示します。';
    }
    switch (selected.type) {
      case 'router':
        return `WAN: ${status.wan} / サーバ: ${status.servers}`;
      case 'pc':
        {
          const roleType = PC_ROLE_TYPES.includes(selected.meta?.role) ? selected.meta.role : 'work';
          const roleLabel = PC_ROLE_LABELS[roleType] || '仕事用';
          const apps = SERVER_APP_TYPES
            .filter((type) => selected.meta?.apps?.[type])
            .map((type) => SERVER_APP_LABELS[type]);
          if (roleType === 'server') {
            return `用途: ${roleLabel} / サーバアプリ: ${apps.length ? apps.join(' / ') : '未導入'}`;
          }
          return `用途: ${roleLabel} / サーバアプリ: 未使用`;
        }
      default:
        return '設定内容を準備しています。';
    }
  };

  const renderDevice = (device) => {
    const label = DEVICE_TYPES.find((item) => item.type === device.type)?.label || device.type;
    const isActive = device.id === state.selectedId;
    const roleType = device.type === 'pc' && PC_ROLE_TYPES.includes(device.meta?.role)
      ? device.meta.role
      : (device.type === 'pc' ? 'work' : null);
    const roleLabel = roleType ? (PC_ROLE_LABELS[roleType] || '仕事用') : '';
    const showApps = roleType === 'server';
    const appTags = device.type === 'pc' && showApps
      ? SERVER_APP_TYPES.filter((type) => device.meta?.apps?.[type])
      : [];
    return (
      <div
        key={device.id}
        className={`device-chip${isActive ? ' active' : ''}`}
        data-device-id={device.id}
      >
        <button
          type="button"
          className="device-select"
          onClick={() => handleSelect(device.id)}
        >
          <span className="device-label">{label}</span>
          {device.type === 'pc' && (
            <span className="device-apps">
              <span className={`device-app device-role ${roleType || 'work'}`}>
                {roleLabel}
              </span>
              {showApps && (appTags.length ? appTags.map((type) => (
                <span key={`${device.id}-${type}`} className="device-app">
                  {SERVER_APP_LABELS[type]}
                </span>
              )) : (
                <span className="device-app muted">APPなし</span>
              ))}
            </span>
          )}
        </button>
        <button
          type="button"
          className="device-remove"
          onClick={(event) => {
            event.stopPropagation();
            handleRemove(device.id);
          }}
          aria-label={`${label}を削除`}
          title={`${label}を削除`}
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <AppShell active="training">
      <section className="sim-grid">
        <aside className="panel">
          <h3 className="panel-title">解説（指示書）</h3>
          <div className="explain-title">{explanation.title}</div>
          <div className="explain-status">現在の状況: {explanation.statusLabel}</div>
          <div className="explain-body">
            {explanation.lines.map((line, index) => (
              <p key={`company-explain-${index}`} className="explain-line">
                {line}
              </p>
            ))}
          </div>
          <div className="explain-steps">
            <div className="explain-subtitle">進行ステップ</div>
            <ul className="step-list">
              {(explanation.steps || []).map((step) => (
                <li key={`company-step-${step.id}`} className="step-item">
                  <div className="step-head">
                    <span className="step-label">{step.label}</span>
                    <div className="step-tags">
                      {step.optional && (
                        <span className="step-optional">任意</span>
                      )}
                      <span className={`step-badge ${step.state}`}>
                        {STEP_STATE_LABELS[step.state] || step.state}
                      </span>
                    </div>
                  </div>
                  {step.detail && (
                    <div className="step-detail">{step.detail}</div>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {explanation.nextAction && (
            <div className="explain-next">
              <div className="explain-next-label">次にやること</div>
              <div className="explain-next-body">{explanation.nextAction}</div>
            </div>
          )}
        </aside>

        <section className="sim-stage" ref={stageRef}>
          <div className="stage-title">会社</div>
          <div className="building-frame" aria-hidden="true"></div>
          <div className="onu-point" ref={onuRef}>光</div>
          <div className="onu-label">ONU</div>
          <svg className="cable-layer" aria-hidden="true" width="100%" height="100%">
            {cables.map((cable) => (
              <line
                key={cable.id}
                className={`cable-line ${cable.kind}`}
                x1={cable.x1}
                y1={cable.y1}
                x2={cable.x2}
                y2={cable.y2}
              />
            ))}
          </svg>
          <div className="device-board" aria-live="polite">
            {routerDevice && (
              <div className="router-slot">
                {renderDevice(routerDevice)}
              </div>
            )}
            <div className="device-grid">
              {otherDevices.map((device) => renderDevice(device))}
            </div>
          </div>
        </section>

        <aside className="side-panel">
          <div className="palette">
            <h3 className="panel-title">機器パレット</h3>
            <div className="palette-grid">
              {PALETTE_TYPES.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  className="palette-btn"
                  onClick={() => handleAdd(item.type)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="monitor">
            <h3 className="panel-title">モニター</h3>
            <div className="monitor-status">WAN: {status.wan} / サーバ: {status.servers}</div>
            <div className="monitor-detail">{renderDetail()}</div>
            {selected?.type === 'pc' && (
              <div className="pc-control">
                <div className="role-control">
                  <div className="app-title">PC用途</div>
                  <div className="role-buttons">
                    {PC_ROLES.map((role) => (
                      <button
                        key={role.type}
                        className={`action-btn role-btn${selectedRole === role.type ? ' active' : ''}`}
                        type="button"
                        onClick={() => setPcRole(role.type)}
                      >
                        {role.label}
                      </button>
                    ))}
                  </div>
                </div>
                {selectedRole === 'server' && (
                  <div className="app-control">
                    <div className="app-title">サーバアプリ</div>
                    <div className="app-buttons">
                      {SERVER_APPS.map((app) => {
                        const isOn = !!selected.meta?.apps?.[app.type];
                        return (
                          <button
                            key={app.type}
                            className={`action-btn app-btn${isOn ? ' active' : ''}`}
                            type="button"
                            onClick={() => toggleApp(app.type)}
                          >
                            {isOn ? `${app.label}を外す` : `${app.label}を入れる`}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="preview-box">
              <div className="preview-head">
                <span>会社HPプレビュー</span>
                <span className={`preview-badge ${previewBadge.state}`}>{previewBadge.label}</span>
              </div>
              {!previewReady && (
                <div className="preview-lock">{previewMessage}</div>
              )}
              {previewReady && !activeUpload && (
                <div className="preview-empty">{previewMessage}</div>
              )}
              {previewReady && activeUpload && (
                <iframe
                  className="preview-iframe"
                  title="会社HPプレビュー"
                  src={previewUrl}
                />
              )}
              <div className={`preview-controls${ftpEnabled ? '' : ' disabled'}`}>
                <div className="preview-upload">
                  <div className="preset-title">用意済みHTML</div>
                  <div className="preset-grid">
                    {PRESET_UPLOADS.map((preset) => (
                      <button
                        key={preset.id}
                        className="action-btn preset-btn"
                        type="button"
                        onClick={() => handlePresetUpload(preset)}
                      >
                        <span className="preset-name">{preset.label}</span>
                        <span className="preset-desc">{preset.description}</span>
                        <span className="preset-action">FTPでアップロード</span>
                      </button>
                    ))}
                  </div>
                  <span className="preview-hint">
                    {ftpEnabled
                      ? 'FTPサーバアプリ稼働中: 用意されたHTMLをアップロードできます。'
                      : 'サーバ用PCでFTPサーバアプリを入れると使用できます。'}
                  </span>
                </div>
                <div className="preview-assign">
                  <select
                    className="preview-select"
                    value={selectedUploadId}
                    onChange={(event) => setSelectedUploadId(event.target.value)}
                    disabled={!ftpEnabled || uploads.length === 0}
                  >
                    <option value="">
                      {uploads.length ? 'アップロードを選択' : 'アップロードがありません'}
                    </option>
                    {uploads.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button
                    className="action-btn"
                    type="button"
                    onClick={handleAssign}
                    disabled={!ftpEnabled || !selectedUploadId}
                  >
                    割り当てる
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
