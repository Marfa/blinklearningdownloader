/**
 * Quick catalog test. Usage:
 *   set BLINK_EMAIL=... & set BLINK_PASSWORD=... & node scripts/test-catalog-quick.js
 * Optional: BLINK_PROXY=1 BLINK_PROXY_HOST=127.0.0.1 BLINK_PROXY_PORT=1080
 */
const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { authenticate } = require('../src/auth');
const { listBooks, destroyCatalogWindow } = require('../src/blink-catalog');
const { saveSettings } = require('../src/settings');

const OUT = path.join(__dirname, 'probe-out', 'catalog-quick.json');

const useProxy = process.env.BLINK_PROXY === '1';
const proxy = useProxy
  ? {
      enabled: true,
      host: process.env.BLINK_PROXY_HOST || '127.0.0.1',
      port: Number(process.env.BLINK_PROXY_PORT) || 1080,
    }
  : { enabled: false };

function writeResult(data) {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 2));
}

app.whenReady().then(async () => {
  const started = Date.now();
  try {
    saveSettings({ proxy });
    const auth = await authenticate({
      username: process.env.BLINK_EMAIL,
      password: process.env.BLINK_PASSWORD,
      proxy,
    });
    if (!auth.success) {
      writeResult({ ok: false, stage: 'auth', auth, ms: Date.now() - started });
      app.quit();
      return;
    }

    const books = await listBooks();
    writeResult({
      ok: true,
      proxy,
      count: books.length,
      sample: books.slice(0, 2),
      ms: Date.now() - started,
    });
  } catch (err) {
    writeResult({
      ok: false,
      error: err.message,
      proxy,
      ms: Date.now() - started,
    });
  }

  destroyCatalogWindow();
  app.quit();
});

setTimeout(() => {
  writeResult({ ok: false, error: 'APP_TIMEOUT_150s' });
  app.quit();
}, 150000);
