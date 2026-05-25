const fs = require('fs');
const path = require('path');
const { messages } = require('../src/i18n-messages');

const outPath = path.join(__dirname, '../src/renderer/locale-data.js');
const content = `/* Auto-synced from src/i18n-messages.js — run: npm run sync:locale */\nwindow.BLINK_LOCALE_MESSAGES = ${JSON.stringify(messages)};\n`;

fs.writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath} (${Object.keys(messages.ru).length} keys per locale)`);
