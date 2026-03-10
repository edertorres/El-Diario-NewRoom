
import { StorageFile, StorageFolder, StorageProvider } from './types';
import { nextcloudAuth } from '../nextcloudAuth';

export class NextcloudProvider implements StorageProvider {
  id = 'nextcloud';
  name = 'Nextcloud';

  private baseUrl: string = import.meta.env.VITE_NEXTCLOUD_URL || '';
  private user: string = import.meta.env.VITE_NEXTCLOUD_USER || '';
  private token: string | null = import.meta.env.VITE_NEXTCLOUD_TOKEN || null;

  constructor() {
    // Inicializar desde localStorage si existe
    const stored = localStorage.getItem('nextcloud_config');
    if (stored) {
      try {
        const { url, user, token } = JSON.parse(stored);
        if (url) this.baseUrl = url;
        if (user) this.user = user;
        if (token) this.token = token;
      } catch (e) {
        console.error('Error al cargar config de Nextcloud desde storage:', e);
      }
    }
  }

  getUser(): string {
    const state = nextcloudAuth.getState();
    const user = state.user;

    // Log para depuración
    const allKeys = Object.keys(localStorage);
    console.log('[NextcloudProvider] Claves en localStorage:', allKeys.filter(k => k.includes('nextcloud')));

    // 1. Prioridad: Usuario identificado por OAuth
    if (user?.id || user?.email) {
      const identifier = user.id || user.email || '';
      console.log(`[NextcloudProvider] Identificador de usuario (OAuth): ${identifier}`);
      return identifier;
    }

    // 2. Fallback: Usuario guardado manualmente en el modal de config
    let manualUser = null;

    // Prioridad 1: Buscar dentro del JSON de config (más reciente y completo)
    const configStr = localStorage.getItem('nextcloud_config');
    if (configStr) {
      try {
        const config = JSON.parse(configStr);
        if (config.user && config.user !== 'null' && config.user !== 'undefined') {
          manualUser = config.user;
          console.log(`[NextcloudProvider] Usuario encontrado en nextcloud_config (JSON): ${manualUser}`);
        }
      } catch (e) { }
    }

    // Prioridad 2: Buscar en la clave legacy como backup
    if (!manualUser) {
      manualUser = localStorage.getItem('nextcloud_user_manual');
      // Evitar cadenas "null" o "undefined" literales
      if (manualUser === 'null' || manualUser === 'undefined') manualUser = null;
      if (manualUser) console.log(`[NextcloudProvider] Usuario encontrado en nextcloud_user_manual (Legacy): ${manualUser}`);
    }

    manualUser = manualUser?.trim() || null;
    console.log(`[NextcloudProvider] Valor de manualUser detectado (depurado): "${manualUser}"`);

    if (manualUser) {
      console.log(`[NextcloudProvider] Identificador de usuario (Manual): ${manualUser}`);
      return manualUser;
    }

    // 3. Fallback: Variable de entorno
    if (this.user) {
      console.log(`[NextcloudProvider] Identificador de usuario (Env): ${this.user}`);
      return this.user;
    }

    console.warn('[NextcloudProvider] No se encontró ningún identificador de usuario.');
    return '';
  }

  private getProxyAwareBaseUrl(): string {
    const h = window.location.hostname;
    // Si estamos en un entorno local, usamos el proxy de Vite
    if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h.startsWith('192.168.')) {
      return '/nextcloud-api';
    }
    return this.baseUrl;
  }

  setBaseUrl(url: string) {
    this.baseUrl = url;
  }

  getAuthHeader(): string | null {
    const token = nextcloudAuth.getAccessToken();
    return token ? `Bearer ${token}` : null;
  }

  isAuthenticated(): boolean {
    return nextcloudAuth.getState().isAuthenticated && !!this.baseUrl;
  }

  private getFullUrl(path: string): string {
    if (path.startsWith('http')) return path;

    // Normalizar: si el path ya está encoded (viene de un href del servidor), lo decodificamos 
    // para tratarlo uniformemente antes de construir la URL final.
    let decodedPath = path;
    try {
      decodedPath = decodeURIComponent(path);
    } catch (e) {
      // Si falla es que ya estaba decodificado o tiene caracteres inválidos para decode
    }

    const proxyBase = this.getProxyAwareBaseUrl();
    const userEmail = this.getUser();
    const webdavPrefix = `/remote.php/dav/files/${userEmail}`;

    // 1. Si el path ya tiene el proxy completo o el prefijo de WebDAV, no re-prefijar el base
    if (decodedPath.startsWith(proxyBase)) {
      // Just normalize slashes
      return decodedPath.replace(/\/+/g, '/').replace(':/', '://');
    }

    let finalPath = '';
    if (decodedPath.includes('/remote.php/dav/files/')) {
      // El path ya parece ser absoluto desde la raíz del servidor
      const separator = proxyBase.endsWith('/') ? '' : '/';
      finalPath = `${proxyBase}${separator}${decodedPath.startsWith('/') ? decodedPath.substring(1) : decodedPath}`;
    } else {
      // Es un path relativo de carpeta (ej. /Plantillas), construirlo normal
      let base = proxyBase;
      if (!base.includes('remote.php/dav/files') && userEmail) {
        base = `${base}${base.endsWith('/') ? '' : '/'}${webdavPrefix.substring(1)}`;
      }
      finalPath = `${base}${decodedPath.startsWith('/') ? '' : '/'}${decodedPath}`;
    }

    // Codificar la URL final (evitando doble encoding del protocolo si lo hubiera)
    // Separamos el host del path para codificar solo el path
    const urlParts = finalPath.split('://');
    const protocol = urlParts.length > 1 ? urlParts[0] + '://' : '';
    const fullPath = urlParts.length > 1 ? urlParts[1] : urlParts[0];

    const encodedPath = fullPath.split('/').map(segment => encodeURIComponent(segment)).join('/');
    const fullUrl = (protocol + encodedPath).replace(/\/+/g, '/').replace(':/', '://');

    console.log(`[NextcloudProvider] URL final: ${fullUrl}`);
    return fullUrl;
  }

  private async davRequest(method: string, path: string, body?: BodyInit, headers: Record<string, string> = {}): Promise<Response> {
    if (!this.baseUrl) throw new Error('Nextcloud URL no configurada');

    const auth = this.getAuthHeader();

    // Si no hay token, no intentar la petición (evita 401s innecesarios)
    if (!auth) {
      console.warn('[NextcloudProvider] Saltando petición WebDAV: No hay token de autenticación.');
      throw new Error('No autenticado en Nextcloud. Por favor inicia sesión.');
    }

    const url = this.getFullUrl(path);
    console.log(`[NextcloudProvider] ${method} ${url}`);

    const res = await fetch(url, {
      method,
      headers: {
        'Authorization': auth,
        ...headers
      },
      body
    });

    if (!res.ok && res.status !== 207) {
      throw new Error(`Nextcloud Error (${res.status}): ${res.statusText}`);
    }

    return res;
  }

  async listFolders(parentFolderId: string): Promise<StorageFolder[]> {
    // parentFolderId en Nextcloud suele ser la ruta relativa o un fileID si se usa /dav/spaces
    const res = await this.davRequest('PROPFIND', parentFolderId, undefined, { 'Depth': '1' });
    const text = await res.text();
    return this.parseWebDavXml(text, true) as StorageFolder[];
  }

  async getFolderInfo(folderId: string): Promise<StorageFolder> {
    const res = await this.davRequest('PROPFIND', folderId, undefined, { 'Depth': '0' });
    const text = await res.text();
    const folders = this.parseWebDavXml(text, true) as StorageFolder[];
    if (folders.length === 0) throw new Error('Carpeta no encontrada');
    return folders[0];
  }

  async listFiles(folderId: string): Promise<StorageFile[]> {
    const res = await this.davRequest('PROPFIND', folderId, undefined, { 'Depth': '1' });
    const text = await res.text();
    return this.parseWebDavXml(text, false) as StorageFile[];
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const res = await this.davRequest('GET', fileId);
    return res.blob();
  }

  async uploadFile(blob: Blob, fileName: string, folderId: string): Promise<StorageFile> {
    const path = `${folderId}/${fileName}`.replace(/\/+/g, '/');
    const arrayBuffer = await blob.arrayBuffer();
    await this.davRequest('PUT', path, arrayBuffer, {
      'Content-Type': blob.type || 'application/octet-stream',
      'Content-Length': String(blob.size),
    });

    // Obtener info del archivo recién subido
    const res = await this.davRequest('PROPFIND', path, undefined, { 'Depth': '0' });
    const text = await res.text();
    const files = this.parseWebDavXml(text, false) as StorageFile[];
    return files[0];
  }

  async deleteFile(fileId: string): Promise<void> {
    await this.davRequest('DELETE', fileId);
  }

  async findFilesByName(folderId: string, fileName: string): Promise<StorageFile[]> {
    const all = await this.listFiles(folderId);
    return all.filter(f => f.name === fileName);
  }

  // Parser básico de XML WebDAV (multistatus)
  private parseWebDavXml(xml: string, onlyFolders: boolean): (StorageFile | StorageFolder)[] {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'text/xml');

    // Función helper para buscar tags con o sin namespace DAV:
    const getDavElements = (parent: Element | Document, localName: string) => {
      const ns = parent.getElementsByTagNameNS('DAV:', localName);
      if (ns.length > 0) return Array.from(ns);
      // Fallback a tags con prefijo d: o sin prefijo si el namespace no fue detectado correctamente
      return Array.from(parent.getElementsByTagName(`d:${localName}`)).concat(
        Array.from(parent.getElementsByTagName(localName)));
    };

    const responses = getDavElements(doc, 'response');
    const results: (StorageFile | StorageFolder)[] = [];

    // El primer response suele ser el directorio padre (Depth 1), lo saltamos si hay más
    const startIdx = responses.length > 1 ? 1 : 0;

    for (let i = startIdx; i < responses.length; i++) {
      const resp = responses[i] as Element;
      const href = getDavElements(resp, 'href')[0]?.textContent || '';
      const propstat = getDavElements(resp, 'propstat')[0] as Element;
      const prop = getDavElements(propstat, 'prop')[0] as Element;

      if (!prop) continue;

      const displayName = getDavElements(prop, 'displayname')[0]?.textContent ||
        href.split('/').filter(Boolean).pop() || '';

      const resType = getDavElements(prop, 'resourcetype')[0] as Element;
      const isFolder = resType ? getDavElements(resType, 'collection').length > 0 : false;

      if (onlyFolders && !isFolder) continue;
      if (!onlyFolders && isFolder) continue;

      if (isFolder) {
        results.push({
          id: href, // En WebDAV la URL es el ID
          name: displayName
        });
      } else {
        const mimeType = prop?.getElementsByTagNameNS('DAV:', 'getcontenttype')[0]?.textContent || 'application/octet-stream';
        results.push({
          id: href,
          name: displayName,
          mimeType
        });
      }
    }

    return results;
  }
}

export const nextcloudProvider = new NextcloudProvider();
