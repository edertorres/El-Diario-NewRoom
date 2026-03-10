import { useState, useEffect, useCallback, useRef } from 'react';
import { normalizeTag, findSimilarTags } from '../utils/tagUtils';
import { extractTagQuery } from '../utils/editorUtils';

interface UseTagAutocompleteOptions {
  text: string;
  cursorPosition: number;
  availableTags: string[];
  onTagSelect: (tag: string) => void;
}

interface AutocompleteState {
  isVisible: boolean;
  suggestions: string[];
  selectedIndex: number;
  query: string;
  startPos: number;
}

export const useTagAutocomplete = ({
  text,
  cursorPosition,
  availableTags,
  onTagSelect
}: UseTagAutocompleteOptions) => {
  const [state, setState] = useState<AutocompleteState>({
    isVisible: false,
    suggestions: [],
    selectedIndex: 0,
    query: '',
    startPos: 0
  });

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const updateSuggestions = useCallback(() => {
    const tagInfo = extractTagQuery(text, cursorPosition);
    
    if (!tagInfo) {
      setState(prev => ({ ...prev, isVisible: false }));
      return;
    }

    const { query, startPos } = tagInfo;
    const normalizedQuery = normalizeTag(query);
    
    const suggestions = findSimilarTags(query, availableTags);
    
    if (suggestions.length === 0) {
      setState(prev => ({ ...prev, isVisible: false }));
      return;
    }

    setState({
      isVisible: true,
      suggestions,
      selectedIndex: 0,
      query: normalizedQuery,
      startPos
    });
  }, [text, cursorPosition, availableTags]);

  useEffect(() => {
    // Debounce para evitar cálculos excesivos
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      updateSuggestions();
    }, 50);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [updateSuggestions]);

  const selectTag = useCallback((tag: string) => {
    onTagSelect(tag);
    setState(prev => ({ ...prev, isVisible: false }));
  }, [onTagSelect]);

  const navigate = useCallback((direction: 'up' | 'down') => {
    setState(prev => {
      if (!prev.isVisible || prev.suggestions.length === 0) return prev;
      
      const newIndex = direction === 'down'
        ? (prev.selectedIndex + 1) % prev.suggestions.length
        : (prev.selectedIndex - 1 + prev.suggestions.length) % prev.suggestions.length;
      
      return { ...prev, selectedIndex: newIndex };
    });
  }, []);

  const selectCurrent = useCallback(() => {
    if (state.isVisible && state.suggestions[state.selectedIndex]) {
      selectTag(state.suggestions[state.selectedIndex]);
    }
  }, [state, selectTag]);

  const hide = useCallback(() => {
    setState(prev => ({ ...prev, isVisible: false }));
  }, []);

  return {
    ...state,
    selectTag,
    navigate,
    selectCurrent,
    hide
  };
};
