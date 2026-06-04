const fs = require('fs');
const path = require('path');
const { messages } = require('../src/i18n-messages');

const html = fs.readFileSync(path.join(__dirname, '../src/renderer/index.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '../src/renderer/renderer.js'), 'utf8');

const keys = new Set();
for (const m of html.matchAll(/data-i18n(?:-html|-placeholder|-title|-aria)?="([^"]+)"/g)) {
  keys.add(m[1]);
}
for (const m of js.matchAll(/tt\('([^']+)'/g)) {
  keys.add(m[1]);
}

const missingRu = [];
const missingEn = [];
for (const k of keys) {
  if (!messages.ru[k]) missingRu.push(k);
  if (!messages.en[k]) missingEn.push(k);
}

const ruKeys = Object.keys(messages.ru);
const enKeys = Object.keys(messages.en);
const onlyRu = ruKeys.filter((k) => !messages.en[k]);
const onlyEn = enKeys.filter((k) => !messages.ru[k]);

console.log('UI keys used:', keys.size);
if (missingRu.length) {
  console.error('Missing RU:', missingRu);
  process.exitCode = 1;
}
if (missingEn.length) {
  console.error('Missing EN:', missingEn);
  process.exitCode = 1;
}
if (onlyRu.length || onlyEn.length) {
  console.error('Locale parity mismatch. onlyRu:', onlyRu.length, 'onlyEn:', onlyEn.length);
  process.exitCode = 1;
}
if (!process.exitCode) console.log('OK: all UI strings have RU and EN translations.');
