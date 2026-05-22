const https = require('https');
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
}

function downloadHttps(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close();
          return downloadHttps(res.headers.location, dest).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => resolve(fs.statSync(dest).size));
      })
      .on('error', reject);
    file.on('error', reject);
  });
}

(async () => {
  clearSession();
  await authenticate({
    username: process.env.BLINK_EMAIL,
    password: process.env.BLINK_PASSWORD,
    proxy: { enabled: true },
  });
  const cdn = await resolveCdnUrl(getHttpClient());
  console.log('cdn', cdn.slice(0, 100));
  const dest = path.join(__dirname, 'native.mp3');
  const size = await downloadHttps(cdn, dest);
  console.log('ok', size);
})();
