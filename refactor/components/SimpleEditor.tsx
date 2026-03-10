import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TagAutocomplete } from './TagAutocomplete';
import { SyntaxHighlighter } from './SyntaxHighlighter';
import { useTagAutocomplete } from '../hooks/useTagAutocomplete';
import { useSyntaxHighlight } from '../hooks/useSyntaxHighlight';
import { getCursorPosition, insertTextAtCursor, wrapSelection } from '../utils/editorUtils';
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

    const text = textareaRef.current.value;
    const start = textareaRef.current.selectionStart;
    
    // Encontrar la posición del último ##
    const textBeforeCursor = text.substring(0, start);
    const lastHashIndex = textBeforeCursor.lastIndexOf('##');
    
    if (lastHashIndex === -1) return;

    // Reemplazar desde ## hasta el cursor con ##TAG\n
    const before = text.substring(0, lastHashIndex);
    const after = text.substring(start);
    const newText = before + `##${tag}\n` + after;
    
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
  }, [onChange]);

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

  // Sincronizar scroll entre textarea y highlight
  const handleScroll = useCallback(() => {
    requestAnimationFrame(() => {
      if (highlightRef.current && textareaRef.current) {
        highlightRef.current.scrollTop = textareaRef.current.scrollTop;
        highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
      }
      if (autocomplete.isVisible) {
        updateAutocompletePosition();
      }
    });
  }, [autocomplete.isVisible, updateAutocompletePosition]);

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
      {/* Capa de resaltado */}
      <div
        ref={highlightRef}
        className="absolute inset-0 pointer-events-none overflow-hidden whitespace-pre-wrap break-words syntax-highlight-overlay"
        style={{
          fontSize: isFullScreen ? '18px' : '16px',
          fontFamily: 'monospace',
          padding: isFullScreen ? '64px' : '32px',
          lineHeight: '1.6',
          color: 'transparent'
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
          lineHeight: '1.6'
        }}
        spellCheck={false}
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
