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
assert.strictEqual(isAllowedDownloadUrl('https://evil.example/a.mp3'), false);
assert.strictEqual(isAllowedDownloadUrl('javascript:alert(1)'), false);

console.log('security-hardening self-check ok');
