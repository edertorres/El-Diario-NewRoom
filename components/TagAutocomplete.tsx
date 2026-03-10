import React, { useEffect, useRef } from 'react';
import { Tag, Image as ImageIcon } from 'lucide-react';

interface TagAutocompleteProps {
  isVisible: boolean;
  suggestions: string[];
  selectedIndex: number;
  position: { top: number; left: number };
  onSelect: (tag: string) => void;
  onNavigate: (direction: 'up' | 'down') => void;
  onClose: () => void;
  imageTags?: string[];
}

export const TagAutocomplete: React.FC<TagAutocompleteProps> = ({
  isVisible,
  suggestions,
  selectedIndex,
  position,
  onSelect,
  onNavigate,
  onClose,
  imageTags = []
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Asegurar que el elemento seleccionado esté visible
  useEffect(() => {
    if (isVisible && selectedItemRef.current) {
      selectedItemRef.current.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth'
      });
    }
  }, [isVisible, selectedIndex]);

  // Ajustar posición para que no se salga de la pantalla
  useEffect(() => {
    if (isVisible && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let adjustedLeft = position.left;
      let adjustedTop = position.top;

      // Ajustar horizontalmente
      if (rect.right > viewportWidth) {
        adjustedLeft = viewportWidth - rect.width - 10;
      }
      if (adjustedLeft < 10) {
        adjustedLeft = 10;
      }

      // Ajustar verticalmente
      if (rect.bottom > viewportHeight) {
        adjustedTop = position.top - rect.height - 5;
      }
      if (adjustedTop < 10) {
        adjustedTop = 10;
      }

      if (adjustedLeft !== position.left || adjustedTop !== position.top) {
        containerRef.current.style.left = `${adjustedLeft}px`;
        containerRef.current.style.top = `${adjustedTop}px`;
      }
    }
  }, [isVisible, position]);

  if (!isVisible || suggestions.length === 0) {
    return null;
  }

  const normalizedImageTags = imageTags.map(t => t.toUpperCase().replace(/\s+/g, ''));

  return (
    <div
      ref={containerRef}
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl max-h-64 overflow-y-auto"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        minWidth: '200px',
        maxWidth: '300px'
      }}
    >
      <div className="p-1">
        {suggestions.map((tag, index) => {
          const normalizedTag = tag.toUpperCase().replace(/\s+/g, '');
          const isImageTag = normalizedImageTags.includes(normalizedTag);
          const isSelected = index === selectedIndex;

          return (
            <button
              key={tag}
              ref={isSelected ? selectedItemRef : null}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onSelect(tag);
              }}
              className={`w-full text-left px-3 py-2 rounded-md transition-colors flex items-center gap-2 ${
                isSelected
                  ? 'bg-indigo-100 text-indigo-900 font-semibold'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              {isImageTag ? (
                <ImageIcon size={14} className="text-indigo-600 shrink-0" />
              ) : (
                <Tag size={14} className="text-indigo-600 shrink-0" />
              )}
              <span className="flex-1 font-mono text-sm">##{tag}</span>
            </button>
          );
        })}
      </div>
      <div className="border-t border-gray-100 px-3 py-2 bg-gray-50">
        <p className="text-xs text-gray-500">
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">↑↓</kbd> navegar
          {' '}
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">Enter</kbd> seleccionar
          {' '}
          <kbd className="px-1.5 py-0.5 bg-white border border-gray-200 rounded text-[10px]">Esc</kbd> cerrar
        </p>
      </div>
    </div>
  );
};
