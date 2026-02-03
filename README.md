# Network Visualization Tool

PDF 仕様に合わせて React で再構成したネットワーク学習サイトです。`index`/`training`/`home`/`company`/`about` の各ページをマルチページ構成で実装しています。

## Requirements

- Node.js 18+
- npm
- インターネット接続（training の日本地図は OpenStreetMap タイルを使用）

## Development

1. 依存関係をインストール:
   ```bash
   npm install
   ```
2. 開発サーバー起動:
   ```bash
   npm run dev
   ```
3. ブラウザで `http://localhost:5173/index.html` を開く。

## Build

```bash
npm run build
```

`dist/` に出力されます。静的サーバーで配信する場合は `dist/` を対象にしてください。

## Project layout

- `index.html`
- `HTML/training.html`
- `HTML/home.html`
- `HTML/company.html`
- `HTML/about.html`
- `JS/` (React コンポーネントとエントリ)
- `CSS/` (共通/ページ別スタイル)
