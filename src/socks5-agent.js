const { isValidProxyHost, isValidProxyPort } = require('./proxy-host');

/** SOCKS5 с DNS через прокси (как «удалённый DNS» в браузере). */
function socks5hAgentUrl(host, port) {
  if (!isValidProxyHost(host)) {
    throw new Error('Invalid proxy host');
  }
  if (!isValidProxyPort(port)) {
    throw new Error('Invalid proxy port');
  }
  return `socks5h://${host}:${Number(port)}`;
}

module.exports = { socks5hAgentUrl };
