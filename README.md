# Set (Сет) — Мультиплеер

Онлайн-версия игры Set для 1 или 2 игроков. Синхронизация через Ably Realtime.

## Быстрый старт

### 1. Ably (бесплатно, ~2 минуты)
1. Зайди на https://ably.com → Sign Up
2. Создай новое приложение (любое название)
3. Скопируй **API Key** из раздела "API Keys" (Root key)

### 2. Локальный запуск
```bash
npm install
cp .env.example .env
# Вставь свой Ably API Key в .env:
# VITE_ABLY_KEY=xxxxxx.yyyyyy:zzzzzz
npm run dev
```

### 3. Деплой на Vercel
```bash
npm install -g vercel
vercel
# При запросе "Environment Variables" добавь:
# VITE_ABLY_KEY = твой_ключ
```
Или через UI vercel.com:
1. Import Git репозиторий (загрузи на GitHub)
2. В Settings → Environment Variables добавь `VITE_ABLY_KEY`
3. Redeploy

## Как играть вдвоём
1. Игрок 1: нажимает "Создать комнату", видит **5-буквенный код**
2. Игрок 2: нажимает "Войти в комнату", вводит этот код
3. Оба нажимают "Начать" — игра стартует с одинаковым полем
4. Кто быстрее выберет правильный сет — тому очко!

## Структура проекта
```
src/
  deck.js        — логика карт, без изменений
  useGameState.js — состояние игры (solo + multi)
  useAbly.js     — Ably websocket хук
  App.jsx        — главный компонент
  Card.jsx       — SVG карта
  Lobby.jsx      — стартовый экран
  GameOver.jsx   — финальная статистика
  RulesModal.jsx — правила
  index.css      — стили
```

## Особенности мультиплеера
- Optimistic locking через `version` поля — побеждает первый запрос
- При ошибке — блокировка 2 секунды
- Подсказка показывает только тебе (не видна сопернику)
- Таймер и статистика синхронизированы
