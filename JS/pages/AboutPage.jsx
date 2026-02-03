import React from 'react';
import AppShell from '../components/AppShell.jsx';

export default function AboutPage() {
  return (
    <AppShell active="about">
      <section className="about-box">
        <h2>このサイトについて</h2>
        <p>
          本サイトは企業内ネットワーク構築・セキュリティ研修を想定し、
          配線や機器の役割を視覚的に学ぶことを目的としています。
        </p>
        <div className="about-grid">
          <section className="about-section">
            <h3>使用目的 / 想定用途</h3>
            <ul className="about-list">
              <li>自宅と会社の構成を比べ、WAN/LAN の違いを理解する。</li>
              <li>機器パレットを使って構成を再現する。</li>
              <li>拠点ごとの流れを地図から確認する。</li>
              <li>研修・学習用途を想定し、外部公開は行わない前提。</li>
            </ul>
          </section>

          <section className="about-section">
            <h3>技術仕様</h3>
            <dl className="about-dl">
              <dt>フロントエンド</dt>
              <dd>React 18 / Vite</dd>
              <dt>地図</dt>
              <dd>Leaflet + OpenStreetMap タイル</dd>
              <dt>保存</dt>
              <dd>localStorage（機器配置・進行状況）</dd>
              <dt>構成</dt>
              <dd>静的 HTML + React マルチページ</dd>
            </dl>
          </section>

          <section className="about-section">
            <h3>データと通信</h3>
            <ul className="about-list">
              <li>機器配置や進行状況はブラウザ内に保存されます。</li>
              <li>地図表示のため OpenStreetMap タイルへ通信します。</li>
              <li>それ以外の外部送信は行いません。</li>
            </ul>
          </section>

          <section className="about-section">
            <h3>ライセンス</h3>
            <ul className="about-list">
              <li>本プロジェクト: UNLICENSED</li>
              <li>React / React DOM: MIT</li>
              <li>Vite / @vitejs/plugin-react: MIT</li>
              <li>Leaflet: BSD-2-Clause</li>
              <li>OpenStreetMap データ: © OpenStreetMap contributors, ODbL</li>
            </ul>
            <p className="about-note">
              詳細は各ライブラリ・サービスの公式ライセンスに従ってください。
            </p>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
