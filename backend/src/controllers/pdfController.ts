import { Request, Response } from 'express';
import { pdfService } from '../services/pdfService';
import { usageTrackingService } from '../services/usageTrackingService';
import { PDFProcessingOptions } from '../types/pdf';
import { ContentService } from '../services/contentService';

// Define authenticated request interface
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export class PDFController {
  /**
   * Process a PDF file from storage
   */
  async processPDF(req: AuthenticatedRequest, res: Response): Promise<void> {
    const userId = req.user?.id;

    try {
      // Check authentication
      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'You must be logged in to process PDFs',
        });
        return;
      }

      const { filePath, options } = req.body;

      if (!filePath) {
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'validation_error',
          error_message: 'File path is required for PDF processing',
          request_path: req.path,
          user_agent: req.get('User-Agent'),
          ip_address: req.ip,
        });

        res.status(400).json({
          success: false,
          error: 'File path is required',
        });
        return;
      }

      // Check quota before processing
      const quotaCheck = await usageTrackingService.canProcessPDF(userId);
      if (!quotaCheck.allowed) {
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'quota_exceeded',
          error_message: quotaCheck.reason || 'PDF processing quota exceeded',
          request_path: req.path,
          error_details: { quota: quotaCheck.quota },
        });

        res.status(429).json({
          success: false,
          error: 'quota_exceeded',
          message: quotaCheck.reason,
          quota: quotaCheck.quota,
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

      // Record PDF processing usage
      const usageResult = await usageTrackingService.recordPDFProcessing(userId);
      if (!usageResult.success) {
        res.status(429).json({
          success: false,
          error: 'quota_exceeded',
          message: usageResult.error,
        });
        return;
      }

      const result = await pdfService.processPDFFromStorage(
        filePath,
        processingOptions
      );

      if (result.success) {
        // AI processing usage is already recorded by recordPDFProcessing above

        // Create content item for Recent Notes integration
        try {
          const contentService = new ContentService();
          
          // Use the AI-generated smart title from the processing result
          const title = result.smartTitle || result.metadata?.title || `PDF Document ${new Date().toLocaleDateString()}`;

          const newContentItem = await contentService.createContentItem({
            user_id: userId,
            title: title,
            description: `PDF document with ${result.pageCount || 0} pages`,
            content_type: 'pdf',
            file_url: filePath,
            file_size: result.fileSize,
            processed: true,
            summary: result.extractedText?.substring(0, 500) + '...', // First 500 chars as preview
          });
          console.log(`Created content item for PDF: ${filePath} with AI-generated title: ${title} (id: ${newContentItem.id})`);
          // Attach the content item ID to the result so the client doesn't need a temp-uuid
          (result as any).contentItemId = newContentItem.id;
        } catch (contentError) {
          console.error('Error creating content item:', contentError);
          // Don't fail the whole operation for content item creation errors
        }

        res.status(200).json({
          success: true,
          data: {
            documentId: result.documentId,
            pageCount: result.pageCount,
            fileSize: result.fileSize,
            processingTime: result.processingTime,
            metadata: result.metadata,
            contentItemId: (result as any).contentItemId || null,
          },
          message: 'PDF processed successfully',
        });
      } else {
        await usageTrackingService.logError({
          user_id: userId,
          error_type: 'processing_error',
          error_message: result.error || 'PDF processing failed',
          request_path: req.path,
          error_details: { filePath, options: processingOptions },
        });

        res.status(500).json({
          success: false,
          error: result.error,
          message: 'Failed to process PDF',
        });
      }
    } catch (error) {
      console.error('PDF processing controller error:', error);

      await usageTrackingService.logError({
        user_id: userId,
        error_type: 'server_error',
        error_message:
          error instanceof Error
            ? error.message
            : 'Unknown error during PDF processing',
        request_path: req.path,
        error_details: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

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

      const status = await pdfService.getProcessingStatus(
        decodeURIComponent(filePath)
      );

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
      if (
        webhook.type === 'INSERT' &&
        webhook.record.name.toLowerCase().endsWith('.pdf')
      ) {
        const filePath = webhook.record.name;

        console.log(`Processing PDF upload webhook for: ${filePath}`);

        // Process the PDF asynchronously
        pdfService
          .processPDFFromStorage(filePath)
          .then((result) => {
            if (result.success) {
              console.log(`Auto-processing completed for: ${filePath}`);
            } else {
              console.error(
                `Auto-processing failed for: ${filePath}`,
                result.error
              );
            }
          })
          .catch((error) => {
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
