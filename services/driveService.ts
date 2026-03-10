/**
 * Servicio de configuración de almacenamiento
 * Maneja la configuración de carpetas para Google Drive y Nextcloud
 */

import { DriveConfig, NextcloudConfig, AppConfig } from '../types';

export const getAppConfig = (): AppConfig => {
  const storageMode = (import.meta.env.VITE_STORAGE_MODE as any) || 'google';

  const google: DriveConfig | undefined = (import.meta.env.VITE_DRIVE_TEMPLATES_FOLDER_ID && import.meta.env.VITE_DRIVE_DESTINATION_FOLDER_ID)
    ? {
      templatesFolderId: import.meta.env.VITE_DRIVE_TEMPLATES_FOLDER_ID,
      destinationRootFolderId: import.meta.env.VITE_DRIVE_DESTINATION_FOLDER_ID,
    }
    : undefined;

  // Intentar cargar configuración de Nextcloud desde env o localStorage
  let nextcloudConfig = {
    url: import.meta.env.VITE_NEXTCLOUD_URL || '',
    clientId: import.meta.env.VITE_NEXTCLOUD_CLIENT_ID || '',
    clientSecret: import.meta.env.VITE_NEXTCLOUD_CLIENT_SECRET || '',
    templatesFolderId: import.meta.env.VITE_NEXTCLOUD_TEMPLATES_FOLDER_ID || '',
    templatesPath: import.meta.env.VITE_NEXTCLOUD_TEMPLATES_PATH || '',
    destinationRootFolderId: import.meta.env.VITE_NEXTCLOUD_DESTINATION_FOLDER_ID || '',
    destinationRootPath: import.meta.env.VITE_NEXTCLOUD_DESTINATION_PATH || '',
  };

  const stored = localStorage.getItem('nextcloud_config');
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.url) nextcloudConfig.url = parsed.url;
      // Note: templatesFolderId and destinationRootFolderId might still come from env
      // or we could allow them to be stored in localStorage too if we add UI for it later.
    } catch (e) { }
  }

  const nextcloud: NextcloudConfig | undefined = (nextcloudConfig.url)
    ? {
      url: nextcloudConfig.url,
      clientId: nextcloudConfig.clientId,
      clientSecret: nextcloudConfig.clientSecret,
      templatesFolderId: nextcloudConfig.templatesFolderId,
      templatesPath: nextcloudConfig.templatesPath,
      destinationRootFolderId: nextcloudConfig.destinationRootFolderId,
      destinationRootPath: nextcloudConfig.destinationRootPath,
    }
    : undefined;

  return {
    storageMode,
    google,
    nextcloud,
  };
};

// Mantener compatibilidad con código existente
export const getDriveConfig = (): DriveConfig | null => {
  const config = getAppConfig();
  return config.google || null;
};

export const getActiveStorageConfig = () => {
  const config = getAppConfig();
  const activeId = localStorage.getItem('storage_active_provider') || 'google-drive';
  return activeId === 'nextcloud' ? config.nextcloud : config.google;
};

export const isDriveConfigured = (): boolean => {
  return getDriveConfig() !== null;
};
