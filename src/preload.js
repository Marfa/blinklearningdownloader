const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');
const fs = require('fs');

function readAppVersion() {
  const candidates = [path.join(__dirname, '..', 'package.json')];
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, 'app', 'package.json'),
      path.join(process.resourcesPath, 'package.json')
    );
  }
  for (const pkgPath of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) return String(pkg.version);
    } catch {
      /* try next */
    }
  }
  return '1.1.2';
}

function toMediaUrl(filePath) {
  const { pathToFileURL } = require('url');
  return pathToFileURL(filePath).href;
}

try {
  contextBridge.exposeInMainWorld('blinkAuth', {
    login: (payload) => ipcRenderer.invoke('auth:login', payload),
    getSettings: () => ipcRenderer.invoke('settings:get'),
    saveSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
    setLesson: (rawInput) => ipcRenderer.invoke('session:setLesson', rawInput),
    setExercise: (payload) => ipcRenderer.invoke('session:setExercise', payload),
    getSession: () => ipcRenderer.invoke('session:get'),
    listBooks: () => ipcRenderer.invoke('catalog:listBooks'),
    listChapters: (bookId) => ipcRenderer.invoke('catalog:listChapters', { bookId }),
    listExercises: (bookId, chapterId) =>
      ipcRenderer.invoke('catalog:listExercises', { bookId, chapterId }),
    logout: () => ipcRenderer.invoke('app:logout'),
    downloadAudio: (options) => ipcRenderer.invoke('audio:download', options),
    downloadAudioAuto: () => ipcRenderer.invoke('audio:downloadAuto'),
    previewAudio: (trackNumber) => ipcRenderer.invoke('audio:preview', { trackNumber }),
    toMediaUrl,
    onDownloadProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('audio:progress', listener);
      return () => ipcRenderer.removeListener('audio:progress', listener);
    },
    getVersion: () => readAppVersion(),
    checkForUpdate: () => ipcRenderer.invoke('app:checkForUpdate'),
    promptUpdate: () => ipcRenderer.invoke('app:promptUpdate'),
    onUpdateProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('app:updateProgress', listener);
      return () => ipcRenderer.removeListener('app:updateProgress', listener);
    },
    openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
    pickProxy: () => ipcRenderer.invoke('proxy:pick'),
    onProxyPickProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('proxy:progress', listener);
      return () => ipcRenderer.removeListener('proxy:progress', listener);
    },
  });
} catch (err) {
  console.error('[preload] failed to expose blinkAuth:', err);
}
