import { createWriteStream, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { speechToTextService } from './speechToTextService';
import { usageTrackingService } from './usageTrackingService';

// ---------------------------------------------
// Global yt-dlp options
// ---------------------------------------------
const COOKIES_PATH = process.env.YTDLP_COOKIES ? '/app/cookies.txt' : undefined;

function buildCommonFlags() {
  const flags: Record<string, any> = {
    forceIpv4: true,
  };
  if (COOKIES_PATH) {
    flags.cookies = COOKIES_PATH;
  }
  return flags;
}

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
  private tempDir: string;

  constructor() {
    this.tempDir = join(process.cwd(), 'temp');
    
    // Ensure temp directory exists
    if (!existsSync(this.tempDir)) {
      require('fs').mkdirSync(this.tempDir, { recursive: true });
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


  /**
   * Extract audio and transcribe in parallel chunks for long videos (OPTIMIZED)
   */

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