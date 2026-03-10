
export interface IDMLCharacterRange {
  appliedStyle: string;
  content: string;
  attributes?: Record<string, string>;
  originalNode?: Element;  // Nodo XML original para preservar estructura completa (bullets, etc)
}

export interface IDMLParagraph {
  appliedStyle: string;
  characterRanges: IDMLCharacterRange[];
  overrides?: Record<string, string>;
}

export interface IDMLPage {
  id: string;
  offsetX: number;
  offsetY: number;
}

export interface IDMLStory {
  id: string;
  name: string;
  content: string;
  originalXml: string;
  isModified?: boolean;
  initialWordCount?: number;
  initialCharCount?: number;
  scriptLabel?: string;
  paragraphs?: IDMLParagraph[];
}

export interface IDMLFrame {
  id: string;
  bounds: [number, number, number, number];
  scriptLabel?: string;
  matrix?: number[];
  rotation?: number;
  fillColor?: string;
  strokeColor?: string;
  strokeWeight?: number;
  width?: number;
  height?: number;
  scaleX?: number;
  scaleY?: number;
  pageId?: string;
  path?: { x: number, y: number }[];
  styles?: Record<string, string>;
  attributes?: Record<string, string>;
}

export interface TextFrame extends IDMLFrame {
  storyId: string;
  columnCount?: number;
  columnGutter?: number;
}

export interface ImageFrame extends IDMLFrame {
  currentLinkUri?: string;
  parentSpreadId: string;
  fileName?: string;
  isModified?: boolean;
}

export interface GenericFrame extends IDMLFrame {
  contentType: 'rectangle' | 'oval' | 'polygon' | 'graphicline';
}

export interface IDMLSpread {
  id: string;
  name: string;
  frames: TextFrame[];
  imageFrames: ImageFrame[];
  genericFrames: GenericFrame[];
  pages: IDMLPage[];
  width?: number;
  height?: number;
  type?: 'spread' | 'master';
  originalXml: string;
}

export enum AppMode {
  UPLOAD = 'UPLOAD',
  MAPPING = 'MAPPING'
}

export interface DriveFolder {
  id: string;
  name: string;
}

export interface Template {
  id: string;
  name: string;
  category: string;
  idmlFileId: string;
  previewFileId: string;
  previewUrl?: string;
  previewType?: 'image' | 'pdf';
}

export interface UploadedImage {
  file: File;
  customName: string;
  id: string;
  preview?: string;
}

export interface DriveConfig {
  templatesFolderId: string;
  destinationRootFolderId: string;
}

export interface NextcloudConfig {
  url: string;
  clientId?: string;
  clientSecret?: string;
  templatesFolderId: string;
  templatesPath?: string;
  destinationRootFolderId: string;
  destinationRootPath?: string;
}

export interface AppConfig {
  storageMode: 'google' | 'nextcloud' | 'both';
  google?: DriveConfig;
  nextcloud?: NextcloudConfig;
}

declare global {
  interface Window {
    JSZip: any;
  }
}
