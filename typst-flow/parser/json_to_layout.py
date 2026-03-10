#!/usr/bin/env python3
"""
Post-procesa el JSON generado por idml-json-converter y produce un layout
con geometría (x, y, w, h) y estilos (fuente, tamaño, leading) listo para Typst.

Entrada esperada: output.json en la carpeta idml-json (convertido desde 1.idml).
Salida: layout_from_json.json (puede reemplazar layout_data.json si se desea).
"""
import json
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple

ROOT = Path(__file__).resolve().parent.parent / "idml-json"
INPUT_JSON = ROOT / "output.json"
OUTPUT_JSON = Path(__file__).resolve().parent / "layout_from_json.json"


def to_floats(seq: List[str]) -> List[float]:
    return [float(x) for x in seq]


def find_children(nodes: List[Dict[str, Any]], name: str) -> List[Dict[str, Any]]:
    return [n for n in nodes if n.get("@name") == name]


def find_child(nodes: List[Dict[str, Any]], name: str) -> Optional[Dict[str, Any]]:
    for n in nodes:
        if n.get("@name") == name:
            return n
    return None


def find_keyvalue(nodes: List[Dict[str, Any]], key: str) -> Optional[str]:
    for n in nodes:
        if n.get("@name") == "KeyValuePair":
            attrs = n.get("@attributes", {})
            if attrs.get("Key") == key:
                return attrs.get("Value")
        val = find_keyvalue(n.get("@children", []), key)
        if val is not None:
            return val
    return None


def parse_styles(styles_root: Dict[str, Any]) -> Dict[str, Dict[str, float]]:
    styles: Dict[str, Dict[str, float]] = {}
    children = styles_root.get("@children", [])
    for style in children:
        if style.get("@name") != "ParagraphStyle":
            continue
        attrs = style.get("@attributes", {})
        name = attrs.get("Self", "").split("/")[-1]
        font_name = "serif"
        size_val: Optional[float] = None
        leading_val: Optional[float] = None

        # Buscar hijos AppliedFont / PointSize / Leading
        for ch in style.get("@children", []):
            if ch.get("@name") == "AppliedFont":
                font_name = ch.get("@value", font_name)
            if ch.get("@name") == "PointSize":
                try:
                    size_val = float(ch.get("@value"))
                except Exception:
                    pass
            if ch.get("@name") == "Leading":
                try:
                    leading_val = float(ch.get("@value"))
                except Exception:
                    pass

        # Atributos de respaldo
        if size_val is None:
            try:
                size_val = float(attrs.get("PointSize"))
            except Exception:
                size_val = 10.0

        if leading_val is None:
            try:
                leading_val = float(attrs.get("Leading"))
            except Exception:
                # AutoLeading suele ser porcentaje
                try:
                    auto = float(attrs.get("AutoLeading"))
                except Exception:
                    auto = 120.0
                leading_val = round(size_val * (auto / 100.0), 3)

        styles[name] = {
            "font": font_name.split("\t")[0].replace("$", "").strip() or "serif",
            "size": size_val,
            "leading": leading_val,
        }
    return styles


def collect_paragraph_style(story: Dict[str, Any]) -> Optional[str]:
    # Tomar el primer ParagraphStyleRange de la story
    for ch in story.get("@children", []):
        if ch.get("@name") == "ParagraphStyleRange":
            attrs = ch.get("@attributes", {})
            return attrs.get("AppliedParagraphStyle", "").split("/")[-1]
    return None


def extract_anchors(item: Dict[str, Any]) -> List[Tuple[float, float]]:
    anchors: List[Tuple[float, float]] = []
    # Navegar hasta PathPointArray
    pg = find_child(item.get("@children", []), "Properties")
    if not pg:
        return anchors
    path_geom = find_child(pg.get("@children", []), "PathGeometry")
    if not path_geom:
        return anchors
    gpt = find_child(path_geom.get("@children", []), "GeometryPathType")
    if not gpt:
        return anchors
    ppa = find_child(gpt.get("@children", []), "PathPointArray")
    if not ppa:
        return anchors
    for ppt in ppa.get("@children", []):
        if ppt.get("@name") == "PathPointType":
            anchor = ppt.get("@attributes", {}).get("Anchor")
            if anchor:
                try:
                    if isinstance(anchor, list):
                        ax, ay = [float(x) for x in anchor]
                    else:
                        ax, ay = [float(x) for x in anchor.split()]
                    anchors.append((ax, ay))
                except Exception:
                    pass
    return anchors


def parse_item_transform(attrs: Dict[str, Any]) -> List[float]:
    m = attrs.get("ItemTransform", "1 0 0 1 0 0")
    if isinstance(m, list):
        return [float(x) for x in m]
    return [float(x) for x in m.split()]


def main():
    if not INPUT_JSON.exists():
        raise SystemExit(f"No se encuentra {INPUT_JSON}")

    data = json.loads(INPUT_JSON.read_text())

    # Localizar recursos clave
    styles_key = next(k for k in data.keys() if k.startswith("Resources/Styles"))
    styles_root = data[styles_key]
    styles_map = parse_styles(styles_root)

    spread_key = next(k for k in data.keys() if k.startswith("Spreads/Spread"))
    spread = data[spread_key]

    # El conversor envuelve los nodos bajo un hijo "Spread"
    spread_inner = find_child(spread.get("@children", []), "Spread") or spread

    # Obtener página (búsqueda recursiva simple)
    def find_page(node: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        if node.get("@name") == "Page":
            return node
        for ch in node.get("@children", []):
            res = find_page(ch)
            if res:
                return res
        return None

    page = find_page(spread_inner)
    if not page:
        raise SystemExit("No se encontró Page en el Spread.")

    p_attrs = page.get("@attributes", {})
    gb = p_attrs.get("GeometricBounds", "0 0 0 0")
    if isinstance(gb, list):
        p_bounds = [float(x) for x in gb]
    else:
        p_bounds = [float(x) for x in gb.split()]
    page_y1, page_x1, page_y2, page_x2 = p_bounds
    page_width = page_x2 - page_x1
    page_height = page_y2 - page_y1
    p_mat = parse_item_transform(p_attrs)
    origin_x = p_mat[4] + page_x1
    origin_y = p_mat[5] + page_y1

    # Construir mapa de stories
    stories: Dict[str, Dict[str, Any]] = {
        k.split("/")[-1].replace(".xml", ""): v
        for k, v in data.items()
        if k.startswith("Stories/Story_")
    }

    slots = []

    # Mapeo directo etiqueta -> estilo de párrafo (si la story no lo trae)
    tag_style_map = {
        "TEXTO1": "TEXTO PRINCIPAL",
        "TEXTO2": "TEXTO PRINCIPAL",
        "CREDITO": "TEXTO PRINCIPAL",
        "LEYENDA1": "TEXTO RECUADRO",
        "TITULO1": "TITULO 1 PAG GENERAL",
        "TITULO2": "TITULO 2 PAG GENERAL",
        "ANTETITULO1": "ANTETITULO",
        "SUMARIO": "SUMARIO GENERAL",
        "SOBRANTES": "TEXTO PRINCIPAL",
    }
    # Override directo por etiqueta (cuando estilos_map no trae coincidencia)
    tag_style_override = {
        "TEXTO1": {"font": "Utopia", "size": 9.5, "leading": 12.0},
        "TEXTO2": {"font": "Utopia", "size": 9.5, "leading": 12.0},
        "CREDITO": {"font": "Utopia", "size": 9.5, "leading": 12.0},
        "SOBRANTES": {"font": "Utopia", "size": 9.5, "leading": 12.0},
        "LEYENDA1": {"font": "serif", "size": 10.0, "leading": 12.0},
        "TITULO1": {"font": "Playfair Display", "size": 43.0, "leading": 54.0},
        "TITULO2": {"font": "serif", "size": 29.0, "leading": 33.0},
        "ANTETITULO1": {"font": "Myriad Pro", "size": 18.0, "leading": 11.024},
        "SUMARIO": {"font": "Myriad Pro", "size": 17.0, "leading": 18.0},
    }

    # Recorrido recursivo de todos los hijos para encontrar frames etiquetados
    stack = spread_inner.get("@children", [])[:]
    while stack:
        item = stack.pop()
        item_name = item.get("@name")
        if item_name in ("TextFrame", "Rectangle"):
            attrs = item.get("@attributes", {})
            label = find_keyvalue(item.get("@children", []), "Label")
            if label:
                label_key = label.strip().upper()
                anchors = extract_anchors(item)
                if anchors:
                    mat = parse_item_transform(attrs)
                    t_pts = []
                    for ax, ay in anchors:
                        tx = mat[0] * ax + mat[2] * ay + mat[4] - origin_x
                        ty = mat[1] * ax + mat[3] * ay + mat[5] - origin_y
                        t_pts.append((tx, ty))

                    xs = [p[0] for p in t_pts]
                    ys = [p[1] for p in t_pts]
                    min_x, max_x = min(xs), max(xs)
                    min_y, max_y = min(ys), max(ys)

                    # Estilo por defecto
                    style_info = {"font": "serif", "size": 10.0, "leading": 12.0}
                    # Estilo por Story
                    parent_story = attrs.get("ParentStory")
                    if parent_story:
                        story_node = stories.get(f"Story_{parent_story}")
                        if story_node:
                            s_name = collect_paragraph_style(story_node)
                            if s_name and s_name in styles_map:
                                style_info = styles_map[s_name]
                    # Override por etiqueta (si mapeo directo)
                    mapped = tag_style_map.get(label_key)
                    if mapped and mapped in styles_map:
                        style_info = styles_map[mapped]
                    else:
                        # Override manual si no hubo match en styles_map
                        if label_key in tag_style_override:
                            style_info = tag_style_override[label_key]

                    slots.append(
                        {
                            "tag": label_key,
                            "type": "text" if item_name == "TextFrame" else "image",
                            "x": round(min_x, 3),
                            "y": round(min_y, 3),
                            "w": round(max_x - min_x, 3),
                            "h": round(max_y - min_y, 3),
                            "style": style_info,
                        }
                    )

        stack.extend(item.get("@children", []))

    output = {"page": {"width": page_width, "height": page_height}, "slots": slots}
    OUTPUT_JSON.write_text(json.dumps(output, indent=2))
    print(f"Generado {OUTPUT_JSON} con {len(slots)} slots.")


if __name__ == "__main__":
    main()
