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
  public pageSettings: { width: number, height: number } = { width: 595.275590551181, height: 841.889763779528 };
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
    if (!window.JSZip) throw new Error("JSZip no cargado");
    this.originalFileName = file.name;

    try {
      this.zip = new window.JSZip();
      const zipContent = await this.zip.loadAsync(file);

      this.stories.clear();
      this.spreads.clear();

      const storyFiles: any[] = [];
      const spreadFiles: any[] = [];

      zipContent.forEach((relativePath, zipEntry) => {
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
          for (const spread of this.spreads.values()) {
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
          const attr = elem.attributes[i];
          attrs[attr.name] = attr.value;
        }
        // También buscar en <Properties>
        const props = elem.getElementsByTagName("Properties")[0];
        if (props) {
          for (let i = 0; i < props.children.length; i++) {
            const child = props.children[i];
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
        const c = colors[i];
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
        const t = tints[i];
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
      const docElem = doc.getElementsByTagName("Document")[0];
      if (docElem) {
        const zp = docElem.getAttribute("ZeroPoint");
        if (zp) {
          const parts = zp.split(' ').map(Number);
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
        this.fonts.push({
          name: fontElems[i].getAttribute("Name"),
          postScript: fontElems[i].getAttribute("PostScriptName")
        });
      }
    }
  }

  private getLocalName(node: Node): string {
    return (node instanceof Element ? (node.localName || node.tagName.split(':').pop() || "") : "").toLowerCase();
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

            // Extraer preferencias de columnas de forma más robusta (como en idml2typst)
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
            // Nota: Permitimos imageFrames sin etiquetas para que aparezcan en el preview
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
            // Es un elemento genérico (rectángulo de color, polígono, etc)
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

    // Identificar a qué página pertenece este frame basándose en su centro
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

    // Ajustar coordenadas relativas a la página
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

    // Buscar en <Properties>
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
      const storyNode = Array.from(doc.getElementsByTagName("*")).find(n => this.getLocalName(n) === "story");
      if (!storyNode) return null;

      const selfId = storyNode.getAttribute("Self") || storyNode.getAttribute("self");
      const paragraphs: IDMLParagraph[] = [];
      const paragraphRangeElems = Array.from(doc.getElementsByTagName("ParagraphStyleRange"));

      for (const paraRange of paragraphRangeElems) {
        const appliedStyle = paraRange.getAttribute("AppliedParagraphStyle") || "";
        const overrides: Record<string, string> = {};
        const attrNames = [
          'LeftIndent', 'RightIndent', 'FirstLineIndent', 'LastLineIndent',
          'SpaceBefore', 'SpaceAfter', 'Leading', 'PointSize', 'Justification',
          'AlignToBaseline', 'AppliedFont'
        ];

        for (const attr of attrNames) {
          const val = paraRange.getAttribute(attr);
          if (val) overrides[attr] = val;
        }

        const props = paraRange.getElementsByTagName('Properties')[0];
        if (props) {
          attrNames.forEach(attr => {
            const pElem = props.getElementsByTagName(attr)[0];
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
            // Saltar la bala (ZapfDingbats) - se preserva internamente
            const font = cr.attributes?.['AppliedFont'] || '';
            if (font.toLowerCase().includes('zapfdingbats')) return;
            // Insertar @@ antes del crédito para round-trip
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

    for (const charRange of characterStyleRanges) {
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
          originalNode: charRange  // Guardar nodo completo para clonación exacta
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

  /**
   * Detecta si un párrafo tiene bullets basándose en sus CharacterStyleRanges.
   * Criterios: fuente ZapfDingbats, estilo con "bala", o primer rango muy corto.
   */
  private isBulletParagraph(charRanges: IDMLCharacterRange[]): boolean {
    if (charRanges.length < 3) return false;

    const firstRange = charRanges[0];

    // Detectar por fuente ZapfDingbats
    const font = firstRange.attributes?.['AppliedFont'] || '';
    if (font.toLowerCase().includes('zapfdingbats')) {
      return true;
    }

    // Detectar por estilo de carácter específico (ej: BALACHIMENEA)
    if (firstRange.appliedStyle &&
      firstRange.appliedStyle.toLowerCase().includes('bala')) {
      return true;
    }

    // Detectar por longitud corta del primer rango (< 5 caracteres) y que tenga espaciado después
    if (firstRange.content.length > 0 && firstRange.content.length < 5 && charRanges.length >= 2) {
      const secondRange = charRanges[1];
      // El segundo rango debería ser espaciado (muy corto)
      if (secondRange.content.trim().length === 0 && secondRange.content.length < 10) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parsea el texto buscando intertítulos marcados con **texto**.
   * Retorna segmentos alternando entre texto normal e intertítulos.
   */
  private parseTextWithIntertitles(text: string): Array<{ type: 'normal' | 'intertitle', text: string }> {
    const segments: Array<{ type: 'normal' | 'intertitle', text: string }> = [];
    const intertitleRegex = /\*\*([^*]+)\*\*/g;

    let lastIndex = 0;
    let match;

    while ((match = intertitleRegex.exec(text)) !== null) {
      // Texto antes del intertítulo
      if (match.index > lastIndex) {
        const beforeText = text.slice(lastIndex, match.index);
        if (beforeText.trim().length > 0) {
          segments.push({
            type: 'normal',
            text: beforeText
          });
        }
      }

      // Intertítulo
      segments.push({
        type: 'intertitle',
        text: match[1]
      });

      lastIndex = match.index + match[0].length;
    }

    // Texto después del último intertítulo
    if (lastIndex < text.length) {
      const afterText = text.slice(lastIndex);
      if (afterText.trim().length > 0) {
        segments.push({
          type: 'normal',
          text: afterText
        });
      }
    }

    return segments.length > 0 ? segments : [{ type: 'normal', text }];
  }

  /**
   * Crea un ParagraphStyleRange con o sin bullets.
   * Si bulletTemplate está presente, clona los primeros 2 rangos (bullet + espaciado).
   */
  private createParagraphRange(
    doc: Document,
    text: string,
    bulletTemplate: { ranges: IDMLCharacterRange[], paragraphStyle: string } | null,
    basePTemplate: Element | null,
    charTemplate?: Element | null
  ): Element {
    const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");

    if (bulletTemplate) {
      pRange.setAttribute("AppliedParagraphStyle", bulletTemplate.paragraphStyle);

      // Clonar bullet ranges (símbolo + espaciado) - primeros 2 rangos
      for (let i = 0; i < Math.min(2, bulletTemplate.ranges.length); i++) {
        const charRange = bulletTemplate.ranges[i];
        if (charRange.originalNode) {
          const importedRange = doc.importNode(charRange.originalNode, true) as Element;
          pRange.appendChild(importedRange);
        }
      }

      // Clonar el tercer rango completo (texto principal) usando Deep Clone para preservar TODO (Properties, etc)
      let textRange: Element;
      if (bulletTemplate.ranges.length >= 3 && bulletTemplate.ranges[2].originalNode) {
        // Importar nodo completo con hijos (true)
        textRange = doc.importNode(bulletTemplate.ranges[2].originalNode, true) as Element;

        // Limpiar SOLO el contenido existente (Content y Br), preservando Properties
        const children = Array.from(textRange.childNodes);
        for (const child of children) {
          const name = this.getLocalName(child);
          if (name === 'content' || name === 'br') {
            textRange.removeChild(child);
          }
        }
      } else {
        // Fallback: crear uno nuevo
        textRange = doc.createElement("CharacterStyleRange");
        textRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
      }

      // Agregar el nuevo contenido
      const lines = text.split(/\n/);
      lines.forEach((line, idx) => {
        if (line.length > 0) {
          const content = doc.createElement("Content");
          content.textContent = line;
          textRange.appendChild(content);
        }
        if (idx < lines.length - 1) {
          textRange.appendChild(doc.createElement("Br"));
        }
      });

      pRange.appendChild(textRange);
    } else {
      // Párrafo sin bullet
      let textRange: Element;
      if (charTemplate) {
        // Usar la plantilla de estilo de carácter (ej: LEYENDA)
        textRange = charTemplate.cloneNode(false) as Element;
        // Copiar Properties del template si existen
        const templateProps = charTemplate.getElementsByTagName('Properties')[0];
        if (templateProps) {
          textRange.appendChild(doc.importNode(templateProps, true));
        }
      } else {
        textRange = doc.createElement("CharacterStyleRange");
        textRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
      }

      const lines = text.split(/\n/);
      lines.forEach((line, idx) => {
        if (line.length > 0) {
          const content = doc.createElement("Content");
          content.textContent = line;
          textRange.appendChild(content);
        }
        if (idx < lines.length - 1) {
          textRange.appendChild(doc.createElement("Br"));
        }
      });

      pRange.appendChild(textRange);
    }

    return pRange;
  }

  /**
   * Crea un párrafo en blanco (ParagraphStyleRange vacío) usando la plantilla base.
   */
  private createBlankParagraph(doc: Document, basePTemplate: Element | null): Element {
    const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");
    const cRange = doc.createElement("CharacterStyleRange");
    cRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
    pRange.appendChild(cRange);
    return pRange;
  }

  /**
   * Genera el XML actualizado para una historia específica basándose en su contenido actual.
   * Detecta y preserva bullets automáticamente.
   * Detecta patrones **texto** y los convierte a párrafos con estilo INTERTITULO con líneas en blanco.
   */
  private getUpdatedStoryXml(story: IDMLStory, newText: string): string {
    const doc = this.getParser().parseFromString(story.originalXml, "application/xml");
    const allElements = Array.from(doc.getElementsByTagName("*"));
    const storyNode = allElements.find(n => {
      const localName = this.getLocalName(n);
      return localName === "story" && (n as Element).hasAttribute("Self");
    }) as Element;

    if (!storyNode) return this.getSerializer().serializeToString(doc);

    // Guardar plantilla del primer párrafo para estructura básica
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

    // Detectar si es LEYENDA
    const isLeyenda = story.scriptLabel && story.scriptLabel.toUpperCase().startsWith('LEYENDA');

    // Para LEYENDA: capturar las 3 partes por separado (bala, texto, crédito)
    let firstCharTemplate: Element | null = null;
    let creditoLeyendaTemplate: Element | null = null;
    let leyendaBulletNode: Element | null = null;  // Nodo completo de la bala para clonar con deep copy
    let bulletTemplate: { ranges: IDMLCharacterRange[], paragraphStyle: string } | null = null;

    if (isLeyenda && firstPRange) {
      const allCSR = firstPRange.getElementsByTagName('CharacterStyleRange');
      for (let i = 0; i < allCSR.length; i++) {
        const csr = allCSR[i] as Element;
        const style = csr.getAttribute('AppliedCharacterStyle') || '';

        // Detectar CREDITOLEYENDA
        if (style.includes('CREDITOLEYENDA')) {
          creditoLeyendaTemplate = cloneRangeWithProperties(csr);
          continue;
        }

        // Detectar bala (ZapfDingbats o fuente decorativa con contenido corto)
        const fontAttr = csr.getAttribute('AppliedFont') || '';
        const propsEl = csr.getElementsByTagName('Properties')[0];
        const appliedFontEl = propsEl?.getElementsByTagName('AppliedFont')[0];
        const fontFromProps = appliedFontEl?.textContent || '';
        const font = fontAttr || fontFromProps;
        const contentEl = csr.getElementsByTagName('Content')[0];
        const contentText = contentEl?.textContent || '';

        if (font.toLowerCase().includes('zapfdingbats') && contentText.trim().length <= 3) {
          // Es la bala - guardar nodo completo para deep clone
          leyendaBulletNode = csr;
          continue;
        }

        // El primer CSR que NO sea bala ni CREDITOLEYENDA es la plantilla de texto
        if (!firstCharTemplate) {
          firstCharTemplate = cloneRangeWithProperties(csr);
        }
      }
    } else {
      // Para stories normales (no LEYENDA): detectar bullets con la lógica original
      const hasBullets = story.paragraphs && story.paragraphs.length > 0 &&
        this.isBulletParagraph(story.paragraphs[0].characterRanges);

      bulletTemplate = hasBullets ? {
        ranges: story.paragraphs[0].characterRanges,
        paragraphStyle: story.paragraphs[0].appliedStyle
      } : null;
    }

    // Limpiar contenido previo preservando <Properties> si existe
    const children = Array.from(storyNode.childNodes);
    for (const child of children) {
      const name = this.getLocalName(child);
      if (name !== 'properties') {
        storyNode.removeChild(child);
      }
    }

    // Caso especial: texto vacío
    if (newText.trim().length === 0) {
      const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");
      const cRange = doc.createElement("CharacterStyleRange");
      cRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");
      pRange.appendChild(cRange);
      storyNode.appendChild(pRange);
      return this.getSerializer().serializeToString(doc);
    }

    // Procesar texto con intertítulos
    const segments = this.parseTextWithIntertitles(newText);

    for (let segIdx = 0; segIdx < segments.length; segIdx++) {
      const segment = segments[segIdx];

      if (segment.type === 'intertitle') {
        // 1. Agregar párrafo en blanco ANTES del intertítulo para separación real
        storyNode.appendChild(this.createBlankParagraph(doc, basePTemplate));

        // 2. Crear párrafo de intertítulo usando la plantilla base para preservar contexto (columnas, etc)
        const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");
        pRange.setAttribute("AppliedParagraphStyle", "ParagraphStyle/INTERTITULO");

        const cRange = doc.createElement("CharacterStyleRange");
        cRange.setAttribute("AppliedCharacterStyle", "CharacterStyle/$ID/[No character style]");

        const content = doc.createElement("Content");
        content.textContent = segment.text;
        cRange.appendChild(content);

        // NOTA: NO agregamos <Br/> después del intertítulo para que el texto siga inmediatamente
        pRange.appendChild(cRange);
        storyNode.appendChild(pRange);
      } else {
        // Texto normal - dividir por párrafos (doble salto de línea)
        const paragraphs = segment.text.trim().split(/\n{2,}/).filter(p => p.trim().length > 0);

        for (const paraText of paragraphs) {
          // Para LEYENDA: manejo especial de bala + texto + crédito
          if (isLeyenda) {
            // Separar crédito si hay @@
            let mainText = paraText;
            let creditText = '';
            if (paraText.includes('@@')) {
              const atIdx = paraText.indexOf('@@');
              mainText = paraText.substring(0, atIdx).trim();
              creditText = paraText.substring(atIdx + 2).trim();
            }

            const pRange = basePTemplate ? basePTemplate.cloneNode(false) as Element : doc.createElement("ParagraphStyleRange");

            // 1. Clonar la bala (deep copy) si existe
            if (leyendaBulletNode) {
              const bulletClone = doc.importNode(leyendaBulletNode, true) as Element;
              pRange.appendChild(bulletClone);
            }

            // 2. Rango de texto principal de la leyenda
            if (mainText.length > 0) {
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
              content.textContent = creditText.length > 0 ? mainText + ' ' : mainText;
              textRange.appendChild(content);
              pRange.appendChild(textRange);
            }

            // 3. Rango de crédito con estilo CREDITOLEYENDA (solo si hay @@)
            if (creditText.length > 0) {
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
              content.textContent = creditText;
              creditRange.appendChild(content);
              creditRange.appendChild(doc.createElement("Br"));
              pRange.appendChild(creditRange);
            }

            storyNode.appendChild(pRange);
          } else {
            const pRange = this.createParagraphRange(doc, paraText, bulletTemplate, basePTemplate, firstCharTemplate);
            storyNode.appendChild(pRange);
          }
        }
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

      const doc = this.getParser().parseFromString(spread.originalXml, "application/xml");
      const allRects = Array.from(doc.getElementsByTagName("*")).filter(n => ['rectangle', 'oval', 'polygon'].includes(this.getLocalName(n)));

      for (const rect of allRects) {
        if (this.findScriptLabel(rect as Element) === imageTag) {
          const imageNode = Array.from(rect.getElementsByTagName("*")).find(n => ['image', 'pdf', 'eps', 'importedpage'].includes(this.getLocalName(n)));
          const linkNode = imageNode ? Array.from(imageNode.getElementsByTagName("*")).find(n => this.getLocalName(n) === 'link') : null;

          if (linkNode) {
            (linkNode as Element).setAttribute("LinkResourceURI", `file:Links/${file.name}`);
          }
        }
      }
      const newXml = this.getSerializer().serializeToString(doc);
      spread.originalXml = newXml;
      this.zip.file(spread.id, newXml);
    }
  }

  /**
   * Configura el relinkeo automático para el IDML final.
   * @param enabled Si debe activarse el relinkeo
   * @param destinationFolder Nombre de la carpeta donde estarán las fotos (opcional)
   */
  setAutomaticRelink(enabled: boolean, destinationFolder?: string) {
    this.automaticRelink = { enabled, destinationFolder };
  }

  /**
   * Genera el Blob del IDML final inyectando el contenido de las historias.
   * REGLA 1: Si un marco no tiene etiqueta, se preserva su contenido original.
   * REGLA 2: Si un marco tiene etiqueta, se limpia su contenido previo y se inyecta el nuevo 
   * (o se deja vacío si no hay contenido nuevo).
   */
  async generateBlob(currentStories: IDMLStory[]): Promise<Blob> {
    if (!this.zip) throw new Error("No hay archivo IDML cargado");

    // Crear un mapa de historias actualizadas por su ID normalizado para acceso rápido
    const updatesMap = new Map<string, IDMLStory>();
    for (const story of currentStories) {
      const normId = normalizeId(story.id);
      updatesMap.set(normId, story);
    }

    // Iterar sobre TODAS las historias cargadas originalmente desde el IDML
    for (const originalStory of this.stories.values()) {
      // REGLA 1: Si no tiene scriptLabel, no tocamos el archivo en el ZIP (se preserva el original)
      if (!originalStory.scriptLabel) {
        continue;
      }

      // REGLA 2: Tiene etiqueta -> Control total de limpieza e inyección
      const normId = normalizeId(originalStory.id);
      const update = updatesMap.get(normId);

      // Si existe una actualización en currentStories Y ha sido modificada, usamos su contenido.
      // Si no ha sido modificada, la tratamos como vacía para cumplir la Regla 2 (limpieza de contenido antiguo).
      const newContent = (update && update.isModified) ? (update.content || "") : "";

      console.log(`[IDML Engine] Procesando story etiquetada '${originalStory.scriptLabel}': ${newContent.length} chars (isModified: ${update?.isModified || false})`);

      const updatedXml = this.getUpdatedStoryXml(originalStory, newContent);
      this.zip.file(originalStory.name, updatedXml);
    }

    // APLICAR RELINKEO AUTOMÁTICO (Si está activo)
    if (this.automaticRelink.enabled) {
      // Si hay nombre de carpeta, usarlo. Si no, Links/ es el estándar.
      const destFolder = this.automaticRelink.destinationFolder || "Links";
      const relativeBase = `file:${destFolder}/`;

      console.log(`[IDML Engine] Aplicando relinkeo automático relativo a: '${relativeBase}'`);

      for (const spread of this.spreads.values()) {
        const doc = this.getParser().parseFromString(spread.originalXml, "application/xml");
        const links = Array.from(doc.getElementsByTagName("Link"));
        let modified = false;

        for (const link of links) {
          const uri = link.getAttribute("LinkResourceURI");
          if (uri) {
            // Extraer solo el nombre del archivo de la ruta actual
            const fileName = uri.split('/').pop() || "";
            if (fileName) {
              const newUri = `${relativeBase}${fileName}`;
              link.setAttribute("LinkResourceURI", newUri);
              modified = true;
              console.log(`  - Relink relativo: ${uri} -> ${newUri}`);
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

    const content = await this.zip.generateAsync({ type: "blob" });
    return content;
  }

  async generateDownload(currentStories: IDMLStory[], customFileName?: string): Promise<void> {
    let url: string | null = null;
    let link: HTMLAnchorElement | null = null;

    try {
      const blob = await this.generateBlob(currentStories);
      url = URL.createObjectURL(blob);
      link = document.createElement("a");
      link.href = url;
      const baseName = (customFileName && customFileName.trim())
        ? customFileName.trim()
        : this.originalFileName.replace(".idml", "_updated.idml");
      link.download = baseName;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      // Limpiar después de un breve delay para asegurar que el navegador procese el click
      setTimeout(() => {
        if (link && link.parentNode) {
          link.parentNode.removeChild(link);
        }
        if (url) {
          URL.revokeObjectURL(url);
        }
      }, 100);
    } catch (error) {
      // Limpiar en caso de error
      if (link && link.parentNode) {
        link.parentNode.removeChild(link);
      }
      if (url) {
        URL.revokeObjectURL(url);
      }
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
      imageFrames: [],
      genericFrames: [],
      pages: [{ id: "p1", offsetX: 0, offsetY: 0 }],
      originalXml: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Spread Self="u456"><TextFrame Self="tf1" ParentStory="u123"><Properties><Label><KeyValuePair Key="label" Value="INTRO_TEXT"/></Label></Properties></TextFrame><TextFrame Self="tf2" ParentStory="u999"><Properties><Label><KeyValuePair Key="label" Value="SOBRANTES"/></Label></Properties></TextFrame></Spread>`
    };
    this.stories.set("mock1", mockStory);
    this.stories.set("mockSobrantes", mockSobrantes);
    this.spreads.set("Spreads/Spread_u456.xml", mockSpread);
    return { stories: [mockStory, mockSobrantes], spreads: [mockSpread] };
  }

  exportToJSON(currentStories: IDMLStory[]) {
    return {
      metadata: {
        originalFileName: this.originalFileName,
        pageSettings: this.pageSettings,
        fonts: this.fonts,
        swatches: this.swatches,
        styles: this.styles
      },
      stories: currentStories.map(s => ({
        id: s.id,
        scriptLabel: s.scriptLabel,
        paragraphs: s.paragraphs?.map(p => ({
          appliedStyle: p.appliedStyle,
          overrides: p.overrides,
          characterRanges: p.characterRanges.map(cr => ({
            content: cr.content,
            appliedStyle: cr.appliedStyle,
            attributes: cr.attributes
          }))
        }))
      })),
      spreads: Array.from(this.spreads.values()).map(spread => ({
        id: spread.id,
        type: spread.type,
        pages: spread.pages,
        frames: spread.frames.map(f => ({
          id: f.id,
          storyId: f.storyId,
          bounds: f.bounds,
          pageId: f.pageId,
          scriptLabel: f.scriptLabel,
          columnCount: f.columnCount,
          columnGutter: f.columnGutter,
          styles: f.styles
        })),
        imageFrames: spread.imageFrames.map(f => ({
          id: f.id,
          scriptLabel: f.scriptLabel,
          fileName: f.fileName,
          bounds: f.bounds,
          pageId: f.pageId,
          styles: f.styles
        })),
        genericFrames: spread.genericFrames.map(f => ({
          id: f.id,
          contentType: f.contentType,
          scriptLabel: f.scriptLabel,
          bounds: f.bounds,
          pageId: f.pageId,
          styles: f.styles
        }))
      }))
    };
  }
}

export const idmlEngine = new IDMLEngine();
