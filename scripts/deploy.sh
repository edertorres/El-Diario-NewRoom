#!/bin/bash

# Script de despliegue automático para producción
# Uso: ./scripts/deploy.sh

set -e  # Salir si hay algún error

echo "🚀 Iniciando despliegue..."

# Colores para output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: No se encontró package.json. Ejecuta este script desde la raíz del proyecto.${NC}"
    exit 1
fi

# Verificar que existe .env
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Advertencia: No se encontró archivo .env${NC}"
fi

# 1. Construir la aplicación
echo -e "${YELLOW}📦 Construyendo aplicación...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error al construir la aplicación${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Build completado${NC}"

# 2. Verificar que dist/ existe y tiene archivos
if [ ! -d "dist" ] || [ -z "$(ls -A dist)" ]; then
    echo -e "${RED}❌ Error: La carpeta dist/ está vacía o no existe${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Archivos generados en dist/${NC}"

# 3. Recargar nginx (si tiene permisos)
echo -e "${YELLOW}🔄 Recargando nginx...${NC}"
if [ -f "/etc/init.d/nginx" ]; then
    # Usar init.d
    if sudo /etc/init.d/nginx reload 2>/dev/null; then
        echo -e "${GREEN}✅ Nginx recargado (init.d)${NC}"
    else
        echo -e "${YELLOW}⚠️  No se pudo recargar nginx automáticamente. Ejecuta manualmente: sudo /etc/init.d/nginx reload${NC}"
    fi
elif command -v systemctl &> /dev/null; then
    # Fallback a systemctl
    if sudo systemctl reload nginx 2>/dev/null; then
        echo -e "${GREEN}✅ Nginx recargado (systemd)${NC}"
    else
        echo -e "${YELLOW}⚠️  No se pudo recargar nginx automáticamente. Ejecuta manualmente: sudo systemctl reload nginx${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  No se encontró nginx (init.d ni systemctl). Recarga nginx manualmente si es necesario.${NC}"
fi

echo -e "${GREEN}🎉 ¡Despliegue completado!${NC}"
echo -e "${YELLOW}💡 Tip: Si no ves los cambios, haz hard refresh en el navegador (Ctrl+Shift+R)${NC}"

