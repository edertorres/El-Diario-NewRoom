"""
Script para Scribus -g: el SLA se abre directamente y se exporta a PDF.

Invocación:
  EXPORT_OUTPUT_PDF=/path/to/out.pdf scribus -g -py export_sla.py input.sla

Scribus abre input.sla automáticamente. Este script solo configura el PDF y exporta.
Los paths se pasan por variables de entorno:
  - EXPORT_OUTPUT_PDF: ruta del PDF de salida (obligatorio)
  - EXPORT_ICC_PROFILE: ruta del perfil ICC (opcional)
"""
import sys
import os
import json
import re
import time

def log(msg):
    """Log con timestamp para debugging de performance."""
    print(f"[{time.strftime('%H:%M:%S')}] {msg}")
    sys.stdout.flush()

try:
    import scribus
except ImportError:
    # No estamos dentro de Scribus
    pass

# Signal timeout removido por estabilidad en Scribus

# Mapeo de fuentes InDesign → Scribus
FONT_MAP = {
    "Utopia": "Utopia Regular",
    "Utopia\tRegular": "Utopia Regular",
    "Utopia\tBold": "Utopia Bold",
    "Utopia\tItalic": "Utopia Italic",
    "Utopia\tBold Italic": "Utopia Bold Italic",
    "Myriad Pro\tRegular": "Myriad Pro Regular",
    "Myriad Pro\tBold": "Myriad Pro Bold",
    "Myriad Pro\tSemibold": "Myriad Pro Semibold",
    "Playfair Display": "Playfair Display Regular",
    "Playfair Display\tRegular": "Playfair Display Regular",
    "Playfair Display\tMedium": "Playfair Display Medium",
    "Playfair Display\tBold": "Playfair Display Bold",
    "Playfair Display\tExtraBold": "Playfair Display ExtraBold",
    "Playfair Display\tBlack": "Playfair Display Black",
    "Playfair Display\tItalic": "Playfair Display Italic",
    "Heuristica": "Heuristica Regular",
    "Heuristica\tRegular": "Heuristica Regular",
    "Heuristica\tBold": "Heuristica Bold",
    "Heuristica\tItalic": "Heuristica Italic",
    "Heuristica\tBold Italic": "Heuristica Bold Italic",
    "Austin\tRoman": "Austin Roman",
    "Austin\tBold": "Austin Bold",
    "Austin\tMedium": "Austin Medium",
    "ZapfDingbats BT\tRegular": "ZapfDingbats BT Regular",
    "Vitesse\tRegular": "Vitesse Regular",
    "Vitesse\tBold": "Vitesse Bold",
    "Vitesse\tBlack": "Vitesse Black",
    "Garth Graphic\tRegular": "Garth Graphic Regular",
    "Garth Graphic\tBold": "Garth Graphic Bold",
}


def fix_fonts():
    """Reemplaza fuentes que Scribus no reconozca."""
    try:
        available_fonts = set(scribus.getFontNames())
        sys.stdout.write(f"--- Scribus tiene {len(available_fonts)} fuentes ---\n")
    except Exception:
        return

    families = ["Heuristica", "Utopia", "Playfair Display", "Myriad Pro", "Austin", "Vitesse"]
    log(f"Arreglando fuentes para familias: {families}")
    for fam in families:
        regular = f"{fam} Regular"
        if regular in available_fonts:
            try:
                scribus.replaceFont(fam, regular)
            except Exception:
                pass

    for old, new in FONT_MAP.items():
        if new in available_fonts:
            try:
                scribus.replaceFont(old, new)
                if "\t" in old:
                    scribus.replaceFont(old.replace("\t", " "), new)
            except Exception:
                pass


def _normalize_name(name):
    """Normaliza un nombre: sin espacios, sin extensión, en mayúsculas."""
    base = os.path.splitext(name)[0] if '.' in name else name
    return base.replace(' ', '').replace('_', '').upper()


def relink_images():
    """
    Busca imágenes en la carpeta Links junto al documento.

    Estrategia de matching (en orden de prioridad):
      1. Por PFILE: el nombre original del archivo en el IDML
      2. Por ANNAME: el nombre del objeto (= scriptLabel del frame en InDesign)
         La UI nombra las imágenes según el scriptLabel normalizado (ej: "FOTO1.jpg")
      3. Por basename sin extensión de PFILE
      4. Si solo hay 1 imagen y 1 frame, vincular directamente
    """
    try:
        doc_name = scribus.getDocName()
        doc_dir = os.path.dirname(os.path.abspath(doc_name))
        links_dir = os.path.join(doc_dir, "Links")

        sys.stdout.write(f"--- relink_images: doc={doc_name} ---\n")
        sys.stdout.write(f"--- relink_images: doc_dir={doc_dir} ---\n")
        sys.stdout.write(f"--- relink_images: links_dir={links_dir} ---\n")

        if not os.path.exists(links_dir):
            log("No hay carpeta Links/, saltando relink")
            return

        # Construir índice de archivos disponibles en Links/
        files_by_exact = {}   # "FOTO1.jpg" → full_path
        files_by_norm = {}    # "FOTO1"     → full_path  (normalizado, sin ext)
        all_image_paths = []  # lista ordenada para fallback
        for fname in sorted(os.listdir(links_dir)):
            fpath = os.path.join(links_dir, fname)
            if os.path.isfile(fpath) and os.path.getsize(fpath) > 0:
                files_by_exact[fname] = fpath
                files_by_norm[_normalize_name(fname)] = fpath
                all_image_paths.append(fpath)

        sys.stdout.write(f"--- Links/: {len(files_by_exact)} archivos disponibles ---\n")
        for fname, fpath in sorted(files_by_exact.items()):
            fsize = os.path.getsize(fpath)
            sys.stdout.write(f"    {fname} ({fsize} bytes)\n")
        sys.stdout.flush()

        if not files_by_exact:
            sys.stdout.write("--- No hay imágenes en Links/, saltando relink ---\n")
            sys.stdout.flush()
            return

        # Recopilar todos los image frames
        image_frames = []
        for i in range(scribus.pageCount()):
            scribus.gotoPage(i + 1)
            for item in scribus.getAllObjects():
                if scribus.getObjectType(item) == "ImageFrame":
                    image_frames.append(item)

        sys.stdout.write(f"--- {len(image_frames)} image frames en el documento ---\n")
        for item in image_frames:
            try:
                pfile = scribus.getImageFile(item)
            except Exception:
                pfile = ""
            sys.stdout.write(f"    Frame: {item} PFILE={pfile}\n")
        sys.stdout.flush()

        linked = 0
        missed = 0
        unmatched_frames = []

        for item in image_frames:
            try:
                orig_pfile = scribus.getImageFile(item)
                pfile_name = os.path.basename(orig_pfile) if orig_pfile else ""

                matched_path = None

                # 1) Match exacto por PFILE
                if pfile_name and pfile_name in files_by_exact:
                    matched_path = files_by_exact[pfile_name]

                # 2) Match por ANNAME (nombre del objeto = label/scriptLabel)
                if not matched_path:
                    norm_item = _normalize_name(item)
                    if norm_item and norm_item in files_by_norm:
                        matched_path = files_by_norm[norm_item]

                # 3) Match por basename de PFILE sin extensión
                if not matched_path and pfile_name:
                    norm_pfile = _normalize_name(pfile_name)
                    if norm_pfile and norm_pfile in files_by_norm:
                        matched_path = files_by_norm[norm_pfile]

                # 4) Match case-insensitive por PFILE
                if not matched_path and pfile_name:
                    pfile_lower = pfile_name.lower()
                    for fname, fpath in files_by_exact.items():
                        if fname.lower() == pfile_lower:
                            matched_path = fpath
                            break

                if matched_path:
                    scribus.loadImage(matched_path, item)
                    scribus.setScaleImageToFrame(True, True, item)
                    linked += 1
                    sys.stdout.write(
                        f"  ✓ {item} ← {os.path.basename(matched_path)}\n"
                    )
                else:
                    missed += 1
                    unmatched_frames.append(item)
                    sys.stdout.write(
                        f"  ✗ {item} (PFILE: {pfile_name}) — sin imagen\n"
                    )
            except Exception as e:
                sys.stdout.write(f"  ! Error relink {item}: {e}\n")

        # Fallback: si quedan frames sin imagen y hay imágenes sin usar, vincular
        # secuencialmente (útil cuando hay 1 imagen y 1 frame)
        if unmatched_frames and all_image_paths:
            used_paths = set()
            for item in image_frames:
                try:
                    cur = scribus.getImageFile(item)
                    if cur and os.path.isfile(cur):
                        used_paths.add(cur)
                except Exception:
                    pass

            unused_imgs = [p for p in all_image_paths if p not in used_paths]
            for frame, img_path in zip(unmatched_frames, unused_imgs):
                try:
                    scribus.loadImage(img_path, frame)
                    scribus.setScaleImageToFrame(True, True, frame)
                    linked += 1
                    missed -= 1
                    sys.stdout.write(
                        f"  ✓ {frame} ← {os.path.basename(img_path)} (fallback)\n"
                    )
                except Exception as e:
                    sys.stdout.write(f"  ! Error fallback relink {frame}: {e}\n")

        log(f"Relink: {linked} vinculadas, {missed} sin imagen")

    except Exception as e:
        log(f"Error general relink: {e}")


def apply_hyphenation():
    """
    Aplica hyphenation (partición de palabras) en español SOLO a frames TEXTO*.
    
    Solo los frames cuyo nombre (ANNAME) comience con "TEXTO" reciben hyphenation.
    Otros frames (LEYENDA, SUMARIO, TITULO, etc.) no la necesitan.
    Requiere que el diccionario hyphen-es esté instalado en el sistema.
    """
    try:
        # Diagnóstico de lenguajes disponibles
        try:
            langs = scribus.getHyphLanguages()
            log(f"Lenguajes de hyphenation disponibles: {langs}")
        except Exception:
            pass

        hyphenated = 0
        skipped = 0
        for i in range(scribus.pageCount()):
            scribus.gotoPage(i + 1)
            for item in scribus.getAllObjects():
                if scribus.getObjectType(item) != "TextFrame":
                    continue
                # Solo aplicar a frames TEXTO*
                item_name = item.upper() if item else ""
                if not item_name.startswith("TEXTO"):
                    skipped += 1
                    continue
                try:
                    text_len = scribus.getTextLength(item)
                    if text_len > 0:
                        scribus.selectText(0, text_len, item)
                        try:
                            # Intentar forzar idioma si es posible
                            scribus.setLanguage("Spanish", item)
                        except Exception:
                            try:
                                scribus.setLanguage("es_ES", item)
                            except Exception:
                                pass
                        
                        scribus.hyphenateText(item)
                        hyphenated += 1
                        sys.stdout.write(f"  ✓ Hyphenation: {item}\n")
                except Exception as e:
                    sys.stdout.write(f"  ! Error hyphenation {item}: {e}\n")
        log(
            f"Hyphenation aplicada a {hyphenated} frames TEXTO* "
            f"({skipped} frames omitidos)"
        )
    except Exception as e:
        log(f"Error en hyphenation: {e}")


def detect_overflows():
    """
    Detecta text frames con desborde de texto después de hyphenation.
    - Crea marcadores visuales (rectángulo rojo + label) en el PDF.
    - Retorna lista de dicts con info de cada desborde.
    
    scribus.textOverflows() devuelve 1 (booleano) en algunas versiones,
    así que intentamos obtener el conteo real con nolinks=True y,
    si sigue siendo 1, estimamos midiendo el texto visible vs total.
    """
    overflows = []
    try:
        # Definir color rojo para marcadores si no existe
        try:
            scribus.defineColorRGB("_OverflowRed", 220, 38, 38)
        except Exception:
            pass

        for i in range(scribus.pageCount()):
            scribus.gotoPage(i + 1)
            for item in scribus.getAllObjects():
                if scribus.getObjectType(item) != "TextFrame":
                    continue
                # Ignorar frames auxiliares creados por nosotros
                if item.startswith("_ovf_"):
                    continue

                try:
                    # Filtro: Solo mostrar desbordes si el frame tiene SCRIPT TAGS establecidos
                    # (Inyectados por idml_to_sla.py como Atributos de Scribus)
                    has_script_tag = False
                    try:
                        attrs = scribus.getAttributes(item)
                        for a in attrs:
                            if a.get('Name') == 'HasScriptTag' and a.get('Value') == '1':
                                has_script_tag = True
                                break
                    except Exception:
                        pass
                    
                    if not has_script_tag:
                        continue

                    # textOverflows devuelve la cantidad de chars desbordados o 1 (booleano)
                    real_count = scribus.textOverflows(item)
                    if not real_count or real_count <= 0:
                        continue

                    # Calcular palabras desbordadas
                    word_count = 0
                    try:
                        # En muchas versiones, textOverflows(item) devuelve 1 sustiyendo al booleano True.
                        # El truco para obtener el conteo real es comparar el largo total vs el visible.
                        try:
                            # getText() suele devolver solo el texto visible en el frame en versiones modernas
                            # mientras que getAllText() devuelve toda la historia vinculada.
                            visible_text = scribus.getText(item)
                            full_text = scribus.getAllText(item)
                            
                            if full_text and visible_text is not None:
                                actual_overflow_count = len(full_text) - len(visible_text)
                                if actual_overflow_count > 0:
                                    real_count = actual_overflow_count
                                    overflow_text = full_text[len(visible_text):]
                                    words = re.findall(r'\w+', overflow_text)
                                    word_count = len(words)
                                elif real_count == 1:
                                    # Si no detectamos diferencia pero Scribus dice que hay desborde, 
                                    # puede ser un solo caracter especial o que getText/getAllText devuelven lo mismo.
                                    # Fallback al comportamiento anterior por si acaso.
                                    overflow_text = full_text[-1:] if full_text else ""
                                    words = re.findall(r'\w+', overflow_text)
                                    word_count = len(words)
                        except Exception:
                            # Segundo fallback: usar el real_count que nos dio Scribus si falla el truco
                            full_text = scribus.getText(item)
                            if full_text and real_count > 0:
                                overflow_text = full_text[-real_count:]
                                words = re.findall(r'\w+', overflow_text)
                                word_count = len(words)
                    except Exception as e:
                        sys.stdout.write(f"  ! Error calculando palabras desborde {item}: {e}\n")

                    x, y = scribus.getPosition(item)
                    w, h = scribus.getSize(item)

                    # --- Marcador visual: rectángulo rojo grueso alrededor del frame ---
                    try:
                        marker = scribus.createRect(
                            x - 2, y - 2, w + 4, h + 4,
                            f"_ovf_rect_{item}"
                        )
                        scribus.setLineColor("_OverflowRed", marker)
                        scribus.setLineWidth(2.5, marker)
                        scribus.setFillColor("None", marker)
                        scribus.setFillTransparency(1.0, marker)
                    except Exception as e:
                        sys.stdout.write(f"  ! Error creando rect overflow {item}: {e}\n")

                    # --- Marcador visual: banner "⚠ DESBORDE" grande y visible ---
                    label_h = 16
                    label_text = f"  \u26a0 DESBORDE: {item} (+{real_count} ch / {word_count} pal)  "
                    try:
                        # Fondo rojo semi-transparente
                        label_bg = scribus.createRect(
                            x, y + h + 2, w, label_h,
                            f"_ovf_bg_{item}"
                        )
                        scribus.setFillColor("_OverflowRed", label_bg)
                        scribus.setFillTransparency(0.15, label_bg)
                        scribus.setLineColor("_OverflowRed", label_bg)
                        scribus.setLineWidth(0.5, label_bg)
                    except Exception:
                        pass

                    try:
                        label = scribus.createText(
                            x, y + h + 3, w, label_h,
                            f"_ovf_label_{item}"
                        )
                        scribus.setText(label_text, label)
                        scribus.setFontSize(9, label)
                        scribus.setFont("DejaVu Sans Book", label)
                        scribus.setTextColor("_OverflowRed", label)
                    except Exception as e:
                        sys.stdout.write(f"  ! Error creando label overflow {item}: {e}\n")

                    overflows.append({
                        "name": item,
                        "page": i + 1,
                        "overflow_chars": real_count,
                        "overflow_words": word_count,
                    })
                    sys.stdout.write(
                        f"  \u26a0 DESBORDE: {item} (pag {i+1}): +{real_count} chars / {word_count} palabras\n"
                    )
                except Exception as e:
                    sys.stdout.write(f"  ! Error chequeando overflow {item}: {e}\n")

        log(
            f"Overflow: {len(overflows)} frames con desborde"
        )
    except Exception as e:
        log(f"Error general detect_overflows: {e}")

    return overflows


def save_overflows_json(overflows, sla_path):
    """Guarda la lista de overflows como JSON junto al SLA."""
    try:
        json_path = os.path.splitext(sla_path)[0] + "_overflows.json"
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(overflows, f, ensure_ascii=False)
        log(f"overflows.json guardado: {json_path}")
    except Exception as e:
        log(f"Error guardando overflows.json: {e}")


def main():
    output_pdf = os.environ.get("EXPORT_OUTPUT_PDF")
    if not output_pdf:
        sys.stderr.write("EXPORT_OUTPUT_PDF no está definido\n")
        os._exit(1)

    icc_profile = os.environ.get("EXPORT_ICC_PROFILE", "")

    # El SLA se pasa como argumento en sys.argv o por env
    # Priorizar variable de entorno si existe
    sla_path = os.environ.get("EXPORT_SLA_PATH", "")
    
    if not sla_path:
        for arg in sys.argv[1:]:
            if isinstance(arg, str) and arg.lower().endswith('.sla') and os.path.exists(arg):
                sla_path = os.path.abspath(arg)
                break

    log(f"export_sla.py starting")
    log(f"SLA: {sla_path}")
    log(f"Output PDF: {output_pdf}")

    # Intentar abrir el documento si no hay uno activo
    try:
        if not scribus.haveDoc():
            if sla_path and os.path.exists(sla_path):
                log(f"Opening SLA: {sla_path}")
                scribus.openDoc(sla_path)
    except Exception as e:
        log(f"Warning checking/opening doc: {e}")

    if not scribus.haveDoc():
        sys.stderr.write("--- ERROR: No open document found ---\n")
        sys.stderr.flush()
        os._exit(1)

    log(f"Active Doc: {scribus.pageCount()} pages")

    # Arreglar fuentes y re-vincular imágenes
    fix_fonts()
    relink_images()

    # Aplicar hyphenation en español a todos los text frames
    apply_hyphenation()

    # Detectar desbordes de texto y crear marcadores visuales (si está habilitado)
    show_overflows = os.environ.get("EXPORT_SHOW_OVERFLOWS", "1") == "1"
    
    if show_overflows:
        overflows = detect_overflows()
    else:
        # Si está desactivado, solo obtenemos la lista sin marcadores visuales
        # (o simplemente una lista vacía si el usuario no quiere ver nada)
        sys.stdout.write("--- Overflow detection disabled by user ---\n")
        overflows = []
        
    if sla_path:
        save_overflows_json(overflows, sla_path)

    # Configurar y exportar PDF
    sys.stdout.write("--- Exportando PDF... ---\n")
    pdf = scribus.PDFfile()
    pdf.file = output_pdf

    def set_attr(obj, attr, value):
        try:
            setattr(obj, attr, value)
        except Exception:
            pass

    # PDF/X-3 con perfil ICC si disponible
    if icc_profile and os.path.exists(icc_profile):
        set_attr(pdf, 'outdst', 1)
        set_attr(pdf, 'profiles', True)
        set_attr(pdf, 'profilei', icc_profile)
        set_attr(pdf, 'profilep', icc_profile)
        set_attr(pdf, 'intent', 1)

    # --- CONFIGURACIÓN DE FUENTES (CRÍTICO PARA WINDOWS) ---
    # fontEmbedding: 0 = Embed, 1 = Outline, 2 = No embedding
    set_attr(pdf, 'fontEmbedding', 0) 
    # --------------------------------------------------------
    set_attr(pdf, 'useColor', True)
    set_attr(pdf, 'quality', 2)
    set_attr(pdf, 'resolution', 150)
    set_attr(pdf, 'version', 14)
    set_attr(pdf, 'compress', True)
    set_attr(pdf, 'compressMethod', 1)
    set_attr(pdf, 'thumbnails', False)

    try:
        pdf.save()
        sys.stdout.write(f"--- PDF guardado: {output_pdf} ---\n")
    except Exception as e:
        sys.stderr.write(f"--- Error guardando PDF: {e} ---\n")
        os._exit(1)
    finally:
        try:
            scribus.closeDoc()
        except Exception:
            pass

    log("export_sla.py terminó correctamente")
    os._exit(0)


if __name__ == "__main__":
    main()
