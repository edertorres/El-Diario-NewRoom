import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TagAutocomplete } from './TagAutocomplete';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { useTagAutocomplete } from '../hooks/useTagAutocomplete';
import { useSyntaxHighlight } from '../hooks/useSyntaxHighlight';
import { getCursorPosition, insertTextAtCursor, wrapSelection, extractTagQuery } from '../utils/editorUtils';
import { normalizeTag } from '../utils/tagUtils';

interface SimpleEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableTags: string[];
  imageTags?: string[];
  placeholder?: string;
  className?: string;
  isFullScreen?: boolean;
}

export const SimpleEditor: React.FC<SimpleEditorProps> = ({
  value,
  onChange,
  availableTags,
  imageTags = [],
  placeholder = 'Escribe aquí...',
  className = '',
  isFullScreen = false
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const [cursorPos, setCursorPos] = useState(0);
  const [autocompletePosition, setAutocompletePosition] = useState({ top: 0, left: 0 });

  // Resaltado sintáctico
  const highlightedParts = useSyntaxHighlight(value, availableTags);

  // Autocompletado
  const handleTagSelect = useCallback((tag: string) => {
    if (!textareaRef.current) return;

    // Leer directamente del textarea en el momento del clic para evitar problemas de timing
    const text = textareaRef.current.value;
    const start = textareaRef.current.selectionStart;
    
    // Buscar el último ## antes del cursor
    const textBeforeCursor = text.substring(0, start);
    const lastHashIndex = textBeforeCursor.lastIndexOf('##');
    
    if (lastHashIndex === -1) {
      console.error('[SimpleEditor] No se encontró ## antes del cursor');
      return;
    }
    
    // Verificar que no haya salto de línea entre ## y el cursor
    const textAfterHash = textBeforeCursor.substring(lastHashIndex + 2);
    if (textAfterHash.includes('\n')) {
      console.error('[SimpleEditor] Hay un salto de línea entre ## y el cursor');
      return;
    }
    
    // Reemplazar desde DESPUÉS de ## hasta el cursor con TAG\n
    // lastHashIndex es la posición donde empieza ##, así que lastHashIndex + 2 es después de ##
    const before = text.substring(0, lastHashIndex + 2); // Incluir ##
    const after = text.substring(start); // Todo después del cursor
    const newText = before + `${tag}\n` + after; // Solo agregar tag, no ##
    
    console.log('[SimpleEditor] Insertando etiqueta:', {
      tag,
      lastHashIndex,
      cursorPos: start,
      textBeforeCursor: textBeforeCursor.substring(Math.max(0, lastHashIndex - 3), lastHashIndex + 5),
      textAfter: after.substring(0, 10),
      before: before,
      newTextPreview: newText.substring(0, lastHashIndex + 2 + tag.length + 5)
    });
    
    onChange(newText);
    
    // Posicionar cursor después de la etiqueta
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = lastHashIndex + 2 + tag.length + 1; // ## + tag + \n
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
        updateCursorPosition();
      }
    }, 0);
  }, [onChange, updateCursorPosition]);

  const autocomplete = useTagAutocomplete({
    text: value,
    cursorPosition: cursorPos,
    availableTags,
    onTagSelect: handleTagSelect
  });

  const updateCursorPosition = useCallback(() => {
    if (!textareaRef.current) return;
    setCursorPos(textareaRef.current.selectionStart);
    updateAutocompletePosition();
  }, []);

  const updateAutocompletePosition = useCallback(() => {
    if (!textareaRef.current || !autocomplete.isVisible) return;

    const textarea = textareaRef.current;
    const cursorPos = textarea.selectionStart;
    const text = textarea.value;
    
    // Encontrar posición del ##
    const textBeforeCursor = text.substring(0, cursorPos);
    const lastHashIndex = textBeforeCursor.lastIndexOf('##');
    
    if (lastHashIndex === -1) return;

    // Calcular posición visual del cursor
    const lines = text.substring(0, cursorPos).split('\n');
    const currentLine = lines.length - 1;
    const currentLineText = lines[currentLine] || '';
    
    // Calcular posición del ## en la línea actual
    const lineStart = text.substring(0, cursorPos).lastIndexOf('\n') + 1;
    const hashPosInLine = lastHashIndex - lineStart;
    
    // Crear elemento temporal para medir el ancho
    const tempSpan = document.createElement('span');
    tempSpan.style.position = 'absolute';
    tempSpan.style.visibility = 'hidden';
    tempSpan.style.whiteSpace = 'pre';
    tempSpan.style.font = window.getComputedStyle(textarea).font;
    tempSpan.textContent = currentLineText.substring(0, hashPosInLine + 2 + autocomplete.query.length);
    document.body.appendChild(tempSpan);
    
    const textWidth = tempSpan.offsetWidth;
    document.body.removeChild(tempSpan);
    
    // Obtener posición del textarea
    const rect = textarea.getBoundingClientRect();
    const styles = window.getComputedStyle(textarea);
    const lineHeight = parseFloat(styles.lineHeight) || parseFloat(styles.fontSize || '16') * 1.2;
    const paddingTop = parseFloat(styles.paddingTop) || 0;
    const paddingLeft = parseFloat(styles.paddingLeft) || 0;
    
    setAutocompletePosition({
      top: rect.top + textarea.scrollTop + paddingTop + (currentLine * lineHeight) + lineHeight + 2,
      left: rect.left + textarea.scrollLeft + paddingLeft + textWidth
    });
  }, [autocomplete.isVisible, autocomplete.query]);

  // Sincronizar scroll entre textarea y highlight directamente
  const handleScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    // Sincronizar inmediatamente sin delay
    if (highlightRef.current) {
      highlightRef.current.scrollTop = textarea.scrollTop;
      highlightRef.current.scrollLeft = textarea.scrollLeft;
    }
    if (autocomplete.isVisible) {
      updateAutocompletePosition();
    }
  }, [autocomplete.isVisible, updateAutocompletePosition]);

  // Asegurar que el textarea tenga foco al montar
  useEffect(() => {
    if (textareaRef.current) {
      // No forzar el foco automáticamente, pero asegurar que sea focusable
      textareaRef.current.setAttribute('tabindex', '0');
    }
  }, []);

  // Sincronizar scroll también cuando cambia el contenido o se monta
  useEffect(() => {
    const syncScroll = () => {
      if (highlightRef.current && textareaRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
    };
    
    // Sincronizar después de que el DOM se actualice
    const timer = setTimeout(syncScroll, 0);
    // También sincronizar en el siguiente frame de animación
    requestAnimationFrame(syncScroll);
    return () => clearTimeout(timer);
  }, [value]);

  // Agregar listener de scroll adicional para mejor sincronización
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || !highlightRef.current) return;

    const handleScrollEvent = () => {
      // Sincronizar inmediatamente sin requestAnimationFrame para mejor respuesta
      if (highlightRef.current && textarea) {
        highlightRef.current.scrollTop = textarea.scrollTop;
        highlightRef.current.scrollLeft = textarea.scrollLeft;
      }
    };

    // Agregar listener nativo para mejor captura del evento
    textarea.addEventListener('scroll', handleScrollEvent, { passive: true });
    
    // Sincronizar inicialmente
    handleScrollEvent();
    
    return () => {
      textarea.removeEventListener('scroll', handleScrollEvent);
    };
  }, [value]); // Re-ejecutar cuando cambia el valor para re-sincronizar

  // Manejar cambios en el textarea
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
    updateCursorPosition();
  }, [onChange, updateCursorPosition]);

  // Manejar selección
  const handleSelect = useCallback(() => {
    updateCursorPosition();
  }, [updateCursorPosition]);

  // Manejar teclas
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+B para negritas
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      if (textareaRef.current) {
        wrapSelection(textareaRef.current, '**', '**');
        updateCursorPosition();
      }
      return;
    }

    // Manejar autocompletado
    if (autocomplete.isVisible) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        autocomplete.navigate('down');
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        autocomplete.navigate('up');
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        autocomplete.selectCurrent();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        autocomplete.hide();
        return;
      }
    }
  }, [autocomplete]);

  // Actualizar posición del autocompletado cuando cambia
  useEffect(() => {
    if (autocomplete.isVisible) {
      updateAutocompletePosition();
    }
  }, [autocomplete.isVisible, autocomplete.query, autocomplete.selectedIndex, updateAutocompletePosition]);

  return (
    <div className={`simple-editor-container relative ${className}`}>
      {/* Capa de resaltado - sincronizada con el scroll del textarea */}
      <div
        ref={highlightRef}
        className="absolute inset-0 pointer-events-none overflow-auto whitespace-pre-wrap break-words syntax-highlight-overlay"
        style={{
          fontSize: isFullScreen ? '18px' : '16px',
          fontFamily: 'monospace',
          padding: isFullScreen ? '64px' : '32px',
          lineHeight: '1.6',
          color: '#1f2937', // Color del texto (las etiquetas resaltadas sobrescribirán esto)
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          zIndex: 0 // Asegurar que esté detrás del textarea
        }}
      >
        <SyntaxHighlighter parts={highlightedParts} />
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        placeholder={placeholder}
        className="relative w-full h-full bg-transparent resize-none outline-none caret-gray-900"
        style={{
          fontSize: isFullScreen ? '18px' : '16px',
          fontFamily: 'monospace',
          padding: isFullScreen ? '64px' : '32px',
          lineHeight: '1.6',
          color: 'transparent', // Hacer el texto transparente para que solo se vea el resaltado
          caretColor: '#1f2937', // Mantener el cursor visible
          position: 'relative',
          zIndex: 1 // Asegurar que esté por encima de la capa de resaltado
        }}
        spellCheck={false}
        autoFocus={false}
      />

      {/* Autocompletado */}
      <TagAutocomplete
        isVisible={autocomplete.isVisible}
        suggestions={autocomplete.suggestions}
        selectedIndex={autocomplete.selectedIndex}
        position={autocompletePosition}
        onSelect={autocomplete.selectTag}
        onNavigate={autocomplete.navigate}
        onClose={autocomplete.hide}
        imageTags={imageTags}
      />
    </div>
  );
};
