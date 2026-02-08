#!/bin/bash

# Скрипт быстрого обновления Экопатруль на VPS
# Работает с проектом в /var/www/ecopatrol
set -e

PROJECT_ROOT="/var/www/ecopatrol"
REPO_DIR=$(pwd)

echo "🔄 ========================================"
echo "🔄   Обновление Экопатруль на VPS         "
echo "🔄 ========================================"

# 1. Получение нового кода в репозитории (~/ecopatrol)
echo "🔹 Подтягиваю изменения из Git в $REPO_DIR..."
git pull

# 2. Синхронизация с рабочей папкой (/var/www/ecopatrol)
echo "🔹 Синхронизация файлов с $PROJECT_ROOT..."
sudo cp -r . $PROJECT_ROOT/
sudo chown -R $USER:$USER $PROJECT_ROOT

# 3. Обновление Python зависимостей и БД в рабочей папке
echo "🔹 Обновление бэкенда в $PROJECT_ROOT..."
cd $PROJECT_ROOT/backend
source venv/bin/activate
pip install -r requirements.txt

# Фикс localhost -> 127.0.0.1 в .env
if [ -f .env ]; then
    sed -i "s/localhost/127.0.0.1/g" .env
fi

echo "🔹 Обновление таблиц в базе данных..."
python3 -c "from app import app, db; ctx=app.app_context(); ctx.push(); db.create_all(); ctx.pop()"
deactivate

# 4. Перезапуск служб
echo "🔹 Перезапуск фоновых сервисов..."
sudo systemctl daemon-reload
sudo systemctl restart eco-api eco-bot
sudo systemctl restart nginx

echo "✅ ========================================"
echo "✅   ПРОЕКТ УСПЕШНО ОБНОВЛЕН!            "
echo "✅ ========================================"
