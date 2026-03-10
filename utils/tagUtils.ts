/**
 * Utilidades para manejo de etiquetas
 */

/**
 * Normaliza una etiqueta: elimina espacios y convierte a mayúsculas
 */
export const normalizeTag = (tag: string | null | undefined): string => {
  if (!tag) return '';
  return tag.trim().replace(/\s+/g, '').toUpperCase();
};

/**
 * Extrae todas las etiquetas de un texto
 */
export const extractTags = (text: string): string[] => {
  const tagRegex = /##([^\n\s]+)/g;
  const tags: string[] = [];
  let match;
  
  while ((match = tagRegex.exec(text)) !== null) {
    const normalized = normalizeTag(match[1]);
    if (normalized) {
      tags.push(normalized);
    }
  }
  
  return [...new Set(tags)]; // Eliminar duplicados
};

/**
 * Verifica si una etiqueta es válida (existe en la lista de etiquetas disponibles)
 */
export const isValidTag = (tag: string, availableTags: string[]): boolean => {
  const normalized = normalizeTag(tag);
  return availableTags.some(t => normalizeTag(t) === normalized);
};

/**
 * Busca etiquetas similares usando búsqueda fuzzy simple
 */
export const findSimilarTags = (query: string, availableTags: string[]): string[] => {
  const normalizedQuery = normalizeTag(query);
  if (!normalizedQuery) return availableTags.slice(0, 10);
  
  // Primero buscar coincidencias que empiecen con la query
  const startsWith = availableTags.filter(tag => 
    normalizeTag(tag).startsWith(normalizedQuery)
  );
  
  // Luego buscar coincidencias que contengan la query
  const contains = availableTags.filter(tag => {
    const normalized = normalizeTag(tag);
    return normalized.includes(normalizedQuery) && !normalized.startsWith(normalizedQuery);
  });
  
  // Combinar y limitar resultados
  return [...startsWith, ...contains].slice(0, 10);
};

/**
 * Parsea el contenido del batch text en un objeto de etiquetas -> contenido
 */
export const parseBatchText = (batchText: string): Record<string, string> => {
  const parsed: Record<string, string> = {};
  const tagRegex = /##([^\n]+)\n([\s\S]*?)(?=\n##|$)/g;
  let match;
  
  while ((match = tagRegex.exec(batchText)) !== null) {
    const label = normalizeTag(match[1]);
    const content = match[2].trim();
    if (label) {
      parsed[label] = content;
    }
  }
  
  return parsed;
};
