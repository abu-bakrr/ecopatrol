# EcoPatrol (Экопатруль) 🌍

Telegram Mini App для отметки и устранения загрязнений окружающей среды.

## Технологии

- **Backend:** Python (Flask), PostgreSQL/SQLite, Telebot
- **Frontend:** Vanilla JS, MapLibre GL JS, CSS (Glassmorphism)
- **Platform:** Telegram Mini App (TMA)

## Структура

- `/backend`: API сервер и Telegram бот.
- `/frontend`: Файлы веб-приложения (Mini App).

## Быстрый старт (Локально)

### Backend

1. `cd backend`
2. `python -m venv venv`
3. `venv\Scripts\activate` (Windows) или `source venv/bin/activate` (Linux)
4. `pip install -r requirements.txt`
5. Настройте `.env`
6. `python app.py`

### Frontend

1. `cd frontend`
2. `npm install`
3. `npm run dev`

## Деплой на VPS (Ubuntu)

Используйте скрипт `setup_vps.sh` для автоматической установки всех зависимостей на сервер Ubuntu 22.04.

```bash
chmod +x setup_vps.sh
./setup_vps.sh
```

## Лицензия

MIT
