const axios = require('axios');
const { getAppVersion } = require('./version');

const GITHUB_OWNER = 'Marfa';
const GITHUB_REPO = 'blinklearningdownloader';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

function parseVersion(version) {
  const match = String(version)
    .trim()
    .match(/^v?(\d+)\.(\d+)\.(\d+)/i);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function isNewer(latest, current) {
  const a = parseVersion(latest);
  const b = parseVersion(current);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] > b[i]) return true;
    if (a[i] < b[i]) return false;
  }
  return false;
}

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .replace(/^v/i, '');
}

async function checkForUpdate() {
  const currentVersion = getAppVersion();

  try {
    const { data } = await axios.get(RELEASES_API_URL, {
      timeout: 12_000,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'BlinkLearning-Downloader',
      },
    });

    const latestVersion = normalizeTag(data.tag_name || data.name);
    const updateAvailable = Boolean(latestVersion) && isNewer(latestVersion, currentVersion);

    return {
      ok: true,
      updateAvailable,
      currentVersion,
      latestVersion: updateAvailable ? latestVersion : null,
    };
  } catch {
    return { ok: false, updateAvailable: false, currentVersion, latestVersion: null };
  }
}

module.exports = { checkForUpdate, isNewer, parseVersion };
