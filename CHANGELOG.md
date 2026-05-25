# Changelog

Формат основан на [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/).

## [1.1.1] — 2026-05-22

### Исправлено

- Шапка входа: логотип снова читаем на светлом фоне (текстовый брендинг **blink** / **Learning** вместо PNG с белым «blink»).
- Favicon приложения — иконка из `assets/icons/icon-256.png`.

### Изменено

- Обновлены `electron` (^42.2.0) и `electron-builder` (^26.8.1) — устранены предупреждения `npm audit` (0 vulnerabilities).

## [1.1.0] — 2026-05-22

### Добавлено

- Сборки **macOS** (Apple Silicon) и улучшенный вход на macOS.
- Оформление в стиле BlinkLearning, языки **RU / EN**.
- Прослушивание аудио в приложении, проверка обновлений через GitHub Releases.
- Windows: portable `.exe` и ZIP в дополнение к установщику NSIS.

### Изменено

- Лицензия: CC BY-NC-SA 4.0.

## [1.0.0] — 2026-05-22

### Добавлено

- Первая версия для Windows: вход, SOCKS5, скачивание MP3 по ID урока или ссылке, один трек или диапазон.

[1.1.1]: https://github.com/Marfa/blinklearningdownloader/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/Marfa/blinklearningdownloader/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Marfa/blinklearningdownloader/releases/tag/v1.0.0
