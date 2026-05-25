(function initBlinkLocale(global) {
  const messages = global.BLINK_LOCALE_MESSAGES || { ru: {}, en: {} };
  let locale = 'ru';

  function normalizeLocale(value) {
    return value === 'en' ? 'en' : 'ru';
  }

  function interpolate(str, params) {
    let result = str;
    for (const [name, value] of Object.entries(params)) {
      result = result.split(`{${name}}`).join(String(value ?? ''));
    }
    return result;
  }

  function translate(key, params = {}) {
    const loc = normalizeLocale(locale);
    const safeParams = params && typeof params === 'object' ? params : {};
    const table = messages[loc] || messages.ru || {};
    let str = table[key] ?? messages.ru?.[key];
    if (str === undefined) return key;
    return interpolate(str, safeParams);
  }

  global.BlinkLocale = {
    t: translate,
    getLocale: () => locale,
    setLocale: (value) => {
      locale = normalizeLocale(value);
    },
    toggleLocale: () => {
      locale = locale === 'ru' ? 'en' : 'ru';
      return locale;
    },
    otherLocale: () => (locale === 'ru' ? 'en' : 'ru'),
  };
})(window);
