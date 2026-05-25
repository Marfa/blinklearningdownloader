#!/usr/bin/env bash
# Publish v1.1.0 to GitHub (push + release assets).
# Requires: git push access, GitHub CLI (`gh auth login`).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="1.1.0"
TAG="v${VERSION}"
RELEASE_DIR="${ROOT}/release-build"

cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/ (then: gh auth login)"
  exit 1
fi

WIN_DIR="${RELEASE_DIR}/win"
MAC_ZIP="${RELEASE_DIR}/mac/BlinkLearning-Downloader-${VERSION}-mac-arm64.zip"
WIN_SETUP="${WIN_DIR}/BlinkLearning-Downloader-Setup-${VERSION}.exe"
WIN_PORTABLE="${WIN_DIR}/BlinkLearning-Downloader-${VERSION}-win-x64-portable.exe"
WIN_ZIP="${WIN_DIR}/BlinkLearning-Downloader-${VERSION}-win-x64.zip"

for f in "$WIN_SETUP" "$WIN_PORTABLE" "$WIN_ZIP" "$MAC_ZIP"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing build artifact: $f"
    echo "Run: npm run dist:win && npm run dist:mac (with -c.directories.output=release-build/...)"
    exit 1
  fi
done

echo "Pushing main and tag ${TAG}..."
git push origin main
git tag -f "${TAG}" 2>/dev/null || git tag "${TAG}"
git push origin "${TAG}" --force-with-lease 2>/dev/null || git push origin "${TAG}"

echo "Creating GitHub release ${TAG}..."
gh release delete "${TAG}" -y 2>/dev/null || true
gh release create "${TAG}" \
  --title "BlinkLearning Downloader ${VERSION}" \
  --notes "$(cat <<EOF
## BlinkLearning Downloader ${VERSION}

### Скачать / Download

| Платформа | Файл |
|-----------|------|
| Windows (установщик) | \`BlinkLearning-Downloader-Setup-${VERSION}.exe\` |
| Windows (без установки) | \`BlinkLearning-Downloader-${VERSION}-win-x64-portable.exe\` |
| Windows (архив) | \`BlinkLearning-Downloader-${VERSION}-win-x64.zip\` |
| macOS Apple Silicon | \`BlinkLearning-Downloader-${VERSION}-mac-arm64.zip\` |

**Android:** мобильной сборки нет — приложение на Electron для Windows и macOS.

### Изменения / Changes

- Поддержка macOS (arm64), исправлен вход на macOS
- Оформление в стиле [BlinkLearning](https://www.blinklearning.com/)
- Языки RU / EN, прослушивание аудио в приложении
- Уведомление о новой версии на GitHub Releases
- Лицензия CC BY-NC-SA 4.0
EOF
)" \
  "$WIN_SETUP" \
  "$WIN_PORTABLE" \
  "$WIN_ZIP" \
  "$MAC_ZIP"

echo "Done: https://github.com/Marfa/blinklearningdownloader/releases/tag/${TAG}"
