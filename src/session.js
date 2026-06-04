const { parseLessonIdOrUrl } = require('./lesson');
const { t, getLocale } = require('./i18n');

const session = {
  lessonId: null,
  lessonInput: null,
  exerciseUrl: null,
  exerciseTitle: null,
  bookTitle: null,
  chapterTitle: null,
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

function setExerciseSelection({
  lessonId,
  exerciseUrl,
  exerciseTitle,
  bookTitle,
  chapterTitle,
}) {
  if (!lessonId) {
    return { ok: false, message: t('session.exerciseRequired', getLocale()) };
  }

  session.lessonId = String(lessonId);
  session.lessonInput = exerciseUrl || session.lessonInput;
  session.exerciseUrl = exerciseUrl || null;
  session.exerciseTitle = exerciseTitle || null;
  session.bookTitle = bookTitle || null;
  session.chapterTitle = chapterTitle || null;

  return {
    ok: true,
    lessonId: session.lessonId,
    exerciseUrl: session.exerciseUrl,
    exerciseTitle: session.exerciseTitle,
  };
}

function getSession() {
  return {
    lessonId: session.lessonId,
    lessonInput: session.lessonInput,
    exerciseUrl: session.exerciseUrl,
    exerciseTitle: session.exerciseTitle,
    bookTitle: session.bookTitle,
    chapterTitle: session.chapterTitle,
    authenticated: Boolean(session.httpClient),
  };
}

function clearSession() {
  session.lessonId = null;
  session.lessonInput = null;
  session.exerciseUrl = null;
  session.exerciseTitle = null;
  session.bookTitle = null;
  session.chapterTitle = null;
  session.httpClient = null;
}

module.exports = {
  setAuthenticatedClient,
  getHttpClient,
  setLessonInput,
  setExerciseSelection,
  getSession,
  clearSession,
};
