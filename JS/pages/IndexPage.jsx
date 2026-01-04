import React, { useState } from 'react';
import AppShell from '../components/AppShell.jsx';

const slides = [
  {
    title: 'ここで学ぶこと',
    body: '企業内ネットワークの基礎を、配線と機器の流れから理解します。'
  },
  {
    title: '自宅ネットワークの確認',
    body: 'ONU・ルータ・PC を配置し、WAN/LAN の役割を整理します。'
  },
  {
    title: '会社ネットワークの確認',
    body: '会社側の構成を作り、FTP や WEB の到達を確認します。'
  }
];

export default function IndexPage() {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];

  const handlePrev = () => {
    setCurrent((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleNext = () => {
    setCurrent((prev) => (prev + 1) % slides.length);
  };

  return (
    <AppShell active="home">
      <section className="slide-box">
        <div className="slide-content">
          <h2 className="slide-title">{slide.title}</h2>
          <p className="slide-text">{slide.body}</p>
        </div>
        <div className="slide-indicator">{current + 1} / {slides.length}</div>
        <button className="slide-arrow left" type="button" onClick={handlePrev} aria-label="前のスライド">
          ◀
        </button>
        <button className="slide-arrow right" type="button" onClick={handleNext} aria-label="次のスライド">
          ▶
        </button>
      </section>
    </AppShell>
  );
}
