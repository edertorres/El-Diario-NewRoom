import zipfile
import xml.etree.ElementTree as ET
import json
from pathlib import Path


def clean_font_name(raw: str) -> str:
    if not raw:
        return "serif"
    return raw.split("\t")[0].replace("$", "").strip()


def parse_idml_full_dna(idml_path):
    data = {"page": {}, "slots": []}

    with zipfile.ZipFile(idml_path, "r") as z:
        # 1) Estilos (fuente, size, leading) con nombres limpios
        styles_map = {}
        with z.open("Resources/Styles.xml") as f:
            root = ET.parse(f).getroot()
            for style in root.findall(".//ParagraphStyle"):
                name = style.attrib.get("Self", "").split("/")[-1]
                font = style.find(".//AppliedFont")
                size = style.find(".//PointSize")
                leading = style.find(".//Leading")
                auto_leading = style.attrib.get("AutoLeading")

                font_name = clean_font_name(font.text if font is not None else "serif")

                # Tamaño: primero nodo, luego atributo PointSize
                size_val = 10.0
                if size is not None:
                    try:
                        size_val = float(size.text)
                    except Exception:
                        size_val = 10.0
                else:
                    try:
                        size_val = float(style.attrib.get("PointSize", 10))
                    except Exception:
                        size_val = 10.0

                # Leading: nodo, o atributo Leading, o auto-leading (%)
                leading_val = None
                if leading is not None:
                    try:
                        leading_val = float(leading.text)
                    except Exception:
                        leading_val = None
                if leading_val is None:
                    try:
                        leading_attr = style.attrib.get("Leading")
                        if leading_attr:
                            leading_val = float(leading_attr)
                    except Exception:
                        leading_val = None
                if leading_val is None:
                    try:
                        auto = float(auto_leading) if auto_leading else 120.0
                    except Exception:
                        auto = 120.0
                    leading_val = round(size_val * (auto / 100.0), 3)

                styles_map[name] = {
                    "font": font_name,
                    "size": size_val,
                    "leading": leading_val,
                }

        # 2) Geometría: referenciar al origen real de la página
        spread_file = [n for n in z.namelist() if n.startswith("Spreads/Spread_")][0]
        with z.open(spread_file) as f:
            root = ET.parse(f).getroot()
            # 2) Geometría: calcular el bounding box total del Spread (para facing pages)
            pages = root.findall(".//Page")
            min_x, min_y = float('inf'), float('inf')
            max_x, max_y = float('-inf'), float('-inf')
            
            # Origen absoluto del spread para transformaciones
            # Usualmente tomamos el origen de coordenadas del IDML (que suele ser el centro o la esquina del pliego)
            # Pero necesitamos mapear todo a un lienzo Typst que empieza en (0,0)
            
            # Recolectar bounds de todas las páginas
            for p in pages:
                p_bounds = [float(x) for x in p.attrib.get("GeometricBounds", "0 0 0 0").split()]
                # IDML GeometricBounds: [y1, x1, y2, x2]
                py1, px1, py2, px2 = p_bounds
                
                # ItemTransform de la página (raro pero posible)
                p_mat = [float(x) for x in p.attrib.get("ItemTransform", "1 0 0 1 0 0").split()]
                # El origen visual de la página
                page_origin_x = p_mat[4] + px1
                page_origin_y = p_mat[5] + py1
                
                # Actualizar min/max global
                min_x = min(min_x, px1)
                min_y = min(min_y, py1)
                max_x = max(max_x, px2)
                max_y = max(max_y, py2)

            # Si no hay páginas, default
            if min_x == float('inf'):
                 min_x, min_y, max_x, max_y = 0, 0, 0, 0

            # Dimensiones del lienzo total (Spread completo)
            data["page"] = {
                "width": max_x - min_x, 
                "height": max_y - min_y
            }

            # El origen del lienzo Typst (0,0) corresponderá a (min_x, min_y) del IDML
            origin_x = min_x
            origin_y = min_y

            tag_style_map = {
                "TEXTO1": "TEXTO PRINCIPAL",
                "TEXTO2": "TEXTO PRINCIPAL",
                "TITULO1": "TITULO 1 PAG GENERAL",
                "TITULO2": "TITULO 2 PAG GENERAL",
                "ANTETITULO1": "ANTETITULO",
                "SUMARIO": "SUMARIO GENERAL",
                "LEYENDA1": "TEXTO RECUADRO",
                "CREDITO": "TEXTO PRINCIPAL",
            }

            for item_type in ["TextFrame", "Rectangle"]:
                for item in root.findall(f".//{item_type}"):
                    label = item.find('.//Label/KeyValuePair[@Key="Label"]')
                    if label is None:
                        continue

                    tag = label.attrib.get("Value")
                    parent_story = item.attrib.get("ParentStory")

                    mat = [float(x) for x in item.attrib.get("ItemTransform", "1 0 0 1 0 0").split()]
                    anchors = [
                        [float(x) for x in pt.attrib.get("Anchor", "0 0").split()]
                        for pt in item.findall(".//PathPointType")
                    ]
                    if not anchors:
                        continue

                    # Transformar a coordenadas de página: aplicar matriz del objeto y restar el offset absoluto de la página
                    t_pts = []
                    for ax, ay in anchors:
                        tx = mat[0] * ax + mat[2] * ay + mat[4] - origin_x
                        ty = mat[1] * ax + mat[3] * ay + mat[5] - origin_y
                        t_pts.append((tx, ty))

                    x_vals = [p[0] for p in t_pts]
                    y_vals = [p[1] for p in t_pts]
                    min_x, max_x = min(x_vals), max(x_vals)
                    min_y, max_y = min(y_vals), max(y_vals)

                    style_info = {"font": "serif", "size": 10, "leading": 1.2}
                    if parent_story:
                        try:
                            with z.open(f"Stories/Story_{parent_story}.xml") as sf:
                                s_root = ET.parse(sf).getroot()
                                # Tomar el primer ParagraphStyleRange y su primer CharacterStyleRange
                                p_range = s_root.find(".//ParagraphStyleRange")
                                if p_range is not None:
                                    # Preferir overrides en CharacterStyleRange
                                    c_range = p_range.find(".//CharacterStyleRange")
                                    p_font = c_range.attrib.get("AppliedFont") if c_range is not None else None
                                    p_size = c_range.attrib.get("PointSize") if c_range is not None else None
                                    if p_font or p_size:
                                        font_name = clean_font_name(p_font) if p_font else style_info["font"]
                                        size_val = float(p_size) if p_size else style_info["size"]
                                        style_info = styles_map.get(
                                            p_range.attrib.get("AppliedParagraphStyle", "").split("/")[-1],
                                            {"font": font_name, "size": size_val, "leading": style_info["leading"]},
                                        )
                                        style_info["font"] = clean_font_name(font_name)
                                        style_info["size"] = size_val
                                    else:
                                        s_name = p_range.attrib.get("AppliedParagraphStyle", "").split("/")[-1]
                                        style_info = styles_map.get(s_name, style_info)
                        except Exception:
                            pass

                    # Override si tenemos mapeo directo etiqueta->estilo
                    mapped = tag_style_map.get(tag)
                    if mapped and mapped in styles_map:
                        style_info = styles_map[mapped]

                    data["slots"].append(
                        {
                            "tag": tag,
                            "type": "text" if item_type == "TextFrame" else "image",
                            "x": round(min_x, 3),
                            "y": round(min_y, 3),
                            "w": round(max_x - min_x, 3),
                            "h": round(max_y - min_y, 3),
                            "style": style_info,
                        }
                    )

    return data


if __name__ == "__main__":
    res = parse_idml_full_dna("1.idml")
    with open("typst-flow/parser/layout_data.json", "w") as f:
        json.dump(res, f, indent=2)
    print("ADN de precisión extraído.")
