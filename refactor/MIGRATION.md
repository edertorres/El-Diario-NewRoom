# Guía de Migración - Refactorización IDML Injector Pro

## Resumen de Cambios

Esta refactorización reemplaza CodeMirror con un editor más simple y amigable, mejorando significativamente la UX para periodistas.

## Cambios Principales

### Eliminado
- CodeMirror y todas sus dependencias
- Lógica compleja de autocompletado manual
- Sistema de resaltado basado en decoraciones de CodeMirror

### Agregado
- `SimpleEditor`: Editor simple con resaltado sintáctico
- `TagAutocomplete`: Sistema de autocompletado mejorado
- `SyntaxHighlighter`: Resaltado optimizado
- Hooks personalizados para lógica reutilizable
- Utilidades para manejo de etiquetas y editor

## Pasos de Migración

### 1. Preparar Estructura

```bash
# Crear directorios si no existen
mkdir -p hooks utils styles
```

### 2. Copiar Archivos

```bash
# Desde la carpeta refactor/
cp -r refactor/components/* components/
cp -r refactor/hooks/* hooks/
cp -r refactor/utils/* utils/
cp refactor/styles/editor.css styles/
```

### 3. Actualizar package.json

Eliminar estas dependencias:
```json
{
  "dependencies": {
    "@codemirror/autocomplete": "^6.20.0",
    "@codemirror/basic-setup": "^0.20.0",
    "@codemirror/lang-markdown": "^6.5.0",
    "@codemirror/state": "^6.5.3",
    "@codemirror/theme-one-dark": "^6.1.3",
    "@codemirror/view": "^6.39.9",
    "codemirror": "^6.0.2"
  }
}
```

Ejecutar:
```bash
npm install
```

### 4. Actualizar StoryMapper.tsx

#### 4.1. Reemplazar imports

**Antes:**
```typescript
import { EditorView, basicSetup } from 'codemirror';
import { EditorState, StateField, StateEffect } from '@codemirror/state';
import { Decoration, DecorationSet, ViewPlugin, ViewUpdate } from '@codemirror/view';
import { autocompletion } from '@codemirror/autocomplete';
import { keymap } from '@codemirror/view';
```

**Después:**
```typescript
import { SimpleEditor } from './SimpleEditor';
import { WordCountIndicator } from './WordCountIndicator';
import { normalizeTag, parseBatchText } from '../utils/tagUtils';
```

#### 4.2. Eliminar estados y refs de CodeMirror

Eliminar:
- `codeMirrorViewRef`
- `codeMirrorContainerRef`
- `codeMirrorExtensions`
- `autocompleteVisible`, `autocompletePosition`, etc. (ahora manejados por SimpleEditor)

#### 4.3. Reemplazar el editor en el tab 'batch'

**Antes:**
```typescript
<div ref={codeMirrorContainerRef} className="flex-1 w-full h-full overflow-hidden" />
```

**Después:**
```typescript
<SimpleEditor
  value={batchText}
  onChange={setBatchText}
  availableTags={availableTags}
  imageTags={imageTags}
  placeholder="Escribe aquí usando ##ETIQUETA para cada sección..."
  isFullScreen={isFullScreen}
  className="flex-1"
/>
```

#### 4.4. Eliminar funciones obsoletas

Eliminar:
- `codeMirrorExtensions` (useMemo)
- `updateAutocompletePosition`
- `insertAutocompleteTag`
- `handleAutocompleteKeyDown` (ahora manejado por SimpleEditor)
- `highlightedBatchText` (useMemo)
- `handleBatchScroll`

#### 4.5. Simplificar lógica de batch

La función `handleBatchInject` puede simplificarse usando `parseBatchText`:

```typescript
const parsedUpdates = parseBatchText(batchText);
```

### 5. Actualizar index.css o index.tsx

Agregar import de estilos:
```typescript
import './styles/editor.css';
```

### 6. Actualizar normalizeTag

Si hay múltiples definiciones de `normalizeTag`, usar la de `utils/tagUtils`:

```typescript
import { normalizeTag } from '../utils/tagUtils';
```

## Verificación

Después de la migración, verificar:

1. ✅ El editor carga correctamente
2. ✅ El resaltado de etiquetas funciona
3. ✅ El autocompletado aparece al escribir `##`
4. ✅ Las negritas funcionan con Ctrl+B
5. ✅ La inyección de batch funciona
6. ✅ No hay errores en la consola

## Rollback

Si necesitas volver atrás:

1. Restaurar `StoryMapper.tsx` desde git
2. Reinstalar dependencias de CodeMirror:
   ```bash
   npm install @codemirror/autocomplete @codemirror/basic-setup @codemirror/lang-markdown @codemirror/state @codemirror/theme-one-dark @codemirror/view codemirror
   ```

## Notas

- La funcionalidad se mantiene 100% compatible
- El rendimiento debería mejorar (menos dependencias pesadas)
- La UX es más amigable para usuarios no técnicos
- El código es más simple y mantenible
