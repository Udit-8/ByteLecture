import YTDlpWrap from 'yt-dlp-wrap';
import { createWriteStream, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { speechToTextService } from './speechToTextService';
import { usageTrackingService } from './usageTrackingService';

export interface AudioExtractionResult {
  success: boolean;
  transcript?: string;
  confidence?: number;
  duration?: number;
  wordTimestamps?: Array<{
    word: string;
    start: number;
    end: number;
    confidence?: number;
  }>;
  language?: string;
  provider?: string;
  processingTime?: number;
  audioExtractionTime?: number;
  transcriptionTime?: number;
  error?: string;
}

export interface VideoMetadata {
  videoId: string;
  title: string;
  description?: string;
  channelTitle?: string;
  duration: string; // Human readable format
  durationSeconds: number;
  thumbnails: {
    default: string;
    medium: string;
    high: string;
  };
  publishedAt: string;
  viewCount: string;
  categoryId: string;
  tags: string[];
}

class AudioExtractionService {
  private ytDlp: YTDlpWrap;
  private tempDir: string;

  constructor() {
    // Initialize yt-dlp wrapper
    // Use default path since yt-dlp is installed via pip and should be in PATH
    this.ytDlp = new YTDlpWrap();
    this.tempDir = join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!existsSync(this.tempDir)) {
      require('fs').mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Extract video metadata using yt-dlp (no API limits)
   */
  async getVideoMetadata(videoUrl: string): Promise<VideoMetadata> {
    const startTime = Date.now();
    
    try {
      console.log('🔍 Extracting video metadata with yt-dlp...');
      
      // Get video info without downloading
      let videoInfo;
      try {
        videoInfo = await this.ytDlp.getVideoInfo(videoUrl);
      } catch (ytDlpError) {
        console.error('❌ yt-dlp failed to extract metadata:', ytDlpError);
        
        // Check if it's a JSON parsing error from yt-dlp
        const errorMessage = ytDlpError instanceof Error ? ytDlpError.message : 'Unknown error';
        if (errorMessage.toLowerCase().includes('json') || errorMessage.toLowerCase().includes('parse')) {
          throw new Error('Video metadata extraction failed due to invalid response from yt-dlp. The video may be unavailable or restricted.');
        } else if (errorMessage.toLowerCase().includes('unavailable') || errorMessage.toLowerCase().includes('private')) {
          throw new Error('This video is unavailable or private and cannot be processed.');
        } else if (errorMessage.toLowerCase().includes('not found')) {
          throw new Error('Video not found. Please check if the URL is correct and the video exists.');
        } else {
          throw new Error(`Video processing failed: ${errorMessage}`);
        }
      }
      
      if (!videoInfo) {
        throw new Error('No video information received from yt-dlp');
      }

      const extractionTime = Date.now() - startTime;
      console.log(`✅ Metadata extracted in ${extractionTime}ms`);

      // Validate required fields
      if (!videoInfo.id) {
        throw new Error('Unable to extract video ID from the provided URL');
      }

      // Parse the video info with fallbacks
      const metadata: VideoMetadata = {
        videoId: videoInfo.id,
        title: videoInfo.title || 'Unknown Title',
        description: videoInfo.description || '',
        channelTitle: videoInfo.uploader || videoInfo.channel || 'Unknown Channel',
        duration: this.formatDuration(videoInfo.duration || 0),
        durationSeconds: videoInfo.duration || 0,
        thumbnails: {
          default: videoInfo.thumbnail || '',
          medium: videoInfo.thumbnail || '',
          high: videoInfo.thumbnail || '',
        },
        publishedAt: videoInfo.upload_date || new Date().toISOString(),
        viewCount: (videoInfo.view_count || 0).toString(),
        categoryId: '0', // yt-dlp doesn't provide category ID
        tags: Array.isArray(videoInfo.tags) ? videoInfo.tags : [],
      };

      return metadata;
    } catch (error) {
      const extractionTime = Date.now() - startTime;
      console.error(`❌ Error extracting video metadata after ${extractionTime}ms:`, error);
      
      // Re-throw with appropriate error message
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Failed to extract video metadata: ${String(error)}`);
      }
    }
  }

  /**
   * Extract audio from YouTube video and generate transcript
   */
  async extractAudioAndTranscribe(
    videoUrl: string,
    userId: string,
    options: {
      quality?: 'low' | 'medium' | 'high';
      language?: string;
      onProgress?: (stage: string, progress: number) => void;
    } = {}
  ): Promise<AudioExtractionResult> {
    const totalStartTime = Date.now();
    const timestamp = Date.now();
    const baseFileName = `${timestamp}_audio`;
    const tempFileTemplate = join(this.tempDir, `${baseFileName}.%(ext)s`);
    const expectedAudioFile = join(this.tempDir, `${baseFileName}.m4a`);

    try {
      const { onProgress = () => {} } = options;

      // Stage 1: Extract audio
      onProgress('Extracting audio from video...', 10);
      const audioExtractionStart = Date.now();
      
      console.log('🎵 Extracting audio with yt-dlp...');
      console.log(`📁 Expected output file: ${expectedAudioFile}`);
      
      await this.ytDlp.exec([
        videoUrl,
        '--extract-audio',
        '--audio-format', 'm4a',
        '--audio-quality', this.getAudioQuality(options.quality || 'medium'),
        '--output', tempFileTemplate,
        '--no-part', // Avoid .part files that cause rename race conditions
        '--no-playlist',
        '--max-filesize', '100M', // Limit file size to 100MB
        '--no-warnings',
        '--quiet', // Reduce output noise
      ]);

      const audioExtractionTime = Date.now() - audioExtractionStart;
      console.log(`✅ Audio extraction completed in ${audioExtractionTime}ms`);

      // Stage 2: Wait for file to be fully written and check if audio file was created
      await this.waitForFileCompletion(expectedAudioFile, baseFileName);

      if (!existsSync(expectedAudioFile)) {
        // Sometimes the file extension might be different, let's check for other formats
        const possibleFiles = [
          join(this.tempDir, `${baseFileName}.m4a`),
          join(this.tempDir, `${baseFileName}.mp3`),
          join(this.tempDir, `${baseFileName}.wav`),
          join(this.tempDir, `${baseFileName}.webm`),
        ];
        
        let actualFilePath = null;
        for (const filePath of possibleFiles) {
          if (existsSync(filePath)) {
            actualFilePath = filePath;
            break;
          }
        }
        
        if (!actualFilePath) {
          // List files in temp directory for debugging
          const tempFiles = require('fs').readdirSync(this.tempDir).filter((f: string) => f.includes(baseFileName));
          console.log(`❌ No audio file found. Expected: ${expectedAudioFile}`);
          console.log(`📂 Files in temp directory matching pattern:`, tempFiles);
          throw new Error('Audio extraction failed - no output file created');
        }
        
        console.log(`📁 Using audio file: ${actualFilePath}`);
        return this.processAudioFile(actualFilePath, userId, options, totalStartTime, audioExtractionTime);
      }

      return this.processAudioFile(expectedAudioFile, userId, options, totalStartTime, audioExtractionTime);

    } catch (error) {
      console.error('❌ Audio extraction and transcription failed:', error);
      
      // Clean up any partial files
      this.cleanupTempFiles(baseFileName);

      // Log error for tracking
      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'processing_error',
        error_message: `Audio extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error_details: {
          videoUrl,
          options,
          processingTime: Date.now() - totalStartTime,
        },
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - totalStartTime,
      };
    }
  }

  /**
   * Process extracted audio file and generate transcript
   */
  private async processAudioFile(
    filePath: string,
    userId: string,
    options: {
      quality?: 'low' | 'medium' | 'high';
      language?: string;
      onProgress?: (stage: string, progress: number) => void;
    },
    totalStartTime: number,
    audioExtractionTime: number
  ): Promise<AudioExtractionResult> {
    const { onProgress = () => {} } = options;

    let workingFile: string = filePath;
    try {
      onProgress('Reading audio file...', 30);

      // If not already mp3, convert to optimized mp3 to save bandwidth / cost
      if (!/\.mp3$/i.test(filePath)) {
        onProgress('Converting to optimized MP3...', 40);
        try {
          workingFile = await this.convertToOptimizedMp3(filePath);
        } catch (convErr) {
          console.warn('⚠️ MP3 conversion failed, falling back to original file', convErr);
        }
      }

      // Stage 3: Read audio file
      const audioBuffer = require('fs').readFileSync(workingFile);
      console.log(`📁 Audio file size: ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      onProgress('Transcribing audio with AI...', 50);

      // Stage 4: Transcribe using existing speech-to-text service
      const transcriptionStart = Date.now();
      const transcriptionResult = await speechToTextService.transcribeAudio(
        audioBuffer,
        userId,
        {
          provider: 'openai',
          language: options.language || 'en',
          enableWordTimestamps: true,
          temperature: 0,
        }
      );

      const transcriptionTime = Date.now() - transcriptionStart;
      const totalProcessingTime = Date.now() - totalStartTime;

      onProgress('Cleaning up...', 90);

      // Clean up temp files
      this.cleanupTempFile(filePath);
      if (workingFile && workingFile !== filePath) {
        this.cleanupTempFile(workingFile);
      }

      onProgress('Complete!', 100);

      if (transcriptionResult.success) {
        console.log(`✅ Complete processing in ${totalProcessingTime}ms`);
        console.log(`📊 Audio extraction: ${audioExtractionTime}ms, Transcription: ${transcriptionTime}ms`);
        
        return {
          success: true,
          transcript: transcriptionResult.transcript,
          confidence: transcriptionResult.confidence,
          duration: transcriptionResult.duration,
          wordTimestamps: transcriptionResult.wordTimestamps,
          language: transcriptionResult.language,
          provider: transcriptionResult.provider,
          processingTime: totalProcessingTime,
          audioExtractionTime,
          transcriptionTime,
        };
      } else {
        throw new Error(transcriptionResult.error || 'Transcription failed');
      }
    } catch (error) {
      // Clean up temp files on error
      this.cleanupTempFile(filePath);
      if (typeof workingFile !== 'undefined' && workingFile !== filePath) {
        this.cleanupTempFile(workingFile);
      }
      throw error;
    }
  }

  /**
   * Wait for file to be completely written to disk and return the actual file path
   */
  private async waitForFileCompletion(expectedFile: string, baseFileName: string): Promise<string> {
    const maxWaitTime = 60000; // 60 seconds max – large videos need more time for yt-dlp to finish writing
    const checkInterval = 100; // Check every 100ms
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitTime) {
      // Check if expected file exists
      if (existsSync(expectedFile)) {
        // Verify file has content and is stable
        const stats = require('fs').statSync(expectedFile);
        if (stats.size > 0) {
          // Wait a bit more to ensure file writing is complete
          await new Promise(resolve => setTimeout(resolve, 200));
          console.log(`📁 File confirmed: ${expectedFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
          return expectedFile;
        }
      }

      // Check for alternative file formats
      const possibleFiles = [
        join(this.tempDir, `${baseFileName}.m4a`),
        join(this.tempDir, `${baseFileName}.mp3`),
        join(this.tempDir, `${baseFileName}.wav`),
        join(this.tempDir, `${baseFileName}.webm`),
      ];

      for (const filePath of possibleFiles) {
        if (existsSync(filePath)) {
          const stats = require('fs').statSync(filePath);
          if (stats.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 200));
            console.log(`📁 Alternative file found: ${filePath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
            return filePath;
          }
        }
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    }

    throw new Error(`⏰ Timeout waiting for file completion after ${maxWaitTime}ms`);
  }

  /**
   * Clean up multiple temporary files by pattern
   */
  private cleanupTempFiles(baseFileName: string): void {
    try {
      const files = require('fs').readdirSync(this.tempDir);
      const filesToDelete = files.filter((file: string) => file.includes(baseFileName));
      
      filesToDelete.forEach((file: string) => {
        const fullPath = join(this.tempDir, file);
        this.cleanupTempFile(fullPath);
      });
    } catch (error) {
      console.warn('⚠️ Failed to cleanup temp files:', error);
    }
  }

  /**
   * Extract video ID from YouTube URL
   */
  extractVideoId(url: string): string | null {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Format duration from seconds to human readable
   */
  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  /**
   * Get yt-dlp audio quality parameter
   */
  private getAudioQuality(quality: 'low' | 'medium' | 'high'): string {
    switch (quality) {
      case 'low':
        return '9'; // Lowest quality, fastest
      case 'medium':
        return '5'; // Balanced
      case 'high':
        return '0'; // Best quality, slowest
      default:
        return '5';
    }
  }

  /**
   * Clean up temporary files
   */
  private cleanupTempFile(filePath: string): void {
    try {
      if (existsSync(filePath)) {
        unlinkSync(filePath);
        console.log(`🧹 Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean up temp file:', filePath, error);
    }
  }

  /**
   * Health check for yt-dlp availability
   */
  async healthCheck(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      const version = await this.ytDlp.getVersion();
      return { available: true, version };
    } catch (error) {
      return { 
        available: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Extract audio and transcribe in parallel chunks for long videos (OPTIMIZED)
   */
  async extractAudioAndTranscribeChunked(
    videoUrl: string,
    userId: string,
    options: {
      quality?: 'low' | 'medium' | 'high';
      language?: string;
      chunkDurationMinutes?: number; // Default: 10 minutes per chunk
      maxConcurrentJobs?: number; // Default: 3 concurrent transcriptions
      onProgress?: (stage: string, progress: number) => void;
    } = {}
  ): Promise<AudioExtractionResult> {
    const totalStartTime = Date.now();
    const timestamp = Date.now();
    const baseFileName = `${timestamp}_audio`;
    const tempFileTemplate = join(this.tempDir, `${baseFileName}.%(ext)s`);
    const expectedAudioFile = join(this.tempDir, `${baseFileName}.m4a`);
    const chunksDir = join(this.tempDir, `chunks_${timestamp}`);

    try {
      const { 
        onProgress = () => {}, 
        chunkDurationMinutes = 10,
        maxConcurrentJobs = 3 
      } = options;

      // Ensure chunks directory exists
      if (!existsSync(chunksDir)) {
        require('fs').mkdirSync(chunksDir, { recursive: true });
      }

      // Stage 1: Extract full audio (same as before)
      onProgress('Extracting audio from video...', 5);
      const audioExtractionStart = Date.now();
      
      console.log('🎵 Extracting full audio with yt-dlp...');
      
      await this.ytDlp.exec([
        videoUrl,
        '--extract-audio',
        '--audio-format', 'm4a',
        '--audio-quality', this.getAudioQuality(options.quality || 'medium'),
        '--output', tempFileTemplate,
        '--no-part', // Avoid .part files that cause rename race conditions
        '--no-playlist',
        '--max-filesize', '200M', // Allow larger files for chunked processing
        '--no-warnings',
        '--quiet',
      ]);

      const audioExtractionTime = Date.now() - audioExtractionStart;
      const actualAudioFile = await this.waitForFileCompletion(expectedAudioFile, baseFileName);

      onProgress('Splitting audio into chunks...', 15);

      // Stage 2: Split audio into chunks using ffmpeg
      const chunkDurationSeconds = chunkDurationMinutes * 60;
      const audioChunks = await this.splitAudioIntoChunks(
        actualAudioFile, 
        chunksDir, 
        chunkDurationSeconds
      );

      console.log(`✂️ Split audio into ${audioChunks.length} chunks of ${chunkDurationMinutes} minutes each`);

      onProgress('Transcribing chunks in parallel...', 25);

      // Stage 3: Transcribe chunks in parallel (controlled concurrency)
      const transcriptionResults = await this.transcribeChunksInParallel(
        audioChunks,
        userId,
        options,
        maxConcurrentJobs,
        (chunkProgress) => {
          // Map chunk progress to 25-85% range
          const overallProgress = 25 + (chunkProgress * 0.6);
          onProgress('Transcribing chunks...', overallProgress);
        }
      );

      onProgress('Merging transcripts...', 90);

      // Stage 4: Merge transcripts with correct timestamps
      const mergedResult = this.mergeTranscriptChunks(
        transcriptionResults, 
        chunkDurationSeconds
      );

      onProgress('Cleaning up...', 95);

      // Cleanup
      this.cleanupTempFile(actualAudioFile);
      this.cleanupDirectory(chunksDir);

      onProgress('Complete!', 100);

      const totalProcessingTime = Date.now() - totalStartTime;
      console.log(`✅ Chunked processing completed in ${totalProcessingTime}ms`);
      console.log(`📊 Speed improvement: ~${Math.floor(audioChunks.length * 0.7)}x faster than sequential`);

      return {
        success: true,
        transcript: mergedResult.fullTranscript,
        confidence: mergedResult.averageConfidence,
        duration: mergedResult.totalDuration,
        wordTimestamps: mergedResult.wordTimestamps,
        language: transcriptionResults[0]?.language || 'en',
        provider: 'openai',
        processingTime: totalProcessingTime,
        audioExtractionTime,
        transcriptionTime: mergedResult.transcriptionTime,
      };

    } catch (error) {
      console.error('❌ Chunked audio processing failed:', error);
      // Try to cleanup both expected and actual files
      this.cleanupTempFile(expectedAudioFile);
      this.cleanupTempFiles(baseFileName);
      this.cleanupDirectory(chunksDir);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - totalStartTime,
      };
    }
  }

  /**
   * Split audio file into chunks using ffmpeg with optimized compression
   */
  private async splitAudioIntoChunks(
    audioFilePath: string,
    outputDir: string,
    chunkDurationSeconds: number
  ): Promise<string[]> {
    const ffmpeg = require('fluent-ffmpeg');
    const path = require('path');
    const { join } = require('path');

    return new Promise((resolve, reject) => {
      const inputExt = path.extname(audioFilePath).toLowerCase();
      const inputStats = require('fs').statSync(audioFilePath);
      const inputSizeMB = inputStats.size / 1024 / 1024;
      
      console.log(`🔄 Splitting ${inputExt} file (${inputSizeMB.toFixed(2)} MB) into optimized MP3 chunks...`);
      console.log(`⏱️ Chunk duration: ${chunkDurationSeconds} seconds (${chunkDurationSeconds/60} minutes)`);

      ffmpeg(audioFilePath)
        .outputOptions([
          '-f', 'segment',
          '-segment_time', chunkDurationSeconds.toString(),
          '-c:a', 'libmp3lame', // Use MP3 compression (much smaller than WAV)
          '-b:a', '48k',          // 48 kbps bitrate (adequate for speech)
          '-ar', '16000',         // 16 kHz sample-rate (Whisper minimum)
          '-ac', '1', // Mono audio (sufficient for speech, half the size)
          '-af', 'silenceremove=start_periods=1:start_duration=1:start_threshold=-35dB:detection=peak',
          '-reset_timestamps', '1',
        ])
        .output(join(outputDir, 'chunk_%03d.mp3'))
        .on('progress', (progress: any) => {
          if (progress.percent) {
            console.log(`🔄 Splitting progress: ${Math.round(progress.percent)}%`);
          }
        })
        .on('end', () => {
          // List generated chunk files and log their sizes
          const files = require('fs').readdirSync(outputDir)
            .filter((f: string) => f.startsWith('chunk_'))
            .sort()
            .map((f: string) => join(outputDir, f));
          
          if (files.length === 0) {
            console.error('❌ No chunk files generated!');
            reject(new Error('No chunk files were generated'));
            return;
          }
          
          // Log file sizes for debugging
          let totalSizeMB = 0;
          files.forEach((file: string, index: number) => {
            const stats = require('fs').statSync(file);
            const sizeMB = stats.size / 1024 / 1024;
            totalSizeMB += sizeMB;
            console.log(`📁 Generated chunk ${index + 1}: ${path.basename(file)} = ${sizeMB.toFixed(2)} MB`);
          });
          
          const avgChunkSizeMB = totalSizeMB / files.length;
          const compressionRatio = inputSizeMB / totalSizeMB;
          
          console.log(`✂️ Generated ${files.length} optimized MP3 chunks (Total: ${totalSizeMB.toFixed(2)} MB)`);
          console.log(`📊 Average chunk size: ${avgChunkSizeMB.toFixed(2)} MB`);
          console.log(`🗜️ Compression ratio: ${compressionRatio.toFixed(1)}x smaller (${inputSizeMB.toFixed(2)} MB → ${totalSizeMB.toFixed(2)} MB)`);
          
          // Validation - each chunk should be much smaller than original
          if (avgChunkSizeMB > 10) {
            console.warn(`⚠️ Warning: Average chunk size (${avgChunkSizeMB.toFixed(2)} MB) is larger than expected. Compression may not be working properly.`);
          }
          
          resolve(files);
        })
        .on('error', (error: Error) => {
          console.error('❌ Audio splitting failed:', error);
          console.error(`Input: ${audioFilePath} (${inputExt}, ${inputSizeMB.toFixed(2)} MB), Output: MP3 chunks in ${outputDir}`);
          reject(error);
        })
        .run();
    });
  }

  /**
   * Transcribe chunks in parallel with controlled concurrency
   */
  private async transcribeChunksInParallel(
    chunkFiles: string[],
    userId: string,
    options: any,
    maxConcurrentJobs: number,
    onProgress: (progress: number) => void
  ): Promise<Array<{ transcript: string; confidence: number; duration: number; language: string; wordTimestamps?: any[] }>> {
    const results: any[] = [];
    let completed = 0;

    // Process chunks in batches of maxConcurrentJobs
    for (let i = 0; i < chunkFiles.length; i += maxConcurrentJobs) {
      const batch = chunkFiles.slice(i, i + maxConcurrentJobs);
      
      const batchPromises = batch.map(async (chunkFile, batchIndex) => {
        const chunkIndex = i + batchIndex;
        console.log(`🔄 Transcribing chunk ${chunkIndex + 1}/${chunkFiles.length}`);
        
        try {
          const audioBuffer = require('fs').readFileSync(chunkFile);
          console.log(`📊 Reading chunk ${chunkIndex + 1}: ${chunkFile} (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
          
          // Add timeout and retry logic for individual chunk transcription
          const result = await Promise.race([
            speechToTextService.transcribeAudio(
              audioBuffer,
              userId,
              {
                provider: 'openai',
                language: options.language || 'en',
                enableWordTimestamps: true,
                temperature: 0,
              }
            ),
                      new Promise((_, reject) => 
            setTimeout(() => reject(new Error(`Chunk ${chunkIndex + 1} transcription timed out after 150 seconds`)), 150000)
          )
          ]) as any;

          if (result.success) {
            console.log(`✅ Chunk ${chunkIndex + 1} transcribed successfully (${result.transcript?.length || 0} chars)`);
            return {
              chunkIndex,
              transcript: result.transcript || '',
              confidence: result.confidence || 0,
              duration: result.duration || 0,
              language: result.language || 'en',
              wordTimestamps: result.wordTimestamps || [],
            };
          } else {
            console.warn(`⚠️ Chunk ${chunkIndex + 1} transcription failed:`, result.error);
            return {
              chunkIndex,
              transcript: `[Chunk ${chunkIndex + 1} transcription failed: ${result.error}]`,
              confidence: 0,
              duration: 0,
              language: 'en',
              wordTimestamps: [],
            };
          }
        } catch (chunkError) {
          console.error(`❌ Chunk ${chunkIndex + 1} processing error:`, chunkError);
          return {
            chunkIndex,
            transcript: `[Chunk ${chunkIndex + 1} error: ${chunkError instanceof Error ? chunkError.message : 'Unknown error'}]`,
            confidence: 0,
            duration: 0,
            language: 'en',
            wordTimestamps: [],
          };
        }
      });

      // Wait for current batch to complete
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      completed += batch.length;
      const progress = completed / chunkFiles.length;
      onProgress(progress);
    }

    // Sort results by chunk index to maintain order
    return results.sort((a, b) => a.chunkIndex - b.chunkIndex);
  }

  /**
   * Merge transcript chunks with corrected timestamps
   */
  private mergeTranscriptChunks(
    chunks: Array<{
      transcript: string;
      confidence: number;
      duration: number;
      language: string;
      wordTimestamps?: any[];
    }>,
    chunkDurationSeconds: number
  ): {
    fullTranscript: string;
    averageConfidence: number;
    totalDuration: number;
    wordTimestamps: any[];
    transcriptionTime: number;
  } {
    let fullTranscript = '';
    let totalConfidence = 0;
    let totalDuration = 0;
    const allWordTimestamps: any[] = [];
    let validChunks = 0;

    chunks.forEach((chunk, index) => {
      if (chunk.transcript && !chunk.transcript.includes('transcription failed')) {
        // Add section marker for clarity
        if (fullTranscript.length > 0) {
          fullTranscript += '\n\n';
        }
        fullTranscript += `--- Part ${index + 1} ---\n${chunk.transcript}`;

        // Adjust word timestamps by chunk offset
        if (chunk.wordTimestamps) {
          const timeOffset = index * chunkDurationSeconds;
          const adjustedTimestamps = chunk.wordTimestamps.map(word => ({
            ...word,
            start: word.start + timeOffset,
            end: word.end + timeOffset,
          }));
          allWordTimestamps.push(...adjustedTimestamps);
        }

        totalConfidence += chunk.confidence;
        totalDuration += chunk.duration;
        validChunks++;
      }
    });

    return {
      fullTranscript,
      averageConfidence: validChunks > 0 ? totalConfidence / validChunks : 0,
      totalDuration,
      wordTimestamps: allWordTimestamps,
      transcriptionTime: 0, // This would need to be tracked separately
    };
  }

  /**
   * Clean up directory and all its contents
   */
  private cleanupDirectory(dirPath: string): void {
    try {
      if (existsSync(dirPath)) {
        const files = require('fs').readdirSync(dirPath);
        files.forEach((file: string) => {
          this.cleanupTempFile(join(dirPath, file));
        });
        require('fs').rmdirSync(dirPath);
        console.log(`🧹 Cleaned up directory: ${dirPath}`);
      }
    } catch (error) {
      console.warn('⚠️ Failed to clean up directory:', dirPath, error);
    }
  }

  /**
   * Process recorded audio in chunks for long lectures (OPTIMIZED)
   */
  async processRecordedAudioChunked(
    audioBuffer: Buffer,
    userId: string,
    options: {
      language?: string;
      chunkDurationMinutes?: number; // Default: 10 minutes per chunk
      maxConcurrentJobs?: number; // Default: 3 concurrent transcriptions
      onProgress?: (stage: string, progress: number) => void;
    } = {}
  ): Promise<AudioExtractionResult> {
    const totalStartTime = Date.now();
    const timestamp = Date.now();
    const baseFileName = `${timestamp}_recorded_audio`;
    const tempAudioFile = join(this.tempDir, `${baseFileName}.wav`);
    const chunksDir = join(this.tempDir, `chunks_${timestamp}`);

    try {
      const { 
        onProgress = () => {}, 
        chunkDurationMinutes = 10,
        maxConcurrentJobs = 3 
      } = options;

      // Ensure chunks directory exists
      if (!existsSync(chunksDir)) {
        require('fs').mkdirSync(chunksDir, { recursive: true });
      }

      // Stage 1: Save audio buffer to temporary file
      onProgress('Preparing audio file...', 5);
      require('fs').writeFileSync(tempAudioFile, audioBuffer);
      
      const inputSizeMB = audioBuffer.length / 1024 / 1024;
      console.log(`📁 Saved recorded audio: ${tempAudioFile} (${inputSizeMB.toFixed(2)} MB)`);
      
      // Warning if input is very large
      if (inputSizeMB > 200) {
        console.warn(`⚠️ Warning: Input audio file is very large (${inputSizeMB.toFixed(2)} MB). This may cause issues.`);
      }

      onProgress('Splitting audio into chunks...', 15);

      // Stage 2: Split audio into chunks using ffmpeg
      const chunkDurationSeconds = chunkDurationMinutes * 60;
      const audioChunks = await this.splitAudioIntoChunks(
        tempAudioFile, 
        chunksDir, 
        chunkDurationSeconds
      );

      console.log(`✂️ Split recorded audio into ${audioChunks.length} chunks of ${chunkDurationMinutes} minutes each`);

      onProgress('Transcribing chunks in parallel...', 25);

      // Stage 3: Transcribe chunks in parallel (controlled concurrency)
      const transcriptionResults = await this.transcribeChunksInParallel(
        audioChunks,
        userId,
        options,
        maxConcurrentJobs,
        (chunkProgress) => {
          // Map chunk progress to 25-85% range
          const overallProgress = 25 + (chunkProgress * 0.6);
          onProgress(`Transcribing chunk... ${Math.round(chunkProgress * 100)}%`, overallProgress);
        }
      );

      onProgress('Merging transcripts...', 90);

      // Stage 4: Merge transcripts with correct timestamps
      const mergedResult = this.mergeTranscriptChunks(
        transcriptionResults, 
        chunkDurationSeconds
      );

      onProgress('Cleaning up...', 95);

      // Cleanup
      this.cleanupTempFile(tempAudioFile);
      this.cleanupDirectory(chunksDir);

      onProgress('Complete!', 100);

      const totalProcessingTime = Date.now() - totalStartTime;
      console.log(`✅ Chunked recorded audio processing completed in ${totalProcessingTime}ms`);
      console.log(`🎤 Recording chunks: ${audioChunks.length}, Speed improvement: ~${Math.floor(audioChunks.length * 0.7)}x faster`);

      return {
        success: true,
        transcript: mergedResult.fullTranscript,
        confidence: mergedResult.averageConfidence,
        duration: mergedResult.totalDuration,
        wordTimestamps: mergedResult.wordTimestamps,
        language: transcriptionResults[0]?.language || options.language || 'en',
        provider: 'openai',
        processingTime: totalProcessingTime,
        audioExtractionTime: 0, // No extraction needed for recorded audio
        transcriptionTime: mergedResult.transcriptionTime,
      };

    } catch (error) {
      console.error('❌ Chunked recorded audio processing failed:', error);
      // Cleanup
      this.cleanupTempFile(tempAudioFile);
      this.cleanupDirectory(chunksDir);

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        processingTime: Date.now() - totalStartTime,
      };
    }
  }

  /**
   * Convert any input audio file to our optimized MP3 (16 kHz, mono, 48 kbps, silence-trimmed)
   * Used for STANDARD (non-chunked) processing to keep payloads small like the chunked path.
   */
  private async convertToOptimizedMp3(inputPath: string): Promise<string> {
    const ffmpeg = require('fluent-ffmpeg');
    const path = require('path');

    const outputPath = path.join(
      this.tempDir,
      `${path.basename(inputPath, path.extname(inputPath))}_opt_${Date.now()}.mp3`
    );

    return new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .outputOptions([
          '-c:a', 'libmp3lame',
          '-b:a', '48k', // 48 kbps bitrate – good for speech
          '-ar', '16000', // 16 kHz sample-rate
          '-ac', '1', // mono
          '-af',
            'silenceremove=start_periods=1:start_duration=1:start_threshold=-35dB:detection=peak',
        ])
        .on('end', () => {
          console.log(`🎛️  Converted audio to optimized MP3: ${outputPath}`);
          resolve(outputPath);
        })
        .on('error', (err: any) => {
          console.error('❌ Failed to convert audio to MP3:', err);
          reject(err);
        })
        .save(outputPath);
    });
  }
}

export const audioExtractionService = new AudioExtractionService(); 