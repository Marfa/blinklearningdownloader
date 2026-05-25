const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');

const GITHUB_REPO_URL = 'https://github.com/Marfa/blinklearningdownloader';
const GITHUB_RELEASES_URL = 'https://github.com/Marfa/blinklearningdownloader/releases';
const ALLOWED_EXTERNAL_URLS = new Set([GITHUB_REPO_URL, GITHUB_RELEASES_URL]);
const path = require('path');
const { authenticate } = require('./auth');
const { readSettings, saveSettings, clearAuthCredentials } = require('./settings');
const {
  setLessonInput,
  getSession,
  clearSession,
  getHttpClient,
} = require('./session');
const { resolveTrackNumbers, downloadTracks, prepareTrackPreview } = require('./audio');
const { t, getLocale } = require('./i18n');
const { getAppVersion } = require('./version');
const { checkForUpdate } = require('./update-check');

let mainWindow;

function resolveWindowIcon() {
  const candidates = [
    path.join(__dirname, '..', 'assets', 'icons', 'icon.png'),
    path.join(__dirname, '..', 'assets', 'icons', 'icon.ico'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return undefined;
}

function createWindow() {
  const windowOptions = {
    width: 440,
    height: 820,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: '#eeeeee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  };

  const iconPath = resolveWindowIcon();
  if (iconPath) windowOptions.icon = iconPath;

  mainWindow = new BrowserWindow(windowOptions);

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function sendDownloadProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('audio:progress', payload);
  }
}

function getDefaultDownloadDir() {
  const { settings } = readSettings();
  return settings.lastDownloadDir || app.getPath('downloads');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('settings:get', () => {
  const { settings, fileExists } = readSettings();
  return { settings, fileExists };
});

ipcMain.handle('settings:save', (_event, partial) => saveSettings(partial));

ipcMain.handle('session:setLesson', (_event, rawInput) => {
  const result = setLessonInput(rawInput);
  if (result.ok) {
    saveSettings({
      lessonId: result.lessonId,
      lessonInput: result.lessonInput,
    });
  }
  return result;
});

ipcMain.handle('session:get', () => getSession());

ipcMain.handle('audio:download', async (_event, options) => {
  const client = getHttpClient();
  const { lessonId } = getSession();

  const locale = getLocale();

  if (!client) {
    return { ok: false, message: t('main.loginRequired', locale) };
  }
  if (!lessonId) {
    return { ok: false, message: t('main.lessonRequired', locale) };
  }

  const tracksResult = resolveTrackNumbers(options);
  if (!tracksResult.ok) {
    return { ok: false, message: tracksResult.message };
  }

  const defaultPath = getDefaultDownloadDir();

  const folderResult = await dialog.showOpenDialog(mainWindow, {
    title: t('main.folderDialogTitle', locale),
    defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  });

  if (folderResult.canceled || !folderResult.filePaths?.length) {
    return { ok: false, canceled: true, message: t('main.folderNotChosen', locale) };
  }

  const destDir = folderResult.filePaths[0];
  saveSettings({ lastDownloadDir: destDir });

  sendDownloadProgress({
    phase: 'prepare',
    message: t('main.prepareDownload', locale),
    percent: 0,
  });

  try {
    const { settings } = readSettings();
    const result = await downloadTracks(
      client,
      lessonId,
      tracksResult.tracks,
      destDir,
      (progress) => sendDownloadProgress(progress),
      settings.proxy
    );

    return { ...result, destDir };
  } catch (err) {
    const message = err.message || t('main.downloadError', locale);
    sendDownloadProgress({ phase: 'error', message });
    return { ok: false, message, errors: [message] };
  }
});

ipcMain.handle('audio:preview', async (_event, { trackNumber }) => {
  const client = getHttpClient();
  const { lessonId } = getSession();
  const locale = getLocale();

  if (!client) {
    return { ok: false, message: t('main.loginRequired', locale) };
  }
  if (!lessonId) {
    return { ok: false, message: t('main.lessonRequired', locale) };
  }

  const track = Number(trackNumber);
  if (!Number.isFinite(track)) {
    return { ok: false, message: t('audio.numberRequired', locale) };
  }

  const { settings } = readSettings();

  try {
    const result = await prepareTrackPreview(
      client,
      lessonId,
      track,
      (progress) => sendDownloadProgress({ ...progress, preview: true }),
      settings.proxy
    );
    return result;
  } catch (err) {
    const message = err.message || t('main.previewError', locale);
    return { ok: false, message };
  }
});

ipcMain.handle('app:logout', async () => {
  clearAuthCredentials();
  clearSession();
  return { ok: true };
});

ipcMain.handle('app:getVersion', () => getAppVersion());

ipcMain.handle('app:checkForUpdate', () => checkForUpdate());

ipcMain.handle('app:openExternal', async (_event, url) => {
  if (ALLOWED_EXTERNAL_URLS.has(url)) {
    await shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('auth:login', async (_event, payload) => {
  try {
    const result = await authenticate(payload);
    return result;
  } catch (err) {
    return {
      success: false,
      message: err.message || t('auth.unknown', getLocale()),
    };
  }
});
