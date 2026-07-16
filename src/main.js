const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const fs = require('fs');

const GITHUB_REPO_URL = 'https://github.com/Marfa/blinklearningdownloader';
const GITHUB_RELEASES_URL = 'https://github.com/Marfa/blinklearningdownloader/releases';
const DONATE_URL = 'https://www.donationalerts.com/r/themarfa';
const DONATE_CRYPTO_URL = 'https://nowpayments.io/donation/themarfa';
const PROXY_AD_URL = 'https://proxys.world/?refid=41873';
const ALLOWED_EXTERNAL_URLS = new Set([
  GITHUB_REPO_URL,
  GITHUB_RELEASES_URL,
  DONATE_URL,
  DONATE_CRYPTO_URL,
  PROXY_AD_URL,
]);
const path = require('path');
const { authenticate } = require('./auth');
const { readSettings, saveSettings, clearAuthCredentials } = require('./settings');
const {
  setLessonInput,
  setExerciseSelection,
  getSession,
  clearSession,
  getHttpClient,
} = require('./session');
const {
  resolveTrackNumbers,
  downloadTracks,
  downloadDiscoveredTracks,
  prepareTrackPreview,
} = require('./audio');
const {
  listBooks,
  listChapters,
  listExercises,
  destroyCatalogWindow,
} = require('./blink-catalog');
const { t, getLocale } = require('./i18n');
const { getAppVersion } = require('./version');
const { checkForUpdate } = require('./update-check');
const { pickWorkingSocks5Proxy } = require('./proxy-picker');
const {
  initAutoUpdater,
  setUpdateProgressHandler,
  downloadAndInstall,
} = require('./auto-update');

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
    height: 880,
    minWidth: 440,
    maxWidth: 440,
    minHeight: 880,
    maxHeight: 880,
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

  // Hidden catalog BrowserWindow must be torn down with the UI, otherwise
  // window-all-closed never fires and Electron stays resident after close.
  mainWindow.on('closed', () => {
    destroyCatalogWindow();
    mainWindow = null;
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

function sendDownloadProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('audio:progress', payload);
  }
}

function sendUpdateProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('app:updateProgress', payload);
  }
}

function sendProxyPickProgress(payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('proxy:progress', payload);
  }
}

function getDefaultDownloadDir() {
  const { settings } = readSettings();
  return settings.lastDownloadDir || app.getPath('downloads');
}

app.whenReady().then(() => {
  initAutoUpdater();
  setUpdateProgressHandler(sendUpdateProgress);
  createWindow();
});

app.on('before-quit', () => {
  destroyCatalogWindow();
});

app.on('window-all-closed', () => {
  destroyCatalogWindow();
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

ipcMain.handle('session:setExercise', (_event, payload) => {
  const result = setExerciseSelection(payload);
  if (result.ok) {
    saveSettings({
      lessonId: result.lessonId,
      lessonInput: result.exerciseUrl || result.lessonId,
    });
  }
  return result;
});

ipcMain.handle('session:get', () => getSession());

ipcMain.handle('catalog:listBooks', async () => {
  const locale = getLocale();
  if (!getHttpClient()) {
    return { ok: false, message: t('main.loginRequired', locale) };
  }
  const { settings } = readSettings();
  if (settings.proxy?.enabled && (!settings.proxy.host || !settings.proxy.port)) {
    return { ok: false, message: t('renderer.proxyRequired', locale) };
  }
  try {
    const books = await listBooks();
    return { ok: true, books };
  } catch (err) {
    const message = mapCatalogError(err, locale);
    if (String(err?.message || '').includes('Failed to fetch')) {
      return {
        ok: false,
        message: t('auth.networkError', locale, {
          detail: err.message,
          proxyHint: settings.proxy?.enabled ? '' : t('auth.networkErrorProxyHint', locale),
        }),
      };
    }
    return { ok: false, message };
  }
});

function mapCatalogError(err, locale) {
  const code = err?.message || '';
  if (
    code === 'CATALOG_BLINK_TIMEOUT' ||
    code === 'CATALOG_BLINK_LOAD_FAILED' ||
    code === 'CATALOG_SCRIPT_TIMEOUT'
  ) {
    return t('catalog.timeout', locale);
  }
  if (code === 'CATALOG_SESSION_EXPIRED') return t('catalog.sessionExpired', locale);
  if (code === 'CATALOG_NOT_AUTHENTICATED') return t('main.loginRequired', locale);
  if (code === 'CATALOG_USER_ID') return t('catalog.userIdFailed', locale);
  if (code === 'CATALOG_CHAPTERS_EMPTY') return t('catalog.loadChaptersFailed', locale);
  if (code === 'CATALOG_EXERCISES_EMPTY') return t('catalog.loadExercisesFailed', locale);
  if (code === 'CATALOG_GETBOOK_FAILED' || code === 'CATALOG_MYBOOKS_FAILED') {
    return t('catalog.loadBooksFailed', locale);
  }
  return err?.message || t('catalog.loadBooksFailed', locale);
}

ipcMain.handle('catalog:listChapters', async (_event, { bookId }) => {
  const locale = getLocale();
  if (!getHttpClient()) {
    return { ok: false, message: t('main.loginRequired', locale) };
  }
  try {
    const chapters = await listChapters(bookId);
    return { ok: true, chapters };
  } catch (err) {
    return {
      ok: false,
      message: mapCatalogError(err, locale),
    };
  }
});

ipcMain.handle('catalog:listExercises', async (_event, { bookId, chapterId }) => {
  const locale = getLocale();
  if (!getHttpClient()) {
    return { ok: false, message: t('main.loginRequired', locale) };
  }
  try {
    const exercises = await listExercises(bookId, chapterId);
    return { ok: true, exercises };
  } catch (err) {
    return {
      ok: false,
      message: mapCatalogError(err, locale),
    };
  }
});

ipcMain.handle('audio:downloadAuto', async () => {
  const client = getHttpClient();
  const { lessonId } = getSession();
  const locale = getLocale();

  if (!client) {
    return { ok: false, message: t('main.loginRequired', locale) };
  }
  if (!lessonId) {
    return { ok: false, message: t('main.lessonRequired', locale) };
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
    message: t('audio.discoverStart', locale),
    percent: 0,
  });

  try {
    const { settings } = readSettings();
    const result = await downloadDiscoveredTracks(
      client,
      lessonId,
      destDir,
      (progress) => sendDownloadProgress(progress),
      settings.proxy,
      100
    );
    return { ...result, destDir };
  } catch (err) {
    const message = err.message || t('main.downloadError', locale);
    sendDownloadProgress({ phase: 'error', message });
    return { ok: false, message, errors: [message] };
  }
});

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
  destroyCatalogWindow();
  clearAuthCredentials();
  clearSession();
  return { ok: true };
});

ipcMain.handle('app:getVersion', () => getAppVersion());

ipcMain.handle('app:checkForUpdate', () => checkForUpdate());

ipcMain.handle('app:promptUpdate', async () => {
  const locale = getLocale();
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: [t('update.yes', locale), t('update.no', locale)],
    defaultId: 0,
    cancelId: 1,
    noLink: true,
    title: t('update.promptTitle', locale),
    message: t('update.promptMessage', locale),
  });

  if (response !== 0) {
    return { ok: false, cancelled: true };
  }

  const result = await downloadAndInstall();
  if (result.ok) {
    return { ok: true, installing: true };
  }

  if (result.reason === 'notPackaged') {
    return { ok: false, message: t('update.notPackaged', locale) };
  }
  if (result.reason === 'none') {
    return { ok: false, message: t('update.none', locale) };
  }
  return { ok: false, message: result.message || t('update.failed', locale) };
});

ipcMain.handle('app:openExternal', async (_event, url) => {
  if (ALLOWED_EXTERNAL_URLS.has(url)) {
    await shell.openExternal(url);
    return { ok: true };
  }
  return { ok: false };
});

ipcMain.handle('proxy:pick', async () => {
  const locale = getLocale();

  try {
    const proxy = await pickWorkingSocks5Proxy({
      onProgress: (progress) => sendProxyPickProgress(progress),
    });

    if (!proxy) {
      return { ok: false, message: t('proxy.pickFailed', locale) };
    }

    return { ok: true, proxy };
  } catch (err) {
    const code = err.message;
    if (code === 'PROXY_LIST_BLOCKED') {
      return { ok: false, message: t('proxy.pickListBlocked', locale) };
    }
    if (code === 'PROXY_LIST_EMPTY') {
      return { ok: false, message: t('proxy.pickListEmpty', locale) };
    }
    if (code === 'PROXY_LIST_FETCH_FAILED') {
      return { ok: false, message: t('proxy.pickListFailed', locale) };
    }
    return {
      ok: false,
      message: err.message || t('proxy.pickFailed', locale),
    };
  }
});

ipcMain.handle('auth:login', async (_event, payload) => {
  destroyCatalogWindow();
  try {
    const result = await authenticate(payload);
    if (result?.success) {
      destroyCatalogWindow();
    }
    return result;
  } catch (err) {
    return {
      success: false,
      message: err.message || t('auth.unknown', getLocale()),
    };
  }
});
