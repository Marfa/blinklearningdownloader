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
const statusEl = document.getElementById('status');
const submitBtn = document.getElementById('submit-btn');
const instructionToggle = document.getElementById('instruction-toggle');
const instructionPanel = document.getElementById('instruction-panel');
const lessonInput = document.getElementById('lesson-id');
const lessonNextBtn = document.getElementById('lesson-next-btn');
const lessonBackBtn = document.getElementById('lesson-back-btn');
const logoutBtn = document.getElementById('logout-btn');
const audioSingle = document.getElementById('audio-single');
const downloadAllBtn = document.getElementById('download-all-btn');
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

    if (!stepLogin.classList.contains('hidden')) {
      subtitle.textContent = tt('ui.login.subtitle');
    }
    if (
      !stepLesson.classList.contains('hidden') &&
      !stepSuccess.classList.contains('step-success--error') &&
      !stepSuccess.classList.contains('hidden')
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

function getProxyFromForm() {
  return {
    enabled: useProxy.checked,
    host: proxyHost.value.trim(),
    port: Number(proxyPort.value) || 0,
  };
}

async function saveProxySettings() {
  if (!window.blinkAuth?.saveSettings) return;
  await window.blinkAuth.saveSettings({ proxy: getProxyFromForm() });
}

function applyProxyToForm(proxy) {
  useProxy.checked = Boolean(proxy?.enabled);
  proxyHost.value = proxy?.host || '';
  proxyPort.value = proxy?.enabled && proxy?.port ? String(proxy.port) : '';
  proxyFields.classList.toggle('hidden', !useProxy.checked);
}

function hasLessonInputValue() {
  return lessonInput.value.trim().length > 0;
}

function updateLessonNextVisibility() {
  lessonNextBtn.classList.toggle('hidden', !hasLessonInputValue());
}

function scheduleHideSuccessMessage() {
  if (successHideTimer) clearTimeout(successHideTimer);
  stepSuccess.classList.remove('hidden');
  successHideTimer = setTimeout(() => {
    stepSuccess.classList.add('hidden');
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
  if (!text && phase === 'resolve') text = tt('progress.resolveLink');
  if (!text && phase === 'download') text = tt('progress.downloading');
  if (!text && phase === 'track' && trackNumber) {
    text = tt('progress.track', {
      track: trackNumber,
      pista: pista ? ` (${pista})` : '',
    });
  }
  if (!text && index && total) {
    text = tt('progress.fileOf', { index, total });
  }

  let pct = percent;
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
  downloadAllBtn.disabled = !enabled;
  audioSingle.disabled = !enabled;
  audioFrom.disabled = !enabled;
  audioTo.disabled = !enabled;
  updateAudioActionButtons();
}

async function restoreLessonInput() {
  const session = await window.blinkAuth?.getSession?.();
  if (session?.lessonInput) {
    lessonInput.value = session.lessonInput;
  }
}

function showLoginStep(clearCredentials = false) {
  hideAllSteps();
  stepLogin.classList.remove('hidden');
  subtitle.classList.remove('hidden');
  subtitle.textContent = tt('ui.login.subtitle');

  if (clearCredentials) {
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    rememberLogin.checked = false;
  }

  lessonInput.value = '';
  updateLessonNextVisibility();
  instructionPanel.classList.add('hidden');
  instructionToggle.setAttribute('aria-expanded', 'false');
  if (successHideTimer) clearTimeout(successHideTimer);
  stepSuccess.textContent = tt('ui.lesson.authSuccess');
  stepSuccess.classList.remove('hidden');
}

function showLessonStep(fromAuth = false) {
  hideAllSteps();
  stepLesson.classList.remove('hidden');
  subtitle.classList.add('hidden');
  stepSuccess.classList.remove('step-success--error');
  if (fromAuth) {
    scheduleHideSuccessMessage();
  } else {
    stepSuccess.classList.add('hidden');
  }
  lessonInput.focus();
  updateLessonNextVisibility();
}

async function showAudioStep() {
  hideAllSteps();
  stepAudio.classList.remove('hidden');
  subtitle.classList.add('hidden');
  resetAudioForm();
  audioSingle.focus();

  hideDownloadProgress();

  if (removeProgressListener) {
    removeProgressListener();
  }
  removeProgressListener = window.blinkAuth.onDownloadProgress?.((progress) => {
    handleProgressUpdate(progress);
  });
}

async function loadSavedSettings() {
  if (!window.blinkAuth?.getSettings) return;

  const { settings, fileExists } = await window.blinkAuth.getSettings();
  applyProxyToForm(settings.proxy);

  rememberLogin.checked = Boolean(settings.rememberLogin);
  if (settings.credentials) {
    document.getElementById('username').value = settings.credentials.username;
    document.getElementById('password').value = settings.credentials.password;
  }

  if (settings.locale) {
    window.BlinkLocale?.setLocale(settings.locale);
  }
  applyLocale();
}

async function saveAuthSettings(username, password) {
  if (!window.blinkAuth?.saveSettings) return;

  await window.blinkAuth.saveSettings({
    rememberLogin: rememberLogin.checked,
    credentials: rememberLogin.checked ? { username, password } : null,
  });
}

async function handleLogout() {
  await window.blinkAuth?.logout?.();
  showLoginStep(true);
}

const GITHUB_REPO_URL = 'https://github.com/Marfa/blinklearningdownloader';
const GITHUB_RELEASES_URL = 'https://github.com/Marfa/blinklearningdownloader/releases';

const updateNotice = document.getElementById('update-notice');
const helpBtn = document.getElementById('help-btn');
const helpModal = document.getElementById('help-modal');
const helpVersion = document.getElementById('help-version');
const helpGithubLink = document.getElementById('help-github-link');
const helpModalClose = document.getElementById('help-modal-close');
const helpModalBackdrop = document.getElementById('help-modal-backdrop');

function openHelpModal() {
  loadAppVersion();
  helpModal.classList.remove('hidden');
  helpModalClose.focus();
}

function closeHelpModal() {
  helpModal.classList.add('hidden');
  helpBtn.focus();
}

function loadAppVersion() {
  const version = window.blinkAuth?.getVersion?.();
  helpVersion.textContent = version || '1.1.2';
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
      updateNotice.dataset.latestVersion = result.latestVersion;
      updateNotice.classList.remove('hidden');
      updateNoticeLabel();
    }
  } catch (err) {
    console.error('checkForUpdate failed', err);
  }
}

if (updateNotice) {
  updateNotice.addEventListener('click', () => {
    window.blinkAuth?.openExternal?.(GITHUB_RELEASES_URL);
  });
}

helpBtn.addEventListener('click', openHelpModal);
helpModalClose.addEventListener('click', closeHelpModal);
helpModalBackdrop.addEventListener('click', closeHelpModal);

helpGithubLink.addEventListener('click', () => {
  window.blinkAuth?.openExternal?.(GITHUB_REPO_URL);
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
  saveProxySettings();
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
      await saveProxySettings();
      showStatus(
        tt('proxy.pickStage.success', {
          host: result.proxy.host,
          port: result.proxy.port,
        }),
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

instructionToggle.addEventListener('click', () => {
  const hidden = instructionPanel.classList.toggle('hidden');
  instructionToggle.setAttribute('aria-expanded', String(!hidden));
});

inputValidation.bindLessonInput(lessonInput, updateLessonNextVisibility);

lessonNextBtn.addEventListener('click', async () => {
  const raw = lessonInput.value.trim();
  const check = resolveValidationMessage(inputValidation.validateLessonInput(raw));
  if (!check.ok) {
    stepSuccess.textContent = check.message;
    stepSuccess.classList.remove('hidden');
    stepSuccess.classList.add('step-success--error');
    if (successHideTimer) clearTimeout(successHideTimer);
    return;
  }
  stepSuccess.classList.remove('step-success--error');

  const result = await window.blinkAuth.setLesson(raw);
  if (!result?.ok) {
    stepSuccess.textContent = result?.message || tt('renderer.lessonIdFailed');
    stepSuccess.classList.add('step-success--error');
    stepSuccess.classList.remove('hidden');
    if (successHideTimer) clearTimeout(successHideTimer);
    return;
  }
  stepSuccess.classList.remove('step-success--error');

  await showAudioStep();
});

lessonBackBtn.addEventListener('click', () => {
  showLoginStep(false);
});

audioBackBtn.addEventListener('click', async () => {
  await restoreLessonInput();
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

    const mediaUrl = window.blinkAuth?.toMediaUrl?.(result.filePath);
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

downloadAllBtn.addEventListener('click', () => {
  downloadAllMode = true;
  audioRangeFields.classList.remove('hidden');
  stopAudioPreview();
  updateAudioActionButtons();
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
