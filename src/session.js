const { parseLessonIdOrUrl } = require('./lesson');
const { t, getLocale } = require('./i18n');

const session = {
  lessonId: null,
  lessonInput: null,
  httpClient: null,
};

function setAuthenticatedClient(client) {
  session.httpClient = client;
}

function getHttpClient() {
  return session.httpClient;
}

function setLessonInput(rawInput) {
  const lessonId = parseLessonIdOrUrl(rawInput);
  if (!lessonId) {
    return {
      ok: false,
      message: t('session.lessonInvalid', getLocale()),
    };
  }

  session.lessonInput = String(rawInput).trim();
  session.lessonId = lessonId;

  return { ok: true, lessonId, lessonInput: session.lessonInput };
}

function getSession() {
  return {
    lessonId: session.lessonId,
    lessonInput: session.lessonInput,
    authenticated: Boolean(session.httpClient),
  };
}

function clearSession() {
  session.lessonId = null;
  session.lessonInput = null;
  session.httpClient = null;
}

module.exports = {
  setAuthenticatedClient,
  getHttpClient,
  setLessonInput,
  getSession,
  clearSession,
};
