const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { socks5hAgentUrl } = require('./socks5-agent');
const { CookieJar } = require('tough-cookie');
const { HttpCookieAgent, HttpsCookieAgent } = require('http-cookie-agent/http');
const { setAuthenticatedClient } = require('./session');
const { t, getLocale } = require('./i18n');

const { LAUNCH_BASE } = require('./blink-constants');

const LAUNCH_URL = LAUNCH_BASE;
const LOGIN_URL = 'https://www.blinklearning.com/login';
const COLABORADOR_URL = 'https://www.blinklearning.com/LMS/colaborador.php';
const SESSION_COOKIE = 'BLINKSESSIONPROD';

function normalizeProxy(proxy) {
  if (!proxy?.enabled) {
    return { enabled: false, host: '', port: 0 };
  }

  const host = String(proxy?.host ?? '').trim();
  const port = Number(proxy?.port);

  if (!host || !Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(t('auth.proxyInvalid', getLocale()));
  }

  return { enabled: true, host, port };
}

function createClient(proxy) {
  const jar = new CookieJar();
  const cookieOptions = { cookies: { jar } };

  let httpAgent;
  let httpsAgent;

  if (proxy.enabled) {
    const socksAgent = new SocksProxyAgent(socks5hAgentUrl(proxy.host, proxy.port));
    httpAgent = new HttpCookieAgent({ ...cookieOptions, agent: socksAgent });
    httpsAgent = new HttpsCookieAgent({ ...cookieOptions, agent: socksAgent });
  } else {
    httpAgent = new HttpCookieAgent(cookieOptions);
    httpsAgent = new HttpsCookieAgent(cookieOptions);
  }

  const client = axios.create({
    httpAgent,
    httpsAgent,
    proxy: false,
    maxRedirects: 10,
    timeout: 60000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
    },
  });

  return { client, jar };
}

/** Axios без cookie-jar — для больших MP3 с CDN через SOCKS. */
function createProxyDownloadClient(proxy) {
  const effectiveProxy = normalizeProxy(proxy);
  if (!effectiveProxy.enabled) return null;

  const socksAgent = new SocksProxyAgent(
    socks5hAgentUrl(effectiveProxy.host, effectiveProxy.port)
  );

  return axios.create({
    httpAgent: socksAgent,
    httpsAgent: socksAgent,
    proxy: false,
    maxRedirects: 10,
    timeout: 600000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: () => true,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept: 'audio/mpeg,audio/*,*/*',
    },
  });
}

function getFinalUrl(response, fallback) {
  return response.request?.res?.responseUrl || fallback;
}

async function hasSessionCookie(jar) {
  const cookies = await jar.getCookies('https://www.blinklearning.com');
  return cookies.some((c) => c.key === SESSION_COOKIE && c.value);
}

function parseLoginForm(html) {
  const $ = cheerio.load(html);
  const $form = $('form[name="flogin"]').first();
  if (!$form.length) return null;

  const payload = {};
  $form.find('input').each((_, input) => {
    const $input = $(input);
    const type = ($input.attr('type') || 'text').toLowerCase();
    const name = $input.attr('name');
    if (!name || type === 'submit' || type === 'button') return;
    payload[name] = $input.attr('value') ?? '';
  });

  if (!payload.email && !Object.keys(payload).includes('email')) {
    return null;
  }

  return { payload };
}

function extractLoginError(html) {
  const $ = cheerio.load(html);
  const visibleAlert = $('#alertForm:not(.hidden), .alert-danger:not(.hidden)')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter(Boolean)
    .join(' ');

  if (visibleAlert) return visibleAlert;

  const bodyText = $('body').text().replace(/\s+/g, ' ');
  const patterns = [
    /usuario o contraseña[^.]{0,120}/i,
    /correo electr[oó]nico o contraseña[^.]{0,120}/i,
    /invalid (?:user|email|password)[^.]{0,120}/i,
    /credenciales[^.]{0,120}/i,
    /datos de acceso incorrectos[^.]{0,120}/i,
  ];
  for (const pattern of patterns) {
    const match = bodyText.match(pattern);
    if (match) return match[0].trim();
  }

  return null;
}

function isLoginPostSuccess(html, url, status, hasSession) {
  if (status >= 400) return false;
  if (!hasSession) return false;

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('/login') || lowerUrl.includes('/loginux')) {
    const err = extractLoginError(html);
    return !err;
  }

  return true;
}

function isLaunchAccessible(html, url, status) {
  if (status >= 400) return false;

  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('/login') || lowerUrl.includes('/loginux')) {
    return false;
  }

  const lower = html.toLowerCase();
  if (lower.includes('id="app"') && lower.includes('bundle.main.js')) {
    return true;
  }

  return /\/v\/\d+\/themes\/tmpux\/launch\.php/.test(url);
}

async function fetchPage(client, url) {
  const response = await client.get(url);
  return {
    html: String(response.data ?? ''),
    url: getFinalUrl(response, url),
    status: response.status,
  };
}

async function submitLogin(client, jar, email, password, formPayload) {
  const payload = { ...formPayload, email, contrasena: password };
  if (!payload.nextURL?.trim()) {
    payload.nextURL = LAUNCH_URL;
  }

  const response = await client.post(
    COLABORADOR_URL,
    new URLSearchParams(payload).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Referer: LOGIN_URL,
        Origin: 'https://www.blinklearning.com',
      },
    }
  );

  const hasSession = await hasSessionCookie(jar);

  return {
    html: String(response.data ?? ''),
    url: getFinalUrl(response, COLABORADOR_URL),
    status: response.status,
    hasSession,
  };
}

async function authenticate({ username, password, proxy }) {
  const locale = getLocale();

  if (!username?.trim() || !password) {
    throw new Error(t('auth.credentialsRequired', locale));
  }

  const effectiveProxy = normalizeProxy(proxy);
  const { client, jar } = createClient(effectiveProxy);

  try {
    const loginPage = await fetchPage(client, LOGIN_URL);

    if (loginPage.status >= 500) {
      throw new Error(t('auth.serverError', locale, { status: loginPage.status }));
    }

    const parsed = parseLoginForm(loginPage.html);
    if (!parsed) {
      throw new Error(t('auth.formNotFound', locale));
    }

    const loginResult = await submitLogin(
      client,
      jar,
      username.trim(),
      password,
      parsed.payload
    );

    const loginError = extractLoginError(loginResult.html);
    if (loginError) {
      throw new Error(loginError);
    }

    if (
      !isLoginPostSuccess(
        loginResult.html,
        loginResult.url,
        loginResult.status,
        loginResult.hasSession
      )
    ) {
      throw new Error(t('auth.invalidCredentials', locale));
    }

    const launchResult = await fetchPage(client, LAUNCH_URL);

    if (!isLaunchAccessible(launchResult.html, launchResult.url, launchResult.status)) {
      if (
        launchResult.url.toLowerCase().includes('/login') ||
        launchResult.url.toLowerCase().includes('/loginux')
      ) {
        throw new Error(t('auth.sessionFailed', locale));
      }
      throw new Error(
        t('auth.launchFailed', locale, { status: launchResult.status })
      );
    }

    setAuthenticatedClient(client);

    return {
      success: true,
      message: t('auth.success', locale),
    };
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      throw new Error(
        t('auth.networkError', locale, {
          detail: err.message,
          proxyHint: effectiveProxy.enabled
            ? t('auth.networkErrorProxyHint', locale)
            : '',
        })
      );
    }
    if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT') {
      throw new Error(t('auth.timeout', locale, { detail: err.message }));
    }
    if (err.response?.status === 407) {
      throw new Error(t('auth.proxyRejected', locale));
    }
    throw err;
  }
}

module.exports = {
  authenticate,
  LAUNCH_URL,
  LOGIN_URL,
  COLABORADOR_URL,
  normalizeProxy,
  createProxyDownloadClient,
};
