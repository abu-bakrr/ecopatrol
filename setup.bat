@echo off
title Установка Экопатруль (Локально / Windows)
echo ========================================
echo   Установка Экопатруль (Локально)
echo ========================================

echo 1. Настройка Backend...
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
if not exist .env (
    copy .env.example .env
    echo [!] Создан .env. Отредактируйте его!
)
cd ..

echo 2. Настройка Frontend...
cd frontend
call npm install
cd ..

echo ========================================
echo   Установка завершена!
echo ========================================
echo Для запуска бэкенда: cd backend ^& venv\Scripts\activate ^& python app.py
echo Для запуска бота: cd backend ^& venv\Scripts\activate ^& python bot.py
echo Для запуска фронтенда: cd frontend ^& npm run dev
pause
