import os
import subprocess
import json
import logging
import time
from pathlib import Path
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from datetime import date

# Importamos nuestros módulos de parser
import sys
sys.path.append(str(Path(__file__).parent.parent / "parser"))
from text_parser import parse_editorial_text
from generator import generate_typst_file

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("typst-flow")

app = FastAPI(title="Typst-Flow Editorial System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Rutas base
BASE_DIR = Path(__file__).parent.parent
TEMPLATES_DIR = BASE_DIR / "templates"
OUTPUT_DIR = BASE_DIR / "output"
LAYOUT_DATA_PATH = BASE_DIR / "parser" / "layout_from_json.json"

# Helpers para nombrar salidas
def derive_page_name(idml_filename: str) -> str:
    """
    Usa el nombre de la carpeta contenedora del IDML para el nombre de salida.
    Ej: carpeta 'diario_pagina1' -> diario_pagina1_YYYY-MM-DD.pdf
    """
    # El archivo suele llegar como 'preview.idml' (UI), tomamos parent folder.
    # Si no hay parent significativo, usamos stem del IDML.
    path = Path(idml_filename)
    folder = path.parent.name or path.stem
    today = date.today().strftime("%Y-%m-%d")
    safe_folder = folder.replace(" ", "_")
    return f"{safe_folder}_{today}"

OUTPUT_DIR.mkdir(exist_ok=True)

@app.get("/", response_class=HTMLResponse)
async def home():
    return """
    <html>
        <head>
            <title>Typst-Flow Editor</title>
            <style>
                body { font-family: sans-serif; display: flex; height: 100vh; margin: 0; background: #f0f2f5; }
                .editor-container { width: 40%; display: flex; flex-direction: column; padding: 20px; box-sizing: border-box; }
                .preview-container { width: 60%; background: #525659; display: flex; justify-content: center; padding: 20px; }
                textarea { flex-grow: 1; font-family: monospace; font-size: 14px; padding: 15px; border-radius: 8px; border: 1px solid #ccc; resize: none; outline: none; }
                button { margin-top: 15px; padding: 15px; background: #007bff; color: white; border: none; border-radius: 8px; font-weight: bold; cursor: pointer; }
                iframe { width: 100%; height: 100%; border: none; background: white; box-shadow: 0 0 20px rgba(0,0,0,0.5); }
            </style>
        </head>
        <body>
            <div class="editor-container">
                <h2>Typst-Flow: Redacción</h2>
                <textarea id="editor" placeholder="Escribe ##TITULO1 etc..."></textarea>
                <button onclick="updatePreview()">Previsualizar PDF (Sin Caché)</button>
            </div>
            <div class="preview-container">
                <iframe id="preview"></iframe>
            </div>
            <script>
                async function updatePreview() {
                    const text = document.getElementById('editor').value;
                    const iframe = document.getElementById('preview');
                    const formData = new FormData();
                    formData.append('text', text);
                    
                    const response = await fetch('/generate', { method: 'POST', body: formData });
                    if (response.ok) {
                        const blob = await response.blob();
                        const url = URL.createObjectURL(blob);
                        // Añadimos un timestamp para romper la caché del iframe
                        iframe.src = url + '#t=' + Date.now();
                    }
                }
            </script>
        </body>
    </html>
    """

@app.post("/generate")
async def generate_pdf(text: str = Form(...)):
    # Recargar el layout_data en cada petición para asegurar que lee los cambios del parser
    if not LAYOUT_DATA_PATH.exists():
        raise HTTPException(status_code=500, detail="Falta layout_data.json")

    with open(LAYOUT_DATA_PATH, "r") as f:
        layout_data = json.load(f)
            
        typ_path = OUTPUT_DIR / "current_page.typ"

        # Derivar nombre base de salida usando la carpeta contenedora
        base_name = derive_page_name("preview.idml")  # el UI manda preview.idml; usamos carpeta actual
        pdf_path = OUTPUT_DIR / f"{base_name}.pdf"
    
    # Generar el archivo .typ con el código más reciente
    generate_typst_file(layout_data, parse_editorial_text(text), typ_path)
    
    # Compilar
    result = subprocess.run(
        ["typst", "compile", "--root", str(BASE_DIR), str(typ_path), str(pdf_path)],
        capture_output=True, text=True
    )
    
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr)
        
    return FileResponse(
        pdf_path, 
        media_type="application/pdf",
        headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
    )

if __name__ == "__main__":
    import uvicorn
    # Activamos RELOAD para que el servidor se reinicie al tocar generator.py
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
