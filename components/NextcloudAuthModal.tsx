
import React, { useState } from 'react';
import { X, Server, Key, Save, AlertCircle } from 'lucide-react';
import { nextcloudProvider } from '../services/storage/NextcloudProvider';
import { googleAuth } from '../services/googleAuth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfigured: () => void;
}

export const NextcloudAuthModal: React.FC<Props> = ({ isOpen, onClose, onConfigured }) => {
  const [url, setUrl] = useState(import.meta.env.VITE_NEXTCLOUD_URL || '');
  const [username, setUsername] = useState(localStorage.getItem('nextcloud_user_manual') || '');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!url) {
      setError('Por favor, ingresa la URL de Nextcloud.');
      return;
    }
    if (!username.trim()) {
      setError('Por favor, ingresa tu Nombre de Usuario. Es necesario para acceder a las carpetas.');
      return;
    }

    try {
      // Normalizar URL (quitar slash final si existe)
      const cleanUrl = url.replace(/\/+$/, '');

      const configData = {
        url: cleanUrl,
        user: username.trim() || undefined
      };

      console.log('[NextcloudAuthModal] Guardando configuración:', configData);
      localStorage.setItem('nextcloud_config', JSON.stringify(configData));

      // Actualizar el proveedor en runtime
      nextcloudProvider.setBaseUrl(cleanUrl);

      if (username) {
        localStorage.setItem('nextcloud_user_manual', username.trim());
      } else {
        localStorage.removeItem('nextcloud_user_manual');
      }

      onConfigured();
      onClose();
    } catch (err: any) {
      setError('Error al guardar la configuración: ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Server className="text-indigo-600" size={20} />
            <h2 className="text-lg font-bold text-gray-900">Configuración Nextcloud</h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm border border-red-100">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">URL de la Instancia</label>
            <div className="relative">
              <Server className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://nextcloud.ejemplo.com"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1 italic">Ejemplo: https://nextcloud.empresa.com</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Nombre de Usuario (Opcional)</label>
            <div className="relative">
              <Key className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Tu usuario en Nextcloud"
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
            <p className="text-[10px] text-gray-500 mt-1 italic">
              Úsalo solo si el sistema no logra identificarte automáticamente.
            </p>
          </div>


          <p className="text-[10px] text-gray-500 bg-indigo-50 p-3 rounded-lg border border-indigo-100 italic">
            <strong>Nota SSO:</strong> El sistema usará tu cuenta de Google actual para entrar a Nextcloud.
            Asegúrate de que Nextcloud esté configurado para aceptar el login de <strong>{googleAuth.getUser()?.email}</strong>.
          </p>

          <div className="pt-4">
            <button
              onClick={handleSave}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
            >
              <Save size={18} />
              Guardar y Conectar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
