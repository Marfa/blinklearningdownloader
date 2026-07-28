function isBlinklearningCdnHost(host) {
  const normalized = host.toLowerCase();
  if (!normalized.includes('files-r2')) return false;
  if (normalized === 'blinklearning.com' || normalized.endsWith('.blinklearning.com')) {
    return true;
  }
  if (normalized === 'blinklearning.net' || normalized.endsWith('.blinklearning.net')) {
    return true;
  }
  const labels = normalized.split('.');
  return labels.some((label) => label === 'files-r2' || label.startsWith('files-r2-'));
}

function isAllowedDownloadUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'blinklearning.com' || host.endsWith('.blinklearning.com')) return true;
    if (isBlinklearningCdnHost(host)) return true;
    return false;
  } catch {
    return false;
  }
}

function isCdnHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (
      isBlinklearningCdnHost(host) ||
      host === 'blinklearning.com' ||
      host.endsWith('.blinklearning.com')
    );
  } catch {
    return false;
  }
}

module.exports = { isAllowedDownloadUrl, isCdnHost };
