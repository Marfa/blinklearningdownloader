#!/usr/bin/env bash
# Publish release to GitHub (push + tag + upload Windows assets).
# Requires: git push access, GitHub CLI (`gh auth login`).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="1.1.5"
TAG="v${VERSION}"
RELEASE_DIR="${ROOT}/release-build"

cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/ (then: gh auth login)"
  exit 1
fi

WIN_SETUP="${RELEASE_DIR}/BlinkLearning-Downloader-Setup-${VERSION}.exe"
WIN_PORTABLE="${RELEASE_DIR}/BlinkLearning-Downloader-${VERSION}-win-x64-portable.exe"
WIN_ZIP="${RELEASE_DIR}/BlinkLearning-Downloader-${VERSION}-win-x64.zip"

for f in "$WIN_SETUP" "$WIN_PORTABLE" "$WIN_ZIP"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing build artifact: $f"
    echo "Run: npm run dist:release"
    exit 1
  fi
done

echo "Pushing main and tag ${TAG}..."
git push origin main
git tag -f "${TAG}" 2>/dev/null || git tag "${TAG}"
git push origin "${TAG}" --force-with-lease 2>/dev/null || git push origin "${TAG}"

NOTES_FILE="${ROOT}/CHANGELOG.md"
BODY="$(awk '/^## \[1.1.5\]/,/^## \[1.1.4\]/' "$NOTES_FILE" | sed '1d;$d')"

echo "Creating GitHub release ${TAG}..."
gh release delete "${TAG}" -y 2>/dev/null || true
gh release create "${TAG}" \
  --title "BlinkLearning Downloader ${VERSION}" \
  --notes "$(cat <<EOF
## BlinkLearning Downloader ${VERSION}

### Скачать / Download (Windows)

| Вариант | Файл |
|---------|------|
| Установщик | \`BlinkLearning-Downloader-Setup-${VERSION}.exe\` |
| Без установки (portable .exe) | \`BlinkLearning-Downloader-${VERSION}-win-x64-portable.exe\` |
| Архив распакованного приложения | \`BlinkLearning-Downloader-${VERSION}-win-x64.zip\` |

${BODY}
EOF
)" \
  "$WIN_SETUP" \
  "$WIN_PORTABLE" \
  "$WIN_ZIP"

echo "Done: https://github.com/Marfa/blinklearningdownloader/releases/tag/${TAG}"
