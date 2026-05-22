const path = require('path');
const { authenticate } = require('../src/auth');
const { setLessonInput, getHttpClient, clearSession } = require('../src/session');
const { downloadOneTrack } = require('../src/audio');

const email = process.env.BLINK_EMAIL;
const password = process.env.BLINK_PASSWORD;
const lessonId = process.env.BLINK_LESSON_ID || '415263834';
const track = Number(process.env.BLINK_TRACK || '6');

(async () => {
  if (!email || !password) {
    console.error('Set BLINK_EMAIL and BLINK_PASSWORD');
    process.exit(1);
  }

  clearSession();
  const proxyEnabled = process.env.BLINK_PROXY === '1';
  const auth = await authenticate({
    username: email,
    password,
    proxy: {
      enabled: proxyEnabled,
      host: process.env.BLINK_PROXY_HOST || '',
      port: Number(process.env.BLINK_PROXY_PORT) || 0,
    },
  });
  if (!auth.success) {
    console.error(auth.message);
    process.exit(1);
  }

  setLessonInput(
    'https://www.blinklearning.com/v/1778658518/themes/tmpux/launch.php#responsive/book/4036150/415263834'
  );

  const client = getHttpClient();
  const outDir = path.join(__dirname, 'audio-test-out');

  const result = await downloadOneTrack(
    client,
    lessonId,
    track,
    outDir,
    (p) => {
      console.log('[progress]', p.phase, p.message || '', p.percent ?? '');
    },
    {
      enabled: proxyEnabled,
      host: process.env.BLINK_PROXY_HOST || '',
      port: Number(process.env.BLINK_PROXY_PORT) || 0,
    }
  );

  console.log(result);
  process.exit(result.ok ? 0 : 1);
})();
