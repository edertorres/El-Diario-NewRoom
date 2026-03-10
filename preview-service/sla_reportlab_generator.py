import xml.etree.ElementTree as ET
import os
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.platypus import Paragraph, Frame
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

class SLAReportLabGenerator:
    def __init__(self, sla_path, output_pdf, fonts_dir="Fonts"):
        self.sla_path = Path(sla_path)
        self.output_pdf = output_pdf
        self.fonts_dir = Path(fonts_dir)
        self.registered_fonts = {}
        self.font_to_family = {}
        
        # We need to parse metadata first to get page size
        self.tree = ET.parse(self.sla_path)
        self.root = self.tree.getroot()
        
        self.colors = {}
        self.doc_styles = {}
        
        # FIND DOCUMENT properties
        doc_node = self.root.find('DOCUMENT')
        if doc_node is not None:
             self.page_width = float(doc_node.get('PAGEWIDTH', 595))
             self.page_height = float(doc_node.get('PAGEHEIGHT', 842))
        else:
             self.page_width = 595
             self.page_height = 842

        self._parse_colors()
        self._register_fonts()
        self._parse_styles()

    def _parse_colors(self):
        """Extract all <COLOR> definitions from the SLA document."""
        for color_elem in self.root.findall(".//COLOR"):
            name = color_elem.get('NAME')
            space = color_elem.get('SPACE', 'RGB')
            try:
                if space == 'CMYK':
                    c = float(color_elem.get('C', 0)) / 100.0
                    m = float(color_elem.get('M', 0)) / 100.0
                    y = float(color_elem.get('Y', 0)) / 100.0
                    k = float(color_elem.get('K', 0)) / 100.0
                    self.colors[name] = colors.CMYKColor(c, m, y, k)
                else:
                    r = float(color_elem.get('R', 0)) / 255.0
                    g = float(color_elem.get('G', 0)) / 255.0
                    b = float(color_elem.get('B', 0)) / 255.0
                    self.colors[name] = colors.Color(r, g, b)
            except: pass
        # Standard defaults
        if "Black" not in self.colors: self.colors["Black"] = colors.black
        if "White" not in self.colors: self.colors["White"] = colors.white

    def _parse_styles(self):
        """Extract paragraph and character styles from the SLA document."""
        for style_elem in self.root.findall(".//STYLE"):
            name = style_elem.get('NAME')
            if not name: continue
            
            # Map Scribus alignment (0=Left, 1=Center, 2=Right, 3=Block/Justified)
            # ReportLab alignment (0=Left, 1=Center, 2=Right, 4=Justified)
            scr_align = int(style_elem.get('ALIGN', 0))
            rl_align = scr_align if scr_align < 3 else 4
            
            font = self._get_font_name(style_elem.get('FONT', 'Helvetica'))
            size = float(style_elem.get('FONTSIZE', 10))
            leading = float(style_elem.get('LINESP', size * 1.2))
            color_name = style_elem.get('FCOLOR', 'Black')
            color = self.colors.get(color_name, colors.black)
            
            # Create a style
            try:
                self.doc_styles[name] = ParagraphStyle(
                    name=name,
                    fontName=font,
                    fontSize=size,
                    leading=leading,
                    alignment=rl_align,
                    textColor=color,
                    leftIndent=float(style_elem.get('INDENT', 0)),
                    firstLineIndent=float(style_elem.get('FIRST', 0))
                )
            except: pass

        # Also parse CHARSTYLEs for character-level inheritance
        self.char_styles = {}
        for char_elem in self.root.findall(".//CHARSTYLE"):
            cname = char_elem.get('CNAME')
            if not cname: continue
            
            # Simplified character style map
            self.char_styles[cname] = {
                'font': char_elem.get('FONT'),
                'size': char_elem.get('FONTSIZE'),
                'color': char_elem.get('FCOLOR')
            }

    def _register_fonts(self):
        """Register all .otf and .ttf files and group them into families."""
        if not self.fonts_dir.exists():
            return
            
        temp_ttf_dir = self.fonts_dir / ".temp_ttf"
        temp_ttf_dir.mkdir(exist_ok=True)
        
        families = {}
            
        for font_file in self.fonts_dir.glob("*.[ot]tf"):
            try:
                font_name = font_file.stem
                final_font_path = str(font_file)
                
                # If it's an OTF, attempt to register. If it fails with PostScript error, convert.
                try:
                    pdfmetrics.registerFont(TTFont(font_name, final_font_path))
                except Exception as register_err:
                    if "postscript outlines" in str(register_err).lower():
                        ttf_path = temp_ttf_dir / f"{font_name}.ttf"
                        if not ttf_path.exists():
                            self._convert_otf_to_ttf(font_file, ttf_path)
                        
                        if ttf_path.exists():
                            final_font_path = str(ttf_path)
                            pdfmetrics.registerFont(TTFont(font_name, final_font_path))
                        else:
                            continue
                    else:
                        raise register_err

                # Map various clean versions of the name to the real name
                clean_name = font_name.replace("-", "").replace(" ", "").lower()
                self.registered_fonts[clean_name] = font_name
                self.registered_fonts[font_name.lower()] = font_name
                
                # Identify family and style
                parts = font_name.replace(" ", "-").split("-")
                family_base = parts[0].lower()
                style = "-".join(parts[1:]).lower() if len(parts) > 1 else "regular"
                
                self.font_to_family[font_name] = family_base
                
                if family_base not in families:
                    families[family_base] = {"regular": font_name}
                
                if "bold" in style and "italic" in style:
                    families[family_base]["boldItalic"] = font_name
                elif "bold" in style:
                    families[family_base]["bold"] = font_name
                elif "italic" in style:
                    families[family_base]["italic"] = font_name
                elif "regular" in style or "roman" in style:
                    families[family_base]["regular"] = font_name
                    
            except Exception as e:
                print(f"Error registering font {font_file}: {e}")

        # Register families and add explicit mappings to ps2tt
        for family_name, variants in families.items():
            try:
                reg_name = variants.get('regular')
                if not reg_name:
                    reg_name = next(iter(variants.values()))
                    variants['regular'] = reg_name
                
                if family_name not in self.registered_fonts:
                    self.registered_fonts[family_name] = reg_name
                
                addMapping(family_name, 0, 0, family_name)
                if variants.get('regular'): addMapping(family_name, 0, 0, variants['regular'])
                if variants.get('bold'): addMapping(family_name, 1, 0, variants['bold'])
                if variants.get('italic'): addMapping(family_name, 0, 1, variants['italic'])
                if variants.get('boldItalic'): addMapping(family_name, 1, 1, variants['boldItalic'])
                
                pdfmetrics.registerFontFamily(
                    family_name,
                    normal=variants.get('regular'),
                    bold=variants.get('bold'),
                    italic=variants.get('italic'),
                    boldItalic=variants.get('boldItalic')
                )
            except Exception:
                pass

    def _convert_otf_to_ttf(self, otf_path, ttf_path):
        """Conversion from OTF (CFF) to TTF (Glyf) using fontTools cu2qu."""
        from fontTools import ttLib
        from fontTools.pens.cu2quPen import Cu2QuPen
        from fontTools.pens.ttGlyphPen import TTGlyphPen
        
        try:
            font = ttLib.TTFont(otf_path)
            if font.sfntVersion != 'OTTO':
                font.save(ttf_path)
                return

            glyph_set = font.getGlyphSet()
            font.sfntVersion = "\x00\x01\x00\x00"
            
            glyphs = {}
            hmtx = {}
            for name in font.getGlyphOrder():
                otf_glyph = glyph_set[name]
                hmtx[name] = (otf_glyph.width, 0)
                
                tt_pen = TTGlyphPen(None)
                cu2qu_pen = Cu2QuPen(tt_pen, max_err=1, reverse_direction=True)
                otf_glyph.draw(cu2qu_pen)
                glyphs[name] = tt_pen.glyph()

            font['glyf'] = ttLib.newTable('glyf')
            font['glyf'].glyphs = glyphs
            font['loca'] = ttLib.newTable('loca')
            font['hmtx'] = ttLib.newTable('hmtx')
            font['hmtx'].metrics = hmtx
            
            for tag in ['CFF ', 'CFF2', 'VORG']:
                if tag in font: del font[tag]
            
            font['maxp'].tableVersion = 0x00010000
            font['maxp'].maxPoints = 0
            font['maxp'].maxContours = 0
            font['maxp'].maxCompositePoints = 0
            font['maxp'].maxCompositeContours = 0
            font['maxp'].maxZones = 2
            font['maxp'].maxTwilightPoints = 0
            font['maxp'].maxStorage = 0
            font['maxp'].maxFunctionDefs = 0
            font['maxp'].maxInstructionDefs = 0
            font['maxp'].maxStackElements = 0
            font['maxp'].maxSizeOfInstructions = 0
            font['maxp'].maxComponentElements = 0
            font['maxp'].maxComponentDepth = 0
            font['maxp'].maxSlots = len(glyphs)
            
            font.save(ttf_path)
        except Exception as e:
            print(f"Failed to convert {otf_path}: {e}")

    def _get_font_name(self, scribus_font):
        if not scribus_font: return "Helvetica"
        clean = scribus_font.replace(" ", "").replace("-", "").lower()
        if clean in self.registered_fonts:
            real = self.registered_fonts[clean]
            return self.font_to_family.get(real, real)
        
        # Fuzzy match for names like "Playfair Display ExtraBold" -> "playfairdisplayextrabold"
        # Try stripping common suffixes Scribus adds
        for suffix in ["Regular", "Roman", "Book", "Medium", "Bold", "Italic", "ExtraBold", "SemiBold"]:
            if clean.endswith(suffix.lower()):
                base = clean[:-len(suffix)]
                if base in self.registered_fonts:
                     real = self.registered_fonts[base]
                     return self.font_to_family.get(real, real)

        # Partial match
        for reg_clean, real_name in self.registered_fonts.items():
            if clean in reg_clean or reg_clean in clean:
                return self.font_to_family.get(real_name, real_name)
                
        # Last resort: just use first part of the name
        parts = scribus_font.split()
        if parts:
            first_part = parts[0].lower()
            if first_part in self.registered_fonts:
                return self.font_to_family.get(self.registered_fonts[first_part])

        return "Helvetica"

    def _get_color(self, color_name):
        return self.colors.get(color_name, colors.black)

    def generate(self):
        c = canvas.Canvas(self.output_pdf)
        all_objects = self.root.findall(".//PAGEOBJECT")
        pages = self.root.findall(".//PAGE")
        
        # 1. Build Layer Visibility Map
        layer_visible = {}
        for layer in self.root.findall(".//LAYERS"):
            num = layer.get('NUMMER')
            visible = layer.get('SICHTBAR', '1') == '1'
            layer_visible[num] = visible

        # 2. Build a map of all objects by ItemID
        self.item_map = {obj.get('ItemID'): obj for obj in all_objects if obj.get('ItemID')}
        
        # 3. Separate Master Page Objects (OwnPage="-1")
        master_objects = [obj for obj in all_objects if obj.get('OwnPage') == "-1"]
        
        # 4. Function to filter visible objects
        def get_visible(objs):
            return [obj for obj in objs if layer_visible.get(obj.get('LAYER'), True)]

        self.processed_items = set()
        
        if not pages:
            # Fallback for single-page documents
            c.setPageSize((self.page_width, self.page_height))
            valid_objs = get_visible([obj for obj in all_objects if int(obj.get('OwnPage', -1)) >= 0])
            # Render master objects first (as background)
            self._render_page_objects(get_visible(master_objects), c, 0, 0, self.page_height)
            self._render_page_objects(valid_objs, c, 0, 0, self.page_height)
            c.showPage()
        else:
            sorted_pages = sorted(pages, key=lambda p: int(p.get('NUM', 0)))
            for pg in sorted_pages:
                page_num = int(pg.get('NUM', 0))
                px = float(pg.get('PAGEXPOS', 0))
                py = float(pg.get('PAGEYPOS', 0))
                pw = float(pg.get('PAGEWIDTH', self.page_width))
                ph = float(pg.get('PAGEHEIGHT', self.page_height))
                
                c.setPageSize((pw, ph))
                
                # Fetch master page for this page
                master_name = pg.get('MNAM')
                page_master_objs = [obj for obj in master_objects if obj.get('PNAME') == master_name]
                
                page_objs = [obj for obj in all_objects if obj.get('OwnPage') == str(page_num)]
                
                print(f"Rendering Page {page_num} (Master: {master_name})...")
                # Reset processed items for master objects if you want them on every page 
                # (but threading across pages might get weird, keep it simple for now)
                self._render_page_objects(get_visible(page_master_objs), c, px, py, ph)
                self._render_page_objects(get_visible(page_objs), c, px, py, ph)
                c.showPage()
                
        c.save()

    def _render_page_objects(self, objects, c, px, py, ph):
        for obj in objects:
            item_id = obj.get('ItemID')
            if item_id in self.processed_items: continue
            
            ptype = obj.get('PTYPE')
            # Only process if it's a "head" of a chain or not threaded
            back_item = obj.get('BACKITEM', '-1')
            
            # If it's part of a chain but NOT the head, we skip and wait for the head
            if back_item != '-1' and back_item in self.item_map:
                continue
            
            self._render_single_or_chain(obj, c, px, py, ph)

    def _render_single_or_chain(self, obj, c, px, py, ph):
        ptype = obj.get('PTYPE')
        if ptype == "4": # Text
            chain = self._get_chain(obj)
            self._render_text_chain(chain, c, px, py, ph)
        elif ptype == "2": # Image/Rect
            self._render_box(obj, c, px, py, ph)
            self.processed_items.add(obj.get('ItemID'))
        elif ptype in ["6", "7"]: # Polygon or Line
            self._render_polygon(obj, c, px, py, ph)
            self.processed_items.add(obj.get('ItemID'))
        elif ptype == "12": # Group
            self.processed_items.add(obj.get('ItemID'))
            # Render children
            children = obj.findall("PAGEOBJECT")
            if children:
                # Groups in Scribus can have internal padding or nested offsets.
                # Usually group children positions are relative to the group's gXpos/gYpos if they exist
                # but in 4.sla we see gXpos mirroring absolute.
                self._render_page_objects(children, c, px, py, ph)
        else:
            self.processed_items.add(obj.get('ItemID'))

    def _render_polygon(self, obj, c, px, py, ph):
        # Extract path if possible, or just draw a box as fallback
        # Scribus paths are in 'path' attribute: "M0 0 L... Z"
        x = float(obj.get('XPOS', 0))
        y = float(obj.get('YPOS', 0))
        w = float(obj.get('WIDTH', 0))
        h = float(obj.get('HEIGHT', 0))
        rl_x = x - px
        rl_y = ph - (y - py) - h
        
        fill_clr = self._get_color(obj.get('PCOLOR', 'None'))
        stroke_clr = self._get_color(obj.get('PCOLOR2', 'None'))
        if obj.get('BRUSH') == 'None': fill_clr = None
        
        if fill_clr:
            c.setFillColor(fill_clr)
            # Handle alpha/shade if present
            shade = float(obj.get('SHADE', 100)) / 100.0
            if shade < 1.0:
                c.setFillAlpha(shade)
            c.rect(rl_x, rl_y, w, h, fill=1, stroke=0)
            c.setFillAlpha(1.0)
            
        if stroke_clr:
            c.setStrokeColor(stroke_clr)
            c.setLineWidth(float(obj.get('PWIDTH', 1)))
            c.rect(rl_x, rl_y, w, h, fill=0, stroke=1)

    def _get_chain(self, head_obj):
        chain = [head_obj]
        curr = head_obj
        while True:
            next_id = curr.get('NEXTITEM', '-1')
            if next_id == '-1' or next_id not in self.item_map:
                break
            curr = self.item_map[next_id]
            if curr in chain: break # Avoid cycles
            chain.append(curr)
        return chain

    def _render_text_chain(self, chain, c, px, py, ph):
        # 1. Collect story elements
        story_node = None
        for obj in chain:
            story_node = obj.find("StoryText")
            if story_node is not None: break
            
        if story_node is None:
            for obj in chain: self.processed_items.add(obj.get('ItemID'))
            return

        # 2. Extract elements (Paragraphs)
        story_elements = self._extract_story_elements(story_node, chain[0])
        if not story_elements:
            for obj in chain: self.processed_items.add(obj.get('ItemID'))
            return
            
        # 3. Flow across frames
        try:
            current_elements = story_elements
            for obj in chain:
                self.processed_items.add(obj.get('ItemID'))
                
                x = float(obj.get('XPOS', 0))
                y = float(obj.get('YPOS', 0))
                w = float(obj.get('WIDTH', 0))
                h = float(obj.get('HEIGHT', 0))
                
                rl_x = x - px
                rl_y = ph - (y - py) - h
                
                # Use slightly larger padding for better look, but disable debug boundary
                f = Frame(rl_x, rl_y, w, h, leftPadding=2, bottomPadding=2, rightPadding=2, topPadding=2, showBoundary=0)
                current_elements = f.addFromList(current_elements, c)
                if not current_elements:
                    break
                    
        except Exception as e:
            print(f"Error rendering chain starting at {chain[0].get('ANNAME')}: {e}")

    def _render_box(self, obj, c, px, py, ph):
        x = float(obj.get('XPOS', 0))
        y = float(obj.get('YPOS', 0))
        w = float(obj.get('WIDTH', 0))
        h = float(obj.get('HEIGHT', 0))
        rl_x = x - px
        rl_y = ph - (y - py) - h
        
        clr = self._get_color(obj.get('PCOLOR', 'None'))
        if clr:
            c.setStrokeColor(clr)
            c.rect(rl_x, rl_y, w, h)

    def _extract_story_elements(self, container, base_obj):
        elements = []
        current_pstyle_name = base_obj.get('PSTYLE', '[No paragraph style]')
        
        current_markup = ""
        
        def process_container(node, inherited_style=None):
            nonlocal current_markup, current_pstyle_name
            
            for elem in node:
                if elem.tag == "ITEXT":
                    txt = elem.get('CH', '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
                    txt = txt.replace('\r', '<br/>').replace('\n', '<br/>').replace('\x05', '<br/>')
                    if not txt: continue
                    
                    # 1. Start with the current paragraph style defaults
                    pstyle = self.doc_styles.get(current_pstyle_name)
                    
                    # 2. Character Style inheritance
                    cstyle_name = elem.get('CSTYLE')
                    cstyle = self.char_styles.get(cstyle_name, {}) if cstyle_name else {}
                    
                    # 3. Inline attributes override everything
                    font_attr = elem.get('FONT') or cstyle.get('font')
                    if not font_attr:
                        font = pstyle.fontName if pstyle else "Helvetica"
                    else:
                        font = self._get_font_name(font_attr)
                    
                    size_attr = elem.get('FONTSIZE') or cstyle.get('size')
                    size = float(size_attr) if size_attr else (pstyle.fontSize if pstyle else 10)
                    
                    color_name = elem.get('COLOR') or cstyle.get('color', 'Black')
                    color = self.colors.get(color_name, colors.black)
                    hex_color = color.hexval() if hasattr(color, 'hexval') else "#000000"
                    
                    current_markup += f'<font face="{font}" size="{size}" color="{hex_color}">{txt}</font>'
                    
                elif elem.tag in ["para", "PARA"]:
                    # Finish current paragraph
                    if current_markup:
                        style = self.doc_styles.get(current_pstyle_name)
                        if not style:
                            style = ParagraphStyle(name="Default", fontName="Helvetica", fontSize=10, leading=12)
                        elements.append(Paragraph(current_markup, style))
                        current_markup = ""
                    
                    # Switch to new paragraph style
                    new_style = elem.get('PARENT')
                    if new_style: current_pstyle_name = new_style
                
                elif elem.tag in ["CSTYLE", "CharacterStyle"]:
                    # These tags can wrap ITEXT or other nodes
                    process_container(elem)
        
        process_container(container)
        
        # Add last paragraph if exists
        if current_markup:
            style = self.doc_styles.get(current_pstyle_name)
            if not style:
                style = ParagraphStyle(name="Default", fontName="Helvetica", fontSize=10, leading=12)
            elements.append(Paragraph(current_markup, style))
            
        return elements

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python sla_reportlab_generator.py input.sla output.pdf [fonts_dir]")
        sys.exit(1)
    
    gen = SLAReportLabGenerator(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else "Fonts")
    gen.generate()
