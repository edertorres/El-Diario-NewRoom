"""
Conversor IDML → SLA (Scribus) en Python puro.

Convierte archivos InDesign IDML a formato SLA de Scribus.
El SLA generado se abre con Scribus -g para renderizar a PDF.

Correcciones v2:
  - Extrae Labels de TextFrames/Rectangles (TENGALO, TEXTO1, etc.)
  - Crea image frames (PTYPE=2) para Rectangles con <Image>
  - Procesa Polygons (no solo Rectangles)
  - Maneja Groups con transforms compuestos
  - Incluye rectangles con fill Paper/None (Scribus los necesita)
  - Extrae TextInsets (EXTRA, TEXTRA, BEXTRA, REXTRA)
  - Extrae columngap de TextColumnGutter
"""

import xml.etree.ElementTree as ET
import zipfile
import os
import re
import html
import math
import logging
from pathlib import Path
from typing import Dict, List, Tuple, Optional

logger = logging.getLogger("idml-to-sla")


class IDMLToSLAConverter:
    def __init__(self, idml_path: str):
        self.idml_path = Path(idml_path)
        self.colors: Dict[str, dict] = {}
        self.para_styles: Dict[str, dict] = {}
        self.char_styles: Dict[str, dict] = {}
        self.stories: Dict[str, ET.Element] = {}
        self.pages: List[dict] = []
        self.page_objects: List[dict] = []  # Unified list for all objects

        # Defaults
        self.page_width = 595.276
        self.page_height = 841.89
        self.scratch_left = 100.001
        self.scratch_top = 20.001

    def convert(self, output_sla: str):
        """Convierte IDML a SLA y guarda en output_sla."""
        with zipfile.ZipFile(self.idml_path, 'r') as z:
            self._parse_colors(z)
            self._parse_styles(z)
            self._parse_stories(z)
            self._parse_spreads(z)

        sla_xml = self._generate_sla()

        with open(output_sla, 'w', encoding='utf-8') as f:
            f.write(sla_xml)

        logger.info(f"SLA generado: {output_sla}")
        return output_sla

    # ── Helpers ──────────────────────────────────────────────────────────

    def _get_label(self, element: ET.Element) -> str:
        """Extrae el label/nombre de un elemento IDML de forma robusta."""
        # 1. Atributos directos comunes
        for attr in ["Label", "label", "ScriptLabel", "Name"]:
            val = element.get(attr)
            if val and val.strip() and not val.startswith("$ID/") and not val.startswith("u"):
                try:
                    # Ignorar si es solo un número (ID auto-generado)
                    float(val)
                except ValueError:
                    return val.strip()

        # 2. Propiedades anidadas
        props = element.find('Properties')
        if props is not None:
            # Buscar KeyValuePairs
            label_group = props.find('Label')
            if label_group is not None:
                # Caso: <KeyValuePair Key="label" Value="MI_TAG" />
                for kv in label_group.findall('.//KeyValuePair'):
                    key = (kv.get('Key') or kv.get('key') or "").lower()
                    val = kv.get('Value') or kv.get('value')
                    if key == "label" and val:
                        return val.strip()
                    # Fallback al primer KV con valor si no hay "label"
                    if val and val.strip() and not val.startswith("$ID/"):
                        return val.strip()
            
            label_tag = props.find('Label')
            if label_tag is not None:
                txt = (label_tag.text or "").strip()
                if txt and not txt.startswith("$ID/"):
                    return txt
                    
        return ""

    def _extract_bounds_from_path(self, element: ET.Element) -> Optional[Tuple[float, float, float, float]]:
        """Extrae min_x, min_y, max_x, max_y de PathGeometry anchors."""
        anchors = []
        for ppt in element.iter('PathPointType'):
            anchor = ppt.get('Anchor')
            if anchor:
                parts = anchor.split()
                if len(parts) == 2:
                    anchors.append((float(parts[0]), float(parts[1])))

        if not anchors:
            # Fallback a GeometricBounds
            gb = element.get('GeometricBounds', '')
            if gb:
                vals = [float(x) for x in gb.split()]
                if len(vals) == 4:
                    return (vals[1], vals[0], vals[3], vals[2])  # left, top, right, bottom
            return None

        min_x = min(a[0] for a in anchors)
        min_y = min(a[1] for a in anchors)
        max_x = max(a[0] for a in anchors)
        max_y = max(a[1] for a in anchors)

        return (min_x, min_y, max_x, max_y)

    def _apply_transform(self, x: float, y: float, transform: List[float]) -> Tuple[float, float]:
        """Aplica una transformación afín 2D: [a, b, c, d, tx, ty]."""
        a, b, c, d, tx, ty = transform
        new_x = a * x + c * y + tx
        new_y = b * x + d * y + ty
        return new_x, new_y

    def _compose_transforms(self, parent: List[float], child: List[float]) -> List[float]:
        """Compone dos transformaciones afines: resultado = parent * child."""
        a1, b1, c1, d1, tx1, ty1 = parent
        a2, b2, c2, d2, tx2, ty2 = child
        return [
            a1 * a2 + c1 * b2,
            b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2,
            b1 * c2 + d1 * d2,
            a1 * tx2 + c1 * ty2 + tx1,
            b1 * tx2 + d1 * ty2 + ty1,
        ]

    def _parse_transform(self, element: ET.Element) -> List[float]:
        """Parsea ItemTransform de un elemento."""
        ts = element.get('ItemTransform', '1 0 0 1 0 0')
        return [float(x) for x in ts.split()]

    def _esc(self, text: str) -> str:
        """Escapa texto para XML."""
        return html.escape(text, quote=True)

    # Mapa de normalización FontStyle IDML → Scribus
    # InDesign usa "Roman" para regular en algunas fuentes (ej. Utopia)
    FONT_STYLE_MAP = {
        'Roman': 'Regular',
        'roman': 'Regular',
        'Book': 'Regular',
        'book': 'Regular',
        'Plain': 'Regular',
        'Bd': 'Bold',
        'It': 'Italic',
        'BoldIt': 'Bold Italic',
        'Cond': 'Condensed',
        'Bold Cond': 'Bold Condensed',
        'Bold Condensed': 'Bold Condensed',
        'Semibold It': 'Semibold Italic',
        'SemiboldIt': 'Semibold Italic',
    }

    # Fuente por defecto para estilos que no tienen fuente definida en IDML
    # (heredan del padre, pero nuestro parser no resuelve herencia)
    DEFAULT_STYLE_FONT = 'Utopia Regular'

    # Mapeo TextWrapMode IDML → TEXTFLOWMODE SLA
    TEXTWRAP_MAP = {
        'None': 0,
        'BoundingBoxTextWrap': 2,     # Bounding box
        'Contour': 1,                 # Frame shape
        'JumpObjectTextWrap': 3,      # Contour line (jump)
    }

    # ── Parsing ─────────────────────────────────────────────────────────

    def _parse_colors(self, z: zipfile.ZipFile):
        """Extrae colores de Resources/Graphic.xml."""
        try:
            graphic_xml = z.read('Resources/Graphic.xml').decode('utf-8')
            root = ET.fromstring(graphic_xml)

            for color in root.iter('Color'):
                self_id = color.get('Self', '')
                name = color.get('Name', '')
                space = color.get('Space', 'CMYK')

                cv_text = ''
                props = color.find('Properties')
                if props is not None:
                    cv_el = props.find('ColorValue')
                    if cv_el is not None and cv_el.text:
                        cv_text = cv_el.text

                if not cv_text:
                    cv_text = color.get('ColorValue', '0 0 0 0')

                values = [float(v) for v in cv_text.strip().split()]

                if space == 'CMYK' and len(values) >= 4:
                    self.colors[self_id] = {
                        'name': name, 'space': 'CMYK',
                        'c': values[0], 'm': values[1], 'y': values[2], 'k': values[3],
                    }
                elif space == 'RGB' and len(values) >= 3:
                    self.colors[self_id] = {
                        'name': name, 'space': 'RGB',
                        'r': values[0], 'g': values[1], 'b': values[2],
                    }
        except Exception as e:
            logger.warning(f"Error parsing Graphic.xml: {e}")

    def _parse_styles(self, z: zipfile.ZipFile):
        """Extrae estilos de párrafo y carácter de Resources/Styles.xml."""
        try:
            styles_xml = z.read('Resources/Styles.xml').decode('utf-8')
            root = ET.fromstring(styles_xml)

            for ps in root.iter('ParagraphStyle'):
                self_id = ps.get('Self', '')
                name = ps.get('Name', '')
                if not name or name.startswith('$ID/'):
                    name = name.replace('$ID/', '')

                font = ''
                leading = None
                props = ps.find('Properties')
                if props is not None:
                    af = props.find('AppliedFont')
                    if af is not None and af.text is not None:
                        font = af.text.strip()
                    lead_el = props.find('Leading')
                    if lead_el is not None:
                        lt = lead_el.text
                        if lt is not None:
                            lt_strip = (lt or "").strip()
                            if lt_strip:
                                try:
                                    leading = float(lt_strip)
                                except ValueError:
                                    pass
                        elif lead_el.get('type') == 'unit':
                            try:
                                leading = float(lt) if lt else None
                            except (ValueError, TypeError):
                                pass

                self.para_styles[self_id] = {
                    'name': name,
                    'font': font,
                    'font_style': ps.get('FontStyle', 'Regular'),
                    'point_size': ps.get('PointSize', ''),
                    'justification': ps.get('Justification', ''),
                    'leading': leading,
                    'first_indent': ps.get('FirstLineIndent', '0'),
                    'left_indent': ps.get('LeftIndent', '0'),
                    'right_indent': ps.get('RightIndent', '0'),
                    'space_before': ps.get('SpaceBefore', '0'),
                    'space_after': ps.get('SpaceAfter', '0'),
                    'fill_color': ps.get('FillColor', ''),
                    'drop_cap_lines': ps.get('DropCapLines', '0'),
                    'hyphenation': ps.get('Hyphenation', 'true'),
                    'tracking': ps.get('Tracking', '0'),
                    'capitalization': ps.get('Capitalization', 'Normal'),
                }

            for cs in root.iter('CharacterStyle'):
                self_id = cs.get('Self', '')
                name = cs.get('Name', '')
                if not name or name.startswith('$ID/'):
                    name = name.replace('$ID/', '')

                font = ''
                props = cs.find('Properties')
                if props is not None:
                    af = props.find('AppliedFont')
                    if af is not None and af.text is not None:
                        font = af.text.strip()

                self.char_styles[self_id] = {
                    'name': name,
                    'font': font,
                    'font_style': cs.get('FontStyle', ''),
                    'point_size': cs.get('PointSize', ''),
                    'fill_color': cs.get('FillColor', ''),
                }
        except Exception as e:
            logger.warning(f"Error parsing Styles.xml: {e}")

    def _parse_stories(self, z: zipfile.ZipFile):
        """Lee todos los archivos Stories/Story_*.xml."""
        for name in z.namelist():
            if name.startswith('Stories/') and name.endswith('.xml'):
                try:
                    story_xml = z.read(name).decode('utf-8')
                    root = ET.fromstring(story_xml)
                    for story in root.iter('Story'):
                        story_id = story.get('Self', '')
                        if story_id:
                            self.stories[story_id] = story
                except Exception as e:
                    logger.warning(f"Error parsing {name}: {e}")

    def _parse_spreads(self, z: zipfile.ZipFile):
        """Parsea Spreads para obtener páginas y frames."""
        for name in sorted(z.namelist()):
            if not name.startswith('Spreads/') or not name.endswith('.xml'):
                continue
            try:
                spread_xml = z.read(name).decode('utf-8')
                root = ET.fromstring(spread_xml)
                for spread in root.iter('Spread'):
                    self._parse_spread(spread)
            except Exception as e:
                logger.warning(f"Error parsing {name}: {e}")

    def _parse_spread(self, spread: ET.Element):
        """Parsea un Spread: páginas y todos sus objetos."""
        # Encontrar páginas
        for page in spread.iter('Page'):
            gb = page.get('GeometricBounds', '')
            it = page.get('ItemTransform', '1 0 0 1 0 0')
            page_name = page.get('Name', '1')
            if not gb:
                continue

            bounds = [float(x) for x in gb.split()]
            transform = [float(x) for x in it.split()]
            page_top, page_left, page_bottom, page_right = bounds
            page_w = page_right - page_left
            page_h = page_bottom - page_top
            it_tx = transform[4]
            it_ty = transform[5]
            y_offset = -it_ty - page_top

            self.page_width = page_w
            self.page_height = page_h

            # Offsets para convertir coordenadas spread → page-local
            # spread_point → page_local = spread_point - page_origin_in_spread
            x_offset = -it_tx - page_left
            y_offset = -it_ty - page_top

            page_info = {
                'name': page_name,
                'width': page_w, 'height': page_h,
                'gb_top': page_top, 'gb_left': page_left,
                'it_tx': it_tx, 'it_ty': it_ty,
                'x_offset': x_offset,
                'y_offset': y_offset,
                'page_num': len(self.pages),
            }
            self.pages.append(page_info)

        # Parsear objetos del spread (hijos directos, incluyendo Groups)
        if len(self.pages) == 0:
            return

        page_info = self.pages[-1]
        identity: List[float] = [1.0, 0.0, 0.0, 1.0, 0.0, 0.0]
        self._parse_children(spread, page_info, identity)

    def _parse_children(self, parent: ET.Element, page_info: dict, parent_transform: List[float]):
        """Parsea recursivamente los hijos de un elemento (spread o group)."""
        for child in parent:
            tag = child.tag
            if tag == 'Page':
                continue

            if tag == 'Group':
                group_transform = self._parse_transform(child)
                combined = self._compose_transforms(parent_transform, group_transform)
                self._parse_children(child, page_info, combined)
            elif tag == 'TextFrame':
                self._parse_text_frame(child, page_info, parent_transform)
            elif tag == 'Rectangle':
                self._parse_rectangle(child, page_info, parent_transform)
            elif tag == 'Polygon':
                self._parse_polygon(child, page_info, parent_transform)
            elif tag == 'GraphicLine':
                self._parse_line(child, page_info, parent_transform)
            elif tag == 'Oval':
                # Treat ovals as rectangles (bounding box)
                self._parse_rectangle(child, page_info, parent_transform)

    def _compute_position(self, element: ET.Element, page_info: dict,
                          parent_transform: List[float]) -> Optional[dict]:
        """Calcula posición, tamaño y atributos comunes de un elemento.
        
        Transforma las 4 esquinas del path para manejar correctamente
        flips (scale negativo), rotaciones y transformaciones complejas.
        """
        bounds = self._extract_bounds_from_path(element)
        if not bounds:
            return None

        min_x, min_y, max_x, max_y = bounds

        item_transform = self._parse_transform(element)
        combined = self._compose_transforms(parent_transform, item_transform)

        # Transformar las 4 esquinas para obtener el bounding box real
        corners = [
            (min_x, min_y), (max_x, min_y),
            (min_x, max_y), (max_x, max_y),
        ]
        transformed = [self._apply_transform(cx, cy, combined) for cx, cy in corners]
        tx_min = min(c[0] for c in transformed)
        ty_min = min(c[1] for c in transformed)
        tx_max = max(c[0] for c in transformed)
        ty_max = max(c[1] for c in transformed)

        w = tx_max - tx_min
        h = ty_max - ty_min

        page_local_x = tx_min + page_info['x_offset']
        page_local_y = ty_min + page_info['y_offset']

        # Extraer rotación del transform compuesto (para Scribus ROT)
        a, b = combined[0], combined[1]
        rotation_deg = math.degrees(math.atan2(b, a))
        # Normalizar: Scribus espera rotación en grados, sentido horario
        if abs(rotation_deg) < 0.01:
            rotation_deg = 0

        # Label (nombre del frame)
        label = self._get_label(element)
        anname = label if label else element.get('Self', '')
        has_label = True if label else False

        # Text wrap
        twp = element.find('TextWrapPreference')
        textwrap_mode = 0
        textwrap_offset = [0, 0, 0, 0]  # top, left, bottom, right
        if twp is not None:
            tw_mode_str = twp.get('TextWrapMode', 'None')
            textwrap_mode = self.TEXTWRAP_MAP.get(tw_mode_str, 0)
            # Offset puede estar como atributo o dentro de Properties
            tw_props = twp.find('Properties')
            if tw_props is not None:
                tw_off_el = tw_props.find('TextWrapOffset')
                if tw_off_el is not None:
                    top = tw_off_el.get('Top', '0')
                    left = tw_off_el.get('Left', '0')
                    bottom = tw_off_el.get('Bottom', '0')
                    right = tw_off_el.get('Right', '0')
                    try:
                        textwrap_offset = [float(top), float(left), float(bottom), float(right)]
                    except ValueError:
                        pass

        return {
            'self': element.get('Self', ''),
            'anname': anname,
            'has_label': has_label,
            'x': page_local_x,
            'y': page_local_y,
            'w': w,
            'h': h,
            'rotation': rotation_deg,
            'page': page_info['page_num'],
            'textwrap_mode': textwrap_mode,
            'textwrap_offset': textwrap_offset,
        }

    def _parse_text_frame(self, tf: ET.Element, page_info: dict, parent_transform: List[float]):
        """Parsea un TextFrame."""
        pos = self._compute_position(tf, page_info, parent_transform)
        if not pos:
            return

        story_id = tf.get('ParentStory', '')
        prev_tf = tf.get('PreviousTextFrame', 'n')
        next_tf = tf.get('NextTextFrame', 'n')

        # Columnas y gap: primero del TextFrame directo, luego de TextFramePreference
        cols = tf.get('TextColumnCount', '1')
        col_gap = tf.get('TextColumnGutter', '12')

        # TextFramePreference contiene la info real de columnas en muchos IDMLs
        tfp = tf.find('TextFramePreference')
        if tfp is not None:
            tfp_cols = tfp.get('TextColumnCount', '')
            tfp_gap = tfp.get('TextColumnGutter', '')
            if tfp_cols:
                cols = tfp_cols
            if tfp_gap:
                col_gap = tfp_gap

        # Text insets: primero del TextFrame, luego de TextFramePreference
        inset_top = tf.get('TopInset', '0')
        inset_left = tf.get('LeftInset', '0')
        inset_bottom = tf.get('BottomInset', '0')
        inset_right = tf.get('RightInset', '0')

        if tfp is not None:
            # TextFramePreference puede tener InsetSpacing
            tfp_inset_top = tfp.get('TopInset', '')
            tfp_inset_left = tfp.get('LeftInset', '')
            tfp_inset_bottom = tfp.get('BottomInset', '')
            tfp_inset_right = tfp.get('RightInset', '')
            if tfp_inset_top:
                inset_top = tfp_inset_top
            if tfp_inset_left:
                inset_left = tfp_inset_left
            if tfp_inset_bottom:
                inset_bottom = tfp_inset_bottom
            if tfp_inset_right:
                inset_right = tfp_inset_right

        # Properties/InsetSpacing override (legacy format)
        props = tf.find('Properties')
        if props is not None:
            inset_el = props.find('InsetSpacing')
            if inset_el is not None:
                vals = (inset_el.text or "").strip().split()
                if len(vals) >= 4:
                    inset_top = vals[0]
                    inset_left = vals[1]
                    inset_bottom = vals[2]
                    inset_right = vals[3]

        pos.update({
            'type': 'text',
            'story': story_id,
            'prev': prev_tf if prev_tf != 'n' else None,
            'next': next_tf if next_tf != 'n' else None,
            'columns': int(cols) if cols else 1,
            'col_gap': col_gap,
            'inset_top': inset_top,
            'inset_left': inset_left,
            'inset_bottom': inset_bottom,
            'inset_right': inset_right,
        })
        self.page_objects.append(pos)

    def _parse_rectangle(self, rect: ET.Element, page_info: dict, parent_transform: List[float]):
        """Parsea un Rectangle (puede ser color, imagen, o vacío)."""
        pos = self._compute_position(rect, page_info, parent_transform)
        if not pos:
            return

        visible = rect.get('Visible', 'true')
        if visible == 'false':
            return

        fill_color = rect.get('FillColor', 'Color/Paper')
        fill_tint = rect.get('FillTint', '100')
        stroke_color = rect.get('StrokeColor', 'None')
        stroke_weight = rect.get('StrokeWeight', '0')

        # ¿Tiene una imagen?
        image = rect.find('.//Image')
        if image is not None:
            link = image.find('.//Link')
            link_uri = ''
            if link is not None:
                link_uri = link.get('LinkResourceURI', '')
                # Convertir URI a nombre de archivo
                link_uri = os.path.basename(link_uri.replace('%20', ' '))

            pos.update({
                'type': 'image',
                'fill_color': fill_color,
                'fill_tint': fill_tint,
                'image_file': link_uri,
            })
        else:
            pos.update({
                'type': 'rect',
                'fill_color': fill_color,
                'fill_tint': fill_tint,
                'stroke_color': stroke_color,
                'stroke_weight': stroke_weight,
            })
        self.page_objects.append(pos)

    def _parse_polygon(self, poly: ET.Element, page_info: dict, parent_transform: List[float]):
        """Parsea un Polygon (similar a Rectangle)."""
        pos = self._compute_position(poly, page_info, parent_transform)
        if not pos:
            return

        visible = poly.get('Visible', 'true')
        if visible == 'false':
            return

        fill_color = poly.get('FillColor', 'Color/Paper')
        fill_tint = poly.get('FillTint', '100')
        stroke_color = poly.get('StrokeColor', 'None')
        stroke_weight = poly.get('StrokeWeight', '0')

        pos.update({
            'type': 'rect',  # Polygon → PTYPE=6 in SLA
            'fill_color': fill_color,
            'fill_tint': fill_tint,
            'stroke_color': stroke_color,
            'stroke_weight': stroke_weight,
        })
        self.page_objects.append(pos)

    def _parse_line(self, line: ET.Element, page_info: dict, parent_transform: List[float]):
        """Parsea un GraphicLine."""
        pos = self._compute_position(line, page_info, parent_transform)
        if not pos:
            return

        pos['h'] = max(pos['h'], 0.001)
        stroke_color = line.get('StrokeColor', 'Color/Black')
        stroke_weight = line.get('StrokeWeight', '1')

        pos.update({
            'type': 'line',
            'stroke_color': stroke_color,
            'stroke_weight': stroke_weight,
        })
        self.page_objects.append(pos)

    # ── SLA Generation ──────────────────────────────────────────────────

    def _color_ref_to_name(self, color_ref: str) -> str:
        """Convierte referencia IDML 'Color/X' al nombre del color."""
        if not color_ref or color_ref == 'None':
            return 'None'
        if color_ref in self.colors:
            return self.colors[color_ref]['name']
        name = color_ref.replace('Color/', '')
        return name if name else 'None'

    def _idml_align_to_sla(self, justification: str) -> int:
        mapping = {
            'LeftAlign': 0, 'CenterAlign': 1, 'RightAlign': 2,
            'LeftJustified': 3, 'CenterJustified': 3,
            'RightJustified': 3, 'FullyJustified': 3,
        }
        return mapping.get(justification, 0)

    def _scribus_font_name(self, font: str, font_style: str) -> str:
        if not font:
            return self.DEFAULT_STYLE_FONT
        font = font.strip()
        style = font_style.strip() if font_style else 'Regular'
        if not style:
            style = 'Regular'
        # Normalizar estilo (Roman→Regular, etc.)
        style = self.FONT_STYLE_MAP.get(style, style)
        return f"{font} {style}"

    def _generate_sla(self) -> str:
        """Genera el XML SLA completo."""
        parts = []
        parts.append('<?xml version="1.0" encoding="UTF-8"?>')
        parts.append('<SCRIBUSUTF8NEW Version="1.6.5">')

        pagexpos = self.scratch_left
        pageypos = self.scratch_top

        parts.append(
            f'    <DOCUMENT ANZPAGES="{len(self.pages) or 1}" '
            f'PAGEWIDTH="{self.page_width}" PAGEHEIGHT="{self.page_height}" '
            f'BORDERLEFT="28.35" BORDERRIGHT="28.35" BORDERTOP="28.35" BORDERBOTTOM="42.55" '
            f'PRESET="0" BleedTop="0" BleedLeft="0" BleedRight="0" BleedBottom="0" '
            f'ORIENTATION="0" PAGESIZE="Custom" FIRSTNUM="1" '
            f'AUTOSPALTEN="1" ABSTSPALTEN="14.15" UNITS="1" '
            f'DFONT="{self.DEFAULT_STYLE_FONT}" DSIZE="12" DCOL="1" DGAP="0" '
            f'TextDistLeft="0" TextDistRight="0" TextDistBottom="0" TextDistTop="0" '
            f'ScratchBottom="20.001" ScratchLeft="{self.scratch_left}" '
            f'ScratchRight="100.001" ScratchTop="{self.scratch_top}" '
            f'LANGUAGE="es_ES" ALAYER="1" HYPHENATION="1" HyphenChar="45">'
        )

        parts.append(self._generate_colors())
        parts.append(self._generate_styles())

        parts.append(
            '        <LAYERS NUMMER="1" LEVEL="0" NAME="Layer 1" SICHTBAR="1" '
            'DRUCKEN="1" EDIT="1" SELECT="0" FLOW="1" TRANS="1" BLEND="0" '
            'OUTL="0" LAYERC="#000000"/>'
        )

        # Pages
        for i, page in enumerate(self.pages):
            px = pagexpos
            py = pageypos + i * (page['height'] + 40)
            parts.append(
                f'        <PAGE NUM="{i}" '
                f'PAGEXPOS="{px}" PAGEYPOS="{py}" '
                f'PAGEWIDTH="{page["width"]}" PAGEHEIGHT="{page["height"]}"/>'
            )

        # Assign ItemIDs
        item_id_counter = 1000
        obj_item_ids = {}
        for obj in self.page_objects:
            obj_item_ids[obj['self']] = item_id_counter
            item_id_counter += 1

        # Emit objects in natural IDML order (Z-order)
        for obj in self.page_objects:
            page_idx = obj['page']
            px = pagexpos
            py = pageypos + page_idx * (self.page_height + 40)
            sla_x = obj['x'] + px
            sla_y = obj['y'] + py
            obj_iid = obj_item_ids[obj['self']]

            tw_mode = obj.get('textwrap_mode', 0)
            rot = obj.get('rotation', 0)
            rot_attr = f' ROT="{rot:.2f}"' if abs(rot) > 0.01 else ''

            if obj['type'] == 'rect':
                fill_name = self._color_ref_to_name(obj.get('fill_color', ''))
                tint = obj.get('fill_tint', '100')
                stroke_name = self._color_ref_to_name(obj.get('stroke_color', ''))
                sw = obj.get('stroke_weight', '0')

                pcolor = self._esc(fill_name) if fill_name not in ('None', '$ID/') else 'None'
                if fill_name == 'Paper':
                    pcolor = 'White'

                path = f"M0 0 L0 {obj['h']:.3f} L{obj['w']:.3f} {obj['h']:.3f} L{obj['w']:.3f} 0 L0 0 Z"
                tw_off = obj.get('textwrap_offset', [0, 0, 0, 0])
                tw_attrs = f' EXTRA="{tw_off[1]}" TEXTRA="{tw_off[0]}" BEXTRA="{tw_off[2]}" REXTRA="{tw_off[3]}"' if tw_mode != 0 else ''

                parts.append(
                    f'        <PAGEOBJECT XPOS="{sla_x}" YPOS="{sla_y}" '
                    f'OwnPage="{page_idx}" ItemID="{obj_iid}" '
                    f'PTYPE="6" WIDTH="{obj["w"]}" HEIGHT="{obj["h"]}"{rot_attr} '
                    f'FRTYPE="3" CLIPEDIT="1" PWIDTH="{sw}" '
                    f'PCOLOR="{pcolor}" SHADE="{tint}" '
                    f'PCOLOR2="{self._esc(stroke_name)}" '
                    f'PLINEART="1" ANNAME="{self._esc(obj["anname"])}" '
                    f'TEXTFLOWMODE="{tw_mode}"{tw_attrs} '
                    f'path="{path}" copath="{path}" fillRule="0" '
                    f'gXpos="{sla_x}" gYpos="{sla_y}" gWidth="0" gHeight="0" '
                    f'LAYER="1">'
                )
                if obj.get('has_label'):
                    parts.append(f'            <Attributes NAME="HasScriptTag" VALUE="1" TYPE="String" PARAM="" EVENT="0" RELATION="0" RELATIONNAME="" />')
                parts.append('        </PAGEOBJECT>')

            elif obj['type'] == 'line':
                stroke_name = self._color_ref_to_name(obj.get('stroke_color', ''))
                sw = obj.get('stroke_weight', '1')
                path = f"M{obj['w']:.3f} 0 L0 0 "
                tw_off = obj.get('textwrap_offset', [0, 0, 0, 0])
                tw_attrs = f' EXTRA="{tw_off[1]}" TEXTRA="{tw_off[0]}" BEXTRA="{tw_off[2]}" REXTRA="{tw_off[3]}"' if tw_mode != 0 else ''

                parts.append(
                    f'        <PAGEOBJECT XPOS="{sla_x}" YPOS="{sla_y}" '
                    f'OwnPage="{page_idx}" ItemID="{obj_iid}" '
                    f'PTYPE="7" WIDTH="{obj["w"]}" HEIGHT="{obj["h"]}"{rot_attr} '
                    f'FRTYPE="3" CLIPEDIT="1" PWIDTH="{sw}" '
                    f'PCOLOR="None" PCOLOR2="{self._esc(stroke_name)}" '
                    f'PLINEART="1" ANNAME="{self._esc(obj["anname"])}" '
                    f'TEXTFLOWMODE="{tw_mode}"{tw_attrs} '
                    f'path="{path}" copath="{path}" fillRule="0" '
                    f'gXpos="{sla_x}" gYpos="{sla_y}" gWidth="0" gHeight="0" '
                    f'LAYER="1">'
                )
                if obj.get('has_label'):
                    parts.append(f'            <Attributes NAME="HasScriptTag" VALUE="1" TYPE="String" PARAM="" EVENT="0" RELATION="0" RELATIONNAME="" />')
                parts.append('        </PAGEOBJECT>')

            elif obj['type'] == 'image':
                fill_name = self._color_ref_to_name(obj.get('fill_color', ''))
                pcolor = self._esc(fill_name) if fill_name not in ('None', '$ID/') else 'None'
                if fill_name == 'Paper':
                    pcolor = 'White'
                tint = obj.get('fill_tint', '100')
                img_file = obj.get('image_file', '')

                path = f"M0 0 L0 {obj['h']:.3f} L{obj['w']:.3f} {obj['h']:.3f} L{obj['w']:.3f} 0 L0 0 Z"
                tw_off = obj.get('textwrap_offset', [0, 0, 0, 0])
                tw_attrs = f' EXTRA="{tw_off[1]}" TEXTRA="{tw_off[0]}" BEXTRA="{tw_off[2]}" REXTRA="{tw_off[3]}"' if tw_mode != 0 else ''

                parts.append(
                    f'        <PAGEOBJECT XPOS="{sla_x}" YPOS="{sla_y}" '
                    f'OwnPage="{page_idx}" ItemID="{obj_iid}" '
                    f'PTYPE="2" WIDTH="{obj["w"]}" HEIGHT="{obj["h"]}"{rot_attr} '
                    f'FRTYPE="0" CLIPEDIT="0" PWIDTH="0" '
                    f'PCOLOR="{pcolor}" SHADE="{tint}" '
                    f'PLINEART="1" ANNAME="{self._esc(obj["anname"])}" '
                    f'TEXTFLOWMODE="{tw_mode}"{tw_attrs} '
                    f'LOCALSCX="1" LOCALSCY="1" LOCALX="0" LOCALY="0" LOCALROT="0" '
                    f'PICART="1" SCALETYPE="1" RATIO="1" '
                    f'PFILE="{self._esc(img_file)}" '
                    f'path="{path}" copath="{path}" fillRule="0" '
                    f'gXpos="{sla_x}" gYpos="{sla_y}" gWidth="0" gHeight="0" '
                    f'LAYER="1">'
                )
                if obj.get('has_label'):
                    parts.append(f'            <Attributes NAME="HasScriptTag" VALUE="1" TYPE="String" PARAM="" EVENT="0" RELATION="0" RELATIONNAME="" />')
                parts.append('        </PAGEOBJECT>')

            elif obj['type'] == 'text':
                # Threading
                next_item = '-1'
                back_item = '-1'
                if obj.get('next') and obj['next'] in obj_item_ids:
                    next_item = str(obj_item_ids[obj['next']])
                if obj.get('prev') and obj['prev'] in obj_item_ids:
                    back_item = str(obj_item_ids[obj['prev']])

                path = f"M0 0 L0 {obj['h']:.3f} L{obj['w']:.3f} {obj['h']:.3f} L{obj['w']:.3f} 0 L0 0 Z"
                col_gap = obj.get('col_gap', '11.024')
                inset_t = obj.get('inset_top', '0')
                inset_l = obj.get('inset_left', '0')
                inset_b = obj.get('inset_bottom', '0')
                inset_r = obj.get('inset_right', '0')

                tw_off = obj.get('textwrap_offset', [0, 0, 0, 0])
                # Para marcos de texto, si tiene textwrap activo, usamos eso. Si no, usamos insets internos.
                if tw_mode != 0:
                    ex, tx, bx, rx = tw_off[1], tw_off[0], tw_off[2], tw_off[3]
                else:
                    ex, tx, bx, rx = inset_l, inset_t, inset_b, inset_r

                parts.append(
                    f'        <PAGEOBJECT XPOS="{sla_x}" YPOS="{sla_y}" '
                    f'OwnPage="{page_idx}" ItemID="{obj_iid}" '
                    f'PTYPE="4" WIDTH="{obj["w"]}" HEIGHT="{obj["h"]}"{rot_attr} '
                    f'FRTYPE="3" CLIPEDIT="1" PWIDTH="0" PLINEART="1" '
                    f'ANNAME="{self._esc(obj["anname"])}" '
                    f'TEXTFLOWMODE="{tw_mode}" '
                    f'LOCALSCX="1" LOCALSCY="1" LOCALX="0" LOCALY="0" LOCALROT="0" '
                    f'PICART="1" SCALETYPE="1" RATIO="1" '
                    f'COLUMNS="{obj.get("columns", 1)}" COLGAP="{col_gap}" '
                    f'AUTOTEXT="0" EXTRA="{ex}" TEXTRA="{tx}" '
                    f'BEXTRA="{bx}" REXTRA="{rx}" '
                    f'VAlign="0" FLOP="1" '
                    f'path="{path}" copath="{path}" fillRule="0" '
                    f'gXpos="{sla_x}" gYpos="{sla_y}" gWidth="0" gHeight="0" '
                    f'LAYER="1" NEXTITEM="{next_item}" BACKITEM="{back_item}">'
                )
                if obj.get('has_label'):
                    parts.append(f'            <Attributes NAME="HasScriptTag" VALUE="1" TYPE="String" PARAM="" EVENT="0" RELATION="0" RELATIONNAME="" />')

                # Story text (solo en el primer frame de la cadena)
                if obj.get('prev') is None:
                    story_xml = self._generate_story_text(obj.get('story', ''))
                    if story_xml:
                        parts.append(story_xml)

                parts.append('        </PAGEOBJECT>')

        parts.append('    </DOCUMENT>')
        parts.append('</SCRIBUSUTF8NEW>')

        return '\n'.join(parts)

    def _generate_colors(self) -> str:
        parts = []
        parts.append('        <COLOR NAME="Black" SPACE="CMYK" C="0" M="0" Y="0" K="100"/>')
        parts.append('        <COLOR NAME="White" SPACE="CMYK" C="0" M="0" Y="0" K="0"/>')
        parts.append('        <COLOR NAME="Registration" SPACE="CMYK" C="100" M="100" Y="100" K="100" Register="1"/>')

        seen = {'Black', 'White', 'Registration'}
        for color_id, color in self.colors.items():
            name = color.get('name', '')
            if not name or name in seen or name.startswith('$ID/'):
                continue
            seen.add(name)
            if color['space'] == 'CMYK':
                parts.append(
                    f'        <COLOR NAME="{self._esc(name)}" SPACE="CMYK" '
                    f'C="{color["c"]}" M="{color["m"]}" '
                    f'Y="{color["y"]}" K="{color["k"]}"/>'
                )
            elif color['space'] == 'RGB':
                r = int(color['r'] * 255 / 100) if color['r'] <= 100 else int(color['r'])
                g = int(color['g'] * 255 / 100) if color['g'] <= 100 else int(color['g'])
                b = int(color['b'] * 255 / 100) if color['b'] <= 100 else int(color['b'])
                parts.append(
                    f'        <COLOR NAME="{self._esc(name)}" SPACE="sRGB" '
                    f'R="{r}" G="{g}" B="{b}"/>'
                )
        return '\n'.join(parts)

    def _generate_styles(self) -> str:
        parts = []

        # Default charstyle — usar fuente por defecto del documento
        df = self.DEFAULT_STYLE_FONT
        parts.append(
            f'        <CHARSTYLE CNAME="Default Character Style" DefaultStyle="1" '
            f'FONT="{df}" FONTSIZE="12" FEATURES="inherit" '
            f'FCOLOR="Black" FSHADE="100" LANGUAGE="es_ES"/>'
        )

        for cs_id, cs in self.char_styles.items():
            name = cs['name']
            if not name or name == '[No character style]':
                continue
            font = self._scribus_font_name(cs['font'], cs['font_style'])
            size = cs.get('point_size', '')
            color = self._color_ref_to_name(cs.get('fill_color', ''))
            attrs = f'CNAME="{self._esc(name)}" CPARENT="Default Character Style"'
            attrs += f' FONT="{self._esc(font)}"'
            if size:
                attrs += f' FONTSIZE="{size}"'
            attrs += ' FEATURES="inherit"'
            if color and color not in ('None', '$ID/'):
                attrs += f' FCOLOR="{self._esc(color)}"'
            parts.append(f'        <CHARSTYLE {attrs}/>')

        # Default paragraph styles — usar la fuente por defecto del documento
        df = self.DEFAULT_STYLE_FONT
        parts.append(
            f'        <STYLE NAME="Default Paragraph Style" DefaultStyle="1" '
            f'ALIGN="0" LINESPMode="0" LINESP="15" INDENT="0" RMARGIN="0" '
            f'FIRST="0" VOR="0" NACH="0" DROP="0" DROPLIN="0" '
            f'FONT="{df}" FONTSIZE="12" FEATURES="inherit" FCOLOR="Black" '
            f'LANGUAGE="es_ES" HYPHENATION="1" HyphenChar="45"/>'
        )
        parts.append(
            f'        <STYLE NAME="[No paragraph style]" PARENT="Default Paragraph Style" '
            f'ALIGN="0" LINESPMode="1" INDENT="0" RMARGIN="0" FIRST="0" '
            f'VOR="0" NACH="0" DROP="0" DROPLIN="0" '
            f'FONT="{df}" FONTSIZE="12" FEATURES="inherit" FCOLOR="Black" '
            f'LANGUAGE="es_ES" HYPHENATION="1" HyphenChar="45"/>'
        )
        parts.append(
            f'        <STYLE NAME="NormalParagraphStyle" PARENT="[No paragraph style]" '
            f'LINESPMode="1" FONT="{df}" FEATURES="inherit" '
            f'LANGUAGE="es_ES" HYPHENATION="1" HyphenChar="45"/>'
        )

        for ps_id, ps in self.para_styles.items():
            name = ps['name']
            if not name or name in ('[No paragraph style]', 'NormalParagraphStyle',
                                     'Default Paragraph Style'):
                continue

            font = self._scribus_font_name(ps['font'], ps['font_style'])
            size = ps.get('point_size', '12') or '12'
            align = self._idml_align_to_sla(ps.get('justification', ''))
            leading = ps.get('leading')
            color = self._color_ref_to_name(ps.get('fill_color', ''))
            first_indent = ps.get('first_indent', '0')
            left_indent = ps.get('left_indent', '0')
            right_indent = ps.get('right_indent', '0')
            space_before = ps.get('space_before', '0')
            space_after = ps.get('space_after', '0')
            drop_cap_lines = ps.get('drop_cap_lines', '0')

            attrs = f'NAME="{self._esc(name)}" PARENT="[No paragraph style]"'
            attrs += f' ALIGN="{align}"'

            if leading:
                attrs += f' LINESPMode="0" LINESP="{leading}"'
            else:
                attrs += ' LINESPMode="1"'

            if first_indent and first_indent != '0':
                attrs += f' FIRST="{first_indent}"'
            if left_indent and left_indent != '0':
                attrs += f' INDENT="{left_indent}"'
            if right_indent and right_indent != '0':
                attrs += f' RMARGIN="{right_indent}"'
            if space_before and space_before != '0':
                attrs += f' VOR="{space_before}"'
            if space_after and space_after != '0':
                attrs += f' NACH="{space_after}"'
            if drop_cap_lines and drop_cap_lines != '0':
                try:
                    dcl = int(float(drop_cap_lines))
                    if dcl > 0:
                        attrs += f' DROP="1" DROPLIN="{dcl}"'
                except ValueError:
                    pass

            # Capitalization: AllCaps, SmallCaps → FEATURES
            cap = ps.get('capitalization', 'Normal')
            features = 'inherit'
            if cap == 'AllCaps':
                features = 'allcaps'
            elif cap == 'SmallCaps':
                features = 'smallcaps'

            attrs += f' FONT="{self._esc(font)}" FONTSIZE="{size}" FEATURES="{features}"'
            attrs += ' LANGUAGE="es_ES"'

            # Tracking (letter-spacing) → TXTULP en Scribus (unidades: 1/10 pt)
            tracking = ps.get('tracking', '0')
            if tracking and tracking != '0':
                try:
                    # IDML tracking in 1/1000 em; Scribus TXTULP is percentage offset
                    # Convert: IDML -20 → approximately -2% letter spacing
                    track_val = float(tracking) / 10.0
                    attrs += f' TXTULP="{track_val:.1f}"'
                except ValueError:
                    pass

            # Hyphenation (InDesign default = true)
            hyph = ps.get('hyphenation', 'true')
            if hyph == 'true':
                attrs += ' HYPHENATION="1" HyphenChar="45"'
            else:
                attrs += ' HYPHENATION="0"'

            if color and color not in ('None', 'Paper', '$ID/'):
                attrs += f' FCOLOR="{self._esc(color)}" FSHADE="100"'

            parts.append(f'        <STYLE {attrs}/>')

        return '\n'.join(parts)

    def _resolve_font_for_csr(self, csr: ET.Element, para_style_id: str) -> Tuple[str, str]:
        """Resuelve FONT y FONTSIZE para un CharacterStyleRange.

        Prioridad: CSR inline → CharacterStyle → ParagraphStyle → Default.
        Retorna (font_scribus_name, font_size).
        """
        # 1) Inline font del CharacterStyleRange
        inline_font = ''
        csr_props = csr.find('Properties')
        if csr_props is not None:
            af = csr_props.find('AppliedFont')
            if af is not None:
                inline_font = (af.text or "").strip()
        inline_font_style = csr.get('FontStyle', '')
        inline_size = csr.get('PointSize', '')

        # 2) CharacterStyle referenciado
        applied_cs = csr.get('AppliedCharacterStyle', '')
        cs = self.char_styles.get(applied_cs, {})
        cs_font = cs.get('font', '')
        cs_font_style = cs.get('font_style', '')
        cs_size = cs.get('point_size', '')

        # 3) ParagraphStyle del párrafo actual
        ps = self.para_styles.get(para_style_id, {})
        ps_font = ps.get('font', '')
        ps_font_style = ps.get('font_style', 'Regular')
        ps_size = ps.get('point_size', '12') or '12'

        # Resolver font: inline > charStyle > paraStyle > default
        if inline_font:
            # Si inline tiene font, usar su font_style; si no, intentar charStyle o paraStyle
            style = inline_font_style or cs_font_style or ps_font_style or 'Regular'
            resolved_font = self._scribus_font_name(inline_font, style)
        elif cs_font:
            style = cs_font_style or 'Regular'
            resolved_font = self._scribus_font_name(cs_font, style)
        elif ps_font:
            resolved_font = self._scribus_font_name(ps_font, ps_font_style)
        else:
            resolved_font = self.DEFAULT_STYLE_FONT

        # Resolver size: inline > charStyle > paraStyle
        resolved_size = inline_size or cs_size or ps_size

        return resolved_font, resolved_size

    def _generate_story_text(self, story_id: str) -> Optional[str]:
        """Genera el bloque <StoryText> SLA a partir de un Story IDML.

        Cada <ITEXT> siempre lleva FONT y FONTSIZE explícitos para evitar
        que Scribus herede la fuente del fragmento anterior (ej: ZapfDingbats
        propagándose al texto regular).
        """
        story = self.stories.get(story_id)
        if story is None:
            return None

        parts = []
        parts.append('            <StoryText>')
        parts.append('                <DefaultStyle/>')

        last_was_break = True # Evitar break antes del primer ITEXT
        first_psr = True

        for psr in story.iter('ParagraphStyleRange'):
            applied_ps = psr.get('AppliedParagraphStyle', '')
            ps_name = applied_ps.replace('ParagraphStyle/', '').replace('$ID/', '')

            # Si es un INTERTITULO y no es el primero del story, asegurar línea en blanco antes
            if not first_psr and "INTER" in ps_name.upper():
                parts.append(f'                <para PARENT="{self._esc(ps_name)}"/>')
                last_was_break = True

            first_psr = False

            for csr in psr.iter('CharacterStyleRange'):
                applied_cs = csr.get('AppliedCharacterStyle', '')
                cs_name = applied_cs.replace('CharacterStyle/', '').replace('$ID/', '')

                # Resolver font y size para este fragmento (CSR→CharStyle→ParaStyle)
                resolved_font, resolved_size = self._resolve_font_for_csr(csr, applied_ps)

                inline_color = csr.get('FillColor', '')

                for content_node in csr:
                    if content_node.tag == 'Content':
                        text = content_node.text or ''
                        if not text:
                            continue

                        # Dividir por \r para detectar saltos de párrafo literales en IDML
                        # Cada \r equivale a cerrar un párrafo en Scribus (<para/>)
                        lines = text.split('\r')
                        for j, line in enumerate(lines):
                            if j > 0:
                                # Hemos encontrado un \r: cerrar párrafo con estilo actual
                                parts.append(f'                <para PARENT="{self._esc(ps_name)}"/>')
                                last_was_break = True
                            
                            if not line:
                                continue

                            # Si hay texto, ya no estamos en un break
                            last_was_break = False
                            
                            text_esc = self._esc(line)
                            itext_attrs = f'CH="{text_esc}"'

                            # SIEMPRE poner FONT, FONTSIZE y LANGUAGE explícitos
                            itext_attrs += f' FONT="{self._esc(resolved_font)}"'
                            itext_attrs += f' FONTSIZE="{resolved_size}"'
                            itext_attrs += ' FEATURES="inherit" LANGUAGE="es_ES"'

                            if inline_color:
                                color_name = self._color_ref_to_name(inline_color)
                                if color_name and color_name not in ('None', '$ID/'):
                                    itext_attrs += f' FCOLOR="{self._esc(color_name)}"'

                            if cs_name and cs_name != '[No character style]':
                                itext_attrs += f' CSTYLE="{self._esc(cs_name)}"'

                            parts.append(f'                <ITEXT {itext_attrs}/>')

                    elif content_node.tag == 'Br':
                        # Explicit soft-break or forced-break in IDML -> <para/>
                        parts.append(f'                <para PARENT="{self._esc(ps_name)}"/>')
                        last_was_break = True

            # Al final de un ParagraphStyleRange, si el contenido no terminó en break (\r o Br),
            # cerramos el párrafo con el estilo de este PSR para asegurar que se aplique bien.
            if not last_was_break:
                parts.append(f'                <para PARENT="{self._esc(ps_name)}"/>')
                last_was_break = True

        parts.append('            </StoryText>')
        return '\n'.join(parts)


def convert_idml_to_sla(idml_path: str, output_sla: str) -> str:
    """Función de conveniencia para convertir IDML a SLA."""
    converter = IDMLToSLAConverter(idml_path)
    return converter.convert(output_sla)


if __name__ == '__main__':
    import sys
    logging.basicConfig(level=logging.INFO)

    if len(sys.argv) < 3:
        print("Usage: python idml_to_sla.py input.idml output.sla")
        sys.exit(1)

    result = convert_idml_to_sla(sys.argv[1], sys.argv[2])
    print(f"Conversión completada: {result}")
