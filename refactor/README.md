# Refactorización IDML Injector Pro

Esta carpeta contiene la refactorización completa de la aplicación, enfocada en mejorar la usabilidad y UI para periodistas.

## Estructura

```
refactor/
├── components/          # Componentes nuevos
│   ├── SimpleEditor.tsx           # Editor principal (reemplaza CodeMirror)
│   ├── TagAutocomplete.tsx        # Autocompletado mejorado
│   ├── SyntaxHighlighter.tsx     # Resaltado sintáctico
│   ├── WordCountIndicator.tsx     # Indicador de palabras
│   └── StoryMapper.refactored.tsx # Versión refactorizada (en progreso)
├── hooks/              # Hooks personalizados
│   ├── useTagAutocomplete.ts       # Lógica de autocompletado
│   └── useSyntaxHighlight.ts      # Lógica de resaltado
├── utils/              # Utilidades
│   ├── tagUtils.ts                # Utilidades de etiquetas
│   └── editorUtils.ts             # Utilidades del editor
└── styles/             # Estilos
    └── editor.css                  # Estilos del editor
```

## Componentes Principales

### SimpleEditor
Editor de texto simple que reemplaza CodeMirror. Características:
- Resaltado sintáctico en tiempo real
- Autocompletado de etiquetas con dropdown flotante
- Soporte para negritas markdown (Ctrl+B)
- Mejor rendimiento y UX para periodistas

### TagAutocomplete
Sistema de autocompletado mejorado:
- Dropdown flotante con posicionamiento inteligente
- Búsqueda fuzzy de etiquetas
- Indicadores visuales de etiquetas de texto vs imágenes
- Navegación con teclado

### SyntaxHighlighter
Resaltado sintáctico optimizado:
- Etiquetas `##ETIQUETA` resaltadas
- Negritas markdown (`**texto**` o `__texto__`)
- Indicadores de etiquetas inválidas
- Alto contraste para legibilidad

## Integración

### Paso 1: Copiar archivos
Los archivos deben moverse desde `refactor/` a la raíz del proyecto:

```bash
# Componentes
cp -r refactor/components/* components/

# Hooks
mkdir -p hooks
cp -r refactor/hooks/* hooks/

# Utils
mkdir -p utils
cp -r refactor/utils/* utils/

# Estilos
cp refactor/styles/editor.css styles/
```

### Paso 2: Actualizar imports
En `components/StoryMapper.tsx`, reemplazar:
- Imports de CodeMirror → SimpleEditor
- Lógica de autocompletado → useTagAutocomplete hook
- Resaltado manual → SyntaxHighlighter

### Paso 3: Actualizar dependencias
Eliminar de `package.json`:
- `@codemirror/*`
- `codemirror`

### Paso 4: Importar estilos
En `index.tsx` o `App.tsx`, agregar:
```typescript
import './styles/editor.css';
```

## Estado Actual

- ✅ Componentes base creados
- ✅ Hooks implementados
- ✅ Utilidades creadas
- ✅ Estilos definidos
- ⏳ Integración en StoryMapper (en progreso)
- ⏳ Testing pendiente

## Próximos Pasos

1. Completar la integración en StoryMapper
2. Probar funcionalidad completa
3. Optimizar rendimiento
4. Mejorar UI del sidebar
5. Testing completo

## Notas

- La versión refactorizada mantiene toda la funcionalidad existente
- El código es más simple y mantenible
- Mejor UX para usuarios no técnicos (periodistas)
- Sin dependencias pesadas de CodeMirror
