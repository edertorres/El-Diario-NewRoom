import React, { useState, useEffect } from 'react';
import { nextcloudAuth, NextcloudAuthState } from '../services/nextcloudAuth';
import { LogIn, LogOut, User, Loader2, AlertCircle, Cloud } from 'lucide-react';

interface Props {
    onAuthChange?: (isAuthenticated: boolean) => void;
}

const NextcloudAuthButton: React.FC<Props> = ({ onAuthChange }) => {
    const [authState, setAuthState] = useState<NextcloudAuthState>(nextcloudAuth.getState());

    useEffect(() => {
        const unsubscribe = nextcloudAuth.subscribe((state) => {
            setAuthState(state);
            if (onAuthChange) {
                onAuthChange(state.isAuthenticated);
            }
        });

        return unsubscribe;
    }, [onAuthChange]);

    const handleSignIn = () => {
        try {
            nextcloudAuth.signIn();
        } catch (err: any) {
            console.error('Error in NC sign in:', err);
        }
    };

    const handleSignOut = () => {
        nextcloudAuth.signOut();
    };

    if (authState.isLoading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Loader2 className="animate-spin" size={16} />
                <span>Conectando a Nextcloud...</span>
            </div>
        );
    }

    if (authState.error) {
        return (
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-xs text-red-600">
                    <AlertCircle size={14} />
                    <span>Error en Nextcloud: {authState.error}</span>
                </div>
                <button
                    onClick={handleSignIn}
                    className="text-[10px] text-indigo-600 hover:underline text-left"
                >
                    Reintentar conexión
                </button>
            </div>
        );
    }

    if (authState.isAuthenticated && authState.user) {
        return (
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-sm">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Cloud size={16} className="text-blue-600" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-gray-900 font-bold leading-none">{authState.user.displayName}</span>
                        <span className="text-[10px] text-gray-500">{authState.user.email || 'Nextcloud'}</span>
                    </div>
                </div>
                <button
                    onClick={handleSignOut}
                    className="flex items-center gap-2 px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md text-xs transition-colors border border-gray-200"
                >
                    <LogOut size={12} />
                    Salir
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={handleSignIn}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold transition-all shadow-sm"
        >
            <Cloud size={16} />
            Conectar Nextcloud
        </button>
    );
};

export default NextcloudAuthButton;
