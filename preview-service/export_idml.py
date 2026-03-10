import sys
import os
import signal

try:
    import scribus
except ImportError:
    sys.exit(1)

# Timeout de seguridad: si el script no termina en 100s, forzar salida
# Esto evita que Scribus quede colgado indefinidamente
def _hard_timeout(signum, frame):
    sys.stderr.write("--- HARD TIMEOUT: Scribus script took too long, forcing exit ---\n")
    sys.stderr.flush()
    os._exit(1)

try:
    signal.signal(signal.SIGALRM, _hard_timeout)
    signal.alarm(100)
except Exception:
    pass  # SIGALRM no disponible en Windows

# Mapeo de fuentes: InDesign Name -> Scribus Name
# InDesign suele usar Tabulación (\t) para separar Familia de Estilo
FONT_MAP = {
    # Utopia - Variaciones extremas
    "Utopia": "Utopia Regular",
    "Utopia\tRegular": "Utopia Regular",
    "Utopia\tRoman": "Utopia Regular",
    "Utopia Roman": "Utopia Regular",
    "Utopia\tStandard": "Utopia Regular",
    "Utopia Standard": "Utopia Regular",
    "Utopia-Regular": "Utopia Regular",
    "Utopia-Roman": "Utopia Regular",
    "Utopia\tBold": "Utopia Bold",
    "Utopia Bold": "Utopia Bold",
    "Utopia-Bold": "Utopia Bold",
    "Utopia\tItalic": "Utopia Italic",
    "Utopia Italic": "Utopia Italic",
    "Utopia\tBold Italic": "Utopia Bold Italic",
    
    # Myriad Pro
    "Myriad Pro\tRegular": "Myriad Pro Regular",
    "Myriad Pro Regular": "Myriad Pro Regular",
    "Myriad Pro\tRoman": "Myriad Pro Regular",
    "Myriad Pro Roman": "Myriad Pro Regular",
    "Myriad Pro\tBold": "Myriad Pro Bold",
    "Myriad Pro Bold": "Myriad Pro Bold",
    "Myriad Pro\tSemibold": "Myriad Pro Semibold",
    "Myriad Pro Semibold": "Myriad Pro Semibold",
    
    # Playfair Display
    "Playfair Display": "Playfair Display Regular",
    "Playfair Display\tRegular": "Playfair Display Regular",
    "Playfair Display Regular": "Playfair Display Regular",
    "Playfair Display\tMedium": "Playfair Display Medium",
    "Playfair Display Medium": "Playfair Display Medium",
    "Playfair Display\tBold": "Playfair Display Bold",
    "Playfair Display Bold": "Playfair Display Bold",
    "Playfair Display\tExtraBold": "Playfair Display ExtraBold",
    "Playfair Display ExtraBold": "Playfair Display ExtraBold",
    "Playfair Display\tBlack": "Playfair Display Black",
    "Playfair Display Black": "Playfair Display Black",
    "Playfair Display\tItalic": "Playfair Display Italic",
    "Playfair Display\tBold Italic": "Playfair Display Bold Italic",

    # Heuristica
    "Heuristica": "Heuristica Regular",
    "Heuristica\tRegular": "Heuristica Regular",
    "Heuristica Regular": "Heuristica Regular",
    "Heuristica-Regular": "Heuristica Regular",
    "Heuristica\tBold": "Heuristica Bold",
    "Heuristica Bold": "Heuristica Bold",
    "Heuristica-Bold": "Heuristica Bold",
    "Heuristica\tItalic": "Heuristica Italic",
    "Heuristica Italic": "Heuristica Italic",
    "Heuristica-Italic": "Heuristica Italic",
    "Heuristica\tBold Italic": "Heuristica Bold Italic",
    "Heuristica Bold Italic": "Heuristica Bold Italic",
    "Heuristica-BoldItalic": "Heuristica Bold Italic",

    # Austin
    "Austin\tRoman": "Austin Roman",
    "Austin Roman": "Austin Roman",
    "Austin\tBold": "Austin Bold",
    "Austin Bold": "Austin Bold",
    "Austin\tMedium": "Austin Medium",
    "Austin Medium": "Austin Medium",
    "Austin\tLight": "Austin Light",
    "Austin Light": "Austin Light",
    
    # Zapf Dingbats (InDesign lo suele llamar ZapfDingbats BT sin espacio)
    "ZapfDingbats BT\tRegular": "ZapfDingbats BT Regular",
    "ZapfDingbats BT Regular": "ZapfDingbats BT Regular",
    "Zapf Dingbats\tRegular": "ZapfDingbats BT Regular",
    "Zapf Dingbats Regular": "ZapfDingbats BT Regular",
    "ZapfDingbats\tRegular": "ZapfDingbats BT Regular",
    "ZapfDingbats Regular": "ZapfDingbats BT Regular",
    "Zapf Dingbats\tITC": "ZapfDingbats BT Regular",
    "ZapfDingbats-Regular": "ZapfDingbats BT Regular",

    # Vitesse
    "Vitesse": "Vitesse Regular",
    "Vitesse\tRegular": "Vitesse Regular",
    "Vitesse\tBold": "Vitesse Bold",
    "Vitesse\tBlack": "Vitesse Black",
    "Vitesse\tLight": "Vitesse Light",
    "Vitesse\tBook": "Vitesse Book",

    # Garth Graphic
    "Garth Graphic\tRegular": "Garth Graphic Regular",
    "Garth Graphic\tBold": "Garth Graphic Bold",
    "Garth Graphic\tItalic": "Garth Graphic Italic",
    "Garth Graphic\tSemibold": "Garth Graphic Bold", # Fallback
    "Garth Graphic\tSemibold Small Caps & Oldstyle Figures": "Garth Graphic Bold", # Fallback
}

def relink_images():
    """Busca marcos de imagen y los vincula con archivos en la carpeta Links."""
    try:
        # La carpeta Links está en el mismo nivel que el IDML
        doc_path = os.path.dirname(os.path.abspath(sys.argv[1]))
        links_dir = os.path.join(doc_path, "Links")
        
        if not os.path.exists(links_dir):
            sys.stdout.write(f"--- Relink: Links directory not found at {links_dir} ---\n")
            return

        sys.stdout.write(f"--- Relink: Checking images in {links_dir} ---\n")
        
        for i in range(scribus.pageCount()):
            scribus.gotoPage(i+1)
            for item in scribus.getAllObjects():
                if scribus.getObjectType(item) == "ImageFrame":
                    try:
                        orig_path = scribus.getImageFile(item)
                        file_name = os.path.basename(orig_path)
                        new_path = os.path.join(links_dir, file_name)
                        
                        if os.path.exists(new_path):
                            scribus.loadImage(new_path, item)
                            scribus.setScaleImageToFrame(True, True, item)
                            sys.stdout.write(f"  [Image Relinked]: '{file_name}' -> '{item}'\n")
                    except:
                        pass
    except Exception as e:
        sys.stdout.write(f"  Error in relink_images: {str(e)}\n")

def optimize_document():
    """Aplica mejoras de fuentes, hifenación y vinculación de imágenes al documento."""
    # 0. Vincular imágenes
    relink_images()

    # 1. Obtener fuentes disponibles
    available_fonts = set()
    try:
        available_fonts = set(scribus.getFontNames())
        sys.stdout.write(f"--- Diagnostic: Scribus has {len(available_fonts)} fonts available ---\n")
    except Exception as e:
        sys.stdout.write(f"  Error accessing font list: {str(e)}\n")

    # 2. Normalización Automática de Familias
    families_to_check = ["Heuristica", "Utopia", "Playfair Display", "Myriad Pro", "Austin", "Vitesse"]
    for fam in families_to_check:
        regular_name = f"{fam} Regular"
        if regular_name in available_fonts:
            try:
                if scribus.replaceFont(fam, regular_name):
                    sys.stdout.write(f"  [Font Normalized]: '{fam}' -> '{regular_name}'\n")
            except:
                pass

    # 3. Mapeo explícito desde FONT_MAP
    for old, new in FONT_MAP.items():
        try:
            if scribus.replaceFont(old, new):
                sys.stdout.write(f"  [Font Mapped]: '{old}' -> '{new}'\n")
            
            if "\t" in old:
                alt_old = old.replace("\t", " ")
                if scribus.replaceFont(alt_old, new):
                    sys.stdout.write(f"  [Font Mapped]: '{alt_old}' -> '{new}'\n")
        except:
            pass

    # 4. Procesamiento de Objetos para Hifenación Nativa
    try:
        sys.stdout.write("--- Diagnostic: Applying Native Hyphenation Trigger ---\n")
        for i in range(scribus.pageCount()):
            scribus.gotoPage(i+1)
            all_objects = scribus.getAllObjects()
            for item in all_objects:
                if scribus.getObjectType(item) == "TextFrame":
                    try:
                        text_len = len(scribus.getAllText(item))
                        if text_len > 100:
                            sys.stdout.write(f"  [Target Found]: '{item}' (Chars: {text_len})\n")
                            
                            # A. Forzar alineación justificada (3)
                            try:
                                scribus.setAlignment(3, item)
                                sys.stdout.write("    - Alignment forced to Justified (3)\n")
                            except: pass
                            
                            # B. DISPARADOR NATIVO
                            try:
                                scribus.deselectAll()
                                scribus.selectObject(item)
                                scribus.hyphenateText(item)
                                sys.stdout.write("    - Native hyphenateText() triggered\n")
                            except Exception as hyph_err:
                                sys.stdout.write(f"    - Error in hyphenateText(): {str(hyph_err)}\n")
                        
                        # C. Salvavidas de fuente
                        curr_font = scribus.getFont(item)
                        if any(f in curr_font for f in ["DejaVu", "Arial", "Sans"]):
                            target = "Heuristica Regular" if "Heuristica Regular" in available_fonts else "Utopia Regular"
                            scribus.setFont(target, item)
                    except Exception as e:
                        sys.stdout.write(f"  [Error in Object {item}]: {str(e)}\n")
    except Exception as e:
        sys.stdout.write(f"  Error in object hyphenation loop: {str(e)}\n")

    sys.stdout.flush()

def main():
    if len(sys.argv) < 4:
        sys.exit(1)

    input_file = sys.argv[1]
    output_pdf = sys.argv[2]
    icc_profile = sys.argv[3]

    print(f"--- Starting export_idml.py for {input_file} ---")
    
    try:
        scribus.setRedraw(False)
        print("--- setRedraw(False) applied ---")
    except:
        pass
        
    print("--- Attempting openDoc (without -g to allow Qt event loop)... ---")
    sys.stdout.flush()
    try:
        success = scribus.openDoc(input_file)
        print(f"--- openDoc returned {success} ---")
    except Exception as e:
        print(f"--- openDoc CRASHED with exception: {str(e)} ---")
        os._exit(1)
        
    if not success:
        print("--- openDoc returned False ---")
        os._exit(1)
        
    print("--- Document opened successfully, optimizing... ---")
    sys.stdout.flush()

    optimize_document()

    print("--- Optimization finished, configuring PDF... ---")
    pdf = scribus.PDFfile()
    pdf.file = output_pdf

    def set_attr(obj, attr, value):
        try:
            setattr(obj, attr, value)
        except:
            pass

    set_attr(pdf, 'outdst', 1)
    set_attr(pdf, 'profiles', True)
    set_attr(pdf, 'profilei', icc_profile)
    set_attr(pdf, 'profilep', icc_profile)
    set_attr(pdf, 'intent', 1)
    set_attr(pdf, 'useColor', True)
    set_attr(pdf, 'quality', 2)
    set_attr(pdf, 'resolution', 96)
    set_attr(pdf, 'version', 14)
    set_attr(pdf, 'compress', True)
    set_attr(pdf, 'compressMethod', 1)
    set_attr(pdf, 'thumbnails', False)
    set_attr(pdf, 'checkErrors', False)
    set_attr(pdf, 'fontSubstitution', True)
    set_attr(pdf, 'imageMissing', True)

    try:
        pdf.save()
        print(f"--- PDF saved successfully to {output_pdf} ---")
    except Exception as e:
        print(f"Error al guardar PDF: {str(e)}")
        os._exit(1)
    finally:
        try:
            scribus.closeDoc()
        except:
            pass

    # IMPORTANTE: Forzar salida del proceso.
    # Sin -g, Scribus mantiene el event loop de QApplication vivo después 
    # de que el script termina. os._exit() fuerza la terminación inmediata.
    print("--- Script finished, forcing process exit ---")
    sys.stdout.flush()
    os._exit(0)

if __name__ == "__main__":
    main()
