import React, { useState, useEffect } from 'react';
import { DriveFolder } from '../types';
import { listDestinationFolders, listPageFolders, getFolderInfo } from '../services/driveApi';
import { storageManager } from '../services/storage/StorageManager';
import { Loader2, Folder, AlertCircle } from 'lucide-react';

interface Props {
  destinationRootFolderId: string;
  onSelect: (folderId: string, folderPath: string) => void;
  onCancel: () => void;
}

const DestinationFolderSelector: React.FC<Props> = ({ destinationRootFolderId, onSelect, onCancel }) => {
  const [edicionFolders, setEdicionFolders] = useState<DriveFolder[]>([]);
  const [selectedEdicion, setSelectedEdicion] = useState<string>('');
  const [pageFolders, setPageFolders] = useState<DriveFolder[]>([]);
  const [selectedPage, setSelectedPage] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadingPages, setLoadingPages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEdicionFolders();
  }, []);

  useEffect(() => {
    if (selectedEdicion) {
      loadPageFolders(selectedEdicion);
      setSelectedPage(''); // Reset página cuando cambia edición
    } else {
      setPageFolders([]);
      setSelectedPage('');
    }
  }, [selectedEdicion]);

  const loadEdicionFolders = async () => {
    setLoading(true);
    setError(null);
    try {
      const folders = await listDestinationFolders(destinationRootFolderId);
      setEdicionFolders(folders);
    } catch (err: any) {
      console.error('Error cargando carpetas de edición:', err);
      setError(`Error al cargar carpetas: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const loadPageFolders = async (edicionId: string) => {
    setLoadingPages(true);
    setError(null);
    try {
      const folders = await listPageFolders(edicionId);
      setPageFolders(folders);
    } catch (err: any) {
      console.error('Error cargando carpetas de página:', err);
      setError(`Error al cargar carpetas de página: ${err.message}`);
    } finally {
      setLoadingPages(false);
    }
  };

  const handleSelect = () => {
    if (selectedPage) {
      const edicionName = edicionFolders.find(f => f.id === selectedEdicion)?.name || '';
      const pageName = pageFolders.find(f => f.id === selectedPage)?.name || '';
      const folderPath = `${edicionName} > ${pageName}`;
      onSelect(selectedPage, folderPath);
    } else if (selectedEdicion) {
      const edicionName = edicionFolders.find(f => f.id === selectedEdicion)?.name || '';
      onSelect(selectedEdicion, edicionName);
    }
  };

  // Función para obtener color sutil basado en el nombre
  const getSubtleColor = (name: string) => {
    const colors = [
      { bg: 'bg-indigo-50', border: 'border-indigo-200', icon: 'text-indigo-500' },
      { bg: 'bg-purple-50', border: 'border-purple-200', icon: 'text-purple-500' },
      { bg: 'bg-pink-50', border: 'border-pink-200', icon: 'text-pink-500' },
      { bg: 'bg-rose-50', border: 'border-rose-200', icon: 'text-rose-500' },
      { bg: 'bg-orange-50', border: 'border-orange-200', icon: 'text-orange-500' },
      { bg: 'bg-amber-50', border: 'border-amber-200', icon: 'text-amber-500' },
      { bg: 'bg-yellow-50', border: 'border-yellow-200', icon: 'text-yellow-500' },
      { bg: 'bg-lime-50', border: 'border-lime-200', icon: 'text-lime-500' },
      { bg: 'bg-green-50', border: 'border-green-200', icon: 'text-green-500' },
      { bg: 'bg-emerald-50', border: 'border-emerald-200', icon: 'text-emerald-500' },
      { bg: 'bg-teal-50', border: 'border-teal-200', icon: 'text-teal-500' },
      { bg: 'bg-cyan-50', border: 'border-cyan-200', icon: 'text-cyan-500' },
      { bg: 'bg-sky-50', border: 'border-sky-200', icon: 'text-sky-500' },
      { bg: 'bg-blue-50', border: 'border-blue-200', icon: 'text-blue-500' },
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-indigo-600" size={32} />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6 max-w-2xl">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Seleccionar Destino en {storageManager.activeProvider.name}</h2>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {/* Selector de Edición del Día */}
      <div className="mb-6">
        <label className="block font-semibold text-gray-700 mb-2 flex items-center gap-2">
          <Folder size={18} className="text-indigo-600" />
          Edición del Día
        </label>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
          {edicionFolders.map(folder => {
            const color = getSubtleColor(folder.name);
            return (
              <div
                key={folder.id}
                onClick={() => setSelectedEdicion(folder.id)}
                className={`border rounded-lg p-3 cursor-pointer transition-all ${
                  selectedEdicion === folder.id
                    ? 'border-2 border-indigo-600 bg-indigo-100 shadow-lg ring-2 ring-indigo-200 ring-offset-1 scale-105'
                    : `${color.border} ${color.bg} hover:shadow-md`
                }`}
              >
                <div className="flex items-center gap-2">
                  <Folder 
                    size={16} 
                    className={selectedEdicion === folder.id ? 'text-indigo-700' : color.icon} 
                  />
                  <span className={`text-sm ${
                    selectedEdicion === folder.id ? 'text-indigo-900 font-bold' : 'text-gray-700 font-medium'
                  }`}>
                    {folder.name}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Selector de Página */}
      {selectedEdicion && (
        <div className="mb-6">
          <label className="block font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <Folder size={18} className="text-indigo-600" />
            Página
          </label>
          {loadingPages ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="animate-spin text-indigo-600" size={20} />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {pageFolders.map(folder => {
                const color = getSubtleColor(folder.name);
                return (
                  <div
                    key={folder.id}
                    onClick={() => setSelectedPage(folder.id)}
                    className={`border rounded-lg p-3 cursor-pointer transition-all ${
                      selectedPage === folder.id
                        ? 'border-2 border-indigo-600 bg-indigo-100 shadow-lg ring-2 ring-indigo-200 ring-offset-1 scale-105'
                        : `${color.border} ${color.bg} hover:shadow-md`
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <Folder 
                        size={16} 
                        className={selectedPage === folder.id ? 'text-indigo-700' : color.icon} 
                      />
                      <span className={`text-sm ${
                        selectedPage === folder.id ? 'text-indigo-900 font-bold' : 'text-gray-700 font-medium'
                      }`}>
                        {folder.name}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Botones */}
      <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-200">
        <button
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={handleSelect}
          disabled={!selectedPage}
          className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Seleccionar
        </button>
      </div>
    </div>
  );
};

export default DestinationFolderSelector;
