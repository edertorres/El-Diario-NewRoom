import json
import re
from pathlib import Path


def escape_typst(text):
    """
    Escapa caracteres especiales de Typst para evitar errores de compilación.
    """
    if not text:
        return ""

    # 1. Escapar caracteres que rompen el markup de Typst
    # No escapamos '*' aquí porque lo manejamos abajo para negritas
    for char in ['#', '@', '<', '>', '`', '$', '_']:
        text = text.replace(char, '\\' + char)

    # 2. Manejar negritas: **texto** -> *texto*
    text = re.sub(r'\*\*(.*?)\*\*', r'*\1*', text)

    return text


def map_font(font_name: str) -> str:
    """
    Mapea fuentes de InDesign a fuentes disponibles en Typst.
    Si la fuente no existe, usamos una alternativa segura.
    """
    if not font_name:
        return "Liberation Serif"

    name = font_name.lower()

    # Fuentes conocidas en ./preview_services/Fonts
    if "playfair" in name:
        return "Playfair Display"
    if "utopia" in name:
        return "Utopia"
    if "myriad" in name:
        return "Myriad Pro"
    if "austin" in name:
        return "Austin"
    if "dingbats" in name:
        return "Zapf Dingbats"
    if "klavika" in name:
        return "Klavika"

    # Fallbacks genéricos
    if "sans" in name or "adobe clean" in name:
        return "Liberation Sans"
    
    return "Liberation Serif"

def generate_typst_file(layout_data, editorial_content, output_path):
    """
    Crea un archivo .typ listo para compilar con Typst.
    """
    page_w = layout_data['page']['width']
    page_h = layout_data['page']['height']
    
    lines = [
        '#import "../templates/layout.typ": editorial-slot, setup-page',
        f'#setup-page({page_w}pt, {page_h}pt)',
        '#set par(justify: true)',
        ''
    ]
    
    for slot in layout_data['slots']:
        tag = slot['tag']
        style = slot['style']
        content = editorial_content.get(tag, "").strip()
        
        x, y, w, h = slot['x'], slot['y'], slot['w'], slot['h']
        is_image = slot['type'] == 'image'
        
        if is_image:
            img_path = f"../processed_images/{tag}.jpg"
            if Path(img_path).exists():
                content_expr = f'#image("{img_path}", width: 100%, height: 100%, fit: "cover")'
            else:
                content_expr = f'#rect(width: 100%, height: 100%, fill: gray.lighten(80%))[#align(center + horizon)[#set text(size: 8pt, fill: gray); FALTA FOTO: {tag}]]'
        else:
            if not content:
                # Placeholder para etiquetas vacías
                content_expr = f'[#set text(fill: gray.lighten(50%), size: 8pt); ET_VACIA: {tag}]'
            else:
                # Aplicamos escapado y estilos de InDesign
                safe_content = escape_typst(content)
                
                # Configurar fuente y tamaño
                font_name = map_font(style.get('font', 'serif'))
                font_size = style.get('size', 10.0)
                leading = style.get('leading', 1.2)
                
                # Typst maneja leading como 'em' (factor) o 'pt' (absoluto)
                leading_str = f"{leading}em" if leading < 5 else f"{leading}pt"
                
                content_expr = (
                    f'[#set text(font: "{font_name}", size: {font_size}pt); '
                    f'#set par(leading: {leading_str}); '
                    f'{safe_content}]'
                )
        
        # Generar la línea del slot
        line = f'#editorial-slot(tag: "{tag}", x: {x}pt, y: {y}pt, w: {w}pt, h: {h}pt)[{content_expr}]'
        lines.append(line)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
