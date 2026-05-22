# BlinkLearning Downloader

Десктопное приложение для Windows: вход на [blinklearning.com](https://www.blinklearning.com), указание урока и скачивание MP3-аудио (один трек или диапазон). Поддерживается SOCKS5-прокси.

Учётные данные и параметры прокси **не зашиты в код** — вводятся в интерфейсе и при желании сохраняются локально в профиле пользователя (`%APPDATA%`).

**Скачать:** [релиз v1.0.0](https://github.com/Marfa/blinklearningdownloader/releases/latest) — установщик `BlinkLearning-Downloader-Setup-1.0.0.exe`.

## Возможности

1. **Вход** — логин и пароль BlinkLearning, опционально «Запомнить логин-пароль».
2. **Прокси** — опциональный SOCKS5 (IP и порт задаёт пользователь).
3. **Урок** — ID урока (только цифры) или полная ссылка из браузера; ID извлекается из цифр после последнего `/` в URL.
4. **Аудио** — один номер или диапазон «С»–«По»; в полях допускаются только цифры.
5. **Скачивание** — выбор папки (по умолчанию «Загрузки» или последняя выбранная), отображение прогресса.
6. Кнопки скачивания недоступны, пока идёт загрузка.

Формат файлов на CDN: `PISTA06.mp3`, `PISTA24.mp3` и т.д. в каталоге урока на `blinklearning.com`.

## Запуск в режиме разработки

```bash
npm install
npm start
```

## Сборка установщика (Windows)

```bash
npm install
npm run dist
```

Артефакты сборки: `C:\Temp\blinklearningdownloader-build\`. Установщик в корне `C:\Temp\`:

```bash
npm run dist:temp
```

Пользователю достаточно запустить `.exe` из [релиза](https://github.com/Marfa/blinklearningdownloader/releases) — Node.js отдельно не нужен.

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
| `src/audio.js` | Редиректы, скачивание MP3 |
| `src/lesson.js` | Разбор ID / URL урока |
| `src/settings.js` | Локальные настройки |
| `src/renderer/` | Интерфейс и валидация ввода |

## Разработка

Исходный код подготовлен с помощью [Cursor](https://cursor.com) (AI-редактор кода).

## Лицензия

Проект распространяется под лицензией **[CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)** (общественное достояние). Полный текст — в файле [LICENSE](LICENSE).

Вы можете свободно использовать, изменять и распространять код без ограничений, насколько это допускает закон.
