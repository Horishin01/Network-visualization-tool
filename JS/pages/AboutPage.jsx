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
        <ul className="about-list">
          <li>自宅と会社の構成を比べ、WAN/LAN の違いを理解する。</li>
          <li>機器パレットを使って構成を再現する。</li>
          <li>拠点ごとの流れを地図から確認する。</li>
        </ul>
      </section>
    </AppShell>
  );
}
