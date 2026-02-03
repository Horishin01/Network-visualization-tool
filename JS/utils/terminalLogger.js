const isDev = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV;
const root = typeof window !== 'undefined' ? window : null;

const safeStringify = (value) => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};

const buildContext = () => ({
  url: window.location.href,
  page: window.location.pathname,
  title: document.title,
  userAgent: navigator.userAgent
});

if (root && isDev && !root.__terminalLoggerInstalled) {
  root.__terminalLoggerInstalled = true;

  const endpoint = '/__client_error__';
  const recent = new Map();
  const maxRecent = 20;
  const ttlMs = 4000;

  const shouldSend = (payload) => {
    const key = [
      payload.type,
      payload.name,
      payload.message,
      payload.source,
      payload.line,
      payload.column
    ].filter(Boolean).join('|');
    const now = Date.now();
    const last = recent.get(key);
    if (last && now - last < ttlMs) {
      return false;
    }
    recent.set(key, now);
    if (recent.size > maxRecent) {
      const [first] = recent.keys();
      if (first) {
        recent.delete(first);
      }
    }
    return true;
  };

  const sendPayload = (payload) => {
    if (!shouldSend(payload)) {
      return;
    }
    try {
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: 'application/json' });
        navigator.sendBeacon(endpoint, blob);
        return;
      }
      fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true
      }).catch(() => {});
    } catch {
      // ignore
    }
  };

  window.addEventListener('error', (event) => {
    sendPayload({
      type: 'error',
      name: event.error?.name || 'Error',
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
      time: new Date().toISOString(),
      context: buildContext()
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason instanceof Error
      ? reason.message
      : typeof reason === 'string'
        ? reason
        : safeStringify(reason);
    sendPayload({
      type: 'unhandledrejection',
      name: reason?.name || 'UnhandledRejection',
      message,
      stack: reason?.stack || '',
      time: new Date().toISOString(),
      context: buildContext()
    });
  });
}
