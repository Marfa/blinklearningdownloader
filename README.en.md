# BlinkLearning Downloader

[Russian version](README.md)

Desktop app for **Windows** and **macOS** (Apple Silicon): sign in to [blinklearning.com](https://www.blinklearning.com), pick a textbook and exercise from the catalog, and download MP3 audio (single track, range, or auto-scan tracks 01–100). SOCKS5 proxy is supported. UI in **Russian** and **English**.

## Download

Latest builds: [GitHub Releases](https://github.com/Marfa/blinklearningdownloader/releases/latest).

| Platform | File | Description |
|----------|------|-------------|
| Windows | `BlinkLearning-Downloader-Setup-1.1.8.exe` | NSIS installer |
| Windows | `BlinkLearning-Downloader-1.1.8-win-x64-portable.exe` | Portable single `.exe` (no install) |
| Windows | `BlinkLearning-Downloader-1.1.8-win-x64.zip` | ZIP of the unpacked app folder |
| macOS (Apple Silicon) | `BlinkLearning-Downloader-1.2.0-mac-arm64.zip` | `.app` in a zip |

> **Android:** no mobile build — Electron desktop only.

See [CHANGELOG.md](CHANGELOG.md).

## Features

1. **Sign in** — BlinkLearning credentials; optional “Remember username and password”.
2. **Proxy** — optional SOCKS5 (manual or **Find proxy** — SOCKS5 list from [proxyscrape.com](https://proxyscrape.com/free-proxy-list), checked against blinklearning.com).
3. **Catalog** — textbooks (search, alphabetical), chapters, exercises; locked books show **Faltan Licencias**. Picking an exercise opens the audio download step.
4. **Audio** — one track, a range (**Download audio range**), or **Download all audio** (probes tracks 01–100).
5. **Listen** — preview a single track in the app.
6. **Download** — folder picker and progress.
7. **Language** — RU/EN toggle, saved locally.
8. **Updates** — notice when a newer release is available; the button asks “Update application?” and installs from [GitHub Releases](https://github.com/Marfa/blinklearningdownloader/releases) if confirmed.
9. **About** — version (with available update note) and source code link.

### What’s new in 1.2.0

- Fixed macOS auto-update hanging on “Installing update…”.
- Audio download for suffixed track filenames (`PISTA30_753257.mp3`) in Libro Digital exercises.

### What’s new in 1.1.9

- Security hardening: encrypted saved password, public-proxy warning, MP3 host allowlist, Electron sandbox.

### What’s new in 1.1.8

- Fixed app quit: Electron processes no longer linger after the window is closed.
- Catalog chapters sort by unit number (1, 2, … 10) instead of lexicographically.

### What’s new in 1.1.7

- Update notification only when the release includes artifacts for your platform (macOS / Windows).

### What’s new in 1.1.6

- In-app auto-update from the release notification (confirmation dialog).
- Improved About dialog.

### What’s new in 1.1.5

- SOCKS5 picker from proxyscrape.com; proxy check uses BlinkLearning reachability.
- More reliable textbook catalog loading (timeouts, proxy session).

### What’s new in 1.1.4

- Licensed textbooks listed first; **Libro Digital** sorted above **HTML con actividades**.

### What’s new in 1.1.3

- Textbook/chapter/exercise catalog; auto-advance after exercise selection.
- Download all / download range; textbook search; missing-license indicator.

## Development

```bash
npm install
npm run sync:locale
npm start
npm run check:i18n
```

## Building

**Windows** (installer + portable + zip):

```bash
npm run dist:win
```

**Release folder** (`release-build/`):

```bash
npm run dist:release
```

**macOS** (Apple Silicon), output `release-build/mac/`:

```bash
npm run dist:mac -- -c.directories.output=release-build/mac
```

Full release set:

```bash
npm run dist:release
npm run dist:mac -- -c.directories.output=release-build/mac
```

Default `dist:win` output: `C:\Temp\blinklearningdownloader-build\`.

## Command-line checks

Credentials **only** via environment variables (never committed):

```powershell
$env:BLINK_EMAIL="your@email"
$env:BLINK_PASSWORD="your-password"

node scripts/test-auth.js
node scripts/test-catalog.js
```

Do not commit real credentials. Local debug output lives under `scripts/probe-out/` (gitignored).

## License

**[CC BY-NC-SA 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)**. See [LICENSE](LICENSE).
