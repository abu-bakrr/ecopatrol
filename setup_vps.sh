#!/bin/bash

# Скрипт установки Экопатруль на Ubuntu 22.04

echo "🚀 Начинаю установку Экопатруль на VPS..."

# Обновление системы
sudo apt update && sudo apt upgrade -y

# Установка зависимостей
sudo apt install -y python3-pip python3-venv git curl

# Установка Node.js (для фронтенда, если нужно собирать на сервере)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Настройка Backend
echo "🐍 Настраиваю Backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
if [ ! -f .env ]; then
    cp .env.example .env
    echo "⚠️ Файл .env создан из примера. Не забудьте отредактировать его!"
fi
deactivate
cd ..

# Настройка Frontend
echo "🌐 Настраиваю Frontend..."
cd frontend
npm install
# npm run build # Раскомментируйте, если используете статический хостинг
cd ..

echo "✅ Установка завершена!"
echo "Для запуска бэкенда: cd backend && source venv/bin/activate && python3 app.py"
echo "Для запуска бота: cd backend && source venv/bin/activate && python3 bot.py"
