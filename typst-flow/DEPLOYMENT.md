# Despliegue de Typst-Flow en Ubuntu 22.04

Este documento detalla la instalación del sistema editorial Typst-Flow.

## 1. Instalación de Dependencias

```bash
sudo apt update
sudo apt install -y imagemagick rclone

# Instalar uv (si no lo tienes)
curl -LsSf https://astral.sh/uv/install.sh | sh

# Instalar Typst
# Descarga el binario de: https://github.com/typst/typst/releases

# Configurar entorno con uv
uv venv
source .venv/bin/activate
uv pip install fastapi uvicorn python-multipart requests
```

## 2. Configuración de rclone (Google Drive)

1.  Ejecuta `rclone config` y sigue los pasos para crear un remoto llamado `drive`.
2.  Crea el punto de montaje:
    ```bash
    mkdir -p ~/GoogleDrive
    ```
3.  Monta la unidad (puedes poner esto en un script de inicio):
    ```bash
    rclone mount drive: ~/GoogleDrive --vfs-cache-mode full &
    ```

## 3. Automatización del Cierre de Edición

Para el "Cierre de Edición", usaremos un script que compile el PDF final (sin marcas de desbordamiento) y lo suba a la carpeta de "SALIDA" en Drive.

### Script de Cierre (`scripts/close_edition.sh`)

```bash
#!/bin/bash
# 1. Asegurar que las imágenes están actualizadas
python3 ../watcher/image_processor.py --run-once

# 2. Compilar PDF final (puedes crear un .typ especial sin bordes rojos)
typst compile ../output/current_page.typ ../output/PAGINA_FINAL.pdf

# 3. Subir a Google Drive mediante rclone
rclone copy ../output/PAGINA_FINAL.pdf drive:DIARIO/EDICION_HOY/PDFs/
```

## 4. Ejecución del Sistema

Recomendamos usar `tmux` o `systemd` para mantener los procesos corriendo:

1.  **API de Redacción**: `python3 service/app.py` (Puerto 8001)
2.  **Procesador de Fotos**: `python3 watcher/image_processor.py`

## 5. Permisos de ImageMagick
En Ubuntu 22.04, ImageMagick puede tener restricciones de seguridad para PDFs. Edita `/etc/ImageMagick-6/policy.xml` y cambia:
`<policy domain="coder" rights="none" pattern="PDF" />` a `rights="read|write"`.
