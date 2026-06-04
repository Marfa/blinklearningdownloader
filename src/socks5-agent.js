/** SOCKS5 с DNS через прокси (как «удалённый DNS» в браузере). */
function socks5hAgentUrl(host, port) {
  return `socks5h://${host}:${port}`;
}

module.exports = { socks5hAgentUrl };
