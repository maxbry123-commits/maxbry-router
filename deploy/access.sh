#!/bin/bash
# ===========================================================
# MAXBRY Router · Cloudflare Access Policy
# Protege la URL con email OTP (un solo usuario)
# ===========================================================
set -e

CF_API="https://api.cloudflare.com/client/v4"
ACCOUNT_ID="754c5e23aa87ebe991cf961780b23c9c"
APP_DOMAIN="maxbry-router.maxbry-router.dev"

# Token con scope: Zone:Read, Access:Edit
read -p "Cloudflare API Token (scope Access:Edit): " CF_TOKEN
read -p "Tu email autorizado: " ALLOWED_EMAIL

if [ -z "$CF_TOKEN" ] || [ -z "$ALLOWED_EMAIL" ]; then
    echo "ERROR: Token y email requeridos"
    exit 1
fi

echo ""
echo "1. Creando Access Application..."

# Crear aplicación
APP_RESP=$(curl -s -X POST "$CF_API/accounts/$ACCOUNT_ID/access/apps" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"MAXBRY Router\",
    \"domain\": \"$APP_DOMAIN\",
    \"type\": \"self_hosted\",
    \"session_duration\": \"24h\",
    \"auto_redirect_to_identity\": false
  }")

APP_ID=$(echo "$APP_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('result',{}).get('id',''))")
echo "App ID: $APP_ID"

if [ -z "$APP_ID" ]; then
    echo "ERROR creando app:"
    echo "$APP_RESP"
    exit 1
fi

echo ""
echo "2. Creando Policy (Allow solo tu email)..."

POLICY_RESP=$(curl -s -X POST "$CF_API/accounts/$ACCOUNT_ID/access/apps/$APP_ID/policies" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"Solo Max\",
    \"decision\": \"allow\",
    \"include\": [
      {
        \"email\": [\"$ALLOWED_EMAIL\"]
      }
    ]
  }")

POLICY_ID=$(echo "$POLICY_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('result',{}).get('id',''))")
echo "Policy ID: $POLICY_ID"

echo ""
echo "================================================"
echo "✓ CLOUDFLARE ACCESS CONFIGURADO"
echo "URL: https://$APP_DOMAIN"
echo "Acceso: solo $ALLOWED_EMAIL (recibe OTP por email)"
echo "================================================"
echo ""
echo "PRUEBA:"
echo "  1. Abre https://$APP_DOMAIN en tu navegador"
echo "  2. Te redirige a login de Cloudflare"
echo "  3. Pones $ALLOWED_EMAIL"
echo "  4. Te llega OTP al email"
echo "  5. Después de validar, ves la interface MAXBRY"
