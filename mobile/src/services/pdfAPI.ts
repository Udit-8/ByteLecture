import { supabase } from '../config/supabase';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export interface PDFProcessingOptions {
  extractText?: boolean;
  generateSummary?: boolean;
  enableOCR?: boolean;
}

export interface PDFProcessingResult {
  success: boolean;
  documentId?: string;
  pageCount?: number;
  fileSize?: number;
  processingTime?: number;
  metadata?: any;
  contentItemId?: string;
  error?: string;
  message?: string;
}

export interface PDFProcessingStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

class PDFAPIService {
  private async getAuthHeaders() {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('Authentication required');
    }

    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  }

  /**
   * Trigger PDF processing on the backend after file upload
   */
  async processPDF(
    filePath: string,
    options?: PDFProcessingOptions
  ): Promise<PDFProcessingResult> {
    try {
      console.log('🔄 Triggering PDF processing for:', filePath);

      const headers = await this.getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/pdf/process`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          filePath,
          options: options || {
            extractText: true,
            generateSummary: false,
            enableOCR: true,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ PDF processing failed:', result);
        throw new Error(
          result.message || result.error || 'PDF processing failed'
        );
      }

      console.log('✅ PDF processing completed:', result);
      if (result?.data?.contentItemId) {
        result.contentItemId = result.data.contentItemId;
      }
      return result as PDFProcessingResult;
    } catch (error) {
      console.error('❌ PDF processing error:', error);
      throw error;
    }
  }

  /**
   * Get processing status for a PDF file
   */
  async getProcessingStatus(filePath: string): Promise<PDFProcessingStatus> {
    try {
      const headers = await this.getAuthHeaders();
      const encodedPath = encodeURIComponent(filePath);

      const response = await fetch(
        `${API_BASE_URL}/pdf/status/${encodedPath}`,
        {
          method: 'GET',
          headers,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || result.error || 'Failed to get processing status'
        );
      }

      return result.data;
    } catch (error) {
      console.error('❌ Failed to get PDF processing status:', error);
      throw error;
    }
  }

  /**
   * Reprocess a failed PDF document
   */
  async reprocessPDF(filePath: string): Promise<PDFProcessingResult> {
    try {
      console.log('🔄 Reprocessing PDF:', filePath);

      const headers = await this.getAuthHeaders();

      const response = await fetch(`${API_BASE_URL}/pdf/reprocess`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ filePath }),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ PDF reprocessing failed:', result);
        throw new Error(
          result.message || result.error || 'PDF reprocessing failed'
        );
      }

      console.log('✅ PDF reprocessing completed:', result);
      return result;
    } catch (error) {
      console.error('❌ PDF reprocessing error:', error);
      throw error;
    }
  }
}

export const pdfAPI = new PDFAPIService();
export default pdfAPI;
