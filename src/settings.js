const fs = require('fs');
const path = require('path');
const { app, safeStorage } = require('electron');
const { isValidProxyHost, isValidProxyPort } = require('./proxy-host');

const ENC_PREFIX = 'enc:v1:';
const MAX_USERNAME_LEN = 256;
const MAX_PASSWORD_LEN = 512;

const DEFAULT_PROXY = {
  enabled: false,
  host: '',
  port: 0,
  untrustedPublic: false,
};

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

function canEncryptSecrets() {
  try {
    return Boolean(safeStorage?.isEncryptionAvailable?.());
  } catch {
    return false;
  }
}

function encryptPassword(plain) {
  const value = String(plain ?? '');
  if (!value) return '';
  if (!canEncryptSecrets()) {
    throw new Error('ENCRYPTION_UNAVAILABLE');
  }
  const encrypted = safeStorage.encryptString(value);
  return ENC_PREFIX + Buffer.from(encrypted).toString('base64');
}

function decryptPassword(stored) {
  const value = String(stored ?? '');
  if (!value) return '';
  if (!value.startsWith(ENC_PREFIX)) {
    return value;
  }
  if (!canEncryptSecrets()) return '';
  const buf = Buffer.from(value.slice(ENC_PREFIX.length), 'base64');
  return safeStorage.decryptString(buf);
}

function isEncryptedPassword(stored) {
  return String(stored ?? '').startsWith(ENC_PREFIX);
}

function readSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const data = JSON.parse(raw);
    const settings = maybeMigratePlaintextCredentials(normalizeSettings(data));
    return { settings, fileExists: true };
  } catch {
    return { settings: defaultSettings(), fileExists: false };
  }
}

function maybeMigratePlaintextCredentials(settings) {
  if (!settings.credentials?.password || isEncryptedPassword(settings.credentials.password)) {
    return settings;
  }
  try {
    const next = {
      ...settings,
      credentials: persistCredentials(
        settings.credentials.username,
        settings.credentials.password,
        null
      ),
    };
    if (!next.credentials) {
      next.rememberLogin = false;
    }
    writeSettings(next);
    return next;
  } catch {
    return {
      ...settings,
      rememberLogin: false,
      credentials: null,
    };
  }
}

function defaultSettings() {
  return {
    locale: 'ru',
    proxy: { ...DEFAULT_PROXY },
    rememberLogin: false,
    credentials: null,
    lessonId: null,
    lessonInput: null,
    lastDownloadDir: null,
  };
}

function normalizeProxy(data) {
  const host = String(data?.host ?? DEFAULT_PROXY.host).trim();
  const port = Number(data?.port) || 0;
  const enabled = Boolean(data?.enabled);
  const untrustedPublic = Boolean(data?.untrustedPublic);

  if (enabled && host && !isValidProxyHost(host)) {
    return { ...DEFAULT_PROXY };
  }
  if (enabled && port && !isValidProxyPort(port)) {
    return { ...DEFAULT_PROXY, host: isValidProxyHost(host) ? host : '', enabled: false };
  }

  return {
    enabled,
    host: isValidProxyHost(host) ? host : '',
    port: isValidProxyPort(port) ? port : 0,
    untrustedPublic: enabled ? untrustedPublic : false,
  };
}

function normalizeCredentials(data, rememberLogin) {
  if (!rememberLogin || !data?.credentials?.username) return null;
  return {
    username: String(data.credentials.username).slice(0, MAX_USERNAME_LEN),
    password: String(data.credentials.password ?? '').slice(0, MAX_PASSWORD_LEN + ENC_PREFIX.length + 64),
  };
}

function normalizeSettings(data) {
  const rememberLogin = Boolean(data?.rememberLogin);
  return {
    locale: data?.locale === 'en' ? 'en' : 'ru',
    proxy: normalizeProxy(data?.proxy),
    rememberLogin,
    credentials: normalizeCredentials(data, rememberLogin),
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

function persistCredentials(username, passwordPlain, currentStored) {
  const user = String(username ?? '').trim().slice(0, MAX_USERNAME_LEN);
  if (!user) return null;

  let plain = passwordPlain;
  if (plain === undefined || plain === null || plain === '') {
    plain = decryptPassword(currentStored?.password);
  }
  plain = String(plain ?? '').slice(0, MAX_PASSWORD_LEN);
  if (!plain) return null;

  if (isEncryptedPassword(currentStored?.password) && decryptPassword(currentStored.password) === plain) {
    return { username: user, password: currentStored.password };
  }

  return { username: user, password: encryptPassword(plain) };
}

function sanitizeSettingsPartial(partial) {
  if (!partial || typeof partial !== 'object' || Array.isArray(partial)) {
    return {};
  }

  const out = {};
  const allowed = new Set([
    'locale',
    'proxy',
    'rememberLogin',
    'credentials',
    'lessonId',
    'lessonInput',
    'lastDownloadDir',
  ]);

  for (const key of Object.keys(partial)) {
    if (!allowed.has(key)) continue;
    out[key] = partial[key];
  }

  if (out.proxy && typeof out.proxy === 'object') {
    out.proxy = normalizeProxy(out.proxy);
  }

  if (Object.prototype.hasOwnProperty.call(out, 'rememberLogin')) {
    out.rememberLogin = Boolean(out.rememberLogin);
  }

  if (Object.prototype.hasOwnProperty.call(out, 'locale')) {
    out.locale = out.locale === 'en' ? 'en' : 'ru';
  }

  if (Object.prototype.hasOwnProperty.call(out, 'lessonId')) {
    out.lessonId = out.lessonId == null ? null : String(out.lessonId).slice(0, 256);
  }

  if (Object.prototype.hasOwnProperty.call(out, 'lessonInput')) {
    out.lessonInput = out.lessonInput == null ? null : String(out.lessonInput).slice(0, 2048);
  }

  if (Object.prototype.hasOwnProperty.call(out, 'lastDownloadDir')) {
    out.lastDownloadDir =
      out.lastDownloadDir == null ? null : String(out.lastDownloadDir).slice(0, 4096);
  }

  if (Object.prototype.hasOwnProperty.call(out, 'credentials')) {
    if (out.credentials == null) {
      out.credentials = null;
    } else if (typeof out.credentials === 'object') {
      out.credentials = {
        username: String(out.credentials.username ?? '').slice(0, MAX_USERNAME_LEN),
        password:
          out.credentials.password === undefined
            ? undefined
            : String(out.credentials.password ?? '').slice(0, MAX_PASSWORD_LEN),
      };
    } else {
      delete out.credentials;
    }
  }

  return out;
}

function saveSettings(partial) {
  const clean = sanitizeSettingsPartial(partial);
  const { settings: current } = readSettings();
  const next = { ...current, ...clean };

  if (clean.proxy) {
    next.proxy = { ...current.proxy, ...clean.proxy };
  }

  if (Object.prototype.hasOwnProperty.call(clean, 'rememberLogin')) {
    next.rememberLogin = Boolean(clean.rememberLogin);
    if (!next.rememberLogin) {
      next.credentials = null;
    }
  }

  if (next.proxy?.untrustedPublic) {
    next.rememberLogin = false;
    next.credentials = null;
  }

  if (Object.prototype.hasOwnProperty.call(clean, 'credentials')) {
    if (clean.credentials == null || !next.rememberLogin || next.proxy?.untrustedPublic) {
      next.credentials = null;
    } else {
      try {
        next.credentials = persistCredentials(
          clean.credentials.username,
          clean.credentials.password,
          current.credentials
        );
        if (!next.credentials) {
          next.rememberLogin = false;
        }
      } catch (err) {
        if (err?.message === 'ENCRYPTION_UNAVAILABLE') {
          next.credentials = null;
          next.rememberLogin = false;
          writeSettings(next);
          const error = new Error('ENCRYPTION_UNAVAILABLE');
          error.code = 'ENCRYPTION_UNAVAILABLE';
          throw error;
        }
        throw err;
      }
    }
  }

  // Migrate legacy plaintext passwords on any write.
  if (next.credentials?.password && !isEncryptedPassword(next.credentials.password)) {
    try {
      next.credentials = persistCredentials(
        next.credentials.username,
        next.credentials.password,
        null
      );
    } catch {
      next.credentials = null;
      next.rememberLogin = false;
    }
  }

  writeSettings(next);
  return next;
}

function getSettingsForRenderer() {
  const { settings, fileExists } = readSettings();
  const credentials = settings.credentials?.username
    ? {
        username: settings.credentials.username,
        hasPassword: Boolean(decryptPassword(settings.credentials.password)),
      }
    : null;

  return {
    fileExists,
    settings: {
      ...settings,
      credentials,
      encryptionAvailable: canEncryptSecrets(),
    },
  };
}

function resolveLoginPassword(username, passwordFromRenderer) {
  const typed = String(passwordFromRenderer ?? '');
  if (typed) return typed;

  const { settings } = readSettings();
  if (!settings.rememberLogin || !settings.credentials) return '';
  if (username && settings.credentials.username !== username) return '';
  return decryptPassword(settings.credentials.password);
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
  getSettingsForRenderer,
  resolveLoginPassword,
  canEncryptSecrets,
  decryptPassword,
  sanitizeSettingsPartial,
  DEFAULT_PROXY,
};
