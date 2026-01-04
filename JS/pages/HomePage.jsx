import React, { useMemo, useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import AppShell from '../components/AppShell.jsx';
import { createId, loadState, saveState } from '../utils/storage.js';
import { syncHomeEdges } from '../utils/appStore.js';
import { buildHomeExplanation } from '../utils/pageExplanations.js';

const STORAGE_KEY = 'network:home:v1';

const DEVICE_TYPES = [
  { type: 'router', label: 'ルータ' },
  { type: 'pc', label: 'PC' },
  { type: 'phone', label: 'スマホ' },
  { type: 'tablet', label: 'タブレット' },
  { type: 'game', label: 'ゲーム機' }
];

const defaultState = {
  devices: [],
  selectedId: null
};

export default function HomePage() {
  const [state, setState] = useState(() => loadState(STORAGE_KEY, defaultState));
  const [cables, setCables] = useState([]);
  const stageRef = useRef(null);
  const onuRef = useRef(null);

  useEffect(() => {
    saveState(STORAGE_KEY, state);
  }, [state]);

  const types = useMemo(() => state.devices.map((device) => device.type), [state.devices]);
  const hasRouter = types.includes('router');
  const hasPc = types.includes('pc');
  const hasClient = types.some((type) => ['pc', 'phone', 'tablet', 'game'].includes(type));

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

  const explanation = useMemo(() => buildHomeExplanation({
    hasRouter,
    hasPc,
    hasClient,
    status
  }), [hasRouter, hasPc, hasClient, status]);

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
    setState((prev) => ({
      ...prev,
      devices: [...prev.devices, { id, type }],
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

  const renderDetail = () => {
    if (!selected) {
      return '機器をクリックすると設定内容を表示します。';
    }
    switch (selected.type) {
      case 'router':
        return `WAN: ${status.wan} / LAN: ${status.lan}`;
      case 'pc':
        return `ブラウザ接続: ${status.lan === 'OK' ? 'OK' : '未接続'}`;
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
              <p key={`home-explain-${index}`} className="explain-line">
                {line}
              </p>
            ))}
          </div>
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
          </div>
        </aside>
      </section>
    </AppShell>
  );
}
