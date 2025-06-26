import { deflate, inflate } from 'pako';

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  compressionTime: number;
}

export interface CompressionConfig {
  level: number; // 1-9, higher = better compression but slower
  threshold: number; // minimum size to compress (bytes)
  chunkSize: number; // size for chunked compression
}

export class CompressionService {
  private static instance: CompressionService;
  private config: CompressionConfig = {
    level: 6, // balanced compression
    threshold: 1024, // 1KB threshold
    chunkSize: 64 * 1024, // 64KB chunks
  };

  private constructor() {}

  public static getInstance(): CompressionService {
    if (!CompressionService.instance) {
      CompressionService.instance = new CompressionService();
    }
    return CompressionService.instance;
  }

  /**
   * Compress data if it meets threshold requirements
   */
  async compressData(data: any): Promise<{
    compressed: string;
    isCompressed: boolean;
    stats: CompressionStats;
  }> {
    const startTime = Date.now();
    const jsonString = JSON.stringify(data);
    const originalSize = new Blob([jsonString]).size;

    // Don't compress small data
    if (originalSize < this.config.threshold) {
      return {
        compressed: jsonString,
        isCompressed: false,
        stats: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          compressionTime: Date.now() - startTime,
        },
      };
    }

    try {
      // Compress using pako (zlib)
      const compressed = deflate(jsonString, {
        level: this.config.level as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9,
      });

      // Convert to base64 for transport
      const base64 = this.arrayBufferToBase64(compressed);
      const compressedSize = new Blob([base64]).size;

      const compressionTime = Date.now() - startTime;
      const compressionRatio = originalSize / compressedSize;

      // Only use compression if it actually reduces size significantly
      if (compressionRatio < 1.1) {
        return {
          compressed: jsonString,
          isCompressed: false,
          stats: {
            originalSize,
            compressedSize: originalSize,
            compressionRatio: 1,
            compressionTime,
          },
        };
      }

      return {
        compressed: base64,
        isCompressed: true,
        stats: {
          originalSize,
          compressedSize,
          compressionRatio,
          compressionTime,
        },
      };
    } catch (error) {
      console.warn('Compression failed, using uncompressed data:', error);
      return {
        compressed: jsonString,
        isCompressed: false,
        stats: {
          originalSize,
          compressedSize: originalSize,
          compressionRatio: 1,
          compressionTime: Date.now() - startTime,
        },
      };
    }
  }

  /**
   * Decompress data if it was compressed
   */
  async decompressData(
    compressedData: string,
    isCompressed: boolean
  ): Promise<any> {
    if (!isCompressed) {
      return JSON.parse(compressedData);
    }

    try {
      // Convert from base64
      const compressed = this.base64ToArrayBuffer(compressedData);

      // Decompress using pako
      const decompressed = inflate(compressed, { to: 'string' });

      return JSON.parse(decompressed);
    } catch (error) {
      console.error('Decompression failed:', error);
      // Fallback: try to parse as uncompressed
      return JSON.parse(compressedData);
    }
  }

  /**
   * Compress array of changes with batching
   */
  async compressChangeBatch(changes: any[]): Promise<{
    batches: Array<{
      data: string;
      isCompressed: boolean;
      count: number;
    }>;
    totalStats: CompressionStats;
  }> {
    const batches: Array<{
      data: string;
      isCompressed: boolean;
      count: number;
    }> = [];

    let totalOriginalSize = 0;
    let totalCompressedSize = 0;
    let totalCompressionTime = 0;

    // Split into optimal batch sizes
    const batchSize = this.calculateOptimalBatchSize(changes);

    for (let i = 0; i < changes.length; i += batchSize) {
      const batch = changes.slice(i, i + batchSize);
      const result = await this.compressData(batch);

      batches.push({
        data: result.compressed,
        isCompressed: result.isCompressed,
        count: batch.length,
      });

      totalOriginalSize += result.stats.originalSize;
      totalCompressedSize += result.stats.compressedSize;
      totalCompressionTime += result.stats.compressionTime;
    }

    return {
      batches,
      totalStats: {
        originalSize: totalOriginalSize,
        compressedSize: totalCompressedSize,
        compressionRatio: totalOriginalSize / totalCompressedSize,
        compressionTime: totalCompressionTime,
      },
    };
  }

  /**
   * Calculate optimal batch size based on data characteristics
   */
  private calculateOptimalBatchSize(changes: any[]): number {
    if (changes.length === 0) return 1;

    // Estimate average change size
    const sampleSize = Math.min(10, changes.length);
    const sample = changes.slice(0, sampleSize);
    const avgSize =
      sample.reduce((sum, change) => {
        return sum + new Blob([JSON.stringify(change)]).size;
      }, 0) / sampleSize;

    // Target batch size around 32KB for optimal compression
    const targetBatchSize = 32 * 1024;
    const optimalBatchSize = Math.max(1, Math.floor(targetBatchSize / avgSize));

    // Limit batch size to reasonable bounds
    return Math.min(Math.max(optimalBatchSize, 10), 100);
  }

  /**
   * Update compression configuration
   */
  updateConfig(config: Partial<CompressionConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current compression statistics
   */
  getConfig(): CompressionConfig {
    return { ...this.config };
  }

  /**
   * Utility: Convert ArrayBuffer to Base64
   */
  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Utility: Convert Base64 to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}

// Export singleton instance
export const compressionService = CompressionService.getInstance();
export default compressionService;
