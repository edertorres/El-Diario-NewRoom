# Guía de Instalación del Servidor de Preview (Headless)

Esta guía detalla cómo instalar y configurar el servicio de previsualización IDML en un servidor Ubuntu (o Debian) sin interfaz gráfica (Headless).

## 1. Requisitos del Sistema

Se recomienda **Ubuntu 22.04 LTS** o superior.

## 2. Instalación de Scribus 1.6+

Scribus 1.4 (la versión por defecto en muchos repositorios) no tiene un soporte adecuado para IDML. Necesitamos la versión 1.6.x.

```bash
# Añadir el PPA oficial de Scribus para obtener la última versión estable (1.6+)
sudo add-apt-repository ppa:scribus/ppa
sudo apt update

# Instalar Scribus y las librerías necesarias para ejecución offscreen (headless)
sudo apt install -y scribus-ng python3-pip libqt5gui5 libqt5widgets5 libqt5network5
```

## 3. Instalación de Fuentes

Para que los IDML se vean correctamente, las fuentes utilizadas en InDesign deben estar instaladas en el servidor.

1. Crea un directorio para tus fuentes:

    ```bash
    sudo mkdir -p /usr/share/fonts/truetype/indesign
    ```

2. Sube tus fuentes (`.ttf`, `.otf`) a ese directorio.
3. Actualiza la caché de fuentes del sistema:

    ```bash
    sudo fc-cache -fv
    ```

4. Verifica que el sistema las reconoce:

    ```bash
    fc-list | grep "NombreDeTuFuente"
    ```

## 4. Configuración de la API (FastAPI) con uv

1. Clona el repositorio o copia la carpeta `preview-service` al servidor.
2. Crea un entorno virtual e instala las dependencias usando `uv`:

    ```bash
    cd preview-service
    uv venv
    source .venv/bin/activate
    uv pip install -r requirements.txt
    ```

## 5. Configuración como Servicio (Systemd)

Para que la API se inicie automáticamente y se reinicie en caso de fallo, configúrala como un servicio de sistema.

1. Crea el archivo del servicio:

    ```bash
    sudo nano /etc/systemd/system/idml-preview.service
    ```

2. Pega el siguiente contenido (ajusta las rutas `/home/usuario/...` a tu realidad):

    ```ini
    [Unit]
    Description=IDML Preview API Service
    After=network.target

    [Service]
    User=eder
    Group=eder
    WorkingDirectory=/home/eder/Proyectos/idml-injector-pro/preview-service
    Environment="PATH=/home/eder/Proyectos/idml-injector-pro/preview-service/venv/bin"
    Environment="QT_QPA_PLATFORM=offscreen"
    ExecStart=/home/eder/Proyectos/idml-injector-pro/preview-service/venv/bin/uvicorn app:app --host 0.0.0.0 --port 8000
    Restart=always

    [Install]
    WantedBy=multi-user.target
    ```

3. Activa e inicia el servicio:

    ```bash
    sudo systemctl daemon-reload
    sudo systemctl enable idml-preview
    sudo systemctl start idml-preview
    ```

## 6. Diagnóstico y Logs

Para ver qué está pasando con la API o con Scribus:

```bash
sudo journalctl -u idml-preview -f
```

## 7. Notas sobre el Modo Headless

El código está configurado para usar `QT_QPA_PLATFORM=offscreen`. Esto permite que Scribus se ejecute sin un servidor X (monitor). Si ves errores relacionados con "Could not connect to display", asegúrate de que esa variable de entorno esté correctamente configurada en tu script de inicio o servicio de systemd.

## 8. Configuración en el Frontend

Para que la aplicación web se comunique con la API en el servidor, tienes dos opciones:

1. **Proxy (Recomendado)**: Configura tu servidor web (Nginx/Apache) para que redirija las peticiones de `/api-preview` a `http://localhost:8000`.
2. **Variable de Entorno**: Si la API está en un dominio/IP diferente, puedes configurar la variable `VITE_PREVIEW_API_URL` en tu archivo `.env` del frontend:

    ```
    VITE_PREVIEW_API_URL=http://tu-servidor-ip:8000
    ```
