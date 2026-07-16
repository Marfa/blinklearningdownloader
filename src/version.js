const path = require('path');
const fs = require('fs');

function readVersionFromPackageJson() {
  const candidates = [path.join(__dirname, '..', 'package.json')];
  if (process.resourcesPath) {
    candidates.push(
      path.join(process.resourcesPath, 'app', 'package.json'),
      path.join(process.resourcesPath, 'package.json')
    );
  }

  for (const pkgPath of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.version) return String(pkg.version);
    } catch {
      /* try next path */
    }
  }

  return null;
}

function getAppVersion() {
  try {
    const { app } = require('electron');
    if (app?.getVersion) {
      const fromApp = app.getVersion();
      if (fromApp) return fromApp;
    }
  } catch {
    /* preload or non-electron context */
  }
  return readVersionFromPackageJson() || '1.1.8';
}

module.exports = { getAppVersion };
