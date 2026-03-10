import os
import subprocess
import json
import time
from pathlib import Path

# Configuración
BASE_DIR = Path(__file__).parent.parent
LAYOUT_DATA_PATH = BASE_DIR / "parser" / "layout_from_json.json"
DRIVE_PATH = Path("/home/eder/GoogleDrive/Fotos_Diario")  # Carpeta montada con rclone
PROCESSED_DIR = BASE_DIR / "processed_images"

PROCESSED_DIR.mkdir(exist_ok=True)

def process_image(input_path, output_path, width_pt, height_pt):
    """
    Usa ImageMagick para convertir a CMYK y redimensionar.
    Convertimos pt a px asumiendo 72 DPI (Typst default).
    """
    # 1 pt = 1 px en Typst por defecto
    w = int(width_pt)
    h = int(height_pt)
    
    print(f"Procesando {input_path.name} para slot {w}x{h}pt...")
    
    try:
        # Comando de ImageMagick (convert o magick)
        # -colorspace CMYK: para prensa
        # -resize x^ -gravity center -extent: crop inteligente para llenar el slot
        # -level: ajuste de contraste básico para papel prensa
        subprocess.run([
            "magick", str(input_path),
            "-colorspace", "CMYK",
            "-resize", f"{w}x{h}^",
            "-gravity", "center",
            "-extent", f"{w}x{h}",
            "-level", "5%,95%,1.0",
            str(output_path)
        ], check=True)
        return True
    except Exception as e:
        print(f"Error procesando imagen: {e}")
        return False

def watch_folder():
    print(f"Iniciando observador en {DRIVE_PATH}...")
    
    # Cargamos el layout para saber los tamaños de las fotos
    with open(LAYOUT_DATA_PATH, "r") as f:
        layout = json.load(f)
        image_slots = {s["tag"]: s for s in layout["slots"] if s["type"] == "image"}

    while True:
        if not DRIVE_PATH.exists():
            print(f"Error: {DRIVE_PATH} no está montado.")
            time.sleep(10)
            continue

        for img_file in DRIVE_PATH.glob("*.*"):
            if img_file.suffix.lower() in ['.jpg', '.jpeg', '.png', '.tiff']:
                # Buscamos si el nombre coincide con un slot (ej: FOTO1.jpg)
                tag = img_file.stem.upper()
                if tag in image_slots:
                    slot = image_slots[tag]
                    # Mantener el nombre original (sin alterar avisos u otros archivos)
                    output_file = PROCESSED_DIR / f"{tag}{img_file.suffix.lower()}"
                    
                    # Solo procesar si es nueva o ha cambiado
                    if (not output_file.exists()) or (img_file.stat().st_mtime > output_file.stat().st_mtime):
                        process_image(img_file, output_file, slot["w"], slot["h"])
        
        time.sleep(5) # Revisar cada 5 segundos

if __name__ == "__main__":
    watch_folder()
