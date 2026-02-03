const STORE_KEY = 'app:network:saves:default';
const STORE_VERSION = 1;
const BC_NAME = 'network-app';

const DEFAULT_STATE = Object.freeze({
  v: STORE_VERSION,
  updatedAt: new Date(0).toISOString(),
  home: {
    edges: { fiberOnu: false, onuRouter: false, routerPc: false },
    reach: { internet: false, count: 0 }
  },
  company: {
    edges: {},
    reach: { internet: false, count: 0 },
    status: {}
  },
  summary: { homeOK: false, companyOK: false }
});

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowISO = () => new Date().toISOString();

const broadcast = () => {
  try {
    const ch = new BroadcastChannel(BC_NAME);
    ch.postMessage({ type: 'store-updated', at: Date.now() });
    ch.close();
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new CustomEvent('appstore:updated', { detail: { at: Date.now() } }));
  } catch {
    // ignore
  }
};

const ensureRoot = () => {
  let parsed = null;
  try {
    parsed = JSON.parse(localStorage.getItem(STORE_KEY));
  } catch {
    parsed = null;
  }

  if (!parsed) {
    const init = clone(DEFAULT_STATE);
    init.v = STORE_VERSION;
    init.updatedAt = nowISO();
    localStorage.setItem(STORE_KEY, JSON.stringify(init));
    broadcast();
    return init;
  }

  let patched = false;
  if (typeof parsed.v !== 'number' || parsed.v !== STORE_VERSION) {
    parsed.v = STORE_VERSION;
    patched = true;
  }
  if (!parsed.home) {
    parsed.home = clone(DEFAULT_STATE.home);
    patched = true;
  }
  if (!parsed.company) {
    parsed.company = clone(DEFAULT_STATE.company);
    patched = true;
  }
  if (!parsed.summary) {
    parsed.summary = clone(DEFAULT_STATE.summary);
    patched = true;
  }

  if (patched) {
    parsed.updatedAt = nowISO();
    localStorage.setItem(STORE_KEY, JSON.stringify(parsed));
    broadcast();
  }

  return parsed;
};

const writeStore = (next) => {
  const payload = clone(next);
  payload.v = STORE_VERSION;
  payload.updatedAt = nowISO();
  localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  broadcast();
  return payload;
};

export const AppStore = {
  get() {
    return clone(ensureRoot());
  },
  set(obj) {
    return clone(writeStore(obj));
  },
  patch(mutator) {
    const base = ensureRoot();
    const draft = clone(base);
    const ret = typeof mutator === 'function' ? mutator(draft) : undefined;
    const next = ret && typeof ret === 'object' ? ret : draft;
    return clone(writeStore(next));
  },
  readSummary() {
    const state = ensureRoot();
    return {
      homeOK: !!state.summary?.homeOK,
      companyOK: !!state.summary?.companyOK
    };
  }
};

export const syncHomeEdges = (edges) => {
  if (!edges) {
    return;
  }
  const clean = {
    fiberOnu: !!edges.fiberOnu,
    onuRouter: !!edges.onuRouter,
    routerPc: !!edges.routerPc
  };
  const ok = clean.fiberOnu && clean.onuRouter && clean.routerPc;
  const count = (clean.fiberOnu ? 1 : 0) + (clean.onuRouter ? 1 : 0) + (clean.routerPc ? 1 : 0);

  AppStore.patch((draft) => {
    draft.home = draft.home || {};
    draft.home.edges = clean;
    draft.home.reach = { internet: ok, count };
    draft.summary = draft.summary || {};
    draft.summary.homeOK = ok;
  });
};

export const syncCompanyEdges = (edges, options = {}) => {
  if (!edges) {
    return;
  }
  const clean = {
    fiberOnu: !!edges.fiberOnu,
    onuRouter: !!edges.onuRouter,
    routerPc: !!edges.routerPc,
    routerFtp: !!edges.routerFtp
  };
  const ok = clean.fiberOnu && clean.onuRouter && clean.routerPc;
  const ftpOK = clean.fiberOnu && clean.onuRouter && clean.routerFtp;
  const count = (clean.fiberOnu ? 1 : 0) + (clean.onuRouter ? 1 : 0) + (clean.routerPc ? 1 : 0);

  try {
    localStorage.setItem('company:lastEdges', JSON.stringify(clean));
  } catch {
    // ignore
  }

  AppStore.patch((draft) => {
    draft.company = draft.company || {};
    draft.company.edges = clean;
    draft.company.reach = { internet: ok, count };
    draft.company.status = Object.assign({}, draft.company.status, {
      fiberLink: clean.fiberOnu,
      routerWanLink: clean.onuRouter,
      webReachable: clean.routerPc,
      ftpReachable: ftpOK,
      lanClients: options.lanClients ?? 0
    });
    draft.summary = draft.summary || {};
    draft.summary.companyOK = ok;
  });
};
