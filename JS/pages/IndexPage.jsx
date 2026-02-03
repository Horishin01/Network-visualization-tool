import React, { useState } from 'react';
import AppShell from '../components/AppShell.jsx';
import homeShot from '../../home_headless.png';
import trainingShot from '../../training_headless.png';
import companyShot from '../../company_headless.png';

const slides = [
  {
    title: '自宅ネットワークを完成させる',
    body: 'ONU→ルータ→PC を配置し、ブラウザ接続が OK になることを確認します。',
    image: homeShot,
    alt: '自宅ネットワーク構成の画面'
  },
  {
    title: '接続できたら会社設定へ',
    body: '自宅でインターネット接続できたら、会社ページでサーバ用 PC を作り、WEB/FTP を入れます。',
    image: companyShot,
    alt: '会社ネットワーク構成の画面'
  },
  {
    title: '会社HPを自宅から確認',
    body: '会社構成が終わったら、自宅ページに戻り、設定した会社ドメインで会社HPにアクセスできるか確かめます。',
    image: trainingShot,
    alt: '会社HPを確認するための地図画面'
  }
];

const nextSteps = [
  {
    id: 'home',
    title: '自宅でインターネット接続',
    body: 'ONU→ルータ→PC の線を作り、ブラウザ接続を OK にします。',
    href: '/HTML/home.html',
    label: '自宅ページを開く'
  },
  {
    id: 'company',
    title: '会社ネットワークを設定',
    body: '自宅がつながったら会社ページでサーバ用 PC を作り、WEB/FTP サーバを入れます。',
    href: '/HTML/company.html',
    label: '会社ページへ'
  },
  {
    id: 'check',
    title: '会社HPを自宅から確認',
    body: '会社設定完了後、自宅ページに戻り、会社ドメインで会社HPにアクセスできるかをチェックします。',
    href: '/HTML/home.html',
    label: '自宅で確認する'
  }
];

export default function IndexPage() {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const isLast = current === slides.length - 1;

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
          {slide.image && (
            <figure className="slide-figure">
              <img className="slide-image" src={slide.image} alt={slide.alt || slide.title} loading="lazy" />
              <figcaption className="slide-caption">{slide.title}</figcaption>
            </figure>
          )}
          <h2 className="slide-title">{slide.title}</h2>
          <p className="slide-text">{slide.body}</p>
          {isLast && (
            <div className="slide-cta">
              <p className="slide-cta-text">では体験してみましょう。トレーニング地図から自宅→会社→ドメイン確認の順に進めてください。</p>
              <a className="slide-cta-btn" href="/HTML/training.html">トレーニングを始める</a>
            </div>
          )}
        </div>
        <div className="slide-indicator">{current + 1} / {slides.length}</div>
        <button className="slide-arrow left" type="button" onClick={handlePrev} aria-label="前のスライド">
          ◀
        </button>
        <button className="slide-arrow right" type="button" onClick={handleNext} aria-label="次のスライド">
          ▶
        </button>
      </section>

      <section className="next-steps">
        <div className="next-steps-head">
          <h3 className="next-steps-title">次の指示</h3>
          <p className="next-steps-lead">自宅での接続確認 → 会社設定 → 自宅からの到達確認までを順番に進めます。</p>
        </div>
        <ol className="next-steps-list">
          {nextSteps.map((item) => (
            <li key={item.id} className="next-step">
              <div className="next-step-title">{item.title}</div>
              <p className="next-step-body">{item.body}</p>
              <a className="next-step-link" href={item.href}>
                {item.label} →
              </a>
            </li>
          ))}
        </ol>
      </section>
    </AppShell>
  );
}
