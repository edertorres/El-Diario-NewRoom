#!/bin/bash

# Script de verificación de configuración
# Ejecutar en el servidor después de la instalación

set -e

echo "=========================================="
echo "Verificación de configuración"
echo "=========================================="
echo ""

# Verificar Node.js
echo "1. Verificando Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    NODE_MAJOR=$(echo $NODE_VERSION | cut -d'v' -f2 | cut -d'.' -f1)
    echo "   ✓ Node.js instalado: $NODE_VERSION"
    if [ "$NODE_MAJOR" -ge 18 ]; then
        echo "   ✓ Versión compatible (>=18)"
    else
        echo "   ✗ Versión incompatible. Se requiere Node.js >=18"
        exit 1
    fi
else
    echo "   ✗ Node.js no está instalado"
    exit 1
fi

# Verificar npm
echo ""
echo "2. Verificando npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "   ✓ npm instalado: $NPM_VERSION"
else
    echo "   ✗ npm no está instalado"
    exit 1
fi

# Verificar proyecto
echo ""
echo "3. Verificando proyecto..."
if [ -f "package.json" ]; then
    echo "   ✓ package.json encontrado"
else
    echo "   ✗ package.json no encontrado. ¿Estás en el directorio correcto?"
    exit 1
fi

# Verificar node_modules
echo ""
echo "4. Verificando dependencias..."
if [ -d "node_modules" ]; then
    echo "   ✓ node_modules existe"
    MODULE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo "   ✓ Módulos instalados: $MODULE_COUNT"
else
    echo "   ⚠ node_modules no existe. Ejecuta: npm install"
fi

# Verificar .env
echo ""
echo "5. Verificando variables de entorno..."
if [ -f ".env" ]; then
    echo "   ✓ Archivo .env existe"
    
    # Verificar variables críticas
    MISSING_VARS=()
    
    if ! grep -q "VITE_GOOGLE_DRIVE_CLIENT_ID=" .env || grep -q "VITE_GOOGLE_DRIVE_CLIENT_ID=tu_" .env; then
        MISSING_VARS+=("VITE_GOOGLE_DRIVE_CLIENT_ID")
    fi
    
    if ! grep -q "VITE_GOOGLE_DRIVE_API_KEY=" .env || grep -q "VITE_GOOGLE_DRIVE_API_KEY=tu_" .env; then
        MISSING_VARS+=("VITE_GOOGLE_DRIVE_API_KEY")
    fi
    
    if ! grep -q "GEMINI_API_KEY=" .env || grep -q "GEMINI_API_KEY=tu_" .env; then
        MISSING_VARS+=("GEMINI_API_KEY")
    fi
    
    if [ ${#MISSING_VARS[@]} -eq 0 ]; then
        echo "   ✓ Variables críticas configuradas"
    else
        echo "   ⚠ Variables faltantes o no configuradas:"
        for var in "${MISSING_VARS[@]}"; do
            echo "     - $var"
        done
    fi
else
    echo "   ⚠ Archivo .env no existe. Crea uno desde env.example"
fi

# Verificar firewall
echo ""
echo "6. Verificando firewall..."
if systemctl is-active --quiet firewalld; then
    if sudo firewall-cmd --list-ports | grep -q "5173/tcp"; then
        echo "   ✓ Puerto 5173 abierto en firewalld"
    else
        echo "   ⚠ Puerto 5173 no está abierto en firewalld"
        echo "     Ejecuta: sudo firewall-cmd --permanent --add-port=5173/tcp && sudo firewall-cmd --reload"
    fi
elif command -v iptables &> /dev/null; then
    if sudo iptables -L INPUT -n | grep -q "5173"; then
        echo "   ✓ Puerto 5173 configurado en iptables"
    else
        echo "   ⚠ Puerto 5173 no está configurado en iptables"
    fi
else
    echo "   ⚠ No se detectó firewall. Verifica manualmente el puerto 5173"
fi

# Verificar puerto disponible
echo ""
echo "7. Verificando puerto 5173..."
if command -v netstat &> /dev/null; then
    if netstat -tuln 2>/dev/null | grep -q ":5173"; then
        echo "   ⚠ Puerto 5173 está en uso"
    else
        echo "   ✓ Puerto 5173 disponible"
    fi
elif command -v ss &> /dev/null; then
    if ss -tuln 2>/dev/null | grep -q ":5173"; then
        echo "   ⚠ Puerto 5173 está en uso"
    else
        echo "   ✓ Puerto 5173 disponible"
    fi
fi

echo ""
echo "=========================================="
echo "Verificación completada"
echo "=========================================="
echo ""
echo "Si todo está correcto, ejecuta: npm run dev"
echo ""
