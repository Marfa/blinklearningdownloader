const axios = require('axios');
const fs = require('fs');
const path = require('path');

const url =
  'https://www.blinklearning.com/themes/tmpux/assets/js/uxbuild/bundle.main.js?gestioneu01778658518';

axios
  .get(url, { responseType: 'text', timeout: 120000 })
  .then((r) => {
    const t = String(r.data);
    fs.writeFileSync(path.join(__dirname, 'bundle-sample.js'), t);
    console.log('len', t.length);

    const keys = [
      'login',
      '/api/',
      'authenticate',
      'loginux',
      'password',
      'session',
      'token',
      'credential',
    ];
    for (const k of keys) {
      let i = 0;
      let c = 0;
      while ((i = t.indexOf(k, i)) !== -1) {
        c++;
        i += k.length;
      }
      if (c) console.log(k, c);
    }

    const re = /["'](\/[^"']{0,120})["']/g;
    const paths = new Set();
    let m;
    while ((m = re.exec(t)) !== null) {
      const p = m[1];
      if (/login|auth|session|token|credential/i.test(p)) paths.add(p);
    }
    console.log('auth paths sample:');
    [...paths].slice(0, 40).forEach((p) => console.log(' ', p));
  })
  .catch((e) => console.error(e.message));
