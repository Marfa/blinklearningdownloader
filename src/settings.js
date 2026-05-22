const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_PROXY = {
  enabled: false,
  host: '',
  port: 0,
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function readSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const data = JSON.parse(raw);
    return { settings: normalizeSettings(data), fileExists: true };
  } catch {
    return { settings: defaultSettings(), fileExists: false };
  }
}

function defaultSettings() {
  return {
    proxy: { ...DEFAULT_PROXY },
    rememberLogin: false,
    credentials: null,
    lessonId: null,
    lessonInput: null,
    lastDownloadDir: null,
  };
}

function normalizeSettings(data) {
  const base = defaultSettings();
  return {
    proxy: {
      enabled: Boolean(data?.proxy?.enabled),
      host: String(data?.proxy?.host ?? base.proxy.host).trim(),
      port: Number(data?.proxy?.port) || 0,
    },
    rememberLogin: Boolean(data?.rememberLogin),
    credentials:
      data?.rememberLogin && data?.credentials?.username
        ? {
            username: String(data.credentials.username),
            password: String(data.credentials.password ?? ''),
          }
        : null,
    lessonId: data?.lessonId ? String(data.lessonId) : null,
    lessonInput: data?.lessonInput ? String(data.lessonInput) : null,
    lastDownloadDir: data?.lastDownloadDir ? String(data.lastDownloadDir) : null,
  };
}

function writeSettings(settings) {
  const dir = path.dirname(getSettingsPath());
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf8');
}

function saveSettings(partial) {
  const { settings: current } = readSettings();
  const next = { ...current, ...partial };

  if (partial.proxy) {
    next.proxy = { ...current.proxy, ...partial.proxy };
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'rememberLogin')) {
    next.rememberLogin = Boolean(partial.rememberLogin);
    if (!next.rememberLogin) {
      next.credentials = null;
    }
  }

  if (partial.credentials !== undefined) {
    next.credentials = partial.credentials;
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'lessonId')) {
    next.lessonId = partial.lessonId;
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'lessonInput')) {
    next.lessonInput = partial.lessonInput;
  }

  if (Object.prototype.hasOwnProperty.call(partial, 'lastDownloadDir')) {
    next.lastDownloadDir = partial.lastDownloadDir;
  }

  writeSettings(next);
  return next;
}

function clearAuthCredentials() {
  const { settings: current } = readSettings();
  current.rememberLogin = false;
  current.credentials = null;
  current.lessonId = null;
  current.lessonInput = null;
  writeSettings(current);
  return current;
}

module.exports = {
  readSettings,
  saveSettings,
  clearAuthCredentials,
  DEFAULT_PROXY,
};
