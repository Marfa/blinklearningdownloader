const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { authenticate } = require('./auth');
const { readSettings, saveSettings, clearAuthCredentials } = require('./settings');
const {
  setLessonInput,
  getSession,
  clearSession,
  getHttpClient,
} = require('./session');
const { resolveTrackNumbers, downloadTracks } = require('./audio');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 440,
    height: 820,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

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

  if (!client) {
    return { ok: false, message: 'Сначала выполните вход.' };
  }
  if (!lessonId) {
    return { ok: false, message: 'Не указан ID урока.' };
  }

  const tracksResult = resolveTrackNumbers(options);
  if (!tracksResult.ok) {
    return { ok: false, message: tracksResult.message };
  }

  const defaultPath = getDefaultDownloadDir();

  const folderResult = await dialog.showOpenDialog(mainWindow, {
    title: 'Папка для сохранения аудио',
    defaultPath,
    properties: ['openDirectory', 'createDirectory'],
  });

  if (folderResult.canceled || !folderResult.filePaths?.length) {
    return { ok: false, canceled: true, message: 'Папка не выбрана.' };
  }

  const destDir = folderResult.filePaths[0];
  saveSettings({ lastDownloadDir: destDir });

  sendDownloadProgress({
    phase: 'prepare',
    message: 'Подготовка к скачиванию…',
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
    const message = err.message || 'Ошибка при скачивании аудио.';
    sendDownloadProgress({ phase: 'error', message });
    return { ok: false, message, errors: [message] };
  }
});

ipcMain.handle('app:logout', async () => {
  clearAuthCredentials();
  clearSession();
  return { ok: true };
});

ipcMain.handle('auth:login', async (_event, payload) => {
  try {
    const result = await authenticate(payload);
    return result;
  } catch (err) {
    return {
      success: false,
      message: err.message || 'Неизвестная ошибка авторизации.',
    };
  }
});
