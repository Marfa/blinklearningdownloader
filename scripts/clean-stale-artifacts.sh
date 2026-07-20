#!/bin/sh
# Remove local build/debug artifacts older than 7 days.
# Paths mirror .gitignore (excluding node_modules, .node-local, settings.json).
set -eu

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT"

MAX_AGE_DAYS=7

clean_tree() {
  path="$1"
  [ -e "$path" ] || return 0
  find "$path" -type f -mtime +"$MAX_AGE_DAYS" -delete 2>/dev/null || true
  find "$path" -depth -type d -empty -delete 2>/dev/null || true
}

clean_tree release-build
clean_tree dist
clean_tree path
clean_tree scripts/probe-out
clean_tree scripts/audio-test-out

for f in bundle.main.js launch.html scripts/app-bundle-snippet.txt; do
  if [ -f "$f" ] && find "$f" -mtime +"$MAX_AGE_DAYS" -print -quit | grep -q .; then
    rm -f "$f"
  fi
done

find scripts -maxdepth 1 -type f \( -name '*.html' -o -name '*.mp3' \) -mtime +"$MAX_AGE_DAYS" -delete 2>/dev/null || true

find . \( -path './node_modules' -o -path './.git' -o -path './.node-local' \) -prune \
  -o -type f -name '*.log' -mtime +"$MAX_AGE_DAYS" -delete 2>/dev/null || true
