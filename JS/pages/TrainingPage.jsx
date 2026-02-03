import React, { useEffect, useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import * as L from 'leaflet';
import homeIcon from '../../img/icons/home.svg';
import companyIcon from '../../img/icons/company.svg';
import { AppStore } from '../utils/appStore.js';
import { buildTrainingGuide } from '../utils/trainingGuide.js';

const goTo = (path) => {
  window.location.href = path;
};

const HOME_ICON = L.icon({
  iconUrl: homeIcon,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -38],
  className: 'map-icon map-icon--home'
});

const COMPANY_ICON = L.icon({
  iconUrl: companyIcon,
  iconSize: [42, 42],
  iconAnchor: [21, 42],
  popupAnchor: [0, -38],
  className: 'map-icon map-icon--company'
});

export default function TrainingPage() {
  const [guide, setGuide] = useState(() => buildTrainingGuide(AppStore.get()));
  const [summary, setSummary] = useState(() => AppStore.readSummary());

  useEffect(() => {
    const mapElement = document.getElementById('map');
    if (!mapElement) {
      return undefined;
    }
    if (mapElement._leaflet_id) {
      mapElement._leaflet_id = null;
    }

    const INITIAL_Z = 5;
    const JAPAN_BOUNDS = L.latLngBounds([24.0, 122.0], [46.2, 146.0]);
    const map = L.map(mapElement, {
      minZoom: INITIAL_Z,
      maxZoom: 12,
      maxBounds: JAPAN_BOUNDS,
      maxBoundsViscosity: 1.0,
      doubleClickZoom: false
    }).setView([36.5, 137.0], INITIAL_Z);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    L.marker([35.6812, 139.7671], { title: '自宅', icon: HOME_ICON })
      .addTo(map)
      .bindTooltip('自宅', { direction: 'top', offset: [0, -8] })
      .on('click', () => goTo('/HTML/home.html'));

    L.marker([33.5902, 130.4017], { title: '会社', icon: COMPANY_ICON })
      .addTo(map)
      .bindTooltip('会社', { direction: 'top', offset: [0, -8] })
      .on('click', () => goTo('/HTML/company.html'));

    return () => {
      map.remove();
    };
  }, []);

  useEffect(() => {
    const update = () => {
      setGuide(buildTrainingGuide(AppStore.get()));
      setSummary(AppStore.readSummary());
    };
    update();

    const onStorage = () => update();
    window.addEventListener('storage', onStorage);
    window.addEventListener('appstore:updated', onStorage);

    let channel = null;
    if (window.BroadcastChannel) {
      channel = new BroadcastChannel('network-app');
      channel.addEventListener('message', onStorage);
    }

    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('appstore:updated', onStorage);
      if (channel) {
        channel.close();
      }
    };
  }, []);

  const ftpStep = guide.steps.find((step) => step.id === 'ftp');
  const ftpDone = ftpStep?.state === 'done';
  const nextCta = summary.homeOK
    ? {
        title: '次は会社設定に進む',
        body: '自宅でインターネット接続できたので、会社ネットワークの設定を始めましょう。',
        href: '/HTML/company.html',
        label: '会社ページを開く'
      }
    : {
        title: 'まず自宅ネットワークを完成',
        body: 'ONU→ルータ→PC を置き、ブラウザ接続を OK にしてから会社設定へ進みます。',
        href: '/HTML/home.html',
        label: '自宅ページを開く'
      };
  const domainNote = ftpDone
    ? '会社構成が終わったら、自宅ページで会社ドメインの HP を開けるか確認してみましょう。'
    : '会社設定と FTP 接続を完了したら、自宅ページで会社ドメインの HP を開けるかチェックします。';

  return (
    <AppShell active="training">
      <section className="training-grid">
        <aside className="panel">
          <h3 className="panel-title">チュートリアル（指示書）</h3>
          <ol className="panel-list">
            <li>自宅ネットワークを組み立て、ブラウザ接続を確認する。</li>
            <li>会社ネットワークを組み立て、PC をサーバ用に切り替えて構成を確認する。</li>
            <li>地図から拠点を選び、構成の違いを比較する。</li>
          </ol>
          <div className="progress-box">
            <div className="progress-title">進行度</div>
            <ul className="progress-list">
              {guide.steps.map((step) => (
                <li key={step.id} className="progress-row">
                  <span>{step.title}</span>
                  <span className={`progress-badge ${step.state}`}>{step.label}</span>
                </li>
              ))}
            </ul>
            <div className="next-task">次のタスク: {guide.summary.nextTask}</div>
          </div>
          <div className="next-hop">
            <div className="next-hop-title">{nextCta.title}</div>
            <p className="next-hop-body">{nextCta.body}</p>
            <div className="next-hop-actions">
              <a className="next-hop-btn primary" href={nextCta.href}>
                {nextCta.label}
              </a>
              <a className="next-hop-btn" href="/HTML/training.html">
                地図で位置を確認
              </a>
            </div>
            <p className="next-hop-note">{domainNote}</p>
          </div>
        </aside>

        <section className="map-box">
          <div className="map-title">日本地図</div>
          <div className="map-area">
            <div id="map" role="img" aria-label="日本地図（インタラクティブ）"></div>
          </div>
        </section>
      </section>

      <div className="training-note">
        <div className="note-title">解説</div>
        <div className="note-subtitle">{guide.explanation.title}</div>
        <div className="note-status">現在の状況: {guide.explanation.statusLabel}</div>
        <div className="note-body">
          {guide.explanation.lines.map((line, index) => (
            <p key={`${guide.explanation.id}-${index}`} className="note-line">
              {line}
            </p>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
