#!/usr/bin/env bash
# Publish release to GitHub (push + tag + upload Windows assets; macOS if built).
# Requires: git push access, GitHub CLI (`gh auth login`).

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="1.2.0"
TAG="v${VERSION}"
RELEASE_DIR="${ROOT}/release-build"

cd "$ROOT"

if ! command -v gh >/dev/null 2>&1; then
  echo "Install GitHub CLI: https://cli.github.com/ (then: gh auth login)"
  exit 1
fi

MAC_DIR="${RELEASE_DIR}/mac"
WIN_SETUP="${RELEASE_DIR}/BlinkLearning-Downloader-Setup-${VERSION}.exe"
WIN_PORTABLE="${RELEASE_DIR}/BlinkLearning-Downloader-${VERSION}-win-x64-portable.exe"
WIN_ZIP="${RELEASE_DIR}/BlinkLearning-Downloader-${VERSION}-win-x64.zip"
WIN_LATEST="${RELEASE_DIR}/latest.yml"
MAC_ZIP="${MAC_DIR}/BlinkLearning-Downloader-${VERSION}-mac-arm64.zip"
MAC_LATEST="${MAC_DIR}/latest-mac.yml"

for f in "$WIN_SETUP" "$WIN_PORTABLE" "$WIN_ZIP" "$WIN_LATEST"; do
  if [[ ! -f "$f" ]]; then
    echo "Missing build artifact: $f"
    echo "Run: npm run dist:release"
    exit 1
  fi
done

ASSETS=("$WIN_SETUP" "$WIN_PORTABLE" "$WIN_ZIP" "$WIN_LATEST")
if [[ -f "$MAC_ZIP" && -f "$MAC_LATEST" ]]; then
  ASSETS+=("$MAC_ZIP" "$MAC_LATEST")
else
  echo "Note: macOS artifacts not found — publishing Windows only."
  echo "  (optional) npm run dist:mac -- -c.directories.output=release-build/mac"
fi

echo "Pushing main and tag ${TAG}..."
git push origin main
git tag -f "${TAG}" 2>/dev/null || git tag "${TAG}"
git push origin "${TAG}" --force-with-lease 2>/dev/null || git push origin "${TAG}"

NOTES_FILE="${ROOT}/CHANGELOG.md"
BODY="$(awk '/^## \[1.2.0\]/,/^## \[1.1.9\]/' "$NOTES_FILE" | sed '1d;$d')"

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

${BODY}
EOF
)" \
  "${ASSETS[@]}"

echo "Done: https://github.com/Marfa/blinklearningdownloader/releases/tag/${TAG}"
