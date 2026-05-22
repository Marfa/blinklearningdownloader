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

module.exports = { parseLessonIdOrUrl };
