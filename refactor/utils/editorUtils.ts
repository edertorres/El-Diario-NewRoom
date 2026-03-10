/**
 * Utilidades para el editor
 */

/**
 * Calcula la posición del cursor en un textarea
 */
export const getCursorPosition = (textarea: HTMLTextAreaElement): { line: number; column: number } => {
  const text = textarea.value;
  const cursorPos = textarea.selectionStart;
  
  const textBeforeCursor = text.substring(0, cursorPos);
  const lines = textBeforeCursor.split('\n');
  
  return {
    line: lines.length - 1,
    column: lines[lines.length - 1].length
  };
};

/**
 * Obtiene el texto de la línea actual donde está el cursor
 */
export const getCurrentLine = (textarea: HTMLTextAreaElement): string => {
  const text = textarea.value;
  const cursorPos = textarea.selectionStart;
  const textBeforeCursor = text.substring(0, cursorPos);
  const lines = textBeforeCursor.split('\n');
  return lines[lines.length - 1] || '';
};

/**
 * Inserta texto en la posición del cursor
 */
export const insertTextAtCursor = (
  textarea: HTMLTextAreaElement,
  textToInsert: string
): void => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  const before = text.substring(0, start);
  const after = text.substring(end);
  
  const newText = before + textToInsert + after;
  textarea.value = newText;
  
  // Posicionar cursor después del texto insertado
  const newPos = start + textToInsert.length;
  textarea.setSelectionRange(newPos, newPos);
  textarea.focus();
};

/**
 * Envuelve la selección con un texto (por ejemplo, para negritas)
 */
export const wrapSelection = (
  textarea: HTMLTextAreaElement,
  before: string,
  after: string = before
): void => {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  
  const selected = text.substring(start, end);
  const beforeText = text.substring(0, start);
  const afterText = text.substring(end);
  
  const newText = beforeText + before + selected + after + afterText;
  textarea.value = newText;
  
  // Si no había selección, posicionar cursor en el medio
  if (start === end) {
    textarea.setSelectionRange(start + before.length, start + before.length);
  } else {
    // Si había selección, posicionar después del texto envuelto
    textarea.setSelectionRange(end + before.length + after.length, end + before.length + after.length);
  }
  
  textarea.focus();
};

/**
 * Encuentra la posición del último ## antes del cursor
 */
export const findLastTagStart = (text: string, cursorPos: number): number | null => {
  const textBeforeCursor = text.substring(0, cursorPos);
  const lastHashIndex = textBeforeCursor.lastIndexOf('##');
  
  if (lastHashIndex === -1) return null;
  
  // Verificar que no haya salto de línea después de ##
  const afterHash = textBeforeCursor.substring(lastHashIndex + 2);
  if (afterHash.includes('\n')) return null;
  
  return lastHashIndex;
};

/**
 * Extrae la query de etiqueta desde la posición del cursor
 */
export const extractTagQuery = (text: string, cursorPos: number): { query: string; startPos: number } | null => {
  const tagStart = findLastTagStart(text, cursorPos);
  if (tagStart === null) return null;
  
  const query = text.substring(tagStart + 2, cursorPos);
  return {
    query,
    startPos: tagStart
  };
};
