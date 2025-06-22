import { pdfService } from '../services/pdfService';

/**
 * Test function to demonstrate PDF processing
 * This can be called from a route or used for testing
 */
export async function testPDFProcessing(filePath: string): Promise<void> {
  console.log('🔄 Starting PDF processing test...');
  console.log(`📄 File path: ${filePath}`);

  try {
    // Test basic processing
    const result = await pdfService.processPDFFromStorage(filePath);

    if (result.success) {
      console.log('✅ PDF processing completed successfully!');
      console.log(`📊 Document ID: ${result.documentId}`);
      console.log(`📑 Pages: ${result.pageCount}`);
      console.log(`💾 File size: ${result.fileSize} bytes`);
      console.log(`⏱️ Processing time: ${result.processingTime}ms`);

      if (result.metadata) {
        console.log('📋 Metadata:');
        console.log(`   Title: ${result.metadata.title || 'N/A'}`);
        console.log(`   Author: ${result.metadata.author || 'N/A'}`);
        console.log(
          `   Creation Date: ${result.metadata.creationDate || 'N/A'}`
        );
        console.log(
          `   Keywords: ${result.metadata.keywords?.join(', ') || 'N/A'}`
        );
      }

      // Test status check
      const status = await pdfService.getProcessingStatus(filePath);
      console.log(`📈 Current status: ${status}`);
    } else {
      console.log('❌ PDF processing failed:');
      console.log(`   Error: ${result.error}`);
      console.log(`   Processing time: ${result.processingTime}ms`);
    }
  } catch (error) {
    console.error('🚨 Test error:', error);
  }

  console.log('🏁 PDF processing test completed.');
}

/**
 * Test function with custom options
 */
export async function testPDFProcessingWithOptions(
  filePath: string,
  options = {
    cleanText: true,
    detectSections: true,
    removeHeaders: true,
    removeFooters: true,
    preserveFormatting: false,
  }
): Promise<void> {
  console.log('🔄 Starting PDF processing test with custom options...');
  console.log(`📄 File path: ${filePath}`);
  console.log(`⚙️ Options:`, options);

  try {
    const result = await pdfService.processPDFFromStorage(filePath, options);

    if (result.success) {
      console.log('✅ PDF processing with options completed successfully!');
      console.log(`📊 Document ID: ${result.documentId}`);
      console.log(`📑 Pages: ${result.pageCount}`);
      console.log(`💾 File size: ${result.fileSize} bytes`);
      console.log(`⏱️ Processing time: ${result.processingTime}ms`);
    } else {
      console.log('❌ PDF processing with options failed:');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.error('🚨 Test with options error:', error);
  }

  console.log('🏁 PDF processing test with options completed.');
}

/**
 * Utility to test reprocessing functionality
 */
export async function testReprocessing(filePath: string): Promise<void> {
  console.log('🔄 Testing reprocessing functionality...');

  try {
    const result = await pdfService.reprocessDocument(filePath);

    if (result.success) {
      console.log('✅ Reprocessing completed successfully!');
      console.log(`📊 Document ID: ${result.documentId}`);
    } else {
      console.log('❌ Reprocessing failed:');
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.error('🚨 Reprocessing test error:', error);
  }
}

// Example usage (uncomment to run when calling this file directly)
/*
if (require.main === module) {
  // Example test - replace with actual file path
  const testFilePath = 'uploads/sample.pdf';
  
  console.log('Running PDF processing tests...');
  
  testPDFProcessing(testFilePath)
    .then(() => testPDFProcessingWithOptions(testFilePath))
    .then(() => testReprocessing(testFilePath))
    .catch(console.error);
}
*/
