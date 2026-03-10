
export interface StorageFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  thumbnailUrl?: string;
  downloadUrl?: string;
}

export interface StorageFolder {
  id: string;
  name: string;
  parentId?: string;
}

export interface StorageProvider {
  id: string;
  name: string;
  
  // Gestión de carpetas
  listFolders(parentFolderId: string): Promise<StorageFolder[]>;
  getFolderInfo(folderId: string): Promise<StorageFolder>;
  
  // Gestión de archivos
  listFiles(folderId: string): Promise<StorageFile[]>;
  downloadFile(fileId: string): Promise<Blob>;
  uploadFile(file: Blob, fileName: string, folderId: string): Promise<StorageFile>;
  deleteFile(fileId: string): Promise<void>;
  findFilesByName(folderId: string, fileName: string): Promise<StorageFile[]>;
  
  // Autenticación y estado
  isAuthenticated(): boolean;
  getAuthHeader(): string | null;
}
