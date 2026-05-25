const { readSettings } = require('./settings');
const { messages, normalizeLocale, translate } = require('./i18n-messages');

function getLocale() {
  try {
    const { settings } = readSettings();
    return normalizeLocale(settings.locale);
  } catch {
    return 'ru';
  }
}

function t(key, locale, params) {
  return translate(key, locale ?? getLocale(), params);
}

function formatBytes(n, locale) {
  const loc = normalizeLocale(locale ?? getLocale());
  if (!n || n < 0) return t('bytes.unit', loc, { n: 0 });
  if (n < 1024) return t('bytes.unit', loc, { n });
  if (n < 1024 * 1024) {
    return t('bytes.kb', loc, { n: (n / 1024).toFixed(1) });
  }
  return t('bytes.mb', loc, { n: (n / (1024 * 1024)).toFixed(1) });
}

module.exports = {
  LOCALES: require('./i18n-messages').LOCALES,
  messages,
  normalizeLocale,
  getLocale,
  t,
  formatBytes,
};
