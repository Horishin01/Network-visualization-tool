import React from 'react';
import { clearAllLocalData } from '../utils/debugTools.js';

const navItems = [
  { key: 'home', label: 'ホーム', href: '/index.html' },
  { key: 'training', label: 'トレーニング', href: '/HTML/training.html' },
  { key: 'about', label: 'このサイトについて', href: '/HTML/about.html' }
];

export default function AppShell({ active, children }) {
  const handleReset = () => {
    const ok = window.confirm('保存した機器配置やアップロードを削除して初期化します。よろしいですか？');
    if (!ok) {
      return;
    }
    clearAllLocalData();
    window.location.reload();
  };

  return (
    <div className="sheet">
      <header className="site-header">
        <div className="site-title">ネットワーク学習プロジェクト</div>
        <div className="header-actions">
          <nav aria-label="メイン">
            <ul className="nav-list">
              {navItems.map((item) => (
                <li key={item.key}>
                  <a
                    className={`nav-link${active === item.key ? ' active' : ''}`}
                    href={item.href}
                    aria-current={active === item.key ? 'page' : undefined}
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <button
            type="button"
            className="debug-btn"
            onClick={handleReset}
            title="保存データを削除して初期状態に戻します"
          >
            保存データ削除
          </button>
        </div>
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">&copy; 2025 ネットワーク学習プロジェクト</footer>
    </div>
  );
}
