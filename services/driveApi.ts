/**
 * Servicio unificado para interactuar con el almacenamiento (Google Drive o Nextcloud)
 * Actúa como un bridge hacia el StorageManager
 */

import { storageManager } from './storage/StorageManager';
import { Template, DriveFolder } from '../types';
import { StorageFile } from './storage/types';

export const listFolders = async (folderId: string): Promise<DriveFolder[]> => {
  const folders = await storageManager.listFolders(folderId);
  return folders.map(f => ({ id: f.id, name: f.name }));
};

export const listFilesInFolder = async (folderId: string): Promise<any[]> => {
  return storageManager.listFiles(folderId);
};

export const findFilesByName = async (folderId: string, fileName: string): Promise<any[]> => {
  return storageManager.findFilesByName(folderId, fileName);
};

export const listTemplatesInFolder = async (folderId: string): Promise<Template[]> => {
  const allFiles = await storageManager.listFiles(folderId);

  // Filtrar archivos IDML
  const idmlFiles = allFiles.filter((file: StorageFile) =>
    file.name.toLowerCase().endsWith('.idml')
  );

  // Filtrar archivos de imagen (JPG, PNG, WebP)
  const imageFiles = allFiles.filter((file: StorageFile) => {
    const fileName = file.name.toLowerCase();
    const mime = file.mimeType.toLowerCase();
    return (
      (fileName.endsWith('.jpg') ||
        fileName.endsWith('.jpeg') ||
        fileName.endsWith('.png') ||
        fileName.endsWith('.webp')) &&
      mime.startsWith('image/')
    );
  });

  // Filtrar archivos PDF
  const pdfFiles = allFiles.filter((file: StorageFile) => {
    const fileName = file.name.toLowerCase();
    const mime = file.mimeType.toLowerCase();
    return (
      fileName.endsWith('.pdf') &&
      mime === 'application/pdf'
    );
  });

  const templates: Template[] = [];

  for (const idmlFile of idmlFiles) {
    const baseName = idmlFile.name.replace(/\.idml$/i, '');
    let previewFile: StorageFile | undefined;
    let previewType: 'image' | 'pdf' | undefined;

    previewFile = imageFiles.find((file: StorageFile) => {
      const fileName = file.name.toLowerCase();
      const baseNameLower = baseName.toLowerCase();
      return (
        fileName === `${baseNameLower}.webp` ||
        fileName === `${baseNameLower}.jpg` ||
        fileName === `${baseNameLower}.jpeg` ||
        fileName === `${baseNameLower}.png`
      );
    });

    if (previewFile) {
      previewType = 'image';
    } else {
      previewFile = pdfFiles.find((file: StorageFile) => {
        const fileName = file.name.toLowerCase();
        const baseNameLower = baseName.toLowerCase();
        return fileName === `${baseNameLower}.pdf`;
      });
      if (previewFile) {
        previewType = 'pdf';
      }
    }

    if (previewFile && previewType) {
      templates.push({
        id: `${idmlFile.id}_${previewFile.id}`,
        name: baseName,
        category: 'Sin categoría',
        idmlFileId: idmlFile.id,
        previewFileId: previewFile.id,
        previewType: previewType,
      });
    } else {
      templates.push({
        id: idmlFile.id,
        name: baseName,
        category: 'Sin categoría',
        idmlFileId: idmlFile.id,
        previewFileId: idmlFile.id,
        previewType: undefined,
      });
    }
  }

  return templates;
};

export const downloadFile = async (fileId: string): Promise<Blob> => {
  return storageManager.downloadFile(fileId);
};

export const deleteFile = async (fileId: string): Promise<void> => {
  return storageManager.deleteFile(fileId);
};

export const getTemplatePreview = async (
  fileId: string,
  previewType?: 'image' | 'pdf'
): Promise<string> => {
  if (previewType === 'image') {
    const blob = await storageManager.downloadFile(fileId);
    return URL.createObjectURL(blob);
  } else if (previewType === 'pdf') {
    const blob = await storageManager.downloadFile(fileId);
    const arrayBuffer = await blob.arrayBuffer();

    let pdfjsLib = (window as any).pdfjsLib;
    if (!pdfjsLib) {
      const pdfjsModule = await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs');
      pdfjsLib = pdfjsModule;
      (window as any).pdfjsLib = pdfjsLib;
    }

    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 0.5 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No se pudo obtener contexto del canvas');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({ canvasContext: context, viewport }).promise;

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(URL.createObjectURL(blob));
        } else {
          throw new Error('Error al convertir canvas a blob');
        }
      }, 'image/png');
    });
  } else {
    throw new Error('Tipo de preview no especificado o no soportado.');
  }
};

export const uploadFile = async (blob: Blob, fileName: string, folderId: string): Promise<any> => {
  return storageManager.uploadFile(blob, fileName, folderId);
};

export const listDestinationFolders = async (rootFolderId: string): Promise<DriveFolder[]> => {
  return listFolders(rootFolderId);
};

export const listPageFolders = async (edicionFolderId: string): Promise<DriveFolder[]> => {
  return listFolders(edicionFolderId);
};

export const getFolderInfo = async (folderId: string): Promise<DriveFolder> => {
  const f = await storageManager.activeProvider.getFolderInfo(folderId);
  return { id: f.id, name: f.name };
};

export const validateFolderAccess = async (folderId: string): Promise<{ success: boolean; error?: string }> => {
  try {
    await getFolderInfo(folderId);
    return { success: true };
  } catch (err: any) {
    console.error(`Error de acceso a carpeta (${folderId}):`, err);
    return { success: false, error: err.message };
  }
};
