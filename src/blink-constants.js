const LAUNCH_VERSION = '1779956752';

const LAUNCH_BASE = `https://www.blinklearning.com/v/${LAUNCH_VERSION}/themes/tmpux/launch.php`;

const MYBOOKS_HASH = '#content/mybooks';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

function buildBookHash(bookId) {
  return `#responsive/book/${bookId}`;
}

function buildExerciseUrl(bookId, activityId) {
  return `${LAUNCH_BASE}#responsive/book/${bookId}/${activityId}`;
}

module.exports = {
  LAUNCH_VERSION,
  LAUNCH_BASE,
  MYBOOKS_HASH,
  USER_AGENT,
  buildBookHash,
  buildExerciseUrl,
};
