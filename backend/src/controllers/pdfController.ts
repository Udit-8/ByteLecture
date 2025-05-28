import { Request, Response } from 'express';
import { pdfService } from '../services/pdfService';
import { PDFProcessingOptions } from '../types/pdf';

export class PDFController {
  /**
   * Process a PDF file from storage
   */
  async processPDF(req: Request, res: Response): Promise<void> {
    try {
      const { filePath, options } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required',
        });
        return;
      }

      // Validate options if provided
      const processingOptions: Partial<PDFProcessingOptions> = {};
      if (options) {
        if (typeof options.extractImages === 'boolean') {
          processingOptions.extractImages = options.extractImages;
        }
        if (typeof options.generateThumbnail === 'boolean') {
          processingOptions.generateThumbnail = options.generateThumbnail;
        }
        if (typeof options.cleanText === 'boolean') {
          processingOptions.cleanText = options.cleanText;
        }
        if (typeof options.detectSections === 'boolean') {
          processingOptions.detectSections = options.detectSections;
        }
        if (typeof options.removeHeaders === 'boolean') {
          processingOptions.removeHeaders = options.removeHeaders;
        }
        if (typeof options.removeFooters === 'boolean') {
          processingOptions.removeFooters = options.removeFooters;
        }
        if (typeof options.preserveFormatting === 'boolean') {
          processingOptions.preserveFormatting = options.preserveFormatting;
        }
      }

      const result = await pdfService.processPDFFromStorage(filePath, processingOptions);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            documentId: result.documentId,
            pageCount: result.pageCount,
            fileSize: result.fileSize,
            processingTime: result.processingTime,
            metadata: result.metadata,
          },
          message: 'PDF processed successfully',
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Failed to process PDF',
        });
      }
    } catch (error) {
      console.error('PDF processing controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Internal server error during PDF processing',
      });
    }
  }

  /**
   * Get processing status for a file
   */
  async getProcessingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.params;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required',
        });
        return;
      }

      const status = await pdfService.getProcessingStatus(decodeURIComponent(filePath));

      if (status === null) {
        res.status(404).json({
          success: false,
          error: 'Document not found',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          status,
        },
      });
    } catch (error) {
      console.error('Get processing status error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to get processing status',
      });
    }
  }

  /**
   * Reprocess a failed document
   */
  async reprocessDocument(req: Request, res: Response): Promise<void> {
    try {
      const { filePath } = req.body;

      if (!filePath) {
        res.status(400).json({
          success: false,
          error: 'File path is required',
        });
        return;
      }

      const result = await pdfService.reprocessDocument(filePath);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: {
            documentId: result.documentId,
            pageCount: result.pageCount,
            fileSize: result.fileSize,
            processingTime: result.processingTime,
          },
          message: 'PDF reprocessed successfully',
        });
      } else {
        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Failed to reprocess PDF',
        });
      }
    } catch (error) {
      console.error('PDF reprocessing controller error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Internal server error during PDF reprocessing',
      });
    }
  }

  /**
   * Handle webhook from Supabase Storage for automatic processing
   */
  async handleStorageWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhook = req.body;

      // Validate webhook structure
      if (!webhook.type || !webhook.record) {
        res.status(400).json({
          success: false,
          error: 'Invalid webhook payload',
        });
        return;
      }

      // Only process INSERT events for PDF files
      if (webhook.type === 'INSERT' && webhook.record.name.toLowerCase().endsWith('.pdf')) {
        const filePath = webhook.record.name;
        
        console.log(`Processing PDF upload webhook for: ${filePath}`);

        // Process the PDF asynchronously
        pdfService.processPDFFromStorage(filePath)
          .then(result => {
            if (result.success) {
              console.log(`Auto-processing completed for: ${filePath}`);
            } else {
              console.error(`Auto-processing failed for: ${filePath}`, result.error);
            }
          })
          .catch(error => {
            console.error(`Auto-processing error for: ${filePath}`, error);
          });

        res.status(200).json({
          success: true,
          message: 'Webhook received, processing started',
        });
      } else {
        res.status(200).json({
          success: true,
          message: 'Webhook received, no action needed',
        });
      }
    } catch (error) {
      console.error('Storage webhook error:', error);
      res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to process storage webhook',
      });
    }
  }
}

// Export singleton instance
export const pdfController = new PDFController(); 