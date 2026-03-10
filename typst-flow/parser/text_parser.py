import re


def parse_editorial_text(text: str):
    """
    Parsea bloques con formato:
    ##ETIQUETA
    contenido...

    - Tolera espacios antes/después del tag.
    - Funciona con \n o \r\n.
    - Etiquetas en mayúsc/minúsc.
    """
    if not text:
        return {}

    pattern = r'^##\s*([A-Za-z0-9_]+)\s*\r?\n(.*?)(?=^##\s*[A-Za-z0-9_]+\s*\r?\n|\Z)'
    matches = re.findall(pattern, text, flags=re.MULTILINE | re.DOTALL | re.IGNORECASE)

    result = {}
    for tag, content in matches:
        tag_key = tag.strip().upper()
        result[tag_key] = content.strip()
    return result
