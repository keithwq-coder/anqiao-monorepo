#!/bin/bash
# 中科安樵 CRM 系统 - 腾讯云轻量服务器初始化脚本
# 用法: 在服务器上执行 bash setup_server.sh
# 目标: 安装 Python 3.11 / Node 18 / PostgreSQL 16 / Redis / Supervisor / Nginx

set -e

echo "=========================================="
echo "  中科安樵 CRM 服务器环境初始化"
echo "=========================================="

# ─── 1. 系统更新 ───────────────────────────────────────────
echo "[1/7] 系统更新..."
sudo apt-get update -qq
sudo apt-get upgrade -y -qq

# ─── 2. Python 3.11 ────────────────────────────────────────
echo "[2/7] 安装 Python 3.11..."
sudo apt-get install -y python3.11 python3.11-venv python3.11-dev python3-pip
# 创建 CRM 后端虚拟环境
mkdir -p /home/ubuntu/CRM/backend
python3.11 -m venv /home/ubuntu/CRM/backend/.venv
/home/ubuntu/CRM/backend/.venv/bin/pip install --upgrade pip

# ─── 3. Node.js 18 ─────────────────────────────────────────
echo "[3/7] 安装 Node.js 18..."
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
echo "  Node: $(node --version), npm: $(npm --version)"

# ─── 4. PostgreSQL 16 + TimescaleDB ────────────────────────
echo "[4/7] 安装 PostgreSQL 16..."
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt-get update -qq
sudo apt-get install -y postgresql-16 postgresql-contrib-16

# 安装 TimescaleDB
sudo apt-get install -y timescaledb-2-postgresql-16
sudo timescaledb-tune --quiet --yes

# 创建 CRM 数据库和用户
sudo -u postgres psql << 'SQL'
CREATE USER crm WITH PASSWORD 'crm_secure_2026';
CREATE DATABASE crm_db OWNER crm;
GRANT ALL PRIVILEGES ON DATABASE crm_db TO crm;
SQL

# 启用 TimescaleDB 扩展
sudo -u postgres psql -d crm_db -c "CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;"

echo "  PostgreSQL 16 + TimescaleDB 就绪"

# ─── 5. Redis 7 ────────────────────────────────────────────
echo "[5/7] 安装 Redis..."
sudo apt-get install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
echo "  Redis: $(redis-server --version)"

# ─── 6. Supervisor ─────────────────────────────────────────
echo "[6/7] 配置 Supervisor..."
sudo apt-get install -y supervisor
sudo mkdir -p /home/ubuntu/CRM/logs

# CRM supervisor 配置（如果不存在则创建）
if [ ! -f /etc/supervisor/conf.d/crm.conf ]; then
sudo tee /etc/supervisor/conf.d/crm.conf << 'CONF'
[program:crm-backend]
command=/home/ubuntu/CRM/backend/.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8100
directory=/home/ubuntu/CRM/backend
user=ubuntu
autostart=true
autorestart=true
startsecs=5
startretries=3
redirect_stderr=true
stdout_logfile=/home/ubuntu/CRM/logs/backend.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
environment=PYTHONPATH="/home/ubuntu/CRM/backend"

[program:crm-celery]
command=/home/ubuntu/CRM/backend/.venv/bin/celery -A app.celery_app worker --loglevel=info --concurrency=4
directory=/home/ubuntu/CRM/backend
user=ubuntu
autostart=true
autorestart=true
startsecs=5
startretries=3
redirect_stderr=true
stdout_logfile=/home/ubuntu/CRM/logs/celery.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
environment=PYTHONPATH="/home/ubuntu/CRM/backend"

[program:crm-celery-beat]
command=/home/ubuntu/CRM/backend/.venv/bin/celery -A app.celery_app beat --loglevel=info
directory=/home/ubuntu/CRM/backend
user=ubuntu
autostart=true
autorestart=true
startsecs=5
startretries=3
redirect_stderr=true
stdout_logfile=/home/ubuntu/CRM/logs/celery-beat.log
stdout_logfile_maxbytes=10MB
stdout_logfile_backups=3
environment=PYTHONPATH="/home/ubuntu/CRM/backend"
CONF
fi

sudo supervisorctl reread
sudo supervisorctl update

# ─── 7. Nginx 配置 ─────────────────────────────────────────
echo "[7/7] 配置 Nginx..."
sudo apt-get install -y nginx

# CRM Nginx 配置
sudo tee /etc/nginx/sites-enabled/crm << 'NGINX'
server {
    listen 80;
    server_name crm.aibrain.wiki;

    root /home/ubuntu/CRM/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8100;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location = /healthz {
        proxy_pass http://127.0.0.1:8100/api/health;
        access_log off;
    }
}
NGINX

# 创建前端占位目录
mkdir -p /home/ubuntu/CRM/frontend/dist
echo '<html><body><h1>CRM - crm.aibrain.wiki</h1></body></html>' > /home/ubuntu/CRM/frontend/dist/index.html

sudo nginx -t && sudo systemctl reload nginx

# ─── 完成 ──────────────────────────────────────────────────
echo ""
echo "=========================================="
echo "  ✅ 初始化完成！"
echo "=========================================="
echo "  Python:  $(python3.11 --version)"
echo "  Node:    $(node --version)"
echo "  PG:      $(psql --version)"
echo "  Redis:   $(redis-server --version)"
echo "  Nginx:   $(nginx -v 2>&1)"
echo "  数据库:  crm_db (用户: crm)"
echo "  域名:    crm.aibrain.wiki → 127.0.0.1:8100"
echo ""
echo "  下一步: 配置 DNS A 记录 crm.aibrain.wiki → $(curl -s ifconfig.me)"
echo "  然后:   申请 SSL 证书 (certbot)"
echo "=========================================="
