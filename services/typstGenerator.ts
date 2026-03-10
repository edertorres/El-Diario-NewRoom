
import { IDMLStory, IDMLSpread, TextFrame, ImageFrame, GenericFrame, IDMLFrame } from "../types";

export interface TypstPreferences {
    debugOverflow: boolean;
    debugUnderflow: boolean;
    includeImages: boolean;
}

export class TypstGenerator {
    generate(
        stories: IDMLStory[],
        spreads: IDMLSpread[],
        styles: any,
        swatches: any,
        pageSettings: any,
        prefs: TypstPreferences
    ): string {
        let code = `// Código Typst generado desde IDML Injector Pro\n\n`;

        const usedStyles = this.collectUsedStyles(stories, styles);
        const usedSwatches = this.collectUsedSwatches(stories, spreads, styles, swatches);

        code += this.generateHelpers(pageSettings, prefs);
        code += this.generatePageSettings(pageSettings);

        code += `// --- ESTILOS ---\n`;
        code += this.generateStyles(styles, swatches, usedStyles, usedSwatches);

        code += `// --- CONTENIDO ---\n`;
        let hasContent = false;
        const handledStoriesOnPage = new Set<string>();

        spreads.forEach((spread) => {
            spread.pages.forEach((page, pageIndex) => {
                const pageId = page.id;
                const ox = page.offsetX || 0;
                const oy = page.offsetY || 0;

                const shift = <T extends IDMLFrame>(f: T): T => {
                    const [y1, x1, y2, x2] = f.bounds;
                    const nx = x1 - ox;
                    const ny = y1 - oy;

                    const xOutOfBounds = x1 < -5 || x1 > pageSettings.width + 5;
                    const nxInBounds = nx > -5 && nx < pageSettings.width + 5;
                    const useX = xOutOfBounds && nxInBounds ? nx : x1;

                    const yOutOfBounds = y1 < -5 || y1 > pageSettings.height + 5;
                    const nyInBounds = ny > -5 && ny < pageSettings.height + 5;
                    const useY = yOutOfBounds && nyInBounds ? ny : y1;

                    const dx = useX - x1;
                    const dy = useY - y1;

                    return {
                        ...f,
                        bounds: [y1 + dy, x1 + dx, y2 + dy, x2 + dx]
                    };
                };

                const pageFrames = spread.frames.filter(f => f.pageId === pageId || (!f.pageId && pageIndex === 0)).map(shift);
                const pageImageFrames = spread.imageFrames.filter(f => f.pageId === pageId || (!f.pageId && pageIndex === 0)).map(shift);
                const pageGenericFrames = (spread.genericFrames || []).filter(f => f.pageId === pageId || (!f.pageId && pageIndex === 0)).map(shift);

                if (pageFrames.length === 0 && pageImageFrames.length === 0 && pageGenericFrames.length === 0) return;

                if (hasContent) { code += `#pagebreak()\n`; }
                hasContent = true;

                const isInside = (f: IDMLFrame) => f.bounds[2] > 0 && f.bounds[3] > 0;

                pageGenericFrames.filter(isInside).forEach(frame => { code += this.generateGeneralFrame(frame, swatches); });
                pageImageFrames.filter(isInside).forEach(frame => { code += this.generateImageFrame(frame, swatches, prefs); });

                pageFrames.filter(isInside).forEach(frame => {
                    const key = `${frame.storyId}_${pageId}`;
                    if (handledStoriesOnPage.has(key)) return;

                    const siblingFrames = pageFrames.filter(isInside).filter(f => f.storyId === frame.storyId);

                    if (siblingFrames.length > 1 || (frame.columnCount && frame.columnCount > 1)) {
                        code += this.generateTextFrame(frame, stories, styles, swatches);
                    } else {
                        code += this.generateTextFrame(frame, stories, styles, swatches);
                    }
                });
            });
        });

        return code;
    }

    private generateHelpers(pageSettings: any, prefs: TypstPreferences): string {
        let code = `// --- UTILIDADES ---\n\n`;
        code += `#let debug-overflow = ${prefs.debugOverflow}\n`;
        code += `#let overflow-box(width, height, words: 0, body) = {\n`;
        code += `  context {\n`;
        code += `    let size = measure(block(width: width, inset: 0pt, body))\n`;
        code += `    let has-overflow = (size.height > height + 1pt)\n`;
        code += `    box(width: width, height: height, clip: true, \n`;
        code += `        stroke: if debug-overflow and has-overflow { 1pt + red } else { none })[\n`;
        code += `      #body\n`;
        code += `      #if debug-overflow and has-overflow [\n`;
        code += `        #place(bottom + right, dx: 0pt, dy: 0pt)[\n`;
        code += `          #box(fill: red, inset: 2pt)[#text(fill: white, size: 6pt, weight: "bold")[EXCESO (#words PAL.)]]\n`;
        code += `        ]\n`;
        code += `      ]\n`;
        code += `    ]\n`;
        code += `  }\n`;
        code += `}\n\n`;

        code += `#let idml-cmyk(c, m, y, k) = cmyk(c * 1%, m * 1%, y * 1%, k * 1%)\n\n`;

        code += `#let style_default(it) = it\n`;
        code += `#let intertitulo_style(it) = {\n`;
        code += `  set text(weight: "bold", size: 11pt)\n`;
        code += `  block(it, above: 1.2em, below: 0pt)\n`;
        code += `}\n\n`;

        return code;
    }

    private generatePageSettings(pageSettings: any): string {
        let code = `#set page(\n`;
        code += `  width: ${pageSettings.width}pt,\n`;
        code += `  height: ${pageSettings.height}pt,\n`;
        code += `  margin: 0pt,\n`;
        code += `)\n\n`;
        code += `#set text(lang: "es", size: 10pt, top-edge: 0.8em, bottom-edge: -0.2em)\n`;
        code += `#set par(linebreaks: "optimized", spacing: 0pt)\n\n`;
        return code;
    }

    private collectUsedStyles(stories: IDMLStory[], styles: any): Set<string> {
        const used = new Set<string>();
        const addStyleAndParents = (id: string) => {
            if (!id || used.has(id)) return;
            used.add(id);
            const style = styles[id];
            if (style?.attributes?.BasedOn) { addStyleAndParents(style.attributes.BasedOn); }
        };
        stories.forEach(story => {
            if (story.paragraphs) {
                story.paragraphs.forEach(p => {
                    addStyleAndParents(p.appliedStyle);
                    p.characterRanges.forEach(cr => { addStyleAndParents(cr.appliedStyle); });
                });
            }
        });
        return used;
    }

    private collectUsedSwatches(stories: IDMLStory[], spreads: IDMLSpread[], styles: any, swatches: any): Set<string> {
        const used = new Set<string>();
        const addSwatchAndBase = (id: string | undefined) => {
            if (!id || id === 'Swatch/None' || used.has(id)) return;
            used.add(id);
            const swatch = swatches[id];
            if (swatch?.type === 'tint' && swatch.baseColor) { addSwatchAndBase(swatch.baseColor); }
        };
        spreads.forEach(spread => {
            spread.frames.forEach(f => addSwatchAndBase(f.fillColor));
            spread.imageFrames.forEach(f => addSwatchAndBase(f.fillColor));
        });
        Object.values(styles).forEach((s: any) => { if (s.attributes?.FillColor) addSwatchAndBase(s.attributes.FillColor); });
        return used;
    }

    private generateStyles(styles: any, swatches: any, usedStyles: Set<string>, usedSwatches: Set<string>): string {
        let code = "";
        const seen = new Set<string>();

        for (const [key, style] of Object.entries(styles)) {
            if (!usedStyles.has(key)) continue;
            const sanitized = this.sanitizeStyleName(key);
            if (seen.has(sanitized)) continue;
            seen.add(sanitized);

            const isParagraphStyle = key.includes('ParagraphStyle/');
            const s = style as any;
            const resolvedAttrs = this.resolveStyleAttributes(s.self || key, styles);
            const { textProps, parProps, alignProp, spacingProps } = this.buildStyleProps(resolvedAttrs, swatches);

            let above = this.findInProps(spacingProps, 'above', '0pt');
            let below = this.findInProps(spacingProps, 'below', '0pt');

            code += `#let ${sanitized}(it, ..args) = {\n`;
            code += `  let (leading, justify, hanging-indent, first-line-indent, above, below, ..text_args) = (\n`;
            code += `    leading: none, justify: none, hanging-indent: none, first-line-indent: none, \n`;
            code += `    above: ${above}, below: ${below},\n`;
            code += `    ..args.named()\n`;
            code += `  )\n`;

            if (alignProp) { code += `  set align(${alignProp})\n`; }
            if (textProps.length > 0) { code += `  set text(${textProps.join(', ')})\n`; }
            if (parProps.length > 0) { code += `  set par(${parProps.join(', ')})\n`; }
            code += `  set text(..text_args)\n`;
            code += `  if leading != none { set par(leading: leading) }\n`;
            code += `  if justify != none { set par(justify: justify) }\n`;
            code += `  if hanging-indent != none { set par(hanging-indent: hanging-indent) }\n`;
            code += `  if first-line-indent != none { set par(first-line-indent: first-line-indent) }\n`;

            if (isParagraphStyle) {
                code += `  block(above: above, below: below, width: 100%, breakable: true, it)\n`;
            } else {
                code += `  it\n`;
            }
            code += `}\n\n`;
        }
        return code;
    }

    private findInProps(props: string[], key: string, fallback: string): string {
        const found = props.find(p => p.startsWith(key + ":"));
        return found ? found.split(":")[1].trim() : fallback;
    }

    private resolveStyleAttributes(styleId: string, styles: any): Record<string, string> {
        if (!styleId) return {};
        const style = styles[styleId];
        if (!style || (style as any)._resolving) return {};
        (style as any)._resolving = true;
        let attributes = { ...(style.attributes || {}) };
        if (attributes.BasedOn && attributes.BasedOn !== '$ID/[No paragraph style]' && attributes.BasedOn !== '$ID/[No character style]') {
            const parentAttributes = this.resolveStyleAttributes(attributes.BasedOn, styles);
            attributes = { ...parentAttributes, ...attributes };
        }
        delete (style as any)._resolving;
        return attributes;
    }

    private buildStyleProps(attrs: Record<string, string>, swatches: any): { textProps: string[], parProps: string[], alignProp?: string, spacingProps: string[] } {
        const textProps: string[] = [];
        const parProps: string[] = [];
        const spacingProps: string[] = [];
        let alignProp: string | undefined = undefined;

        if (attrs.FillColor) {
            const color = this.mapColorToTypst(attrs.FillColor, swatches);
            if (color !== 'none') textProps.push(`fill: ${color}`);
        }
        const pointSize = parseFloat(attrs.PointSize || '10');
        if (attrs.PointSize) textProps.push(`size: ${pointSize}pt`);
        if (attrs.AppliedFont) {
            const fontName = attrs.AppliedFont.split('\t')[0].replace(/\$ID\//g, '');
            textProps.push(`font: "${this.mapFontToTypst(fontName)}"`);
        }
        if (attrs.Tracking) {
            const tracking = parseFloat(attrs.Tracking);
            if (!isNaN(tracking) && tracking !== 0) textProps.push(`tracking: ${(tracking / 1000).toFixed(3)}em`);
        }
        if (attrs.FontStyle) {
            const fp = this.mapFontStyleProps(attrs.FontStyle);
            if (fp.weight) textProps.push(`weight: "${fp.weight}"`);
            if (fp.style) textProps.push(`style: "${fp.style}"`);
        }
        if (attrs.Leading) {
            const leading = parseFloat(attrs.Leading);
            if (!isNaN(leading) && leading > 0) parProps.push(`leading: ${(leading - pointSize).toFixed(2)}pt`);
        }
        if (attrs.Justification) {
            if (attrs.Justification === 'CenterAlign') { parProps.push(`justify: false`); alignProp = 'center'; }
            else if (attrs.Justification === 'RightAlign') { parProps.push(`justify: false`); alignProp = 'right'; }
            else if (attrs.Justification === 'FullyJustified' || attrs.Justification === 'LeftJustified') { parProps.push(`justify: true`); }
            else { parProps.push(`justify: false`); alignProp = 'left'; }
        }
        const li = parseFloat(attrs.LeftIndent || '0');
        const fli = parseFloat(attrs.FirstLineIndent || '0');
        if (li !== 0 || fli !== 0) {
            parProps.push(`first-line-indent: ${(li + fli).toFixed(2)}pt`);
            parProps.push(`hanging-indent: ${li.toFixed(2)}pt`);
        }
        if (attrs.SpaceBefore) spacingProps.push(`above: ${parseFloat(attrs.SpaceBefore).toFixed(2)}pt`);
        if (attrs.SpaceAfter) spacingProps.push(`below: ${parseFloat(attrs.SpaceAfter).toFixed(2)}pt`);

        return { textProps, parProps, alignProp, spacingProps };
    }

    private mapFontStyleProps(style: string): { weight?: string; style?: string } {
        const m: Record<string, any> = { 'Bold Italic': { weight: 'bold', style: 'italic' }, 'Bold': { weight: 'bold' }, 'Italic': { style: 'italic' } };
        return m[style] || {};
    }

    private generateTextFrame(frame: TextFrame, stories: IDMLStory[], styles: any, swatches: any): string {
        const story = stories.find(s => s.id === frame.storyId);
        if (!story) return "";
        const [y, x] = frame.bounds;
        const width = frame.width || (frame.bounds[3] - x);
        const height = frame.height || (frame.bounds[2] - y);
        const count = frame.columnCount || 1;
        const wordCount = story.content.trim().split(/\s+/).length;

        let code = `#place(dx: ${x.toFixed(2)}pt, dy: ${y.toFixed(2)}pt)[#context {\n`;
        code += `  let story_content = [\n${this.generateStoryContent(story, styles, swatches)}  ]\n`;

        if (count > 1) {
            const gutter = frame.columnGutter || 12;
            code += `  overflow-box(${width.toFixed(2)}pt, ${height.toFixed(2)}pt, words: ${wordCount})[\n`;
            code += `    #columns(${count}, gutter: ${gutter}pt)[#story_content]\n`;
            code += `  ]\n`;
        } else {
            code += `  overflow-box(${width.toFixed(2)}pt, ${height.toFixed(2)}pt, words: ${wordCount})[#story_content]\n`;
        }
        code += `}]\n\n`;
        return code;
    }

    private generateStoryContent(story: IDMLStory, styles: any, swatches: any): string {
        // REGLA 2: Si tiene etiqueta pero no ha sido modificada, se considera vacía (limpieza de plantilla)
        if (story.scriptLabel && !story.isModified) {
            return "";
        }

        let code = "";
        if (!story.isModified && story.paragraphs) {
            story.paragraphs.forEach(p => {
                const sName = this.sanitizeStyleName(p.appliedStyle);
                code += `        #${sName}()[`;
                p.characterRanges.forEach(cr => {
                    const csName = this.sanitizeStyleName(cr.appliedStyle);
                    if (csName !== 'style_default') {
                        code += `#${csName}[${this.escapeTypstString(cr.content, false)}]`;
                    } else {
                        code += this.escapeTypstString(cr.content, false);
                    }
                });
                code += `]\n`;
            });
        } else {
            const firstP = story.paragraphs?.[0];
            const sName = firstP ? this.sanitizeStyleName(firstP.appliedStyle) : 'style_default';
            const segments = this.parseTextWithIntertitles(story.content);
            segments.forEach(seg => {
                if (seg.type === 'intertitle') {
                    code += `        #intertitulo_style[${this.escapeTypstString(seg.text, false)}]\n`;
                } else {
                    const lines = seg.text.split('\n').filter(l => l.trim() !== "");
                    lines.forEach((line) => {
                        code += `        #${sName}()[`;
                        // Bullet reconstruction
                        if (firstP?.appliedStyle.toLowerCase().includes('bala') || (firstP?.characterRanges[0]?.attributes?.AppliedFont && firstP.characterRanges[0].attributes.AppliedFont.toLowerCase().includes('zapf'))) {
                            const bRange = firstP.characterRanges[0];
                            const csName = this.sanitizeStyleName(bRange.appliedStyle);
                            if (!line.trim().startsWith(bRange.content.trim())) {
                                code += `#${csName}[${this.escapeTypstString(bRange.content, false)}] `;
                            }
                        }
                        code += this.escapeTypstString(line, false) + `]\n`;
                    });
                }
            });
        }
        return code;
    }

    private generateImageFrame(f: ImageFrame, swatches: any, prefs: TypstPreferences): string {
        const [y, x] = f.bounds;
        let code = `#place(dx: ${x}pt, dy: ${y}pt)[#box(width: ${f.width}pt, height: ${f.height}pt, fill: ${this.mapColorToTypst(f.fillColor, swatches)}, clip: true)[\n`;
        if (prefs.includeImages && f.fileName) { code += `  #image("${f.fileName}", width: 100%, height: 100%, fit: "cover")\n`; }
        else { code += `  #place(center + horizon)[#text(size: 7pt)[IMAGEN: ${f.fileName || 'S/N'}]]\n`; }
        code += `]]\n\n`;
        return code;
    }

    private generateGeneralFrame(f: GenericFrame, swatches: any): string {
        const [y, x] = f.bounds;
        return `#place(dx: ${x}pt, dy: ${y}pt)[#rect(width: ${f.width}pt, height: ${f.height}pt, fill: ${this.mapColorToTypst(f.fillColor, swatches)})]\n\n`;
    }

    private sanitizeStyleName(n: string): string {
        if (!n) return "style_default";
        return n.replace(/^(ParagraphStyle|CharacterStyle)\//i, '').replace(/^\$ID\//i, '').replace(/[^a-zA-Z0-9]/g, "_").toLowerCase() || "style_default";
    }

    private escapeTypstString(s: string, rejoin: boolean): string {
        if (!s) return "";
        let escaped = s.replace(/\\/g, "\\\\").replace(/#/g, "\\#").replace(/\$/g, "\\$").replace(/\*/g, "\\*").replace(/_/g, "\\_").replace(/"/g, '\\"').replace(/\r/g, "");
        if (rejoin) {
            return escaped.replace(/\n+/g, " ").trim();
        }
        return escaped;
    }

    private mapFontToTypst(f: string): string {
        if (!f) return "Libertinus Serif";
        const cleanName = f.split('\t')[0].replace(/\$ID\//g, '');
        const l = cleanName.toLowerCase();
        if (l.includes('austin')) return "Austin";
        if (l.includes('playfair')) return "Playfair Display";
        if (l.includes('myriad')) return "Myriad Pro";
        if (l.includes('zapf') || l.includes('dingbats')) return "Zapf Dingbats";
        return cleanName;
    }

    private parseTextWithIntertitles(t: string): Array<{ type: 'normal' | 'intertitle', text: string }> {
        const res: any[] = [];
        const re = /\*\*([^*]+)\*\*/g;
        let last = 0, m;
        while ((m = re.exec(t)) !== null) {
            if (m.index > last) {
                const txt = t.slice(last, m.index);
                if (txt.trim()) res.push({ type: 'normal', text: txt });
            }
            res.push({ type: 'intertitle', text: m[1] });
            last = m.index + m[0].length;
        }
        if (last < t.length) {
            const txt = t.slice(last);
            if (txt.trim()) res.push({ type: 'normal', text: txt });
        }
        return res.length ? res : [{ type: 'normal', text: t }];
    }

    private mapColorToTypst(id: string | undefined, sw: any): string {
        if (!id || id.includes('None')) return "none";
        if (id.includes('Black')) return "black";
        if (id.includes('Paper')) return "white";
        const s = sw[id];
        if (s?.type === 'color' && s.space === 'CMYK') return `idml-cmyk(${s.values.join(',')})`;
        if (s?.type === 'tint') return `${this.mapColorToTypst(s.baseColor, sw)}.lighten(${(100 - s.value).toFixed(1)}%)`;
        return "black";
    }
}
export const typstGenerator = new TypstGenerator();
