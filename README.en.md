# BlinkLearning Downloader

[Russian version](README.md)

Desktop app for **Windows** and **macOS** (Apple Silicon): sign in to [blinklearning.com](https://www.blinklearning.com), specify a lesson, and download MP3 audio (a single track or a range). SOCKS5 proxy is supported. The UI is available in **Russian** and **English**, styled like BlinkLearning.

## Download

Latest builds are on [GitHub Releases](https://github.com/Marfa/blinklearningdownloader/releases/latest).

| Platform | File | Description |
|----------|------|-------------|
| Windows | `BlinkLearning-Downloader-Setup-1.1.0.exe` | NSIS installer |
| Windows | `BlinkLearning-Downloader-1.1.0-win-x64-portable.exe` | Portable single `.exe` (no install) |
| Windows | `BlinkLearning-Downloader-1.1.0-win-x64.zip` | Zipped unpacked folder |
| macOS (Apple Silicon) | `BlinkLearning-Downloader-1.1.0-mac-arm64.zip` | `.app` bundle in a zip |

> **Android:** there is no mobile build in 1.1.0 — this project uses Electron for desktop OS only.

## Features

![App UI: sign-in, lesson selection, audio download](docs/app-screenshot.png)

1. **Sign in** — BlinkLearning username and password; optional “Remember username and password”.
2. **Proxy** — optional SOCKS5 (IP and port set by the user).
3. **Lesson** — lesson ID (digits only) or full URL from the browser; the ID is taken from the digits after the last `/` in the URL.
4. **Audio** — one track number or a “From”–“To” range; only digits are allowed in the fields.
5. **Listen** — play a single track in the app (when one track number is entered).
6. **Download** — choose a folder (default Downloads or the last folder used), with progress shown.
7. Download and listen controls are disabled while a download or playback preparation is in progress.
8. **Language** — switch between Russian and English; the choice is saved locally.
9. **Updates** — when a newer version is published on [GitHub Releases](https://github.com/Marfa/blinklearningdownloader/releases), a notice appears at the bottom of the window.
10. **About** — version and link to the repository.

Audio files on the CDN look like `PISTA06.mp3`, `PISTA24.mp3`, etc., under the lesson path on `blinklearning.com`.

### What’s new in 1.1.0

- **macOS** support (arm64).
- UI and icons aligned with [BlinkLearning](https://www.blinklearning.com/) branding.
- RU/EN language toggle with persisted locale.
- In-app audio preview.
- GitHub release update notification.
- macOS sign-in fix (preload / IPC bridge).
- **CC BY-NC-SA 4.0** license.

## Development

```bash
npm install
npm run sync:locale
npm start
```

## Building

**Windows** (installer + portable + zip):

```bash
npm install
npm run dist:win
```

**macOS** (Apple Silicon):

```bash
npm run dist:mac
```

Default output: `C:\Temp\blinklearningdownloader-build\` (Windows) or a custom folder via `--config.directories.output` (e.g. `release-build/`).

End users only need a file from the [release](https://github.com/Marfa/blinklearningdownloader/releases) — Node.js is not required.

On macOS, for an unsigned `.app`: right-click → Open → Open.

## Command-line checks (without the Electron UI)

Credentials via environment variables only:

```powershell
$env:BLINK_EMAIL="your@email"
$env:BLINK_PASSWORD="your-password"
# optional proxy:
$env:BLINK_PROXY="1"
$env:BLINK_PROXY_HOST="your.proxy.host"
$env:BLINK_PROXY_PORT="1080"

node scripts/test-auth.js
node scripts/test-audio-download.js
```

## Project structure

| Path | Purpose |
|------|---------|
| `src/main.js` | Electron, IPC, folder dialog |
| `src/auth.js` | Authentication, HTTP client, SOCKS |
| `src/audio.js` | Redirects, MP3 download and preview |
| `src/lesson.js` | Lesson ID / URL parsing |
| `src/settings.js` | Local settings (locale, proxy, credentials) |
| `src/i18n-messages.js` | UI strings (ru / en) |
| `src/update-check.js` | GitHub release version check |
| `src/renderer/` | UI and input validation |
| `assets/icons/` | App icons and branding |

## Development notes

Source code was prepared with [Cursor](https://cursor.com) (AI code editor).

## License

This project is licensed under **[CC BY-NC-SA 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)** (Attribution — NonCommercial — ShareAlike). See [LICENSE](LICENSE) for the full text.

You may use, modify, and share the code **with attribution**, **for non-commercial purposes only**, and **under the same license** (ShareAlike) for derivative works, to the extent permitted by law.
