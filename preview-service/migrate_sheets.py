import os
import sqlite3
import json
import urllib.request
import urllib.parse
from pathlib import Path

# Configuración
BASE_DIR = Path(__file__).parent
DB_PATH = BASE_DIR / "database" / "logs.db"
ENV_PATH = BASE_DIR.parent / ".env"

def load_env():
    env = {}
    if ENV_PATH.exists():
        with open(ENV_PATH, "r") as f:
            for line in f:
                if "=" in line and not line.startswith("#"):
                    key, value = line.strip().split("=", 1)
                    env[key] = value.strip("'\"") # Limpiar comillas si las hay
    return env

def migrate():
    env = load_env()
    # Priorizar variables de entorno del sistema (Docker/Coolify) sobre el archivo .env
    spreadsheet_id = os.getenv("VITE_GOOGLE_SHEETS_LOG_ID") or env.get("VITE_GOOGLE_SHEETS_LOG_ID")
    api_key = os.getenv("VITE_GOOGLE_DRIVE_API_KEY") or env.get("VITE_GOOGLE_DRIVE_API_KEY")

    if not spreadsheet_id or not api_key:
        print("Error: VITE_GOOGLE_SHEETS_LOG_ID o VITE_GOOGLE_DRIVE_API_KEY no encontrados.")
        print("Asegúrate de configurarlos en las variables de entorno de Coolify.")
        return

    print(f"Iniciando migración desde Spreadsheet: {spreadsheet_id}")
    
    # URL para obtener los valores de la hoja "LOGS"
    # IMPORTANTE: La hoja debe ser pública (cualquiera con el vínculo) para que funcione con API KEY
    # Si no, fallará con 403.
    url = f"https://sheets.googleapis.com/v4/spreadsheets/{spreadsheet_id}/values/LOGS!A2:Z?key={api_key}"
    
    try:
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            rows = data.get("values", [])
            
        if not rows:
            print("No se encontraron datos en la hoja LOGS.")
            return

        print(f"Encontradas {len(rows)} filas. Insertando en SQLite...")
        
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        
        # Asegurar que la tabla existe (por si acaso se corre antes que el app.py)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                user_email TEXT,
                category TEXT,
                template TEXT,
                destination TEXT
            )
        ''')
        
        imported_count = 0
        for row in rows:
            # Mapeo según StoryMapper.tsx: [fechaHora, userEmail, categoriaPlantilla, nombrePlantilla, carpetaDestino]
            if len(row) < 5:
                continue
                
            timestamp = row[0]
            user_email = row[1]
            category = row[2]
            template = row[3]
            destination = row[4]
            
            cursor.execute(
                "INSERT INTO logs (timestamp, user_email, category, template, destination) VALUES (?, ?, ?, ?, ?)",
                (timestamp, user_email, category, template, destination)
            )
            imported_count += 1
            
        conn.commit()
        conn.close()
        
        print(f"Migración completada con éxito. Se importaron {imported_count} registros.")
        
    except Exception as e:
        print(f"Error durante la migración: {e}")
        print("\nNota: Asegúrate de que la hoja de Google Sheets sea pública (Cualquiera con el vínculo -> Lector)")
        print("o que la API KEY tenga los permisos necesarios.")

if __name__ == "__main__":
    migrate()
