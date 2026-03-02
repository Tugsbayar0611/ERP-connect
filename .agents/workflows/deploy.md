---
description: How to deploy ERP-Connect to Proxmox VPS (internal server)
---

# ERP-Connect Proxmox Deployment Guide

## Prerequisites (Сервер дээр суулгах зүйлс)

### 1. Proxmox VM/Container үүсгэх
- Ubuntu 24.04.3 LTS
- RAM: 2GB+
- Disk: 20GB+
- Network: Bridge mode (дотоод сүлжээ)

### 2. Сервер дээр SSH-ээр холбогдох
```bash
ssh root@<SERVER_IP>
```

### 3. Шаардлагатай програмууд суулгах
// turbo
```bash
# System update
apt update && apt upgrade -y

# Node.js 20 LTS суулгах (Ubuntu 24.04 дээр)
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Node суусан эсэхийг шалгах
node -v   # v20.x гарах ёстой
npm -v    # 10.x гарах ёстой

# PostgreSQL 16 суулгах (Ubuntu 24.04 default)
apt install -y postgresql postgresql-contrib

# Git суулгах
apt install -y git

# Build tools (native модулууд compile хийхэд хэрэгтэй)
apt install -y build-essential python3
```

### 4. PostgreSQL тохиргоо
```bash
# PostgreSQL руу нэвтрэх
sudo -u postgres psql

# Database болон хэрэглэгч үүсгэх
CREATE DATABASE erp_db;
CREATE USER erp_user WITH ENCRYPTED PASSWORD 'your_secure_password_here';
GRANT ALL PRIVILEGES ON DATABASE erp_db TO erp_user;
ALTER DATABASE erp_db OWNER TO erp_user;
\q
```

---

## Deploy хийх (Анхны удаа)

### 5. Код татах
```bash
cd /opt
git clone https://github.com/Tugsbayar0611/ERP-connect.git
cd ERP-connect
```

### 6. Environment тохируулах
```bash
cat > .env << 'EOF'
DATABASE_URL=postgresql://erp_user:your_secure_password_here@localhost:5432/erp_db
SESSION_SECRET=your_random_session_secret_here_min_32_chars
NODE_ENV=production
PORT=5000
EOF
```

### 7. Dependencies суулгах & Build хийх
```bash
npm install
npm run build
```

### 8. Database schema push хийх
```bash
npm run db:push
```

### 9. Тест ажиллуулах
```bash
npm start
# Ctrl+C дарж зогсоох
```

### 10. Systemd service үүсгэх (автоматаар ажиллуулах)
```bash
cat > /etc/systemd/system/erp-connect.service << 'EOF'
[Unit]
Description=ERP-Connect Application
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/ERP-connect
EnvironmentFile=/opt/ERP-connect/.env
ExecStart=/usr/bin/node dist/index.cjs
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Service идэвхжүүлэх
systemctl daemon-reload
systemctl enable erp-connect
systemctl start erp-connect

# Status шалгах
systemctl status erp-connect
```

---

## Шинэчлэх (Update Deploy)

GitHub руу push хийсний дараа сервер дээр:

```bash
cd /opt/ERP-connect
git pull origin main
npm install
npm run build
npm run db:push
systemctl restart erp-connect
```

---

## Хандах
- Дотоод сүлжээнээс: `http://<SERVER_IP>:5000`
- Жишээ: `http://192.168.1.100:5000`

## Лог харах
```bash
# Бүх лог
journalctl -u erp-connect -f

# Сүүлийн 50 мөр
journalctl -u erp-connect -n 50
```

## Nginx reverse proxy (заавал биш, port 80 дээр ажиллуулах бол)
```bash
apt install -y nginx

cat > /etc/nginx/sites-available/erp << 'EOF'
server {
    listen 80;
    server_name erp.local;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -s /etc/nginx/sites-available/erp /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```
