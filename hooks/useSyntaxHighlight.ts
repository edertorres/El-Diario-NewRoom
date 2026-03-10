import { useMemo } from 'react';
import { extractTags } from '../utils/tagUtils';

interface HighlightRule {
  pattern: RegExp;
  className: string;
  type: 'tag' | 'bold' | 'invalid-tag';
}

interface HighlightedPart {
  text: string;
  className: string;
  type: string;
}

/**
 * Hook para resaltado sintáctico del texto del editor
 */
export const useSyntaxHighlight = (
  text: string,
  availableTags: string[] = []
) => {
  const highlightedParts = useMemo(() => {
    if (!text) return [{ text: '', className: '', type: 'text' }];

    const parts: HighlightedPart[] = [];
    const normalizedAvailableTags = availableTags.map(t => t.toUpperCase().replace(/\s+/g, ''));

    // Dividir el texto en partes usando regex más robusto
    let lastIndex = 0;
    const matches: Array<{ start: number; end: number; className: string; type: string; text: string }> = [];

    // Buscar etiquetas ##ETIQUETA
    const tagPattern = /##([^\n\s]+)/g;
    let tagMatch;
    while ((tagMatch = tagPattern.exec(text)) !== null) {
      const start = tagMatch.index;
      const end = start + tagMatch[0].length;
      const tagName = tagMatch[1].toUpperCase().replace(/\s+/g, '');
      const isValid = normalizedAvailableTags.includes(tagName);
      
      matches.push({
        start,
        end,
        className: isValid || availableTags.length === 0 ? 'tag-highlight' : 'invalid-tag-highlight',
        type: isValid || availableTags.length === 0 ? 'tag' : 'invalid-tag',
        text: tagMatch[0]
      });
    }

    // Buscar negritas **texto** o __texto__
    const boldPattern = /\*\*[^*]+\*\*|__[^_]+__/g;
    let boldMatch;
    while ((boldMatch = boldPattern.exec(text)) !== null) {
      const start = boldMatch.index;
      const end = start + boldMatch[0].length;
      
      // Verificar que no se solape con una etiqueta
      const overlaps = matches.some(m => 
        (start >= m.start && start < m.end) || 
        (end > m.start && end <= m.end) ||
        (start <= m.start && end >= m.end)
      );
      
      if (!overlaps) {
        matches.push({
          start,
          end,
          className: 'bold-highlight',
          type: 'bold',
          text: boldMatch[0]
        });
      }
    }

    // Ordenar matches por posición
    matches.sort((a, b) => a.start - b.start);

    // Construir partes resaltadas
    matches.forEach(match => {
      // Agregar texto antes del match si existe
      if (match.start > lastIndex) {
        parts.push({
          text: text.substring(lastIndex, match.start),
          className: '',
          type: 'text'
        });
      }

      // Agregar el match resaltado
      parts.push({
        text: match.text,
        className: match.className,
        type: match.type
      });

      lastIndex = match.end;
    });

    // Agregar texto restante
    if (lastIndex < text.length) {
      parts.push({
        text: text.substring(lastIndex),
        className: '',
        type: 'text'
      });
    }

    return parts.length > 0 ? parts : [{ text, className: '', type: 'text' }];
  }, [text, availableTags]);

  return highlightedParts;
};
