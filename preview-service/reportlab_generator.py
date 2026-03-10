import json
import os
from pathlib import Path
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Frame, PageTemplate
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, mm, cm
from reportlab.pdfgen import canvas
from reportlab.lib import colors

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.fonts import addMapping

class IDMLReportLabGenerator:
    def __init__(self, json_data, output_path, fonts_dir):
        self.data = json_data
        self.output_path = output_path
        self.fonts_dir = Path(fonts_dir)
        self.registered_fonts = {}
        self.font_to_family = {} # Map specific font names to their family
        self._register_fonts()
        self.styles = getSampleStyleSheet()
        self.page_width = self.data['metadata']['pageSettings']['width']
        self.page_height = self.data['metadata']['pageSettings']['height']

    def _register_fonts(self):
        """Register all .otf and .ttf files and group them into families."""
        if not self.fonts_dir.exists():
            return
            
        temp_ttf_dir = self.fonts_dir / ".temp_ttf"
        temp_ttf_dir.mkdir(exist_ok=True)
        
        # We'll group fonts by family name (the part before the hyphen)
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
                    # Fallback: first available variant is regular
                    reg_name = next(iter(variants.values()))
                    variants['regular'] = reg_name
                
                # We also map the family name itself to its regular variant
                if family_name not in self.registered_fonts:
                    self.registered_fonts[family_name] = reg_name
                
                # Explicitly add to ps2tt so Paragraph parser doesn't crash
                # mapping: family, bold, italic, psname
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
                hmtx[name] = (otf_glyph.width, 0) # (advanceWidth, lsb)
                
                tt_pen = TTGlyphPen(None)
                cu2qu_pen = Cu2QuPen(tt_pen, max_err=1, reverse_direction=True)
                otf_glyph.draw(cu2qu_pen)
                glyphs[name] = tt_pen.glyph()

            # Replace CFF with glyf and others
            font['glyf'] = ttLib.newTable('glyf')
            font['glyf'].glyphs = glyphs
            font['loca'] = ttLib.newTable('loca')
            font['hmtx'] = ttLib.newTable('hmtx')
            font['hmtx'].metrics = hmtx
            
            # Cleanup CFF specific tables
            for tag in ['CFF ', 'CFF2', 'VORG']:
                if tag in font:
                    del font[tag]
            
            # Update maxp for TrueType (version 1.0 required for glyf)
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
            
            # Save the new TTF
            font.save(ttf_path)
        except Exception as e:
            print(f"Failed to convert {otf_path}: {e}")

    def _get_font_name(self, applied_font):
        """Map IDML AppliedFont to a registered font name or family."""
        if not applied_font:
            return "Helvetica"
            
        clean_name = applied_font.replace("\t", "").replace("$ID/", "").replace(" (OTF)", "").replace(" ", "").lower()
        clean_name = clean_name.replace("-", "")
        
        # Try finding a font that matches
        best_match = None
        if clean_name in self.registered_fonts:
            best_match = self.registered_fonts[clean_name]
        else:
            for reg_name_clean, reg_real_name in self.registered_fonts.items():
                if clean_name == reg_name_clean:
                    best_match = reg_real_name
                    break
                if clean_name in reg_name_clean or reg_name_clean in clean_name:
                    if len(clean_name) > 3 and clean_name[:4] == reg_name_clean[:4]:
                        best_match = reg_real_name
                        break
        
        if best_match:
            # If this font belongs to a family, return the family name instead
            return self.font_to_family.get(best_match, best_match)
                
        return "Helvetica"

    def _create_style(self, idml_style_name, overrides):
        # Convert IDML/InDesign style properties to ReportLab ParagraphStyle
        point_size = overrides.get('PointSize')
        font_size = float(point_size) if point_size else 10
        
        leading_val = overrides.get('Leading')
        leading = float(leading_val) if leading_val else font_size * 1.2
        
        alignment_map = {
            'LeftAlign': 0,
            'CenterAlign': 1,
            'RightAlign': 2,
            'JustifyLeftAlign': 4,
        }
        alignment = alignment_map.get(overrides.get('Justification'), 0)
        
        font_name = self._get_font_name(overrides.get('AppliedFont'))
        
        return ParagraphStyle(
            name=idml_style_name,
            fontName=font_name,
            fontSize=font_size,
            leading=leading,
            alignment=alignment,
            leftIndent=float(overrides.get('LeftIndent', 0)),
            rightIndent=float(overrides.get('RightIndent', 0)),
            firstLineIndent=float(overrides.get('FirstLineIndent', 0)),
        )

    def _get_color(self, swatch_name):
        """Map IDML swatch to ReportLab color."""
        swatches = self.data['metadata'].get('swatches', {})
        # Normalize swatch name
        clean_swatch = swatch_name.replace('Color/', '').replace('Swatch/', '')
        swatch = swatches.get(swatch_name) or swatches.get(clean_swatch)
        
        if not swatch:
            if 'Black' in swatch_name: return colors.black
            if 'Paper' in swatch_name: return colors.white
            return colors.black
            
        if swatch['type'] == 'color':
            vals = swatch.get('values', [])
            if swatch['space'] == 'RGB' and len(vals) >= 3:
                return colors.Color(vals[0]/255, vals[1]/255, vals[2]/255)
            elif swatch['space'] == 'CMYK' and len(vals) >= 4:
                return colors.CMYKColor(vals[0]/100, vals[1]/100, vals[2]/100, vals[3]/100)
        elif swatch['type'] == 'tint':
            base = self._get_color(swatch['baseColor'])
            tint_val = swatch.get('value', 100) / 100
            # Basic tinting for RGB
            if hasattr(base, 'red'):
                return colors.Color(
                    base.red + (1 - base.red) * (1 - tint_val),
                    base.green + (1 - base.green) * (1 - tint_val),
                    base.blue + (1 - base.blue) * (1 - tint_val)
                )
            return base
            
        return colors.black

    def _build_markup(self, char_ranges):
        """Convert character ranges to ReportLab markup."""
        markup = ""
        for cr in char_ranges:
            content = cr['content'].replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            # Basic cleanup of IDML special characters
            content = content.replace('\u0007', '').replace('\u0008', '') # Special markers
            attrs = cr.get('attributes', {})
            
            font_name = self._get_font_name(attrs.get('AppliedFont'))
            font_size = attrs.get('PointSize')
            fill_color = attrs.get('FillColor')
            
            style_tags = []
            if font_name != "Helvetica":
                style_tags.append(f'face="{font_name}"')
            if font_size:
                style_tags.append(f'size="{float(font_size)}"')
            if fill_color and fill_color != 'Color/Black':
                 color = self._get_color(fill_color)
                 if hasattr(color, 'hexval'):
                     style_tags.append(f'color="{color.hexval()}"')
            
            tag_open = f'<font {" ".join(style_tags)}>' if style_tags else ""
            tag_close = "</font>" if style_tags else ""
            
            # Basic Bold/Italic if detected in FontStyle
            font_style = attrs.get('FontStyle', '').lower()
            if 'bold' in font_style:
                tag_open = "<b>" + tag_open
                tag_close = tag_close + "</b>"
            if 'italic' in font_style:
                tag_open = "<i>" + tag_open
                tag_close = tag_close + "</i>"
                
            markup += f"{tag_open}{content}{tag_close}"
            
        return markup

    def generate(self):
        c = canvas.Canvas(self.output_path, pagesize=(self.page_width, self.page_height))
        print(f"Canvas size: {self.page_width}x{self.page_height}")
        
        stories_map = {s['id']: s for s in self.data['stories']}
        print(f"Loaded {len(stories_map)} stories.")
        
        # Build paragraph lists for all stories once to support threading across frames
        story_elements = {}
        for sid, story in stories_map.items():
            elements = []
            for p in story.get('paragraphs', []):
                p_style = self._create_style(p['appliedStyle'], p['overrides'])
                markup_text = self._build_markup(p['characterRanges'])
                try:
                    elements.append(Paragraph(markup_text, p_style))
                except Exception as e:
                    print(f"Error creating paragraph in {sid}: {e}")
                    plain_text = "".join([cr['content'] for cr in p['characterRanges']])
                    elements.append(Paragraph(plain_text, p_style))
            story_elements[sid] = elements
            if elements:
                print(f"  Story {sid}: {len(elements)} paragraphs.")

        for spread_idx, spread in enumerate(self.data['spreads']):
            spread_id = spread.get('id', f'spread_{spread_idx}')
            print(f"Processing Spread {spread_idx} (ID: {spread_id})")
            
            # We must process pages in order
            pages = spread.get('pages', [])
            if not pages:
                print(f"  Warning: Spread {spread_id} has no pages. Skipping.")
                continue

            for page_idx, page in enumerate(pages):
                page_id = page['id']
                print(f"  Rendering Page {page_idx} (ID: {page_id})")
                
                # Get IDs of other pages in this spread to know what to skip
                other_page_ids = [p['id'] for p in pages if p['id'] != page_id]
                
                # Draw Text Frames for this page
                frames = spread.get('frames', [])
                print(f"    Spread has {len(frames)} text frames.")
                for frame in frames:
                    # PERMISSIVE CHECK: 
                    # Only skip if the frame explicitly belongs to ANOTHER page in this spread.
                    # This handles cases where pageId is 'default', missing, or slightly mismatched.
                    f_page_id = frame.get('pageId')
                    if f_page_id and f_page_id in other_page_ids:
                        continue
                        
                    sid = frame.get('storyId')
                    if sid in story_elements and story_elements[sid]:
                        y1, x1, y2, x2 = frame['bounds']
                        width = x2 - x1
                        height = y2 - y1
                        
                        rl_x = x1
                        rl_y = self.page_height - y2
                        
                        print(f"      Rendering frame {frame.get('id')} (Story: {sid}) at ({rl_x:.1f}, {rl_y:.1f}) size {width:.1f}x{height:.1f}")
                        
                        try:
                            f = Frame(rl_x, rl_y, width, height, showBoundary=0)
                            # addFromList consumes elements
                            before_count = len(story_elements[sid])
                            story_elements[sid] = f.addFromList(story_elements[sid], c)
                            after_count = len(story_elements[sid])
                            print(f"        Consumed {before_count - after_count} paragraphs. {after_count} remaining in story.")
                        except Exception as frame_err:
                            print(f"        Error rendering frame {frame.get('id')}: {frame_err}")

                # Draw Image Frames for this page
                img_frames = spread.get('imageFrames', [])
                for img_frame in img_frames:
                    i_page_id = img_frame.get('pageId')
                    if i_page_id and i_page_id in other_page_ids:
                        continue
                        
                    y1, x1, y2, x2 = img_frame['bounds']
                    width = x2 - x1
                    height = y2 - y1
                    rl_x = x1
                    rl_y = self.page_height - y2
                    
                    print(f"      Rendering image frame {img_frame.get('fileName')} at ({rl_x:.1f}, {rl_y:.1f})")
                    c.setStrokeColor(colors.black)
                    c.rect(rl_x, rl_y, width, height)
                    c.setFont("Helvetica", 8)
                    c.drawString(rl_x + 5, rl_y + 5, f"Image: {img_frame.get('fileName')}")

                c.showPage()
        
        c.save()
        print(f"Saved PDF to {self.output_path}")

def main():
    import sys
    if len(sys.argv) < 3:
        print("Usage: python reportlab_generator.py input.json output.pdf [fonts_dir]")
        sys.exit(1)
        
    input_json = sys.argv[1]
    output_pdf = sys.argv[2]
    fonts_dir = sys.argv[3] if len(sys.argv) > 3 else "Fonts"
    
    with open(input_json, 'r') as f:
        data = json.load(f)
        
    gen = IDMLReportLabGenerator(data, output_pdf, fonts_dir)
    gen.generate()

if __name__ == "__main__":
    main()
