const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');

const PROXY_LIST_URL = 'https://ru.proxy-tools.com/proxy/socks5';
const TEST_URL = 'https://x.com/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

/** Типичные порты публичных SOCKS5 (на сайте порт скрыт за капчей). */
const SOCKS5_PORTS = [
  1080, 1081, 4145, 5678, 7890, 8000, 8080, 8888, 9050, 3128, 10080, 10808, 18336,
  43002, 12334,
];

const MAX_CANDIDATES = 12;
const PORT_BATCH_SIZE = 4;
const DEFAULT_TEST_TIMEOUT_MS = 6000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseSocks5ListHtml(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const candidates = [];

  $('table tbody tr').each((_, row) => {
    const host = $(row).find('td.font-monospace').first().text().trim();
    if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || seen.has(host)) return;
    seen.add(host);

    const stability = Number($(row).find('.progress-bar').attr('aria-valuenow')) || 0;
    candidates.push({ host, stability });
  });

  return candidates.sort((a, b) => b.stability - a.stability);
}

async function fetchSocks5Candidates() {
  const response = await axios.get(PROXY_LIST_URL, {
    timeout: 30000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
    },
    validateStatus: (status) => status >= 200 && status < 400,
  });

  const candidates = parseSocks5ListHtml(response.data);
  if (!candidates.length) {
    throw new Error('PROXY_LIST_EMPTY');
  }

  return candidates.slice(0, MAX_CANDIDATES);
}

function isReachableStatus(status) {
  return status >= 200 && status < 500;
}

async function requestThroughProxy(agent, testUrl, timeoutMs) {
  const config = {
    httpAgent: agent,
    httpsAgent: agent,
    proxy: false,
    timeout: timeoutMs,
    maxRedirects: 4,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml',
    },
  };

  try {
    const head = await axios.head(testUrl, config);
    if (isReachableStatus(head.status)) return true;
  } catch {
    /* HEAD may be unsupported — try GET */
  }

  const get = await axios.get(testUrl, config);
  return isReachableStatus(get.status);
}

async function testSocks5Proxy(host, port, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS;
  const testUrl = options.testUrl ?? TEST_URL;
  const signal = options.signal;

  if (signal?.aborted) return false;

  const agent = new SocksProxyAgent(`socks5://${host}:${port}`, { timeout: timeoutMs });

  try {
    const ok = await Promise.race([
      requestThroughProxy(agent, testUrl, timeoutMs),
      delay(timeoutMs + 500).then(() => false),
    ]);
    return Boolean(ok);
  } catch {
    return false;
  }
}

async function findPortForHost(host, onTry, options = {}) {
  const ports = options.ports ?? SOCKS5_PORTS;
  const signal = options.signal;

  for (let i = 0; i < ports.length; i += PORT_BATCH_SIZE) {
    if (signal?.aborted) return null;

    const batch = ports.slice(i, i + PORT_BATCH_SIZE);
    const checks = batch.map(async (port) => {
      onTry?.(host, port);
      const ok = await testSocks5Proxy(host, port, options);
      return ok ? port : null;
    });

    const results = await Promise.all(checks);
    const found = results.find((port) => port != null);
    if (found) return found;
  }

  return null;
}

async function pickWorkingSocks5Proxy({ onProgress, signal } = {}) {
  onProgress?.({ phase: 'loadingList' });

  let candidates;
  try {
    candidates = await fetchSocks5Candidates();
  } catch (err) {
    if (err.message === 'PROXY_LIST_EMPTY') {
      throw new Error('PROXY_LIST_EMPTY');
    }
    throw new Error('PROXY_LIST_FETCH_FAILED');
  }

  if (signal?.aborted) return null;

  const total = candidates.length;

  for (let index = 0; index < candidates.length; index += 1) {
    if (signal?.aborted) return null;

    const { host } = candidates[index];
    onProgress?.({
      phase: 'checkingServer',
      host,
      current: index + 1,
      total,
    });

    const port = await findPortForHost(
      host,
      (tryHost, tryPort) => {
        onProgress?.({
          phase: 'tryingPort',
          host: tryHost,
          port: tryPort,
          current: index + 1,
          total,
        });
      },
      { signal }
    );

    if (port) {
      return { host, port, enabled: true };
    }
  }

  return null;
}

module.exports = {
  PROXY_LIST_URL,
  TEST_URL,
  SOCKS5_PORTS,
  fetchSocks5Candidates,
  testSocks5Proxy,
  pickWorkingSocks5Proxy,
};
