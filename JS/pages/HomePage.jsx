import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import AppShell from '../components/AppShell.jsx';
import { createId, loadState, saveState } from '../utils/storage.js';
import { syncHomeEdges } from '../utils/appStore.js';
import { buildHomeExplanation } from '../utils/pageExplanations.js';
import {
  FTP_DEPLOY_KEY,
  FTP_UPLOADS_KEY,
  PREVIEW_SLOT_ID,
  findUpload,
  loadDeployments,
  loadUploads
} from '../utils/ftpStore.js';

const STORAGE_KEY = 'network:home:v1';
const COMPANY_STATE_KEY = 'network:company:v1';

const normalizeCompanyDns = (raw) => {
  const domain = typeof raw?.dnsConfig?.domain === 'string' ? raw.dnsConfig.domain.trim() : '';
  const saved = !!raw?.dnsConfig?.savedAt && !!domain;
  return { domain, saved };
};

const DEVICE_TYPES = [
  { type: 'router', label: 'ルータ' },
  { type: 'pc', label: 'PC' },
  { type: 'phone', label: 'スマホ' },
  { type: 'tablet', label: 'タブレット' },
  { type: 'game', label: 'ゲーム機' }
];

const STEP_STATE_LABELS = {
  done: '完了',
  doing: '進行中',
  todo: '未着手'
};

const createDefaultRouterConfig = () => ({
  loginId: 'admin',
  loginPassword: 'admin',
  credentialsIssuedAt: null,
  wifi: {
    ssid: 'HOME-WIFI',
    key: 'home-12345678',
    encryption: 'WPA2'
  },
  wifiUpdatedAt: null
});

const createDefaultState = () => ({
  devices: [],
  selectedId: null,
  routerConfig: createDefaultRouterConfig()
});

const normalizeRouterConfig = (value) => {
  const base = value && typeof value === 'object' ? value : {};
  const wifi = base.wifi && typeof base.wifi === 'object' ? base.wifi : {};
  const ssid = typeof wifi.ssid === 'string' && wifi.ssid.trim() ? wifi.ssid : 'HOME-WIFI';
  const key = typeof wifi.key === 'string' && wifi.key.trim() ? wifi.key : 'home-12345678';
  const encryption = typeof wifi.encryption === 'string' && wifi.encryption.trim()
    ? wifi.encryption
    : 'WPA2';
  return {
    loginId: typeof base.loginId === 'string' && base.loginId.trim() ? base.loginId : 'admin',
    loginPassword: typeof base.loginPassword === 'string' && base.loginPassword.trim() ? base.loginPassword : 'admin',
    credentialsIssuedAt: typeof base.credentialsIssuedAt === 'string' ? base.credentialsIssuedAt : null,
    wifi: {
      ssid,
      key,
      encryption
    },
    wifiUpdatedAt: typeof base.wifiUpdatedAt === 'string' ? base.wifiUpdatedAt : null
  };
};

const normalizeHomeState = (value) => {
  if (!value || typeof value !== 'object') {
    return createDefaultState();
  }

  const rawDevices = Array.isArray(value.devices) ? value.devices : [];
  const devices = rawDevices
    .filter((device) => device && typeof device === 'object')
    .map((device) => {
      const type = typeof device.type === 'string' ? device.type : 'pc';
      return {
        id: typeof device.id === 'string' ? device.id : createId(type),
        type
      };
    });

  const selectedId = typeof value.selectedId === 'string' && devices.some((d) => d.id === value.selectedId)
    ? value.selectedId
    : (devices[0]?.id ?? null);

  return {
    devices,
    selectedId,
    routerConfig: normalizeRouterConfig(value.routerConfig)
  };
};

export default function HomePage() {
  const [state, setState] = useState(() =>
    normalizeHomeState(loadState(STORAGE_KEY, createDefaultState()))
  );
  const [cables, setCables] = useState([]);
  const [routerForm, setRouterForm] = useState(() => ({
    loginId: state.routerConfig.loginId,
    loginPassword: state.routerConfig.loginPassword,
    ssid: state.routerConfig.wifi.ssid,
    key: state.routerConfig.wifi.key,
    encryption: state.routerConfig.wifi.encryption
  }));
  const [pcView, setPcView] = useState({
    mode: 'desktop',
    url: '',
    input: 'http://192.168.1.1',
    error: ''
  });
  const [ftpUploads, setFtpUploads] = useState(() => loadUploads());
  const [ftpDeployments, setFtpDeployments] = useState(() => loadDeployments());
  const [companyDns, setCompanyDns] = useState(() =>
    normalizeCompanyDns(loadState(COMPANY_STATE_KEY, null))
  );
  const companyPreviewRef = useRef(null);
  const [companyPreviewUrl, setCompanyPreviewUrl] = useState('');
  const stageRef = useRef(null);
  const onuRef = useRef(null);

  useEffect(() => {
    setRouterForm({
      loginId: state.routerConfig.loginId,
      loginPassword: state.routerConfig.loginPassword,
      ssid: state.routerConfig.wifi.ssid,
      key: state.routerConfig.wifi.key,
      encryption: state.routerConfig.wifi.encryption
    });
  }, [state.routerConfig]);

  useEffect(() => {
    const syncFtp = () => {
      setFtpUploads(loadUploads());
      setFtpDeployments(loadDeployments());
    };
    const syncDns = () => setCompanyDns(normalizeCompanyDns(loadState(COMPANY_STATE_KEY, null)));
    syncFtp();
    syncDns();

    const onStorage = (event) => {
      if (event.key === FTP_UPLOADS_KEY || event.key === FTP_DEPLOY_KEY) {
        syncFtp();
      }
      if (event.key === COMPANY_STATE_KEY) {
        syncDns();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('ftp:updated', syncFtp);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('ftp:updated', syncFtp);
    };
  }, []);

  useEffect(() => {
    saveState(STORAGE_KEY, state);
  }, [state]);

  const types = useMemo(() => state.devices.map((device) => device.type), [state.devices]);
  const hasRouter = types.includes('router');
  const hasPc = types.includes('pc');
  const hasClient = types.some((type) => ['pc', 'phone', 'tablet', 'game'].includes(type));
  const activeUpload = useMemo(
    () => findUpload(ftpUploads, ftpDeployments[PREVIEW_SLOT_ID]),
    [ftpUploads, ftpDeployments]
  );

  const homeEdges = useMemo(() => ({
    fiberOnu: hasRouter,
    onuRouter: hasRouter,
    routerPc: hasPc
  }), [hasRouter, hasPc]);

  useEffect(() => {
    syncHomeEdges(homeEdges);
  }, [homeEdges]);

  const status = {
    wan: hasRouter ? 'OK' : '未接続',
    lan: hasRouter && hasClient ? 'OK' : '未接続'
  };
  const companyDomain = (companyDns.domain || '').toLowerCase();
  const companySiteReady = companyDns.saved && !!activeUpload;
  const companyPreviewReady = companySiteReady && !!companyPreviewUrl;
  const credentialsDone = !!state.routerConfig.credentialsIssuedAt;
  const wifiDone = !!state.routerConfig.wifiUpdatedAt;
  const routerTutorialDone = credentialsDone && wifiDone;

  const explanation = useMemo(() => buildHomeExplanation({
    hasRouter,
    hasPc,
    hasClient,
    status,
    credentialsDone,
    wifiDone,
    routerTutorialDone
  }), [hasRouter, hasPc, hasClient, status, credentialsDone, wifiDone, routerTutorialDone]);

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
    if (selected?.type === 'pc') {
      setPcView({
        mode: 'desktop',
        url: '',
        input: 'http://192.168.1.1',
        error: ''
      });
    }
  }, [selected?.id, selected?.type]);

  useEffect(() => {
    if (companyPreviewRef.current) {
      URL.revokeObjectURL(companyPreviewRef.current);
      companyPreviewRef.current = null;
    }
    if (!activeUpload) {
      setCompanyPreviewUrl('');
      return undefined;
    }
    const url = URL.createObjectURL(
      new Blob([activeUpload.content], { type: activeUpload.type || 'text/html' })
    );
    companyPreviewRef.current = url;
    setCompanyPreviewUrl(url);
    return () => {
      if (companyPreviewRef.current) {
        URL.revokeObjectURL(companyPreviewRef.current);
        companyPreviewRef.current = null;
      }
    };
  }, [activeUpload]);

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
      return {
        ...prev,
        devices: [...prev.devices, { id, type }],
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

  const handleSaveCredentials = () => {
    const loginId = routerForm.loginId.trim();
    const loginPassword = routerForm.loginPassword.trim();
    if (!loginId || !loginPassword) {
      return;
    }
    setState((prev) => ({
      ...prev,
      routerConfig: {
        ...prev.routerConfig,
        loginId,
        loginPassword,
        credentialsIssuedAt: new Date().toISOString()
      }
    }));
  };

  const handleSaveWifi = () => {
    const nextSsid = routerForm.ssid.trim();
    const nextKey = routerForm.key.trim();
    const nextEncryption = routerForm.encryption.trim();
    if (!nextSsid || !nextKey) {
      return;
    }
    setState((prev) => ({
      ...prev,
      routerConfig: {
        ...prev.routerConfig,
        wifi: {
          ssid: nextSsid,
          key: nextKey,
          encryption: nextEncryption || 'WPA2'
        },
        wifiUpdatedAt: new Date().toISOString()
      }
    }));
  };

  const canSaveCredentials = routerForm.loginId.trim().length > 0
    && routerForm.loginPassword.trim().length > 0;
  const credentialsChanged = routerForm.loginId.trim() !== state.routerConfig.loginId
    || routerForm.loginPassword.trim() !== state.routerConfig.loginPassword;
  const canSaveWifi = routerForm.ssid.trim().length > 0 && routerForm.key.trim().length >= 8;
  const wifiChanged = routerForm.ssid.trim() !== state.routerConfig.wifi.ssid
    || routerForm.key.trim() !== state.routerConfig.wifi.key
    || routerForm.encryption.trim() !== state.routerConfig.wifi.encryption;
  const renderDetail = () => {
    if (!selected) {
      return '機器をクリックすると設定内容を表示します。';
    }
    switch (selected.type) {
      case 'router':
        return `WAN: ${status.wan} / LAN: ${status.lan} / 認証: ${credentialsDone ? '設定済み' : '未設定'} / Wi-Fi: ${wifiDone ? '設定済み' : '未設定'}`;
      case 'pc':
        if (status.lan === 'OK') {
          const companyNote = companySiteReady
            ? ` / 会社HP: 「${companyDns.domain}」で確認可`
            : ' / 会社HP: 会社ページでドメイン設定とアップロードを完了してください';
          return `ブラウザ接続: OK${companyNote}`;
        }
        return 'ブラウザ接続: 未接続';
      case 'phone':
        return 'Wi-Fi 接続の確認端末です。';
      case 'tablet':
        return '複数端末接続の確認に使います。';
      case 'game':
        return '家庭内デバイスの例として配置します。';
      default:
        return '設定内容を準備しています。';
    }
  };

  const normalizeTargetUrl = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return '';
    }
    return trimmed.replace(/^https?:\/\//i, '').replace(/\/$/, '');
  };

  const handleNavigateUrl = () => {
    const targetInput = pcView.input;
    const target = normalizeTargetUrl(targetInput);
    const targetDomain = target.toLowerCase();
    if (target === '192.168.1.1') {
      setPcView((prev) => ({
        ...prev,
        mode: 'router',
        url: prev.input,
        error: ''
      }));
      return;
    }
    if (companyDomain && targetDomain === companyDomain) {
      if (!companyDns.saved) {
        setPcView((prev) => ({
          ...prev,
          mode: 'browser',
          url: prev.input,
          error: '会社でドメインを保存してください。'
        }));
        return;
      }
      if (status.wan !== 'OK' || status.lan !== 'OK') {
        setPcView((prev) => ({
          ...prev,
          mode: 'browser',
          url: prev.input,
          error: '自宅ネットワークが未接続です。配線とWi-Fi設定を確認してください。'
        }));
        return;
      }
      if (!activeUpload) {
        setPcView((prev) => ({
          ...prev,
          mode: 'browser',
          url: prev.input,
          error: '会社HPがまだアップロードされていません。会社ページで FTP アップロードしてください。'
        }));
        return;
      }
      if (!companyPreviewReady) {
        setPcView((prev) => ({
          ...prev,
          mode: 'browser',
          url: prev.input,
          error: '会社HPの読み込み準備中です。再度お試しください。'
        }));
        return;
      }
      setPcView((prev) => ({
        ...prev,
        mode: 'company',
        url: targetInput,
        error: ''
      }));
      return;
    }
    setPcView((prev) => ({
      ...prev,
      mode: 'browser',
      url: prev.input,
      error: '接続できませんでした。URL を確認してください。'
    }));
  };

  const renderPcSimulator = () => {
    if (!selected || selected.type !== 'pc') {
      return null;
    }
    const showRouterUI = pcView.mode === 'router';
    const showCompanyUI = pcView.mode === 'company';
    return (
      <div className="pc-simulator">
        <div className="pc-window">
          <div className="pc-window-titlebar">
            <span className="pc-window-title">Windows PC</span>
            <span className="pc-window-actions" aria-hidden="true">
              <span className="dot red" />
              <span className="dot yellow" />
              <span className="dot green" />
            </span>
          </div>
          {pcView.mode === 'desktop' && (
            <div className="pc-desktop">
              <div className="desktop-icons">
                <button
                  type="button"
                  className="desktop-icon"
                  onClick={() => setPcView((prev) => ({ ...prev, mode: 'browser', error: '', url: '' }))}
                >
                  <span className="icon-image" aria-hidden="true">🌐</span>
                  <span className="icon-label">検索エンジン</span>
                </button>
              </div>
            </div>
          )}
          {pcView.mode !== 'desktop' && (
            <div className="pc-browser">
              <div className="pc-window-toolbar">
                <span className="pc-toolbar-label">URL:</span>
                <input
                  className="pc-toolbar-input"
                  type="text"
                  value={pcView.input}
                  onChange={(event) => setPcView((prev) => ({
                    ...prev,
                    input: event.target.value
                  }))}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      handleNavigateUrl();
                    }
                  }}
                />
                <button
                  className="buffalo-action"
                  type="button"
                  onClick={handleNavigateUrl}
                >
                  移動
                </button>
              </div>
              {!showRouterUI && !showCompanyUI && (
                <div className="pc-browser-body">
                  {pcView.error ? (
                    <div className="pc-browser-error">{pcView.error}</div>
                  ) : (() => {
                    const online = status.wan === 'OK' && status.lan === 'OK';
                    if (online) {
                      return (
                        <div className="pc-browser-blank">
                          ようこそ！インターネットに接続されています。URL に 192.168.1.1 を入力して設定画面へ進みます。
                          {companySiteReady && (
                            <div className="pc-browser-hint">
                              会社HP確認: 「{companyDns.domain}」を入力すると会社HPを開けます。
                            </div>
                          )}
                        </div>
                      );
                    }
                    return (
                      <div className="pc-browser-error">
                        インターネットに接続できていません。配線とルータ設定を確認してください。
                      </div>
                    );
                  })()}
                </div>
              )}
              {showCompanyUI && (
                <div className="pc-browser-body">
                  {companyPreviewReady ? (
                    <iframe
                      className="pc-browser-iframe"
                      title="会社HPプレビュー (自宅から)"
                      src={companyPreviewUrl}
                    />
                  ) : (
                    <div className="pc-browser-error">
                      会社HPを読み込めませんでした。会社ページでアップロードとドメイン設定を確認してください。
                    </div>
                  )}
                </div>
              )}
              {showRouterUI && (
                <div className="buffalo-frame">
                  <div className="buffalo-header">
                    <div>
                      <div className="buffalo-title">AirHome ルータ設定センター</div>
                      <div className="buffalo-sub">家庭用ルータの設定をまとめて管理します</div>
                    </div>
                    <div className="buffalo-badges">
                      <span className={`buffalo-badge ${credentialsDone ? 'done' : 'todo'}`}>
                        管理者: {credentialsDone ? '変更済み' : '未変更'}
                      </span>
                      <span className={`buffalo-badge ${wifiDone ? 'done' : 'todo'}`}>
                        Wi-Fi: {wifiDone ? '設定済み' : '未設定'}
                      </span>
                    </div>
                  </div>
                  <div className="buffalo-body">
                    <div className="buffalo-section">
                      <div className="buffalo-section-head">
                        <div>
                          <div className="buffalo-section-title">管理者パスワード</div>
                          <div className="buffalo-section-sub">ルータへのログイン情報を変更します</div>
                        </div>
                        <span className={`buffalo-chip ${credentialsDone ? 'done' : 'todo'}`}>
                          {credentialsDone ? '完了' : '未完了'}
                        </span>
                      </div>
                      <div className="buffalo-grid">
                        <label className="buffalo-field">
                          <span>ログインID</span>
                          <input
                            type="text"
                            value={routerForm.loginId}
                            onChange={(event) => setRouterForm((prev) => ({
                              ...prev,
                              loginId: event.target.value
                            }))}
                          />
                        </label>
                        <label className="buffalo-field">
                          <span>パスワード</span>
                          <input
                            type="password"
                            value={routerForm.loginPassword}
                            onChange={(event) => setRouterForm((prev) => ({
                              ...prev,
                              loginPassword: event.target.value
                            }))}
                          />
                        </label>
                      </div>
                      <button
                        className="buffalo-action"
                        type="button"
                        onClick={handleSaveCredentials}
                        disabled={!canSaveCredentials || !credentialsChanged}
                      >
                        変更を保存
                      </button>
                    </div>

                    <div className="buffalo-section">
                      <div className="buffalo-section-head">
                        <div>
                          <div className="buffalo-section-title">無線LAN設定</div>
                          <div className="buffalo-section-sub">SSID と暗号化キーを設定します</div>
                        </div>
                        <span className={`buffalo-chip ${wifiDone ? 'done' : 'todo'}`}>
                          {wifiDone ? '完了' : '未完了'}
                        </span>
                      </div>
                      <div className="buffalo-grid">
                        <label className="buffalo-field">
                          <span>SSID</span>
                          <input
                            type="text"
                            value={routerForm.ssid}
                            onChange={(event) => setRouterForm((prev) => ({
                              ...prev,
                              ssid: event.target.value
                            }))}
                          />
                        </label>
                        <label className="buffalo-field">
                          <span>暗号化キー</span>
                          <input
                            type="password"
                            value={routerForm.key}
                            onChange={(event) => setRouterForm((prev) => ({
                              ...prev,
                              key: event.target.value
                            }))}
                            placeholder="8文字以上"
                          />
                        </label>
                        <label className="buffalo-field">
                          <span>暗号化方式</span>
                          <select
                            value={routerForm.encryption}
                            onChange={(event) => setRouterForm((prev) => ({
                              ...prev,
                              encryption: event.target.value
                            }))}
                          >
                            <option value="WPA2">WPA2</option>
                            <option value="WPA3">WPA3</option>
                            <option value="WPA2/WPA3">WPA2/WPA3</option>
                          </select>
                        </label>
                      </div>
                      <button
                        className="buffalo-action"
                        type="button"
                        onClick={handleSaveWifi}
                        disabled={!canSaveWifi || !wifiChanged}
                      >
                        変更を保存
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
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
          <div className="explain-body">
            {explanation.lines.map((line, index) => (
              <p key={`home-explain-${index}`} className="explain-line">
                {line}
              </p>
            ))}
          </div>
          <div className="explain-steps">
            <div className="explain-subtitle">進行ステップ</div>
            <ul className="step-list">
              {(explanation.steps || []).map((step) => (
                <li key={`home-step-${step.id}`} className="step-item">
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
          <div className="stage-title">自宅</div>
          <div className="house-frame" aria-hidden="true"></div>
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
            <div className="monitor-status">WAN: {status.wan} / LAN: {status.lan}</div>
            <div className="monitor-detail">{renderDetail()}</div>
            {renderPcSimulator()}
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
