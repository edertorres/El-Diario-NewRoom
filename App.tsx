
import React, { useState, useEffect } from 'react';
import { AppMode, IDMLStory, IDMLSpread, DriveConfig } from './types';
import StoryMapper from './components/StoryMapper';
import GoogleAuthButton from './components/GoogleAuthButton';
import TemplateGallery from './components/TemplateGallery';
import { UserManual } from './components/UserManual';
import { NextcloudAuthModal } from './components/NextcloudAuthModal';
import { idmlEngine } from './services/idmlEngine';
import { getAppConfig } from './services/driveService';
import { googleAuth } from './services/googleAuth';
import { nextcloudAuth } from './services/nextcloudAuth';
import { storageManager } from './services/storage/StorageManager';
import NextcloudAuthButton from './components/NextcloudAuthButton';
import { Layout, Upload, AlertTriangle, FileType, Cloud, BookOpen, Settings } from 'lucide-react';

const App = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.UPLOAD);
  const [stories, setStories] = useState<IDMLStory[]>([]);
  const [spreads, setSpreads] = useState<IDMLSpread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<ReturnType<typeof getAppConfig>>(getAppConfig());
  const [showTemplateGallery, setShowTemplateGallery] = useState(false);
  const [showUserManual, setShowUserManual] = useState(false);
  const [showNextcloudAuth, setShowNextcloudAuth] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [imagesFolderId, setImagesFolderId] = useState<string | undefined>();
  const [storageMode, setStorageMode] = useState<'google' | 'nextcloud'>(
    storageManager.activeProvider.id === 'nextcloud' ? 'nextcloud' : 'google'
  );
  const [batchText, setBatchText] = useState<string>(() => {
    return localStorage.getItem('idml_batch_text') || "";
  });
  const [templateName, setTemplateName] = useState<string>("");
  const [templateCategory, setTemplateCategory] = useState<string>("");

  // Persistir batchText
  useEffect(() => {
    localStorage.setItem('idml_batch_text', batchText);
  }, [batchText]);

  // Sincronizar storageManager con la selección del usuario
  useEffect(() => {
    storageManager.setActiveProvider(storageMode === 'google' ? 'google-drive' : 'nextcloud');
  }, [storageMode]);

  // Verificar autenticación y configuración
  useEffect(() => {
    const config = getAppConfig();
    setAppConfig(config);
    if (config.storageMode !== 'both') {
      setStorageMode(config.storageMode as any);
    }

    // Manejar callback de OAuth2 de Nextcloud
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code && !nextcloudAuth.getState().isAuthenticated) {
      nextcloudAuth.handleCallback(code).then(() => {
        // Limpiar la URL sin recargar
        window.history.replaceState({}, document.title, window.location.pathname);
        setStorageMode('nextcloud');
      }).catch(err => {
        console.error('[App] Error en callback de Nextcloud:', err);
      });
    }
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.idml')) {
      setError("Por favor selecciona un archivo .idml válido");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await idmlEngine.loadFile(file);
      setStories(result.stories);
      setSpreads(result.spreads);
      setMode(AppMode.MAPPING);
    } catch (err) {
      setError("Error al analizar el archivo IDML. Asegúrate de que sea un archivo válido.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleUseMock = () => {
    const mock = idmlEngine.loadMock();
    setStories(mock.stories);
    setSpreads(mock.spreads);
    setMode(AppMode.MAPPING);
  };

  const handleLoadFromStorage = () => {
    // Refrescar configuración para captar cambios de localStorage
    const freshConfig = getAppConfig();
    setAppConfig(freshConfig);

    const activeConfig = storageMode === 'google' ? freshConfig.google : freshConfig.nextcloud;
    if (!activeConfig) {
      setError(`La configuración de ${storageMode === 'google' ? 'Google Drive' : 'Nextcloud'} no está completa.`);
      return;
    }
    setShowTemplateGallery(true);
  };

  const handleTemplateSelected = (selectedStories: IDMLStory[], selectedSpreads: IDMLSpread[], selectedTemplateName: string, selectedCategoryName: string, folderId?: string) => {
    setStories(selectedStories);
    setSpreads(selectedSpreads);
    setTemplateName(selectedTemplateName);
    setTemplateCategory(selectedCategoryName);
    setImagesFolderId(folderId);
    setShowTemplateGallery(false);
    setMode(AppMode.MAPPING);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-[98%] mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-lg">
              <Layout className="text-white" size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              IDML Injector Pro
            </h1>
          </div>
          <div className="flex items-center gap-6">
            {appConfig.storageMode === 'both' && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setStorageMode('google')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${storageMode === 'google' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Google Drive
                </button>
                <button
                  onClick={() => setStorageMode('nextcloud')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${storageMode === 'nextcloud' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Nextcloud
                </button>
              </div>
            )}
            <div className="flex items-center gap-4 text-sm font-medium text-gray-500">
              <button
                onClick={() => setShowUserManual(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all font-bold"
              >
                <BookOpen size={16} />
                Manual de Usuario
              </button>
              <div className="h-4 w-px bg-gray-200 mx-2" />
              <button
                onClick={() => setMode(AppMode.UPLOAD)}
                className={`transition-colors hover:text-indigo-600 ${mode === AppMode.UPLOAD ? "text-indigo-600 font-bold" : ""}`}
              >
                1. Cargar
              </button>
              <span className="text-gray-300">/</span>
              <span className={mode === AppMode.MAPPING ? "text-indigo-600 font-bold" : "opacity-50 cursor-not-allowed"}>
                2. Mapear e Inyectar
              </span>
            </div>
            <div className="border-l border-gray-200 pl-6">
              {storageMode === 'google' ? (
                <GoogleAuthButton onAuthChange={setIsAuthenticated} />
              ) : (
                <NextcloudAuthButton onAuthChange={(auth) => {
                  if (auth) setError(null);
                }} />
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-[98%] mx-auto px-4 py-6">
        {mode === AppMode.UPLOAD && (
          <>
            {showTemplateGallery && (storageMode === 'google' ? appConfig.google : appConfig.nextcloud) ? (
              <TemplateGallery
                templatesFolderId={storageMode === 'google'
                  ? appConfig.google!.templatesFolderId
                  : (appConfig.nextcloud?.templatesPath || appConfig.nextcloud?.templatesFolderId || '')}
                onTemplateSelect={handleTemplateSelected}
                onCancel={() => setShowTemplateGallery(false)}
              />
            ) : (
              <div className="max-w-2xl mx-auto">
                <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-12 text-center relative overflow-hidden">
                  <div className="absolute inset-x-0 -top-24 flex justify-center pointer-events-none">
                    <div className="h-96 w-96 bg-gradient-to-b from-indigo-50 to-transparent rounded-full blur-3xl opacity-85" />
                  </div>
                  <div className="mx-auto mb-8 flex items-center justify-center">
                    <img
                      src="https://www.eldiario.com.co/wp-content/uploads/2025/04/9ff2a92a-26b4-43fb-8f87-351e8959920c-removebg-preview-e1743786500729.png"
                      alt="Logo IDML Injector"
                      className="object-contain drop-shadow-xl"
                      style={{ width: '500px', height: 'auto', maxWidth: '100%' }}
                    />
                  </div>
                  <div className="mx-auto h-16 w-16 bg-indigo-50 rounded-full flex items-center justify-center mb-5 shadow-sm">
                    <Upload className="text-indigo-600" size={28} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Carga tu Plantilla IDML</h2>
                  <p className="text-gray-600 mb-8">
                    Analizaremos los estilos e historias existentes para preparar la inyección de texto.
                  </p>
                  {error && (
                    <div className="mb-6 bg-red-50 text-red-600 p-3 rounded-lg flex items-center justify-center gap-2">
                      <AlertTriangle size={16} />
                      {error}
                    </div>
                  )}
                  <div className="space-y-4">
                    <button
                      onClick={() => {
                        if (storageMode === 'google') {
                          if (!isAuthenticated) {
                            setError('Por favor, inicia sesión con Google primero usando el botón en la esquina superior derecha.');
                            return;
                          }
                          if (!appConfig.google) {
                            setError('Las carpetas de Google Drive no están configuradas.');
                            return;
                          }
                        } else {
                          // Validación para Nextcloud
                          if (!storageManager.activeProvider.isAuthenticated()) {
                            setShowNextcloudAuth(true);
                            return;
                          }
                        }
                        handleLoadFromStorage();
                      }}
                      disabled={isLoading}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-white font-semibold py-4 px-6 rounded-lg transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Cloud size={20} />
                      {storageMode === 'google'
                        ? (!isAuthenticated ? 'Inicia sesión para cargar desde Google Drive' : 'Cargar desde Google Drive')
                        : 'Cargar desde Nextcloud'
                      }
                    </button>
                    <div className="relative group">
                      <input
                        type="file"
                        accept=".idml"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setTemplateName(file.name.replace(/\.idml$/i, ''));
                            setTemplateCategory('Carga local');
                          }
                          handleFileUpload(e);
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        disabled={isLoading}
                      />
                      <button className="w-full bg-white hover:bg-gray-50 text-indigo-600 font-semibold py-4 px-6 rounded-lg transition-all shadow-sm border-2 border-indigo-200 hover:border-indigo-300 flex items-center justify-center gap-2">
                        {isLoading ? "Analizando Estructura IDML..." : "Seleccionar Archivo .idml"}
                      </button>
                    </div>
                  </div>
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <button
                      onClick={handleUseMock}
                      className="text-indigo-600 hover:text-indigo-800 font-medium text-sm flex items-center justify-center gap-2 mx-auto"
                    >
                      <FileType size={16} />
                      Probar con Estructura IDML Demo
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {mode === AppMode.MAPPING && (
          <StoryMapper
            key={templateName || 'local-upload'}
            stories={stories}
            setStories={setStories}
            spreads={spreads}
            imagesFolderId={imagesFolderId}
            batchText={batchText}
            setBatchText={setBatchText}
            templateName={templateName}
            templateCategory={templateCategory}
            onResetTemplate={() => setMode(AppMode.UPLOAD)}
          />
        )}
      </main>

      <UserManual
        isOpen={showUserManual}
        onClose={() => setShowUserManual(false)}
      />

      <NextcloudAuthModal
        isOpen={showNextcloudAuth}
        onClose={() => setShowNextcloudAuth(false)}
        onConfigured={() => handleLoadFromStorage()}
      />
    </div>
  );
};

export default App;
