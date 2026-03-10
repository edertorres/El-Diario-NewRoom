#!/bin/bash

# Directorio base del script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

# Activar entorno virtual si existe
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# --- Configuración de display para Scribus ---
# Scribus necesita un event loop Qt funcional para importar IDML.
# Intentamos usar Xvfb para un display virtual; si no está disponible,
# app.py usará QT_QPA_PLATFORM=offscreen como fallback.
if [ -z "$DISPLAY" ]; then
    if command -v Xvfb &> /dev/null; then
        echo "Iniciando Xvfb en :99..."
        Xvfb :99 -screen 0 1024x768x24 -nolisten tcp -ac &
        export DISPLAY=:99
        echo "Display virtual configurado: $DISPLAY"
    else
        echo "Xvfb no disponible. Scribus usará QT_QPA_PLATFORM=offscreen."
        echo "Para mejor compatibilidad IDML, instala Xvfb: sudo pacman -S xorg-server-xvfb"
    fi
else
    echo "Usando display existente: $DISPLAY"
fi

# Iniciar la API con Uvicorn
echo "Iniciando API de Preview..."
uv run uvicorn app:app --host 0.0.0.0 --port 8000 --reload
