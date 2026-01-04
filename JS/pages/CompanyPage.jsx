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
  createUploadEntry,
  findUpload,
  loadDeployments,
  loadUploads,
  saveDeployments,
  saveUploads
} from '../utils/ftpStore.js';

const STORAGE_KEY = 'network:company:v1';

const DEVICE_TYPES = [
  { type: 'router', label: 'ルータ' },
  { type: 'pc', label: 'PC' },
  { type: 'web', label: 'WEB' },
  { type: 'ftp', label: 'FTP' },
  { type: 'dns', label: 'DNS' }
];

const defaultState = {
  devices: [],
  selectedId: null
};

const normalizeCompanyState = (value) => {
  if (!value || typeof value !== 'object') {
    return { ...defaultState };
  }

  const rawDevices = Array.isArray(value.devices) ? value.devices : [];
  const devices = rawDevices
    .filter((device) => device && typeof device === 'object')
    .map((device) => {
      const type = typeof device.type === 'string' ? device.type : 'pc';
      return {
        id: typeof device.id === 'string' ? device.id : createId(type),
        type,
        meta: device.meta && typeof device.meta === 'object' ? device.meta : undefined
      };
    });

  const selectedId = typeof value.selectedId === 'string' && devices.some((d) => d.id === value.selectedId)
    ? value.selectedId
    : (devices[0]?.id ?? null);

  return { devices, selectedId };
};

export default function CompanyPage() {
  const [state, setState] = useState(() =>
    normalizeCompanyState(loadState(STORAGE_KEY, defaultState))
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

  const types = useMemo(() => state.devices.map((device) => device.type), [state.devices]);
  const hasRouter = types.includes('router');
  const hasPc = types.includes('pc');
  const hasWeb = types.includes('web');
  const hasServer = types.some((type) => ['web', 'ftp', 'dns'].includes(type));
  const ftpServer = types.includes('ftp');
  const ftpInstalled = state.devices.some((device) => device.type === 'pc' && device.meta?.ftpInstalled);

  const companyEdges = useMemo(() => ({
    fiberOnu: hasRouter,
    onuRouter: hasRouter,
    routerPc: hasPc || hasWeb,
    routerFtp: ftpServer
  }), [hasRouter, hasPc, hasWeb, ftpServer]);

  const lanClients = useMemo(
    () => state.devices.filter((device) => device.type !== 'router').length,
    [state.devices]
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
    servers: hasServer ? 'OK' : '未配置',
    ftp: ftpServer && hasPc && ftpInstalled ? 'OK' : '未確認'
  };

  const ftpEnabled = status.ftp === 'OK';
  const previewReady = hasRouter && hasWeb;
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
    if (!hasWeb) {
      return 'WEB サーバを配置するとプレビューが表示されます。';
    }
    if (!activeUpload) {
      return 'FTP で HTML をアップロードして割り当ててください。';
    }
    return '';
  }, [hasRouter, hasWeb, activeUpload]);

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
    hasServer,
    ftpServer,
    ftpInstalled,
    status
  }), [hasRouter, hasPc, hasServer, ftpServer, ftpInstalled, status]);

  const routerDevice = useMemo(
    () => state.devices.find((device) => device.type === 'router') || null,
    [state.devices]
  );
  const otherDevices = useMemo(
    () => state.devices.filter((device) => device.type !== 'router'),
    [state.devices]
  );

  const selected = state.devices.find((device) => device.id === state.selectedId) || null;

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
    const id = createId(type);
    const meta = type === 'pc' ? { ftpInstalled: false } : undefined;
    setState((prev) => ({
      ...prev,
      devices: [...prev.devices, { id, type, meta }],
      selectedId: id
    }));
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

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const entry = await createUploadEntry(file);
      const next = [entry, ...uploads].slice(0, 12);
      setUploads(next);
      saveUploads(next);
      setSelectedUploadId(entry.id);
    } catch (error) {
      console.warn('Failed to add upload', error);
    } finally {
      event.target.value = '';
    }
  };

  const handleAssign = () => {
    if (!ftpEnabled || !selectedUploadId) {
      return;
    }
    const next = { ...deployments, [PREVIEW_SLOT_ID]: selectedUploadId };
    setDeployments(next);
    saveDeployments(next);
  };

  const toggleFtp = () => {
    if (!selected || selected.type !== 'pc') {
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
            ftpInstalled: !device.meta?.ftpInstalled
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
        return `FTPアプリ: ${selected.meta?.ftpInstalled ? 'インストール済み' : '未インストール'}`;
      case 'web':
        return '社内 WEB サーバの想定です。';
      case 'ftp':
        return 'FTP サーバの想定です。';
      case 'dns':
        return 'DNS サーバの想定です。';
      default:
        return '設定内容を準備しています。';
    }
  };

  const renderDevice = (device) => {
    const label = DEVICE_TYPES.find((item) => item.type === device.type)?.label || device.type;
    const isActive = device.id === state.selectedId;
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
          {label}
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
              {DEVICE_TYPES.map((item) => (
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
            <div className="monitor-status">WAN: {status.wan} / FTP: {status.ftp}</div>
            <div className="monitor-detail">{renderDetail()}</div>
            {selected?.type === 'pc' && (
              <button className="action-btn" type="button" onClick={toggleFtp}>
                {selected.meta?.ftpInstalled ? 'FTPアプリを外す' : 'FTPアプリを入れる'}
              </button>
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
                  <label className="action-btn file-btn">
                    ローカルから追加
                    <input
                      type="file"
                      accept=".html,.htm,.txt"
                      onChange={handleUpload}
                      disabled={!ftpEnabled}
                      hidden
                    />
                  </label>
                  <span className="preview-hint">
                    {ftpEnabled ? 'FTP接続OK: HTMLを追加できます。' : 'FTP接続がOKになると使用できます。'}
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
