const axios = require('axios');
const { getAppVersion } = require('./version');

const GITHUB_OWNER = 'Marfa';
const GITHUB_REPO = 'blinklearningdownloader';
const RELEASES_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases`;

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

function releaseAssetNames(release) {
  return (release.assets || []).map((asset) => asset.name);
}

function releaseHasPlatformAssets(release, platform) {
  const names = releaseAssetNames(release);
  if (platform === 'darwin') {
    return names.includes('latest-mac.yml') || names.some((name) => /-mac-/i.test(name));
  }
  if (platform === 'win32') {
    return (
      names.includes('latest.yml') ||
      names.some((name) => /\.exe$/i.test(name) || /-win-/i.test(name))
    );
  }
  return false;
}

function findLatestPlatformVersion(releases, platform) {
  let latest = null;
  for (const release of releases) {
    if (release.draft || release.prerelease) continue;
    const version = normalizeTag(release.tag_name || release.name);
    if (!version || !releaseHasPlatformAssets(release, platform)) continue;
    if (!latest || isNewer(version, latest)) latest = version;
  }
  return latest;
}

async function checkForUpdate() {
  const currentVersion = getAppVersion();
  const platform = process.platform;

  try {
    const { data } = await axios.get(RELEASES_API_URL, {
      params: { per_page: 30 },
      timeout: 12_000,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'BlinkLearning-Downloader',
      },
    });

    const latestVersion = findLatestPlatformVersion(data, platform);
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

if (require.main === module) {
  const assert = (cond, msg) => {
    if (!cond) throw new Error(msg);
  };

  assert(releaseHasPlatformAssets({ assets: [{ name: 'latest-mac.yml' }] }, 'darwin'));
  assert(!releaseHasPlatformAssets({ assets: [{ name: 'latest.yml' }] }, 'darwin'));
  assert(releaseHasPlatformAssets({ assets: [{ name: 'latest.yml' }] }, 'win32'));
  assert(!releaseHasPlatformAssets({ assets: [{ name: 'latest-mac.yml' }] }, 'win32'));

  const releases = [
    { tag_name: 'v1.2.0', assets: [{ name: 'Setup.exe' }], draft: false, prerelease: false },
    {
      tag_name: 'v1.1.8',
      assets: [{ name: 'BlinkLearning-Downloader-1.1.8-mac-arm64.zip' }],
      draft: false,
      prerelease: false,
    },
  ];
  assert(findLatestPlatformVersion(releases, 'darwin') === '1.1.8');
  assert(findLatestPlatformVersion(releases, 'win32') === '1.2.0');

  console.log('update-check self-check ok');
}

module.exports = {
  checkForUpdate,
  isNewer,
  parseVersion,
  releaseHasPlatformAssets,
  findLatestPlatformVersion,
};
