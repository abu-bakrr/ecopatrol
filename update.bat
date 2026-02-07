@echo off
title Обновление Экопатруль
echo ========================================
echo   Обновление проекта Экопатруль
echo ========================================

echo 1. Получение последних изменений из GitHub...
git pull origin main

echo 2. Обновление зависимостей Backend...
cd backend
call venv\Scripts\activate
pip install -r requirements.txt
cd ..

echo 3. Обновление зависимостей Frontend...
cd frontend
call npm install
cd ..

echo ========================================
echo   Обновление успешно завершено!
echo ========================================
pause
