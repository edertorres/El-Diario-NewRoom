import os
import re
import subprocess
import tempfile
import shutil
import logging
import base64
import json
import urllib.request
import urllib.parse
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, BackgroundTasks, Request, Form
from fastapi.responses import FileResponse, Response
from fastapi.middleware.cors import CORSMiddleware

from idml_to_sla import IDMLToSLAConverter
from idml_to_high_fidelity_typst import IDMLToTypstProConverter

# Configurar logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("preview-service")

app = FastAPI(title="IDML PDF Prensa Service", version="0.9.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Overflow-Frames"],
)

BASE_DIR = Path(__file__).parent
TEMP_BASE = BASE_DIR / "temp"
TEMP_BASE.mkdir(parents=True, exist_ok=True)

ICC_PROFILE = BASE_DIR / "ISOnewspaper26v4.icc"
EXPORT_SLA_SCRIPT = BASE_DIR / "export_sla.py"
SCRIBUS_TIMEOUT = 120  # segundos


def cleanup_temp_dir(temp_dir: str):
    """Borra el directorio temporal después de enviar la respuesta."""
    shutil.rmtree(temp_dir, ignore_errors=True)


def get_executable_path(name: str):
    """Busca un ejecutable en el venv local o en el sistema."""
    local_bin = BASE_DIR / ".venv" / "bin" / name
    if local_bin.exists():
        return str(local_bin)
    local_bin_alt = BASE_DIR / "venv" / "bin" / name
    if local_bin_alt.exists():
        return str(local_bin_alt)
    path_exec = shutil.which(name)
    if path_exec:
        return path_exec
    return name


def run_scribus_export(sla_path: Path, output_pdf: Path, show_overflows: bool = True):
    """
    Usa Scribus -g para abrir un SLA y exportarlo a PDF.
    
    Envuelve Scribus en xvfb-run para que tenga un display X11 virtual.
    Esto funciona tanto en Docker como en local sin necesitar Xvfb persistente.
    """
    scribus_exec = get_executable_path("scribus")
    xvfb_run = shutil.which("xvfb-run")

    scribus_cmd = [
        scribus_exec, "-g", "-py", str(EXPORT_SLA_SCRIPT),
        str(sla_path),
    ]

    # Envolver con xvfb-run para display virtual temporal
    if xvfb_run:
        cmd = [
            xvfb_run, "--auto-servernum", "--server-args=-screen 0 1024x768x24",
            "--"
        ] + scribus_cmd
    else:
        cmd = scribus_cmd

    env = os.environ.copy()
    # Pasar paths al script via variables de entorno
    env["EXPORT_OUTPUT_PDF"] = str(output_pdf)
    env["EXPORT_SLA_PATH"] = str(sla_path)
    env["EXPORT_SHOW_OVERFLOWS"] = "1" if show_overflows else "0"
    if ICC_PROFILE.exists():
        env["EXPORT_ICC_PROFILE"] = str(ICC_PROFILE)
    # Si no hay xvfb-run ni DISPLAY, usar offscreen como último recurso
    if not xvfb_run and not env.get("DISPLAY"):
        env["QT_QPA_PLATFORM"] = "offscreen"

    logger.info(f"Ejecutando: {' '.join(cmd)}")

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=SCRIBUS_TIMEOUT,
            env=env,
        )

        if result.stdout:
            for line in result.stdout.strip().split('\n'):
                logger.info(f"[Scribus] {line}")

        if result.stderr:
            # Filtrar warnings de Qt/Xvfb que no son errores reales
            important = [l for l in result.stderr.strip().split('\n')
                         if not l.startswith(('QStandardPaths:', 'qt.', 'Warning:',
                                              'Xvfb ', '_XSERVTransmk'))]
            if important:
                logger.warning(f"[Scribus stderr] {'; '.join(important)}")

        if result.returncode != 0:
            raise RuntimeError(
                f"Scribus terminó con código {result.returncode}. "
                f"stderr: {result.stderr[-500:] if result.stderr else 'vacío'}"
            )

        if not output_pdf.exists():
            raise RuntimeError("Scribus terminó pero no generó el PDF")

        logger.info(f"PDF generado por Scribus: {output_pdf} ({output_pdf.stat().st_size} bytes)")

    except subprocess.TimeoutExpired:
        raise RuntimeError(
            f"Scribus se colgó (timeout {SCRIBUS_TIMEOUT}s). "
            "El SLA podría tener un problema."
        )


def render_idml_to_pdf(idml_path: Path, output_pdf: Path, show_overflows: bool = True) -> list:
    """
    Pipeline híbrido IDML → PDF:
      1. IDML → SLA  (conversor Python puro — evita hang del importador IDML de Scribus)
      2. SLA  → PDF  (Scribus -g — rendering fiel con fuentes, colores, layout)

    Retorna lista de overflows detectados (puede estar vacía).
    """
    # Paso 1: Convertir IDML → SLA con Python
    sla_path = idml_path.parent / f"{idml_path.stem}.sla"
    logger.info(f"Paso 1: Convirtiendo IDML → SLA: {idml_path.name}")

    try:
        converter = IDMLToSLAConverter(str(idml_path))
        converter.convert(str(sla_path))
        logger.info(f"SLA generado: {sla_path} ({sla_path.stat().st_size} bytes)")
    except Exception as e:
        logger.error(f"Error convirtiendo IDML a SLA: {e}")
        raise RuntimeError(f"Error convirtiendo IDML a SLA: {e}")

    # Paso 2: Renderizar SLA → PDF con Scribus
    logger.info(f"Paso 2: Renderizando SLA → PDF con Scribus (show_overflows={show_overflows})")
    run_scribus_export(sla_path, output_pdf, show_overflows=show_overflows)

    # Paso 3: Leer overflows.json si existe
    overflows_json = sla_path.parent / f"{sla_path.stem}_overflows.json"
    overflows = []
    if overflows_json.exists():
        try:
            with overflows_json.open("r", encoding="utf-8") as f:
                overflows = json.load(f)
            logger.info(f"Overflows detectados: {len(overflows)} frames con desborde")
        except Exception as e:
            logger.warning(f"No se pudo leer overflows.json: {e}")

    return overflows


async def render_idml_to_typst_pdf(idml_path: Path, output_pdf: Path, images_folder_id: Optional[str] = None, auth_header: Optional[str] = None, provider: str = "google") -> None:
    """
    Pipeline IDML → Typst → PDF (High Fidelity):
      1. Descarga imágenes si hay folder_id (ANTES para que el conversor las vea)
      2. IDML → TYP  (Conversor Python Pro)
      3. TYP  → PDF  (Typst compile)
    """
    tmp_dir = idml_path.parent
    typ_path = tmp_dir / f"{idml_path.stem}.typ"
    links_dir = tmp_dir / "Links"
    links_dir.mkdir(exist_ok=True, parents=True) # parents=True por seguridad
    
    # El usuario ha indicado que las imágenes NO se leen de Drive para el previo,
    # sino que son las enviadas directamente desde la UI. 
    # Por lo tanto, no descargamos nada de Drive aquí para evitar "mass downloads" de basura.

    # Log de archivos para diagnóstico (incluyendo carpetas)
    all_files_diag = []
    for root, dirs, files in os.walk(str(tmp_dir)):
        for d in dirs:
            all_files_diag.append(os.path.relpath(os.path.join(root, d), str(tmp_dir)) + "/")
        for f in files:
            all_files_diag.append(os.path.relpath(os.path.join(root, f), str(tmp_dir)))
    logger.info(f"Estructura antes de conversión: {all_files_diag}")

    # Paso 2: IDML → TYP
    logger.info(f"Paso 2: Convirtiendo IDML → Typst Pro: {idml_path.name}")
    try:
        converter = IDMLToTypstProConverter(str(idml_path))
        converter.convert(str(typ_path))
        logger.info(f"Archivo .typ generado: {typ_path}")
    except Exception as e:
        logger.error(f"Error convirtiendo IDML a Typst: {e}")
        # Intentar diagnóstico adicional
        if typ_path.exists():
            with open(typ_path, "r", encoding="utf-8") as f:
                logger.info(f"Contenido parcial del .typ generado (error): {f.read(500)}...")
        raise RuntimeError(f"Error convirtiendo IDML a Typst: {e}")

    # Paso 3: TYP → PDF
    typst_exec = get_executable_path("typst")
    cmd = [typst_exec, "compile", str(typ_path), str(output_pdf)]

    fonts_dir = BASE_DIR / "Fonts"
    if fonts_dir.exists():
        cmd.insert(2, "--font-path")
        cmd.insert(3, str(fonts_dir))

    logger.info(f"Compilando Typst: {' '.join(cmd)}")
    result = subprocess.run(
        cmd, 
        capture_output=True, 
        text=True, 
        timeout=30,
        cwd=str(tmp_dir)
    )
    
    if result.returncode != 0:
        logger.error(f"Error en Typst compile: {result.stderr}")
        # Listar archivos para diagnóstico final (recursivo)
        diag_files = []
        for root, dirs, files in os.walk(str(tmp_dir)):
            for f in files:
                rel = os.path.relpath(os.path.join(root, f), str(tmp_dir))
                diag_files.append(rel)
        
        diag_msg = f"Error en Typst compile: {result.stderr}\nArchivos en temp: {diag_files}"
        logger.info(diag_msg)
        raise RuntimeError(diag_msg)

    if not output_pdf.exists():
        raise RuntimeError("Typst terminó pero no generó el PDF")


# ── Endpoints ────────────────────────────────────────────────────────

@app.post("/preview")
async def preview_idml(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    images: Optional[List[UploadFile]] = File(None),
    show_overflows: bool = True
):
    logger.info(f"Nueva petición de preview: {file.filename}")
    if not file.filename.lower().endswith(".idml"):
        raise HTTPException(status_code=400, detail="El archivo debe ser .idml")

    tmp_dir = Path(tempfile.mkdtemp(prefix="idml-preview-", dir=TEMP_BASE))
    logger.info(f"Directorio temporal: {tmp_dir}")

    try:
        idml_path = tmp_dir / file.filename
        pdf_path = tmp_dir / "output.pdf"
        links_dir = tmp_dir / "Links"
        links_dir.mkdir(exist_ok=True)

        # Guardar archivo IDML
        with idml_path.open("wb") as f:
            f.write(await file.read())

        # Guardar imágenes en Links/
        if images:
            for img in images:
                img_data = await img.read()
                img_path = links_dir / img.filename
                with img_path.open("wb") as f:
                    f.write(img_data)
                logger.info(f"  Imagen guardada: {img.filename} ({len(img_data)} bytes)")
            logger.info(f"{len(images)} imágenes guardadas en {links_dir}")
            # Listar archivos en Links/ para debug
            for f_name in sorted(links_dir.iterdir()):
                logger.info(f"  Links/: {f_name.name} ({f_name.stat().st_size} bytes)")
        else:
            logger.info("No se recibieron imágenes en esta petición")

        # Pipeline: IDML → SLA (Python) → PDF (Scribus -g)
        overflows = render_idml_to_pdf(idml_path, pdf_path, show_overflows=show_overflows)

        if not pdf_path.exists():
            raise HTTPException(status_code=500, detail="No se generó el PDF.")

        logger.info(f"PDF listo: {pdf_path.name} ({pdf_path.stat().st_size} bytes)")
        background_tasks.add_task(cleanup_temp_dir, str(tmp_dir))

        # Devolver PDF con metadata de overflows en header custom
        headers = {}
        if overflows:
            headers["X-Overflow-Frames"] = json.dumps(overflows, ensure_ascii=False)
            headers["Access-Control-Expose-Headers"] = "X-Overflow-Frames"

        return FileResponse(
            path=pdf_path,
            filename=f"{idml_path.stem}_prensa.pdf",
            media_type="application/pdf",
            headers=headers,
        )

    except Exception as exc:
        logger.exception(f"Error en preview de {file.filename}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc))
@app.post("/preview-typst-pro")
async def preview_typst_pro(
    background_tasks: BackgroundTasks,
    request: Request,
    file: UploadFile = File(...),
    images: Optional[List[UploadFile]] = File(None),
    images_folder_id: Optional[str] = Form(None)
):
    logger.info(f"Nueva petición de preview Typst Pro: {file.filename}")
    if not file.filename.lower().endswith(".idml"):
        raise HTTPException(status_code=400, detail="El archivo debe ser .idml")

    tmp_dir = Path(tempfile.mkdtemp(prefix="typst-pro-", dir=TEMP_BASE))

    try:
        idml_path = tmp_dir / file.filename
        pdf_path = tmp_dir / "output.pdf"
        
        # Crear subdirectorio Links/ para consistencia con Scribus y el conversor Pro
        links_dir = tmp_dir / "Links"
        links_dir.mkdir(exist_ok=True)
        
        # Guardar archivo IDML
        idml_data = await file.read()
        with idml_path.open("wb") as f:
            f.write(idml_data)
        logger.info(f"IDML guardado: {idml_path.name} ({len(idml_data)} bytes)")
        
        # Guardar imágenes subidas manualmente en Links/
        if images:
            logger.info(f"Recibidas {len(images)} imágenes para Typst Pro")
            for img in images:
                if not img.filename: continue
                img_data = await img.read()
                img_path = links_dir / Path(img.filename).name
                with img_path.open("wb") as f:
                    f.write(img_data)
                logger.info(f"  Imagen guardada: {img_path.name} ({len(img_data)} bytes)")
            logger.info(f"{len(images)} imágenes guardadas en {links_dir}")
        else:
            logger.info("No se recibieron imágenes adjuntas en la petición Typst Pro")
        
        # Renderizado Pro (Solo usamos las imágenes ya guardadas en Links/)
        await render_idml_to_typst_pdf(idml_path, pdf_path, None, None)

        # background_tasks.add_task(cleanup_temp_dir, str(tmp_dir))

        return FileResponse(
            path=pdf_path,
            filename=f"{idml_path.stem}_typst.pdf",
            media_type="application/pdf"
        )

    except Exception as exc:
        logger.exception(f"Error en preview Typst Pro de {file.filename}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc))


def download_drive_folder(folder_id: str, auth_header: str, tmp_dir: Path):
    """Descarga todos los archivos de una carpeta de Drive."""
    q = f"'{folder_id}' in parents and trashed = false"
    params = urllib.parse.urlencode({
        "q": q, 
        "fields": "files(id, name, mimeType)",
        "supportsAllDrives": "true",
        "includeItemsFromAllDrives": "true"
    })
    url = f"https://www.googleapis.com/drive/v3/files?{params}"

    try:
        req = urllib.request.Request(url)
        if auth_header:
            req.add_header("Authorization", auth_header)

        with urllib.request.urlopen(req) as response:
            if response.getcode() != 200:
                logger.error(f"Error listing Drive folder: {response.getcode()}")
                return
                
            drive_data = json.loads(response.read().decode())
            files = drive_data.get("files", [])
            logger.info(f"Escaneando {len(files)} archivos en carpeta {folder_id}...")

            download_count = 0
            for f_info in files:
                file_id = f_info["id"]
                file_name = f_info["name"]
                mime_type = f_info.get("mimeType", "")
                
                # FILTRO ESTRICTO: Solo imágenes o PDFs (que pueden ser assets)
                is_image = mime_type.startswith('image/') or mime_type == 'application/pdf'
                is_ignored = file_name.lower().endswith(('.idml', '.sla', '.zip'))
                
                # Si no es imagen, o es un archivo ignorado, saltar
                if not is_image or is_ignored:
                    continue
                
                # Omitir miniaturas de plantillas (ej: "1.png", "34.png" - solo números)
                if file_name.lower().endswith('.png') and file_name[:-4].isdigit():
                    continue

                # Descargar archivo (Soporte para Shared Drives)
                download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media&supportsAllDrives=true"
                d_req = urllib.request.Request(download_url)
                if auth_header:
                    d_req.add_header("Authorization", auth_header)
                
                try:
                    with urllib.request.urlopen(d_req) as d_response:
                        if d_response.getcode() == 200:
                            content = d_response.read()
                            with open(tmp_dir / file_name, "wb") as f:
                                f.write(content)
                            logger.info(f"  Descargado asset: {file_name} ({len(content)} bytes)")
                            download_count += 1
                except Exception as de:
                    logger.warning(f"Error descargando {file_name}: {de}")
            
            logger.info(f"Descarga de Drive finalizada: {download_count} archivos guardados de {len(files)} totales.")
                    
    except Exception as e:
        logger.error(f"Error en download_drive_folder: {e}")


def download_images(code: str, folder_id: str, auth_header: str, tmp_dir: Path, provider: str = "google"):
    """Busca imágenes referenciadas en Typst y las descarga."""
    image_names = re.findall(r'#image\("([^"]+)"', code)
    if not image_names:
        return

    logger.info(f"Buscando {len(image_names)} imágenes en {provider}: {folder_id}")

    if provider != "google":
        logger.warning(f"Proveedor '{provider}' no implementado para descarga de imágenes")
        return

    q = f"'{folder_id}' in parents and trashed = false"
    params = urllib.parse.urlencode({"q": q, "fields": "files(id, name)"})
    url = f"https://www.googleapis.com/drive/v3/files?{params}"

    try:
        req = urllib.request.Request(url)
        req.add_header("Authorization", auth_header)

        with urllib.request.urlopen(req) as response:
            if response.getcode() != 200:
                return
            drive_data = json.loads(response.read().decode())
            file_map = {f["name"].lower(): f for f in drive_data.get("files", [])}

            for img_name in set(image_names):
                if img_name.lower() in file_map:
                    file_id = file_map[img_name.lower()]["id"]
                    download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"
                    d_req = urllib.request.Request(download_url)
                    d_req.add_header("Authorization", auth_header)
                    try:
                        with urllib.request.urlopen(d_req) as d_response:
                            if d_response.getcode() == 200:
                                with open(tmp_dir / img_name, "wb") as f:
                                    f.write(d_response.read())
                    except Exception as de:
                        logger.warning(f"Error descargando {img_name}: {de}")
    except Exception as e:
        logger.error(f"Error descargando imágenes: {e}")


@app.post("/compile-typst")
def compile_typst(request: Request, background_tasks: BackgroundTasks, payload: dict):
    logger.info("Nueva petición de compilación Typst")

    code = payload.get("code")
    images_folder_id = payload.get("imagesFolderId")
    provider = payload.get("provider", "google")
    auth_header = request.headers.get("Authorization")

    if not code:
        raise HTTPException(status_code=400, detail="El código Typst es requerido")

    tmp_dir = Path(tempfile.mkdtemp(prefix="typst-compile-", dir=TEMP_BASE))

    try:
        if images_folder_id and auth_header:
            download_images(code, images_folder_id, auth_header, tmp_dir, provider)

        # Imágenes simuladas (Base64)
        for sim_img in payload.get("simulatedImages", []):
            name = sim_img.get("name")
            data_b64 = sim_img.get("data")
            if name and data_b64:
                try:
                    if "," in data_b64:
                        data_b64 = data_b64.split(",")[1]
                    with open(tmp_dir / name, "wb") as f:
                        f.write(base64.b64decode(data_b64))
                except Exception as e:
                    logger.error(f"Error decodificando imagen {name}: {e}")

        typ_path = tmp_dir / "input.typ"
        pdf_path = tmp_dir / "output.pdf"

        with typ_path.open("w", encoding="utf-8") as f:
            f.write(code)

        typst_exec = get_executable_path("typst")
        cmd = [typst_exec, "compile", str(typ_path), str(pdf_path)]

        fonts_dir = BASE_DIR / "Fonts"
        if fonts_dir.exists():
            cmd.insert(2, "--font-path")
            cmd.insert(3, str(fonts_dir))

        logger.info(f"Ejecutando: {' '.join(cmd)}")

        result = subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=30)

        if result.stdout:
            logger.info(f"[Typst] {result.stdout}")

        if not pdf_path.exists():
            raise HTTPException(status_code=500, detail="Typst no creó el PDF.")

        logger.info(f"PDF Typst: {pdf_path.name} ({pdf_path.stat().st_size} bytes)")
        background_tasks.add_task(cleanup_temp_dir, str(tmp_dir))

        return FileResponse(path=pdf_path, filename="preview.pdf", media_type="application/pdf")

    except subprocess.CalledProcessError as exc:
        logger.error(f"[Typst Error]: {exc.stderr}")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=f"Error Typst: {exc.stderr}")
    except Exception as exc:
        logger.exception("Error en compilación Typst")
        shutil.rmtree(tmp_dir, ignore_errors=True)
        raise HTTPException(status_code=500, detail=str(exc))


@app.get("/health")
def health():
    return {"status": "ok"}
