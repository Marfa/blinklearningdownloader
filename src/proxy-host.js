/** Reject hosts that could break socks5:// URL parsing (user/:@ etc.). */
function isValidProxyHost(host) {
  const h = String(host ?? '').trim();
  if (!h || h.length > 253) return false;
  if (/[^a-zA-Z0-9.-]/.test(h)) return false;
  if (h.includes('..') || h.startsWith('.') || h.endsWith('.')) return false;

  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(h)) {
    return h.split('.').every((octet) => {
      const n = Number(octet);
      return Number.isInteger(n) && n >= 0 && n <= 255;
    });
  }

  return /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/.test(
    h
  );
}

function isValidProxyPort(port) {
  const p = Number(port);
  return Number.isInteger(p) && p >= 1 && p <= 65535;
}

module.exports = { isValidProxyHost, isValidProxyPort };
