# Network Visualization Tool

Static HTML/CSS/JS pages for the network visualization training site. A Vite-based development server plus VS Code tasks/launch configs were added so the site can be previewed directly from VS Code.

## Prerequisites

- Python 3.8+ (for the lightweight server)
- Node.js 18+ (optional, for the Vite workflow; includes npm)
- Visual Studio Code

## Key features

1. **Company DNS monitor** – `HTML/company.html` で任意のドメインへ HTTPS アクセスを試行し、DNS / FW レベルの疎通可否をその場で表示。
2. **Training map with device detail** – `HTML/training.html` で地図マーカーをクリックすると PC/FW/社内セグメントの設定と妥当性を表示。外側/境界/内側の分離状況とインストールチェックリスト（VPN/FWポリシー等）で「実験としての価値」を示します。
3. **Home ↔ Company bridge view** – `HTML/sub.html` のリンクマップが AppStore の集計値を読み込み、家庭側・会社側の配線が完全か/通信可かを把握できます。
4. **HTML アップロード (FTP もどき)** – ブラウザ上で HTML ファイルを選ぶと `localStorage` に保存され、リストから即プレビュー＆ダウンロード可能。GitHub Pages 公開前のドラフト確認に利用できます。
5. **仮想ブラウザ** – 自宅 PC から会社 or アップロード済み HTML を参照したイメージを iframe 上で再現します。GitHub Pages 上でも同じ挙動になります。

## Quick start (Python http.server)

1. Install [Python 3](https://www.python.org/downloads/) if it is not available yet.
2. From the repository root, run:
   ```bash
   py -3 -m http.server 8080
   ```
   (Use `python -m http.server 8080` if `python` is mapped to your installed interpreter.)
3. Open `http://localhost:8080/index.html` in your browser.

## Optional: Vite dev server (Node.js)

Hot reload and bundling are still available via Vite when Node.js is installed.

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the dev server:
   ```bash
   npm run dev
   ```
   The site becomes available at `http://localhost:5173`.

## VS Code workflow

1. Open the repository folder in VS Code so that `.vscode/` is detected.
2. Run **Tasks: Run Task...** -> `python: serve (http://localhost:8080)` to start the lightweight Python server, or simply press **F5** and pick `Open site in Chrome` (or Edge). The debug profile runs the Python task in the background and opens the browser automatically.

## npm scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Start the Vite development server on `localhost:5173`. |
| `npm run dev:host` | Same as `dev` but binds to `0.0.0.0` for LAN testing. |
| `npm run build` | Create a production build in `dist/`. |
| `npm run preview` | Preview the contents of `dist/`. |

## Build output

`dist/` and `node_modules/` are ignored via `.gitignore`. Deploy the generated `dist/` folder to any static web server when you need a production snapshot.

## Deploying to GitHub Pages

1. Install dependencies and build the static bundle:
   ```bash
   npm install
   npm run build
   ```
2. Push the contents of `dist/` to the branch that GitHub Pages serves (for example, `gh-pages`).  
   Vite is configured to emit every HTML entry (root + `HTML/`) so the published site behaves exactly like the local environment.
