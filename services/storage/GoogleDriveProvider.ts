
import { googleAuth } from '../googleAuth';
import { StorageFile, StorageFolder, StorageProvider } from './types';

export class GoogleDriveProvider implements StorageProvider {
  id = 'google-drive';
  name = 'Google Drive';

  private getAccessToken(): string {
    const token = googleAuth.getAccessToken();
    if (!token) {
      throw new Error('No hay token de acceso a Google. Por favor inicia sesión.');
    }
    return token;
  }

  getAuthHeader(): string | null {
    const token = googleAuth.getAccessToken();
    return token ? `Bearer ${token}` : null;
  }

  isAuthenticated(): boolean {
    return !!googleAuth.getAccessToken();
  }

  private async request(url: string, options: RequestInit = {}): Promise<any> {
    const token = this.getAccessToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Error Google Drive: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  async listFolders(parentFolderId: string): Promise<StorageFolder[]> {
    const query = `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`;
    const data = await this.request(url);
    return data.files.map((f: any) => ({
      id: f.id,
      name: f.name,
      parentId: parentFolderId
    }));
  }

  async getFolderInfo(folderId: string): Promise<StorageFolder> {
    const url = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,trashed&supportsAllDrives=true`;
    const f = await this.request(url);
    return {
      id: f.id,
      name: f.name
    };
  }

  async listFiles(folderId: string): Promise<StorageFile[]> {
    const query = `'${folderId}' in parents and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,thumbnailLink,webContentLink)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`;
    const data = await this.request(url);
    return data.files.map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      thumbnailUrl: f.thumbnailLink,
      downloadUrl: f.webContentLink
    }));
  }

  async downloadFile(fileId: string): Promise<Blob> {
    const token = this.getAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Error al descargar de Drive: ${response.statusText}`);
    }

    return response.blob();
  }

  async findFilesByName(folderId: string, fileName: string): Promise<StorageFile[]> {
    const query = `'${folderId}' in parents and name='${fileName.replace(/'/g, "\\'")}' and trashed=false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType)&supportsAllDrives=true&includeItemsFromAllDrives=true&corpora=allDrives`;
    const data = await this.request(url);
    return data.files.map((f: any) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType
    }));
  }

  async deleteFile(fileId: string): Promise<void> {
    const token = this.getAccessToken();
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );

    if (response.status !== 204 && response.status !== 404 && !response.ok) {
      throw new Error(`Error al eliminar en Drive: ${response.statusText}`);
    }
  }

  async uploadFile(blob: Blob, fileName: string, folderId: string): Promise<StorageFile> {
    const token = this.getAccessToken();
    
    // Simplificación: Para este refactor inicial, solo implementamos la creación.
    // La lógica de sobreescritura (find + update) se puede mover al StorageManager 
    // o mantenerse aquí si es específica de Drive.
    
    const metadata = {
      name: fileName,
      parents: [folderId],
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: { message: response.statusText } }));
      throw new Error(error.error?.message || `Error al subir a Drive: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      id: data.id,
      name: data.name,
      mimeType: data.mimeType
    };
  }
}

const provider_id = 'google-drive';
export const googleDriveProvider = new GoogleDriveProvider();
