const { contextBridge, ipcRenderer } = require('electron');

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
    onDownloadProgress: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on('audio:progress', listener);
      return () => ipcRenderer.removeListener('audio:progress', listener);
    },
    getVersion: () => ipcRenderer.invoke('app:getVersion'),
    checkForUpdate: () => ipcRenderer.invoke('app:checkForUpdate'),
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
