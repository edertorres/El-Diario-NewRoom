"""
Conversor IDML → Typst (High Fidelity) Pro.

Versión mejorada con:
- Resolución jerárquica de estilos (Paragraph y Character Styles).
- Mapeo de fuentes avanzado.
- Soporte para columnas y medianiles.
- Sistema de coordenadas y rotación corregido.
- Cálculo de leading (interlineado) exacto.
"""

import xml.etree.ElementTree as ET
import zipfile
import os
import re
import html
import math
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional, Any

logger = logging.getLogger("idml-to-typst-pro")

class StyleResolver:
    def __init__(self, para_styles: Dict[str, dict], char_styles: Dict[str, dict], colors: Dict[str, dict], grid_increment: float = 12.0):
        self.para_styles = para_styles
        self.char_styles = char_styles
        self.colors = colors
        self.grid_increment = grid_increment
        self.font_map = {
            "Austin": "Austin",
            "Playfair Display": "Playfair Display",
            "Myriad Pro": "Myriad Pro",
            "Zapf Dingbats": "Zapf Dingbats",
            "Heuristica": "Heuristica",
            "Minion Pro": "Minion Pro",
            "Arial": "Arial",
            "Times New Roman": "Times New Roman",
            "Utopia": "Heuristica",
            "Libertinus Serif": "Heuristica"
        }

    def sanitize_name(self, name: str) -> str:
        if not name or "[No paragraph style]" in name or "[No character style]" in name:
            return "style_default"
        # Limpiar prefijos IDML
        clean = name.replace("ParagraphStyle/", "").replace("CharacterStyle/", "").replace("$ID/", "")
        # Solo alfanuméricos y guiones bajos
        clean = re.sub(r'[^a-zA-Z0-9]', '_', clean)
        return clean.lower() or "style_default"

    def resolve_attributes(self, style_id: str, is_char: bool = False, overrides: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Resuelve atributos siguiendo la jerarquía: Overrides > Estilo > Estilo Base."""
        styles = self.char_styles if is_char else self.para_styles
        
        # 1. Obtener atributos del estilo base (recursivo)
        resolved = {}
        if style_id in styles:
            style = styles[style_id]
            based_on = style.get('based_on')
            if based_on and based_on not in ('$ID/[No paragraph style]', '$ID/[No character style]', style_id):
                resolved = self.resolve_attributes(based_on, is_char)
            
            # 2. Mezclar con el estilo actual
            style_attrs = style.get('attrs', {})
            resolved.update(style_attrs)
        
        # 3. Mezclar con sobrescrituras locales
        if overrides:
            resolved.update(overrides)
            
        return resolved

    def map_color(self, color_id: str, tint: Optional[float] = None) -> str:
        if not color_id or "None" in color_id: return "none"
        if "Black" in color_id: 
            base = "black"
        elif "Paper" in color_id: 
            base = "white"
        else:
            c = self.colors.get(color_id)
            if c and c['space'] == 'CMYK':
                vals_pct = [f"{v}%" for v in c['values']]
                base = f"cmyk({', '.join(vals_pct)})"
            else:
                base = "black"
        
        if tint is not None and tint < 100:
            t = tint / 100.0
            return f"color.mix(({base}, {t:.3f}), (white, {(1 - t):.3f}))"
        return base

    def get_typst_props(self, attrs: Dict[str, Any], is_char: bool = False) -> Tuple[List[str], List[str]]:
        """Convierte atributos de IDML a propiedades de Typst (text y par)."""
        props = []
        par_props = []
        
        # Color
        fill = attrs.get('FillColor')
        if fill:
            color = self.map_color(fill)
            if color != 'none':
                props.append(f"fill: {color}")
        
        # Font size
        size = attrs.get('PointSize')
        if size:
            props.append(f"size: {size}pt")
            
        # Font Family
        raw_font = attrs.get('AppliedFont')
        font = ''
        if raw_font and isinstance(raw_font, str):
            font = raw_font.split('\t')[0].replace('$ID/', '')
            
        if font:
            mapped_font = self.font_map.get(font, font)
            props.append(f'font: "{mapped_font}"')
            
        # Tracking
        tracking = attrs.get('Tracking')
        if tracking:
            try:
                t_val = float(tracking)
                if t_val != 0:
                    props.append(f'tracking: {(t_val/1000):.3f}em')
            except: pass

        # Font Style (Weight/Style)
        f_style = attrs.get('FontStyle', '')
        if f_style:
            if 'Bold' in f_style: props.append('weight: "bold"')
            if 'Italic' in f_style: props.append('style: "italic"')

        # Leading
        leading = attrs.get('Leading')
        s_val = float(size or 12)
        
        # Grid Alignment Support
        align_to_grid = attrs.get('AlignToBaseline', 'false').lower() == 'true'
        grid_increment = float(attrs.get('GridIncrement', 12.0)) # Fallback or injected
        
        if align_to_grid:
            # Snap to grid: Leading must be GridIncrement - FontSize
            par_props.append(f'leading: {(grid_increment - s_val):.2f}pt')
        elif leading:
            try:
                l_val = float(leading)
                if l_val > 0.1:
                    par_props.append(f'leading: {(l_val - s_val):.2f}pt')
                else:
                    par_props.append(f'leading: 0.20em')
            except:
                par_props.append(f'leading: 0.20em')
        else:
            par_props.append(f'leading: 0.20em')

        # Justification
        just = attrs.get('Justification', '')
        if just:
            if 'Center' in just: par_props.append('justify: false')
            elif 'Right' in just: par_props.append('justify: false')
            elif 'Justified' in just: par_props.append('justify: true')
            else: par_props.append('justify: false')

        # Indents
        try:
            li = float(attrs.get('LeftIndent', 0))
            fli = float(attrs.get('FirstLineIndent', 0))
            if li != 0 or fli != 0:
                par_props.append(f'first-line-indent: {(li + fli):.2f}pt')
                par_props.append(f'hanging-indent: {li:.2f}pt')
        except: pass

        # Space After (spacing en Typst)
        try:
            sa = float(attrs.get('SpaceAfter', 0))
            if sa > 0:
                par_props.append(f'spacing: {sa:.2f}pt')
        except: pass
            
        return props, par_props

    def build_typst_style(self, style_id: str, is_char: bool = False) -> str:
        attrs = self.resolve_attributes(style_id, is_char)
        if not attrs: return ""
        
        props, par_props = self.get_typst_props(attrs, is_char)
        
        name = self.sanitize_name(style_id)
        func = f"#let {name}(it) = {{\n"
        is_inter = not is_char and ("inter" in name.lower())
            
        # Alineación
        just = attrs.get('Justification', '')
        align_val = None
        if 'Center' in just: align_val = 'center'
        elif 'Right' in just: align_val = 'right'
        
        if align_val: func += f"  set align({align_val})\n"
        if props: func += f"  set text({', '.join(props)})\n"
        
        # Manejo explícito de SpaceBefore y SpaceAfter para fidelidad total
        if not is_char:
            sb = float(attrs.get('SpaceBefore', 0))
            sa = float(attrs.get('SpaceAfter', 0))
            
            # Para Intertítulos, forzamos al menos el incremento de la cuadrícula antes
            if is_inter:
                sb = max(sb, self.grid_increment)
                sa = 0.0 # Forzar 0 después para intertítulos
                
            if sb > 0: func += f"  v({sb:.2f}pt, weak: true)\n"
            
            # El par(spacing) lo manejamos ahora via v() después del bloque o simplemente
            # dejamos que el siguiente párrafo maneje su SpaceBefore.
            # En Typst, set par(spacing) es lo más eficiente si es constante.
            # Si hay SpaceAfter, lo inyectamos al final del wrapper.
            
        if par_props: 
            # Eliminar 'spacing' de par_props ya que lo manejamos explícitamente o via global 0
            par_props = [p for p in par_props if not p.startswith('spacing:')]
            func += f"  set par({', '.join(par_props)})\n"
        
        if is_inter:
            func += "  upper(it)\n"
        else:
            func += "  it\n"
            
        if not is_char and not is_inter:
            sa = float(attrs.get('SpaceAfter', 0))
            if sa > 0: func += f"  v({sa:.2f}pt, weak: true)\n"
            
        func += "}\n"
        return func

class IDMLToTypstProConverter:
    def __init__(self, idml_path: str):
        self.idml_path = Path(idml_path)
        self.colors: Dict[str, dict] = {}
        self.para_styles: Dict[str, dict] = {}
        self.char_styles: Dict[str, dict] = {}
        self.stories: Dict[str, ET.Element] = {}
        self.spreads: List[dict] = []
        self.pages: List[dict] = []
        self.page_settings = {"width": 595.276, "height": 841.89}
        self.grid_settings = {"increment": 12.0, "start": 0.0}
        self.resolver: Optional[StyleResolver] = None

    def convert(self, output_typ: str):
        if not self.idml_path.exists():
            raise FileNotFoundError(f"IDML no encontrado: {self.idml_path}")

        with zipfile.ZipFile(self.idml_path, "r") as z:
            self._parse_colors(z)
            self._parse_styles(z)
            self._parse_stories(z)
            self._parse_spreads(z)
            self._parse_preferences(z)
        
        self.resolver = StyleResolver(self.para_styles, self.char_styles, self.colors, self.grid_settings['increment'])
        typ_content = self._generate_typ_code()
        
        with open(output_typ, "w", encoding="utf-8") as f:
            f.write(typ_content)

    def _parse_colors(self, z: zipfile.ZipFile):
        try:
            with z.open("Resources/Graphic.xml") as f:
                root = ET.parse(f).getroot()
                for c in root.findall('.//Color'):
                    self_id = c.get('Self', '')
                    space = c.get('Space', 'CMYK')
                    vals = c.get('ColorValue', '')
                    if self_id and vals:
                        self.colors[self_id] = {
                            'space': space,
                            'values': [float(v) for v in vals.split()]
                        }
        except Exception as e: logger.warning(f"Error parseando colores: {e}")

    def _parse_styles(self, z: zipfile.ZipFile):
        try:
            with z.open("Resources/Styles.xml") as f:
                root = ET.parse(f).getroot()
                for ps in root.findall('.//ParagraphStyle'):
                    self_id = ps.get('Self', '')
                    self.para_styles[self_id] = {
                        'based_on': ps.get('BasedOn', ''),
                        'attrs': self._extract_attrs(ps)
                    }
                for cs in root.findall('.//CharacterStyle'):
                    self_id = cs.get('Self', '')
                    self.char_styles[self_id] = {
                        'based_on': cs.get('BasedOn', ''),
                        'attrs': self._extract_attrs(cs)
                    }
        except Exception as e: logger.warning(f"Error parseando estilos: {e}")

    def _extract_attrs(self, el: ET.Element) -> dict:
        attrs = dict(el.attrib)
        props = el.find('Properties')
        if props is not None:
            for child in props:
                text_val = child.text
                if text_val is not None:
                    txt = text_val.strip()
                    if txt: attrs[child.tag] = txt
                
                for k, v in child.attrib.items():
                    attrs[f"{child.tag}_{k}"] = v
                    val = child.text
                    if k == 'type' and v == 'unit' and val is not None:
                        attrs[child.tag] = val.strip()
        return attrs

    def _parse_stories(self, z: zipfile.ZipFile):
        for name in z.namelist():
            if name.startswith("Stories/Story_") and name.endswith(".xml"):
                try:
                    with z.open(name) as f:
                        root = ET.parse(f).getroot()
                        story = root.find('Story')
                        if story is not None:
                            self_id = story.get('Self', name.replace("Stories/Story_", "").replace(".xml", ""))
                            self.stories[self_id] = story
                except: pass

    def _parse_preferences(self, z: zipfile.ZipFile):
        try:
            with z.open("Resources/Preferences.xml") as f:
                root = ET.parse(f).getroot()
                dp = root.find('.//DocumentPreference')
                if dp is not None:
                    self.page_settings["width"] = float(dp.get("PageWidth", "595.276"))
                    self.page_settings["height"] = float(dp.get("PageHeight", "841.89"))
                
                # Baseline Grid Preferences
                gp = root.find('.//GridPreference')
                if gp is not None:
                    # IncrementEvery is the most common attribute for baseline grid division
                    inc = gp.get('BaselineDivision') or gp.get('BaselineIncrement') or gp.get('IncrementEvery')
                    if inc: self.grid_settings["increment"] = float(inc)
                    
                    start = gp.get('BaselineStart')
                    if start: self.grid_settings["start"] = float(start)
        except: pass

    def _parse_spreads(self, z: zipfile.ZipFile):
        spread_names = sorted([n for n in z.namelist() if n.startswith("Spreads/Spread_") and n.endswith(".xml")])
        for name in spread_names:
            try:
                with z.open(name) as f:
                    root = ET.parse(f).getroot()
                    for spread_el in root.iter():
                        if spread_el.tag.endswith('Spread') and not spread_el.tag.startswith('{http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging}'):
                            self._parse_spread(spread_el)
            except Exception as e: logger.warning(f"Error parseando spread {name}: {e}")

    def _parse_spread(self, spread: ET.Element):
        pages_in_spread = []
        for page in spread.findall('Page'):
            gb = page.get('GeometricBounds', '')
            it = page.get('ItemTransform', '1 0 0 1 0 0')
            if not gb: continue
            
            bounds = [float(x) for x in gb.split()]
            transform = [float(x) for x in it.split()]
            page_top, page_left, page_bottom, page_right = bounds
            
            pages_in_spread.append({
                'width': page_right - page_left,
                'height': page_bottom - page_top,
                'x_offset': -transform[4] - page_left,
                'y_offset': -transform[5] - page_top,
                'page_num': len(self.pages) + 1
            })
            self.pages.append(pages_in_spread[-1])

        if not pages_in_spread: return
        self._parse_children(spread, pages_in_spread[0], [1.0, 0.0, 0.0, 1.0, 0.0, 0.0])

    def _parse_children(self, parent: ET.Element, page_info: dict, parent_transform: List[float]):
        for child in parent:
            tag = child.tag
            if tag.endswith('Page'): continue
            
            if tag.endswith('Group'):
                it = self._parse_transform(child)
                combined = self._compose_transforms(parent_transform, it)
                self._parse_children(child, page_info, combined)
            elif tag.endswith('TextFrame'):
                self._parse_frame(child, page_info, parent_transform, 'text')
            elif tag.endswith('Rectangle') or tag.endswith('Polygon') or tag.endswith('Oval'):
                self._parse_frame(child, page_info, parent_transform, 'rect')

    def _parse_frame(self, el: ET.Element, page_info: dict, parent_transform: List[float], ftype: str):
        pos = self._compute_pos(el, page_info, parent_transform)
        if not pos: return
        
        pos['type'] = ftype
        pos['stroke_weight'] = float(el.get('StrokeWeight', 0))
        pos['stroke_color'] = el.get('StrokeColor', 'Swatch/None')
        pos['fill_color'] = el.get('FillColor', 'Swatch/None')
        pos['fill_tint'] = float(el.get('FillTint', 100))

        if ftype == 'text':
            story_id = el.get('ParentStory', '').replace('Story_', '')
            pos['story_id'] = story_id
            # Threading information to avoid duplication
            pos['prev_frame'] = el.get('PreviousTextFrame', 'n')
            pos['next_frame'] = el.get('NextTextFrame', 'n')
            
            # Extract Insets (text frame padding)
            pos['inset_top'] = float(el.get('TopInset') or '0')
            pos['inset_left'] = float(el.get('LeftInset') or '0')
            pos['inset_bottom'] = float(el.get('BottomInset') or '0')
            pos['inset_right'] = float(el.get('RightInset') or '0')

            tfp = el.find('TextFramePreference')
            if tfp is not None:
                pos['columns'] = int(tfp.get('TextColumnCount') or '1')
                pos['gutter'] = float(tfp.get('TextColumnGutter') or '12')
                
                # Preference overrides
                pos['inset_top'] = float(tfp.get('TopInset') or pos['inset_top'])
                pos['inset_left'] = float(tfp.get('LeftInset') or pos['inset_left'])
                pos['inset_bottom'] = float(tfp.get('BottomInset') or pos['inset_bottom'])
                pos['inset_right'] = float(tfp.get('RightInset') or pos['inset_right'])
                
                props = tfp.find('Properties')
                if props is not None:
                    ins_el = props.find('InsetSpacing')
                    if ins_el is not None:
                        txt_val = ins_el.text
                        if txt_val:
                            vals = [float(v) for v in txt_val.split()]
                            if len(vals) == 4:
                                pos['inset_top'], pos['inset_left'], pos['inset_bottom'], pos['inset_right'] = vals
            else:
                pos['columns'] = int(el.get('TextColumnCount') or '1')
                pos['gutter'] = 12.0
            
        elif ftype == 'rect':
            img = el.find('.//Image')
            if img is not None:
                link = img.find('Link')
                uri = link.get('LinkResourceURI', '') if link is not None else ''
                pos['type'] = 'image'
                
                # Normalización robusta de URI (Soporte para Windows \ y espacios %20)
                # Normalización robusta de URI (Soporte para Windows \ y espacios %20)
                import urllib.parse
                clean_uri = urllib.parse.unquote(uri.replace('file:', ''))
                # Reemplazar contra-barras y obtener el nombre del archivo
                idml_filename = Path(clean_uri.replace('\\', '/')).name
                logger.info(f"IDMLPro: URI original: '{uri}' -> Limpia: '{clean_uri}' -> Filename: '{idml_filename}'")
                
                # Resolvemos a ruta RELATIVA (Typst prefiere rutas relativas al CWD)
                actual_rel_path = self._find_image_on_disk(idml_filename)
                pos['file'] = actual_rel_path.replace('\\', '/')
                logger.info(f"IDMLPro: Ruta final resuelta para Typst: '{pos['file']}'")
            else:
                if el.tag.endswith('Oval'): pos['shape'] = 'oval'
                elif el.tag.endswith('Polygon'): pos['shape'] = 'polygon'
                else: pos['shape'] = 'rect'
        
        self.spreads.append(pos)

    def _find_image_on_disk(self, idml_ref: str) -> str:
        temp_dir = self.idml_path.parent
        ref_l = idml_ref.lower()
        ref_stem = Path(idml_ref).stem.lower()
        
        # 1. Búsqueda recursiva en todo el directorio temporal (lo más robusto)
        logger.info(f"IDMLPro: Buscando '{idml_ref}' recursivamente en {temp_dir}")
        try:
            for root, dirs, files in os.walk(temp_dir):
                # a. Match exacto
                if idml_ref in files:
                    abs_path = Path(root) / idml_ref
                    return os.path.relpath(abs_path, temp_dir)
                # b. Match case-insensitive o stem
                for f in files:
                    if f.lower() == ref_l or Path(f).stem.lower() == ref_stem:
                        abs_path = Path(root) / f
                        return os.path.relpath(abs_path, temp_dir)
        except Exception as e:
            logger.error(f"Error en búsqueda recursiva: {e}")
            
        # 2. ÚLTIMO RECURSO: Retornar ruta estándar en 'Links/'
        # Si Typst falla aquí, al menos el error indicará que buscó en Links/
        return f"Links/{idml_ref}"

    def _compute_pos(self, el: ET.Element, page_info: dict, parent_transform: List[float]) -> Optional[dict]:
        anchors = []
        for ppt in el.iter('PathPointType'):
            anc = ppt.get('Anchor')
            if anc: anchors.append([float(v) for v in anc.split()])
        
        if not anchors:
            gb = el.get('GeometricBounds', '')
            if not gb: return None
            vals = [float(v) for v in gb.split()]
            min_x, min_y, max_x, max_y = vals[1], vals[0], vals[3], vals[2]
        else:
            min_x = min(p[0] for p in anchors); min_y = min(p[1] for p in anchors)
            max_x = max(p[0] for p in anchors); max_y = max(p[1] for p in anchors)

        w, h = max_x - min_x, max_y - min_y
        it = self._parse_transform(el)
        combined = self._compose_transforms(parent_transform, it)
        tx, ty = self._apply_transform(min_x, min_y, combined)
        a, b = combined[0], combined[1]
        rotation = math.degrees(math.atan2(b, a))
        
        return {
            'x': tx + page_info['x_offset'], 'y': ty + page_info['y_offset'],
            'w': w, 'h': h, 'rotation': rotation,
            'page': page_info['page_num'], 'anchors': anchors
        }

    def _apply_transform(self, x: float, y: float, mat: List[float]) -> Tuple[float, float]:
        a, b, c, d, tx, ty = mat
        return (a * x + c * y + tx), (b * x + d * y + ty)

    def _compose_transforms(self, m1: List[float], m2: List[float]) -> List[float]:
        a1, b1, c1, d1, tx1, ty1 = m1
        a2, b2, c2, d2, tx2, ty2 = m2
        return [
            a1*a2 + c1*b2, b1*a2 + d1*b2,
            a1*c2 + c1*d2, b1*c2 + d1*d2,
            a1*tx2 + c1*ty2 + tx1, b1*tx2 + d1*ty2 + ty1
        ]

    def _parse_transform(self, el: ET.Element) -> List[float]:
        it = el.get('ItemTransform')
        if not it: return [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]
        return [float(v) for v in it.split()]

    def _generate_typ_code(self) -> str:
        parts = ["// Typst High Fidelity Generated\n"]
        parts.append(f'#set page(width: {self.page_settings["width"]}pt, height: {self.page_settings["height"]}pt, margin: 0pt)')
        
        # Metric Normalization & Global Spacing suppression
        parts.append('#set text(lang: "es", hyphenate: true, font: "Heuristica", top-edge: 0.8em, bottom-edge: -0.2em)\n')
        parts.append('#set par(spacing: 0pt)\n')
        
        used_p_styles = set()
        used_c_styles = set()
        for s in self.stories.values():
            if s is not None:
                for psr in s.findall('.//ParagraphStyleRange'):
                    p = psr.get('AppliedParagraphStyle', '')
                    if p: used_p_styles.add(p)
                    for csr in psr.findall('.//CharacterStyleRange'):
                        c = csr.get('AppliedCharacterStyle', '')
                        if c: used_c_styles.add(c)
        
        resolver = self.resolver
        if not resolver: return ""
        
        for p_id in sorted(used_p_styles):
            s_code = resolver.build_typst_style(p_id)
            if s_code: parts.append(s_code)
        
        for c_id in sorted(used_c_styles):
            s_code = resolver.build_typst_style(c_id, is_char=True)
            if s_code: parts.append(s_code)
            
        parts.append("#let style_default(it) = it\n")
        
        current_p = 0
        for item in self.spreads:
            if item['page'] > current_p:
                if current_p > 0: parts.append("#pagebreak()")
                current_p = item['page']
            
            x, y, w, h, rot = item['x'], item['y'], item['w'], item['h'], item['rotation']
            
            if item['type'] == 'rect':
                fill = resolver.map_color(item.get('fill_color', ''), item.get('fill_tint'))
                stroke_w = item.get('stroke_weight', 0)
                stroke_c = resolver.map_color(item.get('stroke_color', ''))
                stroke_str = f"{stroke_w:.2f}pt + {stroke_c}" if stroke_w > 0 and stroke_c != 'none' else "none"
                shape = item.get('shape', 'rect')
                if shape == 'oval':
                    parts.append(f'#place(dx: {x:.2f}pt, dy: {y:.2f}pt)[#rotate({rot:.2f}deg, origin: top + left)[#ellipse(width: {w:.2f}pt, height: {h:.2f}pt, fill: {fill}, stroke: {stroke_str})]]')
                elif shape == 'polygon' and item.get('anchors'):
                    min_x = min(p[0] for p in item['anchors']); min_y = min(p[1] for p in item['anchors'])
                    pts = [f"({p[0]-min_x:.2f}pt, {p[1]-min_y:.2f}pt)" for p in item['anchors']]
                    parts.append(f'#place(dx: {x:.2f}pt, dy: {y:.2f}pt)[#rotate({rot:.2f}deg, origin: top + left)[#polygon(fill: {fill}, stroke: {stroke_str}, {", ".join(pts)})]]')
                else:
                    parts.append(f'#place(dx: {x:.2f}pt, dy: {y:.2f}pt)[#rotate({rot:.2f}deg, origin: top + left)[#rect(width: {w:.2f}pt, height: {h:.2f}pt, fill: {fill}, stroke: {stroke_str})]]')
            
            elif item['type'] == 'image':
                stroke_w = item.get('stroke_weight', 0)
                stroke_c = resolver.map_color(item.get('stroke_color', '')) if resolver else "none"
                stroke_str = f"{stroke_w:.2f}pt + {stroke_c}" if stroke_w > 0 and stroke_c != 'none' else "none"
                img_block = f'#image("{item.get("file")}", width: {w:.2f}pt, height: {h:.2f}pt, fit: "cover")'
                if stroke_str != 'none': img_block = f'#box(stroke: {stroke_str}, clip: true)[{img_block}]'
                parts.append(f'#place(dx: {x:.2f}pt, dy: {y:.2f}pt)[#rotate({rot:.2f}deg, origin: top + left)[{img_block}]]')
                
            elif item['type'] == 'text':
                sid = item.get('story_id')
                # Renderizar siempre para asegurar visibilidad, incluso en hilos (continuation)
                # ya que Typst no tiene hilos automáticos de cajas absolutas.
                content = self._gen_story(sid) if sid else ""
                
                if item.get('columns', 1) > 1:
                    content = f'#columns({item["columns"]}, gutter: {item.get("gutter", 12):.2f}pt)[{content}]'
                fill = resolver.map_color(item.get('fill_color', ''), item.get('fill_tint')) if resolver else "none"
                stroke_w = item.get('stroke_weight', 0)
                stroke_c = resolver.map_color(item.get('stroke_color', '')) if resolver else "none"
                stroke_str = f"{stroke_w:.2f}pt + {stroke_c}" if stroke_w > 0 and stroke_c != 'none' else "none"
                
                it, il, ib, ir = item.get('inset_top', 0), item.get('inset_left', 0), item.get('inset_bottom', 0), item.get('inset_right', 0)
                inset_val = f"inset: (top: {it:.2f}pt, left: {il:.2f}pt, bottom: {ib:.2f}pt, right: {ir:.2f}pt)"
                
                # Usamos un pequeño margen vertical (3pt) para que los descendentes no se corten
                # pero mantenemos el clip: true para evitar superposiciones desastrosas.
                h_render = h + 3.0
                parts.append(f'#place(dx: {x:.2f}pt, dy: {y:.2f}pt)[#rotate({rot:.2f}deg, origin: top + left)[#block(width: {w:.2f}pt, height: {h_render:.2f}pt, {inset_val}, fill: {fill}, stroke: {stroke_str}, clip: true)[{content}]]]')

        return "\n".join(parts)

    def _extract_overrides(self, el: ET.Element) -> Dict[str, Any]:
        overrides = {}
        for k, v in el.attrib.items():
            if k not in ('AppliedParagraphStyle', 'AppliedCharacterStyle', 'Self'):
                overrides[k] = v
        props = el.find('Properties')
        if props is not None:
            for child in props:
                if child is not None and child.text: 
                    overrides[child.tag] = child.text
        return overrides

    def _gen_story(self, story_id: str) -> str:
        story = self.stories.get(story_id)
        res_resolver = self.resolver
        if story is None or res_resolver is None: return ""
        
        res = []
        if story is not None:
            # Usar búsqueda robusta para ParagraphStyleRange (namespace-agnostic y nivel superior)
            for psr in story:
                tag = psr.tag.split('}')[-1] if '}' in psr.tag else psr.tag
                if tag != 'ParagraphStyleRange': continue
                
                p_style = psr.get('AppliedParagraphStyle', '')
                p_overrides = self._extract_overrides(psr)
                # Inyectar incremento de la cuadrícula en las propiedades del párrafo
                p_overrides['GridIncrement'] = str(self.grid_settings['increment'])
                
                # Resolver atributos consolidados del párrafo
                p_attrs = res_resolver.resolve_attributes(p_style, False, p_overrides) if res_resolver else p_overrides
                p_name = res_resolver.sanitize_name(p_style) if res_resolver else "style_default"
                
                p_text_parts = []
                for csr in psr.findall('.//CharacterStyleRange'):
                    c_style = csr.get('AppliedCharacterStyle', '')
                    c_overrides = self._extract_overrides(csr)
                    c_attrs = res_resolver.resolve_attributes(c_style, True, c_overrides) if res_resolver else c_overrides
                    c_props, _ = res_resolver.get_typst_props(c_attrs, True) if res_resolver else ([], "")
                    
                    content = []
                    for child in csr:
                        tag = child.tag.split('}')[-1] if child.tag and '}' in child.tag else (child.tag or "")
                        if tag == 'Content': content.append(self._esc(child.text or ""))
                        elif tag == 'Br': content.append("\n")
                    
                    txt = "".join(content)
                    if c_props:
                        p_text_parts.append(f"#text({', '.join(c_props)})[{txt}]")
                    else:
                        c_func = res_resolver.sanitize_name(c_style) if res_resolver else "style_default"
                        if c_func != "style_default": p_text_parts.append(f"#{c_func}[{txt}]")
                        else: p_text_parts.append(txt)
                
                res.append(f"#{p_name}[{''.join(p_text_parts)}]")
        return "\n".join(res)

    def _esc(self, t: str) -> str:
        return t.replace("\\", "\\\\").replace("#", "\\#").replace("$", "\\$").replace("*", "\\*").replace("_", "\\_").replace("<", "\\<").replace(">", "\\>")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python idml_to_high_fidelity_typst.py input.idml output.typ")
    else:
        IDMLToTypstProConverter(sys.argv[1]).convert(sys.argv[2])
