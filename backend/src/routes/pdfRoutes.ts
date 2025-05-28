import { Router } from 'express';
import { pdfController } from '../controllers/pdfController';

const router = Router();

/**
 * @route POST /api/pdf/process
 * @description Process a PDF file from Supabase Storage
 * @access Private (requires authentication)
 * @body { filePath: string, options?: PDFProcessingOptions }
 */
router.post('/process', pdfController.processPDF);

/**
 * @route GET /api/pdf/status/:filePath
 * @description Get processing status for a PDF file
 * @access Private (requires authentication)
 * @params { filePath: string } - URL encoded file path
 */
router.get('/status/:filePath', pdfController.getProcessingStatus);

/**
 * @route POST /api/pdf/reprocess
 * @description Reprocess a failed PDF document
 * @access Private (requires authentication)
 * @body { filePath: string }
 */
router.post('/reprocess', pdfController.reprocessDocument);

/**
 * @route POST /api/pdf/webhook
 * @description Handle Supabase Storage webhooks for automatic PDF processing
 * @access Public (webhook endpoint)
 * @body Supabase webhook payload
 */
router.post('/webhook', pdfController.handleStorageWebhook);

export default router; 