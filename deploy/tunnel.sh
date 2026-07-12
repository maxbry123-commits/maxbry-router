#!/bin/bash
# ===========================================================
# MAXBRY Router · Cloudflare Tunnel (URL protegida)
# Ejecutar en el VPS (root@95.111.232.89)
# Requisito: haber ejecutado install.sh antes
# ===========================================================
set -e

echo "================================================"
echo "MAXBRY · Cloudflare Tunnel Setup"
echo "================================================"

# 1. Instalar cloudflared
if ! command -v cloudflared &> /dev/null; then
    curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | gpg --dearmor -o /usr/share/keyrings/cloudflare.gpg
    echo 'deb [signed-by=/usr/share/keyrings/cloudflare.gpg] https://pkg.cloudflare.com/cloudflared focal main' > /etc/apt/sources.list.d/cloudflared.list
    apt update && apt install -y cloudflared
fi
cloudflared --version

# 2. Login (abrirá navegador, o usar token)
echo ""
echo "Opción A: Login interactivo (abre navegador)"
echo "Opción B: pegar tu token de Cloudflare (recommended)"
echo ""
read -p "CLOUDFLARE_TUNNEL_TOKEN (déjalo vacío para login interactivo): " TUNNEL_TOKEN

if [ -z "$TUNNEL_TOKEN" ]; then
    cloudflared tunnel login
    echo "Ahora crea un tunnel:"
    read -p "Nombre del tunnel (ej: maxbry-prod): " TUNNEL_NAME
    cloudflared tunnel create "$TUNNEL_NAME"
    TUNNEL_ID=$(cloudflared tunnel list | grep "$TUNNEL_NAME" | awk '{print $1}')
    echo "Tunnel ID: $TUNNEL_ID"

    # 3. Crear config
    mkdir -p /etc/cloudflared
    cat > /etc/cloudflared/config.yml << EOF
tunnel: $TUNNEL_ID
credentials-file: /root/.cloudflared/$TUNNEL_ID.json

ingress:
  - hostname: maxbry-router.maxbry-router.dev
    service: http://localhost:8080
  - service: http_status:404
EOF

    # 4. DNS route
    cloudflared tunnel route dns "$TUNNEL_NAME" maxbry-router.maxbry-router.dev
else
    # Opción B: token directo
    mkdir -p /etc/cloudflared
    cat > /etc/cloudflared/config.yml << EOF
tunnel: REEMPLAZAR_CON_TUNNEL_ID
credentials-file: /etc/cloudflared/REEMPLAZAR.json
ingress:
  - hostname: maxbry-router.maxbry-router.dev
    service: http://localhost:8080
  - service: http_status:404
EOF
    # Crear el credentials file (reemplazar contenido)
    read -p "Pega aquí el JSON completo del tunnel credentials: " CREDS_JSON
    echo "$CREDS_JSON" > /etc/cloudflared/REEMPLAZAR.json
    chmod 600 /etc/cloudflared/REEMPLAZAR.json
fi

# 5. Crear servicio systemd
cat > /etc/systemd/system/cloudflared.service << 'EOF'
[Unit]
Description=Cloudflare Tunnel
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable cloudflared
systemctl start cloudflared
systemctl status cloudflared --no-pager

# 6. Cloudflare Access (protección)
echo ""
echo "================================================"
echo "PROTECCIÓN DE ACCESO (Cloudflare Access)"
echo "================================================"
echo ""
echo "Cloudflare Access protege la URL con email OTP."
echo "Para activarlo:"
echo "  1. Ir a https://one.dash.cloudflare.com/"
echo "  2. Access > Applications > Add an application"
echo "  3. Self-hosted: maxbry-router.maxbry-router.dev"
echo "  4. Policy: Allow > Emails > max@maxbry-router.dev"
echo ""
echo "================================================"
echo "✓ TUNNEL ACTIVO"
echo "URL: https://maxbry-router.maxbry-router.dev"
echo "================================================"
