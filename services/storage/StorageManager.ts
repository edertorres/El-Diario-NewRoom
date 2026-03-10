
import { StorageFile, StorageFolder, StorageProvider } from './types';
import { googleDriveProvider } from './GoogleDriveProvider';
import { nextcloudProvider } from './NextcloudProvider';

class StorageManager {
  private providers: StorageProvider[] = [];
  private activeProviderId: string | null = null;

  constructor() {
    // Registrar proveedores conocidos
    this.registerProvider(googleDriveProvider);
    this.registerProvider(nextcloudProvider);

    // Cargar proveedor activo desde localStorage o usar Google Drive por defecto
    const storedMode = localStorage.getItem('storage_active_provider');
    this.activeProviderId = storedMode || 'google-drive';
  }

  registerProvider(provider: StorageProvider) {
    this.providers.push(provider);
  }

  setActiveProvider(id: string) {
    const provider = this.providers.find(p => p.id === id);
    if (!provider) throw new Error(`Proveedor ${id} no encontrado`);
    this.activeProviderId = id;
    localStorage.setItem('storage_active_provider', id);
  }

  get activeProvider(): StorageProvider {
    const provider = this.providers.find(p => p.id === this.activeProviderId);
    if (!provider) {
      // Fallback a Google Drive si el activo no está disponible
      return googleDriveProvider;
    }
    return provider;
  }

  // Fachada agnóstica al proveedor
  async listFolders(parentFolderId: string): Promise<StorageFolder[]> {
    return this.activeProvider.listFolders(parentFolderId);
  }

  async listFiles(folderId: string): Promise<StorageFile[]> {
    return this.activeProvider.listFiles(folderId);
  }

  async downloadFile(fileId: string): Promise<Blob> {
    try {
      return await this.activeProvider.downloadFile(fileId);
    } catch (error) {
      console.warn(`Error en proveedor activo ${this.activeProvider.id}, intentando fallback...`);
      if (this.activeProvider.id !== 'google-drive' && googleDriveProvider.isAuthenticated()) {
        return await googleDriveProvider.downloadFile(fileId);
      }
      throw error;
    }
  }

  async uploadFile(blob: Blob, fileName: string, folderId: string): Promise<StorageFile> {
    // Lógica de sobreescritura universal: buscar y eliminar duplicados antes de subir
    try {
      const existingFiles = await this.findFilesByName(folderId, fileName);
      if (existingFiles.length > 0) {
        console.log(`[Storage Manager] Encontrados ${existingFiles.length} duplicados para ${fileName}. Eliminando...`);
        for (const file of existingFiles) {
          await this.deleteFile(file.id);
        }
      }
    } catch (error) {
      console.warn(`[Storage Manager] Error al buscar/eliminar duplicados:`, error);
    }

    return this.activeProvider.uploadFile(blob, fileName, folderId);
  }

  async deleteFile(fileId: string): Promise<void> {
    return this.activeProvider.deleteFile(fileId);
  }

  async findFilesByName(folderId: string, fileName: string): Promise<StorageFile[]> {
    return this.activeProvider.findFilesByName(folderId, fileName);
  }
}

export const storageManager = new StorageManager();
