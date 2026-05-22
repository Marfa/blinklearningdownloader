/**
 * Проверка авторизации: BLINK_EMAIL и BLINK_PASSWORD в окружении.
 * node scripts/test-auth.js
 */
const { authenticate } = require('../src/auth');

const email = process.env.BLINK_EMAIL;
const password = process.env.BLINK_PASSWORD;

if (!email || !password) {
  console.error('Задайте BLINK_EMAIL и BLINK_PASSWORD');
  process.exit(1);
}

const proxyEnabled = process.env.BLINK_PROXY === '1';
authenticate({
  username: email,
  password,
  proxy: {
    enabled: proxyEnabled,
    host: process.env.BLINK_PROXY_HOST || '',
    port: Number(process.env.BLINK_PROXY_PORT) || 0,
  },
})
  .then((r) => console.log(r))
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
