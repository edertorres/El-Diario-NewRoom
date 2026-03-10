import React, { useEffect, useRef } from 'react';
import { EditorView } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { EditorState, Extension } from '@codemirror/state';
import { Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { autocompletion, CompletionContext, CompletionResult } from '@codemirror/autocomplete';
import { normalizeTag } from '../utils/tagUtils';

interface CodeMirrorEditorProps {
  value: string;
  onChange: (value: string) => void;
  availableTags: string[];
  imageTags?: string[];
  placeholder?: string;
  className?: string;
  isFullScreen?: boolean;
}

export const CodeMirrorEditor: React.FC<CodeMirrorEditorProps> = ({
  value,
  onChange,
  availableTags,
  imageTags = [],
  placeholder = 'Escribe aquí usando ##ETIQUETA para cada sección...',
  className = '',
  isFullScreen = false
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const availableTagsRef = useRef(availableTags);
  const imageTagsRef = useRef(imageTags);

  // Actualizar refs cuando cambian
  useEffect(() => {
    onChangeRef.current = onChange;
    availableTagsRef.current = availableTags;
    imageTagsRef.current = imageTags;
  }, [onChange, availableTags, imageTags]);

  // Función para agrupar etiquetas por similitud y asignar colores
  const getTagColorGroup = (() => {
    const colorGroups: Map<string, number> = new Map();
    const colors = [
      { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.2)', text: '#4f46e5' }, // Indigo
      { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' }, // Green
      { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.2)', text: '#f97316' }, // Orange
      { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' }, // Purple
      { bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.2)', text: '#ec4899' }, // Pink
      { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' }, // Blue
      { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.2)', text: '#eab308' }, // Yellow
      { bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.2)', text: '#0ea5e9' }, // Sky
    ];

    return (tagName: string): { bg: string; border: string; text: string; groupId: number } => {
      // Normalizar el nombre de la etiqueta para agrupar
      const normalized = tagName.toUpperCase().trim();
      
      // Buscar si ya existe un grupo para esta etiqueta o una similar
      let groupId = -1;
      for (const [existingTag, id] of colorGroups.entries()) {
        // Considerar similares si comparten un prefijo común de al menos 3 caracteres
        // o si una contiene a la otra
        const minLength = Math.min(normalized.length, existingTag.length);
        if (minLength >= 3) {
          const commonPrefix = normalized.substring(0, Math.min(4, minLength));
          const existingPrefix = existingTag.substring(0, Math.min(4, minLength));
          
          if (commonPrefix === existingPrefix || 
              normalized.includes(existingTag.substring(0, 3)) ||
              existingTag.includes(normalized.substring(0, 3))) {
            groupId = id;
            break;
          }
        }
      }

      // Si no se encontró un grupo, crear uno nuevo
      if (groupId === -1) {
        groupId = colorGroups.size % colors.length;
        colorGroups.set(normalized, groupId);
      }

      return { ...colors[groupId], groupId };
    };
  })();

  // Plugin de resaltado de etiquetas
  const createTagHighlightPlugin = (): Extension => {
    return ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = this.buildDecorations(view);
        }

        update(update: ViewUpdate) {
          // Actualizar siempre para asegurar que el resaltado se mantenga actualizado
          if (update.docChanged || update.viewportChanged || update.selectionSet) {
            this.decorations = this.buildDecorations(update.view);
          }
        }

        buildDecorations(view: EditorView): DecorationSet {
          const decorations: any[] = [];
          const text = view.state.doc.toString();
          const normalizedAvailableTags = availableTagsRef.current.map(t => normalizeTag(t));

          // Buscar etiquetas ##ETIQUETA
          const tagPattern = /##([^\n\s]+)/g;
          let match;
          const matches: Array<{start: number, end: number, tag: string}> = [];
          
          // Primero recopilar todos los matches
          while ((match = tagPattern.exec(text)) !== null) {
            matches.push({
              start: match.index,
              end: match.index + match[0].length,
              tag: match[1]
            });
          }

          // Procesar cada match
          for (const { start, end, tag } of matches) {
            const tagName = normalizeTag(tag);
            const isValid = normalizedAvailableTags.includes(tagName) || availableTagsRef.current.length === 0;

            if (isValid) {
              // Obtener color del grupo para etiquetas válidas
              const colorGroup = getTagColorGroup(tagName);
              
              // Crear una clase única para este grupo de color
              const colorClass = `cm-tag-color-${colorGroup.groupId}`;
              
              const decoration = Decoration.mark({
                class: `cm-tag-highlight ${colorClass}`,
                attributes: {
                  'data-tag': tagName,
                  'data-color-group': colorGroup.groupId.toString()
                }
              });

              decorations.push(decoration.range(start, end));
            } else {
              // Etiquetas inválidas en rojo
              const decoration = Decoration.mark({
                class: 'cm-invalid-tag-highlight'
              });

              decorations.push(decoration.range(start, end));
            }
          }

          // Buscar negritas **texto** o __texto__
          const boldPattern = /\*\*[^*]+\*\*|__[^_]+__/g;
          let boldMatch;
          while ((boldMatch = boldPattern.exec(text)) !== null) {
            const start = boldMatch.index;
            const end = start + boldMatch[0].length;
            
            const decoration = Decoration.mark({
              class: 'cm-bold-highlight'
            });

            decorations.push(decoration.range(start, end));
          }

          return Decoration.set(decorations);
        }
      },
      {
        decorations: (v) => v.decorations
      }
    );
  };

  // Autocompletado de etiquetas
  const createTagAutocomplete = (): Extension => {
    return autocompletion({
      override: [
        (context: CompletionContext): CompletionResult | null => {
          const { state, pos } = context;
          const text = state.doc.toString();
          const textBeforeCursor = text.substring(0, pos);
          const lastHashIndex = textBeforeCursor.lastIndexOf('##');

          // Solo activar autocompletado si hay ## antes del cursor
          if (lastHashIndex === -1 || pos - lastHashIndex > 50) {
            return null;
          }

          const query = textBeforeCursor.substring(lastHashIndex + 2).toUpperCase().replace(/\s+/g, '');
          const currentAvailableTags = availableTagsRef.current;
          const currentImageTags = imageTagsRef.current;
          
          // Filtrar etiquetas que coincidan
          const matchingTags = currentAvailableTags.filter(tag => {
            const normalizedTag = normalizeTag(tag);
            return normalizedTag.includes(query) || query === '';
          });

          if (matchingTags.length === 0) {
            return null;
          }

          // Separar etiquetas de texto e imágenes
          const textTags = matchingTags.filter(tag => !currentImageTags.includes(tag));
          const imgTags = matchingTags.filter(tag => currentImageTags.includes(tag));

          const options: any[] = [];

          // Agregar etiquetas de texto
          textTags.forEach(tag => {
            options.push({
              label: tag,
              type: 'text',
              apply: (view: EditorView, completion: any, from: number, to: number) => {
                const tagName = normalizeTag(tag);
                view.dispatch({
                  changes: { from: lastHashIndex, to: pos, insert: `##${tagName}\n` },
                  selection: { anchor: lastHashIndex + 2 + tagName.length + 1 }
                });
              }
            });
          });

          // Agregar etiquetas de imagen
          imgTags.forEach(tag => {
            options.push({
              label: tag,
              type: 'image',
              apply: (view: EditorView, completion: any, from: number, to: number) => {
                const tagName = normalizeTag(tag);
                view.dispatch({
                  changes: { from: lastHashIndex, to: pos, insert: `##${tagName}\n` },
                  selection: { anchor: lastHashIndex + 2 + tagName.length + 1 }
                });
              }
            });
          });

          return {
            from: lastHashIndex + 2,
            to: pos,
            options: options.slice(0, 20)
          };
        }
      ],
      optionClass: (option: any) => {
        return option.type === 'image' ? 'cm-autocomplete-image' : 'cm-autocomplete-text';
      }
    });
  };

  // Configuración del editor
  const createExtensions = (): Extension[] => {
    return [
      basicSetup,
      EditorView.updateListener.of((update) => {
        if (update.docChanged && viewRef.current) {
          const newValue = update.state.doc.toString();
          // Solo actualizar si el valor realmente cambió
          if (newValue !== value) {
            requestAnimationFrame(() => {
              if (viewRef.current && viewRef.current.state.doc.toString() === newValue) {
                onChangeRef.current(newValue);
              }
            });
          }
        }
      }),
      createTagHighlightPlugin(),
      createTagAutocomplete(),
      EditorView.theme({
        '&': {
          fontSize: isFullScreen ? '18px' : '16px',
          fontFamily: 'monospace',
          padding: isFullScreen ? '64px' : '32px',
          lineHeight: '1.6'
        },
        '.cm-content': {
          padding: '0',
          minHeight: '100%',
          caretColor: '#1f2937'
        },
        '.cm-editor': {
          height: '100%'
        },
        '.cm-scroller': {
          fontFamily: 'monospace'
        },
        '.cm-focused': {
          outline: '2px solid rgba(99, 102, 241, 0.3)',
          outlineOffset: '-2px',
          borderRadius: '4px'
        },
        '.cm-tag-highlight': {
          fontWeight: '900',
          padding: '2px 4px',
          borderRadius: '4px',
          border: '1px solid',
        },
        // Colores por grupo - aplicar estilos dinámicamente
        '.cm-tag-color-0': {
          backgroundColor: 'rgba(99, 102, 241, 0.1)',
          borderColor: 'rgba(99, 102, 241, 0.2)',
          color: '#4f46e5',
        },
        '.cm-tag-color-1': {
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderColor: 'rgba(34, 197, 94, 0.2)',
          color: '#22c55e',
        },
        '.cm-tag-color-2': {
          backgroundColor: 'rgba(249, 115, 22, 0.1)',
          borderColor: 'rgba(249, 115, 22, 0.2)',
          color: '#f97316',
        },
        '.cm-tag-color-3': {
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderColor: 'rgba(168, 85, 247, 0.2)',
          color: '#a855f7',
        },
        '.cm-tag-color-4': {
          backgroundColor: 'rgba(236, 72, 153, 0.1)',
          borderColor: 'rgba(236, 72, 153, 0.2)',
          color: '#ec4899',
        },
        '.cm-tag-color-5': {
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          borderColor: 'rgba(59, 130, 246, 0.2)',
          color: '#3b82f6',
        },
        '.cm-tag-color-6': {
          backgroundColor: 'rgba(234, 179, 8, 0.1)',
          borderColor: 'rgba(234, 179, 8, 0.2)',
          color: '#eab308',
        },
        '.cm-tag-color-7': {
          backgroundColor: 'rgba(14, 165, 233, 0.1)',
          borderColor: 'rgba(14, 165, 233, 0.2)',
          color: '#0ea5e9',
        },
        '.cm-invalid-tag-highlight': {
          color: '#dc2626',
          fontWeight: '900',
          backgroundColor: 'rgba(220, 38, 38, 0.1)',
          padding: '2px 4px',
          borderRadius: '4px',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          textDecoration: 'line-through',
          textDecorationColor: 'rgba(220, 38, 38, 0.5)'
        },
        '.cm-bold-highlight': {
          fontWeight: 'bold',
          color: '#1f2937'
        },
        '.cm-autocomplete-image::before': {
          content: '"🖼️ "',
          marginRight: '4px'
        },
        '.cm-autocomplete-text::before': {
          content: '"📝 "',
          marginRight: '4px'
        },
        '.cm-tooltip-autocomplete > ul > li[aria-selected]': {
          backgroundColor: 'rgba(99, 102, 241, 0.1)'
        }
      }),
      EditorView.lineWrapping
    ];
  };

  // Inicializar editor
  useEffect(() => {
    if (!editorRef.current || viewRef.current) return;

    const state = EditorState.create({
      doc: value,
      extensions: createExtensions()
    });

    const view = new EditorView({
      state,
      parent: editorRef.current
    });

    viewRef.current = view;

    // Enfocar el editor después de un breve delay
    setTimeout(() => {
      view.focus();
    }, 100);

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, []); // Solo montar una vez

  // Actualizar contenido cuando cambia value externamente
  useEffect(() => {
    if (viewRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      if (value !== currentValue) {
        const transaction = viewRef.current.state.update({
          changes: {
            from: 0,
            to: viewRef.current.state.doc.length,
            insert: value
          },
          selection: viewRef.current.state.selection
        });
        viewRef.current.dispatch(transaction);
      }
    }
  }, [value]);

  // Actualizar extensiones cuando cambian las dependencias (recrear el editor)
  useEffect(() => {
    if (viewRef.current && editorRef.current) {
      const currentValue = viewRef.current.state.doc.toString();
      const currentSelection = viewRef.current.state.selection;
      
      // Destruir el editor actual
      viewRef.current.destroy();
      viewRef.current = null;

      // Crear nuevo editor con nuevas extensiones
      const state = EditorState.create({
        doc: currentValue,
        extensions: createExtensions()
      });

      const view = new EditorView({
        state,
        parent: editorRef.current
      });

      // Restaurar selección
      view.dispatch({
        selection: currentSelection
      });

      viewRef.current = view;
      view.focus();
    }
  }, [availableTags, imageTags, isFullScreen]);

  return (
    <div 
      className={`codemirror-editor-container ${className}`} 
      style={{ height: '100%', width: '100%' }}
      onClick={() => {
        // Enfocar cuando se hace click en el contenedor
        if (viewRef.current) {
          viewRef.current.focus();
        }
      }}
    >
      <div ref={editorRef} style={{ height: '100%', width: '100%' }} />
    </div>
  );
};
