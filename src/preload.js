const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('blinkAuth', {
  login: (payload) => ipcRenderer.invoke('auth:login', payload),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (partial) => ipcRenderer.invoke('settings:save', partial),
  setLesson: (rawInput) => ipcRenderer.invoke('session:setLesson', rawInput),
  getSession: () => ipcRenderer.invoke('session:get'),
  logout: () => ipcRenderer.invoke('app:logout'),
  downloadAudio: (options) => ipcRenderer.invoke('audio:download', options),
  onDownloadProgress: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on('audio:progress', listener);
    return () => ipcRenderer.removeListener('audio:progress', listener);
  },
});
