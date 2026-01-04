import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync } from 'fs';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));
const htmlDir = resolve(projectRoot, 'HTML');

// Automatically include every HTML file inside /HTML as its own Rollup entry.
const secondaryHtmlEntries = {};
try {
  for (const entry of readdirSync(htmlDir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith('.html')) {
      const key = entry.name.replace(/\.html$/, '');
      secondaryHtmlEntries[key] = resolve(htmlDir, entry.name);
    }
  }
} catch {
  // Folder is optional, so ignore failures (keeps dev server working even if /HTML is missing).
}

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5173,
    open: '/index.html'
  },
  preview: {
    host: '127.0.0.1',
    port: 4173,
    open: '/index.html'
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(projectRoot, 'index.html'),
        ...secondaryHtmlEntries
      }
    }
  }
});
