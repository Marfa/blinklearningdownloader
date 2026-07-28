const assert = require('assert');
const { isValidProxyHost, isValidProxyPort } = require('../src/proxy-host');
const { isAllowedDownloadUrl } = require('../src/download-allowlist');

assert.strictEqual(isValidProxyHost('1.2.3.4'), true);
assert.strictEqual(isValidProxyHost('proxy.example.com'), true);
assert.strictEqual(isValidProxyHost('evil@host'), false);
assert.strictEqual(isValidProxyHost('host:1080'), false);
assert.strictEqual(isValidProxyHost('host/path'), false);
assert.strictEqual(isValidProxyPort(1080), true);
assert.strictEqual(isValidProxyPort(0), false);
assert.strictEqual(isValidProxyPort(70000), false);

assert.strictEqual(
  isAllowedDownloadUrl('https://www.blinklearning.com/useruploads/r/a/1/x.mp3'),
  true
);
assert.strictEqual(isAllowedDownloadUrl('https://files-r2.example.com/a.mp3'), true);
assert.strictEqual(
  isAllowedDownloadUrl(
    'https://blinklearning1-files-r2.blinklearning.net/28/bc/28bc2f2d819562c452bd1d240f12e2e795252d7c_6438711.mp3'
  ),
  true
);
assert.strictEqual(isAllowedDownloadUrl('https://evil.example/a.mp3'), false);
assert.strictEqual(isAllowedDownloadUrl('javascript:alert(1)'), false);

console.log('security-hardening self-check ok');
