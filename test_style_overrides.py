import zipfile
import xml.etree.ElementTree as ET
import sys

def test_bullet_preservation(idml_path):
    """Verifica que los bullets se preserven correctamente"""
    print("=== TEST: Preservación de Bullets ===\n")
    
    with zipfile.ZipFile(idml_path, 'r') as z:
        # Verificar Story u1fc (SUMARIO con bullets)
        if 'Stories/Story_u1fc.xml' in z.namelist():
            with z.open('Stories/Story_u1fc.xml') as f:
                root = ET.parse(f).getroot()
                
                para_count = 0
                for psr in root.findall('.//ParagraphStyleRange'):
                    para_count += 1
                    char_ranges = psr.findall('.//CharacterStyleRange')
                    
                    print(f"Párrafo {para_count}:")
                    print(f"  - AppliedParagraphStyle: {psr.attrib.get('AppliedParagraphStyle')}")
                    print(f"  - Número de CharacterStyleRanges: {len(char_ranges)}")
                    
                    if len(char_ranges) >= 3:
                        # Verificar estructura de bullet
                        first_range = char_ranges[0]
                        second_range = char_ranges[1]
                        third_range = char_ranges[2]
                        
                        # Verificar fuente del primer rango
                        font_elem = first_range.find('.//AppliedFont')
                        font = font_elem.text if font_elem is not None else first_range.attrib.get('AppliedFont', 'N/A')
                        
                        first_content = ''.join([c.text for c in first_range.findall('Content') if c.text])
                        second_content = ''.join([c.text for c in second_range.findall('Content') if c.text])
                        third_content = ''.join([c.text for c in third_range.findall('Content') if c.text])
                        
                        print(f"  - Range 1 (Bullet): Font='{font}', Content='{first_content}'")
                        print(f"  - Range 2 (Spacing): Content='{second_content}' (len={len(second_content)})")
                        print(f"  - Range 3 (Text): Content='{third_content[:50]}...'")
                        
                        # Verificaciones
                        has_zapf = 'zapfdingbats' in font.lower()
                        is_short = len(first_content) < 5
                        has_spacing = len(second_content) < 10 and second_content.strip() == ''
                        
                        print(f"  ✓ Bullet detectado: {has_zapf or is_short}")
                        print(f"  ✓ Espaciado correcto: {has_spacing}")
                    print()

def test_intertitle_structure(idml_path):
    """Verifica que los intertítulos tengan la estructura correcta"""
    print("\n=== TEST: Estructura de Intertítulos ===\n")
    
    with zipfile.ZipFile(idml_path, 'r') as z:
        # Verificar Story u136 (con INTERTITULO)
        if 'Stories/Story_u136.xml' in z.namelist():
            with z.open('Stories/Story_u136.xml') as f:
                root = ET.parse(f).getroot()
                
                paragraphs = root.findall('.//ParagraphStyleRange')
                
                for i, psr in enumerate(paragraphs):
                    style = psr.attrib.get('AppliedParagraphStyle', '')
                    
                    if 'INTERTITULO' in style:
                        print(f"Intertítulo encontrado en párrafo {i}:")
                        print(f"  - AppliedParagraphStyle: {style}")
                        
                        # Verificar párrafo anterior
                        if i > 0:
                            prev_para = paragraphs[i-1]
                            prev_char_ranges = prev_para.findall('.//CharacterStyleRange')
                            if prev_char_ranges:
                                last_range = prev_char_ranges[-1]
                                br_count = len(last_range.findall('Br'))
                                print(f"  - Párrafo anterior termina con {br_count} <Br/> tags")
                                print(f"  ✓ Línea en blanco antes: {br_count >= 2}")
                        
                        # Verificar el intertítulo mismo
                        char_ranges = psr.findall('.//CharacterStyleRange')
                        if char_ranges:
                            first_range = char_ranges[0]
                            br_count = len(first_range.findall('Br'))
                            content = ''.join([c.text for c in first_range.findall('Content') if c.text])
                            print(f"  - Contenido: '{content}'")
                            print(f"  - Termina con {br_count} <Br/> tags")
                            print(f"  ✓ <Br/> después: {br_count >= 1}")
                        print()

if __name__ == "__main__":
    idml_file = sys.argv[1] if len(sys.argv) > 1 else '1_a.idml'
    
    print(f"Analizando archivo: {idml_file}\n")
    print("="*60)
    
    test_bullet_preservation(idml_file)
    test_intertitle_structure(idml_file)
    
    print("="*60)
    print("\n✅ Análisis completado")
