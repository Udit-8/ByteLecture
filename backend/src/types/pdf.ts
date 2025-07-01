export interface PDFProcessingResult {
  success: boolean;
  documentId?: string;
  extractedText?: string;
  pageCount?: number;
  fileSize?: number;
  processingTime?: number;
  metadata?: PDFMetadata;
  smartTitle?: string; // AI-generated or enhanced title
  error?: string;
}

export interface PDFMetadata {
  title?: string;
  author?: string;
  subject?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  keywords?: string[];
  pageCount: number;
  fileSize: number;
}

export interface ProcessedPDFContent {
  id?: string;
  originalFileName: string;
  filePath: string;
  publicUrl: string;
  extractedText: string;
  cleanedText: string;
  sections: PDFSection[];
  metadata: PDFMetadata;
  thumbnailUrl?: string;
  processingStatus: ProcessingStatus;
  processingError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface PDFSection {
  id: string;
  title?: string;
  content: string;
  pageNumber: number;
  startPosition: number;
  endPosition: number;
  type: SectionType;
}

export type SectionType =
  | 'header'
  | 'paragraph'
  | 'list'
  | 'table'
  | 'footer'
  | 'title'
  | 'subtitle';

export type ProcessingStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface PDFProcessingOptions {
  extractImages?: boolean;
  generateThumbnail?: boolean;
  cleanText?: boolean;
  detectSections?: boolean;
  removeHeaders?: boolean;
  removeFooters?: boolean;
  preserveFormatting?: boolean;
}

export interface TextCleaningOptions {
  removeExtraWhitespace: boolean;
  removeHeaders: boolean;
  removeFooters: boolean;
  normalizeLineBreaks: boolean;
  removePageNumbers: boolean;
  preserveBulletPoints: boolean;
}

export interface PDFUploadNotification {
  bucketId: string;
  name: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  record: {
    id: string;
    name: string;
    bucket_id: string;
    owner: string;
    created_at: string;
    updated_at: string;
    last_accessed_at: string;
    metadata: Record<string, any>;
  };
}
