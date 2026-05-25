const fs = require('fs');
const os = require('os');
const path = require('path');
const cheerio = require('cheerio');
const { createProxyDownloadClient } = require('./auth');
const { t, getLocale, formatBytes } = require('./i18n');

const AUDIO_BASE_URL = 'https://www.blinklearning.com/useruploads/r/a';
const LAUNCH_REFERER =
  'https://www.blinklearning.com/v/1778658518/themes/tmpux/launch.php';

const MAX_REDIRECTS = 12;
const DOWNLOAD_RETRIES = 3;
const DOWNLOAD_REQUEST_TIMEOUT_MS = 600000;
const MIN_MP3_BYTES = 50 * 1024;
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function emitDownloadProgress(onProgress, received, total) {
  const locale = getLocale();
  const payload = {
    phase: 'download',
    received,
    total: total || 0,
  };
  if (total > 0) {
    payload.percent = Math.min(100, Math.round((received / total) * 100));
    payload.message = t('audio.downloadProgress', locale, {
      percent: payload.percent,
      received: formatBytes(received, locale),
      total: formatBytes(total, locale),
    });
  } else if (received > 0) {
    payload.message = t('audio.downloadProgressBytes', locale, {
      received: formatBytes(received, locale),
    });
  }
  onProgress?.(payload);
}

function buildPistaNames(trackNumber) {
  const n = Number(trackNumber);
  if (!Number.isFinite(n) || n < 0) return [];

  const names = [];
  if (n < 10) names.push(`PISTA0${n}`);
  if (n < 100) names.push(`PISTA${String(n).padStart(2, '0')}`);
  names.push(`PISTA${String(n).padStart(3, '0')}`);
  names.push(`PISTA${n}`);

  return [...new Set(names)];
}

function buildAudioUrl(lessonId, pistaName) {
  return `${AUDIO_BASE_URL}/${lessonId}/${pistaName}.mp3`;
}

function resolveTrackNumbers({ single, rangeFrom, rangeTo, useRange }) {
  const locale = getLocale();

  if (useRange) {
    const from = Number(rangeFrom);
    const to = Number(rangeTo);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return { ok: false, message: t('audio.rangeRequired', locale) };
    }
    if (from > to) {
      return { ok: false, message: t('audio.rangeInvalid', locale) };
    }
    if (to - from > 500) {
      return { ok: false, message: t('audio.rangeTooLarge', locale) };
    }
    const tracks = [];
    for (let i = from; i <= to; i += 1) tracks.push(i);
    return { ok: true, tracks };
  }

  const one = Number(single);
  if (!Number.isFinite(one)) {
    return { ok: false, message: t('audio.numberRequired', locale) };
  }
  return { ok: true, tracks: [one] };
}

function extractMp3UrlsFromHtml(html, baseUrl) {
  const urls = new Set();
  const patterns = [
    /https?:\/\/[^"'\\s]+\.mp3[^"'\\s]*/gi,
    /\/[^"'\\s]+\.mp3/gi,
  ];

  for (const pattern of patterns) {
    for (const match of html.matchAll(pattern)) {
      try {
        urls.add(new URL(match[0], baseUrl).href);
      } catch {
        /* skip */
      }
    }
  }

  const $ = cheerio.load(html);
  $('audio[src], source[src], a[href]').each((_, el) => {
    const src = $(el).attr('src') || $(el).attr('href');
    if (src && src.includes('.mp3')) {
      try {
        urls.add(new URL(src, baseUrl).href);
      } catch {
        /* skip */
      }
    }
  });

  return [...urls];
}

async function resolveDownloadUrl(client, startUrl, onProgress) {
  const locale = getLocale();
  let url = startUrl;

  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    onProgress?.({
      phase: 'resolve',
      message: t('audio.resolveLink', locale, { hop: hop + 1 }),
    });

    const head = await client.request({
      url,
      method: 'HEAD',
      maxRedirects: 0,
      validateStatus: () => true,
      timeout: 120000,
      headers: {
        Accept: '*/*',
        Referer: LAUNCH_REFERER,
      },
    });

    if (head.status >= 300 && head.status < 400 && head.headers.location) {
      url = new URL(head.headers.location, url).href;
      continue;
    }

    if (head.status === 200) {
      const type = head.headers['content-type'] || '';
      if (typeLooksLikeAudio(type) || /\.mp3/i.test(url)) {
        return { ok: true, url };
      }
    }

    const page = await client.get(url, {
      maxRedirects: 0,
      validateStatus: () => true,
      timeout: 120000,
      responseType: 'text',
      headers: {
        Accept: 'text/html,application/xhtml+xml,*/*',
        Referer: LAUNCH_REFERER,
      },
    });

    if (page.status >= 300 && page.status < 400 && page.headers.location) {
      url = new URL(page.headers.location, url).href;
      continue;
    }

    if (page.status === 200) {
      const type = page.headers['content-type'] || '';
      if (typeLooksLikeAudio(type) || /\.mp3/i.test(url)) {
        return { ok: true, url };
      }

      const mp3Urls = extractMp3UrlsFromHtml(String(page.data || ''), url);
      if (mp3Urls.length) {
        return { ok: true, url: mp3Urls[0] };
      }
    }

    break;
  }

  return { ok: false, message: t('audio.mp3LinkFailed', locale) };
}

function typeLooksLikeAudio(contentType) {
  const type = String(contentType || '').toLowerCase();
  return type.includes('audio') || type.includes('octet-stream');
}

function isCdnHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.includes('files-r2') || host.includes('r2.blinklearning');
  } catch {
    return false;
  }
}

function pickDownloadClient(authClient, url, proxy, cdnClientCache) {
  if (isCdnHost(url)) {
    if (!cdnClientCache.client && proxy) {
      cdnClientCache.client = createProxyDownloadClient(proxy);
    }
    if (cdnClientCache.client) return cdnClientCache.client;
  }
  return authClient;
}

function formatDownloadError(err) {
  const locale = getLocale();
  const msg = err?.message || t('audio.unknownError', locale);
  if (/premature close/i.test(msg)) {
    return t('audio.prematureClose', locale);
  }
  if (/ECONNRESET|ETIMEDOUT|socket hang up|aborted/i.test(msg)) {
    return t('audio.connectionAborted', locale, { detail: msg });
  }
  if (/остановилось|таймаут|timeout/i.test(msg)) {
    return msg;
  }
  return msg;
}

async function downloadWithClient(authClient, url, destPath, onProgress, proxy) {
  const cdnClientCache = {};
  const client = pickDownloadClient(authClient, url, proxy, cdnClientCache);

  const response = await client.get(url, {
    responseType: 'arraybuffer',
    timeout: DOWNLOAD_REQUEST_TIMEOUT_MS,
    maxRedirects: 10,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    decompress: false,
    validateStatus: () => true,
    proxy: false,
    headers: {
      Accept: 'audio/mpeg,audio/*,*/*',
      'User-Agent': USER_AGENT,
      Referer: LAUNCH_REFERER,
    },
    onDownloadProgress: (event) => {
      const loaded = event.loaded || 0;
      const total = event.total || 0;
      if (loaded > 0) {
        emitDownloadProgress(onProgress, loaded, total);
      }
    },
  });

  const locale = getLocale();

  if (response.status !== 200) {
    throw new Error(t('audio.httpDownloadError', locale, { status: response.status }));
  }

  const contentType = String(response.headers['content-type'] || '').toLowerCase();
  if (contentType.includes('text/html')) {
    throw new Error(t('audio.htmlInsteadOfMp3', locale));
  }

  const data = Buffer.from(response.data || []);
  const size = data.length;
  const headerTotal = Number(response.headers['content-length']) || 0;

  emitDownloadProgress(onProgress, size, headerTotal || size);

  if (size < MIN_MP3_BYTES) {
    throw new Error(
      t('audio.fileTooSmall', locale, { size: formatBytes(size, locale) })
    );
  }

  await fs.promises.writeFile(destPath, data);
  return { size, total: headerTotal || size };
}

async function downloadResolvedFile(authClient, resolveUrl, destPath, onProgress, proxy) {
  let lastError;

  const locale = getLocale();

  for (let attempt = 1; attempt <= DOWNLOAD_RETRIES; attempt += 1) {
    try {
      onProgress?.({
        phase: 'download',
        message: t('audio.downloadRetry', locale, {
          attempt:
            attempt > 1 ? t('audio.downloadRetryAttempt', locale, { attempt }) : '',
        }),
        percent: 0,
      });

      const url = await resolveUrl(attempt > 1);
      return await downloadWithClient(authClient, url, destPath, onProgress, proxy);
    } catch (err) {
      lastError = err;
      onProgress?.({
        phase: 'error',
        message: formatDownloadError(err),
      });
      try {
        if (fs.existsSync(destPath)) fs.unlinkSync(destPath);
      } catch {
        /* ignore */
      }
    }
  }

  throw new Error(formatDownloadError(lastError));
}

async function downloadOneTrack(client, lessonId, trackNumber, destDir, onProgress, proxy) {
  const locale = getLocale();
  fs.mkdirSync(destDir, { recursive: true });
  const tried = [];
  let lastError = null;

  for (const pista of buildPistaNames(trackNumber)) {
    const entryUrl = buildAudioUrl(lessonId, pista);
    tried.push(entryUrl);

    onProgress?.({
      phase: 'track',
      trackNumber,
      pista,
      message: t('audio.trackProgress', locale, { track: trackNumber, pista }),
    });

    try {
      const resolved = await resolveDownloadUrl(client, entryUrl, onProgress);
      if (!resolved.ok) continue;

      const filePath = path.join(destDir, `${pista}.mp3`);
      await downloadResolvedFile(
        client,
        async (refresh) => {
          if (!refresh) return resolved.url;
          const again = await resolveDownloadUrl(client, entryUrl, onProgress);
          if (!again.ok) throw new Error(again.message);
          return again.url;
        },
        filePath,
        (payload) => {
          onProgress?.({
            ...payload,
            trackNumber,
            pista,
          });
        },
        proxy
      );

      const size = fs.statSync(filePath).size;
      if (size > 0) {
        return {
          ok: true,
          trackNumber,
          pista,
          url: resolved.url,
          filePath,
          size,
        };
      }
    } catch (err) {
      lastError = err;
      onProgress?.({
        phase: 'error',
        trackNumber,
        pista,
        message: formatDownloadError(err),
      });
    }
  }

  return {
    ok: false,
    trackNumber,
    tried,
    message: t('audio.trackUnavailable', locale, {
      track: trackNumber,
      detail: lastError
        ? t('audio.trackUnavailableDetail', locale, { detail: lastError.message })
        : '',
    }),
  };
}

function getPreviewDir() {
  return path.join(os.tmpdir(), 'blinklearning-preview');
}

function clearPreviewFiles(dir) {
  try {
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.mp3')) {
        fs.unlinkSync(path.join(dir, name));
      }
    }
  } catch {
    /* ignore */
  }
}

async function prepareTrackPreview(client, lessonId, trackNumber, onProgress, proxy) {
  const previewDir = getPreviewDir();
  fs.mkdirSync(previewDir, { recursive: true });
  clearPreviewFiles(previewDir);

  const result = await downloadOneTrack(
    client,
    lessonId,
    trackNumber,
    previewDir,
    onProgress,
    proxy
  );

  if (!result.ok) {
    return result;
  }

  return {
    ok: true,
    filePath: result.filePath,
    trackNumber: result.trackNumber,
    pista: result.pista,
  };
}

async function downloadTracks(client, lessonId, tracks, destDir, onProgress, proxy) {
  const locale = getLocale();
  fs.mkdirSync(destDir, { recursive: true });
  const results = [];

  for (let i = 0; i < tracks.length; i += 1) {
    const trackNumber = tracks[i];

    onProgress?.({
      phase: 'start',
      index: i + 1,
      total: tracks.length,
      trackNumber,
      message: t('audio.fileProgress', locale, {
        index: i + 1,
        total: tracks.length,
      }),
      percent: Math.round((i / tracks.length) * 100),
    });

    const result = await downloadOneTrack(
      client,
      lessonId,
      trackNumber,
      destDir,
      (payload) => {
        onProgress?.({
          index: i + 1,
          total: tracks.length,
          ...payload,
        });
      },
      proxy
    );

    results.push(result);

    onProgress?.({
      phase: 'track-done',
      index: i + 1,
      total: tracks.length,
      result,
      percent: Math.round(((i + 1) / tracks.length) * 100),
      message: result.ok
        ? t('audio.trackDone', locale, { pista: result.pista })
        : t('audio.trackError', locale, { track: trackNumber }),
    });
  }

  const downloaded = results.filter((r) => r.ok).length;
  const failed = results.length - downloaded;
  const errorLines = results
    .filter((r) => !r.ok && r.message)
    .map((r) => r.message);

  let message;
  if (failed === 0) {
    message = t('audio.summaryDownloaded', locale, { count: downloaded });
  } else if (downloaded === 0) {
    message = errorLines[0] || t('audio.summaryFailed', locale);
  } else {
    message = t('audio.summaryPartial', locale, {
      downloaded,
      failed,
      detail: errorLines[0] || '',
    }).trim();
  }

  return {
    ok: downloaded > 0,
    downloaded,
    failed,
    total: results.length,
    results,
    destDir,
    message,
    errors: errorLines,
  };
}

module.exports = {
  AUDIO_BASE_URL,
  LAUNCH_REFERER,
  buildAudioUrl,
  buildPistaNames,
  resolveTrackNumbers,
  resolveDownloadUrl,
  downloadOneTrack,
  downloadTracks,
  prepareTrackPreview,
};
