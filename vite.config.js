import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

const terminalErrorLogger = () => {
  const hintRules = [
    {
      test: (message) => /before initialization/.test(message || ''),
      hint: 'Temporal Dead Zone: const/let を宣言前に参照しています。定義順やフック順を確認してください。'
    },
    {
      test: (message) => /Cannot read properties of (undefined|null)/.test(message || ''),
      hint: 'null/undefined にアクセスしています。localStorage や state の型・初期値を確認してください。'
    },
    {
      test: (message) => /Failed to fetch|NetworkError/.test(message || ''),
      hint: 'ネットワーク取得に失敗しています。dev server / URL / CORS を確認してください。'
    },
    {
      test: (message) => /Unexpected token/.test(message || ''),
      hint: '構文エラーまたは JSON パース失敗の可能性があります。該当行を確認してください。'
    }
  ];

  const buildHint = (message) => {
    const rule = hintRules.find((item) => item.test(message));
    return rule ? rule.hint : '';
  };

  const formatStack = (stack) => {
    if (!stack) return '';
    return stack.split('\n').map((line) => `  ${line}`).join('\n');
  };

  return {
    name: 'terminal-error-logger',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/__client_error__')) {
          return next();
        }
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method Not Allowed');
          return;
        }
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
          if (body.length > 200000) {
            body = body.slice(0, 200000);
          }
        });
        req.on('end', () => {
          let payload = {};
          try {
            payload = JSON.parse(body || '{}');
          } catch {
            payload = { message: body };
          }

          const lines = [];
          lines.push('');
          lines.push('=== CLIENT ERROR =================================');
          if (payload.time) lines.push(`time:    ${payload.time}`);
          if (payload.type) lines.push(`type:    ${payload.type}`);
          if (payload.name) lines.push(`name:    ${payload.name}`);
          if (payload.context?.page) lines.push(`page:    ${payload.context.page}`);
          if (payload.context?.title) lines.push(`title:   ${payload.context.title}`);
          if (payload.context?.url) lines.push(`url:     ${payload.context.url}`);
          if (payload.message) lines.push(`message: ${payload.message}`);
          if (payload.source) lines.push(`source:  ${payload.source}`);
          if (payload.line) lines.push(`loc:     ${payload.line}:${payload.column ?? ''}`);
          const hint = buildHint(payload.message);
          if (hint) lines.push(`cause:   ${hint}`);
          if (payload.stack) {
            lines.push('stack:');
            lines.push(formatStack(payload.stack));
          }
          lines.push('=================================================');
          console.error(lines.join('\n'));
          res.statusCode = 204;
          res.end();
        });
      });
    }
  };
};

export default defineConfig({
  plugins: [react(), terminalErrorLogger()],
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
        main: resolve(__dirname, 'index.html'),
        training: resolve(__dirname, 'HTML/training.html'),
        home: resolve(__dirname, 'HTML/home.html'),
        company: resolve(__dirname, 'HTML/company.html'),
        about: resolve(__dirname, 'HTML/about.html')
      }
    }
  }
});
