import zipfile
import xml.etree.ElementTree as ET

with zipfile.ZipFile('1_a.idml', 'r') as z:
    # Story con SUMARIO (bullets)
    if 'Stories/Story_u1fc.xml' in z.namelist():
        print('=== STORY u1fc (SUMARIO CON BULLETS) ===')
        with z.open('Stories/Story_u1fc.xml') as f:
            root = ET.parse(f).getroot()
            for i, psr in enumerate(root.findall('.//ParagraphStyleRange')[:2]):  # Solo primeros 2 párrafos
                print(f'\nParagraph {i}: AppliedParagraphStyle={psr.attrib.get("AppliedParagraphStyle")}')
                for j, csr in enumerate(psr.findall('.//CharacterStyleRange')):
                    content = ''.join([c.text for c in csr.findall('Content') if c.text])
                    print(f'  CharRange {j}:')
                    print(f'    AppliedCharacterStyle: {csr.attrib.get("AppliedCharacterStyle")}')
                    print(f'    AppliedFont: {csr.attrib.get("AppliedFont")}')
                    print(f'    PointSize: {csr.attrib.get("PointSize")}')
                    print(f'    Content: {repr(content[:50])}')
    
    # Story con INTERTITULO
    if 'Stories/Story_u136.xml' in z.namelist():
        print('\n\n=== STORY u136 (INTERTITULO) ===')
        with z.open('Stories/Story_u136.xml') as f:
            root = ET.parse(f).getroot()
            for i, psr in enumerate(root.findall('.//ParagraphStyleRange')[:3]):
                print(f'\nParagraph {i}: AppliedParagraphStyle={psr.attrib.get("AppliedParagraphStyle")}')
                for j, csr in enumerate(psr.findall('.//CharacterStyleRange')):
                    content = ''.join([c.text for c in csr.findall('Content') if c.text])
                    print(f'  CharRange {j}: Content={repr(content[:80])}')
    
    # Story u1ce (configuración de bullet)
    if 'Stories/Story_u1ce.xml' in z.namelist():
        print('\n\n=== STORY u1ce (CONFIGURACION BULLET) ===')
        with z.open('Stories/Story_u1ce.xml') as f:
            root = ET.parse(f).getroot()
            for i, psr in enumerate(root.findall('.//ParagraphStyleRange')[:2]):
                print(f'\nParagraph {i}: AppliedParagraphStyle={psr.attrib.get("AppliedParagraphStyle")}')
                for j, csr in enumerate(psr.findall('.//CharacterStyleRange')):
                    content = ''.join([c.text for c in csr.findall('Content') if c.text])
                    print(f'  CharRange {j}:')
                    print(f'    AppliedCharacterStyle: {csr.attrib.get("AppliedCharacterStyle")}')
                    print(f'    AppliedFont: {csr.attrib.get("AppliedFont")}')
                    print(f'    Content: {repr(content[:50])}')
