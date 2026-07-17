function isAllowedDownloadUrl(urlString) {
  try {
    const parsed = new URL(urlString);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'blinklearning.com' || host.endsWith('.blinklearning.com')) return true;
    const labels = host.split('.');
    if (labels.some((label) => label === 'files-r2' || label.startsWith('files-r2-'))) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function isCdnHost(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const labels = host.split('.');
    return (
      labels.some((label) => label === 'files-r2' || label.startsWith('files-r2-')) ||
      host === 'blinklearning.com' ||
      host.endsWith('.blinklearning.com')
    );
  } catch {
    return false;
  }
}

module.exports = { isAllowedDownloadUrl, isCdnHost };
