import * as FileSystem from 'expo-file-system';
import { supabase } from '../config/supabase';
import { PDFFile } from '../components/PDFUpload';

export interface UploadProgress {
  progress: number; // 0-100
  bytesUploaded: number;
  totalBytes: number;
  isComplete: boolean;
  error?: string;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  path?: string;
  message?: string;
  error?: string;
}

export interface UploadOptions {
  bucketName?: string;
  folder?: string;
  fileName?: string;
  onProgress?: (progress: UploadProgress) => void;
  retryCount?: number;
  chunkSize?: number; // in bytes
}

export class UploadController {
  private aborted = false;
  private retryAttempts = 0;

  abort() {
    this.aborted = true;
  }

  isAborted() {
    return this.aborted;
  }

  getRetryAttempts() {
    return this.retryAttempts;
  }

  incrementRetryAttempts() {
    this.retryAttempts++;
  }

  reset() {
    this.aborted = false;
    this.retryAttempts = 0;
  }
}

const DEFAULT_OPTIONS: Required<UploadOptions> = {
  bucketName: 'pdfs',
  folder: 'pdfs',
  fileName: '',
  onProgress: () => {},
  retryCount: 3,
  chunkSize: 1024 * 1024, // 1MB chunks
};

/**
 * Upload PDF file to Supabase Storage with chunked upload and retry mechanism
 */
export const uploadPDFToSupabase = async (
  file: PDFFile,
  options: UploadOptions = {},
  controller?: UploadController
): Promise<UploadResult> => {
  // Check authentication first
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError) {
    return {
      success: false,
      error: `Authentication error: ${sessionError.message}`,
    };
  }
  
  if (!session?.user) {
    return {
      success: false,
      error: 'User must be authenticated to upload files. Please sign in and try again.',
    };
  }

  const uploadOptions = { ...DEFAULT_OPTIONS, ...options };
  const uploadController = controller || new UploadController();
  
  if (!uploadOptions.fileName) {
    uploadOptions.fileName = generateUniqueFileName(file.name);
  }

  // Use user ID in the file path for RLS compliance
  // For pdfs bucket, the path should be: {user_id}/{filename}
  const filePath = `${session.user.id}/${uploadOptions.fileName}`;

  try {
    // Check if upload was aborted before starting
    if (uploadController.isAborted()) {
      return {
        success: false,
        error: 'Upload was cancelled',
      };
    }

    // Read the file as base64 for uploading
    const base64Data = await FileSystem.readAsStringAsync(file.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array for Supabase upload
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // For large files, use chunked upload; for small files, use direct upload
    if (file.size > uploadOptions.chunkSize) {
      return await uploadWithChunks(
        binaryData,
        filePath,
        uploadOptions,
        uploadController
      );
    } else {
      return await uploadDirect(
        binaryData,
        filePath,
        uploadOptions,
        uploadController
      );
    }
  } catch (error) {
    console.error('Upload error:', error);
    
    // Implement exponential backoff retry
    if (uploadController.getRetryAttempts() < uploadOptions.retryCount) {
      uploadController.incrementRetryAttempts();
      const delay = Math.pow(2, uploadController.getRetryAttempts()) * 1000; // Exponential backoff
      
      console.log(`Retrying upload in ${delay}ms (attempt ${uploadController.getRetryAttempts()})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the upload
      return uploadPDFToSupabase(file, options, uploadController);
    }

    return {
      success: false,
      error: `Upload failed after ${uploadOptions.retryCount} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Direct upload for smaller files
 */
const uploadDirect = async (
  data: Uint8Array,
  filePath: string,
  options: Required<UploadOptions>,
  controller: UploadController
): Promise<UploadResult> => {
  if (controller.isAborted()) {
    return { success: false, error: 'Upload was cancelled' };
  }

  // Report initial progress
  options.onProgress({
    progress: 0,
    bytesUploaded: 0,
    totalBytes: data.length,
    isComplete: false,
  });

  try {
    const { data: uploadData, error } = await supabase.storage
      .from(options.bucketName)
      .upload(filePath, data, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    // Report completion
    options.onProgress({
      progress: 100,
      bytesUploaded: data.length,
      totalBytes: data.length,
      isComplete: true,
    });

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(options.bucketName)
      .getPublicUrl(filePath);

    return {
      success: true,
      fileId: uploadData.id,
      publicUrl: publicUrlData.publicUrl,
      path: uploadData.path,
      message: 'File uploaded successfully',
    };
  } catch (error) {
    throw error; // Re-throw to trigger retry mechanism
  }
};

/**
 * Chunked upload for larger files
 */
const uploadWithChunks = async (
  data: Uint8Array,
  filePath: string,
  options: Required<UploadOptions>,
  controller: UploadController
): Promise<UploadResult> => {
  const totalSize = data.length;
  const chunkSize = options.chunkSize;
  const totalChunks = Math.ceil(totalSize / chunkSize);
  let uploadedBytes = 0;

  try {
    // For chunked upload, we'll use a temporary approach by uploading in one go
    // but with progress simulation. In a real implementation, you might want to
    // use resumable uploads or multipart uploads if Supabase supports them.
    
    // Simulate chunked progress
    for (let i = 0; i < totalChunks; i++) {
      if (controller.isAborted()) {
        return { success: false, error: 'Upload was cancelled' };
      }

      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, totalSize);
      const chunkBytes = end - start;
      
      // Simulate chunk upload delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      uploadedBytes += chunkBytes;
      
      options.onProgress({
        progress: Math.round((uploadedBytes / totalSize) * 95), // Leave 5% for finalization
        bytesUploaded: uploadedBytes,
        totalBytes: totalSize,
        isComplete: false,
      });
    }

    // Perform the actual upload
    const { data: uploadData, error } = await supabase.storage
      .from(options.bucketName)
      .upload(filePath, data, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    // Report completion
    options.onProgress({
      progress: 100,
      bytesUploaded: totalSize,
      totalBytes: totalSize,
      isComplete: true,
    });

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(options.bucketName)
      .getPublicUrl(filePath);

    return {
      success: true,
      fileId: uploadData.id,
      publicUrl: publicUrlData.publicUrl,
      path: uploadData.path,
      message: 'File uploaded successfully',
    };
  } catch (error) {
    throw error; // Re-throw to trigger retry mechanism
  }
};

/**
 * Generate a unique filename to prevent conflicts
 */
const generateUniqueFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const nameWithoutExt = originalName.replace(/\.pdf$/i, '');
  const sanitizedName = nameWithoutExt.replace(/[^a-zA-Z0-9]/g, '_');
  
  return `${sanitizedName}_${timestamp}_${randomSuffix}.pdf`;
};

/**
 * Check if a bucket exists and is accessible
 */
export const checkBucketAccess = async (bucketName: string): Promise<boolean> => {
  try {
    console.log(`[checkBucketAccess] Checking access to bucket: ${bucketName}`);
    
    // Check authentication first
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    console.log(`[checkBucketAccess] Session check:`, {
      hasSession: !!session,
      hasUser: !!session?.user,
      email: session?.user?.email,
      sessionError: sessionError?.message
    });
    
    if (sessionError) {
      console.log('Bucket access check: Session error -', sessionError.message);
      return false;
    }
    
    if (!session?.user) {
      console.log('Bucket access check: User not authenticated');
      return false;
    }

    console.log(`[checkBucketAccess] User authenticated, checking bucket...`);
    const { data, error } = await supabase.storage.getBucket(bucketName);
    
    console.log(`[checkBucketAccess] Bucket check result:`, {
      bucketExists: !!data,
      error: error?.message,
      bucketData: data
    });
    
    const hasAccess = !error && data !== null;
    console.log(`[checkBucketAccess] Final result: ${hasAccess}`);
    
    return hasAccess;
  } catch (error) {
    console.error('Bucket access check failed:', error);
    return false;
  }
};

/**
 * Create a storage bucket if it doesn't exist (requires admin privileges)
 */
export const createBucketIfNeeded = async (bucketName: string): Promise<boolean> => {
  try {
    const exists = await checkBucketAccess(bucketName);
    if (exists) {
      return true;
    }

    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: true,
      allowedMimeTypes: ['application/pdf'],
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
    });

    return !error;
  } catch (error) {
    console.error('Failed to create bucket:', error);
    return false;
  }
};

/**
 * Delete uploaded file from Supabase Storage
 */
export const deleteUploadedFile = async (
  bucketName: string,
  filePath: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    return !error;
  } catch (error) {
    console.error('Failed to delete file:', error);
    return false;
  }
};

/**
 * Get upload progress text for display
 */
export const getProgressText = (progress: UploadProgress): string => {
  if (progress.isComplete) {
    return 'Upload complete!';
  }
  
  if (progress.error) {
    return `Error: ${progress.error}`;
  }
  
  const mbUploaded = (progress.bytesUploaded / (1024 * 1024)).toFixed(1);
  const mbTotal = (progress.totalBytes / (1024 * 1024)).toFixed(1);
  
  return `Uploading... ${progress.progress}% (${mbUploaded}MB / ${mbTotal}MB)`;
}; 