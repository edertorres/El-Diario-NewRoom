/**
 * Servicio de Autenticación para Nextcloud vía OAuth2 (PKCE)
 */

import { getAppConfig } from './driveService';

export interface NextcloudAuthState {
    isAuthenticated: boolean;
    accessToken: string | null;
    refreshToken: string | null;
    expiresAt: number | null;
    user: {
        id: string;
        email: string;
        displayName: string;
    } | null;
    isLoading: boolean;
    error: string | null;
}

class NextcloudAuthService {
    private listeners: Set<(state: NextcloudAuthState) => void> = new Set();
    private processingCode: string | null = null;
    private state: NextcloudAuthState = {
        isAuthenticated: false,
        accessToken: null,
        refreshToken: null,
        expiresAt: null,
        user: null,
        isLoading: true,
        error: null,
    };

    private getBaseUrl(): string {
        const config = getAppConfig().nextcloud;
        const url = config?.url || '';
        const h = window.location.hostname;
        // Si estamos en un entorno local, usamos el proxy de Vite
        if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.startsWith('192.168.')) {
            return '/nextcloud-api';
        }
        return url;
    }

    constructor() {
        this.checkExistingAuth();
    }

    private async checkExistingAuth() {
        const stored = localStorage.getItem('nextcloud_oauth');
        if (stored) {
            try {
                const data = JSON.parse(stored);
                if (data.accessToken) {
                    this.state = {
                        ...this.state,
                        isAuthenticated: true,
                        accessToken: data.accessToken,
                        refreshToken: data.refreshToken,
                        expiresAt: data.expiresAt,
                        user: data.user,
                        isLoading: false
                    };

                    // Verificar si el token ha expirado o está cerca de expirar (5 min)
                    if (data.expiresAt && data.expiresAt < Date.now() + 5 * 60 * 1000) {
                        await this.refreshAccessToken();
                    }
                } else {
                    this.state.isLoading = false;
                }
            } catch (e) {
                localStorage.removeItem('nextcloud_oauth');
                this.state.isLoading = false;
            }
        } else {
            this.state.isLoading = false;
        }
        this.notifyListeners();
    }

    async signIn() {
        const config = getAppConfig().nextcloud;
        if (!config?.url || !config?.clientId) {
            throw new Error('Configuración de Nextcloud incompleta (URL o Client ID faltante)');
        }

        // PKCE: Code Verifier
        const codeVerifier = this.generateRandomString(64);
        const codeChallenge = await this.generateCodeChallenge(codeVerifier);

        // Guardar verifier para el callback
        sessionStorage.setItem('nc_code_verifier', codeVerifier);

        const redirectUri = window.location.origin;
        const state = this.generateRandomString(32);
        sessionStorage.setItem('nc_auth_state', state);

        const authUrl = `${config.url}/apps/oauth2/authorize?` +
            `response_type=code&` +
            `client_id=${config.clientId}&` +
            `redirect_uri=${encodeURIComponent(redirectUri)}&` +
            `state=${state}&` +
            `code_challenge=${codeChallenge}&` +
            `code_challenge_method=S256&` +
            `scope=openid`; // O scopes que prefieras

        window.location.href = authUrl;
    }

    async handleCallback(code: string) {
        if (this.processingCode === code) return;

        const urlParams = new URLSearchParams(window.location.search);
        const returnedState = urlParams.get('state');
        const storedState = sessionStorage.getItem('nc_auth_state');

        if (storedState && returnedState !== storedState) {
            console.error('[NextcloudAuth] State mismatch!', { storedState, returnedState });
            this.state = { ...this.state, error: 'Error de seguridad: el estado de autenticación no coincide.' };
            this.notifyListeners();
            return;
        }

        this.processingCode = code;
        this.state.isLoading = true;
        this.notifyListeners();

        const config = getAppConfig().nextcloud;
        const codeVerifier = sessionStorage.getItem('nc_code_verifier');

        if (!config?.url || !config?.clientId || !codeVerifier) {
            this.state = { ...this.state, isLoading: false, error: 'Falta verifier o configuración de Nextcloud' };
            this.notifyListeners();
            return;
        }

        try {
            const redirectUri = window.location.origin;
            console.log(`[NextcloudAuth] Redirect URI que se enviará: "${redirectUri}"`);

            const base = this.getBaseUrl();
            const tokenUrl = `${base}/apps/oauth2/api/v1/token`;

            const clientId = config.clientId.trim();
            const clientSecret = config.clientSecret?.trim();

            const bodyParams: Record<string, string> = {
                grant_type: 'authorization_code',
                code,
                redirect_uri: redirectUri,
                code_verifier: codeVerifier
            };

            const headers: Record<string, string> = {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            };

            // Para clientes confidenciales, muchos servidores Nextcloud prefieren 
            // tanto Basic Auth como los parámetros en el cuerpo (Redundancia).
            if (clientSecret) {
                const creds = btoa(`${clientId}:${clientSecret}`);
                headers['Authorization'] = `Basic ${creds}`;
                console.log('[NextcloudAuth] Usando Autenticación Basic y parámetros en Body');
                bodyParams['client_id'] = clientId;
                bodyParams['client_secret'] = clientSecret;
            } else {
                bodyParams['client_id'] = clientId;
            }

            const body = new URLSearchParams(bodyParams);

            console.log(`[NextcloudAuth] Enviando petición de token a: ${tokenUrl}`);
            console.log(`[NextcloudAuth] Parámetros en Body: ${Object.keys(bodyParams).join(', ')}`);

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers,
                body
            });

            if (!response.ok) {
                if (response.status === 429) {
                    throw new Error('Nextcloud ha bloqueado la petición por exceso de intentos (Rate Limit). Por favor, espera 5-10 minutos antes de intentar de nuevo.');
                }
                let errorMessage = 'Error al obtener token (HTTP ' + response.status + ')';
                let responseBody = '';
                try {
                    responseBody = await response.text();
                    const errData = JSON.parse(responseBody);
                    errorMessage = errData.error_description || errData.error || errorMessage;
                } catch (e) {
                    errorMessage = responseBody || errorMessage;
                }
                console.error('[NextcloudAuth] Error en respuesta del servidor:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: responseBody
                });
                throw new Error(errorMessage);
            }

            const data = await response.json();
            await this.saveAuth(data);

            // Limpiar verifier y state
            sessionStorage.removeItem('nc_code_verifier');
            sessionStorage.removeItem('nc_auth_state');

            // Obtener info del usuario
            await this.fetchUserInfo();

        } catch (err: any) {
            console.error('[NextcloudAuth] Error crítico en handleCallback:', err);
            this.state = { ...this.state, isLoading: false, error: err.message };
            this.notifyListeners();
            throw err; // Re-lanzar para que App.tsx lo vea
        }
    }

    private async fetchUserInfo() {
        const config = getAppConfig().nextcloud;
        if (!config?.url || !this.state.accessToken) return;

        try {
            const base = this.getBaseUrl();
            // Intentar OIDC userinfo o OCS API
            const response = await fetch(`${base}/ocs/v2.php/cloud/user?format=json`, {
                headers: {
                    'Authorization': `Bearer ${this.state.accessToken}`,
                    'OCS-APIRequest': 'true'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('[NextcloudAuth] OCS response data:', data);
                const userData = data.ocs.data;
                this.state.user = {
                    id: userData.id,
                    email: userData.email || '',
                    displayName: userData.displayname || userData.id
                };
                console.log('[NextcloudAuth] Identificación exitosa:', this.state.user);
                this.updateStoredAuth();
                this.notifyListeners();
            } else {
                const text = await response.text();
                console.error(`[NextcloudAuth] Error en OCS (${response.status}):`, text);
                this.state.error = `Error al identificar usuario: ${response.statusText}`;
                this.notifyListeners();
            }
        } catch (e: any) {
            console.error('[NextcloudAuth] Error fetching Nextcloud user info:', e);
            this.state.error = `Error de red al identificar usuario: ${e.message}`;
            this.notifyListeners();
        }
    }

    async refreshAccessToken() {
        const config = getAppConfig().nextcloud;
        if (!config?.url || !config?.clientId || !this.state.refreshToken) return;

        try {
            const base = this.getBaseUrl();
            const tokenUrl = `${base}/apps/oauth2/api/v1/token`;
            const body = new URLSearchParams({
                grant_type: 'refresh_token',
                refresh_token: this.state.refreshToken,
                client_id: config.clientId
            });

            if (config.clientSecret) {
                body.append('client_secret', config.clientSecret);
            }

            const response = await fetch(tokenUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body
            });

            if (response.ok) {
                const data = await response.json();
                await this.saveAuth(data);
            } else {
                this.signOut(); // Si falla el refresh, forzar login
            }
        } catch (e) {
            console.error('Error refreshing NC token:', e);
        }
    }

    private async saveAuth(data: any) {
        const expiresAt = Date.now() + (data.expires_in * 1000);
        this.state = {
            ...this.state,
            isAuthenticated: true,
            accessToken: data.access_token,
            refreshToken: data.refresh_token,
            expiresAt: expiresAt,
            isLoading: false,
            error: null
        };
        this.updateStoredAuth();
        this.notifyListeners();
    }

    private updateStoredAuth() {
        localStorage.setItem('nextcloud_oauth', JSON.stringify({
            accessToken: this.state.accessToken,
            refreshToken: this.state.refreshToken,
            expiresAt: this.state.expiresAt,
            user: this.state.user
        }));
    }

    signOut() {
        localStorage.removeItem('nextcloud_oauth');
        this.state = {
            isAuthenticated: false,
            accessToken: null,
            refreshToken: null,
            expiresAt: null,
            user: null,
            isLoading: false,
            error: null
        };
        this.notifyListeners();
    }

    // Helpers PKCE
    private generateRandomString(length: number): string {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
        let result = '';
        const values = new Uint32Array(length);
        crypto.getRandomValues(values);
        for (let i = 0; i < length; i++) {
            result += charset[values[i] % charset.length];
        }
        return result;
    }

    private async generateCodeChallenge(verifier: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(verifier);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return btoa(String.fromCharCode(...new Uint8Array(hash)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    // State Management
    subscribe(listener: (state: NextcloudAuthState) => void): () => void {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private notifyListeners() {
        this.listeners.forEach(l => l({ ...this.state }));
    }

    getAccessToken() {
        return this.state.accessToken;
    }

    getState() {
        return { ...this.state };
    }
}

export const nextcloudAuth = new NextcloudAuthService();
