#!/bin/bash

# Script para iniciar servidor de desarrollo
# Ejecutar en el servidor

set -e

echo "=========================================="
echo "Iniciando servidor de desarrollo"
echo "=========================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "Error: package.json no encontrado"
    echo "Ejecuta este script desde el directorio raíz del proyecto"
    exit 1
fi

# Verificar que .env existe
if [ ! -f ".env" ]; then
    echo "⚠ ADVERTENCIA: Archivo .env no encontrado"
    echo ""
    read -p "¿Crear .env desde env.example? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        if [ -f "env.example" ]; then
            cp env.example .env
            echo "✓ Archivo .env creado. Por favor, edítalo con tus credenciales:"
            echo "  nano .env"
            exit 0
        else
            echo "✗ env.example no encontrado"
            exit 1
        fi
    else
        echo "Por favor, crea el archivo .env antes de continuar"
        exit 1
    fi
fi

# Verificar que node_modules existe
if [ ! -d "node_modules" ]; then
    echo "⚠ node_modules no encontrado"
    echo "Instalando dependencias..."
    npm install
fi

# Verificar puerto
PORT=5173
if command -v lsof &> /dev/null; then
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠ Puerto $PORT está en uso"
        read -p "¿Continuar de todos modos? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 0
        fi
    fi
fi

echo ""
echo "Iniciando servidor de desarrollo..."
echo "Servidor estará disponible en: http://0.0.0.0:$PORT"
echo ""
echo "Para detener el servidor, presiona Ctrl+C"
echo ""

# Iniciar servidor
npm run dev
