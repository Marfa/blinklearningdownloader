const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.autoRunAppAfterInstall = true;

let progressHandler = null;

function setUpdateProgressHandler(handler) {
  progressHandler = handler;
}

function notifyProgress(phase, extra = {}) {
  progressHandler?.({ phase, ...extra });
}

function initAutoUpdater() {
  autoUpdater.on('download-progress', (progress) => {
    notifyProgress('downloading', { percent: Math.round(progress.percent || 0) });
  });
}

function downloadAndInstall() {
  return new Promise((resolve) => {
    if (!app.isPackaged) {
      resolve({ ok: false, reason: 'notPackaged' });
      return;
    }

    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };

    const onAvailable = () => {
      notifyProgress('downloading');
      autoUpdater.downloadUpdate().catch((err) => {
        finish({ ok: false, reason: 'error', message: err?.message });
      });
    };

    const onNotAvailable = () => {
      finish({ ok: false, reason: 'none' });
    };

    const onError = (err) => {
      finish({ ok: false, reason: 'error', message: err?.message });
    };

    const onDownloaded = () => {
      notifyProgress('installing');
      finish({ ok: true, installing: true });
      setTimeout(() => autoUpdater.quitAndInstall(false, true), 400);
    };

    const cleanup = () => {
      autoUpdater.removeListener('update-available', onAvailable);
      autoUpdater.removeListener('update-not-available', onNotAvailable);
      autoUpdater.removeListener('error', onError);
      autoUpdater.removeListener('update-downloaded', onDownloaded);
    };

    autoUpdater.on('update-available', onAvailable);
    autoUpdater.on('update-not-available', onNotAvailable);
    autoUpdater.on('error', onError);
    autoUpdater.on('update-downloaded', onDownloaded);

    notifyProgress('checking');
    autoUpdater.checkForUpdates().catch((err) => {
      finish({ ok: false, reason: 'error', message: err?.message });
    });
  });
}

module.exports = {
  initAutoUpdater,
  setUpdateProgressHandler,
  downloadAndInstall,
};
