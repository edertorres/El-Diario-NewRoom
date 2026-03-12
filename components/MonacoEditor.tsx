import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as monaco from 'monaco-editor';
import 'monaco-editor/min/vs/editor/editor.main.css';
import { normalizeTag } from '../utils/tagUtils';
import { IDMLStory } from '../types';

interface MonacoEditorProps {
  value: string;
  onChange: (value: string) => void;
  stories: IDMLStory[];
  availableTags: string[];
  imageTags?: string[];
  placeholder?: string;
  className?: string;
  isFullScreen?: boolean;
  inlineWordCounts?: {
    counts: Record<string, number>;
    limits: Record<string, number>;
  };
}

type ColorGroup = { bg: string; border: string; text: string; id: number };

const getColorGroup = (() => {
  const colorGroups: Map<string, number> = new Map();
  const colors = [
    { bg: 'rgba(99, 102, 241, 0.1)', border: 'rgba(99, 102, 241, 0.2)', text: '#4f46e5' }, // Indigo
    { bg: 'rgba(34, 197, 94, 0.1)', border: 'rgba(34, 197, 94, 0.2)', text: '#22c55e' }, // Green
    { bg: 'rgba(249, 115, 22, 0.1)', border: 'rgba(249, 115, 22, 0.2)', text: '#f97316' }, // Orange
    { bg: 'rgba(168, 85, 247, 0.1)', border: 'rgba(168, 85, 247, 0.2)', text: '#a855f7' }, // Purple
    { bg: 'rgba(236, 72, 153, 0.1)', border: 'rgba(236, 72, 153, 0.2)', text: '#ec4899' }, // Pink
    { bg: 'rgba(59, 130, 246, 0.1)', border: 'rgba(59, 130, 246, 0.2)', text: '#3b82f6' }, // Blue
    { bg: 'rgba(234, 179, 8, 0.1)', border: 'rgba(234, 179, 8, 0.2)', text: '#eab308' }, // Yellow
    { bg: 'rgba(14, 165, 233, 0.1)', border: 'rgba(14, 165, 233, 0.2)', text: '#0ea5e9' } // Sky
  ];

  return (tagName: string): ColorGroup => {
    const normalized = tagName.toUpperCase().trim();
    let groupId = -1;
    for (const [existing, id] of colorGroups.entries()) {
      const minLen = Math.min(normalized.length, existing.length);
      if (minLen >= 3) {
        const prefA = normalized.substring(0, Math.min(4, minLen));
        const prefB = existing.substring(0, Math.min(4, minLen));
        if (prefA === prefB || normalized.includes(existing.substring(0, 3)) || existing.includes(normalized.substring(0, 3))) {
          groupId = id;
          break;
        }
      }
    }
    if (groupId === -1) {
      groupId = colorGroups.size % colors.length;
      colorGroups.set(normalized, groupId);
    }
    const chosen = colors[groupId];
    return { ...chosen, id: groupId };
  };
})();

export const MonacoEditor: React.FC<MonacoEditorProps> = ({
  value,
  onChange,
  stories,
  availableTags,
  imageTags = [],
  placeholder = 'Escribe aquí usando ##ETIQUETA para cada sección...',
  className = '',
  isFullScreen = false,
  inlineWordCounts
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const decorationsRef = useRef<string[]>([]);
  const storiesRef = useRef<IDMLStory[]>(stories);
  const availableTagsRef = useRef<string[]>(availableTags);
  const imageTagsRef = useRef<string[]>(imageTags);
  const onChangeRef = useRef(onChange);
  const inlineWordCountsRef = useRef<typeof inlineWordCounts>(inlineWordCounts);
  const [missingInEditor, setMissingInEditor] = useState<string[]>([]);
  const internalValueRef = useRef<string>(value);
  const emittedQueueRef = useRef<string[]>([value]);

  useEffect(() => {
    storiesRef.current = stories;
  }, [stories]);

  useEffect(() => {
    availableTagsRef.current = availableTags;
  }, [availableTags]);

  useEffect(() => {
    imageTagsRef.current = imageTags;
  }, [imageTags]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    inlineWordCountsRef.current = inlineWordCounts;
    updateDecorations();
  }, [inlineWordCounts]);

  // Reaplicar decoraciones si cambian historias, tags o valor externo
  useEffect(() => {
    updateDecorations();
  }, [stories, availableTags, imageTags, value, isFullScreen]);

  const countWords = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;

  const updateDecorations = () => {
    const editor = editorRef.current;
    if (!editor) return;
    const model = editor.getModel();
    if (!model) return;

    const text = model.getValue();
    const normalizedAvailable = availableTagsRef.current.map(normalizeTag);
    const idmlTags = storiesRef.current
      .map((s) => normalizeTag(s.scriptLabel))
      .filter(Boolean);
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];
    const regex = /##([A-Za-z0-9_]+)[ \t]*/g;
    let match: RegExpExecArray | null;

    const matches: Array<{ start: number; end: number; tagName: string }> = [];
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        start: match.index,
        end: match.index + match[0].length,
        tagName: normalizeTag(match[1])
      });
    }

    const countsMap = inlineWordCountsRef.current?.counts || {};
    const limitsMap = inlineWordCountsRef.current?.limits || {};

    for (let i = 0; i < matches.length; i++) {
      const { start, end, tagName } = matches[i];
      const nextStart = matches[i + 1]?.start ?? text.length;
      const blockText = text.substring(end, nextStart);
      const usedWords = countsMap[tagName] ?? countWords(blockText);

      const story = storiesRef.current.find((s) => normalizeTag(s.scriptLabel) === tagName);
      const limit = limitsMap[tagName] ?? story?.initialWordCount ?? 0;
      const diff = usedWords - limit;

      const startPos = model.getPositionAt(start);
      const endPos = model.getPositionAt(end);
      const isValid = normalizedAvailable.includes(tagName) || normalizedAvailable.length === 0;
      const inIdml = idmlTags.includes(tagName);

      let diffText = "";
      if (limit > 0) {
        if (diff > 0) diffText = `(+${diff} sobrantes)`;
        else if (diff < 0) diffText = `(${diff} faltan)`;
        else diffText = `(Exacto)`;
      }

      const badgeText = limit > 0
        ? ` ${limit}  →  ${usedWords} ${diffText} ${inIdml ? '✓' : '!'} `
        : ` —  →  ${usedWords} ${inIdml ? '✓' : '!'} `;
      const tooltip =
        limit > 0
          ? `Palabras esperadas: ${limit}, escritas: ${usedWords}, diferencia: ${diff}`
          : `Palabras escritas: ${usedWords}`;

      const statusClass =
        !inIdml ? 'monaco-badge-miss' :
          limit === 0 ? 'monaco-badge-warn' :
            usedWords > limit ? 'monaco-badge-over' :
              usedWords < limit ? 'monaco-badge-warn' : 'monaco-badge-ok';

      if (isValid) {
        const colorGroup = getColorGroup(tagName);
        decorations.push({
          range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          options: {
            inlineClassName: `monaco-tag monaco-tag-color-${colorGroup.id}`,
            after: {
              content: badgeText,
              inlineClassName: `monaco-tag-badge ${statusClass}`,
              inlineClassNameAffectsLetterSpacing: true
            },
            hoverMessage: { value: tooltip }
          }
        });
      } else {
        decorations.push({
          range: new monaco.Range(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
          options: {
            inlineClassName: 'monaco-tag-invalid',
            after: {
              content: badgeText,
              inlineClassName: `monaco-tag-badge monaco-badge-over`,
              inlineClassNameAffectsLetterSpacing: true
            },
            hoverMessage: { value: tooltip }
          }
        });
      }
    }

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, decorations);

    // Etiquetas presentes en IDML pero no en editor
    const editorTags = matches.map((m) => m.tagName);
    const missing = idmlTags.filter((t) => !editorTags.includes(t));
    setMissingInEditor(missing);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const editor = monaco.editor.create(containerRef.current, {
      value,
      language: 'plaintext',
      theme: 'vs',
      automaticLayout: true,
      fontFamily: 'monospace',
      fontSize: isFullScreen ? 18 : 16,
      lineHeight: 26,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: isFullScreen ? 32 : 24, bottom: isFullScreen ? 32 : 24 },
      wordWrap: 'on',
      renderLineHighlight: 'line',
      guides: { indentation: false },
      cursorBlinking: 'blink',
      quickSuggestions: false,
      contextmenu: false
    });

    editorRef.current = editor;

    const disposables: monaco.IDisposable[] = [];

    // Placeholder emulation
    editor.onDidChangeModelContent(() => {
      const newValue = editor.getValue();
      internalValueRef.current = newValue; // Guardamos el valor interno asincrónico
      emittedQueueRef.current.push(newValue);
      if (emittedQueueRef.current.length > 50) {
        emittedQueueRef.current.shift();
      }
      if (newValue !== value) {
        onChangeRef.current(newValue);
      }
      updateDecorations();
    });

    // Decorations on initial render
    updateDecorations();

    // Atajo Ctrl/Cmd + B para envolver con **...**
    const boldCommand = editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB,
      () => {
        const model = editor.getModel();
        if (!model) return;
        const selections = editor.getSelections();
        if (!selections || selections.length === 0) return;

        const edits: monaco.editor.IIdentifiedSingleEditOperation[] = [];

        selections.forEach((sel) => {
          const selText = model.getValueInRange(sel);
          if (selText && selText.length > 0) {
            // Envolver selección existente
            edits.push({
              range: sel,
              text: `**${selText}**`,
              forceMoveMarkers: true
            });
          } else {
            // Sin selección: insertar **** y colocar cursor en medio
            const insertPos = sel.getStartPosition();
            edits.push({
              range: new monaco.Range(insertPos.lineNumber, insertPos.column, insertPos.lineNumber, insertPos.column),
              text: `****`,
              forceMoveMarkers: true
            });
          }
        });

        editor.executeEdits('bold-toggle', edits);

        // Ajustar cursores cuando no había selección
        const newSelections = editor.getSelections()?.map((sel) => {
          const selText = model.getValueInRange(sel);
          if (selText && selText.length > 0) {
            // Dejamos selección tal cual (ya envuelta)
            return sel;
          } else {
            // Colocar cursor entre los dos asteriscos centrales
            const pos = sel.getStartPosition();
            return new monaco.Selection(pos.lineNumber, pos.column + 2, pos.lineNumber, pos.column + 2);
          }
        });
        if (newSelections) {
          editor.setSelections(newSelections);
        }
      }
    );

    // addCommand no expone removeCommand en la API pública; no-op en cleanup
    disposables.push({ dispose: () => { } } as monaco.IDisposable);

    // Autocompletado
    const completionProvider = monaco.languages.registerCompletionItemProvider('plaintext', {
      triggerCharacters: ['#'],
      provideCompletionItems: (model, position) => {
        const textUntilPosition = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column
        });

        const cursorOffset = model.getOffsetAt(position);
        const before = textUntilPosition.substring(0, cursorOffset);
        const lastHash = before.lastIndexOf('##');
        if (lastHash === -1 || cursorOffset - lastHash > 50) return { suggestions: [] };

        const queryRaw = before.substring(lastHash + 2);
        const query = normalizeTag(queryRaw);
        const available = availableTagsRef.current;
        const images = imageTagsRef.current;

        const matches = available.filter((tag) => {
          const n = normalizeTag(tag);
          return query ? n.includes(query) : true;
        });

        const replaceRange = new monaco.Range(
          model.getPositionAt(lastHash + 2).lineNumber,
          model.getPositionAt(lastHash + 2).column,
          position.lineNumber,
          position.column
        );

        const suggestions = matches.slice(0, 30).map((tag) => {
          const isImage = images.includes(tag);
          // No incluir ## en insertText porque replaceRange ya incluye desde después de ##
          const insertText = `${normalizeTag(tag)}\n`;
          return {
            label: tag,
            kind: monaco.languages.CompletionItemKind.Property,
            insertText,
            range: replaceRange,
            detail: isImage ? 'Imagen' : 'Texto',
            sortText: isImage ? `1_${tag}` : `0_${tag}`
          } as monaco.languages.CompletionItem;
        });

        return { suggestions };
      }
    });
    disposables.push(completionProvider);

    // Focus inicial
    setTimeout(() => editor.focus(), 100);

    return () => {
      disposables.forEach((d) => d.dispose());
      editor.dispose();
      decorationsRef.current = [];
      editorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInsertTag = (tag: string) => {
    const editor = editorRef.current;
    if (!editor) return;

    const position = editor.getPosition();
    const model = editor.getModel();

    if (!position || !model) {
      // Si no hay posición conocida, insertamos al final
      const lineCount = model ? model.getLineCount() : 1;
      const lastLineLength = model ? model.getLineMaxColumn(lineCount) : 1;
      editor.executeEdits('insert-missing-tag', [{
        range: new monaco.Range(lineCount, lastLineLength, lineCount, lastLineLength),
        text: `\n##${tag}\n`,
        forceMoveMarkers: true,
      }]);
      editor.setPosition({ lineNumber: lineCount + 2, column: 1 });
      editor.focus();
      return;
    }

    const currentLineContent = model.getLineContent(position.lineNumber);
    const isLineEmpty = currentLineContent.trim() === '';

    let textToInsert = `##${tag}\n`;

    // Si no estamos al principio de una línea no vacía, agregamos salto de línea antes
    if (position.column > 1 && !isLineEmpty) {
      textToInsert = `\n\n##${tag}\n`;
    } else if (position.column === 1 && !isLineEmpty) {
      textToInsert = `##${tag}\n\n`;
    }

    editor.executeEdits('insert-missing-tag', [
      {
        range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
        text: textToInsert,
        forceMoveMarkers: true,
      }
    ]);

    editor.focus();
  };

  // Actualizar valor externo
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) return;

    const current = editor.getValue();
    const normalizedValue = value.replace(/\r\n/g, '\n');

    // Comprobamos si el valor que nos envía React está en nuestra cola de emisiones recientes.
    // Esto significa que es un "eco" de algo que acabamos de escribir, retrasado por los ciclos de React.
    const queueIndex = emittedQueueRef.current.findIndex(v => v.replace(/\r\n/g, '\n') === normalizedValue);

    if (queueIndex !== -1) {
      // Es un eco. Eliminamos este y los anteriores de la cola.
      emittedQueueRef.current.splice(0, queueIndex + 1);
      return;
    }

    const normalizedCurrent = current.replace(/\r\n/g, '\n');

    if (normalizedValue !== normalizedCurrent) {
      // Si el valor nuevo no estaba en la cola de emisiones recientes, 
      // y es diferente a lo que hay en el editor, es un cambio genuino forzado desde afuera 
      // (por ejemplo, inyección de AI, botón de reiniciar, cambio de tab).
      emittedQueueRef.current = []; // Limpiamos la cola porque el cambio externo invalida todo
      const model = editor.getModel();
      if (model) {
        // Guardar la vista y posiciones del cursor
        const viewState = editor.saveViewState();

        internalValueRef.current = value; // Actualizamos el ref interno ya que forzaremos el cambio
        const fullRange = model.getFullModelRange();
        editor.executeEdits('external-update', [
          {
            range: fullRange,
            text: value,
            forceMoveMarkers: true
          }
        ]);

        // Restaurar estado del cursor y scroll
        if (viewState) {
          editor.restoreViewState(viewState);
        }

        updateDecorations();
      }
    }
  }, [value]);

  // Reaplicar decoraciones al cambiar tags o fullscreen
  useEffect(() => {
    updateDecorations();
    const editor = editorRef.current;
    if (editor) {
      editor.updateOptions({
        fontSize: isFullScreen ? 18 : 16,
        padding: { top: isFullScreen ? 32 : 24, bottom: isFullScreen ? 32 : 24 }
      });
    }
  }, [availableTags, imageTags, isFullScreen]);

  return (
    <div className={`codemirror-editor-container ${className}`} style={{ height: '100%', width: '100%', position: 'relative' }}>
      {missingInEditor.length > 0 && (
        <div className="monaco-missing-panel">
          <div className="monaco-missing-title">Etiquetas en IDML no presentes en el editor:</div>
          <div className="monaco-missing-list">
            {missingInEditor.map((tag) => (
              <span
                key={tag}
                className="monaco-missing-chip"
                onClick={() => handleInsertTag(tag)}
                title="Haz clic para insertar esta etiqueta en la posición del cursor"
              >
                ##{tag}
              </span>
            ))}
          </div>
        </div>
      )}
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} data-placeholder={placeholder} />
    </div>
  );
};
