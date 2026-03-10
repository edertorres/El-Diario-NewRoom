# Servicio de preview IDML (open-source, sin InDesign Server)

Genera un preview de IDML convirtiéndolo a PDF y PNG (primeras páginas) usando Scribus headless (CLI) y `pdf2image`.

## Requisitos
- Docker

## Build y ejecución
Requisitos en el host (Linux):
- Scribus instalado y accesible como `scribus` (CLI).
- poppler-utils (para `pdf2image`).

```bash
cd preview-service
uv venv .venv
source .venv/bin/activate
uv pip install -r requirements.txt
uvicorn app:app --host 0.0.0.0 --port 8000
```

## Uso
```bash
curl -X POST http://localhost:8000/preview \
  -F "file=@/ruta/a/archivo.idml" \
  -o preview.json
```
La respuesta incluye:
- `pdf_base64`: PDF completo en base64
- `png_base64`: PNGs (base64) de las primeras 3 páginas
- `pages_returned`: número de páginas devueltas

## Notas
- El servicio es stateless y limpia los temporales por solicitud.
- Ajusta `max_pages` en `app.py` si necesitas más previews.
- Para producción, conviene almacenar el PDF/PNGs en S3 u otro bucket y devolver URLs firmadas en vez de base64.
- Dependencias: Scribus en el sistema y poppler-utils para `pdf2image`.
