#!/bin/bash

# Продвинутый скрипт установки Экопатруль на Ubuntu 22.04 (VPS)
# Этот скрипт устанавливает проект в /var/www/ecopatrol для обхода проблем с правами в /root
set -e

PROJECT_ROOT="/var/www/ecopatrol"
echo "🌍 ========================================"
echo "🌍   Установка Экопатруль на VPS (Ubuntu)  "
echo "🌍 ========================================"

# 1. Загрузка переменных
echo "🔹 Настройка конфигурации..."
if [ -f .env ]; then
    echo "✅ Найден файл .env, загружаю данные..."
    source .env
else
    # Если .env нет, спрашиваем
    read -p "🔹 Введите токен Telegram бота: " BOT_TOKEN
    read -p "🔹 Введите CLOUDINARY_URL: " CLOUDINARY_URL
    read -p "🔹 Введите ваш домен (например, eco.mysite.com): " DOMAIN_NAME
    read -p "🔹 Введите email для SSL-сертификата: " SSL_EMAIL
fi

# 2. Подготовка директорий
echo "🔹 Подготовка директории проекта в $PROJECT_ROOT..."
sudo mkdir -p $PROJECT_ROOT
sudo cp -r . $PROJECT_ROOT/
sudo chown -R $USER:$USER $PROJECT_ROOT
cd $PROJECT_ROOT

# 3. Обновление и установка пакетов
echo "🔹 Обновление системы и установка пакетов..."
sudo apt update
sudo apt install -y python3-pip python3-venv git curl postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# 4. Настройка PostgreSQL
echo "🔹 Настройка базы данных PostgreSQL..."
sudo systemctl stop postgresql || true
sudo pkill -9 -u postgres || true
sudo rm -rf /var/run/postgresql/*
sudo rm -rf /var/lib/postgresql/14/main
sudo rm -rf /etc/postgresql/14/main

echo "🔹 Создание нового кластера PostgreSQL 14..."
cd /tmp
sudo pg_createcluster 14 main --start || {
    sudo rm -rf /var/lib/postgresql/14/main
    sudo mkdir -p /var/lib/postgresql/14/main
    sudo chown postgres:postgres /var/lib/postgresql/14/main
    sudo -u postgres /usr/lib/postgresql/14/bin/initdb -D /var/lib/postgresql/14/main
    sudo systemctl start postgresql
}
cd - > /dev/null

POSTGRES_CONF="/etc/postgresql/14/main/postgresql.conf"
if [ -f "$POSTGRES_CONF" ]; then
    sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '127.0.0.1'/" $POSTGRES_CONF
    sudo systemctl restart postgresql
fi

sleep 5
DB_NAME="ecopatrol"
DB_USER="eco_user"
DB_PASS=$(openssl rand -base64 12)

cd /tmp
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
cd - > /dev/null

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@127.0.0.1/$DB_NAME"

# 5. Настройка Backend
echo "🔹 Настройка Python окружения в $PROJECT_ROOT/backend..."
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt gunicorn

cat <<EOF > .env
BOT_TOKEN=$BOT_TOKEN
DATABASE_URL=$DATABASE_URL
MINI_APP_URL=https://$DOMAIN_NAME
CLOUDINARY_URL=$CLOUDINARY_URL
EOF

echo "🔹 Инициализация таблиц БД..."
python3 -c "from app import app, db; ctx=app.app_context(); ctx.push(); db.create_all(); ctx.pop()"
deactivate
cd ..

# 6. Настройка Nginx
echo "🔹 Настройка Nginx для $DOMAIN_NAME..."
NGINX_CONF="/etc/nginx/sites-available/ecopatrol"
sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location /api {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        root $PROJECT_ROOT/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 7. SSL
echo "🔹 Получение SSL сертификата..."
sudo certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $SSL_EMAIL || echo "⚠️ Ошибка SSL"

# 8. Systemd
echo "🔹 Настройка фоновых служб..."
sudo tee /etc/systemd/system/eco-api.service > /dev/null <<EOF
[Unit]
Description=Ecopatrol API Service
After=network.target

[Service]
User=$USER
WorkingDirectory=$PROJECT_ROOT/backend
ExecStart=$PROJECT_ROOT/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/eco-bot.service > /dev/null <<EOF
[Unit]
Description=Ecopatrol Bot Service
After=network.target

[Service]
User=$USER
WorkingDirectory=$PROJECT_ROOT/backend
ExecStart=$PROJECT_ROOT/backend/venv/bin/python bot.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable eco-api eco-bot
sudo systemctl restart eco-api eco-bot

echo "🎉 ========================================"
echo "🎉   УСТАНОВКА ЗАВЕРШЕНА!               "
echo "🎉   Сайт: https://$DOMAIN_NAME        "
echo "🎉   Проект в: $PROJECT_ROOT           "
echo "🎉 ========================================"
