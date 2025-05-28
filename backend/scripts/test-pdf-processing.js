const { pdfService } = require('../dist/services/pdfService');
const { testPDFProcessing, testPDFProcessingWithOptions, testReprocessing } = require('../dist/utils/testPdfProcessing');

/**
 * Comprehensive PDF Processing Test Suite
 * Run with: node scripts/test-pdf-processing.js [test-type] [file-path]
 */

async function runBasicTest(filePath) {
  console.log('\n🔄 Running Basic PDF Processing Test...');
  console.log('=' .repeat(50));
  
  try {
    await testPDFProcessing(filePath);
  } catch (error) {
    console.error('❌ Basic test failed:', error);
  }
}

async function runCustomOptionsTest(filePath) {
  console.log('\n🔄 Running Custom Options Test...');
  console.log('=' .repeat(50));
  
  const options = {
    cleanText: true,
    detectSections: true,
    removeHeaders: true,
    removeFooters: true,
    preserveFormatting: false,
    generateThumbnail: true,
  };
  
  try {
    await testPDFProcessingWithOptions(filePath, options);
  } catch (error) {
    console.error('❌ Custom options test failed:', error);
  }
}

async function runErrorHandlingTest() {
  console.log('\n🔄 Running Error Handling Tests...');
  console.log('=' .repeat(50));
  
  // Test with non-existent file
  console.log('📋 Testing non-existent file...');
  try {
    const result = await pdfService.processPDFFromStorage('invalid/nonexistent.pdf');
    console.log('Non-existent file result:', {
      success: result.success,
      error: result.error,
      processingTime: result.processingTime
    });
  } catch (error) {
    console.error('Non-existent file error:', error.message);
  }
  
  // Test with invalid path
  console.log('\n📋 Testing invalid path...');
  try {
    const result = await pdfService.processPDFFromStorage('');
    console.log('Invalid path result:', {
      success: result.success,
      error: result.error
    });
  } catch (error) {
    console.error('Invalid path error:', error.message);
  }
}

async function runStatusTest(filePath) {
  console.log('\n🔄 Running Status Check Test...');
  console.log('=' .repeat(50));
  
  try {
    const status = await pdfService.getProcessingStatus(filePath);
    console.log(`📊 Current status for ${filePath}:`, status);
    
    if (status === null) {
      console.log('ℹ️  File not found in database');
    } else {
      console.log(`✅ Status retrieved: ${status}`);
    }
  } catch (error) {
    console.error('❌ Status check failed:', error);
  }
}

async function runReprocessingTest(filePath) {
  console.log('\n🔄 Running Reprocessing Test...');
  console.log('=' .repeat(50));
  
  try {
    await testReprocessing(filePath);
  } catch (error) {
    console.error('❌ Reprocessing test failed:', error);
  }
}

async function runPerformanceTest() {
  console.log('\n🔄 Running Performance Test...');
  console.log('=' .repeat(50));
  
  const testFiles = [
    'pdfs/small-sample.pdf',
    'pdfs/medium-sample.pdf',
    'pdfs/large-sample.pdf'
  ];
  
  for (const filePath of testFiles) {
    console.log(`\n📊 Testing performance for: ${filePath}`);
    const startTime = Date.now();
    
    try {
      const result = await pdfService.processPDFFromStorage(filePath);
      const totalTime = Date.now() - startTime;
      
      console.log(`   ⏱️  Total time: ${totalTime}ms`);
      console.log(`   ✅ Success: ${result.success}`);
      console.log(`   📄 Pages: ${result.pageCount || 'N/A'}`);
      console.log(`   💾 Size: ${result.fileSize ? Math.round(result.fileSize / 1024) + 'KB' : 'N/A'}`);
      console.log(`   🔄 Processing time: ${result.processingTime || 'N/A'}ms`);
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.log(`   ❌ Failed in ${totalTime}ms:`, error.message);
    }
  }
}

async function runAllTests(filePath) {
  console.log('🚀 Running Complete PDF Processing Test Suite');
  console.log('=' .repeat(60));
  
  await runBasicTest(filePath);
  await runCustomOptionsTest(filePath);
  await runStatusTest(filePath);
  await runErrorHandlingTest();
  await runReprocessingTest(filePath);
  await runPerformanceTest();
  
  console.log('\n✅ All tests completed!');
  console.log('=' .repeat(60));
}

function printUsage() {
  console.log(`
Usage: node scripts/test-pdf-processing.js [test-type] [file-path]

Test Types:
  basic       - Basic PDF processing test
  options     - Test with custom processing options
  status      - Check processing status
  errors      - Test error handling scenarios
  reprocess   - Test reprocessing functionality
  performance - Performance testing with multiple files
  all         - Run all tests (default)

Examples:
  node scripts/test-pdf-processing.js basic pdfs/sample.pdf
  node scripts/test-pdf-processing.js options pdfs/sample.pdf
  node scripts/test-pdf-processing.js all pdfs/sample.pdf
  node scripts/test-pdf-processing.js performance
  
Note: Make sure the file exists in your Supabase Storage before testing.
  `);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || 'all';
  const filePath = args[1] || 'pdfs/sample.pdf';
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }
  
  console.log(`🎯 Running test type: ${testType}`);
  console.log(`📄 Using file path: ${filePath}`);
  console.log(`⏰ Started at: ${new Date().toISOString()}\n`);
  
  try {
    switch (testType) {
      case 'basic':
        await runBasicTest(filePath);
        break;
      case 'options':
        await runCustomOptionsTest(filePath);
        break;
      case 'status':
        await runStatusTest(filePath);
        break;
      case 'errors':
        await runErrorHandlingTest();
        break;
      case 'reprocess':
        await runReprocessingTest(filePath);
        break;
      case 'performance':
        await runPerformanceTest();
        break;
      case 'all':
        await runAllTests(filePath);
        break;
      default:
        console.error(`❌ Unknown test type: ${testType}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('\n🚨 Test suite failed:', error);
    process.exit(1);
  }
  
  console.log(`\n⏰ Completed at: ${new Date().toISOString()}`);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('🚨 Unhandled promise rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught exception:', error);
  process.exit(1);
});

if (require.main === module) {
  main();
}

module.exports = {
  runBasicTest,
  runCustomOptionsTest,
  runErrorHandlingTest,
  runStatusTest,
  runReprocessingTest,
  runPerformanceTest,
  runAllTests
}; 