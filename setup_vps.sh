#!/bin/bash

# Продвинутый скрипт установки Экопатруль на Ubuntu 22.04 (VPS)
set -e

echo "🌍 ========================================"
echo "🌍   Установка Экопатруль на VPS (Ubuntu)  "
echo "🌍 ========================================"

# 1. Интервю с пользователем
read -p "🔹 Введите токен Telegram бота: " BOT_TOKEN
read -p "🔹 Введите CLOUDINARY_URL (например, cloudinary://123:abc@name): " CLOUDINARY_URL
read -p "🔹 Введите ваш домен (например, eco.mysite.com): " DOMAIN_NAME
read -p "🔹 Введите email для SSL-сертификата: " SSL_EMAIL

# 2. Обновление и установка системных пакетов
echo "🔹 Обновление системы и установка пакетов..."
sudo apt update && sudo apt upgrade -y
sudo apt install -y python3-pip python3-venv git curl postgresql postgresql-contrib nginx certbot python3-certbot-nginx

# 3. Настройка PostgreSQL
echo "🔹 Настройка базы данных PostgreSQL..."

# Остановка сервиса и принудительное завершение всех процессов Postgres
sudo systemctl stop postgresql || true
sudo pkill -u postgres -f postgres || true

# Удаление зависших PID-файлов и блокировок, если они остались
sudo rm -f /var/run/postgresql/*.pid
sudo rm -f /var/run/postgresql/.s.PGSQL.5432.lock

# Работа с кластером
PG_VERSION="14"
if pg_lsclusters | grep -q "main"; then
    echo "🔹 Кластер существует. Пытаюсь сбросить настройки для чистого запуска..."
    sudo pg_dropcluster $PG_VERSION main --stop || true
fi

echo "🔹 Создание и запуск нового кластера..."
sudo pg_createcluster $PG_VERSION main --start || {
    echo "⚠️ Ошибка при создании кластера. Пробую еще раз с очисткой портов..."
    sudo fuser -k 5432/tcp || true
    sudo pg_createcluster $PG_VERSION main --start
}

# Фикс IPv4 (чтобы не падал на VPS без IPv6)
POSTGRES_CONF="/etc/postgresql/$PG_VERSION/main/postgresql.conf"
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '127.0.0.1'/" $POSTGRES_CONF
sudo systemctl restart postgresql

# Подождем для инициализации сокета
sleep 5

DB_NAME="ecopatrol"
DB_USER="eco_user"
DB_PASS=$(openssl rand -base64 12)

# Выполняем из /tmp, чтобы у пользователя postgres был доступ
cd /tmp
sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" || true
sudo -u postgres psql -c "CREATE DATABASE $DB_NAME;"
sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
cd - > /dev/null

DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost/$DB_NAME"

# 4. Настройка Backend
echo "🔹 Настройка Python окружения..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt gunicorn

# Создание или обновление .env
cat <<EOF > .env
BOT_TOKEN=$BOT_TOKEN
DATABASE_URL=$DATABASE_URL
MINI_APP_URL=https://$DOMAIN_NAME
CLOUDINARY_URL=$CLOUDINARY_URL
EOF

deactivate
cd ..

# 5. Настройка Nginx и SSL
echo "🔹 Настройка Nginx для домена $DOMAIN_NAME..."

NGINX_CONF="/etc/nginx/sites-available/ecopatrol"
# Используем tee для записи файла с правильным экранированием
sudo tee $NGINX_CONF > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location / {
        root $(pwd)/frontend;
        index index.html;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

sudo ln -sf $NGINX_CONF /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx

# 6. Получение SSL сертификата
echo "🔹 Получение SSL сертификата через Certbot..."
# Пытаемся получить, если нет ошибок конфигурации
sudo certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $SSL_EMAIL || echo "⚠️ Certbot не смог получить сертификат. Проверьте настройки DNS домена."

# 7. Настройка Systemd для работы в фоне
echo "🔹 Настройка фоновых служб (Backend и Bot)..."

# API Сервис
sudo tee /etc/systemd/system/eco-api.service > /dev/null <<EOF
[Unit]
Description=Ecopatrol API Service
After=network.target

[Service]
User=$USER
WorkingDirectory=$(pwd)/backend
ExecStart=$(pwd)/backend/venv/bin/gunicorn -w 4 -b 127.0.0.1:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
EOF

# Bot Сервис
sudo tee /etc/systemd/system/eco-bot.service > /dev/null <<EOF
[Unit]
Description=Ecopatrol Bot Service
After=network.target

[Service]
User=$USER
WorkingDirectory=$(pwd)/backend
ExecStart=$(pwd)/backend/venv/bin/python bot.py
Restart=always

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable eco-api eco-bot
sudo systemctl restart eco-api eco-bot

echo "🎉 ========================================"
echo "🎉   УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!        "
echo "🎉   Приложение: https://$DOMAIN_NAME    "
echo "🎉   БД: PostgreSQL (пароль сохранен в .env)"
echo "🎉 ========================================"

echo "🎉 ========================================"
echo "🎉   УСТАНОВКА ЗАВЕРШЕНА УСПЕШНО!        "
echo "🎉   Приложение: https://$DOMAIN_NAME    "
echo "🎉   БД: PostgreSQL (пароль сохранен в .env)"
echo "🎉 ========================================"
