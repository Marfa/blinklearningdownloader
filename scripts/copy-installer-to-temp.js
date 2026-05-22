const fs = require('fs');
const path = require('path');

const buildDir = path.join('C:/Temp/blinklearningdownloader-build');
const destDir = 'C:/Temp';

if (!fs.existsSync(buildDir)) {
  console.error('Build folder not found:', buildDir);
  process.exit(1);
}

const installer = fs
  .readdirSync(buildDir)
  .find((name) => name.endsWith('.exe') && name.includes('Setup'));

if (!installer) {
  console.error('NSIS installer not found in', buildDir);
  process.exit(1);
}

const src = path.join(buildDir, installer);
const dest = path.join(destDir, installer);
fs.copyFileSync(src, dest);
console.log('Copied to', dest);
