# BlinkLearning Downloader

[English version](README.en.md)

Десктопное приложение для **Windows** и **macOS** (Apple Silicon): вход на [blinklearning.com](https://www.blinklearning.com), указание урока и скачивание MP3-аудио (один трек или диапазон). Поддерживается SOCKS5-прокси. Интерфейс на **русском** и **английском** языках, оформление в стиле BlinkLearning.

## Скачать

Актуальные сборки — на странице [релизов GitHub](https://github.com/Marfa/blinklearningdownloader/releases/latest).

| Платформа | Файл | Описание |
|-----------|------|----------|
| Windows | `BlinkLearning-Downloader-Setup-1.1.2.exe` | Установщик (NSIS) |
| Windows | `BlinkLearning-Downloader-1.1.2-win-x64-portable.exe` | Без установки — один переносимый `.exe` |
| Windows | `BlinkLearning-Downloader-1.1.2-win-x64.zip` | Архив распакованной папки (portable) |
| macOS (Apple Silicon) | `BlinkLearning-Downloader-1.1.2-mac-arm64.zip` | Приложение `.app` в архиве |

> **Android:** мобильной сборки нет — проект основан на Electron для настольных ОС.

История изменений — в [CHANGELOG.md](CHANGELOG.md).

## Возможности

![Интерфейс приложения: вход, выбор урока, скачивание аудио](docs/app-screenshot.png)

1. **Вход** — логин и пароль BlinkLearning, опционально «Запомнить логин-пароль».
2. **Прокси** — опциональный SOCKS5 (IP и порт вручную или **«Подобрать прокси»** — список с proxy-tools.com, проверка через x.com).
3. **Урок** — ID урока (только цифры) или полная ссылка из браузера; ID извлекается из цифр после последнего `/` в URL.
4. **Аудио** — один номер или диапазон «С»–«По»; в полях допускаются только цифры.
5. **Прослушивание** — воспроизведение одного трека в приложении (если указан номер аудио).
6. **Скачивание** — выбор папки (по умолчанию «Загрузки» или последняя выбранная), отображение прогресса.
7. Кнопки скачивания и прослушивания недоступны, пока идёт загрузка или подготовка воспроизведения.
8. **Язык** — переключение русский / английский; выбор сохраняется локально.
9. **Обновления** — при выходе новой версии на [GitHub Releases](https://github.com/Marfa/blinklearningdownloader/releases) показывается уведомление внизу окна.
10. **О программе** — версия и ссылка на репозиторий.

Формат файлов на CDN: `PISTA06.mp3`, `PISTA24.mp3` и т.д. в каталоге урока на `blinklearning.com`.

### Что нового в 1.1.2

- Автоподбор SOCKS5-прокси с понятными этапами в интерфейсе.

### Что нового в 1.1.0

- Поддержка **macOS** (arm64).
- Оформление и иконки в стиле [BlinkLearning](https://www.blinklearning.com/).
- Переключение языка RU/EN в интерфейсе (сохранение в настройках).
- Прослушивание аудио в приложении.
- Уведомление о доступной новой версии на GitHub.
- Исправлена авторизация на macOS (preload / мост IPC).
- Лицензия **CC BY-NC-SA 4.0**.

## Запуск в режиме разработки

```bash
npm install
npm run sync:locale
npm start
```

## Сборка

**Windows** (установщик + portable + zip):

```bash
npm install
npm run dist:win
```

**macOS** (Apple Silicon):

```bash
npm run dist:mac
```

Артефакты по умолчанию: `C:\Temp\blinklearningdownloader-build\` (Windows) или каталог из `--config.directories.output` (например `release-build/`).

Пользователю достаточно скачать файл из [релиза](https://github.com/Marfa/blinklearningdownloader/releases) — Node.js отдельно не нужен.

На macOS при первом запуске неподписанного `.app`: ПКМ → «Открыть» → «Открыть».

## Проверка из командной строки (без Electron UI)

Учётные данные только через переменные окружения:

```powershell
$env:BLINK_EMAIL="your@email"
$env:BLINK_PASSWORD="your-password"
# опционально прокси:
$env:BLINK_PROXY="1"
$env:BLINK_PROXY_HOST="your.proxy.host"
$env:BLINK_PROXY_PORT="1080"

node scripts/test-auth.js
node scripts/test-audio-download.js
```

## Структура проекта

| Путь | Назначение |
|------|------------|
| `src/main.js` | Electron, IPC, диалог папки |
| `src/auth.js` | Авторизация, HTTP-клиент, SOCKS |
| `src/audio.js` | Редиректы, скачивание и превью MP3 |
| `src/lesson.js` | Разбор ID / URL урока |
| `src/settings.js` | Локальные настройки (язык, прокси, учётные данные) |
| `src/i18n-messages.js` | Строки интерфейса (ru / en) |
| `src/update-check.js` | Проверка версии на GitHub |
| `src/proxy-picker.js` | Подбор SOCKS5 с proxy-tools.com |
| `src/renderer/` | Интерфейс и валидация ввода |
| `assets/icons/` | Иконки приложения и брендинг |

## Разработка

Исходный код подготовлен с помощью [Cursor](https://cursor.com) (AI-редактор кода).

## Лицензия

Проект распространяется под лицензией **[CC BY-NC-SA 4.0 International](https://creativecommons.org/licenses/by-nc-sa/4.0/)** (Attribution — NonCommercial — ShareAlike). Полный текст — в файле [LICENSE](LICENSE).

Вы можете свободно использовать, изменять и распространять код **с указанием авторства**, **без коммерческого использования** и **на тех же условиях** (ShareAlike) для производных работ, насколько это допускает закон.
