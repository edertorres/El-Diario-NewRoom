# Dockerfile para el servicio de previsualización
# Pipeline IDML: IDML → SLA (Python) → PDF (Scribus -g)
# Pipeline Typst: Typst → PDF (typst CLI)
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Instalar Scribus (rendering SLA→PDF), Xvfb (display virtual), Typst y dependencias
RUN apt-get update && apt-get install -y --no-install-recommends \
    scribus \
    xvfb \
    xauth \
    poppler-utils \
    fonts-liberation \
    fonts-dejavu-core \
    curl \
    xz-utils \
    fontconfig \
    libfontconfig1 \
    libfreetype6 \
    hyphen-es \
    && rm -rf /var/lib/apt/lists/*

# Instalar Typst (último release estable)
RUN curl -fsSL -o /tmp/typst.tar.xz \
    https://github.com/typst/typst/releases/latest/download/typst-x86_64-unknown-linux-musl.tar.xz \
    && tar -xJf /tmp/typst.tar.xz --strip-components=1 -C /usr/local/bin/ \
    && chmod +x /usr/local/bin/typst \
    && rm /tmp/typst.tar.xz \
    && typst --version

WORKDIR /app

# Dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Fuentes al sistema y a /app/Fonts
COPY Fonts /usr/share/fonts/truetype/custom
COPY Fonts /app/Fonts
RUN fc-cache -f

# Código del servicio
COPY app.py .
COPY idml_to_sla.py .
COPY export_sla.py .
COPY idml_to_high_fidelity_typst.py .
COPY migrate_sheets.py .
COPY ISOnewspaper26v4.icc .

# Configuración Scribus (evitar diálogos interactivos)
COPY .scribus /root/.scribus

EXPOSE 8000

# xvfb-run envuelve cada invocación de Scribus; no necesitamos Xvfb persistente
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
