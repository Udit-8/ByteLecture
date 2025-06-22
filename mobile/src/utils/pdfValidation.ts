import * as FileSystem from 'expo-file-system';
import { PDFFile } from '../components/PDFUpload';

export interface PDFValidationResult {
  isValid: boolean;
  error?: string;
  metadata?: {
    pages?: number;
    title?: string;
    author?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
    hasText?: boolean;
    encrypted?: boolean;
    fileSize?: number;
  };
}

export interface ValidationOptions {
  maxFileSize?: number; // in MB
  minPages?: number;
  maxPages?: number;
  requireText?: boolean;
  allowEncrypted?: boolean;
}

const DEFAULT_OPTIONS: ValidationOptions = {
  maxFileSize: 10, // 10MB
  minPages: 1,
  maxPages: 500,
  requireText: false,
  allowEncrypted: false,
};

/**
 * Comprehensive PDF file validation
 */
export const validatePDFFile = async (
  file: PDFFile,
  options: ValidationOptions = {}
): Promise<PDFValidationResult> => {
  const validationOptions = { ...DEFAULT_OPTIONS, ...options };

  try {
    // Basic file validation
    const basicValidation = validateBasicFile(file, validationOptions);
    if (!basicValidation.isValid) {
      return basicValidation;
    }

    // Check if file exists and is readable
    const fileInfo = await FileSystem.getInfoAsync(file.uri);
    if (!fileInfo.exists) {
      return {
        isValid: false,
        error: 'File does not exist or is not accessible',
      };
    }

    // Validate file content structure
    const structureValidation = await validatePDFStructure(
      file,
      validationOptions
    );
    if (!structureValidation.isValid) {
      return structureValidation;
    }

    return {
      isValid: true,
      metadata: structureValidation.metadata,
    };
  } catch (error) {
    console.error('PDF validation error:', error);
    return {
      isValid: false,
      error: 'Failed to validate PDF file. The file may be corrupted.',
    };
  }
};

/**
 * Basic file validation (type, size, name)
 */
export const validateBasicFile = (
  file: PDFFile,
  options: ValidationOptions
): PDFValidationResult => {
  // Check file extension
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    return {
      isValid: false,
      error: 'File must have a .pdf extension',
    };
  }

  // Check MIME type
  if (file.type && !file.type.includes('pdf')) {
    return {
      isValid: false,
      error: 'File must be a PDF document',
    };
  }

  // Check file size
  const fileSizeMB = file.size / (1024 * 1024);
  if (options.maxFileSize && fileSizeMB > options.maxFileSize) {
    return {
      isValid: false,
      error: `File size (${fileSizeMB.toFixed(1)}MB) exceeds maximum allowed size (${options.maxFileSize}MB)`,
    };
  }

  // Check minimum file size (avoid empty or corrupted files)
  if (file.size < 1024) {
    // Less than 1KB
    return {
      isValid: false,
      error: 'File appears to be empty or corrupted (too small)',
    };
  }

  return { isValid: true };
};

/**
 * PDF structure and content validation using basic file reading
 */
const validatePDFStructure = async (
  file: PDFFile,
  options: ValidationOptions
): Promise<PDFValidationResult> => {
  try {
    // Read the first few bytes to check PDF header
    const base64Content = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to check PDF header
    const binaryString = atob(base64Content.substring(0, 100));

    // Check PDF header (%PDF-)
    if (!binaryString.startsWith('%PDF-')) {
      return {
        isValid: false,
        error: 'File does not appear to be a valid PDF (missing PDF header)',
      };
    }

    // Extract PDF version
    const versionMatch = binaryString.match(/%PDF-(\d\.\d)/);
    const version = versionMatch ? versionMatch[1] : 'unknown';

    // Basic metadata extraction (simplified)
    const metadata = {
      fileSize: file.size,
      version,
      hasText: true, // We'll assume true for now
      encrypted: false, // We'll detect this more thoroughly later
    };

    // Check for encryption markers in the content
    if (
      binaryString.includes('/Encrypt') ||
      binaryString.includes('/Filter/Standard')
    ) {
      if (!options.allowEncrypted) {
        return {
          isValid: false,
          error: 'Password-protected PDFs are not supported',
        };
      }
      metadata.encrypted = true;
    }

    return {
      isValid: true,
      metadata,
    };
  } catch (error) {
    console.error('PDF structure validation error:', error);
    return {
      isValid: false,
      error: 'Unable to read PDF file structure. File may be corrupted.',
    };
  }
};

/**
 * Quick file type validation for immediate feedback
 */
export const quickValidateFileType = (
  fileName: string,
  mimeType?: string
): boolean => {
  const hasValidExtension = fileName.toLowerCase().endsWith('.pdf');
  const hasValidMimeType = !mimeType || mimeType.includes('pdf');
  return hasValidExtension && hasValidMimeType;
};

/**
 * Format file size for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

/**
 * Get human-readable validation error messages
 */
export const getValidationErrorMessage = (error: string): string => {
  const errorMessages: Record<string, string> = {
    'File must have a .pdf extension': '📄 Please select a PDF file',
    'File must be a PDF document': '📄 Only PDF documents are supported',
    'Password-protected PDFs are not supported':
      '🔒 Password-protected PDFs cannot be processed',
    'File does not exist or is not accessible':
      '❌ Unable to access the selected file',
    'File appears to be empty or corrupted (too small)':
      '⚠️ The file appears to be empty or corrupted',
  };

  // Check for file size errors
  if (error.includes('exceeds maximum allowed size')) {
    return '📏 ' + error;
  }

  // Check for PDF header errors
  if (error.includes('missing PDF header')) {
    return '📄 The file is not a valid PDF document';
  }

  // Check for structure errors
  if (error.includes('corrupted')) {
    return '💥 The PDF file appears to be corrupted';
  }

  return errorMessages[error] || '❌ ' + error;
};
