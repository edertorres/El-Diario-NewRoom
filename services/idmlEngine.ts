import { IDMLSpread, IDMLStory, TextFrame, ImageFrame, IDMLParagraph, IDMLCharacterRange, IDMLPage, GenericFrame } from '../types';

const parser = typeof DOMParser !== 'undefined' ? new DOMParser() : null;
const serializer = typeof XMLSerializer !== 'undefined' ? new XMLSerializer() : null;

const normalizeId = (id: string | null): string => {
  if (!id) return "";
  let clean = id.split('/').pop() || id;
  clean = clean.replace(/\.xml$/i, '');
  clean = clean.replace(/^Story_/i, '');
  return clean;
};

// Función para normalizar tags (igual que en el editor)
const normalizeTag = (tag: string | null | undefined): string => {
  if (!tag) return '';
  // Eliminar espacios al inicio y final, eliminar todos los espacios internos, convertir a mayúsculas
  return tag.trim().replace(/\s+/g, '').toUpperCase();
};

export class IDMLEngine {
  private zip: any = null;
  private stories: Map<string, IDMLStory> = new Map();
  private spreads: Map<string, IDMLSpread> = new Map();
  private originalFileName: string = "document.idml";
  public styles: any = {};
  public fonts: any[] = [];
  public swatches: any[] = [];
  public pageSettings: { width: number, height: number, zeroPoint?: { x: number, y: number } } = { width: 595.275590551181, height: 841.889763779528, zeroPoint: { x: 0, y: 0 } };
  public automaticRelink: { enabled: boolean, destinationFolder?: string } = { enabled: true };
  private _parser: any = parser;
  private _serializer: any = serializer;

  private getParser() {
    if (this._parser) return this._parser;
    if (typeof DOMParser !== 'undefined') {
      this._parser = new DOMParser();
      return this._parser;
    }
    throw new Error("DOMParser not available");
  }

  private getSerializer() {
    if (this._serializer) return this._serializer;
    if (typeof XMLSerializer !== 'undefined') {
      this._serializer = new XMLSerializer();
      return this._serializer;
    }
    throw new Error("XMLSerializer not available");
  }


  // --- UTILIDADES MATRICIALES ---
  private multiplyMatrices(m1: number[], m2: number[]): number[] {
    return [
      m1[0] * m2[0] + m1[2] * m2[1],
      m1[1] * m2[0] + m1[3] * m2[1],
      m1[0] * m2[2] + m1[2] * m2[3],
      m1[1] * m2[2] + m1[3] * m2[3],
      m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
      m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
    ];
  }

  private applyMatrix(matrix: number[], x: number, y: number) {
    return {
      x: matrix[0] * x + matrix[2] * y + matrix[4],
      y: matrix[1] * x + matrix[3] * y + matrix[5]
    };
  }

  private getGlobalMatrix(element: Element): number[] {
    let matrix = [1, 0, 0, 1, 0, 0];
    const selfTransform = element.getAttribute('ItemTransform');
    if (selfTransform) {
      matrix = selfTransform.split(' ').map(Number);
    }

    let current = element.parentElement;
    const visited = new Set();

    while (current && !visited.has(current)) {
      visited.add(current);
      const transform = current.getAttribute('ItemTransform');
      if (transform) {
        const parentMatrix = transform.split(' ').map(Number);
        matrix = this.multiplyMatrices(parentMatrix, matrix);
      }

      const localName = this.getLocalName(current);
      if (['spread', 'document', 'idpkg:spread'].includes(localName)) {
        break;
      }
      current = current.parentElement;
    }
    return matrix;
  }

  async loadFile(file: File): Promise<{ stories: IDMLStory[]; spreads: IDMLSpread[] }> {
    if ((window as any).JSZip === undefined) throw new Error("JSZip no cargado");
    this.originalFileName = file.name;

    try {
      this.zip = new (window as any).JSZip();
      const buffer = await file.arrayBuffer();
      const zipContent = await this.zip.loadAsync(buffer);

      this.stories.clear();
      this.spreads.clear();
      this.styles = {};
      this.fonts = [];
      this.swatches = [];

      const storyFiles: any[] = [];
      const spreadFiles: any[] = [];

      zipContent.forEach((relativePath: string, zipEntry: any) => {
        const lowerPath = relativePath.toLowerCase();
        if (lowerPath.includes("stories/") && lowerPath.endsWith(".xml")) storyFiles.push(zipEntry);
        if ((lowerPath.includes("spreads/") || lowerPath.includes("masterspreads/")) && lowerPath.endsWith(".xml")) spreadFiles.push(zipEntry);
      });

      for (const entry of spreadFiles) {
        const xmlContent = await entry.async("string");
        const spread = this.parseSpreadXML(entry.name, xmlContent, entry.name.includes("master") ? 'master' : 'spread');
        if (spread) this.spreads.set(spread.id, spread);
      }

      const processedStories: IDMLStory[] = [];
      for (const entry of storyFiles) {
        const xmlContent = await entry.async("string");
        const story = this.parseStoryXML(entry.name, xmlContent);
        if (story) {
          const normStoryId = normalizeId(story.id);
          for (const spread of Array.from(this.spreads.values())) {
            const frame = spread.frames.find(f => normalizeId(f.storyId) === normStoryId);
            if (frame && frame.scriptLabel) {
              story.scriptLabel = frame.scriptLabel;
              break;
            }
          }
          this.stories.set(normStoryId, story);
          processedStories.push(story);
        }
      }

      await this.extractMetadata(zipContent);

      return {
        stories: processedStories.sort((a, b) => (a.scriptLabel ? -1 : 1)),
        spreads: Array.from(this.spreads.values())
      };
    } catch (e) {
      console.error("Error IDML Engine:", e);
      throw e;
    }
  }

  private async extractMetadata(zip: any) {
    // 1. Estilos
    const stylesEntry = zip.file("Resources/Styles.xml");
    if (stylesEntry) {
      const xml = await stylesEntry.async("string");
      const doc = this.getParser().parseFromString(xml, "application/xml");

      const extractStyleAttrs = (elem: Element) => {
        const attrs: Record<string, string> = {};
        for (let i = 0; i < elem.attributes.length; i++) {
          const attr = elem.attributes[i] as Attr;
          attrs[attr.name] = attr.value;
        }
        // También buscar en <Properties>
        const props = (elem.getElementsByTagName("Properties")[0]) as Element | undefined;
        if (props) {
          for (let i = 0; i < props.children.length; i++) {
            const child = props.children[i] as Element;
            if (child.textContent) attrs[child.tagName] = child.textContent;
          }
        }
        return attrs;
      };

      const pStyles = doc.getElementsByTagName("ParagraphStyle");
      for (let i = 0; i < pStyles.length; i++) {
        const style = pStyles[i];
        const name = style.getAttribute("Name");
        const self = style.getAttribute("Self");
        if (self) {
          this.styles[self] = {
            type: 'paragraph',
            name: name || self,
            self: self,
            attributes: extractStyleAttrs(style)
          };
          if (name) this.styles[name] = this.styles[self];
        }
      }
      const cStyles = doc.getElementsByTagName("CharacterStyle");
      for (let i = 0; i < cStyles.length; i++) {
        const style = cStyles[i];
        const name = style.getAttribute("Name");
        const self = style.getAttribute("Self");
        if (self) {
          this.styles[self] = {
            type: 'character',
            name: name || self,
            self: self,
            attributes: extractStyleAttrs(style)
          };
          if (name) this.styles[name] = this.styles[self];
        }
      }
    }

    // 2. Gráficos (Colores, Tintas, Gradientes)
    const graphicEntry = zip.file("Resources/Graphic.xml");
    if (graphicEntry) {
      const xml = await graphicEntry.async("string");
      const doc = this.getParser().parseFromString(xml, "application/xml");

      // Colores
      const colors = doc.getElementsByTagName("Color");
      for (let i = 0; i < colors.length; i++) {
        const c = colors[i] as Element;
        const self = c.getAttribute("Self");
        if (self) {
          this.swatches[self] = {
            type: 'color',
            space: c.getAttribute("Space"),
            values: c.getAttribute("ColorValue")?.split(' ').map(Number) || []
          };
        }
      }

      // Tintas
      const tints = doc.getElementsByTagName("Tint");
      for (let i = 0; i < tints.length; i++) {
        const t = tints[i] as Element;
        const self = t.getAttribute("Self");
        if (self) {
          this.swatches[self] = {
            type: 'tint',
            baseColor: t.getAttribute("BaseColor"),
            value: parseFloat(t.getAttribute("TintValue") || "100")
          };
        }
      }
    }

    // 3. Preferencias (Tamaño de página y ZeroPoint)
    const prefEntry = zip.file("Resources/Preferences.xml");
    const designmapEntry = zip.file("designmap.xml");

    let zeroPoint = { x: 0, y: 0 };
    if (designmapEntry) {
      const xml = await designmapEntry.async("string");
      const doc = this.getParser().parseFromString(xml, "application/xml");
      const docElem = doc.getElementsByTagName("Document")[0] as Element | undefined;
      if (docElem) {
        const zeroPointAttr = doc.documentElement.getAttribute("ZeroPoint");
        if (zeroPointAttr) {
          const parts = zeroPointAttr.split(' ').map(Number);
          zeroPoint = { x: parts[0] || 0, y: parts[1] || 0 };
        }
      }
    }

    if (prefEntry) {
      const xml = await prefEntry.async("string");
      const doc = this.getParser().parseFromString(xml, "application/xml");
      const docPref = doc.getElementsByTagName("DocumentPreference")[0];
      if (docPref) {
        const w = parseFloat(docPref.getAttribute("PageWidth") || "595.28");
        const h = parseFloat(docPref.getAttribute("PageHeight") || "841.89");
        this.pageSettings = { width: w, height: h, zeroPoint };
      }
    }

    // 4. Fuentes
    const fontsEntry = zip.file("Resources/Fonts.xml");
    if (fontsEntry) {
      const xml = await fontsEntry.async("string");
      const doc = this.getParser().parseFromString(xml, "application/xml");
      const fontElems = doc.getElementsByTagName("Font");
      for (let i = 0; i < fontElems.length; i++) {
        const fElem = fontElems[i] as Element;
        this.fonts.push({
          name: fElem.getAttribute("Name"),
          postScript: fElem.getAttribute("PostScriptName")
        });
      }
    }
  }

  private getLocalName(node: Node): string {
    return (node instanceof Element ? (node.localName || node.tagName.split(':').pop() || "") : "").toLowerCase();
  }

  private extractFileNameFromURI(uri: string): string {
    if (!uri) return "";
    const cleanUri = uri.startsWith("file:") ? uri.substring(5) : uri;
    let decodedUri = cleanUri;
    try {
      decodedUri = decodeURIComponent(cleanUri);
    } catch (e) {
      console.warn(`[IDML Engine] No se pudo decodificar la URI: ${cleanUri}`, e);
    }
    const parts = decodedUri.split(/[/\\]/);
    const fileName = parts.pop() || "";
    return fileName.trim();
  }

  private findScriptLabel(node: Element): string | undefined {
    const labelAttrs = ["Label", "label", "ScriptLabel", "Name"];
    for (const attr of labelAttrs) {
      const val = node.getAttribute(attr);
      if (val && val.trim() && !val.startsWith("$ID/") && !val.startsWith("u") && isNaN(Number(val))) return val.trim();
    }
    const descendants = node.getElementsByTagName("*");
    for (let i = 0; i < descendants.length; i++) {
      const el = descendants[i];
      const name = this.getLocalName(el);
      if (name === "keyvaluepair") {
        const key = (el.getAttribute("Key") || el.getAttribute("key") || "").toLowerCase();
        if (key === "label") {
          const val = el.getAttribute("Value") || el.getAttribute("value");
          if (val && val.trim()) return val.trim();
        }
      }
      if (name === "label" && el.textContent?.trim()) return el.textContent.trim();
    }
    return undefined;
  }

  private parseSpreadXML(filename: string, xmlString: string, type: 'spread' | 'master'): IDMLSpread | null {
    try {
      const doc = this.getParser().parseFromString(xmlString, "application/xml");
      const frames: TextFrame[] = [];
      const imageFrames: ImageFrame[] = [];
      const genericFrames: GenericFrame[] = [];
      const allElements = doc.getElementsByTagName("*");

      const pages: IDMLPage[] = [];
      const pageElements = doc.getElementsByTagName('Page');
      for (let i = 0; i < pageElements.length; i++) {
        const pElem = pageElements[i];
        const transform = pElem.getAttribute('ItemTransform');
        if (transform) {
          const matrix = transform.split(' ').map(Number);
          pages.push({
            id: pElem.getAttribute('Self') || `page_${i}`,
            offsetX: matrix[4],
            offsetY: matrix[5]
          });
        }
      }

      for (let i = 0; i < allElements.length; i++) {
        const node = allElements[i] as Element;
        const localName = this.getLocalName(node);

        if (localName === 'textframe') {
          const parentStory = node.getAttribute("ParentStory");
          if (parentStory) {
            const geometry = this.extractGeometry(node, pages);
            const styles = this.extractStyles(node);

            let colCount = 1;
            let colGutter = 12;
            const tfPref = node.getElementsByTagName("TextFramePreference")[0];
            if (tfPref) {
              colCount = parseInt(tfPref.getAttribute("TextColumnCount") || "1");
              colGutter = parseFloat(tfPref.getAttribute("TextColumnGutter") || "12");
            }

            frames.push({
              id: node.getAttribute("Self") || `tf_${i}`,
              storyId: normalizeId(parentStory),
              bounds: geometry.bounds,
              pageId: geometry.pageId,
              matrix: geometry.matrix,
              rotation: geometry.rotation,
              scriptLabel: this.findScriptLabel(node),
              columnCount: colCount,
              columnGutter: colGutter,
              fillColor: styles.fillColor,
              strokeColor: styles.strokeColor,
              strokeWeight: styles.strokeWeight,
              width: geometry.width,
              height: geometry.height,
              scaleX: geometry.scaleX,
              scaleY: geometry.scaleY,
              styles: styles,
              attributes: this.extractAttributesFromElement(node)
            });
          }
        }

        if (['rectangle', 'oval', 'polygon', 'graphicline'].includes(localName)) {
          const label = this.findScriptLabel(node);
          const geometry = this.extractGeometry(node, pages);
          const styles = this.extractStyles(node);

          const imageContent = Array.from(node.getElementsByTagName("*")).find(n =>
            ['image', 'pdf', 'eps', 'importedpage'].includes(this.getLocalName(n))
          );

          if (imageContent) {
            const linkNode = Array.from(imageContent.getElementsByTagName("*")).find(n => this.getLocalName(n) === 'link');
            const uri = linkNode ? (linkNode as Element).getAttribute("LinkResourceURI") || "" : "";
            imageFrames.push({
              id: node.getAttribute("Self") || `img_${i}`,
              scriptLabel: label || "",
              currentLinkUri: uri,
              parentSpreadId: filename,
              fileName: uri.split('/').pop() || "",
              bounds: geometry.bounds,
              matrix: geometry.matrix,
              rotation: geometry.rotation,
              fillColor: styles.fillColor,
              strokeColor: styles.strokeColor,
              strokeWeight: styles.strokeWeight,
              width: geometry.width,
              height: geometry.height,
              scaleX: geometry.scaleX,
              scaleY: geometry.scaleY,
              path: geometry.path,
              pageId: geometry.pageId,
              styles: styles,
              attributes: this.extractAttributesFromElement(node)
            });
          } else {
            genericFrames.push({
              id: node.getAttribute("Self") || `gen_${i}`,
              contentType: localName as any,
              scriptLabel: label,
              bounds: geometry.bounds,
              matrix: geometry.matrix,
              rotation: geometry.rotation,
              fillColor: styles.fillColor,
              strokeColor: styles.strokeColor,
              strokeWeight: styles.strokeWeight,
              width: geometry.width,
              height: geometry.height,
              scaleX: geometry.scaleX,
              scaleY: geometry.scaleY,
              path: geometry.path,
              pageId: geometry.pageId,
              styles: styles,
              attributes: this.extractAttributesFromElement(node)
            });
          }
        }
      }
      return { id: filename, name: filename, frames, imageFrames, genericFrames, pages, type, originalXml: xmlString };
    } catch (e) {
      console.error("Error parsing spread:", filename, e);
      return null;
    }
  }

  private extractGeometry(node: Element, pages: IDMLPage[] = []) {
    const globalMatrix = this.getGlobalMatrix(node);
    let x = 0, y = 0, width = 100, height = 100, rotation = 0;
    const path: { x: number, y: number }[] = [];

    const pg = node.getElementsByTagName('PathGeometry')[0];
    if (pg) {
      const points: { x: number, y: number }[] = [];
      const paths = pg.getElementsByTagName('GeometryPathType');
      for (let i = 0; i < paths.length; i++) {
        const pts = Array.from(paths[i].getElementsByTagName('PathPointType'))
          .map(p => p.getAttribute('Anchor')?.split(' ').map(Number) || [0, 0]);
        pts.forEach(p => {
          path.push({ x: p[0], y: p[1] });
          points.push(this.applyMatrix(globalMatrix, p[0], p[1]));
        });
      }
      if (points.length > 0) {
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        x = Math.min(...xs);
        y = Math.min(...ys);
        width = Math.max(...xs) - x;
        height = Math.max(...ys) - y;
      }
    } else {
      const boundsStr = node.getAttribute('GeometricBounds');
      if (boundsStr) {
        const b = boundsStr.split(' ').map(Number); // [y0, x0, y1, x1]
        const corners = [
          this.applyMatrix(globalMatrix, b[1], b[0]),
          this.applyMatrix(globalMatrix, b[3], b[0]),
          this.applyMatrix(globalMatrix, b[1], b[2]),
          this.applyMatrix(globalMatrix, b[3], b[2])
        ];
        const xs = corners.map(p => p.x);
        const ys = corners.map(p => p.y);
        x = Math.min(...xs);
        y = Math.min(...ys);
        width = Math.max(...xs) - x;
        height = Math.max(...ys) - y;
      }
    }

    const centerX = x + (width / 2);
    let closestPage: IDMLPage = pages[0] || { id: 'default', offsetX: 0, offsetY: 0 };
    if (pages.length > 1) {
      let minDistance = Infinity;
      const pageUnitWidth = this.pageSettings.width;
      pages.forEach(p => {
        const pageCenterX = p.offsetX + (pageUnitWidth / 2);
        const dist = Math.abs(centerX - pageCenterX);
        if (dist < minDistance) {
          minDistance = dist;
          closestPage = p;
        }
      });
    }

    x = x - closestPage.offsetX;
    y = y - closestPage.offsetY;

    rotation = -Math.atan2(globalMatrix[1], globalMatrix[0]) * (180 / Math.PI);
    if (rotation < 0) rotation += 360;

    const scaleX = Math.sqrt(globalMatrix[0] * globalMatrix[0] + globalMatrix[1] * globalMatrix[1]);
    const scaleY = Math.sqrt(globalMatrix[2] * globalMatrix[2] + globalMatrix[3] * globalMatrix[3]);

    return {
      bounds: [y, x, y + height, x + width] as [number, number, number, number],
      matrix: globalMatrix,
      rotation,
      width,
      height,
      scaleX,
      scaleY,
      pageId: closestPage.id,
      path: path.length > 0 ? path : undefined
    };
  }

  private extractStyles(node: Element) {
    const styles: any = {};
    const attrNames = [
      'FillColor', 'StrokeColor', 'StrokeWeight', 'Opacity',
      'FontStyle', 'PointSize', 'Justification', 'Tracking',
      'KerningMethod', 'Leading', 'Hyphenation', 'LeftIndent',
      'RightIndent', 'FirstLineIndent', 'SpaceBefore', 'SpaceAfter'
    ];
    for (const attr of attrNames) {
      const val = node.getAttribute(attr);
      if (val) {
        const key = attr === 'PointSize' ? 'fontSize' : attr.charAt(0).toLowerCase() + attr.slice(1);
        styles[key] = val;
      }
    }

    const props = node.getElementsByTagName("Properties")[0];
    if (props) {
      const propMap: Record<string, string> = {
        'FillColor': 'fillColor',
        'StrokeColor': 'strokeColor',
        'StrokeWeight': 'strokeWeight',
        'Leading': 'leading',
        'Tracking': 'tracking',
        'PointSize': 'fontSize'
      };
      for (const [idmlProp, styleKey] of Object.entries(propMap)) {
        const pElem = props.getElementsByTagName(idmlProp)[0];
        if (pElem && pElem.textContent) {
          styles[styleKey] = pElem.textContent;
        }
      }
    }
    return styles;
  }

  private extractAttributesFromElement(element: Element): Record<string, string> {
    const attributes: Record<string, string> = {};
    const attrs = element.attributes;

    for (let i = 0; i < attrs.length; i++) {
      const attr = attrs[i];
      if (!['Self', 'ItemTransform', 'GeometricBounds'].includes(attr.name)) {
        attributes[attr.name] = attr.value;
      }
    }

    return attributes;
  }

  private parseStoryXML(filename: string, xmlString: string): IDMLStory | null {
    try {
      const doc = this.getParser().parseFromString(xmlString, "application/xml");
      const storyNodes = Array.from(doc.getElementsByTagName("*")).filter(n => this.getLocalName(n) === "story");
      const storyNode = storyNodes[0] as Element | undefined;
      if (!storyNode) return null;

      const selfId = storyNode.getAttribute("Self") || storyNode.getAttribute("self");
      const paragraphs: IDMLParagraph[] = [];
      const paragraphRangeElems = Array.from(doc.getElementsByTagName("ParagraphStyleRange"));

      for (const paraRange of paragraphRangeElems as Element[]) {
        const appliedStyle = paraRange.getAttribute("AppliedParagraphStyle") || "";
        const overrides: Record<string, string> = {};
        const attrNames = [
          'LeftIndent', 'RightIndent', 'FirstLineIndent', 'LastLineIndent',
          'SpaceBefore', 'SpaceAfter', 'Leading', 'PointSize', 'Justification',
          'AlignToBaseline', 'AppliedFont'
        ];

        for (const attr of attrNames) {
          const val = (paraRange as Element).getAttribute(attr);
          if (val) overrides[attr] = val;
        }

        const props = paraRange.getElementsByTagName('Properties')[0];
        if (props) {
          attrNames.forEach(attr => {
            const pElem = props.getElementsByTagName(attr)[0] as Element | undefined;
            if (pElem && pElem.textContent) overrides[attr] = pElem.textContent;
          });
        }

        const charRanges = this.extractCharacterRangesFromParagraph(paraRange);
        let currentParaContent: IDMLCharacterRange[] = [];

        for (const cr of charRanges) {
          if (cr.content.includes('\r')) {
            const parts = cr.content.split('\r');
            for (let i = 0; i < parts.length; i++) {
              if (parts[i].length > 0) {
                currentParaContent.push({ ...cr, content: parts[i] });
              }
              if (i < parts.length - 1) {
                paragraphs.push({
                  appliedStyle,
                  overrides: { ...overrides },
                  characterRanges: [...currentParaContent]
                });
                currentParaContent = [];
              }
            }
          } else {
            currentParaContent.push(cr);
          }
        }
        if (currentParaContent.length > 0) {
          paragraphs.push({
            appliedStyle,
            overrides: { ...overrides },
            characterRanges: currentParaContent
          });
        }
      }

      const storyScriptLabel = this.findScriptLabel(storyNode as Element);
      const isLeyendaStory = storyScriptLabel && storyScriptLabel.toUpperCase().startsWith('LEYENDA');

      let fullText = "";
      paragraphs.forEach((p, idx) => {
        p.characterRanges.forEach(cr => {
          if (isLeyendaStory) {
            const font = cr.attributes?.['AppliedFont'] || '';
            if (font.toLowerCase().includes('zapfdingbats')) return;
            if (cr.appliedStyle && cr.appliedStyle.includes('CREDITOLEYENDA')) {
              fullText += '@@' + cr.content;
              return;
            }
          }
          fullText += cr.content;
        });
        if (idx < paragraphs.length - 1) fullText += "\n\n";
      });

      return {
        id: normalizeId(selfId || filename),
        name: filename,
        content: fullText.trim(),
        originalXml: xmlString,
        isModified: false,
        initialWordCount: fullText.trim().split(/\s+/).filter(w => w.length > 0).length,
        initialCharCount: fullText.trim().length,
        scriptLabel: this.findScriptLabel(storyNode as Element),
        paragraphs
      };
    } catch (e) {
      console.error("Error parsing story:", filename, e);
      return null;
    }
  }

  private extractCharacterRangesFromParagraph(paraRange: Element): IDMLCharacterRange[] {
    const charRanges: IDMLCharacterRange[] = [];
    const characterStyleRanges = Array.from(paraRange.getElementsByTagName('CharacterStyleRange'));

    for (const charRange of characterStyleRanges as Element[]) {
      const appliedStyle = charRange.getAttribute('AppliedCharacterStyle') || "";
      let combinedContent = '';
      const children = charRange.childNodes;
      for (let j = 0; j < children.length; j++) {
        const child = children[j];
        if (this.getLocalName(child) === 'content') {
          combinedContent += child.textContent || '';
        } else if (this.getLocalName(child) === 'br') {
          combinedContent += '\r';
        }
      }

      if (combinedContent.length > 0) {
        charRanges.push({
          appliedStyle,
          content: combinedContent,
          attributes: this.extractCharacterRangeAttributes(charRange),
          originalNode: charRange
        });
      }
    }
    return charRanges;
  }

  private extractCharacterRangeAttributes(charRange: Element): Record<string, string> {
    const attrs: Record<string, string> = {};
    const attrNames = [
      'FillColor', 'StrokeColor', 'FontStyle', 'PointSize', 'Tracking',
      'KerningMethod', 'HorizontalScale', 'VerticalScale', 'BaselineShift',
      'Capitalization', 'Ligatures', 'Underline', 'StrikeThru', 'AppliedFont'
    ];

    for (const attrName of attrNames) {
      const value = charRange.getAttribute(attrName);
      if (value) attrs[attrName] = value;
    }

    const props = charRange.getElementsByTagName('Properties')[0];
    if (props) {
      attrNames.forEach(attr => {
        const pElem = props.getElementsByTagName(attr)[0];
        if (pElem && pElem.textContent) attrs[attr] = pElem.textContent;
      });
    }
    return attrs;
  }

  private isBulletParagraph(charRanges: IDMLCharacterRange[]): boolean {
    if (charRanges.length < 3) return false;
    const firstRange = charRanges[0];

    // Si el primer rango contiene un objeto anclado, no lo tratamos como bala de texto
    // para evitar duplicidad, ya que los objetos anclados se manejan globalmente.
    if (firstRange.content.includes('\uFFFC')) return false;

    const font = firstRange.attributes?.['AppliedFont'] || '';
    if (font.toLowerCase().includes('zapfdingbats')) return true;
    if (firstRange.appliedStyle && firstRange.appliedStyle.toLowerCase().includes('bala')) return true;
    if (firstRange.content.length > 0 && firstRange.content.length < 5 && charRanges.length >= 2) {
      const secondRange = charRanges[1];
      if (secondRange.content.trim().length === 0 && secondRange.content.length < 10) return true;
    }
    return false;
  }

  private parseTextWithIntertitles(text: string): Array<{ type: 'normal' | 'intertitle', text: string }> {
    const segments: Array<{ type: 'normal' | 'intertitle', text: string }> = [];
    const intertitleRegex = /\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match;
    while ((match = intertitleRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        segments.push({ type: 'normal', text: text.slice(lastIndex, match.index) });
      }
      segments.push({ type: 'intertitle', text: match[1] });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < text.length) {
      segments.push({ type: 'normal', text: text.slice(lastIndex) });
    }
    return segments.length > 0 ? segments : [{ type: 'normal', text }];
  }

  private createParagraphRange(
    doc: Document,
    text: string,
    bulletTemplate: { ranges: IDMLCharacterRange[], paragraphStyle: string } | null,
    basePTemplate: Element | null,
    charTemplate?: Element | null,
    overrideStyle?: string
  ): Element {
    const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");

    if (overrideStyle) {
      pRange.setAttribute("AppliedParagraphStyle", overrideStyle);
    } else if (bulletTemplate) {
      pRange.setAttribute("AppliedParagraphStyle", bulletTemplate.paragraphStyle);
    }

    if (bulletTemplate) {
      for (let i = 0; i < Math.min(2, bulletTemplate.ranges.length); i++) {
        const charRange = bulletTemplate.ranges[i];
        if (charRange.originalNode) {
          const importedRange = doc.importNode(charRange.originalNode, true) as Element;
          pRange.appendChild(importedRange);
        }
      }

      let textRange: Element;
      if (bulletTemplate.ranges.length >= 3 && bulletTemplate.ranges[2].originalNode) {
        textRange = doc.importNode(bulletTemplate.ranges[2].originalNode, true) as Element;
        const children = Array.from(textRange.childNodes);
        for (const child of children) {
          const name = this.getLocalName(child);
          if (name === 'content' || name === 'br') {
            textRange.removeChild(child);
          }
        }
      } else {
        textRange = doc.createElement("CharacterStyleRange");
        textRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
      }

      const content = doc.createElement("Content");
      content.textContent = text || "";
      textRange.appendChild(content);

      const br = doc.createElement("Br");
      textRange.appendChild(br);

      pRange.appendChild(textRange);
    } else {
      let textRange: Element;
      if (charTemplate) {
        textRange = charTemplate.cloneNode(false) as Element;
        const templateProps = charTemplate.getElementsByTagName('Properties')[0];
        if (templateProps) {
          textRange.appendChild(doc.importNode(templateProps, true));
        }
      } else {
        textRange = doc.createElement("CharacterStyleRange");
        textRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
      }

      const content = doc.createElement("Content");
      content.textContent = text || "";
      textRange.appendChild(content);

      const br = doc.createElement("Br");
      textRange.appendChild(br);

      pRange.appendChild(textRange);
    }
    return pRange;
  }

  private createBlankParagraph(doc: Document, basePTemplate: Element | null): Element {
    const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");
    const cRange = doc.createElement("CharacterStyleRange");
    cRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
    const content = doc.createElement("Content");
    content.textContent = ""; // Párrafo vacío solo con Br
    cRange.appendChild(content);

    const br = doc.createElement("Br");
    cRange.appendChild(br);

    pRange.appendChild(cRange);
    return pRange;
  }

  private resolveParagraphStyle(styleName: string): string {
    const normalize = (s: string) => s ? s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase() : "";
    const target = normalize(styleName);

    for (const [key, style] of Object.entries(this.styles)) {
      if ((style as any).type === 'paragraph') {
        const name = (style as any).name || "";
        const self = (style as any).self || "";
        if (normalize(name) === target) return self;
        const decodedSelf = decodeURIComponent(self);
        const parts = decodedSelf.split(/[:/]/);
        const lastName = parts.pop();
        if (normalize(lastName) === target) return self;
      }
    }
    return `ParagraphStyle/${styleName}`;
  }

  private getUpdatedStoryXml(story: IDMLStory, newText: string): string {
    const doc = this.getParser().parseFromString(story.originalXml, "application/xml");
    const storyNode = (Array.from(doc.getElementsByTagName("*")) as Element[]).find(n => {
      const localName = this.getLocalName(n);
      return localName === "story" && n.hasAttribute("Self");
    });
    if (!storyNode) return this.getSerializer().serializeToString(doc);

    const anchoredObjects: Element[] = [];
    const allOriginalCSR = Array.from(storyNode.getElementsByTagName('CharacterStyleRange'));
    allOriginalCSR.forEach(csr => {
      let containsObject = false;
      const children = Array.from(csr.childNodes);

      // Check if this CSR has an anchored object
      for (const child of children) {
        if (child.nodeType === 1) {
          const lName = this.getLocalName(child);
          if (!['properties', 'content', 'br'].includes(lName)) {
            containsObject = true;
            break;
          }
        }
      }

      if (containsObject) {
        // Clone the whole CSR to preserve all its attributes (Tracking, font, size, etc.)
        const newCsr = csr.cloneNode(false) as Element;
        let objectMarkerFound = false;

        children.forEach(child => {
          if (child.nodeType === 1) {
            const lName = this.getLocalName(child);
            if (!['properties', 'content', 'br'].includes(lName)) {
              // It's the anchored object itself (Rectangle, Group, etc.)
              newCsr.appendChild(child.cloneNode(true));
            } else if (lName === 'properties') {
              // Preserve properties
              newCsr.appendChild(child.cloneNode(true));
            } else if (lName === 'content') {
              // Preserve ONLY special markers, not actual line text
              const text = child.textContent || '';
              let preserved = '';
              for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                // 0xFFFC (Object Replacement), 8 (Anchored record)
                if (code === 0xFFFC || code === 8) {
                  preserved += text[i];
                  objectMarkerFound = true;
                }
              }
              if (preserved.length > 0) {
                const clonedContent = child.cloneNode(false) as Element;
                clonedContent.textContent = preserved;
                newCsr.appendChild(clonedContent);
              }
            }
          }
        });

        // Ensure at least one marker exists if we found an object
        if (!objectMarkerFound) {
          const c = doc.createElement("Content");
          c.textContent = "\uFFFC";
          newCsr.appendChild(c);
        }

        // --- LAYOUT RESET TO REMOVE INVISIBLE SPACES ---
        // We clear attributes that affect spacing between the marker and the next character
        const attributesToRemove = ['Tracking', 'KerningValue', 'KerningMethod', 'BaselineShift', 'HorizontalScale'];
        attributesToRemove.forEach(attr => newCsr.removeAttribute(attr));

        // Force a very small point size for the marker to minimize its width
        newCsr.setAttribute('PointSize', '0.1');

        const props = newCsr.getElementsByTagName('Properties')[0];
        if (props) {
          const tagsToRemove = ['Tracking', 'KerningValue', 'KerningMethod', 'BaselineShift', 'HorizontalScale', 'PointSize'];
          tagsToRemove.forEach(tagName => {
            const el = props.getElementsByTagName(tagName)[0];
            if (el) props.removeChild(el);
          });
        }

        anchoredObjects.push(newCsr);
      }
    });

    const firstPRange = storyNode.getElementsByTagName("ParagraphStyleRange")[0] as Element | null;
    const cloneRangeWithProperties = (source: Element | null): Element | null => {
      if (!source) return null;
      const clone = doc.createElement(source.tagName);
      for (let i = 0; i < source.attributes.length; i++) {
        const attr = source.attributes[i];
        clone.setAttribute(attr.name, attr.value);
      }
      const props = source.getElementsByTagName("Properties")[0];
      if (props) {
        clone.appendChild(props.cloneNode(true));
      }
      return clone;
    };

    const basePTemplate = cloneRangeWithProperties(firstPRange);
    const isLeyenda = story.scriptLabel && story.scriptLabel.toUpperCase().startsWith('LEYENDA');

    let firstCharTemplate: Element | null = null;
    let creditoLeyendaTemplate: Element | null = null;
    let leyendaBulletNode: Element | null = null;
    let bulletTemplate: { ranges: IDMLCharacterRange[], paragraphStyle: string } | null = null;

    if (isLeyenda && firstPRange) {
      const allCSR = firstPRange.getElementsByTagName('CharacterStyleRange');
      for (let i = 0; i < allCSR.length; i++) {
        const csr = allCSR[i] as Element;
        const style = csr.getAttribute('AppliedCharacterStyle') || '';
        if (style.includes('CREDITOLEYENDA')) {
          creditoLeyendaTemplate = cloneRangeWithProperties(csr);
          continue;
        }
        const fontAttr = csr.getAttribute('AppliedFont') || '';
        const propsEl = csr.getElementsByTagName('Properties')[0];
        const appliedFontEl = propsEl?.getElementsByTagName('AppliedFont')[0];
        const fontFromProps = appliedFontEl?.textContent || '';
        const font = fontAttr || fontFromProps;
        const contentEl = csr.getElementsByTagName('Content')[0];
        const contentText = contentEl?.textContent || '';
        if (font.toLowerCase().includes('zapfdingbats') && contentText.trim().length <= 3) {
          leyendaBulletNode = csr;
          continue;
        }
        if (!firstCharTemplate) {
          firstCharTemplate = cloneRangeWithProperties(csr);
        }
      }
    } else {
      const hasBullets = story.paragraphs && story.paragraphs.length > 0 &&
        this.isBulletParagraph(story.paragraphs[0].characterRanges);
      bulletTemplate = hasBullets ? {
        ranges: story.paragraphs[0].characterRanges,
        paragraphStyle: story.paragraphs[0].appliedStyle
      } : null;
    }

    const children = Array.from(storyNode.childNodes);
    for (const child of children) {
      const name = this.getLocalName(child);
      if (name !== 'properties') {
        storyNode.removeChild(child);
      }
    }

    if (newText.trim().length === 0) {
      storyNode.appendChild(this.createBlankParagraph(doc, basePTemplate));
      if (anchoredObjects.length > 0) {
        const firstP = storyNode.getElementsByTagName("ParagraphStyleRange")[0];
        if (firstP) {
          anchoredObjects.reverse().forEach(ao => {
            firstP.insertBefore(ao, firstP.firstChild);
          });
        }
      }
      return this.getSerializer().serializeToString(doc);
    }

    const segments = this.parseTextWithIntertitles(newText);
    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const segment = segments[segIdx];
      if (segment.type === 'intertitle') {
        const intertitleStyle = this.resolveParagraphStyle("INTERTITULO");
        const pRange = this.createParagraphRange(doc, segment.text.trim(), null, basePTemplate, null, intertitleStyle);
        storyNode.appendChild(pRange);
      } else {
        const paragraphs = segment.text.split(/\r?\n/);
        for (let i = 0; i < paragraphs.length; i++) {
          const line = paragraphs[i].trim();
          if (line.length === 0) continue;

          if (isLeyenda) {
            let mText = line;
            let cText = '';
            if (line.includes('@@')) {
              const atIdx = line.indexOf('@@');
              mText = line.substring(0, atIdx).trimEnd();
              cText = line.substring(atIdx + 2).trim();
            }
            const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");
            if (leyendaBulletNode) {
              const bulletClone = doc.importNode(leyendaBulletNode, true) as Element;
              pRange.appendChild(bulletClone);
            }
            if (mText.length > 0) {
              let textRange: Element;
              if (firstCharTemplate) {
                textRange = firstCharTemplate.cloneNode(false) as Element;
                const templateProps = firstCharTemplate.getElementsByTagName('Properties')[0];
                if (templateProps) textRange.appendChild(doc.importNode(templateProps, true));
              } else {
                textRange = doc.createElement("CharacterStyleRange");
                textRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
              }
              const content = doc.createElement("Content");
              content.textContent = mText;
              textRange.appendChild(content);

              const br = doc.createElement("Br");
              textRange.appendChild(br);

              pRange.appendChild(textRange);
            }
            if (cText.length > 0) {
              let creditRange: Element;
              if (creditoLeyendaTemplate) {
                creditRange = creditoLeyendaTemplate.cloneNode(false) as Element;
                const templateProps = creditoLeyendaTemplate.getElementsByTagName('Properties')[0];
                if (templateProps) creditRange.appendChild(doc.importNode(templateProps, true));
              } else {
                creditRange = doc.createElement("CharacterStyleRange");
                creditRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/CREDITOLEYENDA");
              }
              const content = doc.createElement("Content");
              content.textContent = cText;
              const br = doc.createElement("Br");
              creditRange.appendChild(content);
              creditRange.appendChild(br);
              pRange.appendChild(creditRange);
            }
            storyNode.appendChild(pRange);
          } else {
            const pRange = this.createParagraphRange(doc, line, bulletTemplate, basePTemplate, firstCharTemplate);
            storyNode.appendChild(pRange);
          }
        }
      }
    }

    if (anchoredObjects.length > 0) {
      const firstP = storyNode.getElementsByTagName("ParagraphStyleRange")[0];
      if (firstP) {
        // Invertimos el orden para insertarlos al principio conservando el orden original
        [...anchoredObjects].reverse().forEach(ao => {
          firstP.insertBefore(ao, firstP.firstChild);
        });
      } else {
        const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");
        anchoredObjects.forEach(ao => pRange.appendChild(ao));
        storyNode.appendChild(pRange);
      }
    }

    return this.getSerializer().serializeToString(doc);
  }

  async updateImage(imageTag: string, file: File): Promise<void> {
    if (!this.zip) return;
    for (const spread of this.spreads.values()) {
      const frame = spread.imageFrames.find(f => f.scriptLabel === imageTag);
      if (!frame) continue;
      const linkPath = `Links/${file.name}`;
      const fileData = await file.arrayBuffer();
      this.zip.file(linkPath, fileData);
      const doc = (this.getParser() as DOMParser).parseFromString(spread.originalXml, "application/xml");
      const allRects = Array.from(doc.getElementsByTagName("*")).filter(n => ['rectangle', 'oval', 'polygon'].includes(this.getLocalName(n as Node)));
      for (const rect of allRects) {
        if (this.findScriptLabel(rect as Element) === imageTag) {
          const imageNode = Array.from((rect as Element).getElementsByTagName("*")).find(n => ['image', 'pdf', 'eps', 'importedpage'].includes(this.getLocalName(n as Node)));
          const linkNode = imageNode ? Array.from((imageNode as Element).getElementsByTagName("*")).find(n => ['link', 'Link'].includes(this.getLocalName(n as Node))) : null;
          if (linkNode) {
            const destFolder = this.automaticRelink.destinationFolder || "Links";
            const relativeBase = destFolder === "." || destFolder === "" ? "file:" : `file:${destFolder}/`;
            (linkNode as Element).setAttribute("LinkResourceURI", `${relativeBase}${file.name}`);
          }
        }
      }
      const newXml = this.getSerializer().serializeToString(doc);
      spread.originalXml = newXml;
      this.zip.file(spread.id, newXml);
    }
  }

  async bulkUpdateImages(imageUpdates: Array<{ tag: string, file: File }>): Promise<void> {
    if (!this.zip || imageUpdates.length === 0) return;
    console.log(`[IDML Engine] Bulk update started for ${imageUpdates.length} images`);
    const imageData = await Promise.all(imageUpdates.map(async u => {
      const extension = u.file.name.includes('.') ? u.file.name.split('.').pop() : 'jpg';
      const safeTagName = u.tag.trim().replace(/[^a-zA-Z0-9_]/g, '_').toUpperCase();
      return {
        tag: u.tag,
        name: `${safeTagName}.${extension}`,
        data: await u.file.arrayBuffer()
      };
    }));
    for (const img of imageData) {
      this.zip.file(`Links/${img.name}`, img.data);
    }
    const updateMap = new Map<string, string>();
    for (const img of imageData) {
      updateMap.set(normalizeTag(img.tag), img.name);
    }
    for (const spread of this.spreads.values()) {
      if (!spread || !spread.imageFrames) continue;
      const hasUpdates = spread.imageFrames.some(f => f.scriptLabel && updateMap.has(normalizeTag(f.scriptLabel)));
      if (!hasUpdates) continue;
      const doc = (this.getParser() as DOMParser).parseFromString(spread.originalXml, "application/xml");
      const allRects = Array.from(doc.getElementsByTagName("*")).filter(n => ['rectangle', 'oval', 'polygon'].includes(this.getLocalName(n as Node)));
      let modified = false;
      for (const rect of allRects) {
        const tag = this.findScriptLabel(rect as Element);
        const normTag = tag ? normalizeTag(tag) : null;
        if (normTag && updateMap.has(normTag)) {
          const fileName = updateMap.get(normTag)!;
          const imageNode = Array.from((rect as Element).getElementsByTagName("*")).find(n => ['image', 'pdf', 'eps', 'importedpage'].includes(this.getLocalName(n as Node)));
          const linkNode = imageNode ? Array.from((imageNode as Element).getElementsByTagName("*")).find(n => ['link', 'Link'].includes(this.getLocalName(n as Node))) : null;
          if (linkNode) {
            const destFolder = this.automaticRelink.destinationFolder || "Links";
            const relativeBase = destFolder === "." || destFolder === "" ? "file:" : `file:${destFolder}/`;
            (linkNode as Element).setAttribute("LinkResourceURI", `${relativeBase}${fileName}`);
            modified = true;
          }
        }
      }
      if (modified) {
        const newXml = this.getSerializer().serializeToString(doc);
        spread.originalXml = newXml;
        this.zip.file(spread.id, newXml);
      }
    }
    console.log(`[IDML Engine] Bulk update finished`);
  }

  setAutomaticRelink(enabled: boolean, destinationFolder?: string) {
    this.automaticRelink = { enabled, destinationFolder };
  }

  async generateBlob(currentStories: IDMLStory[]): Promise<Blob> {
    if (!this.zip) throw new Error("No hay archivo IDML cargado");
    const updatesMap = new Map<string, IDMLStory>();
    for (const story of currentStories) {
      updatesMap.set(normalizeId(story.id), story);
    }
    for (const originalStory of Array.from(this.stories.values())) {
      if (!originalStory.scriptLabel) continue;
      const update = updatesMap.get(normalizeId(originalStory.id));
      const newContent = (update && update.isModified) ? (update.content || "") : "";
      const updatedXml = this.getUpdatedStoryXml(originalStory, newContent);
      this.zip.file(originalStory.name, updatedXml);
    }
    if (this.automaticRelink.enabled) {
      const destFolder = this.automaticRelink.destinationFolder || ".";
      const relativeBase = destFolder === "." || destFolder === "" ? "file:" : `file:${destFolder}/`;
      for (const spread of this.spreads.values()) {
        const doc = (this.getParser() as DOMParser).parseFromString(spread.originalXml, "application/xml");
        const links = Array.from(doc.getElementsByTagName("Link"));
        let modified = false;
        for (const link of links) {
          const uri = (link as Element).getAttribute("LinkResourceURI");
          if (uri) {
            const fileName = this.extractFileNameFromURI(uri);
            if (fileName) {
              (link as Element).setAttribute("LinkResourceURI", `${relativeBase}${fileName}`);
              modified = true;
            }
          }
        }
        if (modified) {
          const newXml = this.getSerializer().serializeToString(doc);
          spread.originalXml = newXml;
          this.zip.file(spread.id, newXml);
        }
      }
    }
    return await this.zip.generateAsync({ type: "blob" });
  }

  async generateDownload(currentStories: IDMLStory[], customFileName?: string): Promise<void> {
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;
    try {
      const blob = await this.generateBlob(currentStories);
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      link.download = (customFileName && customFileName.trim()) ? customFileName.trim() : this.originalFileName.replace(".idml", "_updated.idml");
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        if (link && link.parentNode) link.parentNode.removeChild(link);
        if (url) URL.revokeObjectURL(url);
      }, 100);
    } catch (error) {
      if (link && link.parentNode) link.parentNode.removeChild(link);
      if (url) URL.revokeObjectURL(url);
      console.error("Error en generateDownload:", error);
      throw error;
    }
  }

  loadMock(): { stories: IDMLStory[]; spreads: IDMLSpread[] } {
    const mockStory: IDMLStory = {
      id: "mock1",
      name: "Stories/Story_u123.xml",
      content: "Bienvenido al Informe Anual.",
      originalXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0"><Story Self="u123"><ParagraphStyleRange><CharacterStyleRange><Content>Bienvenido al Informe Anual.</Content></CharacterStyleRange></ParagraphStyleRange></Story></idPkg:Story>`,
      initialWordCount: 4,
      initialCharCount: 22,
      scriptLabel: "INTRO_TEXT"
    };
    const mockSobrantes: IDMLStory = {
      id: "mockSobrantes",
      name: "Stories/Story_u999.xml",
      content: "",
      originalXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><idPkg:Story xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging" DOMVersion="18.0"><Story Self="u999"><ParagraphStyleRange><CharacterStyleRange><Content></Content></CharacterStyleRange></ParagraphStyleRange></Story></idPkg:Story>`,
      initialWordCount: 0,
      initialCharCount: 0,
      scriptLabel: "SOBRANTES"
    };
    const mockSpread: IDMLSpread = {
      id: "Spreads/Spread_u456.xml",
      name: "Spreads/Spread_u456.xml",
      frames: [
        { id: "f1", storyId: "mock1", bounds: [0, 0, 0, 0], scriptLabel: "INTRO_TEXT", pageId: "p1" },
        { id: "f2", storyId: "mockSobrantes", bounds: [0, 0, 0, 0], scriptLabel: "SOBRANTES", pageId: "p1" }
      ],
      imageFrames: [], genericFrames: [], pages: [{ id: "p1", offsetX: 0, offsetY: 0 }],
      originalXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Spread Self="u456"><TextFrame Self="tf1" ParentStory="u123"><Properties><Label><KeyValuePair Key="label" Value="INTRO_TEXT"/></Label></Properties></TextFrame><TextFrame Self="tf2" ParentStory="u999"><Properties><Label><KeyValuePair Key="label" Value="SOBRANTES"/></Label></Properties></TextFrame></Spread>`
    };
    this.stories.set("mock1", mockStory);
    this.stories.set("mockSobrantes", mockSobrantes);
    this.spreads.set("Spreads/Spread_u456.xml", mockSpread);
    return { stories: [mockStory, mockSobrantes], spreads: [mockSpread] };
  }

  exportToJSON(currentStories: IDMLStory[]) {
    return {
      metadata: { originalFileName: this.originalFileName, pageSettings: this.pageSettings, fonts: this.fonts, swatches: this.swatches, styles: this.styles },
      stories: currentStories.map(s => ({
        id: s.id, scriptLabel: s.scriptLabel,
        paragraphs: s.paragraphs?.map(p => ({
          appliedStyle: p.appliedStyle, overrides: p.overrides,
          characterRanges: p.characterRanges.map(cr => ({ content: cr.content, appliedStyle: cr.appliedStyle, attributes: cr.attributes }))
        }))
      })),
      spreads: Array.from(this.spreads.values()).map(spread => ({
        id: spread.id, type: spread.type, pages: spread.pages,
        frames: spread.frames.map(f => ({ id: f.id, storyId: f.storyId, bounds: f.bounds, pageId: f.pageId, scriptLabel: f.scriptLabel, columnCount: f.columnCount, columnGutter: f.columnGutter, styles: f.styles })),
        imageFrames: spread.imageFrames.map(f => ({ id: f.id, scriptLabel: f.scriptLabel, fileName: f.fileName, bounds: f.bounds, pageId: f.pageId, styles: f.styles })),
        genericFrames: spread.genericFrames.map(f => ({ id: f.id, contentType: f.contentType, scriptLabel: f.scriptLabel, bounds: f.bounds, pageId: f.pageId, styles: f.styles }))
      }))
    };
  }
}

export const idmlEngine = new IDMLEngine();
