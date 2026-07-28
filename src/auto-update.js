const { app, autoUpdater: nativeAutoUpdater, BrowserWindow } = require('electron');
const { autoUpdater } = require('electron-updater');

autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = false;
autoUpdater.autoRunAppAfterInstall = true;

const MAC_INSTALL_DELAY_MS = 5000;

let progressHandler = null;
let beforeInstallHook = null;

function setUpdateProgressHandler(handler) {
  progressHandler = handler;
}

function setBeforeInstallHook(hook) {
  beforeInstallHook = hook;
}

function notifyProgress(phase, extra = {}) {
  progressHandler?.({ phase, ...extra });
}

function prepareForInstall() {
  app.isQuitting = true;
  beforeInstallHook?.();
  for (const win of BrowserWindow.getAllWindows()) {
    if (win.isDestroyed()) continue;
    win.removeAllListeners('close');
    win.close();
  }
}

function scheduleInstall() {
  const run = () => {
    prepareForInstall();
    autoUpdater.quitAndInstall(false, true);
  };

  const delay = process.platform === 'darwin' ? MAC_INSTALL_DELAY_MS : 400;
  setTimeout(run, delay).unref?.();
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
      if (process.platform === 'darwin') {
        // Squirrel.Mac fetches the zip from electron-updater's local proxy; start early.
        nativeAutoUpdater.checkForUpdates();
      }
      finish({ ok: true, installing: true });
      scheduleInstall();
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
  setBeforeInstallHook,
  downloadAndInstall,
};
