
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { IDMLStory, IDMLSpread, ImageFrame, UploadedImage } from '../types';
import { idmlEngine } from '../services/idmlEngine';
import { rewriteContent, smartTrim, AiConfig } from '../services/gemini';
import { uploadFile } from '../services/driveApi';
import { getDriveConfig, getAppConfig } from '../services/driveService';
import { googleAuth } from '../services/googleAuth';
import { storageManager } from '../services/storage/StorageManager';
import DestinationFolderSelector from './DestinationFolderSelector';
import { MonacoEditor } from './MonacoEditor';
import { WordCountIndicator } from './WordCountIndicator';
import { PreviewModal } from './PreviewModal';
import { normalizeTag, parseBatchText } from '../utils/tagUtils';
import { typstGenerator } from '../services/typstGenerator';
import { useTypstLive } from '../hooks/useTypstLive';
import {
  Sparkles,
  Download,
  CheckCircle,
  Edit3,
  Tag,
  AlertTriangle,
  Loader2,
  Search,
  ClipboardList,
  Zap,
  ArrowRightLeft,
  XCircle,
  AlertCircle,
  Image as ImageIcon,
  Type,
  Upload,
  RefreshCw,
  Eye,
  EyeOff,
  Settings2,
  Scissors,
  Wand2,
  Ghost,
  FileX2,
  Maximize2,
  Minimize2,
  Cloud,
  GripVertical,
  ArrowLeft,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';

interface Props {
  stories: IDMLStory[];
  setStories: React.Dispatch<React.SetStateAction<IDMLStory[]>>;
  spreads: IDMLSpread[];
  imagesFolderId?: string;
  batchText: string;
  setBatchText: (text: string) => void;
  templateName?: string;
  templateCategory?: string;
  onResetTemplate?: () => void;
}

// Ordenamiento natural: FOTO1, FOTO2, FOTO10 en lugar de FOTO1, FOTO10, FOTO2
const naturalSort = (a: string, b: string): number => {
  const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');
  const aNorm = normalize(a);
  const bNorm = normalize(b);

  // Comparar parte por parte (texto y números)
  const regex = /(\d+|\D+)/g;
  const aParts = aNorm.match(regex) || [];
  const bParts = bNorm.match(regex) || [];

  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aPart = aParts[i] || '';
    const bPart = bParts[i] || '';

    const aNum = parseInt(aPart, 10);
    const bNum = parseInt(bPart, 10);

    if (!isNaN(aNum) && !isNaN(bNum)) {
      // Comparar números
      if (aNum !== bNum) return aNum - bNum;
    } else {
      // Comparar texto
      if (aPart !== bPart) return aPart < bPart ? -1 : 1;
    }
  }

  return 0;
};

const StoryMapper: React.FC<Props> = ({ stories, setStories, spreads, imagesFolderId, batchText, setBatchText, templateName, templateCategory, onResetTemplate }) => {
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [modifiedStories, setModifiedStories] = useState<Set<string>>(new Set());
  const [modifiedImages, setModifiedImages] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showUntagged, setShowUntagged] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'text' | 'images'>('text');
  const [activeTab, setActiveTab] = useState<'editor' | 'batch'>('batch');
  const [batchLog, setBatchLog] = useState<{ success: number, total: number, sobrantes: number } | null>(null);
  const [invalidTags, setInvalidTags] = useState<string[]>([]);
  const [showOrphanAlert, setShowOrphanAlert] = useState(false);
  const [lastBatchLabels, setLastBatchLabels] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDestinationSelector, setShowDestinationSelector] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [lastDestinationFolderPath, setLastDestinationFolderPath] = useState<string | null>(null);
  const [useRelativeLinks, setUseRelativeLinks] = useState<boolean>(true);
  const [showLivePreview, setShowLivePreview] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(true);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [currentImageTag, setCurrentImageTag] = useState<string | null>(null);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Estados para imágenes independientes
  // Estados para imágenes independientes
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImagesProgress, setUploadingImagesProgress] = useState<{ current: number, total: number } | null>(null);
  const [draggedImageId, setDraggedImageId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  // Estado para el modal de progreso unificado
  interface UploadProgressItem {
    name: string;
    status: 'uploading' | 'success' | 'error';
    error?: string;
  }
  interface UploadProgressState {
    isVisible: boolean;
    status: 'uploading' | 'success' | 'error';
    idmlFile: UploadProgressItem | null;
    images: UploadProgressItem[];
    folderPath: string | null;
    error?: string;
  }
  const [uploadProgress, setUploadProgress] = useState<UploadProgressState>({
    isVisible: false,
    status: 'uploading',
    idmlFile: null,
    images: [],
    folderPath: null
  });

  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    tone: "Profesional, conciso y directo",
    glossary: ""
  });

  const countWords = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
  const getParentFolderName = (path?: string | null): string => {
    if (!path) return "";
    const parts = path.split('/').filter(Boolean);
    return parts.length ? parts[parts.length - 1] : "";
  };
  const formatDateDDMMYYYY = (d: Date) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };
  const buildIdmlFileName = (opts: { folderPath?: string | null; baseFileName?: string }): string => {
    const parent = getParentFolderName(opts.folderPath);
    const base = opts.baseFileName ? opts.baseFileName.replace(/\.idml$/i, '') : '';
    const fallback = parent || base || 'document';
    const dateStr = formatDateDDMMYYYY(new Date());
    return `${fallback}_${dateStr}.idml`;
  };
  // Utilidad: obtener mapa de words usados por bloque ##TAG en batchText
  const getBatchWordCounts = () => {
    const regex = /##([A-Za-z0-9_]+)\s*\n([\s\S]*?)(?=\n##|$)/g;
    const counts: Record<string, number> = {};
    let match;
    while ((match = regex.exec(batchText)) !== null) {
      const tag = match[1].trim().toUpperCase();
      const content = match[2] || '';
      counts[tag] = countWords(content);
    }
    return counts;
  };

  const getBatchLimits = () => {
    const limits: Record<string, number> = {};
    stories.forEach((s) => {
      if (s.scriptLabel) {
        const key = normalizeTag(s.scriptLabel);
        limits[key] = s.initialWordCount || 0;
      }
    });
    return limits;
  };

  const batchWordCounts = getBatchWordCounts();
  const batchLimits = getBatchLimits();


  // Función reutilizable para inyectar contenido del batchText en stories (sin modificar estado)
  const injectBatchContentIntoStories = (batchTextInput: string, currentStories: IDMLStory[]): IDMLStory[] => {
    if (!batchTextInput.trim()) return currentStories;

    const parsedUpdates = parseBatchText(batchTextInput);
    const availableLabels = new Set(currentStories.map(s => normalizeTag(s.scriptLabel)).filter(Boolean));
    const detectedLabels = Object.keys(parsedUpdates);
    const orphans = detectedLabels.filter(label => !availableLabels.has(label) && label !== "SOBRANTES");

    // Reiniciar siempre SOBRANTES y reconstruir sólo con huérfanos + SOBRANTES explícito
    let sobrantesAccumulated = "";
    if (parsedUpdates["SOBRANTES"]) {
      sobrantesAccumulated = `##SOBRANTES\n${parsedUpdates["SOBRANTES"]}`;
    }
    orphans.forEach(tag => {
      const contentToAdd = parsedUpdates[tag];
      sobrantesAccumulated += (sobrantesAccumulated ? "\n\n" : "") + `##${tag}\n${contentToAdd}`;
    });

    const updatedStories = currentStories.map((story) => {
      const storyLabel = normalizeTag(story.scriptLabel);
      if (storyLabel === "SOBRANTES") {
        return { ...story, content: sobrantesAccumulated, isModified: true };
      }
      if (storyLabel) {
        // Si tiene tag, usar el contenido del batch (o vacío si no está)
        const newContent = parsedUpdates[storyLabel] || "";
        return { ...story, content: newContent, isModified: true };
      }
      // Sin tag: preservar original
      return story;
    });

    return updatedStories;
  };

  const storiesWithOverflow = useMemo(() =>
    stories.filter(s => countWords(s.content) > (s.initialWordCount || 0)),
    [stories]
  );

  const imageFramesByTag = useMemo(() => {
    const map = new Map<string, ImageFrame[]>();
    spreads.forEach(spread => {
      spread.imageFrames.forEach(frame => {
        if (frame.scriptLabel) {
          const list = map.get(frame.scriptLabel) || [];
          list.push(frame);
          map.set(frame.scriptLabel, list);
        }
      });
    });
    return map;
  }, [spreads]);

  const imageTags = useMemo(() => Array.from(imageFramesByTag.keys()).sort(), [imageFramesByTag]);

  // Lista ordenada de todos los imageFrames con sus tags (para asignación de nombres)
  const imageFramesOrdered = useMemo(() => {
    const frames: Array<{ scriptLabel: string }> = [];
    spreads.forEach(spread => {
      spread.imageFrames.forEach(frame => {
        if (frame.scriptLabel) {
          frames.push({ scriptLabel: frame.scriptLabel });
        }
      });
    });
    // Ordenar de forma natural (FOTO1, FOTO2, FOTO10 en lugar de FOTO1, FOTO10, FOTO2)
    return frames.sort((a, b) => naturalSort(a.scriptLabel, b.scriptLabel));
  }, [spreads]);

  // Etiquetas disponibles para autocompletado (normalizadas)
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    stories.forEach(s => {
      const label = normalizeTag(s.scriptLabel);
      if (label) tags.add(label);
    });
    imageTags.forEach(tag => {
      const normalized = normalizeTag(tag);
      if (normalized) tags.add(normalized);
    });
    return Array.from(tags).sort();
  }, [stories, imageTags]);

  const selectedStory = useMemo(() =>
    stories.find(s => s.id === selectedStoryId),
    [stories, selectedStoryId]
  );

  // CodeMirror eliminado - ahora usamos SimpleEditor que maneja todo internamente

  useEffect(() => {
    if (stories.length > 0 && !selectedStoryId) {
      setSelectedStoryId(stories[0].id);
      setEditedContent(stories[0].content);
    }
  }, [stories]);

  // Auto-aplicar batchText cuando cambian las stories (ej: al cargar nueva plantilla)
  useEffect(() => {
    if (batchText.trim() && stories.length > 0) {
      // Solo auto-aplicar si las stories parecen "frescas" (ninguna marcada como isModified)
      const isFresh = !stories.some(s => s.isModified);
      if (isFresh) {
        console.log("[StoryMapper] Auto-aplicando batchText a nueva plantilla...");
        handleBatchInject();
      }
    }
  }, [stories.length]); // Disparar cuando cambia el número de historias (nueva carga)

  // Limpiar previews de imágenes al desmontar
  useEffect(() => {
    return () => {
      uploadedImages.forEach(img => {
        if (img.preview) {
          URL.revokeObjectURL(img.preview);
        }
      });
    };
  }, [uploadedImages]);

  // Funciones de autocompletado manual eliminadas - ahora manejadas por SimpleEditor
  // Eliminadas: updateAutocompletePosition, insertAutocompleteTag, handleAutocompleteKeyDown, highlightedBatchText, handleBatchScroll

  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value;
    setEditedContent(newVal);
    if (selectedStoryId) {
      setStories(prev => prev.map(s =>
        s.id === selectedStoryId ? { ...s, content: newVal, isModified: true } : s
      ));
      setModifiedStories(prev => new Set(prev).add(selectedStoryId));
    }
  };

  const handleAiRewrite = async () => {
    if (!selectedStoryId) return;
    const story = stories.find(s => s.id === selectedStoryId);
    setIsProcessing(true);
    const newText = await rewriteContent(editedContent, story?.scriptLabel || "", aiPrompt || "Mejora la redacción.", aiConfig);
    setEditedContent(newText);
    setStories(prev => prev.map(s =>
      s.id === selectedStoryId ? { ...s, content: newText, isModified: true } : s
    ));
    setModifiedStories(prev => new Set(prev).add(selectedStoryId));
    setIsProcessing(false);
  };

  const handleAutoTrimAll = async () => {
    if (storiesWithOverflow.length === 0) return;
    setIsProcessing(true);
    const updatedStories = [...stories];
    for (const story of storiesWithOverflow) {
      const trimmedText = await smartTrim(story.content, story.initialWordCount || 10, aiConfig);
      const idx = updatedStories.findIndex(s => s.id === story.id);
      if (idx !== -1) {
        updatedStories[idx] = { ...updatedStories[idx], content: trimmedText, isModified: true };
        setModifiedStories(prev => new Set(prev).add(story.id));
      }
    }
    setStories(updatedStories);
    if (selectedStoryId) {
      const current = updatedStories.find(s => s.id === selectedStoryId);
      if (current) setEditedContent(current.content);
    }
    setIsProcessing(false);
  };

  const handleBatchInject = async () => {
    if (!batchText.trim()) return;
    setIsProcessing(true);
    setShowOrphanAlert(false);

    // Usar parseBatchText de utils
    const parsedUpdates = parseBatchText(batchText);

    const availableLabels = new Set(stories.map(s => normalizeTag(s.scriptLabel)).filter(Boolean));
    const detectedLabels = Object.keys(parsedUpdates);
    const orphans = detectedLabels.filter(label => !availableLabels.has(label) && label !== "SOBRANTES");

    setInvalidTags(orphans);
    setLastBatchLabels(new Set(detectedLabels));

    if (orphans.length > 0) setShowOrphanAlert(true);

    let matchCount = 0;
    const newModifiedIds = new Set(modifiedStories);
    let sobrantesAccumulated = parsedUpdates["SOBRANTES"] ? `##SOBRANTES\n${parsedUpdates["SOBRANTES"]}` : "";

    orphans.forEach(tag => {
      const contentToAdd = parsedUpdates[tag];
      sobrantesAccumulated += (sobrantesAccumulated ? "\n\n" : "") + `##${tag}\n${contentToAdd}`;
    });

    const updatedStories = stories.map((story) => {
      const storyLabel = normalizeTag(story.scriptLabel);
      if (storyLabel === "SOBRANTES") {
        newModifiedIds.add(story.id);
        return { ...story, content: sobrantesAccumulated, isModified: true };
      }
      if (storyLabel) {
        newModifiedIds.add(story.id);
        const newContent = parsedUpdates[storyLabel] || "";
        if (parsedUpdates[storyLabel]) matchCount++;
        return { ...story, content: newContent, isModified: true };
      }
      return story;
    });

    setStories(updatedStories);
    setModifiedStories(newModifiedIds);
    setBatchLog({
      success: matchCount + (availableLabels.has("SOBRANTES") && sobrantesAccumulated ? 1 : 0),
      total: detectedLabels.length,
      sobrantes: orphans.length
    });
    setIsProcessing(false);
    setIsFullScreen(false); // Salir de full screen al actualizar para ver resultados
    if (selectedStoryId) {
      const updatedCurrent = updatedStories.find(s => s.id === selectedStoryId);
      if (updatedCurrent) setEditedContent(updatedCurrent.content);
    }
  };

  const handleImageClick = (tag: string) => {
    setCurrentImageTag(tag);
    imageInputRef.current?.click();
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && currentImageTag) {
      setIsProcessing(true);
      await idmlEngine.updateImage(currentImageTag, file);
      setModifiedImages(prev => new Set(prev).add(currentImageTag));
      setIsProcessing(false);
      setCurrentImageTag(null);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  // Funciones auxiliares para imágenes independientes
  const getFileExtension = (filename: string): string => {
    const lastDot = filename.lastIndexOf('.');
    return lastDot > 0 ? filename.substring(lastDot) : '';
  };

  const sanitizeFileName = (name: string): string => {
    // Eliminar caracteres inválidos para nombres de archivo en Drive
    return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '').trim();
  };

  const tagToFileName = (tag: string): string => {
    const normalized = normalizeTag(tag);
    return sanitizeFileName(normalized);
  };

  const processImageFiles = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));

    // Contar cuántas veces aparece cada scriptLabel (normalizado) para agregar sufijos cuando hay duplicados
    const labelCounts = new Map<string, number>();
    imageFramesOrdered.forEach(frame => {
      const normalized = normalizeTag(frame.scriptLabel);
      if (normalized) {
        labelCounts.set(normalized, (labelCounts.get(normalized) || 0) + 1);
      }
    });

    // Rastrear cuántas veces hemos usado cada scriptLabel (normalizado)
    const labelUsage = new Map<string, number>();

    // Usar uploadedImages.length como offset para asignar etiquetas en orden secuencial
    const startIndex = uploadedImages.length;

    const newImages: UploadedImage[] = imageFiles.map((file, index) => {
      const id = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const preview = URL.createObjectURL(file);

      // Preasignar nombre basado en frame disponible (cada frame individual tiene su imagen)
      let customName: string;
      const frameIndex = startIndex + index;
      if (imageFramesOrdered.length > 0 && frameIndex < imageFramesOrdered.length) {
        // Hay frame disponible para esta imagen
        const frame = imageFramesOrdered[frameIndex];
        const normalizedLabel = normalizeTag(frame.scriptLabel);
        const baseName = tagToFileName(frame.scriptLabel);

        // Si hay múltiples frames con el mismo scriptLabel (normalizado), agregar sufijo numérico
        const count = labelCounts.get(normalizedLabel) || 1;
        if (count > 1) {
          const usage = (labelUsage.get(normalizedLabel) || 0) + 1;
          labelUsage.set(normalizedLabel, usage);
          customName = usage === 1 ? baseName : `${baseName}_${usage}`;
        } else {
          // Tags únicos (caso normal): usar directamente el scriptLabel del frame
          customName = baseName;
        }
      } else {
        // Más imágenes que frames o no hay frames, conservar nombre original
        const extension = getFileExtension(file.name);
        const baseName = file.name.replace(extension, '');
        customName = sanitizeFileName(baseName);
      }

      return {
        file,
        customName,
        id,
        preview
      };
    });

    setUploadedImages(prev => [...prev, ...newImages]);
  };

  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processImageFiles(e.dataTransfer.files);
    }
  };

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processImageFiles(e.target.files);
    }
    // Reset input para permitir seleccionar el mismo archivo nuevamente
    if (imagesInputRef.current) {
      imagesInputRef.current.value = '';
    }
  };

  const handleImageNameChange = (id: string, newName: string) => {
    const sanitized = sanitizeFileName(newName);
    setUploadedImages(prev =>
      prev.map(img => img.id === id ? { ...img, customName: sanitized } : img)
    );
  };

  const removeImage = (id: string) => {
    setUploadedImages(prev => {
      const image = prev.find(img => img.id === id);
      if (image?.preview) {
        URL.revokeObjectURL(image.preview);
      }
      return prev.filter(img => img.id !== id);
    });
  };

  // Reasignar etiquetas basándose en el nuevo orden de las imágenes
  const reassignImageTags = (reorderedImages: UploadedImage[]): UploadedImage[] => {
    // Contar cuántas veces aparece cada scriptLabel (normalizado) para agregar sufijos cuando hay duplicados
    const labelCounts = new Map<string, number>();
    imageFramesOrdered.forEach(frame => {
      const normalized = normalizeTag(frame.scriptLabel);
      if (normalized) {
        labelCounts.set(normalized, (labelCounts.get(normalized) || 0) + 1);
      }
    });

    // Rastrear cuántas veces hemos usado cada scriptLabel (normalizado)
    const labelUsage = new Map<string, number>();

    return reorderedImages.map((img, index) => {
      let customName: string;
      if (imageFramesOrdered.length > 0 && index < imageFramesOrdered.length) {
        // Hay frame disponible para esta imagen
        const frame = imageFramesOrdered[index];
        const normalizedLabel = normalizeTag(frame.scriptLabel);
        const baseName = tagToFileName(frame.scriptLabel);

        // Si hay múltiples frames con el mismo scriptLabel (normalizado), agregar sufijo numérico
        const count = labelCounts.get(normalizedLabel) || 1;
        if (count > 1) {
          const usage = (labelUsage.get(normalizedLabel) || 0) + 1;
          labelUsage.set(normalizedLabel, usage);
          customName = usage === 1 ? baseName : `${baseName}_${usage}`;
        } else {
          // Tags únicos (caso normal): usar directamente el scriptLabel del frame
          customName = baseName;
        }
      } else {
        // Más imágenes que frames o no hay frames, conservar nombre original
        const extension = getFileExtension(img.file.name);
        const baseName = img.file.name.replace(extension, '');
        customName = sanitizeFileName(baseName);
      }

      return {
        ...img,
        customName
      };
    });
  };

  // Reordenar imágenes mediante drag & drop
  const handleImageReorder = (draggedId: string, targetIndex: number) => {
    setUploadedImages(prev => {
      const currentIndex = prev.findIndex(img => img.id === draggedId);
      if (currentIndex === -1 || currentIndex === targetIndex) return prev;

      // Crear nuevo array reordenado
      const newImages = [...prev];
      const [draggedItem] = newImages.splice(currentIndex, 1);

      // Ajustar el índice de inserción: si movemos hacia abajo, debemos restar 1
      // porque el elemento ya fue eliminado del array
      const insertIndex = currentIndex < targetIndex ? targetIndex - 1 : targetIndex;
      newImages.splice(insertIndex, 0, draggedItem);

      // Reasignar etiquetas basándose en el nuevo orden
      return reassignImageTags(newImages);
    });
  };

  const uploadImagesToStorage = async (folderId: string): Promise<void> => {
    if (uploadedImages.length === 0) return;

    setUploadingImagesProgress({ current: 0, total: uploadedImages.length });

    // Inicializar estado de imágenes en el modal
    const imageItems: UploadProgressItem[] = uploadedImages.map(img => ({
      name: `${img.customName}.jpg`,
      status: 'uploading'
    }));
    setUploadProgress(prev => ({
      ...prev,
      images: imageItems
    }));

    const errors: string[] = [];

    for (let i = 0; i < uploadedImages.length; i++) {
      const img = uploadedImages[i];
      try {
        // Siempre usar extensión .jpg para garantizar coherencia con el IDML
        const fileName = `${img.customName}.jpg`;
        await uploadFile(img.file, fileName, folderId);
        setUploadingImagesProgress({ current: i + 1, total: uploadedImages.length });

        // Actualizar estado de éxito en el modal
        setUploadProgress(prev => ({
          ...prev,
          images: prev.images.map((item, idx) =>
            idx === i ? { ...item, status: 'success' as const } : item
          )
        }));
      } catch (error: any) {
        console.error(`Error subiendo imagen ${img.customName}:`, error);
        errors.push(`${img.customName}: ${error.message}`);

        // Actualizar estado de error en el modal
        setUploadProgress(prev => ({
          ...prev,
          images: prev.images.map((item, idx) =>
            idx === i ? { ...item, status: 'error' as const, error: error.message } : item
          )
        }));
      }
    }

    setUploadingImagesProgress(null);

    if (errors.length > 0) {
      throw new Error(`Errores al subir algunas imágenes:\n${errors.join('\n')}`);
    }
  };

  const filteredStories = stories.filter(s => {
    const matchesSearch = (s.scriptLabel?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (s.content.toLowerCase().includes(searchTerm.toLowerCase()));
    const isTagged = !!s.scriptLabel;
    return matchesSearch && (showUntagged || isTagged);
  });

  // Funciones de estilo de conteo de palabras eliminadas - ahora usamos WordCountIndicator

  return (
    <div className={`flex gap-4 relative ${isFullScreen ? 'h-screen' : 'h-[calc(100vh-140px)]'} overflow-hidden`}>

      {/* Aviso Flotante de Etiquetas Huérfanas */}
      {showOrphanAlert && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[80] w-[500px] animate-in slide-in-from-top duration-300">
          <div className="bg-orange-600 text-white p-4 rounded-2xl shadow-2xl flex items-start gap-4 border border-orange-400">
            <div className="bg-white/20 p-2 rounded-xl">
              <Ghost size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h4 className="text-[11px] font-black uppercase tracking-widest mb-1">Aviso de Etiquetas Huérfanas</h4>
              <p className="text-[10px] font-bold opacity-90 leading-tight uppercase">
                Detectamos {invalidTags.length} etiquetas que no existen en el IDML. Su contenido se ha movido automáticamente al bloque <span className="underline decoration-white/50 underline-offset-2">SOBRANTES</span>.
              </p>
            </div>
            <button onClick={() => setShowOrphanAlert(false)} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors">
              <XCircle size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Modal de Configuración IA */}
      {showAiSettings && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 overflow-hidden scale-in">
            <div className="bg-indigo-600 p-6 text-white flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Settings2 size={24} />
                <div>
                  <h2 className="text-lg font-black uppercase tracking-widest leading-none">Reglas Globales</h2>
                  <p className="text-[10px] opacity-70 mt-1 uppercase font-bold">Configura cómo trabaja el Asistente IA</p>
                </div>
              </div>
              <button onClick={() => setShowAiSettings(false)} className="hover:bg-white/20 p-2 rounded-full transition-colors">
                <XCircle size={20} />
              </button>
            </div>
            <div className="p-8 space-y-6">
              <div>
                <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2">Tono de Voz</label>
                <input type="text" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-sm font-medium" value={aiConfig.tone} onChange={(e) => setAiConfig(prev => ({ ...prev, tone: e.target.value }))} />
              </div>
              <div>
                <label className="block text-[10px] font-black text-indigo-700 uppercase tracking-widest mb-2">Glosario y Reglas</label>
                <textarea className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-indigo-500 outline-none text-sm h-32 resize-none" value={aiConfig.glossary} onChange={(e) => setAiConfig(prev => ({ ...prev, glossary: e.target.value }))} />
              </div>
              <button onClick={() => setShowAiSettings(false)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl hover:bg-indigo-700 transition-all">Guardar Configuración</button>
            </div>
          </div>
        </div>
      )}

      {/* Botón Flotante para expandir sidebar si está colapsada */}
      {isSidebarCollapsed && !isFullScreen && (
        <button
          onClick={() => setIsSidebarCollapsed(false)}
          className="absolute left-0 top-1/2 -translate-y-1/2 bg-white border border-gray-200 border-l-0 p-2 rounded-r-xl shadow-md z-40 hover:bg-indigo-50 text-indigo-600 transition-all"
          title="Expandir navegación"
        >
          <ChevronRight size={20} />
        </button>
      )}

      {/* Sidebar - Se oculta en full screen o si está colapsada */}
      {!isFullScreen && !isSidebarCollapsed && (
        <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden shrink-0 animate-in slide-in-from-left duration-300 relative">
          {/* Botón para colapsar */}
          <button
            onClick={() => setIsSidebarCollapsed(true)}
            className="absolute right-2 top-2 p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 transition-colors z-10"
            title="Colapsar panel"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="bg-gray-50 border-b">
            <div className="flex p-1">
              <button onClick={() => setSidebarTab('text')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${sidebarTab === 'text' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <Type size={14} /> Textos
              </button>
              <button onClick={() => setSidebarTab('images')} className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center justify-center gap-2 ${sidebarTab === 'images' ? 'bg-white shadow-sm text-indigo-700' : 'text-gray-400 hover:text-gray-600'}`}>
                <ImageIcon size={14} /> Imágenes
              </button>
            </div>
            <div className="px-3 pb-3 pt-2 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Filtrar..." className="w-full pl-9 pr-4 py-1.5 bg-white border border-gray-200 rounded-lg text-xs outline-none focus:border-indigo-500 transition-colors" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              {sidebarTab === 'text' && (
                <button onClick={() => setShowUntagged(!showUntagged)} className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg border text-[10px] font-bold transition-all ${showUntagged ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  <div className="flex items-center gap-2">{showUntagged ? <Eye size={12} /> : <EyeOff size={12} />} {showUntagged ? "MOSTRANDO SIN ETIQUETA" : "OCULTANDO SIN ETIQUETA"}</div>
                  <div className={`w-6 h-3 rounded-full relative transition-colors ${showUntagged ? 'bg-indigo-600' : 'bg-gray-200'}`}><div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${showUntagged ? 'right-0.5' : 'left-0.5'}`} /></div>
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 bg-gray-50/50">
            <input type="file" ref={imageInputRef} onChange={handleImageFileChange} className="hidden" accept="image/*,.pdf" />
            {sidebarTab === 'text' ? (
              <>
                {filteredStories.map(story => {
                  const currentWords = countWords(story.content);
                  const originalWords = story.initialWordCount || 0;
                  const normalizedStoryLabel = normalizeTag(story.scriptLabel);
                  const isMissingFromBatch = batchLog && story.scriptLabel && !lastBatchLabels.has(normalizedStoryLabel) && normalizedStoryLabel !== "SOBRANTES";
                  const statusColor = currentWords > originalWords ? 'text-red-600' : currentWords < originalWords ? 'text-amber-600' : 'text-green-600';

                  return (
                    <button
                      key={story.id}
                      onClick={() => { setSelectedStoryId(story.id); setEditedContent(story.content); setActiveTab('editor'); }}
                      className={`w-full text-left p-3 rounded-xl border transition-all relative group
                          ${selectedStoryId === story.id && activeTab === 'editor'
                          ? 'bg-white border-indigo-400 ring-2 ring-indigo-50 shadow-md translate-x-1'
                          : isMissingFromBatch
                            ? 'bg-red-50 border-red-300 shadow-sm'
                            : 'bg-white border-gray-100 hover:border-indigo-200 shadow-sm'
                        }`}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <div className="flex-1 min-w-0">
                          <span className={`inline-block text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border 
                                ${isMissingFromBatch
                              ? 'bg-red-600 text-white border-red-700'
                              : story.scriptLabel
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                                : 'bg-gray-100 text-gray-400 border-gray-200'
                            }`}>
                            {story.scriptLabel || "SIN ETIQUETA"}
                          </span>
                          <div className={`mt-1 flex items-center gap-2 text-[8px] font-bold ${statusColor}`}>
                            <span>{currentWords} / {originalWords} palabras</span>
                            {currentWords > originalWords && <AlertTriangle size={10} className="animate-pulse" />}
                          </div>
                          {isMissingFromBatch && (
                            <div className="mt-1 flex items-center gap-1 text-[7px] text-red-700 font-black uppercase tracking-wider bg-red-200/40 px-1.5 py-0.5 rounded inline-flex animate-pulse">
                              <FileX2 size={8} /> SIN CONTENIDO EN CARGA RÁPIDA
                            </div>
                          )}
                        </div>
                        {modifiedStories.has(story.id) && <CheckCircle size={12} className="text-green-600 shrink-0" />}
                        {isMissingFromBatch && !modifiedStories.has(story.id) && <AlertCircle size={12} className="text-red-600 shrink-0" />}
                      </div>
                    </button>
                  );
                })}

                {invalidTags.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 border-dashed">
                    <div className="px-2 mb-2 flex items-center gap-2 text-[10px] font-black text-orange-600 uppercase tracking-widest">
                      <Ghost size={14} className="animate-bounce" /> ETIQUETAS NO ENCONTRADAS EN IDML
                    </div>
                    {invalidTags.map(tag => (
                      <div key={tag} className="p-3 bg-orange-50 border-2 border-orange-200 border-dashed rounded-xl mb-1.5 transition-all hover:scale-[1.02]">
                        <span className="inline-block text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md bg-orange-600 text-white border-orange-600 shadow-lg">{tag}</span>
                        <p className="text-[9px] text-orange-700 font-black mt-2 uppercase italic leading-tight">ESTA ETIQUETA ESTÁ EN TU TEXTO PERO NO EN EL IDML.</p>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                {/* Área de drag & drop */}
                <div
                  onDrop={handleImageDrop}
                  onDragOver={handleImageDragOver}
                  onDragLeave={handleImageDragLeave}
                  onClick={() => imagesInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${isDragging
                    ? 'border-indigo-600 bg-indigo-50'
                    : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                    }`}
                >
                  <input
                    ref={imagesInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                  <ImageIcon size={32} className={`mx-auto mb-2 ${isDragging ? 'text-indigo-600' : 'text-gray-400'}`} />
                  <p className="text-xs font-semibold text-gray-700 mb-1">
                    Arrastra imágenes aquí o haz clic para seleccionar
                  </p>
                  <p className="text-[10px] text-gray-500">
                    Puedes seleccionar múltiples imágenes
                  </p>
                </div>

                {/* Lista de imágenes cargadas */}
                {uploadedImages.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-black text-indigo-700 uppercase tracking-widest px-2">
                      Imágenes cargadas ({uploadedImages.length})
                    </div>
                    {uploadedImages.map((img, index) => {
                      const extension = getFileExtension(img.file.name);
                      const isDragged = draggedImageId === img.id;
                      const isDragOver = dragOverIndex === index;
                      return (
                        <div
                          key={img.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedImageId(img.id);
                            e.dataTransfer.effectAllowed = 'move';
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverIndex(index);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            // Solo limpiar si realmente salimos del elemento (no solo de un hijo)
                            if (e.currentTarget === e.target) {
                              setDragOverIndex(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (draggedImageId && draggedImageId !== img.id) {
                              handleImageReorder(draggedImageId, index);
                            }
                            setDraggedImageId(null);
                            setDragOverIndex(null);
                          }}
                          onDragEnd={() => {
                            setDraggedImageId(null);
                            setDragOverIndex(null);
                          }}
                          className={`bg-white border rounded-lg p-3 flex items-start gap-3 transition-all cursor-move ${isDragged ? 'opacity-50 border-indigo-400' :
                            isDragOver ? 'border-indigo-500 border-2 shadow-md' :
                              'border-gray-200 hover:border-gray-300'
                            }`}
                        >
                          {/* Handle de arrastre */}
                          <div className="flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0 cursor-grab active:cursor-grabbing">
                            <GripVertical size={16} />
                          </div>

                          {/* Preview */}
                          {img.preview && (
                            <img
                              src={img.preview}
                              alt={img.customName}
                              className="w-16 h-16 object-cover rounded border border-gray-200 shrink-0"
                            />
                          )}

                          {/* Nombre editable */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <input
                                type="text"
                                value={img.customName}
                                onChange={(e) => handleImageNameChange(img.id, e.target.value)}
                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                placeholder="Nombre de la imagen"
                                onDragStart={(e) => e.stopPropagation()}
                              />
                              <span className="text-xs text-gray-500 font-medium shrink-0">
                                {extension}
                              </span>
                            </div>
                            <div className="text-[9px] text-gray-500">
                              {(img.file.size / 1024).toFixed(1)} KB
                            </div>
                          </div>

                          {/* Botón eliminar */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeImage(img.id);
                            }}
                            className="p-1 hover:bg-red-50 rounded transition-colors shrink-0"
                            title="Eliminar imagen"
                            onDragStart={(e) => e.stopPropagation()}
                          >
                            <XCircle size={16} className="text-red-500" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Area Central con Editor Resaltado Optimizado */}
      <div className={`flex-1 bg-white border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all duration-300
        ${isFullScreen ? 'fixed inset-0 z-[70] h-screen w-screen rounded-none' : 'rounded-xl'}
      `}>
        {/* Toolbar superior */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 shrink-0">
          {!isFullScreen ? (
            <>
              <button onClick={() => setActiveTab('batch')} className={`flex-1 py-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all border-b-2 ${activeTab === 'batch' ? 'bg-white border-indigo-600 text-indigo-700' : 'text-gray-400 border-transparent hover:text-gray-600'}`}><ClipboardList size={16} /> Carga Rápida (##)</button>
              <button onClick={() => setActiveTab('editor')} className={`flex-1 py-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all border-b-2 ${activeTab === 'editor' ? 'bg-white border-indigo-600 text-indigo-700' : 'text-gray-400 border-transparent hover:text-gray-600'}`}><Edit3 size={16} /> Editor Individual</button>
              <button onClick={() => setShowAiSettings(true)} className="px-6 border-l border-gray-200 hover:bg-white transition-all text-indigo-600 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"><Settings2 size={16} /> Reglas IA</button>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-between px-8 py-4">
              <div className="flex items-center gap-4">
                <div className="bg-indigo-600 text-white p-2 rounded-xl shadow-lg"><Zap size={18} /></div>
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-indigo-900">Modo Zen: Edición Masiva</h2>
                  <p className="text-[10px] font-bold text-indigo-600 uppercase opacity-70">Enfócate solo en el contenido</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleBatchInject} disabled={isProcessing || !batchText.trim()} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] tracking-widest hover:bg-indigo-700 shadow-lg flex items-center gap-2 uppercase transition-all">
                  {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle size={14} />} Inyectar y Salir
                </button>
                <button onClick={() => setIsFullScreen(false)} className="bg-white text-gray-700 px-6 py-2.5 rounded-xl font-black text-[10px] tracking-widest border border-gray-200 hover:bg-gray-50 shadow-sm flex items-center gap-2 uppercase transition-all">
                  <Minimize2 size={14} /> Salir del Modo Zen
                </button>
              </div>
            </div>
          )}
        </div>

        {activeTab === 'batch' ? (
          <div className="flex-1 flex flex-col bg-white overflow-hidden p-0 relative">
            {!isFullScreen && (
              <div className="bg-indigo-50/50 border-b border-indigo-100 px-6 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  {storiesWithOverflow.length > 0 && (
                    <button
                      onClick={handleAutoTrimAll}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium text-xs hover:bg-red-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Scissors size={14} /> Recortar {storiesWithOverflow.length} desbordamientos
                    </button>
                  )}
                  <button
                    onClick={() => setIsFullScreen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-xs hover:bg-gray-200 transition-colors"
                  >
                    <Maximize2 size={14} /> Pantalla Completa
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("¿Seguro que quieres borrar todo el texto de Carga Rápida?")) {
                        setBatchText("");
                      }
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-500 rounded-lg font-medium text-xs hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Reiniciar todo el texto"
                  >
                    <RefreshCw size={14} /> Reiniciar Texto
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {onResetTemplate && (
                    <button
                      onClick={onResetTemplate}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium text-xs hover:bg-gray-200 transition-colors"
                      title="Volver a seleccionar plantilla"
                    >
                      <ArrowLeft size={14} /> Cambiar Plantilla
                    </button>
                  )}
                  <button
                    onClick={() => setIsPreviewModalOpen(true)}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg font-semibold text-xs border border-indigo-200 hover:bg-indigo-50 transition-colors disabled:opacity-50"
                  >
                    <Eye size={14} /> Ver preview del resultado
                  </button>
                  <button
                    onClick={() => setShowLivePreview(!showLivePreview)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-xs border transition-all ${showLivePreview
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                      : 'bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-50'
                      }`}
                  >
                    {showLivePreview ? <EyeOff size={14} /> : <Sparkles size={14} />}
                    {showLivePreview ? 'Cerrar Live Preview' : 'Live Preview (Real-time)'}
                  </button>
                  <button
                    onClick={handleBatchInject}
                    disabled={isProcessing || !batchText.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium text-xs hover:bg-blue-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Wand2 size={14} />} Validar Documento
                  </button>
                  {storageManager.activeProvider.isAuthenticated() && (
                    <button
                      onClick={() => setShowDestinationSelector(true)}
                      disabled={isUploading}
                      className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium text-xs hover:bg-purple-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed relative"
                    >
                      <Cloud size={14} /> Enviar a {storageManager.activeProvider.name}
                      {uploadedImages.length > 0 && (
                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] font-medium rounded-full w-4 h-4 flex items-center justify-center">
                          {uploadedImages.length}
                        </span>
                      )}
                    </button>
                  )}
                  <button
                    onClick={async () => {
                      try {
                        setIsProcessing(true);

                        // Inyectar contenido del batchText en stories si existe
                        const storiesToUse = batchText.trim()
                          ? injectBatchContentIntoStories(batchText, stories)
                          : stories;

                        // Sincronizar imágenes del sidebar al motor IDML
                        if (uploadedImages.length > 0) {
                          const imageUpdates = uploadedImages.map(img => ({
                            tag: img.customName,
                            file: img.file
                          }));
                          await idmlEngine.bulkUpdateImages(imageUpdates);
                        }

                        // Configurar relinkeo automático relativo
                        const destFolderName = lastDestinationFolderPath?.split('/').pop() || undefined;
                        idmlEngine.setAutomaticRelink(useRelativeLinks, destFolderName);

                        // Generar blob con stories que tienen el contenido inyectado
                        const blob = await idmlEngine.generateBlob(storiesToUse);
                        const originalFileName = stories[0]?.name?.split('/').pop() || 'document.idml';
                        const baseFileName = originalFileName.replace(/\.xml$/i, '.idml');
                        const finalFileName = buildIdmlFileName({ folderPath: lastDestinationFolderPath, baseFileName });

                        // Descargar el archivo
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement("a");
                        link.href = url;
                        link.download = finalFileName;
                        link.style.display = "none";
                        document.body.appendChild(link);
                        link.click();

                        // Limpiar después de un breve delay
                        setTimeout(() => {
                          if (link.parentNode) {
                            link.parentNode.removeChild(link);
                          }
                          URL.revokeObjectURL(url);
                        }, 100);
                      } catch (error: any) {
                        console.error('Error al exportar IDML:', error);
                        alert(`Error al exportar IDML: ${error.message || 'Error desconocido'}`);
                      } finally {
                        setIsProcessing(false);
                      }
                    }}
                    disabled={isProcessing}
                    className="flex items-center gap-2 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-xs hover:bg-slate-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />} Exportar IDML
                  </button>
                </div>
              </div>
            )}

            {/* Configuración de Relinkeo Automático */}
            {!isFullScreen && (
              <div className="bg-white border-b border-gray-200 px-6 py-3 flex flex-col gap-2 shrink-0">
                <div className="flex items-center gap-2 text-[10px] font-black text-indigo-700 uppercase tracking-widest">
                  <ArrowRightLeft size={14} /> Gestión de Enlaces (Automático)
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={useRelativeLinks}
                        onChange={(e) => setUseRelativeLinks(e.target.checked)}
                      />
                      <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                    <span className="text-xs font-bold text-gray-700 select-none group-hover:text-indigo-600 transition-colors">
                      Parchado automático de rutas relativas
                    </span>
                  </label>
                  <span className="text-[10px] text-gray-400 font-medium italic">
                    (Recomendado: asegura que InDesign encuentre las fotos en la carpeta final)
                  </span>
                </div>
              </div>
            )}

            <div className={`flex-1 flex overflow-hidden ${showLivePreview ? 'flex-row' : 'flex-col'}`}>
              {/* Editor Column */}
              <div className={`${showLivePreview ? 'w-1/2 border-r border-gray-200' : 'w-full h-full'} flex flex-col overflow-hidden`}>
                <MonacoEditor
                  value={batchText}
                  onChange={setBatchText}
                  stories={stories}
                  availableTags={availableTags}
                  imageTags={imageTags}
                  placeholder="Escribe aquí usando ##ETIQUETA para cada sección..."
                  isFullScreen={isFullScreen}
                  className="flex-1"
                  inlineWordCounts={{
                    counts: batchWordCounts,
                    limits: batchLimits,
                  }}
                  onInject={handleBatchInject}
                />
              </div>

              {/* Preview Column (Live) */}
              {showLivePreview && (
                <div className="w-1/2 h-full bg-gray-100 overflow-hidden flex flex-col">
                  <TypstLivePreview
                    batchText={batchText}
                    stories={stories}
                    spreads={spreads}
                  />
                </div>
              )}
            </div>
          </div>
        ) : (
          selectedStory ? (
            <>
              <div className="p-4 border-b bg-white flex justify-between items-center shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-3"><div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><Tag size={18} /></div><div><h3 className="text-base font-bold text-gray-900">{selectedStory.scriptLabel || "Elemento"}</h3><div className="flex items-center gap-1.5 text-[10px] text-green-600 font-black uppercase mt-1"><RefreshCw size={10} className="animate-spin-slow" /> Sincronizado</div></div></div>
                <div className="flex items-center gap-4">
                  <WordCountIndicator
                    current={countWords(editedContent)}
                    original={selectedStory.initialWordCount || 0}
                    showPercentage={true}
                  />
                </div>
              </div>
              <textarea className="flex-1 p-12 text-xl text-gray-800 leading-relaxed outline-none resize-none font-serif bg-white" value={editedContent} onChange={handleEditorChange} />
              <div className="p-4 bg-indigo-50 border-t border-indigo-100 shrink-0"><div className="max-w-4xl mx-auto flex gap-3">
                <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} placeholder="Instrucciones IA..." className="flex-1 px-4 py-2.5 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 outline-none text-xs bg-white shadow-inner font-medium" />
                <button onClick={handleAiRewrite} disabled={isProcessing} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-indigo-700 shadow-md">{isProcessing ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} Asistente IA</button>
              </div></div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 p-12 text-center bg-gray-50/30 font-bold uppercase tracking-widest">Selecciona una historia del sidebar</div>
          )
        )}
      </div>

      {/* Modal de selección de destino */}
      {showDestinationSelector && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="w-full max-w-4xl">
            <DestinationFolderSelector
              destinationRootFolderId={(storageManager.activeProvider.id === 'nextcloud'
                ? (getAppConfig().nextcloud?.destinationRootPath || getAppConfig().nextcloud?.destinationRootFolderId)
                : getAppConfig().google?.destinationRootFolderId) || ''}
              onSelect={async (folderId, folderPath) => {
                setShowDestinationSelector(false);
                setIsUploading(true);
                setUploadSuccess(null);

                try {
                  // Inyectar contenido del batchText en stories si existe
                  const storiesToUse = batchText.trim()
                    ? injectBatchContentIntoStories(batchText, stories)
                    : stories;

                  // Guardar carpeta destino para futuros nombres
                  setLastDestinationFolderPath(folderPath || null);

                  // Preparar nombre del archivo IDML
                  const originalFileName = stories[0]?.name?.split('/').pop() || 'document.idml';
                  const baseFileName = originalFileName.replace(/\.xml$/i, '.idml');
                  const finalFileName = buildIdmlFileName({ folderPath, baseFileName });

                  // Inicializar modal de progreso con el nombre del archivo
                  setUploadProgress({
                    isVisible: true,
                    status: 'uploading',
                    idmlFile: { name: finalFileName, status: 'uploading' },
                    images: [],
                    folderPath: folderPath || null
                  });

                  // Sincronizar imágenes del sidebar al motor IDML
                  if (uploadedImages.length > 0) {
                    const imageUpdates = uploadedImages.map(img => ({
                      tag: img.customName,
                      file: img.file
                    }));
                    await idmlEngine.bulkUpdateImages(imageUpdates);
                  }

                  // Configurar relinkeo automático relativo
                  // Usamos "." porque las imágenes se suben a la misma carpeta que el IDML
                  idmlEngine.setAutomaticRelink(useRelativeLinks, ".");

                  // Generar blob con stories que tienen el contenido inyectado
                  const blob = await idmlEngine.generateBlob(storiesToUse);

                  await uploadFile(blob, finalFileName, folderId);

                  // Actualizar estado de éxito del IDML
                  setUploadProgress(prev => ({
                    ...prev,
                    idmlFile: prev.idmlFile ? { ...prev.idmlFile, status: 'success' } : null
                  }));

                  // Subir imágenes si hay alguna
                  if (uploadedImages.length > 0) {
                    try {
                      await uploadImagesToStorage(folderId);
                    } catch (imageError: any) {
                      console.error('Error subiendo imágenes:', imageError);
                      // El estado de error ya se actualizó en uploadImagesToStorage
                    }
                  }

                  // Actualizar estado final del modal después de todo
                  setUploadProgress(prev => {
                    const hasErrors = prev.images.some(img => img.status === 'error') ||
                      (prev.idmlFile?.status === 'error');
                    return {
                      ...prev,
                      status: hasErrors ? 'error' : 'success'
                    };
                  });

                  // Registrar log en Google Sheets (solo si estamos en modo Google y hay ID)
                  try {
                    const sheetsLogId = import.meta.env.VITE_GOOGLE_SHEETS_LOG_ID;
                    if (storageManager.activeProvider.id === 'google-drive' && sheetsLogId && sheetsLogId.trim() !== '') {
                      // Importación dinámica para evitar problemas de carga inicial
                      const sheetsApi = await import('../services/sheetsApi');

                      // Obtener usuario - intentar desde el estado primero
                      let user = googleAuth.getUser();
                      console.log('[Log] Usuario desde getUser():', user);

                      // Si no hay usuario, intentar obtenerlo directamente de la API
                      if (!user || !user.email) {
                        const accessToken = googleAuth.getAccessToken();
                        if (accessToken) {
                          try {
                            console.log('[Log] Obteniendo usuario desde API...');
                            const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
                              headers: {
                                'Authorization': `Bearer ${accessToken}`
                              }
                            });

                            if (userInfoResponse.ok) {
                              const userData = await userInfoResponse.json();
                              console.log('[Log] Datos del usuario desde API:', userData);
                              user = {
                                email: userData.email || '',
                                name: userData.name || '',
                                picture: userData.picture || ''
                              };
                            } else {
                              console.error('[Log] Error obteniendo usuario desde API:', userInfoResponse.status, userInfoResponse.statusText);
                            }
                          } catch (error) {
                            console.error('[Log] Error en fetch de userinfo:', error);
                          }
                        } else {
                          console.warn('[Log] No hay access token disponible');
                        }
                      }

                      const userEmail = user?.email || 'Usuario desconocido';
                      console.log('[Log] Email final a usar:', userEmail);

                      // Formatear fecha/hora en español
                      const now = new Date();
                      const fechaHora = now.toLocaleString('es-ES', {
                        dateStyle: 'long',
                        timeStyle: 'medium'
                      });

                      // Usar folderPath como carpeta de destino
                      const carpetaDestino = folderPath || 'Carpeta no especificada';
                      const nombrePlantilla = templateName || 'Carga manual';
                      const categoriaPlantilla = templateCategory || 'Sin categoría';

                      console.log('[Log] Intentando escribir log:', { fechaHora, userEmail, carpetaDestino, nombrePlantilla, categoriaPlantilla });

                      await sheetsApi.appendLogRow(sheetsLogId, [fechaHora, userEmail, categoriaPlantilla, nombrePlantilla, carpetaDestino]);

                      console.log('[Log] Log escrito exitosamente');
                    } else {
                      console.warn('[Log] VITE_GOOGLE_SHEETS_LOG_ID no está configurado o está vacío');
                    }
                  } catch (logError: any) {
                    // No interrumpir el flujo si falla el log, pero mostrar un mensaje útil
                    console.error('[Log] Error al registrar log en Google Sheets:', logError);
                    console.error('[Log] Detalles del error:', {
                      message: logError.message,
                      stack: logError.stack,
                      name: logError.name
                    });

                    // Si el error es sobre la API no habilitada, mostrar alerta al usuario
                    if (logError.message && (logError.message.includes('has not been used') || logError.message.includes('is disabled') || logError.message.includes('Enable it'))) {
                      alert('⚠️ La API de Google Sheets no está habilitada.\n\n' + logError.message.split('\n\n')[1] || logError.message);
                    }
                  }

                  // Limpiar imágenes después de subir exitosamente
                  uploadedImages.forEach(img => {
                    if (img.preview) {
                      URL.revokeObjectURL(img.preview);
                    }
                  });
                  setUploadedImages([]);
                } catch (error: any) {
                  console.error('Error al guardar en Drive:', error);

                  // Actualizar estado de error en el modal
                  setUploadProgress(prev => ({
                    ...prev,
                    status: 'error',
                    error: error.message,
                    idmlFile: prev.idmlFile ? { ...prev.idmlFile, status: 'error', error: error.message } : null
                  }));
                } finally {
                  setIsUploading(false);
                  setUploadingImagesProgress(null);
                }
              }}
              onCancel={() => setShowDestinationSelector(false)}
            />
          </div>
        </div>
      )}

      {/* Modal unificado de progreso de subida */}
      {uploadProgress.isVisible && (
        <div className="fixed inset-0 z-[120] bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className={`px-6 py-4 flex items-center justify-between ${uploadProgress.status === 'uploading' ? 'bg-indigo-600' :
              uploadProgress.status === 'success' ? 'bg-green-600' :
                'bg-red-600'
              } text-white`}>
              <div className="flex items-center gap-3">
                {uploadProgress.status === 'uploading' && <Loader2 className="animate-spin" size={24} />}
                {uploadProgress.status === 'success' && <CheckCircle size={24} />}
                {uploadProgress.status === 'error' && <AlertCircle size={24} />}
                <h2 className="text-xl font-bold">
                  {uploadProgress.status === 'uploading' && `Subiendo a ${storageManager.activeProvider.name}...`}
                  {uploadProgress.status === 'success' && 'Subida completada'}
                  {uploadProgress.status === 'error' && 'Error en la subida'}
                </h2>
              </div>
              <button
                onClick={() => setUploadProgress(prev => ({ ...prev, isVisible: false }))}
                className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                disabled={uploadProgress.status === 'uploading'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Contenido */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Información de carpeta destino */}
              {uploadProgress.folderPath && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="text-sm text-gray-600 mb-1">Carpeta de destino:</div>
                  <div className="font-medium text-gray-900">{uploadProgress.folderPath}</div>
                </div>
              )}

              {/* Progreso del archivo IDML */}
              {uploadProgress.idmlFile && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Type size={18} className="text-indigo-600" />
                    Archivo IDML
                  </h3>
                  <div className={`border rounded-lg p-4 flex items-center justify-between ${uploadProgress.idmlFile.status === 'uploading' ? 'border-indigo-300 bg-indigo-50' :
                    uploadProgress.idmlFile.status === 'success' ? 'border-green-300 bg-green-50' :
                      'border-red-300 bg-red-50'
                    }`}>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{uploadProgress.idmlFile.name}</div>
                      {uploadProgress.idmlFile.error && (
                        <div className="text-sm text-red-600 mt-1">{uploadProgress.idmlFile.error}</div>
                      )}
                    </div>
                    <div className="ml-4">
                      {uploadProgress.idmlFile.status === 'uploading' && (
                        <Loader2 className="animate-spin text-indigo-600" size={20} />
                      )}
                      {uploadProgress.idmlFile.status === 'success' && (
                        <CheckCircle className="text-green-600" size={20} />
                      )}
                      {uploadProgress.idmlFile.status === 'error' && (
                        <XCircle className="text-red-600" size={20} />
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Progreso de imágenes */}
              {uploadProgress.images.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <ImageIcon size={18} className="text-indigo-600" />
                    Imágenes ({uploadProgress.images.filter(img => img.status === 'success').length} / {uploadProgress.images.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {uploadProgress.images.map((img, idx) => (
                      <div
                        key={idx}
                        className={`border rounded-lg p-3 flex items-center justify-between ${img.status === 'uploading' ? 'border-indigo-300 bg-indigo-50' :
                          img.status === 'success' ? 'border-green-300 bg-green-50' :
                            'border-red-300 bg-red-50'
                          }`}
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">{img.name}</div>
                          {img.error && (
                            <div className="text-sm text-red-600 mt-1">{img.error}</div>
                          )}
                        </div>
                        <div className="ml-4 shrink-0">
                          {img.status === 'uploading' && (
                            <Loader2 className="animate-spin text-indigo-600" size={18} />
                          )}
                          {img.status === 'success' && (
                            <CheckCircle className="text-green-600" size={18} />
                          )}
                          {img.status === 'error' && (
                            <XCircle className="text-red-600" size={18} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Mensaje de error general */}
              {uploadProgress.status === 'error' && uploadProgress.error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="text-sm font-medium text-red-900 mb-1">Error:</div>
                  <div className="text-sm text-red-700">{uploadProgress.error}</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-gray-50 border-t flex justify-end">
              <button
                onClick={() => setUploadProgress(prev => ({ ...prev, isVisible: false }))}
                disabled={uploadProgress.status === 'uploading'}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${uploadProgress.status === 'uploading'
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                  }`}
              >
                {uploadProgress.status === 'uploading' ? 'Subiendo...' : 'Cerrar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse-subtle { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.02); } }
        .animate-pulse-subtle { animation: pulse-subtle 2s ease-in-out infinite; }
        .animate-spin-slow { animation: spin 3s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        textarea::-webkit-scrollbar { width: 8px; }
        textarea::-webkit-scrollbar-track { background: transparent; }
        textarea::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 4px; }
        .scale-in { animation: scaleIn 0.2s ease-out; }
        @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
      <PreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        stories={batchText.trim() ? injectBatchContentIntoStories(batchText, stories) : stories}
        spreads={spreads}
        imagesFolderId={imagesFolderId}
        uploadedImages={uploadedImages}
      />
    </div>
  );
};

export default StoryMapper;

// Componente interno para la previsualización en vivo (Optimizado con Memo)
const TypstLivePreview: React.FC<{ batchText: string, stories: IDMLStory[], spreads: IDMLSpread[] }> = React.memo(({ batchText, stories, spreads }) => {

  // Función que genera el código Typst a demanda (dentro del hook)
  const generateCode = useCallback(() => {
    try {
      // Simular la inyección para el previo
      const storiesWithContent = injectBatchContentIntoStories(batchText, stories);

      // Necesitamos los otros parámetros (styles, swatches, pageSettings)
      return typstGenerator.generate(
        storiesWithContent,
        spreads,
        idmlEngine.styles,
        idmlEngine.swatches,
        idmlEngine.pageSettings,
        { debugOverflow: true, debugUnderflow: false, includeImages: false }
      );
    } catch (err) {
      console.error("Error generating typst code for preview:", err);
      return "";
    }
  }, [batchText, stories, spreads]);

  // Usar el hook pasándole la función de generación y las dependencias
  const { svg, isLoading, error } = useTypstLive(generateCode, [batchText, stories, spreads]);
  const [zoom, setZoom] = useState(1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!scrollContainerRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollContainerRef.current.offsetLeft);
    setStartY(e.pageY - scrollContainerRef.current.offsetTop);
    setScrollLeft(scrollContainerRef.current.scrollLeft);
    setScrollTop(scrollContainerRef.current.scrollTop);
  };

  const onMouseUp = () => setIsDragging(false);
  const onMouseLeave = () => setIsDragging(false);

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollContainerRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollContainerRef.current.offsetLeft;
    const y = e.pageY - scrollContainerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    scrollContainerRef.current.scrollLeft = scrollLeft - walkX;
    scrollContainerRef.current.scrollTop = scrollTop - walkY;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-200 p-4">
      <div
        ref={scrollContainerRef}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
        onMouseMove={onMouseMove}
        className={`bg-white rounded-xl shadow-inner flex-1 overflow-auto relative ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      >
        <div
          className="p-16 flex items-start justify-center"
          style={{
            width: 'max-content',
            minWidth: '100%',
            height: 'max-content',
            minHeight: '100%',
          }}
        >
          {isLoading && (
            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] z-10 flex items-center justify-center">
              <Loader2 className="animate-spin text-indigo-600" size={32} />
            </div>
          )}

          {error ? (
            <div className="p-8 text-center">
              <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
              <p className="text-xs font-bold text-red-600 uppercase">Error de Renderizado</p>
              <p className="text-[10px] text-gray-500 mt-1">{error}</p>
            </div>
          ) : svg ? (
            <div
              className="shadow-2xl bg-white transition-transform duration-200"
              style={{
                width: 'fit-content',
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                marginBottom: zoom > 1 ? `${(zoom - 1) * 100}%` : 0,
                marginRight: zoom > 1 ? `${(zoom - 1) * 50}%` : 0,
                marginLeft: zoom > 1 ? `${(zoom - 1) * 50}%` : 0,
              }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          ) : (
            <div className="text-gray-400 text-xs font-medium uppercase tracking-widest animate-pulse">
              Esperando cambios...
            </div>
          )}
        </div>
      </div>

      <div className="mt-2 flex justify-between items-center px-1">
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">
            Typst WASM v0.11.0
          </span>
          <div className="flex items-center gap-2 bg-white/50 px-2 py-0.5 rounded-full border border-gray-300">
            <span className="text-[9px] font-bold text-gray-500 uppercase">Zoom: {Math.round(zoom * 100)}%</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={zoom}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="w-20 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-indigo-600"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-amber-400 animate-pulse' : 'bg-green-400'}`} />
        </div>
      </div>
    </div>
  );

  // Función auxiliar para inyectar contenido (duplicada aquí por simplicidad o movida a utils)
  function injectBatchContentIntoStories(batchTextInput: string, currentStories: IDMLStory[]): IDMLStory[] {
    if (!batchTextInput.trim()) return currentStories;
    const parsedUpdates = parseBatchText(batchTextInput);
    return currentStories.map((story) => {
      const storyLabel = normalizeTag(story.scriptLabel);
      if (storyLabel) {
        const newContent = parsedUpdates[storyLabel];
        if (newContent !== undefined) {
          return { ...story, content: newContent, isModified: true };
        }
      }
      return story;
    });
  }
});
