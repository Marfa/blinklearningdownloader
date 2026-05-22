const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { authenticate } = require('../src/auth');
const { getHttpClient, clearSession } = require('../src/session');

const entryUrl =
  'https://www.blinklearning.com/useruploads/r/a/415263834/PISTA06.mp3';
const LAUNCH =
  'https://www.blinklearning.com/v/1778658518/themes/tmpux/launch.php';

async function resolveCdnUrl(client) {
  let url = entryUrl;
  for (let i = 0; i < 10; i += 1) {
    const head = await client.request({
      url,
      method: 'HEAD',
      maxRedirects: 0,
      validateStatus: () => true,
      timeout: 120000,
      headers: { Accept: '*/*', Referer: LAUNCH },
    });
    if (head.status >= 300 && head.status < 400 && head.headers.location) {
      url = new URL(head.headers.location, url).href;
      continue;
    }
    return url;
  }
  return url;
}

function downloadStream(url, agents) {
  return new Promise((resolve, reject) => {
    const out = path.join(__dirname, 'test-stream.mp3');
    const ws = fs.createWriteStream(out);
    axios
      .get(url, {
        responseType: 'stream',
        timeout: 0,
        maxRedirects: 0,
        validateStatus: () => true,
        proxy: false,
        ...agents,
        headers: { Accept: '*/*' },
      })
      .then((r) => {
        console.log('stream status', r.status, r.headers['content-length']);
        r.data.pipe(ws);
        ws.on('finish', () => resolve(fs.statSync(out).size));
        ws.on('error', reject);
        r.data.on('error', reject);
      })
      .catch(reject);
  });
}

(async () => {
  clearSession();
  const auth = await authenticate({
    username: process.env.BLINK_EMAIL,
    password: process.env.BLINK_PASSWORD,
    proxy: { enabled: true },
  });
  if (!auth.success) process.exit(1);

  const client = getHttpClient();
  const cdnUrl = await resolveCdnUrl(client);
  console.log('cdn resolved');

  try {
    const size = await downloadStream(cdnUrl, {
      httpAgent: client.defaults.httpAgent,
      httpsAgent: client.defaults.httpsAgent,
    });
    console.log('saved', size);
  } catch (e) {
    console.log('ERR', e.code, e.message);
  }
})();
