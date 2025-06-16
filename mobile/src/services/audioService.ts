import * as FileSystem from 'expo-file-system';
import { Audio } from 'expo-av';
import { supabase } from '../config/supabase';

export interface AudioFile {
  uri: string;
  name: string;
  size: number;
  duration: number;
  mimeType: string;
}

export interface AudioUploadProgress {
  progress: number; // 0-100
  bytesUploaded: number;
  totalBytes: number;
  isComplete: boolean;
  error?: string;
  stage: 'processing' | 'compressing' | 'uploading';
}

export interface AudioUploadResult {
  success: boolean;
  fileId?: string;
  publicUrl?: string;
  path?: string;
  audioFile?: AudioFile;
  message?: string;
  error?: string;
}

export interface AudioUploadOptions {
  bucketName?: string;
  folder?: string;
  fileName?: string;
  compressionQuality?: 'low' | 'medium' | 'high';
  onProgress?: (progress: AudioUploadProgress) => void;
  retryCount?: number;
  maxFileSizeBytes?: number;
}

export class AudioUploadController {
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

const DEFAULT_AUDIO_OPTIONS: Required<AudioUploadOptions> = {
  bucketName: 'audio-recordings',
  folder: 'lectures',
  fileName: '',
  compressionQuality: 'medium',
  onProgress: () => {},
  retryCount: 3,
  maxFileSizeBytes: 50 * 1024 * 1024, // 50MB max
};

/**
 * Get audio file information
 */
export const getAudioFileInfo = async (uri: string): Promise<AudioFile | null> => {
  try {
    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('Audio file does not exist');
    }

    // Get audio duration using expo-av
    const { sound } = await Audio.Sound.createAsync(
      { uri },
      { shouldPlay: false }
    );

    const status = await sound.getStatusAsync();
    await sound.unloadAsync();

    if (!status.isLoaded) {
      throw new Error('Could not load audio file');
    }

    const fileName = uri.split('/').pop() || 'recording.m4a';
    
    return {
      uri,
      name: fileName,
      size: fileInfo.size || 0,
      duration: status.durationMillis || 0,
      mimeType: 'audio/m4a',
    };
  } catch (error) {
    console.error('Error getting audio file info:', error);
    return null;
  }
};

/**
 * Compress audio file if needed
 */
export const compressAudioFile = async (
  audioFile: AudioFile,
  quality: 'low' | 'medium' | 'high' = 'medium',
  onProgress?: (progress: number) => void
): Promise<AudioFile> => {
  try {
    // For now, we'll skip actual compression since expo-av doesn't have built-in compression
    // In a production app, you might use FFmpeg or a similar library
    // This is a placeholder that simulates compression progress
    
    onProgress?.(0);
    
    // Simulate compression progress
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      onProgress?.((i / steps) * 100);
    }

    // For now, return the original file
    // In a real implementation, you would:
    // 1. Use FFmpeg to compress the audio
    // 2. Adjust bitrate based on quality setting
    // 3. Save compressed file to a new URI
    
    return audioFile;
  } catch (error) {
    console.error('Error compressing audio:', error);
    throw new Error('Audio compression failed');
  }
};

/**
 * Upload audio file to Supabase Storage
 */
export const uploadAudioToSupabase = async (
  audioFile: AudioFile,
  options: AudioUploadOptions = {},
  controller?: AudioUploadController
): Promise<AudioUploadResult> => {
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
      error: 'User must be authenticated to upload audio files. Please sign in and try again.',
    };
  }

  const uploadOptions = { ...DEFAULT_AUDIO_OPTIONS, ...options };
  const uploadController = controller || new AudioUploadController();
  
  if (!uploadOptions.fileName) {
    uploadOptions.fileName = generateUniqueAudioFileName(audioFile.name);
  }

  // Use user ID in the file path for RLS compliance
  const filePath = `${session.user.id}/${uploadOptions.fileName}`;

  try {
    // Check if upload was aborted before starting
    if (uploadController.isAborted()) {
      return {
        success: false,
        error: 'Upload was cancelled',
      };
    }

    // Check file size
    if (audioFile.size > uploadOptions.maxFileSizeBytes) {
      return {
        success: false,
        error: `File size (${(audioFile.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${(uploadOptions.maxFileSizeBytes / 1024 / 1024).toFixed(1)}MB)`,
      };
    }

    // Stage 1: Processing
    uploadOptions.onProgress?.({
      progress: 0,
      bytesUploaded: 0,
      totalBytes: audioFile.size,
      isComplete: false,
      stage: 'processing',
    });

    // Stage 2: Compression
    uploadOptions.onProgress?.({
      progress: 10,
      bytesUploaded: 0,
      totalBytes: audioFile.size,
      isComplete: false,
      stage: 'compressing',
    });

    const compressedAudio = await compressAudioFile(
      audioFile,
      uploadOptions.compressionQuality,
      (compressionProgress) => {
        uploadOptions.onProgress?.({
          progress: 10 + (compressionProgress * 0.2), // 10% to 30%
          bytesUploaded: 0,
          totalBytes: audioFile.size,
          isComplete: false,
          stage: 'compressing',
        });
      }
    );

    if (uploadController.isAborted()) {
      return {
        success: false,
        error: 'Upload was cancelled',
      };
    }

    // Stage 3: Uploading
    uploadOptions.onProgress?.({
      progress: 30,
      bytesUploaded: 0,
      totalBytes: compressedAudio.size,
      isComplete: false,
      stage: 'uploading',
    });

    // Read the file as base64 for uploading
    const base64Data = await FileSystem.readAsStringAsync(compressedAudio.uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    // Convert base64 to Uint8Array for Supabase upload
    const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Upload progress callback
    const uploadProgressCallback = (bytesUploaded: number) => {
      const uploadProgress = (bytesUploaded / binaryData.length) * 70; // 30% to 100%
      uploadOptions.onProgress?.({
        progress: 30 + uploadProgress,
        bytesUploaded,
        totalBytes: binaryData.length,
        isComplete: false,
        stage: 'uploading',
      });
    };

    const { data: uploadData, error } = await supabase.storage
      .from(uploadOptions.bucketName)
      .upload(filePath, binaryData, {
        contentType: compressedAudio.mimeType,
        upsert: false,
      });

    if (error) {
      throw new Error(error.message);
    }

    // Report completion
    uploadOptions.onProgress?.({
      progress: 100,
      bytesUploaded: binaryData.length,
      totalBytes: binaryData.length,
      isComplete: true,
      stage: 'uploading',
    });

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from(uploadOptions.bucketName)
      .getPublicUrl(filePath);

    return {
      success: true,
      fileId: uploadData.id,
      publicUrl: publicUrlData.publicUrl,
      path: uploadData.path,
      audioFile: compressedAudio,
      message: 'Audio uploaded successfully',
    };

  } catch (error) {
    console.error('Audio upload error:', error);
    
    // Implement exponential backoff retry
    if (uploadController.getRetryAttempts() < uploadOptions.retryCount) {
      uploadController.incrementRetryAttempts();
      const delay = Math.pow(2, uploadController.getRetryAttempts()) * 1000; // Exponential backoff
      
      console.log(`Retrying audio upload in ${delay}ms (attempt ${uploadController.getRetryAttempts()})`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // Retry the upload
      return uploadAudioToSupabase(audioFile, options, uploadController);
    }

    return {
      success: false,
      error: `Audio upload failed after ${uploadOptions.retryCount} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
};

/**
 * Generate unique filename for audio files
 */
const generateUniqueAudioFileName = (originalName: string): string => {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 8);
  const extension = originalName.split('.').pop() || 'm4a';
  const baseName = originalName.replace(/\.[^/.]+$/, '');
  const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
  
  return `${sanitizedBaseName}_${timestamp}_${randomSuffix}.${extension}`;
};

/**
 * Check if audio bucket exists and is accessible
 */
export const checkAudioBucketAccess = async (bucketName: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.storage.from(bucketName).list('', {
      limit: 1,
    });

    if (error) {
      console.error('Error checking audio bucket access:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error checking audio bucket access:', error);
    return false;
  }
};

/**
 * Create audio bucket if needed
 */
export const createAudioBucketIfNeeded = async (bucketName: string): Promise<boolean> => {
  try {
    // First check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (bucketExists) {
      return true;
    }

    // Create bucket if it doesn't exist
    const { error: createError } = await supabase.storage.createBucket(bucketName, {
      public: false, // Audio files should be private
    });

    if (createError) {
      console.error('Error creating audio bucket:', createError);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error creating audio bucket:', error);
    return false;
  }
};

/**
 * Delete uploaded audio file
 */
export const deleteUploadedAudioFile = async (
  bucketName: string,
  filePath: string
): Promise<boolean> => {
  try {
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);

    if (error) {
      console.error('Error deleting audio file:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting audio file:', error);
    return false;
  }
};

/**
 * Get human-readable progress text for audio upload
 */
export const getAudioProgressText = (progress: AudioUploadProgress): string => {
  const { stage, progress: percent, bytesUploaded, totalBytes } = progress;
  
  switch (stage) {
    case 'processing':
      return 'Processing audio file...';
    case 'compressing':
      return `Compressing audio (${Math.round(percent)}%)...`;
    case 'uploading':
      const mbUploaded = (bytesUploaded / 1024 / 1024).toFixed(1);
      const mbTotal = (totalBytes / 1024 / 1024).toFixed(1);
      return `Uploading (${Math.round(percent)}%) - ${mbUploaded}MB / ${mbTotal}MB`;
    default:
      return `Processing (${Math.round(percent)}%)...`;
  }
}; 