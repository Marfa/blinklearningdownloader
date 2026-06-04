const axios = require('axios');
const cheerio = require('cheerio');
const { SocksProxyAgent } = require('socks-proxy-agent');
const { socks5hAgentUrl } = require('./socks5-agent');

const PROXYSCRAPE_PAGE_URL = 'https://proxyscrape.com/free-proxy-list';
const PROXYSCRAPE_API_URL =
  'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=ipport&format=text&protocol=socks5';
const FALLBACK_SOCKS5_URL =
  'https://raw.githubusercontent.com/TheSpeedX/SOCKS-List/master/socks5.txt';

const TEST_URL = 'https://www.blinklearning.com/';
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_SERVERS_TO_TRY = 15;
const DEFAULT_TEST_TIMEOUT_MS = 20000;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCloudflareBlock(body) {
  const text = String(body ?? '');
  return /just a moment|cf-browser-verification|attention required/i.test(text);
}

function parseIpPortLines(text) {
  const candidates = [];
  const seen = new Set();

  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim().replace(/^socks5:\/\//i, '');
    const match = trimmed.match(/^(\d{1,3}(?:\.\d{1,3}){3}):(\d{1,5})$/);
    if (!match) continue;

    const host = match[1];
    const port = Number(match[2]);
    if (!Number.isFinite(port) || port < 1 || port > 65535) continue;

    const key = `${host}:${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ host, port });
  }

  return candidates;
}

async function fetchText(url, options = {}) {
  const response = await axios.get(url, {
    timeout: options.timeout ?? 30000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: options.accept ?? 'text/plain,text/html,*/*',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    validateStatus: (status) => status >= 200 && status < 400,
    ...options.axiosConfig,
  });

  if (isCloudflareBlock(response.data)) {
    throw new Error('PROXY_LIST_BLOCKED');
  }

  return String(response.data ?? '');
}

async function fetchFromProxyScrapeApi() {
  const text = await fetchText(PROXYSCRAPE_API_URL, { accept: 'text/plain,*/*' });
  const candidates = parseIpPortLines(text);
  if (!candidates.length) {
    throw new Error('PROXY_LIST_EMPTY');
  }
  return candidates;
}

function parseProxyScrapeHtml(html) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const candidates = [];

  $('table tbody tr').each((_, row) => {
    const cells = $(row)
      .find('td')
      .map((__, cell) => $(cell).text().trim())
      .get();
    if (cells.length < 2) return;

    const rowText = cells.join(' ').toLowerCase();
    if (rowText.includes('socks4') && !rowText.includes('socks5')) return;
    if (!rowText.includes('socks5')) return;

    const host = cells.find((c) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(c)) ?? '';
    const portCell = cells.find((c) => /^\d{2,5}$/.test(c));
    const port = Number(portCell);
    if (!host || !portCell || port < 1 || port > 65535) return;

    const key = `${host}:${port}`;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ host, port });
  });

  return candidates;
}

async function fetchFromProxyScrapePage() {
  const html = await fetchText(PROXYSCRAPE_PAGE_URL, { accept: 'text/html,*/*' });
  const candidates = parseProxyScrapeHtml(html);
  if (!candidates.length) {
    throw new Error('PROXY_LIST_EMPTY');
  }
  return candidates;
}

async function fetchFromFallbackList() {
  const text = await fetchText(FALLBACK_SOCKS5_URL, { accept: 'text/plain,*/*' });
  const candidates = parseIpPortLines(text);
  if (!candidates.length) {
    throw new Error('PROXY_LIST_EMPTY');
  }
  return candidates;
}

async function fetchSocks5Candidates(onProgress) {
  const sources = [
    { name: 'api', load: fetchFromProxyScrapeApi },
    { name: 'page', load: fetchFromProxyScrapePage },
    { name: 'fallback', load: fetchFromFallbackList },
  ];

  let lastError = new Error('PROXY_LIST_FETCH_FAILED');

  for (let i = 0; i < sources.length; i += 1) {
    if (i === 1) {
      onProgress?.({ phase: 'loadingFallback' });
    }

    try {
      const candidates = await sources[i].load();
      return candidates;
    } catch (err) {
      lastError = err;
      if (err.message === 'PROXY_LIST_BLOCKED' && i < sources.length - 1) {
        continue;
      }
      if (err.message === 'PROXY_LIST_EMPTY' && i < sources.length - 1) {
        continue;
      }
    }
  }

  throw lastError;
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
    maxRedirects: 5,
    validateStatus: () => true,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,*/*',
    },
  };

  try {
    const head = await axios.head(testUrl, config);
    if (isReachableStatus(head.status)) return true;
  } catch {
    /* HEAD may be blocked — try GET */
  }

  const get = await axios.get(testUrl, config);
  return isReachableStatus(get.status);
}

async function testSocks5Proxy(host, port, options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TEST_TIMEOUT_MS;
  const testUrl = options.testUrl ?? TEST_URL;
  const signal = options.signal;

  if (signal?.aborted) return false;

  const agent = new SocksProxyAgent(socks5hAgentUrl(host, port), { timeout: timeoutMs });

  try {
    const ok = await Promise.race([
      requestThroughProxy(agent, testUrl, timeoutMs),
      delay(timeoutMs + 1000).then(() => false),
    ]);
    return Boolean(ok);
  } catch {
    return false;
  }
}

async function pickWorkingSocks5Proxy({ onProgress, signal } = {}) {
  onProgress?.({ phase: 'loadingList' });

  let candidates;
  try {
    candidates = await fetchSocks5Candidates(onProgress);
  } catch (err) {
    if (err.message === 'PROXY_LIST_EMPTY') {
      throw new Error('PROXY_LIST_EMPTY');
    }
    if (err.message === 'PROXY_LIST_BLOCKED') {
      throw new Error('PROXY_LIST_BLOCKED');
    }
    throw new Error('PROXY_LIST_FETCH_FAILED');
  }

  if (signal?.aborted) return null;

  const total = Math.min(candidates.length, MAX_SERVERS_TO_TRY);

  for (let index = 0; index < total; index += 1) {
    if (signal?.aborted) return null;

    const { host, port } = candidates[index];
    onProgress?.({
      phase: 'checkingServer',
      host,
      port,
      current: index + 1,
      total,
    });
    onProgress?.({
      phase: 'tryingPort',
      host,
      port,
      current: index + 1,
      total,
    });

    const ok = await testSocks5Proxy(host, port, { signal, testUrl: TEST_URL });
    if (ok) {
      return { host, port, enabled: true };
    }
  }

  return null;
}

module.exports = {
  PROXYSCRAPE_PAGE_URL,
  PROXYSCRAPE_API_URL,
  TEST_URL,
  fetchSocks5Candidates,
  testSocks5Proxy,
  pickWorkingSocks5Proxy,
};
