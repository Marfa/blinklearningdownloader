const form = document.getElementById('login-form');
const stepLogin = document.getElementById('step-login');
const stepLesson = document.getElementById('step-lesson');
const stepAudio = document.getElementById('step-audio');
const subtitle = document.getElementById('subtitle');
const stepSuccess = document.getElementById('step-success');
const useProxy = document.getElementById('use-proxy');
const rememberLogin = document.getElementById('remember-login');
const proxyFields = document.getElementById('proxy-fields');
const proxyHost = document.getElementById('proxy-host');
const proxyPort = document.getElementById('proxy-port');
const pickProxyBtn = document.getElementById('pick-proxy-btn');
const proxyAdBanner = document.getElementById('proxy-ad-banner');

const PROXY_AD_URL = 'https://proxys.world/?refid=41873';
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const catalogHeading = document.getElementById('catalog-heading');
const catalogStatus = document.getElementById('catalog-status');
const catalogList = document.getElementById('catalog-list');
const catalogSearchWrap = document.getElementById('catalog-search-wrap');
const catalogSearch = document.getElementById('catalog-search');
const lessonBackBtn = document.getElementById('lesson-back-btn');
const logoutBtn = document.getElementById('logout-btn');
const audioSingle = document.getElementById('audio-single');
const downloadRangeBtn = document.getElementById('download-range-btn');
const downloadAutoAllBtn = document.getElementById('download-auto-all-btn');
const audioRangeFields = document.getElementById('audio-range-fields');
const audioFrom = document.getElementById('audio-from');
const audioTo = document.getElementById('audio-to');
const downloadStartBtn = document.getElementById('download-start-btn');
const audioStatus = document.getElementById('audio-status');
const downloadProgress = document.getElementById('download-progress');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const audioBackBtn = document.getElementById('audio-back-btn');
const logoutBtnAudio = document.getElementById('logout-btn-audio');
const previewAudioBtn = document.getElementById('preview-audio-btn');
const audioPlayerWrap = document.getElementById('audio-player-wrap');
const audioPlayer = document.getElementById('audio-player');

let successHideTimer = null;
let downloadAllMode = false;
let removeProgressListener = null;
let audioBusy = false;
let proxyPickBusy = false;
let removeProxyPickListener = null;

const catalogState = {
  view: 'books',
  bookId: null,
  bookTitle: '',
  chapterId: null,
  chapterTitle: '',
  selectedExercise: null,
  allBooks: [],
};

let catalogLoadGeneration = 0;
let lessonAdvanceBusy = false;
/** @type {'login' | 'catalog' | 'audio'} */
let appStep = 'login';

function isCatalogStepActive() {
  return appStep === 'catalog';
}

function beginCatalogLoad() {
  catalogLoadGeneration += 1;
  return catalogLoadGeneration;
}

function isCatalogLoadCurrent(generation) {
  return generation === catalogLoadGeneration;
}

function cancelCatalogLoads() {
  catalogLoadGeneration += 1;
}

async function persistExerciseSelection(exercise) {
  if (!window.blinkAuth?.setExercise || !exercise) return null;
  return window.blinkAuth.setExercise({
    lessonId: exercise.lessonId || exercise.id,
    exerciseUrl: exercise.url,
    exerciseTitle: exercise.title,
    bookTitle: catalogState.bookTitle,
    chapterTitle: catalogState.chapterTitle,
    pistaManifest: exercise.pistaManifest || null,
    audioSuffix: exercise.audioSuffix || null,
    audioUploadId: exercise.audioUploadId || null,
  });
}

function applyExerciseSelection(exercise) {
  catalogState.selectedExercise = exercise;
  persistExerciseSelection(exercise).catch(() => {});
}

async function onExercisePicked(exercise) {
  if (!exercise || !isCatalogStepActive() || lessonAdvanceBusy) return;

  applyExerciseSelection(exercise);
  lessonAdvanceBusy = true;
  setCatalogStatus('');

  try {
    await goToAudioStep(exercise);
  } finally {
    lessonAdvanceBusy = false;
  }
}

function isSameCatalogItem(a, b) {
  if (!a || !b) return false;
  return (
    String(a.id) === String(b.id) ||
    String(a.lessonId || a.id) === String(b.lessonId || b.id)
  );
}

function findExerciseInList(exercises, selection) {
  if (!selection || !Array.isArray(exercises)) return null;
  const targetId = String(selection.id ?? selection.lessonId ?? '');
  const targetLesson = String(selection.lessonId ?? selection.id ?? '');
  return (
    exercises.find(
      (item) =>
        String(item.id) === targetId ||
        String(item.lessonId) === targetLesson ||
        (selection.url && item.url === selection.url)
    ) || null
  );
}

const inputValidation = window.BlinkInputValidation;

function tt(key, params) {
  if (!window.BlinkLocale?.t) return key;
  const safeParams = params && typeof params === 'object' ? params : {};
  return window.BlinkLocale.t(key, safeParams);
}

function resolveValidationMessage(result) {
  if (result?.ok || !result?.messageKey) return result;
  const params = { ...(result.messageParams || {}) };
  if (params.field) {
    params.field = tt(params.field);
  }
  return { ...result, message: tt(result.messageKey, params) };
}

function storeI18nKey(el, attr, datasetProp) {
  const fromAttr = el.getAttribute(attr);
  if (fromAttr && fromAttr.includes('.')) {
    el.dataset[datasetProp] = fromAttr;
  }
}

function cacheI18nKeys() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    storeI18nKey(el, 'data-i18n', 'i18nKey');
  });
  document.querySelectorAll('[data-i18n-html]').forEach((el) => {
    storeI18nKey(el, 'data-i18n-html', 'i18nHtmlKey');
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    storeI18nKey(el, 'data-i18n-placeholder', 'i18nPlaceholderKey');
  });
  document.querySelectorAll('[data-i18n-title]').forEach((el) => {
    storeI18nKey(el, 'data-i18n-title', 'i18nTitleKey');
  });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
    storeI18nKey(el, 'data-i18n-aria', 'i18nAriaKey');
  });
}

function hasNestedI18nChild(el, attr) {
  return [...el.querySelectorAll(attr)].some((node) => node !== el);
}

function updateLangButton() {
  const langBtn = document.getElementById('lang-btn');
  if (!langBtn || !window.BlinkLocale) return;

  const other = window.BlinkLocale.otherLocale();
  const label = langBtn.querySelector('.lang-btn-label');
  const text = other === 'en' ? tt('ui.lang.switchToEn') : tt('ui.lang.switchToRu');
  if (label) label.textContent = text;
  else langBtn.textContent = text;
  const switchLabel =
    other === 'en' ? tt('ui.lang.switchAriaToEn') : tt('ui.lang.switchAriaToRu');
  langBtn.setAttribute('aria-label', switchLabel);
  langBtn.title = switchLabel;
}

function applyLocale() {
  if (!window.BlinkLocale?.t) return;

  try {
    cacheI18nKeys();
    const locale = window.BlinkLocale.getLocale() ?? 'ru';
    document.documentElement.lang = locale;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      if (hasNestedI18nChild(el, '[data-i18n]')) return;
      const key = el.dataset.i18nKey;
      if (key) el.textContent = tt(key);
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      if (hasNestedI18nChild(el, '[data-i18n-html]')) return;
      const key = el.dataset.i18nHtmlKey;
      if (key) el.innerHTML = tt(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.dataset.i18nPlaceholderKey;
      if (key) el.placeholder = tt(key);
    });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.dataset.i18nTitleKey;
      if (key) el.title = tt(key);
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const key = el.dataset.i18nAriaKey;
      if (key) el.setAttribute('aria-label', tt(key));
    });

    updateLangButton();
    updateNoticeLabel();
    updateHelpVersionLabel();
    updateProxyAdBanner();

    if (!stepLogin.classList.contains('hidden')) {
      subtitle.textContent = tt('ui.login.subtitle');
    }
    if (
      !stepLesson.classList.contains('hidden') &&
      !stepSuccess.classList.contains('step-success--error') &&
      !stepSuccess.classList.contains('is-collapsed')
    ) {
      stepSuccess.textContent = tt('ui.lesson.authSuccess');
    }
  } catch (err) {
    console.error('applyLocale failed', err);
  }
}

async function persistLocale() {
  if (!window.blinkAuth?.saveSettings || !window.BlinkLocale) return;
  try {
    await window.blinkAuth.saveSettings({ locale: window.BlinkLocale.getLocale() });
  } catch (err) {
    console.error('save locale failed', err);
  }
}

function onLangButtonClick() {
  if (!window.BlinkLocale?.toggleLocale) return;

  window.BlinkLocale.toggleLocale();
  applyLocale();
  persistLocale();
}

let proxyFromPublicList = false;

function getProxyFromForm() {
  return {
    enabled: useProxy.checked,
    host: proxyHost.value.trim(),
    port: Number(proxyPort.value) || 0,
    untrustedPublic: Boolean(useProxy.checked && proxyFromPublicList),
  };
}

async function saveProxySettings() {
  if (!window.blinkAuth?.saveSettings) return;
  const result = await window.blinkAuth.saveSettings({ proxy: getProxyFromForm() });
  if (result && result.ok === false && result.message) {
    showStatus(result.message, 'error');
  }
}

function applyProxyToForm(proxy) {
  useProxy.checked = Boolean(proxy?.enabled);
  proxyHost.value = proxy?.host || '';
  proxyPort.value = proxy?.enabled && proxy?.port ? String(proxy.port) : '';
  proxyFromPublicList = Boolean(proxy?.enabled && proxy?.untrustedPublic);
  proxyFields.classList.toggle('hidden', !useProxy.checked);
  updateProxyAdBanner();
}

function updateProxyAdBanner() {
  if (!proxyAdBanner) return;
  const locale = window.BlinkLocale?.getLocale?.() ?? 'ru';
  const visible = locale === 'ru' && useProxy.checked;
  proxyAdBanner.classList.toggle('hidden', !visible);
}

function setCatalogStatus(message, isError = false) {
  if (!message) {
    catalogStatus.classList.add('hidden');
    catalogStatus.textContent = '';
    catalogStatus.classList.remove('error');
    return;
  }
  catalogStatus.textContent = message;
  catalogStatus.classList.toggle('error', isError);
  catalogStatus.classList.remove('hidden');
}

function setCatalogSearchVisible(visible) {
  catalogSearchWrap.classList.toggle('hidden', !visible);
  if (!visible) {
    catalogSearch.value = '';
  }
}

function filterBooksByQuery(books, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return books;
  return books.filter((b) => String(b.title || '').toLowerCase().includes(q));
}

function renderCatalogList(items, onSelect) {
  catalogList.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'catalog-item';
    if (item.locked) btn.classList.add('catalog-item--locked');
    btn.disabled = Boolean(item.disabled) || Boolean(item.locked);

    const title = document.createElement('span');
    title.className = 'catalog-item-title';
    title.textContent = item.title;
    btn.appendChild(title);

    if (item.locked) {
      const meta = document.createElement('span');
      meta.className = 'catalog-item-meta';

      const badge = document.createElement('span');
      badge.className = 'catalog-item-badge';
      badge.textContent = tt('ui.catalog.lockedBadge');

      const lock = document.createElement('span');
      lock.className = 'catalog-item-lock';
      lock.setAttribute('aria-label', tt('ui.catalog.lockedBadge'));
      lock.textContent = '🔒';

      meta.appendChild(badge);
      meta.appendChild(lock);
      btn.appendChild(meta);
    }

    if (
      catalogState.selectedExercise &&
      isSameCatalogItem(item, catalogState.selectedExercise)
    ) {
      btn.classList.add('catalog-item--selected');
    }

    if (!btn.disabled && onSelect) {
      btn.addEventListener('click', () => {
        if (!isCatalogStepActive()) return;
        onSelect(item);
      });
    }

    li.appendChild(btn);
    catalogList.appendChild(li);
  }
}

function renderCatalogBooks() {
  if (!isCatalogStepActive()) return;
  const filtered = filterBooksByQuery(catalogState.allBooks, catalogSearch.value);
  if (!filtered.length && catalogState.allBooks.length) {
    setCatalogStatus(tt('ui.catalog.searchEmpty'), true);
  } else {
    setCatalogStatus('');
  }
  renderCatalogList(filtered, async (book) => {
    if (book.locked || !isCatalogStepActive()) return;
    catalogState.bookId = book.id;
    catalogState.bookTitle = book.title;
    await loadCatalogChapters();
  });
}

async function loadCatalogBooks() {
  if (!isCatalogStepActive()) return;
  const loadGen = beginCatalogLoad();
  catalogState.view = 'books';
  catalogState.bookId = null;
  catalogState.chapterId = null;
  catalogState.selectedExercise = null;
  setCatalogSearchVisible(true);
  catalogHeading.textContent = tt('ui.catalog.booksTitle');
  setCatalogStatus(tt('ui.catalog.loadingBooks'));

  const result = await window.blinkAuth.listBooks();
  if (!isCatalogLoadCurrent(loadGen) || !isCatalogStepActive()) return;

  if (!result?.ok) {
    setCatalogSearchVisible(false);
    setCatalogStatus(result?.message || tt('catalog.loadBooksFailed'), true);
    renderCatalogList([]);
    return;
  }

  catalogState.allBooks = result.books || [];
  renderCatalogBooks();
}

async function loadCatalogChapters() {
  if (!isCatalogStepActive()) return;
  const loadGen = beginCatalogLoad();
  catalogState.view = 'chapters';
  catalogState.chapterId = null;
  catalogState.selectedExercise = null;
  setCatalogSearchVisible(false);
  catalogHeading.textContent = catalogState.bookTitle || tt('ui.catalog.chaptersTitle');
  setCatalogStatus(tt('ui.catalog.loadingChapters'));

  const result = await window.blinkAuth.listChapters(catalogState.bookId);
  if (!isCatalogLoadCurrent(loadGen) || !isCatalogStepActive()) return;

  if (!result?.ok) {
    setCatalogStatus(result?.message || tt('catalog.loadChaptersFailed'), true);
    renderCatalogList([]);
    return;
  }

  setCatalogStatus('');
  renderCatalogList(result.chapters || [], async (chapter) => {
    if (!isCatalogStepActive()) return;
    catalogState.chapterId = chapter.id;
    catalogState.chapterTitle = chapter.title;
    await loadCatalogExercises();
  });
}

async function loadCatalogExercises() {
  if (!isCatalogStepActive()) return;
  const loadGen = beginCatalogLoad();
  const preserveSelection = catalogState.selectedExercise;
  catalogState.view = 'exercises';
  catalogHeading.textContent = catalogState.chapterTitle || tt('ui.catalog.exercisesTitle');
  setCatalogStatus(tt('ui.catalog.loadingExercises'));

  const result = await window.blinkAuth.listExercises(
    catalogState.bookId,
    catalogState.chapterId
  );
  if (!isCatalogLoadCurrent(loadGen) || !isCatalogStepActive()) return;

  if (!result?.ok) {
    setCatalogStatus(result?.message || tt('catalog.loadExercisesFailed'), true);
    renderCatalogList([]);
    return;
  }

  setCatalogStatus('');
  const exercises = result.exercises || [];
  renderCatalogList(exercises, async (exercise) => {
    await onExercisePicked(exercise);
  });

  const sessionExercise = await getExerciseFromSession();
  const restored =
    findExerciseInList(exercises, preserveSelection) ||
    findExerciseInList(exercises, sessionExercise);
  if (restored) {
    applyExerciseSelection(restored);
  } else if (!preserveSelection) {
    catalogState.selectedExercise = null;
  }
}

async function getExerciseFromSession() {
  const session = await window.blinkAuth?.getSession?.();
  if (!session?.lessonId) return null;
  return {
    id: session.lessonId,
    lessonId: session.lessonId,
    url: session.exerciseUrl,
    title: session.exerciseTitle || session.lessonId,
  };
}

function onCatalogBack() {
  if (catalogState.view === 'exercises') {
    loadCatalogChapters();
    return;
  }
  if (catalogState.view === 'chapters') {
    if (catalogState.allBooks.length) {
      const loadGen = beginCatalogLoad();
      catalogState.view = 'books';
      catalogState.bookId = null;
      catalogState.chapterId = null;
      catalogState.selectedExercise = null;
      setCatalogSearchVisible(true);
      catalogHeading.textContent = tt('ui.catalog.booksTitle');
      setCatalogStatus('');
      if (isCatalogLoadCurrent(loadGen)) renderCatalogBooks();
    } else {
      loadCatalogBooks();
    }
  }
}

function scheduleHideSuccessMessage() {
  if (successHideTimer) clearTimeout(successHideTimer);
  stepSuccess.classList.remove('is-collapsed');
  successHideTimer = setTimeout(() => {
    stepSuccess.classList.add('is-collapsed');
  }, 10000);
}

function hideAllSteps() {
  stepLogin.classList.add('hidden');
  stepLesson.classList.add('hidden');
  stepAudio.classList.add('hidden');
}

function showAudioStatus(message, type = 'success') {
  audioStatus.textContent = message;
  audioStatus.className = `status ${type}`;
  audioStatus.classList.remove('hidden');
}

function clearAudioStatus() {
  audioStatus.classList.add('hidden');
  audioStatus.textContent = '';
}

function showDownloadProgress(message, percent) {
  downloadProgress.classList.remove('hidden');
  progressText.textContent = message || '';
  const value = Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0;
  progressFill.style.width = `${value}%`;
}

function hideDownloadProgress() {
  downloadProgress.classList.add('hidden');
  progressFill.style.width = '0%';
  progressText.textContent = '';
}

function handleProgressUpdate(payload) {
  const {
    index,
    total,
    phase,
    message,
    percent,
    trackNumber,
    pista,
    received,
    hop,
  } = payload;

  if (payload.preview) {
    if (message) {
      showAudioStatus(message, phase === 'error' ? 'error' : 'success');
    }
    return;
  }

  if (phase === 'error' && message) {
    showDownloadProgress(message, percent ?? 0);
    showAudioStatus(message, 'error');
    return;
  }

  let text = message || '';
  if (!text) {
    if (phase === 'discover' && trackNumber != null) {
      text = tt('audio.discoverTrack', { track: trackNumber, max: total || 100 });
    } else if (phase === 'resolve' && trackNumber != null) {
      text = tt('audio.discoverTrackProbe', {
        track: trackNumber,
        max: total || 100,
        hop: hop ?? 1,
      });
    } else if (phase === 'resolve') {
      text = tt('progress.resolveLink');
    } else if (phase === 'download') {
      text = tt('progress.downloading');
    } else if (phase === 'track' && trackNumber) {
      text = tt('progress.track', {
        track: trackNumber,
        pista: pista ? ` (${pista})` : '',
      });
    } else if (index && total) {
      text = tt('progress.fileOf', { index, total });
    }
  }

  let pct = percent;
  if (pct === undefined && phase === 'discover' && trackNumber && total) {
    pct = Math.round((trackNumber / total) * 100);
  }
  if (pct === undefined && index && total && phase !== 'download') {
    pct = Math.round((index / total) * 100);
  }
  if (pct === undefined && received > 0 && total > 0) {
    pct = Math.min(100, Math.round((received / total) * 100));
  }

  showDownloadProgress(text, pct ?? 0);
}

function stopAudioPreview() {
  audioPlayer.pause();
  audioPlayer.removeAttribute('src');
  audioPlayer.load();
  audioPlayerWrap.classList.add('hidden');
}

function resetAudioForm() {
  downloadAllMode = false;
  audioSingle.value = '';
  audioFrom.value = '';
  audioTo.value = '';
  audioRangeFields.classList.add('hidden');
  downloadStartBtn.classList.add('hidden');
  stopAudioPreview();
  clearAudioStatus();
  updateAudioActionButtons();
}

function canPreviewAudio() {
  return /^\d+$/.test(audioSingle.value.trim());
}

function canStartDownload() {
  const single = audioSingle.value.trim();
  if (single) return /^\d+$/.test(single);
  if (downloadAllMode) {
    const from = audioFrom.value.trim();
    const to = audioTo.value.trim();
    return /^\d+$/.test(from) && /^\d+$/.test(to);
  }
  return false;
}

function validateAudioDownloadInput() {
  const single = audioSingle.value.trim();
  if (single) {
    return resolveValidationMessage(
      inputValidation.validateDigitsField(single, 'validation.label.audioNumber')
    );
  }
  if (downloadAllMode) {
    const fromResult = resolveValidationMessage(
      inputValidation.validateDigitsField(audioFrom.value, 'validation.label.rangeFrom')
    );
    if (!fromResult.ok) return fromResult;
    const toResult = resolveValidationMessage(
      inputValidation.validateDigitsField(audioTo.value, 'validation.label.rangeTo')
    );
    if (!toResult.ok) return toResult;
    if (Number(fromResult.value) > Number(toResult.value)) {
      return { ok: false, message: tt('validation.rangeFromGtTo') };
    }
    return { ok: true };
  }
  return { ok: false, message: tt('validation.audioOrRange') };
}

function updateDownloadStartVisibility() {
  downloadStartBtn.classList.toggle('hidden', !canStartDownload());
}

function updateAudioActionButtons() {
  previewAudioBtn.disabled = !canPreviewAudio() || audioBusy;
  updateDownloadStartVisibility();
}

function setAudioControlsEnabled(enabled) {
  audioBusy = !enabled;
  downloadStartBtn.disabled = !enabled;
  downloadRangeBtn.disabled = !enabled;
  downloadAutoAllBtn.disabled = !enabled;
  audioSingle.disabled = !enabled;
  audioFrom.disabled = !enabled;
  audioTo.disabled = !enabled;
  updateAudioActionButtons();
}

async function restoreCatalogView() {
  if (!isCatalogStepActive()) return;
  if (catalogState.view === 'exercises' && catalogState.bookId && catalogState.chapterId) {
    const sessionExercise = await getExerciseFromSession();
    if (sessionExercise) catalogState.selectedExercise = sessionExercise;
    await loadCatalogExercises();
    return;
  }
  if (catalogState.view === 'chapters' && catalogState.bookId) {
    await loadCatalogChapters();
    return;
  }
  if (catalogState.allBooks.length) {
    catalogState.view = 'books';
    setCatalogSearchVisible(true);
    catalogHeading.textContent = tt('ui.catalog.booksTitle');
    renderCatalogBooks();
    return;
  }
  await loadCatalogBooks();
}

function showLoginStep(clearCredentials = false) {
  appStep = 'login';
  cancelCatalogLoads();
  hideAllSteps();
  stepLogin.classList.remove('hidden');
  subtitle.classList.remove('hidden');
  subtitle.textContent = tt('ui.login.subtitle');

  if (clearCredentials) {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    rememberLogin.checked = false;
  }

  catalogState.view = 'books';
  catalogState.selectedExercise = null;
  if (successHideTimer) clearTimeout(successHideTimer);
  stepSuccess.textContent = tt('ui.lesson.authSuccess');
  stepSuccess.classList.add('is-collapsed');
}

function showLessonStep(fromAuth = false) {
  appStep = 'catalog';
  hideAllSteps();
  stepLesson.classList.remove('hidden');
  subtitle.classList.add('hidden');
  stepSuccess.classList.remove('step-success--error');
  if (fromAuth) {
    scheduleHideSuccessMessage();
    loadCatalogBooks();
  } else {
    stepSuccess.classList.add('is-collapsed');
    restoreCatalogView();
  }
}

function mountAudioProgressListener() {
  if (removeProgressListener) {
    removeProgressListener();
  }
  removeProgressListener = window.blinkAuth.onDownloadProgress?.((progress) => {
    handleProgressUpdate(progress);
  });
}

function showAudioStepUi(exerciseTitle) {
  appStep = 'audio';
  cancelCatalogLoads();
  hideAllSteps();
  stepAudio.classList.remove('hidden');
  subtitle.classList.add('hidden');
  resetAudioForm();

  const audioHeading = document.querySelector('#step-audio .step-heading');
  if (audioHeading && exerciseTitle) {
    audioHeading.textContent = tt('ui.audio.headingWithExercise', { title: exerciseTitle });
  } else if (audioHeading) {
    audioHeading.textContent = tt('ui.audio.heading');
  }

  hideDownloadProgress();
  mountAudioProgressListener();
}

async function goToAudioStep(exercise) {
  if (!exercise) return false;

  showAudioStepUi(exercise.title);
  catalogState.selectedExercise = exercise;

  try {
    const result = await persistExerciseSelection(exercise);
    if (!result?.ok) {
      showAudioStatus(result?.message || tt('renderer.lessonIdFailed'), 'error');
      return false;
    }

    clearAudioStatus();
    try {
      audioSingle.focus();
    } catch {
      /* ignore focus errors */
    }
    return true;
  } catch (err) {
    showAudioStatus(err?.message || tt('renderer.lessonIdFailed'), 'error');
    return false;
  }
}

async function loadSavedSettings() {
  if (!window.blinkAuth?.getSettings) return;

  const { settings } = await window.blinkAuth.getSettings();
  encryptionAvailable = settings.encryptionAvailable !== false;
  applyProxyToForm(settings.proxy);

  rememberLogin.checked = Boolean(settings.rememberLogin) && !settings.proxy?.untrustedPublic;
  if (settings.credentials?.username) {
    document.getElementById('username').value = settings.credentials.username;
  }
  document.getElementById('password').value = '';

  if (settings.locale) {
    window.BlinkLocale?.setLocale(settings.locale);
  }
  applyLocale();
}

async function saveAuthSettings(username, password) {
  if (!window.blinkAuth?.saveSettings) return;

  const proxy = getProxyFromForm();
  if (proxy.untrustedPublic) {
    rememberLogin.checked = false;
    const result = await window.blinkAuth.saveSettings({
      rememberLogin: false,
      credentials: null,
    });
    if (result?.ok !== false) {
      showStatus(tt('proxy.untrustedNoRemember'), 'info');
    }
    return;
  }

  if (rememberLogin.checked && settingsEncryptionUnavailable()) {
    rememberLogin.checked = false;
    showStatus(tt('auth.encryptionUnavailable'), 'error');
    await window.blinkAuth.saveSettings({ rememberLogin: false, credentials: null });
    return;
  }

  const result = await window.blinkAuth.saveSettings({
    rememberLogin: rememberLogin.checked,
    credentials: rememberLogin.checked ? { username, password } : null,
  });

  if (result && result.ok === false) {
    rememberLogin.checked = false;
    showStatus(result.message || tt('auth.encryptionUnavailable'), 'error');
  }
}

let encryptionAvailable = true;
function settingsEncryptionUnavailable() {
  return encryptionAvailable === false;
}

async function handleLogout() {
  await window.blinkAuth?.logout?.();
  showLoginStep(true);
}

const GITHUB_REPO_URL = 'https://github.com/Marfa/blinklearningdownloader';
const DONATE_URL = 'https://www.donationalerts.com/r/themarfa';
const DONATE_CRYPTO_URL = 'https://nowpayments.io/donation/themarfa';

const updateNotice = document.getElementById('update-notice');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const helpVersion = document.getElementById('help-version');
const helpVersionUpdate = document.getElementById('help-version-update');
const helpGithubLink = document.getElementById('help-github-link');
const helpDonateLink = document.getElementById('help-donate-link');
const helpDonateCryptoLink = document.getElementById('help-donate-crypto-link');
const helpModalClose = document.getElementById('help-modal-close');
const helpModalBackdrop = document.getElementById('help-modal-backdrop');

let latestAvailableVersion = null;

async function openHelpModal() {
  loadAppVersion();
  helpModal.classList.remove('hidden');
  helpModalClose.focus();
  await refreshHelpVersionFromUpdateCheck();
}

function closeHelpModal() {
  helpModal.classList.add('hidden');
  helpBtn.focus();
}

function loadAppVersion() {
  const apply = (version) => {
    helpVersion.textContent = version || '1.2.1';
    updateHelpVersionLabel();
  };

  const result = window.blinkAuth?.getVersion?.();
  if (result && typeof result.then === 'function') {
    result.then(apply).catch(() => apply(null));
    return;
  }
  apply(result);
}

function updateHelpVersionLabel() {
  if (!helpVersionUpdate) return;
  if (latestAvailableVersion) {
    helpVersionUpdate.textContent = ` ${tt('ui.help.versionAvailable', { version: latestAvailableVersion })}`;
    helpVersionUpdate.classList.remove('hidden');
  } else {
    helpVersionUpdate.textContent = '';
    helpVersionUpdate.classList.add('hidden');
  }
}

async function refreshHelpVersionFromUpdateCheck() {
  if (!window.blinkAuth?.checkForUpdate) return;

  try {
    const result = await window.blinkAuth.checkForUpdate();
    if (result.ok && result.updateAvailable && result.latestVersion) {
      latestAvailableVersion = result.latestVersion;
    } else {
      latestAvailableVersion = null;
    }
  } catch (err) {
    console.error('refreshHelpVersionFromUpdateCheck failed', err);
  }

  updateHelpVersionLabel();
}

function updateNoticeLabel() {
  if (!updateNotice || updateNotice.classList.contains('hidden')) return;
  const version = updateNotice.dataset.latestVersion;
  if (!version) return;
  const label = updateNotice.querySelector('.update-notice-label');
  const text = tt('ui.update.available', { version });
  if (label) label.textContent = text;
  else updateNotice.textContent = text;
  const aria = tt('ui.update.aria');
  updateNotice.setAttribute('aria-label', aria);
  updateNotice.title = aria;
}

async function checkAppUpdate() {
  if (!updateNotice || !window.blinkAuth?.checkForUpdate) return;

  try {
    const result = await window.blinkAuth.checkForUpdate();
    if (result.ok && result.updateAvailable && result.latestVersion) {
      latestAvailableVersion = result.latestVersion;
      updateNotice.dataset.latestVersion = result.latestVersion;
      updateNotice.classList.remove('hidden');
      updateNoticeLabel();
      updateHelpVersionLabel();
    }
  } catch (err) {
    console.error('checkForUpdate failed', err);
  }
}

let removeUpdateProgressListener = null;

function updateProgressStatusText(progress) {
  if (!progress?.phase) return '';
  switch (progress.phase) {
    case 'checking':
      return tt('ui.update.checking');
    case 'downloading':
      return tt('ui.update.downloading', { percent: progress.percent ?? 0 });
    case 'installing':
      return tt('ui.update.installing');
    default:
      return '';
  }
}

async function onUpdateNoticeClick() {
  if (!window.blinkAuth?.promptUpdate) return;

  removeUpdateProgressListener?.();
  removeUpdateProgressListener = window.blinkAuth.onUpdateProgress?.((progress) => {
    const text = updateProgressStatusText(progress);
    if (text) showStatus(text, 'info');
  });

  try {
    const result = await window.blinkAuth.promptUpdate();
    if (result?.cancelled) return;
    if (!result?.ok && result?.message) {
      showStatus(result.message, 'error');
    }
  } catch (err) {
    console.error('promptUpdate failed', err);
    showStatus(tt('update.failed'), 'error');
  } finally {
    removeUpdateProgressListener?.();
    removeUpdateProgressListener = null;
  }
}

if (updateNotice) {
  updateNotice.addEventListener('click', onUpdateNoticeClick);
}

helpBtn.addEventListener('click', openHelpModal);
helpModalClose.addEventListener('click', closeHelpModal);
helpModalBackdrop.addEventListener('click', closeHelpModal);

helpGithubLink.addEventListener('click', () => {
  window.blinkAuth?.openExternal?.(GITHUB_REPO_URL);
});

helpDonateLink.addEventListener('click', () => {
  window.blinkAuth?.openExternal?.(DONATE_URL);
});

helpDonateCryptoLink.addEventListener('click', () => {
  window.blinkAuth?.openExternal?.(DONATE_CRYPTO_URL);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !helpModal.classList.contains('hidden')) {
    closeHelpModal();
  }
});

function initFloatingButtons() {
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) {
    langBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      onLangButtonClick();
    });
  }
}

cacheI18nKeys();
initFloatingButtons();

if (!window.blinkAuth?.login) {
  showStatus(tt('renderer.initError'), 'error');
  submitBtn.disabled = true;
}

loadSavedSettings();
loadAppVersion();
checkAppUpdate();

useProxy.addEventListener('change', () => {
  proxyFields.classList.toggle('hidden', !useProxy.checked);
  updateProxyAdBanner();
  saveProxySettings();
});

if (proxyAdBanner) {
  proxyAdBanner.addEventListener('click', () => {
    window.blinkAuth?.openExternal?.(PROXY_AD_URL);
  });
}

proxyHost.addEventListener('input', () => {
  proxyFromPublicList = false;
});
proxyPort.addEventListener('input', () => {
  proxyFromPublicList = false;
});
proxyHost.addEventListener('change', saveProxySettings);
proxyPort.addEventListener('change', saveProxySettings);

function setProxyPickBusy(busy) {
  proxyPickBusy = busy;
  if (pickProxyBtn) pickProxyBtn.disabled = busy;
  if (busy) submitBtn.disabled = true;
  else submitBtn.disabled = false;
}

function proxyPickStatusText(progress) {
  if (!progress?.phase) return '';

  switch (progress.phase) {
    case 'loadingList':
      return tt('proxy.pickStage.loadingList');
    case 'loadingFallback':
      return tt('proxy.pickStage.loadingFallback');
    case 'checkingServer':
      return tt('proxy.pickStage.checkingServer', {
        host: progress.host ?? '—',
        current: progress.current ?? 0,
        total: progress.total ?? 0,
      });
    case 'tryingPort':
      return tt('proxy.pickStage.tryingPort', {
        host: progress.host ?? '—',
        port: progress.port ?? '—',
      });
    default:
      return '';
  }
}

async function onPickProxyClick() {
  if (!window.blinkAuth?.pickProxy || proxyPickBusy) return;

  if (!useProxy.checked) {
    useProxy.checked = true;
    proxyFields.classList.remove('hidden');
    updateProxyAdBanner();
  }

  setProxyPickBusy(true);
  showStatus(tt('proxy.pickStage.loadingList'), 'info');

  removeProxyPickListener?.();
  removeProxyPickListener = window.blinkAuth.onProxyPickProgress?.((progress) => {
    const text = proxyPickStatusText(progress);
    if (text) showStatus(text, 'info');
  });

  try {
    const result = await window.blinkAuth.pickProxy();
    if (result?.ok && result.proxy) {
      proxyHost.value = result.proxy.host;
      proxyPort.value = String(result.proxy.port);
      proxyFromPublicList = true;
      rememberLogin.checked = false;
      await saveProxySettings();
      showStatus(
        `${tt('proxy.pickStage.success', {
          host: result.proxy.host,
          port: result.proxy.port,
        })} ${tt('proxy.untrustedNoRemember')}`,
        'success'
      );
    } else {
      showStatus(result?.message || tt('proxy.pickFailed'), 'error');
    }
  } catch (err) {
    showStatus(err?.message || tt('proxy.pickFailed'), 'error');
  } finally {
    removeProxyPickListener?.();
    removeProxyPickListener = null;
    setProxyPickBusy(false);
  }
}

if (pickProxyBtn) {
  pickProxyBtn.addEventListener('click', onPickProxyClick);
}

catalogSearch.addEventListener('input', () => {
  if (catalogState.view === 'books') renderCatalogBooks();
});

lessonBackBtn.addEventListener('click', () => {
  if (catalogState.view === 'chapters' || catalogState.view === 'exercises') {
    onCatalogBack();
    return;
  }
  showLoginStep(false);
});

audioBackBtn.addEventListener('click', () => {
  showLessonStep(false);
});

function onAudioSingleInput() {
  if (audioSingle.value.trim()) {
    downloadAllMode = false;
    audioRangeFields.classList.add('hidden');
  } else {
    stopAudioPreview();
  }
  updateAudioActionButtons();
}

inputValidation.bindDigitsOnlyInput(audioSingle, onAudioSingleInput);
inputValidation.bindDigitsOnlyInput(audioFrom, () => updateAudioActionButtons());
inputValidation.bindDigitsOnlyInput(audioTo, () => updateAudioActionButtons());

previewAudioBtn.addEventListener('click', async () => {
  clearAudioStatus();
  hideDownloadProgress();

  const audioCheck = resolveValidationMessage(
    inputValidation.validateDigitsField(audioSingle.value, 'validation.label.audioNumber')
  );
  if (!audioCheck.ok) {
    showAudioStatus(audioCheck.message, 'error');
    return;
  }

  const trackNumber = audioCheck.value;
  stopAudioPreview();
  setAudioControlsEnabled(false);
  showAudioStatus(tt('ui.audio.previewLoading'), 'success');

  try {
    const result = await window.blinkAuth?.previewAudio?.(trackNumber);
    if (!result?.ok) {
      showAudioStatus(result?.message || tt('main.previewError'), 'error');
      return;
    }

    const mediaUrl = result.mediaUrl;
    if (!mediaUrl) {
      showAudioStatus(tt('main.previewError'), 'error');
      return;
    }

    audioPlayer.src = mediaUrl;
    audioPlayerWrap.classList.remove('hidden');
    showAudioStatus(tt('ui.audio.previewNow', { track: trackNumber }), 'success');
    await audioPlayer.play();
  } catch (err) {
    showAudioStatus(err.message || tt('main.previewError'), 'error');
  } finally {
    setAudioControlsEnabled(true);
  }
});

downloadRangeBtn.addEventListener('click', () => {
  downloadAllMode = true;
  audioRangeFields.classList.remove('hidden');
  stopAudioPreview();
  updateAudioActionButtons();
});

downloadAutoAllBtn.addEventListener('click', async () => {
  clearAudioStatus();
  hideDownloadProgress();
  stopAudioPreview();
  setAudioControlsEnabled(false);
  showAudioStatus(tt('audio.discoverStart'), 'info');

  try {
    const result = await window.blinkAuth.downloadAudioAuto?.();
    if (result?.canceled) {
      hideDownloadProgress();
      showAudioStatus(tt('renderer.downloadCanceled'), 'error');
      return;
    }
    if (result?.ok) {
      showDownloadProgress(tt('renderer.done'), 100);
      showAudioStatus(result.message, 'success');
    } else {
      hideDownloadProgress();
      showAudioStatus(result?.message || tt('renderer.downloadFailed'), 'error');
    }
  } catch (err) {
    hideDownloadProgress();
    showAudioStatus(err?.message || tt('renderer.downloadError'), 'error');
  } finally {
    setAudioControlsEnabled(true);
  }
});

downloadStartBtn.addEventListener('click', async () => {
  clearAudioStatus();

  const audioCheck = validateAudioDownloadInput();
  if (!audioCheck.ok) {
    showAudioStatus(audioCheck.message, 'error');
    return;
  }

  showDownloadProgress(tt('renderer.chooseFolder'), 0);
  stopAudioPreview();
  setAudioControlsEnabled(false);

  try {
    const result = await window.blinkAuth.downloadAudio({
      single: audioSingle.value.trim(),
      rangeFrom: audioFrom.value.trim(),
      rangeTo: audioTo.value.trim(),
      useRange: downloadAllMode && !audioSingle.value.trim(),
    });

    if (result.canceled) {
      hideDownloadProgress();
      showAudioStatus(tt('renderer.downloadCanceled'), 'error');
      return;
    }

    if (result.ok) {
      showDownloadProgress(tt('renderer.done'), 100);
      const type = result.failed > 0 ? 'error' : 'success';
      showAudioStatus(result.message, type);
    } else {
      showDownloadProgress(tt('renderer.error'), 0);
      const detail =
        result.errors?.join(' ') ||
        result.message ||
        tt('renderer.downloadFailed');
      showAudioStatus(detail, 'error');
    }
  } catch (err) {
    showDownloadProgress(tt('renderer.error'), 0);
    showAudioStatus(err.message || tt('renderer.downloadError'), 'error');
  } finally {
    setAudioControlsEnabled(true);
  }
});

logoutBtn.addEventListener('click', handleLogout);
logoutBtnAudio.addEventListener('click', handleLogout);

function showStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = `status ${type}`;
  statusEl.classList.remove('hidden');
}

function clearStatus() {
  statusEl.classList.add('hidden');
  statusEl.textContent = '';
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearStatus();

  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;
  const proxy = getProxyFromForm();

  if (proxy.enabled && (!proxy.host || !proxy.port)) {
    showStatus(tt('renderer.proxyRequired'), 'error');
    return;
  }

  await saveProxySettings();

  submitBtn.disabled = true;

  if (!window.blinkAuth?.login) {
    showStatus(tt('renderer.initError'), 'error');
    submitBtn.disabled = false;
    return;
  }

  try {
    const result = await window.blinkAuth.login({ username, password, proxy });
    if (result.success) {
      await saveAuthSettings(username, password);
      showLessonStep(true);
    } else {
      showStatus(result.message || tt('renderer.authFailed'), 'error');
    }
  } catch (err) {
    showStatus(err.message || tt('renderer.unknownError'), 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
