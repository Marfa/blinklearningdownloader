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

let successHideTimer = null;
let downloadAllMode = false;
let removeProgressListener = null;

const inputValidation = window.BlinkInputValidation;

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

  if (phase === 'error' && message) {
    showDownloadProgress(message, percent ?? 0);
    showAudioStatus(message, 'error');
    return;
  }

  let text = message || '';
  if (!text && phase === 'resolve') text = 'Получение ссылки на файл…';
  if (!text && phase === 'download') text = 'Скачивание…';
  if (!text && phase === 'track' && trackNumber) {
    text = `Аудио ${trackNumber}${pista ? ` (${pista})` : ''}…`;
  }
  if (!text && index && total) text = `Файл ${index} из ${total}`;

  let pct = percent;
  if (pct === undefined && index && total && phase !== 'download') {
    pct = Math.round((index / total) * 100);
  }
  if (pct === undefined && received > 0 && total > 0) {
    pct = Math.min(100, Math.round((received / total) * 100));
  }

  showDownloadProgress(text, pct ?? 0);
}

function resetAudioForm() {
  downloadAllMode = false;
  audioSingle.value = '';
  audioFrom.value = '';
  audioTo.value = '';
  audioRangeFields.classList.add('hidden');
  downloadStartBtn.classList.add('hidden');
  clearAudioStatus();
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
    return inputValidation.validateDigitsField(single, 'номер аудио');
  }
  if (downloadAllMode) {
    const fromResult = inputValidation.validateDigitsField(audioFrom.value, 'номер «С»');
    if (!fromResult.ok) return fromResult;
    const toResult = inputValidation.validateDigitsField(audioTo.value, 'номер «По»');
    if (!toResult.ok) return toResult;
    if (Number(fromResult.value) > Number(toResult.value)) {
      return {
        ok: false,
        message: 'Номер «С» не может быть больше номера «По».',
      };
    }
    return { ok: true };
  }
  return { ok: false, message: 'Укажите номер аудио или диапазон.' };
}

function updateDownloadStartVisibility() {
  downloadStartBtn.classList.toggle('hidden', !canStartDownload());
}

function setDownloadControlsEnabled(enabled) {
  downloadStartBtn.disabled = !enabled;
  downloadAllBtn.disabled = !enabled;
  audioSingle.disabled = !enabled;
  audioFrom.disabled = !enabled;
  audioTo.disabled = !enabled;
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
  subtitle.textContent = 'Вход на blinklearning.com';

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
  stepSuccess.textContent = 'Авторизация прошла успешно.';
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

loadSavedSettings();

useProxy.addEventListener('change', () => {
  proxyFields.classList.toggle('hidden', !useProxy.checked);
  saveProxySettings();
});

proxyHost.addEventListener('change', saveProxySettings);
proxyPort.addEventListener('change', saveProxySettings);

instructionToggle.addEventListener('click', () => {
  const hidden = instructionPanel.classList.toggle('hidden');
  instructionToggle.setAttribute('aria-expanded', String(!hidden));
});

inputValidation.bindLessonInput(lessonInput, updateLessonNextVisibility);

lessonNextBtn.addEventListener('click', async () => {
  const raw = lessonInput.value.trim();
  const check = inputValidation.validateLessonInput(raw);
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
    stepSuccess.textContent = result?.message || 'Не удалось определить ID урока.';
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

downloadAllBtn.addEventListener('click', () => {
  downloadAllMode = true;
  audioRangeFields.classList.remove('hidden');
  updateDownloadStartVisibility();
});

function onAudioSingleInput() {
  if (audioSingle.value.trim()) {
    downloadAllMode = false;
    audioRangeFields.classList.add('hidden');
  }
  updateDownloadStartVisibility();
}

inputValidation.bindDigitsOnlyInput(audioSingle, onAudioSingleInput);
inputValidation.bindDigitsOnlyInput(audioFrom, updateDownloadStartVisibility);
inputValidation.bindDigitsOnlyInput(audioTo, updateDownloadStartVisibility);

downloadStartBtn.addEventListener('click', async () => {
  clearAudioStatus();

  const audioCheck = validateAudioDownloadInput();
  if (!audioCheck.ok) {
    showAudioStatus(audioCheck.message, 'error');
    return;
  }

  showDownloadProgress('Выбор папки…', 0);
  setDownloadControlsEnabled(false);

  try {
    const result = await window.blinkAuth.downloadAudio({
      single: audioSingle.value.trim(),
      rangeFrom: audioFrom.value.trim(),
      rangeTo: audioTo.value.trim(),
      useRange: downloadAllMode && !audioSingle.value.trim(),
    });

    if (result.canceled) {
      hideDownloadProgress();
      showAudioStatus('Скачивание отменено.', 'error');
      return;
    }

    if (result.ok) {
      showDownloadProgress('Готово', 100);
      const type = result.failed > 0 ? 'error' : 'success';
      showAudioStatus(result.message, type);
    } else {
      showDownloadProgress('Ошибка', 0);
      const detail =
        result.errors?.join(' ') ||
        result.message ||
        'Не удалось скачать аудио.';
      showAudioStatus(detail, 'error');
    }
  } catch (err) {
    showDownloadProgress('Ошибка', 0);
    showAudioStatus(err.message || 'Ошибка скачивания.', 'error');
  } finally {
    setDownloadControlsEnabled(true);
    updateDownloadStartVisibility();
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
    showStatus('Укажите IP и порт SOCKS5 прокси.', 'error');
    return;
  }

  await saveProxySettings();

  submitBtn.disabled = true;

  if (!window.blinkAuth?.login) {
    showStatus(
      'Ошибка инициализации. Закройте приложение и запустите снова через npm start.',
      'error'
    );
    submitBtn.disabled = false;
    return;
  }

  try {
    const result = await window.blinkAuth.login({ username, password, proxy });
    if (result.success) {
      await saveAuthSettings(username, password);
      showLessonStep(true);
    } else {
      showStatus(result.message || 'Ошибка авторизации.', 'error');
    }
  } catch (err) {
    showStatus(err.message || 'Неизвестная ошибка.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
});
