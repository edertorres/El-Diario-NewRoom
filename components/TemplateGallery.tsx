import React, { useState, useEffect } from 'react';
import { Template, DriveFolder, IDMLStory, IDMLSpread } from '../types';
import { listFolders, listTemplatesInFolder, getTemplatePreview, downloadFile, validateFolderAccess } from '../services/driveApi';
import { idmlEngine } from '../services/idmlEngine';
import { storageManager } from '../services/storage/StorageManager';
import { Loader2, Search, Folder, Image, X, AlertCircle, ZoomIn } from 'lucide-react';

interface Props {
  templatesFolderId: string;
  onTemplateSelect: (stories: IDMLStory[], spreads: IDMLSpread[], templateName: string, categoryName: string, folderId?: string) => void;
  onCancel: () => void;
}

const TemplateGallery: React.FC<Props> = ({ templatesFolderId, onTemplateSelect, onCancel }) => {
  const [categories, setCategories] = useState<DriveFolder[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [zoomedTemplate, setZoomedTemplate] = useState<Template | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadTemplates(selectedCategory);
    } else {
      setTemplates([]);
    }
  }, [selectedCategory]);

  // Cargar previews automáticamente cuando se cargan los templates
  useEffect(() => {
    if (templates.length > 0) {
      templates.forEach(template => {
        if (!template.previewUrl && template.previewFileId && template.previewType) {
          // Cargar preview de forma asíncrona
          getTemplatePreview(template.previewFileId, template.previewType)
            .then(previewUrl => {
              setTemplates(prev => prev.map(t =>
                t.id === template.id ? { ...t, previewUrl } : t
              ));
            })
            .catch(err => {
              console.error('Error cargando preview:', err);
            });
        }
      });
    }
  }, [templates]);

  const loadCategories = async () => {
    setLoadingCategories(true);
    setError(null);
    try {
      const result = await validateFolderAccess(templatesFolderId);
      if (!result.success) {
        const providerName = storageManager.activeProvider.name;
        const envVar = storageManager.activeProvider.id === 'google-drive'
          ? 'VITE_DRIVE_TEMPLATES_FOLDER_ID'
          : 'VITE_NEXTCLOUD_TEMPLATES_PATH';
        setError(`Error en ${providerName}: ${result.error || 'Acceso denegado'}. Verifica la configuración en el archivo .env (${envVar})`);
        setLoadingCategories(false);
        return;
      }

      const folders = await listFolders(templatesFolderId);
      setCategories(folders);
      if (folders.length > 0) {
        setSelectedCategory(folders[0].id);
      }
    } catch (err: any) {
      console.error('Error cargando categorías:', err);
      setError(`Error al cargar categorías: ${err.message}`);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadTemplates = async (categoryId: string) => {
    setLoadingTemplates(true);
    setError(null);
    try {
      const categoryTemplates = await listTemplatesInFolder(categoryId);
      // Agregar categoría a cada template
      const categoryName = categories.find(c => c.id === categoryId)?.name || 'Sin categoría';
      const templatesWithCategory = categoryTemplates.map(t => ({
        ...t,
        category: categoryName,
      }));
      setTemplates(templatesWithCategory);
    } catch (err: any) {
      console.error('Error cargando plantillas:', err);
      setError(`Error al cargar plantillas: ${err.message}`);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const loadPreview = async (template: Template) => {
    if (template.previewUrl || !template.previewFileId || !template.previewType) return;

    try {
      const previewUrl = await getTemplatePreview(template.previewFileId, template.previewType);
      setTemplates(prev => prev.map(t =>
        t.id === template.id ? { ...t, previewUrl } : t
      ));
    } catch (err) {
      console.error('Error cargando preview:', err);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    setLoadingTemplate(template.id);
    setError(null);
    try {
      const blob = await downloadFile(template.idmlFileId);
      const file = new File([blob], `${template.name}.idml`, { type: 'application/vnd.adobe.indesign-idml-package' });
      const result = await idmlEngine.loadFile(file);
      const categoryName = categories.find(c => c.id === (selectedCategory || ''))?.name || 'Sin categoría';
      onTemplateSelect(result.stories, result.spreads, template.name, categoryName, selectedCategory || undefined);
    } catch (err: any) {
      console.error('Error cargando plantilla:', err);
      setError(`Error al cargar plantilla: ${err.message}`);
      setLoadingTemplate(null);
    }
  };

  const handleZoomClick = (e: React.MouseEvent, template: Template) => {
    e.stopPropagation(); // Prevenir que se seleccione la plantilla
    if (template.previewUrl) {
      setZoomedTemplate(template);
    }
  };

  const filteredTemplates = templates.filter(template =>
    template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Función para obtener color de categoría
  const getCategoryColor = (categoryName: string, isSelected: boolean) => {
    const colors = [
      { bg: 'bg-indigo-600', hover: 'hover:bg-indigo-700', text: 'text-white', unselected: 'bg-indigo-100 text-indigo-700' },
      { bg: 'bg-purple-600', hover: 'hover:bg-purple-700', text: 'text-white', unselected: 'bg-purple-100 text-purple-700' },
      { bg: 'bg-pink-600', hover: 'hover:bg-pink-700', text: 'text-white', unselected: 'bg-pink-100 text-pink-700' },
      { bg: 'bg-red-600', hover: 'hover:bg-red-700', text: 'text-white', unselected: 'bg-red-100 text-red-700' },
      { bg: 'bg-orange-600', hover: 'hover:bg-orange-700', text: 'text-white', unselected: 'bg-orange-100 text-orange-700' },
      { bg: 'bg-amber-600', hover: 'hover:bg-amber-700', text: 'text-white', unselected: 'bg-amber-100 text-amber-700' },
      { bg: 'bg-yellow-600', hover: 'hover:bg-yellow-700', text: 'text-white', unselected: 'bg-yellow-100 text-yellow-700' },
      { bg: 'bg-lime-600', hover: 'hover:bg-lime-700', text: 'text-white', unselected: 'bg-lime-100 text-lime-700' },
      { bg: 'bg-green-600', hover: 'hover:bg-green-700', text: 'text-white', unselected: 'bg-green-100 text-green-700' },
      { bg: 'bg-emerald-600', hover: 'hover:bg-emerald-700', text: 'text-white', unselected: 'bg-emerald-100 text-emerald-700' },
      { bg: 'bg-teal-600', hover: 'hover:bg-teal-700', text: 'text-white', unselected: 'bg-teal-100 text-teal-700' },
      { bg: 'bg-cyan-600', hover: 'hover:bg-cyan-700', text: 'text-white', unselected: 'bg-cyan-100 text-cyan-700' },
      { bg: 'bg-sky-600', hover: 'hover:bg-sky-700', text: 'text-white', unselected: 'bg-sky-100 text-sky-700' },
      { bg: 'bg-blue-600', hover: 'hover:bg-blue-700', text: 'text-white', unselected: 'bg-blue-100 text-blue-700' },
    ];

    // Usar hash del nombre para asignar color de forma consistente
    let hash = 0;
    for (let i = 0; i < categoryName.length; i++) {
      hash = categoryName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    const color = colors[colorIndex];

    return isSelected
      ? `${color.bg} ${color.text}`
      : `${color.unselected} ${color.hover}`;
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Plantillas de {storageManager.activeProvider.name}</h2>
          <button
            onClick={onCancel}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
            <AlertCircle size={20} />
            <span>{error}</span>
          </div>
        )}

        {loadingCategories ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="animate-spin text-indigo-600" size={32} />
          </div>
        ) : (
          <>
            {/* Selector de categorías */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <Folder size={18} className="text-indigo-600" />
                <h3 className="font-semibold text-gray-700">Categorías</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <button
                    key={category.id}
                    onClick={() => setSelectedCategory(category.id)}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${getCategoryColor(category.name, selectedCategory === category.id)}`}
                  >
                    {category.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Buscador */}
            {selectedCategory && (
              <div className="mb-6">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Buscar plantillas..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Lista de plantillas */}
            {selectedCategory && (
              <>
                {loadingTemplates ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-indigo-600" size={32} />
                  </div>
                ) : filteredTemplates.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">
                    {searchTerm ? 'No se encontraron plantillas que coincidan con la búsqueda' : 'No hay plantillas en esta categoría'}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredTemplates.map(template => (
                      <div
                        key={template.id}
                        className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer"
                        onClick={() => handleTemplateSelect(template)}
                      >
                        <div className="h-64 bg-gray-100 relative flex items-center justify-center group">
                          {loadingTemplate === template.id ? (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                              <Loader2 className="animate-spin text-indigo-600" size={32} />
                            </div>
                          ) : template.previewUrl ? (
                            <>
                              <img
                                src={template.previewUrl}
                                alt={template.name}
                                className="max-w-full max-h-full object-contain"
                              />
                              <button
                                onClick={(e) => handleZoomClick(e, template)}
                                className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                title="Ver a tamaño real"
                              >
                                <ZoomIn size={20} className="text-indigo-600" />
                              </button>
                            </>
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <Image size={48} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="p-4">
                          <h4 className="font-semibold text-gray-900 mb-1">{template.name}</h4>
                          <p className="text-sm text-gray-500">{template.category}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Modal de zoom para previsualización a tamaño real */}
      {zoomedTemplate && zoomedTemplate.previewUrl && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setZoomedTemplate(null)}
        >
          <div className="relative max-w-[95vw] max-h-[95vh] bg-white rounded-lg overflow-hidden">
            <button
              onClick={() => setZoomedTemplate(null)}
              className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-lg shadow-md z-10"
              title="Cerrar"
            >
              <X size={24} className="text-gray-700" />
            </button>
            <div className="p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{zoomedTemplate.name}</h3>
              <p className="text-sm text-gray-500 mb-4">{zoomedTemplate.category}</p>
            </div>
            <div className="overflow-auto max-h-[calc(95vh-100px)] bg-gray-100 flex items-center justify-center p-4">
              <img
                src={zoomedTemplate.previewUrl}
                alt={zoomedTemplate.name}
                className="max-w-full max-h-full object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TemplateGallery;
