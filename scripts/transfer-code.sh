#!/bin/bash

# Script para transferir código al servidor
# Ejecutar desde tu máquina LOCAL (no en el servidor)

set -e

# Configuración
SERVER_USER="${1:-usuario}"
SERVER_HOST="${2:-IP_SERVIDOR}"
SERVER_PATH="${3:-/home/$SERVER_USER}"
PROJECT_NAME="idml-injector-pro"
LOCAL_PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=========================================="
echo "Transferencia de código al servidor"
echo "=========================================="
echo ""
echo "Servidor: $SERVER_USER@$SERVER_HOST"
echo "Ruta destino: $SERVER_PATH/$PROJECT_NAME"
echo "Ruta local: $LOCAL_PATH"
echo ""

# Verificar que rsync está disponible
if ! command -v rsync &> /dev/null; then
    echo "Error: rsync no está instalado"
    echo "Instala con: sudo apt install rsync  (Debian/Ubuntu)"
    echo "            sudo yum install rsync   (CentOS/RHEL)"
    exit 1
fi

# Confirmar transferencia
read -p "¿Continuar con la transferencia? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Transferencia cancelada"
    exit 0
fi

echo ""
echo "Transferiendo archivos (excluyendo node_modules y dist)..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude 'dist' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude '*.log' \
    --exclude '.DS_Store' \
    "$LOCAL_PATH/" \
    "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/$PROJECT_NAME/"

echo ""
echo "=========================================="
echo "Transferencia completada!"
echo "=========================================="
echo ""
echo "Próximos pasos en el servidor:"
echo "1. SSH al servidor: ssh $SERVER_USER@$SERVER_HOST"
echo "2. cd $SERVER_PATH/$PROJECT_NAME"
echo "3. npm install"
echo "4. cp env.example .env"
echo "5. nano .env  (configurar variables)"
echo "6. npm run dev"
echo ""
