(function initBlinkInputValidation(global) {
  function parseLessonIdOrUrl(input) {
    const trimmed = String(input ?? '').trim();
    if (!trimmed) return null;

    const looksLikeUrl =
      /^https?:\/\//i.test(trimmed) || trimmed.includes('/') || trimmed.includes('#');

    if (looksLikeUrl) {
      const hashPart = trimmed.includes('#') ? trimmed.split('#').pop() : trimmed;
      const withoutQuery = hashPart.split('?')[0];
      const lastSlash = withoutQuery.lastIndexOf('/');
      const segment =
        lastSlash >= 0 ? withoutQuery.slice(lastSlash + 1) : withoutQuery;
      const digits = segment.match(/(\d+)\s*$/)?.[1] || segment.match(/(\d+)/)?.[1];
      return digits || null;
    }

    const digitsOnly = trimmed.match(/^(\d+)$/)?.[1];
    if (digitsOnly) return digitsOnly;

    const trailingDigits = trimmed.match(/(\d+)\s*$/)?.[1];
    return trailingDigits || null;
  }

  function isUrlLikeInput(value) {
    const v = String(value ?? '');
    if (!v.trim()) return false;
    return (
      /^https?:/i.test(v) ||
      /blinklearning/i.test(v) ||
      /[#/.]/.test(v) ||
      /[a-z]/i.test(v)
    );
  }

  function filterDigits(value) {
    return String(value ?? '').replace(/\D/g, '');
  }

  function filterLessonInput(value) {
    const raw = String(value ?? '');
    if (!raw) return '';
    if (isUrlLikeInput(raw)) {
      return raw.replace(/[^\w:/?#.&=\-_%+@~]/gi, '');
    }
    return filterDigits(raw);
  }

  function validateLessonInput(value) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      return { ok: false, messageKey: 'validation.lessonRequired' };
    }

    if (isUrlLikeInput(trimmed)) {
      if (!/^https?:\/\//i.test(trimmed)) {
        return { ok: false, messageKey: 'validation.urlProtocol' };
      }
    } else if (!/^\d+$/.test(trimmed)) {
      return { ok: false, messageKey: 'validation.lessonDigitsOnly' };
    }

    const lessonId = parseLessonIdOrUrl(trimmed);
    if (!lessonId) {
      return { ok: false, messageKey: 'validation.lessonIdNotFound' };
    }

    return { ok: true, lessonId };
  }

  function validateDigitsField(value, fieldLabelKey) {
    const trimmed = String(value ?? '').trim();
    if (!trimmed) {
      return { ok: false, messageKey: 'validation.specifyField', messageParams: { field: fieldLabelKey } };
    }
    if (!/^\d+$/.test(trimmed)) {
      return {
        ok: false,
        messageKey: 'validation.digitsOnly',
        messageParams: { field: fieldLabelKey },
      };
    }
    return { ok: true, value: trimmed };
  }

  function bindDigitsOnlyInput(input, onChange) {
    input.addEventListener('input', () => {
      const filtered = filterDigits(input.value);
      if (input.value !== filtered) {
        input.value = filtered;
      }
      onChange?.();
    });
    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = (event.clipboardData || global.clipboardData).getData('text');
      const filtered = filterDigits(text);
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + filtered + input.value.slice(end);
      input.dispatchEvent(new Event('input'));
    });
  }

  function bindLessonInput(input, onChange) {
    input.addEventListener('input', () => {
      const filtered = filterLessonInput(input.value);
      if (input.value !== filtered) {
        input.value = filtered;
      }
      onChange?.();
    });
    input.addEventListener('paste', (event) => {
      event.preventDefault();
      const text = (event.clipboardData || global.clipboardData).getData('text');
      const filtered = filterLessonInput(text);
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? input.value.length;
      input.value = input.value.slice(0, start) + filtered + input.value.slice(end);
      input.dispatchEvent(new Event('input'));
    });
  }

  global.BlinkInputValidation = {
    filterDigits,
    filterLessonInput,
    isUrlLikeInput,
    parseLessonIdOrUrl,
    validateLessonInput,
    validateDigitsField,
    bindDigitsOnlyInput,
    bindLessonInput,
  };
})(window);
