const { BrowserWindow, session } = require('electron');
const { getHttpClient } = require('./session');
const { readSettings } = require('./settings');
const {
  LAUNCH_BASE,
  MYBOOKS_HASH,
  USER_AGENT,
  buildBookHash,
  buildExerciseUrl,
} = require('./blink-constants');

const PARTITION = 'persist:blink-catalog';
const PAGE_READY_TIMEOUT_MS = 90000;
const LOAD_URL_TIMEOUT_MS = 45000;
const SCRIPT_TIMEOUT_MS = 60000;
const POLL_MS = 500;

let catalogWindow = null;
let catalogProxyKey = null;
let pageReadyPromise = null;

function getAuthCookieJar() {
  const client = getHttpClient();
  return client?.defaults?.httpsAgent?.options?.cookies?.jar ?? null;
}

function catalogProxyKeyFromSettings(proxy) {
  if (proxy?.enabled && proxy.host && proxy.port) {
    return `${proxy.host}:${proxy.port}`;
  }
  return 'direct';
}

async function applyCatalogSessionProxy(electronSession) {
  const { settings } = readSettings();
  const proxy = settings.proxy;
  catalogProxyKey = catalogProxyKeyFromSettings(proxy);

  if (proxy?.enabled && proxy.host && proxy.port) {
    await electronSession.setProxy({
      proxyRules: `socks5://${proxy.host}:${proxy.port}`,
      proxyBypassRules: '<local>',
    });
    return;
  }

  await electronSession.setProxy({ proxyRules: 'direct://' });
}

async function injectCookies(electronSession, jar) {
  const cookies = await jar.getCookies('https://www.blinklearning.com');
  for (const c of cookies) {
    try {
      await electronSession.cookies.set({
        url: 'https://www.blinklearning.com',
        name: c.key,
        value: c.value,
        domain: c.domain?.startsWith('.') ? c.domain : `.${c.domain || 'blinklearning.com'}`,
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly || false,
      });
    } catch {
      /* skip invalid cookie */
    }
  }
}

function destroyCatalogWindow() {
  if (catalogWindow && !catalogWindow.isDestroyed()) {
    catalogWindow.destroy();
  }
  catalogWindow = null;
  pageReadyPromise = null;
  catalogProxyKey = null;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function execJs(win, script, timeoutMs = SCRIPT_TIMEOUT_MS) {
  return Promise.race([
    win.webContents.executeJavaScript(script, true),
    delay(timeoutMs).then(() => {
      throw new Error('CATALOG_SCRIPT_TIMEOUT');
    }),
  ]);
}

async function isBlinkApiReady(win) {
  return execJs(
    win,
    `Boolean(window.blink?.api?.getMyBooks && window.blink?.api?.cancellableGetBook)`,
    15000
  );
}

async function loadAndWaitForBlink(win) {
  const url = `${LAUNCH_BASE}${MYBOOKS_HASH}`;
  const wc = win.webContents;

  const loaded = new Promise((resolve, reject) => {
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      wc.removeListener('did-finish-load', onDone);
      wc.removeListener('did-fail-load', onFail);
      if (err) reject(err);
      else resolve();
    };
    const timer = setTimeout(() => finish(new Error('CATALOG_BLINK_TIMEOUT')), LOAD_URL_TIMEOUT_MS);
    const onDone = () => {
      const href = wc.getURL();
      if (href.includes('blinklearning.com') && !href.includes('/login')) {
        finish();
      }
    };
    const onFail = (_event, _code, _desc, _validatedUrl, isMainFrame) => {
      if (!isMainFrame) return;
      finish(new Error('CATALOG_BLINK_LOAD_FAILED'));
    };
    wc.on('did-finish-load', onDone);
    wc.on('did-fail-load', onFail);
  });

  await win.loadURL(url, { userAgent: USER_AGENT });
  await loaded;

  const deadline = Date.now() + PAGE_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isBlinkApiReady(win)) return;
    const onLogin = await execJs(
      win,
      `(() => {
        const href = String(location.href || '').toLowerCase();
        return href.includes('/login') || href.includes('/loginux');
      })()`,
      5000
    );
    if (onLogin) throw new Error('CATALOG_SESSION_EXPIRED');
    await delay(POLL_MS);
  }
  throw new Error('CATALOG_BLINK_TIMEOUT');
}

async function ensureCatalogWindow() {
  const jar = getAuthCookieJar();
  if (!jar) {
    throw new Error('CATALOG_NOT_AUTHENTICATED');
  }

  const { settings } = readSettings();
  const proxyKey = catalogProxyKeyFromSettings(settings.proxy);

  if (catalogWindow && !catalogWindow.isDestroyed() && catalogProxyKey !== proxyKey) {
    destroyCatalogWindow();
  }

  const ses = session.fromPartition(PARTITION);
  await applyCatalogSessionProxy(ses);
  await injectCookies(ses, jar);

  if (catalogWindow && !catalogWindow.isDestroyed()) {
    return catalogWindow;
  }

  catalogWindow = new BrowserWindow({
    show: false,
    width: 1280,
    height: 900,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  pageReadyPromise = loadAndWaitForBlink(catalogWindow);
  await pageReadyPromise;
  return catalogWindow;
}

async function runScript(script, timeoutMs = SCRIPT_TIMEOUT_MS) {
  const win = await ensureCatalogWindow();
  if (!pageReadyPromise) {
    pageReadyPromise = loadAndWaitForBlink(win);
    await pageReadyPromise;
  }
  return execJs(win, script, timeoutMs);
}

async function getBlinkUserId() {
  const userId = await runScript(
    `(() => {
      const rollbarId = window._rollbarConfig?.payload?.person?.id;
      if (rollbarId) return String(rollbarId);
      if (window.blink?.user?.userID) return String(window.blink.user.userID);
      if (window.blink?.user?.id) return String(window.blink.user.id);
      return null;
    })()`,
    15000
  );
  if (!userId) throw new Error('CATALOG_USER_ID');
  return userId;
}

function isBookLocked(book) {
  if (book?.hasNoValidCredit === true) return true;
  if (book?.canOpen === false || book?.canOpenBook === false) return true;
  if (book?.hasLicense === false || book?.hasLicence === false) return true;
  if (book?.licensed === false) return true;
  if (book?.noLicense || book?.noLicence || book?.locked) return true;

  const text = JSON.stringify(book || {}).toLowerCase();
  return /faltan\s*licen|sin\s*licen|no\s*licen|nolicen|no_license/i.test(text);
}

function normalizeTitle(value, fallback) {
  const title = String(value ?? '').trim();
  return title || fallback;
}

function compareTitles(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function sortByTitle(items) {
  return [...items].sort((a, b) => compareTitles(a.title, b.title));
}

function sortBooks(items) {
  return [...items].sort((a, b) => {
    if (Boolean(a.locked) !== Boolean(b.locked)) {
      return a.locked ? 1 : -1;
    }
    return compareTitles(a.title, b.title);
  });
}

function exerciseSortRank(title) {
  const lower = String(title || '').trim().toLowerCase();
  if (/libro\s*digital/.test(lower)) return 0;
  if (/html\s+con\s+actividad/.test(lower)) return 1;
  return 2;
}

function sortExercises(items) {
  return [...items].sort((a, b) => {
    const rankDiff = exerciseSortRank(a.title) - exerciseSortRank(b.title);
    if (rankDiff !== 0) return rankDiff;
    return compareTitles(a.title, b.title);
  });
}

function isNavigationCatalogTitle(title) {
  const text = String(title || '').trim();
  if (!text) return true;
  const lower = text.toLowerCase();
  if (/^(←|◄|«|<-)\s*/.test(text)) return true;
  if (
    /^(назад|back|volver|atrás|atras|return|anterior|regresar|índice|indice|index|inicio|home|contenidos|content|menú|menu)$/i.test(
      lower
    )
  ) {
    return true;
  }
  if (/^(volver|regresar|back|return|ir)\b/i.test(lower) && lower.length < 80) {
    return true;
  }
  return false;
}

function filterCatalogEntries(items) {
  return items.filter((item) => !isNavigationCatalogTitle(item.title));
}

async function listBooks() {
  destroyCatalogWindow();

  const userId = await getBlinkUserId();
  const raw = await runScript(
    `(async () => {
      const userID = ${JSON.stringify(userId)};
      const data = await blink.api.cancellableApiCall(blink.api.getMyBooks, [{ userID }], null, {});
      return data;
    })()`,
    SCRIPT_TIMEOUT_MS
  );

  const books = sortBooks(
    Object.values(raw || {})
      .filter((b) => b && typeof b === 'object' && b.id != null)
      .map((b) => ({
        id: String(b.id),
        title: normalizeTitle(b.title || b.titulo || b.name, `ID ${b.id}`),
        locked: isBookLocked(b),
      }))
  );

  if (!books.length) {
    throw new Error('CATALOG_MYBOOKS_EMPTY');
  }

  return books;
}

async function fetchBookData(bookId) {
  const userId = await getBlinkUserId();
  return runScript(
    `(async () => {
      const bookId = ${JSON.stringify(String(bookId))};
      const userID = ${JSON.stringify(userId)};
      try {
        return await blink.api.cancellableGetBook(bookId, userID, false, false);
      } catch (e1) {
        try {
          return await blink.api.cancellableGetBookAndUserPermissions(bookId, userID, false, false);
        } catch (e2) {
          return await blink.api.cancellableGetBook(bookId, userID, null, false);
        }
      }
    })()`,
    SCRIPT_TIMEOUT_MS
  );
}

function extractUnits(book) {
  const units = book?.units || book?.temas || book?.themes || [];
  if (!Array.isArray(units)) return [];
  return units
    .filter((u) => u && (u.id != null || u.idTema != null))
    .map((u, index) => ({
      id: String(u.id ?? u.idTema ?? index),
      title: normalizeTitle(u.title || u.titulo || u.name || u.nombre, `Глава ${index + 1}`),
      raw: u,
    }));
}

function collectActivitiesFromNode(node, bucket, seen) {
  if (!node || typeof node !== 'object') return;

  const lists = [
    node.activities,
    node.actividades,
    node.resources,
    node.children,
    node.items,
  ];

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const item of list) {
      const id = item?.id ?? item?.idActivity ?? item?.key;
      if (id == null) continue;
      const sid = String(id);
      if (seen.has(sid)) continue;
      seen.add(sid);
      const typeLabel = item.type || item.tipo || '';
      const title = normalizeTitle(
        item.title || item.titulo || item.name || item.nombre || item.label,
        `Упражнение ${sid}`
      );
      if (isNavigationCatalogTitle(title)) continue;
      bucket.push({
        id: sid,
        title,
        type: typeLabel,
        isAudio: typeLabel === 1 || typeLabel === '1' || /audio/i.test(String(item.title || '')),
      });
    }
  }

  if (Array.isArray(node.subunits)) {
    for (const sub of node.subunits) collectActivitiesFromNode(sub, bucket, seen);
  }
}

async function listChapters(bookId) {
  const book = await fetchBookData(bookId);
  const chapters = filterCatalogEntries(extractUnits(book));
  if (chapters.length) return sortByTitle(chapters);

  await runScript(
    `(() => { location.hash = ${JSON.stringify(buildBookHash(bookId))}; })()`,
    10000
  );
  await delay(2000);

  const bookRetry = await fetchBookData(bookId);
  const retryChapters = filterCatalogEntries(extractUnits(bookRetry));
  return sortByTitle(retryChapters);
}

async function listExercises(bookId, chapterId) {
  const book = await fetchBookData(bookId);
  const unit =
    extractUnits(book).find((u) => u.id === String(chapterId))?.raw ||
    (book?.units || []).find((u) => String(u.id ?? u.idTema) === String(chapterId));

  const bucket = [];
  const seen = new Set();
  if (unit) collectActivitiesFromNode(unit, bucket, seen);

  if (!bucket.length && book) {
    for (const u of book.units || []) {
      collectActivitiesFromNode(u, bucket, seen);
    }
  }

  if (!bucket.length) {
    const domItems = await runScript(
      `(() => {
      const links = [...document.querySelectorAll('a[href*="responsive/book"], [data-activity-id], [data-id-actividad]')];
      const out = [];
      const seen = new Set();
      for (const el of links) {
        const href = el.getAttribute('href') || '';
        const text = (el.innerText || '').trim();
        const m = href.match(/book\\/([0-9]+)\\/([0-9]+)/i) || href.match(/#responsive\\/book\\/([0-9]+)\\/([0-9]+)/i);
        if (!m) continue;
        const activityId = m[2];
        if (seen.has(activityId)) continue;
        seen.add(activityId);
        const title = text || ('ID ' + activityId);
        out.push({ id: activityId, title: title, type: '' });
      }
      return out;
    })()`,
      15000
    );
    for (const item of domItems || []) {
      if (isNavigationCatalogTitle(item.title)) continue;
      if (!seen.has(item.id)) {
        seen.add(item.id);
        bucket.push(item);
      }
    }
  }

  return sortExercises(
    filterCatalogEntries(
      bucket.map((item) => ({
        ...item,
        url: buildExerciseUrl(bookId, item.id),
        lessonId: String(item.id),
      }))
    )
  );
}

module.exports = {
  listBooks,
  listChapters,
  listExercises,
  destroyCatalogWindow,
  buildExerciseUrl,
};
