/**
 * Versión refactorizada de StoryMapper usando SimpleEditor
 * 
 * Esta es una versión mejorada que:
 * - Elimina la dependencia de CodeMirror
 * - Usa SimpleEditor para mejor UX
 * - Simplifica la lógica de autocompletado
 * - Mejora el feedback visual
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { IDMLStory, IDMLSpread } from '../../types';
import { idmlEngine } from '../../services/idmlEngine';
import { rewriteContent, smartTrim, AiConfig } from '../../services/gemini';
import { uploadFile } from '../../services/driveApi';
import { getDriveConfig } from '../../services/driveService';
import { googleAuth } from '../../services/googleAuth';
import DestinationFolderSelector from '../../components/DestinationFolderSelector';
import { SimpleEditor } from './SimpleEditor';
import { WordCountIndicator } from './WordCountIndicator';
import { normalizeTag, parseBatchText } from '../utils/tagUtils';
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
  XCircle,
  Image as ImageIcon,
  Type,
  Eye,
  EyeOff,
  Settings2,
  Scissors,
  Wand2,
  Ghost,
  FileX2,
  Maximize2,
  Minimize2,
  Cloud
} from 'lucide-react';

interface Props {
  stories: IDMLStory[];
  setStories: React.Dispatch<React.SetStateAction<IDMLStory[]>>;
  spreads: IDMLSpread[];
}

const StoryMapperRefactored: React.FC<Props> = ({ stories, setStories, spreads }) => {
  // Estados principales
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [modifiedStories, setModifiedStories] = useState<Set<string>>(new Set());
  const [modifiedImages, setModifiedImages] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [showUntagged, setShowUntagged] = useState(false);
  const [activeTab, setActiveTab] = useState<'editor' | 'batch'>('batch');
  const [sidebarTab, setSidebarTab] = useState<'text' | 'images'>('text');
  const [batchText, setBatchText] = useState("");
  const [batchLog, setBatchLog] = useState<{success: number, total: number, sobrantes: number} | null>(null);
  const [invalidTags, setInvalidTags] = useState<string[]>([]);
  const [showOrphanAlert, setShowOrphanAlert] = useState(false);
  const [lastBatchLabels, setLastBatchLabels] = useState<Set<string>>(new Set());
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showDestinationSelector, setShowDestinationSelector] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiConfig, setAiConfig] = useState<AiConfig>({
    tone: "Profesional, conciso y directo",
    glossary: ""
  });

  const imageInputRef = useRef<HTMLInputElement>(null);
  const [currentImageTag, setCurrentImageTag] = useState<string | null>(null);

  // Estados para imágenes
  interface UploadedImage {
    file: File;
    customName: string;
    id: string;
    preview?: string;
  }
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadingImagesProgress, setUploadingImagesProgress] = useState<{current: number, total: number} | null>(null);
  const imagesInputRef = useRef<HTMLInputElement>(null);

  // Utilidades
  const countWords = (text: string) => text.trim().split(/\s+/).filter(w => w.length > 0).length;

  // Etiquetas disponibles
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
  }, [stories]);

  const imageFramesByTag = useMemo(() => {
    const map = new Map<string, any[]>();
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

  const selectedStory = useMemo(() => 
    stories.find(s => s.id === selectedStoryId),
    [stories, selectedStoryId]
  );

  const storiesWithOverflow = useMemo(() => 
    stories.filter(s => countWords(s.content) > (s.initialWordCount || 0)),
    [stories]
  );

  // Inicializar story seleccionada
  useEffect(() => {
    if (stories.length > 0 && !selectedStoryId) {
      setSelectedStoryId(stories[0].id);
      setEditedContent(stories[0].content);
    }
  }, [stories]);

  // Funciones de inyección de batch
  const injectBatchContentIntoStories = (batchTextInput: string, currentStories: IDMLStory[]): IDMLStory[] => {
    if (!batchTextInput.trim()) return currentStories;

    const parsedUpdates = parseBatchText(batchTextInput);
    const availableLabels = new Set(currentStories.map(s => normalizeTag(s.scriptLabel)).filter(Boolean));
    const detectedLabels = Object.keys(parsedUpdates);
    const orphans = detectedLabels.filter(label => !availableLabels.has(label) && label !== "SOBRANTES");
    
    let sobrantesAccumulated = parsedUpdates["SOBRANTES"] ? `##SOBRANTES\n${parsedUpdates["SOBRANTES"]}` : "";
    
    orphans.forEach(tag => {
      const contentToAdd = parsedUpdates[tag];
      sobrantesAccumulated += (sobrantesAccumulated ? "\n\n" : "") + `##${tag}\n${contentToAdd}`;
    });

    const updatedStories = currentStories.map((story) => {
      const storyLabel = normalizeTag(story.scriptLabel);
      if (storyLabel === "SOBRANTES" && sobrantesAccumulated) {
        return { ...story, content: sobrantesAccumulated };
      }
      if (storyLabel && parsedUpdates[storyLabel]) {
        return { ...story, content: parsedUpdates[storyLabel] };
      }
      return story;
    });

    return updatedStories;
  };

  // Handlers
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
      if (storyLabel === "SOBRANTES" && sobrantesAccumulated) {
        newModifiedIds.add(story.id);
        return { ...story, content: sobrantesAccumulated, isModified: true };
      }
      if (storyLabel && parsedUpdates[storyLabel]) {
        newModifiedIds.add(story.id);
        matchCount++;
        return { ...story, content: parsedUpdates[storyLabel], isModified: true };
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
    setIsFullScreen(false);
    if (selectedStoryId) {
      const updatedCurrent = updatedStories.find(s => s.id === selectedStoryId);
      if (updatedCurrent) setEditedContent(updatedCurrent.content);
    }
  };

  const filteredStories = stories.filter(s => {
    const matchesSearch = (s.scriptLabel?.toLowerCase().includes(searchTerm.toLowerCase())) || 
                          (s.content.toLowerCase().includes(searchTerm.toLowerCase()));
    const isTagged = !!s.scriptLabel;
    return matchesSearch && (showUntagged || isTagged);
  });

  // TODO: Continuar con el resto del componente...
  // Por ahora, este es un esqueleto que muestra la estructura

  return (
    <div className={`flex gap-4 relative ${isFullScreen ? 'h-screen' : 'h-[calc(100vh-140px)]'} overflow-hidden`}>
      {/* Sidebar */}
      {!isFullScreen && (
        <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden shrink-0">
          {/* Contenido del sidebar */}
          <div className="p-4">
            <p className="text-sm text-gray-600">Sidebar refactorizado - En construcción</p>
          </div>
        </div>
      )}

      {/* Editor principal */}
      <div className={`flex-1 bg-white border border-gray-200 shadow-sm flex flex-col overflow-hidden transition-all duration-300
        ${isFullScreen ? 'fixed inset-0 z-[70] h-screen w-screen rounded-none' : 'rounded-xl'}
      `}>
        {/* Toolbar */}
        <div className="flex border-b border-gray-200 bg-gray-50/50 shrink-0">
          <button 
            onClick={() => setActiveTab('batch')} 
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'batch' ? 'bg-white border-indigo-600 text-indigo-700' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <ClipboardList size={16} /> Carga Rápida (##)
          </button>
          <button 
            onClick={() => setActiveTab('editor')} 
            className={`flex-1 py-4 flex items-center justify-center gap-2 font-black text-xs uppercase tracking-widest transition-all border-b-2 ${
              activeTab === 'editor' ? 'bg-white border-indigo-600 text-indigo-700' : 'text-gray-400 border-transparent hover:text-gray-600'
            }`}
          >
            <Edit3 size={16} /> Editor Individual
          </button>
        </div>

        {/* Contenido del editor */}
        {activeTab === 'batch' ? (
          <div className="flex-1 flex flex-col bg-white overflow-hidden relative">
            <SimpleEditor
              value={batchText}
              onChange={setBatchText}
              availableTags={availableTags}
              imageTags={imageTags}
              placeholder="Escribe aquí usando ##ETIQUETA para cada sección..."
              isFullScreen={isFullScreen}
              className="flex-1"
            />
          </div>
        ) : (
          selectedStory ? (
            <div className="flex-1 flex flex-col">
              <div className="p-4 border-b bg-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg">
                    <Tag size={18}/>
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-gray-900">{selectedStory.scriptLabel || "Elemento"}</h3>
                  </div>
                </div>
                <WordCountIndicator
                  current={countWords(editedContent)}
                  original={selectedStory.initialWordCount || 0}
                />
              </div>
              <textarea
                className="flex-1 p-12 text-xl text-gray-800 leading-relaxed outline-none resize-none font-serif bg-white"
                value={editedContent}
                onChange={handleEditorChange}
              />
              <div className="p-4 bg-indigo-50 border-t border-indigo-100 shrink-0">
                <div className="max-w-4xl mx-auto flex gap-3">
                  <input
                    type="text"
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="Instrucciones IA..."
                    className="flex-1 px-4 py-2.5 rounded-xl border-2 border-indigo-100 focus:border-indigo-500 outline-none text-xs bg-white shadow-inner font-medium"
                  />
                  <button
                    onClick={handleAiRewrite}
                    disabled={isProcessing}
                    className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-xs flex items-center gap-2 hover:bg-indigo-700 shadow-md"
                  >
                    {isProcessing ? <Loader2 className="animate-spin" size={16}/> : <Sparkles size={16}/>} Asistente IA
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400 p-12 text-center bg-gray-50/30 font-bold uppercase tracking-widest">
              Selecciona una historia del sidebar
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default StoryMapperRefactored;
