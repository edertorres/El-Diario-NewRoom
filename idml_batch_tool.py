#!/usr/bin/env python3
import os
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
import requests
import sys
import argparse
from collections import Counter

def get_idml_fonts(idml_path):
    """
    Extrae las fuentes de un archivo IDML abriéndolo como ZIP
    y leyendo Resources/Fonts.xml.
    """
    fonts_info = []
    try:
        with zipfile.ZipFile(idml_path, 'r') as z:
            if 'Resources/Fonts.xml' in z.namelist():
                with z.open('Resources/Fonts.xml') as f:
                    tree = ET.parse(f)
                    root = tree.getroot()
                    
                    # El XML de IDML usa namespaces, iter() con tag local funciona bien
                    for font in root.iter():
                        # Quitamos el namespace del tag para comparar
                        tag_local = font.tag.split('}')[-1] if '}' in font.tag else font.tag
                        
                        if tag_local == 'Font':
                            name = font.attrib.get('Self', '').split('/')[-1]
                            # A veces el nombre está en 'Name' o 'FullName'
                            full_name = font.attrib.get('Name', name)
                            font_type = font.attrib.get('FontType', 'Unknown')
                            font_style = font.attrib.get('FontStyle', 'Regular')
                            
                            fonts_info.append({
                                'name': full_name,
                                'style': font_style,
                                'type': font_type
                            })
    except Exception as e:
        print(f"Error al extraer fuentes de {idml_path.name}: {e}")
    
    return fonts_info

def process_idml(idml_path, api_url):
    """Procesa un archivo IDML individual."""
    results = {
        'file': str(idml_path),
        'name': idml_path.name,
        'fonts': [],
        'success': False,
        'error': None,
        'output': None
    }
    
    # 1. Extraer fuentes
    results['fonts'] = get_idml_fonts(idml_path)
    
    # 2. Petición a la API
    try:
        api_endpoint = f"{api_url.rstrip('/')}/preview"
        with open(idml_path, 'rb') as f:
            files = {'file': (idml_path.name, f, 'application/x-indesign')}
            response = requests.post(api_endpoint, files=files, timeout=120)
            
            if response.status_code == 200:
                # La API devuelve un PDF. Lo guardamos y tratamos de convertir a PNG.
                temp_pdf = idml_path.with_suffix('.temp.pdf')
                with open(temp_pdf, 'wb') as out_f:
                    out_f.write(response.content)
                
                output_png = idml_path.with_suffix('.png')
                
                # Intentar conversión a PNG
                try:
                    from pdf2image import convert_from_path
                    images = convert_from_path(temp_pdf, first_page=1, last_page=1, dpi=96)
                    if images:
                        images[0].save(output_png, 'PNG')
                        results['output'] = str(output_png)
                        results['success'] = True
                except ImportError:
                    # Si no hay pdf2image, guardamos el PDF pero avisamos
                    output_pdf = idml_path.with_suffix('.pdf')
                    os.rename(temp_pdf, output_pdf)
                    results['output'] = str(output_pdf)
                    results['success'] = True
                    results['error'] = "Aviso: pdf2image no instalado. Se guardó como PDF en su lugar."
                except Exception as e:
                    results['error'] = f"Error en conversión a PNG: {e}"
                    # Mantener el PDF si falló la conversión
                    output_pdf = idml_path.with_suffix('.pdf')
                    os.rename(temp_pdf, output_pdf)
                    results['output'] = str(output_pdf)
                    results['success'] = True
                finally:
                    # Limpiar PDF temporal si existe y el proceso continuó (ya sea éxito o error en conversión)
                    if os.path.exists(temp_pdf):
                        try:
                            os.remove(temp_pdf)
                        except:
                            pass
            else:
                results['error'] = f"API Error ({response.status_code}): {response.text}"
    except Exception as e:
        results['error'] = f"Error de conexión: {e}"
        
    return results

def main():
    parser = argparse.ArgumentParser(description="Herramienta de procesamiento por lotes para IDML.")
    parser.add_argument("--api", default="http://localhost:8000", help="URL de la API (default: http://localhost:8000)")
    parser.add_argument("--path", default=".", help="Carpeta a escanear (default: .)")
    args = parser.parse_args()

    root_path = Path(args.path)
    if not root_path.exists():
        print(f"Error: La ruta {args.path} no existe.")
        sys.exit(1)

    # Escaneo recursivo profundidad 1
    # 1. Archivos en el directorio actual
    idml_files = list(root_path.glob("*.idml"))
    
    # 2. Archivos en subdirectorios inmediatos
    for entry in root_path.iterdir():
        if entry.is_dir() and not entry.name.startswith('.'):
            idml_files.extend(list(entry.glob("*.idml")))

    if not idml_files:
        print("No se encontraron archivos .idml.")
        return

    print(f"Iniciando procesamiento de {len(idml_files)} archivos...\n")
    
    all_results = []
    all_fonts_inventory = []

    for idml_file in idml_files:
        print(f"Procesando: {idml_file.name}...", end="", flush=True)
        res = process_idml(idml_file, args.api)
        all_results.append(res)
        
        if res['success']:
            print(" [OK]")
            if res['error']: # Aviso de PDF
                print(f"  └─ {res['error']}")
        else:
            print(" [FALLÓ]")
            print(f"  └─ Error: {res['error']}")
        
        # Guardar fuentes para el inventario global
        for f in res['fonts']:
            all_fonts_inventory.append(f"{f['name']} ({f['type']})")

    # Resumen final
    print("\n" + "="*50)
    print("RESUMEN DE PROCESAMIENTO")
    print("="*50)
    
    success_count = sum(1 for r in all_results if r['success'])
    print(f"Archivos procesados: {len(all_results)}")
    print(f"Éxitos: {success_count}")
    print(f"Fallos: {len(all_results) - success_count}")
    
    print("\nInventario de Fuentes Detectadas:")
    if all_fonts_inventory:
        counts = Counter(all_fonts_inventory)
        for font, count in sorted(counts.items()):
            print(f" - {font}: {count} ocurrencia(s)")
    else:
        print(" - Ninguna fuente detectada.")
    
    print("\nArchivos generados:")
    for r in all_results:
        if r['success']:
            print(f" - {r['name']} -> {r['output']}")
    
    print("="*50)

if __name__ == "__main__":
    main()
