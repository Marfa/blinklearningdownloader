const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const url =
  'https://www.blinklearning.com/v/1778658518/themes/tmpux/launch.php';

axios
  .get(url, {
    maxRedirects: 10,
    timeout: 30000,
    validateStatus: () => true,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  })
  .then((r) => {
    const html = String(r.data);
    fs.writeFileSync(path.join(__dirname, 'launch-sample.html'), html);
    console.log('status', r.status, 'len', html.length);
    console.log('final', r.request?.res?.responseUrl || r.config.url);

    const scripts = html.match(/src="[^"]+"/g) || [];
    console.log('scripts', scripts.slice(0, 15));

    const apiHints = [
      'login',
      'auth',
      'token',
      'oauth',
      'session',
      'launch',
    ];
    for (const hint of apiHints) {
      const re = new RegExp(hint, 'gi');
      const count = (html.match(re) || []).length;
      if (count) console.log(hint, count);
    }

    const $ = cheerio.load(html);
    console.log('forms', $('form').length);
    console.log('iframes', $('iframe').length);
    console.log('links login', $('a[href*="login"]').length);
    $('a[href*="login"]')
      .slice(0, 5)
      .each((i, el) => console.log('  ', $(el).attr('href')));
  })
  .catch((e) => console.error('ERR', e.code, e.message));
