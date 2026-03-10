/**
 * Servicio de Autenticación con Google
 * Maneja el flujo OAuth 2.0 usando Google Identity Services
 */

declare global {
  interface Window {
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          initCodeClient: (config: CodeClientConfig) => CodeClient;
          revoke: (accessToken: string, callback: () => void) => void;
        };
        id: {
          initialize: (config: IdConfiguration) => void;
          prompt: (callback?: (notification: PromptMomentNotification) => void) => void;
        };
      };
    };
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: Error) => void;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface CodeClientConfig {
  client_id: string;
  scope: string;
  ux_mode?: 'popup' | 'redirect';
  callback: (response: CodeResponse) => void;
  error_callback?: (error: any) => void;
  access_type?: 'online' | 'offline';
  hint?: string;
  hosted_domain?: string;
  select_account?: boolean;
}

interface CodeClient {
  requestCode: () => void;
}

interface CodeResponse {
  code: string;
  scope: string;
  state?: string;
  error?: string;
  error_description?: string;
}

interface IdConfiguration {
  client_id: string;
  callback: (response: CredentialResponse) => void;
}

interface CredentialResponse {
  credential: string;
  select_by: string;
}

interface PromptMomentNotification {
  isDisplayMoment: () => boolean;
  isDisplayed: () => boolean;
  isNotDisplayed: () => boolean;
  getNotDisplayedReason: () => string;
  isSkippedMoment: () => boolean;
  getSkippedReason: () => string;
  isDismissedMoment: () => boolean;
  getDismissedReason: () => string;
}

export interface AuthState {
  isAuthenticated: boolean;
  accessToken: string | null;
  user: {
    email: string;
    name: string;
    picture: string;
  } | null;
  isLoading: boolean;
  error: string | null;
}

const CLIENT_ID = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_ID || '';
const CLIENT_SECRET = import.meta.env.VITE_GOOGLE_DRIVE_CLIENT_SECRET || '';
// Scope completo de Drive para poder eliminar archivos existentes (no solo los creados por la app)
const SCOPES = 'https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile';

class GoogleAuthService {
  private codeClient: CodeClient | null = null;
  private listeners: Set<(state: AuthState) => void> = new Set();
  private refreshTimer: number | null = null;
  private state: AuthState = {
    isAuthenticated: false,
    accessToken: null,
    user: null,
    isLoading: true,
    error: null,
  };

  isConfigured(): boolean {
    return CLIENT_ID.length > 0 && CLIENT_ID.includes('apps.googleusercontent.com');
  }

  async initialize(): Promise<void> {
    if (!this.isConfigured()) {
      this.state = {
        ...this.state,
        isLoading: false,
        error: 'Google Drive no está configurado. Configura VITE_GOOGLE_DRIVE_CLIENT_ID en el archivo .env',
      };
      this.notifyListeners();
      return;
    }

    return new Promise((resolve) => {
      if (window.google?.accounts?.oauth2) {
        this.codeClient = window.google.accounts.oauth2.initCodeClient({
          client_id: CLIENT_ID,
          scope: SCOPES,
          access_type: 'offline',
          // Quitamos select_account: true o lo dejamos por defecto para que Google decida si mostrar el selector
          // Si ya hay sesión previa en el navegador, Google entrará directamente si no forzamos consent.
          callback: (response: CodeResponse) => this.handleCodeResponse(response),
        });
        this.checkExistingAuth();
        resolve();
      } else {
        // Esperar a que Google Identity Services se cargue
        let attempts = 0;
        const checkGoogle = setInterval(() => {
          attempts++;
          if (window.google?.accounts?.oauth2) {
            clearInterval(checkGoogle);
            this.initialize().then(resolve);
          } else if (attempts > 50) {
            clearInterval(checkGoogle);
            this.state = {
              ...this.state,
              isLoading: false,
              error: 'Google Identity Services no se cargó. Recarga la página.',
            };
            this.notifyListeners();
            resolve();
          }
        }, 100);
      }
    });
  }

  private async handleCodeResponse(response: CodeResponse) {
    if (response.error) {
      this.state = {
        ...this.state,
        isLoading: false,
        error: response.error_description || response.error,
      };
      this.notifyListeners();
      return;
    }

    if (response.code) {
      this.state = { ...this.state, isLoading: true };
      this.notifyListeners();

      try {
        await this.exchangeCodeForTokens(response.code);
      } catch (err: any) {
        this.state = {
          ...this.state,
          isLoading: false,
          error: `Error al intercambiar código: ${err.message}`,
        };
        this.notifyListeners();
      }
    }
  }

  private async exchangeCodeForTokens(code: string) {
    if (!CLIENT_SECRET) {
      throw new Error('VITE_GOOGLE_DRIVE_CLIENT_SECRET no configurado en .env');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: window.location.origin,
        grant_type: 'authorization_code',
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error_description || data.error || 'Token exchange failed');
    }

    const { access_token, refresh_token, expires_in } = data;

    this.state = {
      ...this.state,
      isAuthenticated: true,
      accessToken: access_token,
      isLoading: false,
      error: null,
    };

    const userInfo = await this.fetchUserInfo(access_token);
    if (userInfo) {
      this.state.user = userInfo;
    }

    await this.saveToStorage(access_token, expires_in, refresh_token);
    this.scheduleTokenRefresh(expires_in, refresh_token);
    this.notifyListeners();
  }

  private async fetchUserInfo(accessToken: string) {
    try {
      const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      if (res.ok) {
        const userData = await res.json();
        return {
          email: userData.email || '',
          name: userData.name || '',
          picture: userData.picture || ''
        };
      }
    } catch (e) {
      console.error('Error fetching user info:', e);
    }
    return null;
  }

  private async checkExistingAuth(): Promise<void> {
    const stored = localStorage.getItem('google_auth') || sessionStorage.getItem('google_auth');
    if (stored) {
      try {
        const { accessToken, refreshToken, expiresAt, user } = JSON.parse(stored);
        const now = Date.now();

        if (expiresAt > now + 60000) { // Si falta más de un minuto
          this.state = {
            isAuthenticated: true,
            accessToken,
            user,
            isLoading: false,
            error: null,
          };
          const remainingSeconds = Math.floor((expiresAt - now) / 1000);
          this.scheduleTokenRefresh(remainingSeconds, refreshToken);
        } else if (refreshToken) {
          console.log('[GoogleAuth] Token expirado o por expirar, renovando...');
          await this.refreshAccessToken(refreshToken);
        } else {
          this.clearStorage();
          this.state.isLoading = false;
        }
      } catch (e) {
        this.clearStorage();
        this.state.isLoading = false;
      }
    } else {
      this.state = {
        ...this.state,
        isLoading: false,
      };
    }
    this.notifyListeners();
  }

  private clearStorage() {
    sessionStorage.removeItem('google_auth');
    localStorage.removeItem('google_auth');
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private async saveToStorage(accessToken: string, expiresIn: number, refreshToken?: string): Promise<void> {
    const expiresAt = Date.now() + expiresIn * 1000;
    const user = this.state.user;

    // Persistir el refresh token si ya existía y no viene en la nueva respuesta
    let finalRefreshToken = refreshToken;
    if (!finalRefreshToken) {
      const stored = localStorage.getItem('google_auth') || sessionStorage.getItem('google_auth');
      if (stored) {
        try {
          finalRefreshToken = JSON.parse(stored).refreshToken;
        } catch (e) { }
      }
    }

    const authData = JSON.stringify({ accessToken, refreshToken: finalRefreshToken, expiresAt, user });

    // Priorizar localStorage para persistencia real
    localStorage.setItem('google_auth', authData);
    sessionStorage.setItem('google_auth', authData);
  }

  private scheduleTokenRefresh(expiresIn: number, refreshToken?: string) {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    if (!refreshToken) return;

    // Refrescar 5 minutos antes de que caduque (o la mitad del tiempo si dura poco)
    const refreshBuffer = Math.min(300, expiresIn / 2);
    const delayMs = (expiresIn - refreshBuffer) * 1000;

    console.log(`[GoogleAuth] Siguiente refresco programado en ${Math.floor(delayMs / 1000 / 60)} min`);

    this.refreshTimer = window.setTimeout(async () => {
      console.log('[GoogleAuth] Ejecutando auto-refresco de token...');
      await this.refreshAccessToken(refreshToken);
    }, delayMs);
  }

  async refreshAccessToken(refreshToken: string): Promise<void> {
    if (!CLIENT_SECRET) return;

    try {
      const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      const data = await response.json();

      if (response.ok) {
        const { access_token, expires_in } = data;
        this.state = {
          ...this.state,
          isAuthenticated: true,
          accessToken: access_token,
          isLoading: false,
          error: null,
        };
        await this.saveToStorage(access_token, expires_in, refreshToken);
        this.scheduleTokenRefresh(expires_in, refreshToken);
        this.notifyListeners();
      } else {
        console.error('[GoogleAuth] Fallo al refrescar token:', data);
        // Si el refresh token ya no es válido, cerramos sesión
        if (data.error === 'invalid_grant') {
          this.signOut();
        }
      }
    } catch (e) {
      console.error('[GoogleAuth] Error en refreshAccessToken:', e);
    }
  }

  signIn(): void {
    if (!this.codeClient) {
      this.state = {
        ...this.state,
        error: 'Google Auth no está inicializado',
      };
      this.notifyListeners();
      return;
    }
    // No pasamos parámetros para que use los de inicialización y respete el flujo sin prompt:consent
    this.codeClient.requestCode();
  }

  signOut(): void {
    if (this.state.accessToken && window.google?.accounts?.oauth2) {
      try {
        window.google.accounts.oauth2.revoke(this.state.accessToken, () => { });
      } catch (e) { }
    }
    this.clearStorage();
    this.state = {
      isAuthenticated: false,
      accessToken: null,
      user: null,
      isLoading: false,
      error: null,
    };
    this.notifyListeners();
  }

  isAuthenticated(): boolean {
    return this.state.isAuthenticated;
  }

  getAccessToken(): string | null {
    return this.state.accessToken;
  }

  getUser(): AuthState['user'] {
    return this.state.user;
  }

  getState(): AuthState {
    return { ...this.state };
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.getState()));
  }
}

export const googleAuth = new GoogleAuthService();
