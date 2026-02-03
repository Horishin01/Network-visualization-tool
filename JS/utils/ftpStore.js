import { loadState, saveState, createId } from './storage.js';

export const FTP_UPLOADS_KEY = 'app:network:ftpUploads:v1';
export const FTP_DEPLOY_KEY = 'app:network:ftpDeploy:v1';
export const PREVIEW_SLOT_ID = 'company';

const broadcast = () => {
  try {
    window.dispatchEvent(new CustomEvent('ftp:updated', { detail: { at: Date.now() } }));
  } catch {
    // ignore
  }
};

export const loadUploads = () => {
  const data = loadState(FTP_UPLOADS_KEY, []);
  return Array.isArray(data) ? data : [];
};

export const saveUploads = (uploads) => {
  saveState(FTP_UPLOADS_KEY, uploads);
  broadcast();
};

export const loadDeployments = () => {
  const data = loadState(FTP_DEPLOY_KEY, {});
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    return data;
  }
  return {};
};

export const saveDeployments = (deployments) => {
  saveState(FTP_DEPLOY_KEY, deployments);
  broadcast();
};

export const findUpload = (uploads, id) => uploads.find((entry) => entry.id === id) || null;

const readFileText = async (file) => {
  if (typeof file.text === 'function') {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result || '');
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

export const createUploadEntry = async (file) => {
  const content = await readFileText(file);
  const id = (globalThis.crypto && typeof crypto.randomUUID === 'function')
    ? crypto.randomUUID()
    : createId('upload');
  return {
    id,
    name: file.name || 'upload.html',
    size: file.size || content.length,
    type: file.type || 'text/html',
    uploadedAt: new Date().toISOString(),
    content
  };
};
