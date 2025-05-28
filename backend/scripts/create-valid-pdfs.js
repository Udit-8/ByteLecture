const fs = require('fs');
const path = require('path');
const { jsPDF } = require('jspdf');

/**
 * Create Valid PDF Files for Testing
 * Generates properly formatted PDF files using jsPDF
 */

const TEST_FILES_DIR = path.join(__dirname, '..', 'test-files', 'pdfs');

function createSmallPDF() {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.text('ByteLecture Test Document', 20, 30);
  
  doc.setFontSize(12);
  doc.text('This is a small test PDF for upload and processing testing.', 20, 50);
  doc.text('It contains basic text content to verify PDF parsing functionality.', 20, 70);
  doc.text('', 20, 90);
  doc.text('Features to test:', 20, 110);
  doc.text('• Text extraction', 30, 130);
  doc.text('• Metadata parsing', 30, 150);
  doc.text('• Basic processing', 30, 170);
  
  doc.setFontSize(10);
  doc.text('Generated: ' + new Date().toISOString(), 20, 280);
  
  return doc.output('arraybuffer');
}

function createMediumPDF() {
  const doc = new jsPDF();
  
  // Page 1
  doc.setFontSize(20);
  doc.text('ByteLecture Medium Test Document', 20, 30);
  
  doc.setFontSize(14);
  doc.text('Chapter 1: Introduction', 20, 60);
  
  doc.setFontSize(12);
  const intro = `This is a medium-sized test PDF document designed to test the PDF processing
capabilities of the ByteLecture application. This document contains multiple
pages and sections to verify proper text extraction and content parsing.

The document includes various text formatting options and content structures
to ensure the PDF processing service can handle different types of content
effectively. This helps validate the robustness of the text extraction
and preprocessing algorithms.`;

  const lines = doc.splitTextToSize(intro, 170);
  doc.text(lines, 20, 90);
  
  // Page 2
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Chapter 2: Content Types', 20, 30);
  
  doc.setFontSize(12);
  doc.text('This section contains different types of content:', 20, 50);
  doc.text('', 20, 70);
  doc.text('1. Numbered lists', 30, 90);
  doc.text('2. Multiple paragraphs', 30, 110);
  doc.text('3. Various text lengths', 30, 130);
  doc.text('4. Different formatting', 30, 150);
  
  const paragraph2 = `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam,
quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo
consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse
cillum dolore eu fugiat nulla pariatur.`;
  
  const lines2 = doc.splitTextToSize(paragraph2, 170);
  doc.text(lines2, 20, 180);
  
  // Page 3
  doc.addPage();
  doc.setFontSize(14);
  doc.text('Chapter 3: Conclusion', 20, 30);
  
  doc.setFontSize(12);
  const conclusion = `This medium-sized document helps test the PDF processing service with
multi-page content. It validates that the system can properly extract text
from documents with multiple pages and maintain the content structure.

The processing should handle page breaks, different text sections, and
various content types while maintaining readability and structure in the
extracted text output.`;
  
  const lines3 = doc.splitTextToSize(conclusion, 170);
  doc.text(lines3, 20, 60);
  
  doc.setFontSize(10);
  doc.text('Generated: ' + new Date().toISOString(), 20, 280);
  
  return doc.output('arraybuffer');
}

function createLargePDF() {
  const doc = new jsPDF();
  
  // Generate multiple pages with content
  for (let page = 1; page <= 10; page++) {
    if (page > 1) doc.addPage();
    
    doc.setFontSize(20);
    doc.text(`ByteLecture Large Test Document - Page ${page}`, 20, 30);
    
    doc.setFontSize(14);
    doc.text(`Section ${page}: Content Analysis`, 20, 60);
    
    doc.setFontSize(12);
    
    const content = `This is page ${page} of a large test document designed to evaluate the
performance and capabilities of the PDF processing service when handling
larger documents with substantial content.

Page Content Overview:
• Page number: ${page}
• Section title: Content Analysis ${page}
• Word count: Approximately 200-300 words per page
• Content type: Mixed text with structured information

Detailed Content:
This section contains detailed information about content analysis techniques
and methodologies used in document processing. The content is structured to
provide comprehensive coverage of the topic while maintaining readability
and proper formatting throughout the document.

The PDF processing service should be able to extract this text efficiently
while maintaining the document structure and hierarchy. This includes
preserving paragraph breaks, bullet points, and other formatting elements
that contribute to the document's overall organization.

Performance Considerations:
When processing larger documents like this one, the system should demonstrate
good performance characteristics including reasonable processing times,
efficient memory usage, and accurate text extraction across all pages.

Quality Metrics:
• Text extraction accuracy: Should be near 100%
• Processing speed: Should complete within reasonable time limits
• Memory usage: Should remain within acceptable bounds
• Error handling: Should gracefully handle any processing issues

Additional Notes for Page ${page}:
This page contains unique content to ensure that the PDF processing service
correctly handles documents with varying content across multiple pages. Each
page should be processed independently while maintaining the overall document
context and structure.`;

    const lines = doc.splitTextToSize(content, 170);
    doc.text(lines, 20, 90);
    
    // Add page footer
    doc.setFontSize(10);
    doc.text(`Page ${page} of 10 | Generated: ${new Date().toISOString()}`, 20, 280);
  }
  
  return doc.output('arraybuffer');
}

function createCorruptedFile() {
  // Create an intentionally corrupted file for error testing
  return Buffer.from('This is not a valid PDF file content for error testing');
}

async function generateAllTestFiles() {
  console.log('🚀 Generating valid PDF test files...');
  console.log('=' .repeat(50));
  
  // Ensure directory exists
  if (!fs.existsSync(TEST_FILES_DIR)) {
    fs.mkdirSync(TEST_FILES_DIR, { recursive: true });
  }
  
  const files = [
    { name: 'sample.pdf', generator: createSmallPDF, description: 'Small test PDF' },
    { name: 'small-sample.pdf', generator: createSmallPDF, description: 'Small test PDF (duplicate)' },
    { name: 'medium-sample.pdf', generator: createMediumPDF, description: 'Medium test PDF (3 pages)' },
    { name: 'large-sample.pdf', generator: createLargePDF, description: 'Large test PDF (10 pages)' },
    { name: 'corrupted.pdf', generator: createCorruptedFile, description: 'Corrupted file for error testing' }
  ];
  
  for (const file of files) {
    console.log(`📄 Creating ${file.name}...`);
    
    try {
      const content = file.generator();
      const filePath = path.join(TEST_FILES_DIR, file.name);
      
      fs.writeFileSync(filePath, Buffer.from(content));
      
      const stats = fs.statSync(filePath);
      console.log(`   ✅ Created: ${file.description}`);
      console.log(`   📏 Size: ${Math.round(stats.size / 1024)}KB`);
      
    } catch (error) {
      console.error(`   ❌ Failed to create ${file.name}:`, error.message);
    }
  }
  
  console.log('\n🎉 PDF generation completed!');
  console.log('Files created in:', TEST_FILES_DIR);
  console.log('\n💡 Next steps:');
  console.log('1. Upload files to Supabase: node scripts/upload-test-files.js');
  console.log('2. Run PDF tests: npm run test:pdf');
}

// Run if called directly
if (require.main === module) {
  generateAllTestFiles().catch(console.error);
}

module.exports = { generateAllTestFiles }; 