import json, base64, sys

# Uso: python extraer.py entrada.json salida.pdf nombre_clave
if len(sys.argv) < 4:
    print("Uso: python extraer.py <entrada.json> <salida.pdf> <clave>")
    sys.exit(1)

archivo_in, archivo_out, clave = sys.argv[1], sys.argv[2], sys.argv[3]

# 1. Cargar JSON
with open(archivo_in, 'r') as f:
    data = json.load(f)

# 2. Obtener base64 y limpiar si tiene prefijo (data:application/pdf;base64,)
contenido = data[clave].split(',')[-1]

# 3. Decodificar y Guardar
with open(archivo_out, 'wb') as f:
    f.write(base64.b64decode(contenido))

print(f"Hecho: {archivo_out} creado.")
