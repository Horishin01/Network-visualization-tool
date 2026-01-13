import { AppStore } from './appStore.js';
import { FTP_UPLOADS_KEY, FTP_DEPLOY_KEY } from './ftpStore.js';

const HOME_STORAGE_KEY = 'network:home:v1';
const COMPANY_STORAGE_KEY = 'network:company:v1';
const APP_STORE_KEY = 'app:network:saves:default';
const COMPANY_EDGES_KEY = 'company:lastEdges';

const safeRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

export const clearAllLocalData = () => {
  [
    HOME_STORAGE_KEY,
    COMPANY_STORAGE_KEY,
    APP_STORE_KEY,
    FTP_UPLOADS_KEY,
    FTP_DEPLOY_KEY,
    COMPANY_EDGES_KEY
  ].forEach((key) => safeRemove(key));

  // Re-seed AppStore to emit update events for connected views.
  AppStore.get();

  try {
    window.dispatchEvent(new CustomEvent('ftp:updated', { detail: { at: Date.now() } }));
  } catch {
    // ignore
  }
};
