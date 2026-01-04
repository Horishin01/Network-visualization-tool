import React from 'react';

const navItems = [
  { key: 'home', label: 'ホーム', href: '/index.html' },
  { key: 'training', label: 'トレーニング', href: '/HTML/training.html' },
  { key: 'about', label: 'このサイトについて', href: '/HTML/about.html' }
];

export default function AppShell({ active, children }) {
  return (
    <div className="sheet">
      <header className="site-header">
        <div className="site-title">ネットワーク学習プロジェクト</div>
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
      </header>
      <main className="site-main">{children}</main>
      <footer className="site-footer">&copy; 2025 ネットワーク学習プロジェクト</footer>
    </div>
  );
}
