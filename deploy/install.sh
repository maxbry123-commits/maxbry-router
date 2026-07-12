#!/bin/bash
# ===========================================================
# MAXBRY Router · Script de instalación en VPS
# Ejecutar UNA VEZ en el VPS (root@95.111.232.89)
# ===========================================================
set -e

echo "================================================"
echo "MAXBRY Router · Instalación en VPS"
echo "================================================"

# 1. Dependencias del sistema
apt update
apt install -y python3 python3-pip python3-venv nginx certbot python3-certbot-nginx git curl ufw

# 2. Usuario dedicado
useradd -m -s /bin/bash maxbry 2>/dev/null || echo "user maxbry ya existe"
mkdir -p /opt/maxbry
chown maxbry:maxbry /opt/maxbry

# 3. Clonar el repo
sudo -u maxbry bash << 'EOF'
cd /opt/maxbry
git clone https://github.com/maxbry123-commits/maxbry-router.git
cd maxbry-router
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
pip install gunicorn
EOF

# 4. Crear requirements.txt si no existe
cat > /opt/maxbry/maxbry-router/requirements.txt << 'EOF'
fastapi==0.139.0
uvicorn[standard]==0.51.0
httpx==0.28.1
pydantic==2.13.4
websockets==16.1
python-multipart==0.0.32
gunicorn==23.0.0
EOF

# 5. Systemd service para el backend
cat > /etc/systemd/system/maxbry-backend.service << 'EOF'
[Unit]
Description=MAXBRY Router Backend
After=network.target

[Service]
Type=simple
User=maxbry
WorkingDirectory=/opt/maxbry/maxbry-router
Environment="PATH=/opt/maxbry/maxbry-router/venv/bin"
ExecStart=/opt/maxbry/maxbry-router/venv/bin/gunicorn app:app -w 2 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 --access-logfile - --error-logfile -
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# 6. Build del frontend
sudo -u maxbry bash << 'EOF'
cd /opt/maxbry/maxbry-router/interfaces
# Instalar Node 20 si no está
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
npm install
# Apuntar a la URL del backend real
echo 'VITE_API_URL=https://maxbry-router.maxbry-router.dev' > .env.production
npm run build
EOF

# 7. Nginx sirve el frontend + proxy al backend
cat > /etc/nginx/sites-available/maxbry << 'EOF'
server {
    listen 8080;
    server_name _;
    root /opt/maxbry/maxbry-router/interfaces/dist;
    index index.html;

    # Frontend (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API proxy al backend FastAPI en :8000
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
EOF

ln -sf /etc/nginx/sites-available/maxbry /etc/nginx/sites-enabled/maxbry
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 8. Activar servicios
systemctl daemon-reload
systemctl enable maxbry-backend
systemctl start maxbry-backend
systemctl status maxbry-backend --no-pager

# 9. Firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 8080/tcp
ufw --force enable

echo ""
echo "================================================"
echo "✓ Instalación completa"
echo "Backend:  http://127.0.0.1:8000 (FastAPI)"
echo "Frontend: http://127.0.0.1:8080 (Nginx)"
echo "================================================"
echo ""
echo "SIGUIENTE PASO: Configurar Cloudflare Tunnel"
echo "Ejecutar: bash deploy/tunnel.sh"
