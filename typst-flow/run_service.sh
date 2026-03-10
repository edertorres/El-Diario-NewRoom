#!/bin/bash
# Script para ejecutar Typst-Flow con uv

# Asegurar que estamos en el directorio correcto
cd "$(dirname "$0")"

# Usar uv para ejecutar el servicio directamente
# uv run se encarga de gestionar el entorno virtual de forma transparente
echo "Lanzando Typst-Flow Service con uv..."
uv run python service/app.py
