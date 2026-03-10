import React, { useState, useEffect } from 'react';
import { googleAuth, AuthState } from '../services/googleAuth';
import { LogIn, LogOut, User, Loader2, AlertCircle } from 'lucide-react';

interface Props {
  onAuthChange?: (isAuthenticated: boolean) => void;
}

const GoogleAuthButton: React.FC<Props> = ({ onAuthChange }) => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    accessToken: null,
    user: null,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    // Esperar a que Google Identity Services se cargue
    const initAuth = async () => {
      // Esperar hasta que Google esté disponible
      let attempts = 0;
      while (!window.google?.accounts?.oauth2 && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }

      if (!window.google?.accounts?.oauth2) {
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Google Identity Services no está cargado. Recarga la página.',
        }));
        return;
      }

      // Inicializar servicio de autenticación
      try {
        await googleAuth.initialize();
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Error al inicializar autenticación',
        }));
      }
    };

    initAuth();

    // Suscribirse a cambios de estado
    const unsubscribe = googleAuth.subscribe((state) => {
      setAuthState(state);
      if (onAuthChange) {
        onAuthChange(state.isAuthenticated);
      }
    });

    return unsubscribe;
  }, [onAuthChange]);

  const handleSignIn = () => {
    googleAuth.signIn();
  };

  const handleSignOut = () => {
    googleAuth.signOut();
  };

  if (!googleAuth.isConfigured()) {
    return (
      <div className="flex items-center gap-2 text-xs text-amber-600">
        <AlertCircle size={14} />
        <span>Google Drive no configurado</span>
      </div>
    );
  }

  if (authState.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Loader2 className="animate-spin" size={16} />
        <span>Cargando...</span>
      </div>
    );
  }

  if (authState.error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-600">
        <AlertCircle size={14} />
        <span>{authState.error}</span>
      </div>
    );
  }

  if (authState.isAuthenticated && authState.user) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
            {authState.user.picture ? (
              <img src={authState.user.picture} alt={authState.user.name} className="w-8 h-8 rounded-full" />
            ) : (
              <User size={16} className="text-indigo-600" />
            )}
          </div>
          <span className="text-gray-700 font-medium">{authState.user.name}</span>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-colors"
        >
          <LogOut size={14} />
          Salir
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleSignIn}
      className="flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-colors shadow-sm"
    >
      <LogIn size={16} />
      Iniciar sesión con Google
    </button>
  );
};

export default GoogleAuthButton;
