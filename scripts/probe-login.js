const axios = require('axios');
const cheerio = require('cheerio');

axios
  .get('https://www.blinklearning.com/login', {
    timeout: 30000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  })
  .then((r) => {
    const $ = cheerio.load(String(r.data));
    const form = $('form').first();
    form.find('input').each((_, inp) => {
      const name = $(inp).attr('name');
      const type = $(inp).attr('type');
      const val = $(inp).attr('value');
      if (name) console.log(name, type, val?.slice?.(0, 120));
    });
  });
