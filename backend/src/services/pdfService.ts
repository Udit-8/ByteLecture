import pdfParse from 'pdf-parse';
import { supabaseAdmin } from '../config/supabase';
import {
  PDFProcessingResult,
  PDFMetadata,
  ProcessedPDFContent,
  PDFSection,
  PDFProcessingOptions,
  TextCleaningOptions,
  ProcessingStatus,
  SectionType,
} from '../types/pdf';

export class PDFProcessingService {
  private readonly bucketName = 'pdfs';
  private readonly defaultOptions: Required<PDFProcessingOptions> = {
    extractImages: false,
    generateThumbnail: true,
    cleanText: true,
    detectSections: true,
    removeHeaders: true,
    removeFooters: true,
    preserveFormatting: false,
  };

  /**
   * Process a PDF file from Supabase Storage
   */
  async processPDFFromStorage(
    filePath: string,
    options?: Partial<PDFProcessingOptions>
  ): Promise<PDFProcessingResult> {
    const startTime = Date.now();
    const processingOptions = { ...this.defaultOptions, ...options };

    try {
      console.log(`Starting PDF processing for: ${filePath}`);

      // Download the PDF file from Supabase Storage
      const pdfBuffer = await this.downloadPDFFromStorage(filePath);

      if (!pdfBuffer) {
        throw new Error('Failed to download PDF from storage');
      }

      // Parse PDF document
      const pdfData = await pdfParse(pdfBuffer);

      // Extract metadata
      const metadata = await this.extractMetadata(pdfData, pdfBuffer.length);

      // Extract text content
      const extractedText = pdfData.text;

      // Clean and preprocess text
      const cleanedText = processingOptions.cleanText
        ? this.cleanExtractedText(extractedText, {
            removeExtraWhitespace: true,
            removeHeaders: processingOptions.removeHeaders,
            removeFooters: processingOptions.removeFooters,
            normalizeLineBreaks: true,
            removePageNumbers: true,
            preserveBulletPoints: true,
          })
        : extractedText;

      // Detect sections if enabled
      const sections = processingOptions.detectSections
        ? this.detectSections(cleanedText, metadata.pageCount)
        : [];

      // Get public URL
      const publicUrl = this.getPublicUrl(filePath);

      // Create processed content object
      const processedContent: ProcessedPDFContent = {
        originalFileName: this.extractFileName(filePath),
        filePath,
        publicUrl,
        extractedText,
        cleanedText,
        sections,
        metadata,
        processingStatus: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Store in database
      const documentId = await this.storeProcessedContent(processedContent);

      const processingTime = Date.now() - startTime;

      console.log(
        `PDF processing completed in ${processingTime}ms for: ${filePath}`
      );

      return {
        success: true,
        documentId,
        extractedText,
        pageCount: metadata.pageCount,
        fileSize: metadata.fileSize,
        processingTime,
        metadata,
      };
    } catch (error) {
      const processingTime = Date.now() - startTime;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error(`PDF processing failed for ${filePath}:`, error);

      // Store failure record
      await this.storeProcessingFailure(filePath, errorMessage);

      return {
        success: false,
        processingTime,
        error: errorMessage,
      };
    }
  }

  /**
   * Download PDF file from Supabase Storage
   */
  private async downloadPDFFromStorage(
    filePath: string
  ): Promise<Buffer | null> {
    try {
      const { data, error } = await supabaseAdmin.storage
        .from(this.bucketName)
        .download(filePath);

      if (error) {
        throw new Error(`Storage download error: ${error.message}`);
      }

      if (!data) {
        throw new Error('No data received from storage');
      }

      return Buffer.from(await data.arrayBuffer());
    } catch (error) {
      console.error('Failed to download PDF from storage:', error);
      return null;
    }
  }

  /**
   * Extract metadata from PDF document
   */
  private async extractMetadata(
    pdfData: any,
    fileSize: number
  ): Promise<PDFMetadata> {
    try {
      const info = pdfData.info || {};

      return {
        title: info.Title || undefined,
        author: info.Author || undefined,
        subject: info.Subject || undefined,
        creator: info.Creator || undefined,
        producer: info.Producer || undefined,
        creationDate: info.CreationDate
          ? new Date(info.CreationDate)
          : undefined,
        modificationDate: info.ModDate ? new Date(info.ModDate) : undefined,
        keywords: info.Keywords
          ? info.Keywords.split(',').map((k: string) => k.trim())
          : [],
        pageCount: pdfData.numpages || 1,
        fileSize,
      };
    } catch (error) {
      console.warn('Failed to extract PDF metadata:', error);
      return {
        pageCount: pdfData.numpages || 1,
        fileSize,
        keywords: [],
      };
    }
  }

  /**
   * Clean and preprocess extracted text
   */
  private cleanExtractedText(
    text: string,
    options: TextCleaningOptions
  ): string {
    let cleaned = text;

    if (options.normalizeLineBreaks) {
      // Normalize line breaks
      cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    }

    if (options.removeExtraWhitespace) {
      // Remove extra whitespace but preserve paragraph breaks
      cleaned = cleaned
        .replace(/[ \t]+/g, ' ') // Multiple spaces/tabs to single space
        .replace(/\n[ \t]+/g, '\n') // Remove leading whitespace on lines
        .replace(/[ \t]+\n/g, '\n') // Remove trailing whitespace on lines
        .replace(/\n{3,}/g, '\n\n'); // Multiple line breaks to max 2
    }

    if (options.removePageNumbers) {
      // Remove standalone page numbers (basic pattern)
      cleaned = cleaned.replace(/^\s*\d+\s*$/gm, '');
    }

    if (options.removeHeaders) {
      // Remove potential headers (lines at the start of pages that repeat)
      cleaned = this.removeRepeatingHeaders(cleaned);
    }

    if (options.removeFooters) {
      // Remove potential footers (lines at the end of pages that repeat)
      cleaned = this.removeRepeatingFooters(cleaned);
    }

    if (options.preserveBulletPoints) {
      // Ensure bullet points are properly formatted
      cleaned = cleaned
        .replace(/\n([•·▪▫◦‣⁃])/g, '\n\n$1') // Add space before bullet points
        .replace(/([•·▪▫◦‣⁃])\s+/g, '$1 '); // Normalize space after bullet points
    }

    // Final cleanup
    cleaned = cleaned.trim().replace(/\n{3,}/g, '\n\n');

    return cleaned;
  }

  /**
   * Detect and extract sections from cleaned text
   */
  private detectSections(text: string, pageCount: number): PDFSection[] {
    const sections: PDFSection[] = [];
    const lines = text.split('\n');
    let currentPosition = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (!line) {
        currentPosition += lines[i].length + 1;
        continue;
      }

      // Detect section type
      const sectionType = this.detectSectionType(line);

      if (sectionType === 'title' || sectionType === 'subtitle') {
        // Create a new section
        const section: PDFSection = {
          id: `section_${sections.length + 1}`,
          title: line,
          content: line,
          pageNumber: this.estimatePageNumber(currentPosition, text, pageCount),
          startPosition: currentPosition,
          endPosition: currentPosition + line.length,
          type: sectionType,
        };

        sections.push(section);
      }

      currentPosition += lines[i].length + 1;
    }

    return sections;
  }

  /**
   * Detect the type of a text section
   */
  private detectSectionType(line: string): SectionType {
    // Title patterns (all caps, short, or numbered)
    if (
      (line.length < 80 && line === line.toUpperCase() && line.length > 3) ||
      /^(CHAPTER|SECTION|PART)\s+\d+/i.test(line) ||
      /^\d+\.\s+[A-Z]/.test(line)
    ) {
      return 'title';
    }

    // Subtitle patterns
    if (
      line.length < 100 &&
      (/^[A-Z][a-z].*[^.]$/.test(line) || /^\d+\.\d+/.test(line))
    ) {
      return 'subtitle';
    }

    // List items
    if (
      /^[•·▪▫◦‣⁃-]\s+/.test(line) ||
      /^\d+\.\s+/.test(line) ||
      /^[a-z]\)\s+/.test(line)
    ) {
      return 'list';
    }

    // Default to paragraph
    return 'paragraph';
  }

  /**
   * Estimate page number based on text position
   */
  private estimatePageNumber(
    position: number,
    fullText: string,
    totalPages: number
  ): number {
    const ratio = position / fullText.length;
    return Math.max(1, Math.min(totalPages, Math.ceil(ratio * totalPages)));
  }

  /**
   * Remove repeating headers from text
   */
  private removeRepeatingHeaders(text: string): string {
    // This is a basic implementation - can be enhanced
    const pages = text.split(/--- Page \d+ ---/);
    if (pages.length < 3) return text;

    // Find potential headers (first few lines of each page)
    const potentialHeaders = pages.slice(1).map((page) => {
      const lines = page.trim().split('\n').slice(0, 3);
      return lines.join('\n');
    });

    // Find common headers
    const headerCounts = new Map<string, number>();
    potentialHeaders.forEach((header) => {
      const count = headerCounts.get(header) || 0;
      headerCounts.set(header, count + 1);
    });

    // Remove headers that appear on multiple pages
    const headersToRemove = Array.from(headerCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([header]) => header);

    let cleaned = text;
    headersToRemove.forEach((header) => {
      const regex = new RegExp(
        header.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g'
      );
      cleaned = cleaned.replace(regex, '');
    });

    return cleaned;
  }

  /**
   * Remove repeating footers from text
   */
  private removeRepeatingFooters(text: string): string {
    // Similar logic to headers but for the end of pages
    const pages = text.split(/--- Page \d+ ---/);
    if (pages.length < 3) return text;

    const potentialFooters = pages.slice(1).map((page) => {
      const lines = page.trim().split('\n').slice(-3);
      return lines.join('\n');
    });

    const footerCounts = new Map<string, number>();
    potentialFooters.forEach((footer) => {
      const count = footerCounts.get(footer) || 0;
      footerCounts.set(footer, count + 1);
    });

    const footersToRemove = Array.from(footerCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([footer]) => footer);

    let cleaned = text;
    footersToRemove.forEach((footer) => {
      const regex = new RegExp(
        footer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'g'
      );
      cleaned = cleaned.replace(regex, '');
    });

    return cleaned;
  }

  /**
   * Get public URL for a file in storage
   */
  private getPublicUrl(filePath: string): string {
    const { data } = supabaseAdmin.storage
      .from(this.bucketName)
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  /**
   * Extract filename from file path
   */
  private extractFileName(filePath: string): string {
    return filePath.split('/').pop() || filePath;
  }

  /**
   * Store processed content in database
   */
  private async storeProcessedContent(
    content: ProcessedPDFContent
  ): Promise<string> {
    try {
      // Store main document record
      const { data: docData, error: docError } = await supabaseAdmin
        .from('processed_documents')
        .insert({
          original_file_name: content.originalFileName,
          file_path: content.filePath,
          public_url: content.publicUrl,
          extracted_text: content.extractedText,
          cleaned_text: content.cleanedText,
          metadata: content.metadata,
          thumbnail_url: content.thumbnailUrl,
          processing_status: content.processingStatus,
          processing_error: content.processingError,
          created_at: content.createdAt,
          updated_at: content.updatedAt,
        })
        .select('id')
        .single();

      if (docError) {
        throw new Error(`Database error: ${docError.message}`);
      }

      const documentId = docData.id;

      // Store sections if any
      if (content.sections.length > 0) {
        const sectionsData = content.sections.map((section) => ({
          document_id: documentId,
          section_id: section.id,
          title: section.title,
          content: section.content,
          page_number: section.pageNumber,
          start_position: section.startPosition,
          end_position: section.endPosition,
          section_type: section.type,
        }));

        const { error: sectionsError } = await supabaseAdmin
          .from('document_sections')
          .insert(sectionsData);

        if (sectionsError) {
          console.warn('Failed to store sections:', sectionsError);
        }
      }

      return documentId;
    } catch (error) {
      console.error('Failed to store processed content:', error);
      throw error;
    }
  }

  /**
   * Store processing failure record
   */
  private async storeProcessingFailure(
    filePath: string,
    error: string
  ): Promise<void> {
    try {
      await supabaseAdmin.from('processed_documents').insert({
        original_file_name: this.extractFileName(filePath),
        file_path: filePath,
        public_url: this.getPublicUrl(filePath),
        extracted_text: '',
        cleaned_text: '',
        metadata: { pageCount: 0, fileSize: 0, keywords: [] },
        processing_status: 'failed',
        processing_error: error,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } catch (dbError) {
      console.error('Failed to store processing failure:', dbError);
    }
  }

  /**
   * Get processing status for a file
   */
  async getProcessingStatus(
    filePath: string
  ): Promise<ProcessingStatus | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('processed_documents')
        .select('processing_status')
        .eq('file_path', filePath)
        .single();

      if (error) {
        return null;
      }

      return data.processing_status as ProcessingStatus;
    } catch (error) {
      console.error('Failed to get processing status:', error);
      return null;
    }
  }

  /**
   * Reprocess a failed document
   */
  async reprocessDocument(filePath: string): Promise<PDFProcessingResult> {
    // Update status to processing
    await supabaseAdmin
      .from('processed_documents')
      .update({
        processing_status: 'processing',
        updated_at: new Date(),
      })
      .eq('file_path', filePath);

    return this.processPDFFromStorage(filePath);
  }
}

// Export singleton instance
export const pdfService = new PDFProcessingService();
