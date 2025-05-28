# ByteLecture Testing Guide - Tasks 4.3 & 4.4

This guide provides comprehensive testing instructions for the Upload Service (Task 4.3) and PDF Processing Service (Task 4.4).

## Prerequisites

### Environment Setup
1. **Supabase Configuration**: Ensure your Supabase project is properly configured
2. **API Keys**: Verify environment variables are set in both mobile and backend
3. **Database**: Run the database schema creation script
4. **Dependencies**: Install all required packages

### Required Test Files
- Small PDF (< 1MB): `test-files/small-sample.pdf`
- Medium PDF (1-5MB): `test-files/medium-sample.pdf`
- Large PDF (> 5MB): `test-files/large-sample.pdf`
- Corrupted PDF: `test-files/corrupted.pdf`
- Password-protected PDF: `test-files/protected.pdf`

## Part 1: Database Setup

### 1.1 Create Database Tables
```bash
cd backend
# Run the database schema
psql -h your-supabase-db-host -U postgres -d postgres -f database/pdf-processing-tables.sql
```

### 1.2 Verify Database Tables
```sql
-- Check if tables were created
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('processed_documents', 'document_sections', 'processing_queue');

-- Check indexes
SELECT indexname FROM pg_indexes WHERE tablename = 'processed_documents';
```

## Part 2: Backend Testing (Task 4.4)

### 2.1 Environment Setup
```bash
cd backend
npm install
npm run build
```

### 2.2 Test Database Connection
```bash
# Create a quick test file
node -e "
const { supabaseAdmin } = require('./dist/config/supabase');
supabaseAdmin.from('processed_documents').select('count').single()
  .then(result => console.log('✅ Database connected:', result))
  .catch(err => console.error('❌ Database error:', err));
"
```

### 2.3 Test PDF Processing Service

#### A. Basic Text Extraction Test
```bash
# Create test file: backend/test-pdf-basic.js
node -e "
const { pdfService } = require('./dist/services/pdfService');

async function testBasic() {
  console.log('Testing basic PDF processing...');
  
  // Replace with actual file path in your Supabase Storage
  const testFilePath = 'pdfs/test-document.pdf';
  
  try {
    const result = await pdfService.processPDFFromStorage(testFilePath);
    console.log('Result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

testBasic();
"
```

#### B. Test with Custom Options
```bash
node -e "
const { testPDFProcessingWithOptions } = require('./dist/utils/testPdfProcessing');

testPDFProcessingWithOptions('pdfs/test-document.pdf', {
  cleanText: true,
  detectSections: true,
  removeHeaders: true,
  removeFooters: true,
  preserveFormatting: false
});
"
```

#### C. Test Error Handling
```bash
node -e "
const { pdfService } = require('./dist/services/pdfService');

async function testErrorHandling() {
  // Test with non-existent file
  const result = await pdfService.processPDFFromStorage('invalid/path.pdf');
  console.log('Non-existent file result:', result);
  
  // Test corrupted file (if you have one)
  const corruptedResult = await pdfService.processPDFFromStorage('pdfs/corrupted.pdf');
  console.log('Corrupted file result:', corruptedResult);
}

testErrorHandling();
"
```

### 2.4 Test API Endpoints

#### A. Start the Server
```bash
npm run dev
```

#### B. Test Processing Endpoint
```bash
# Test POST /api/pdf/process
curl -X POST http://localhost:3000/api/pdf/process \
  -H "Content-Type: application/json" \
  -d '{
    "filePath": "pdfs/test-document.pdf",
    "options": {
      "cleanText": true,
      "detectSections": true,
      "removeHeaders": true
    }
  }'
```

#### C. Test Status Endpoint
```bash
# Test GET /api/pdf/status/:filePath
curl "http://localhost:3000/api/pdf/status/pdfs%2Ftest-document.pdf"
```

#### D. Test Reprocessing Endpoint
```bash
# Test POST /api/pdf/reprocess
curl -X POST http://localhost:3000/api/pdf/reprocess \
  -H "Content-Type: application/json" \
  -d '{"filePath": "pdfs/test-document.pdf"}'
```

#### E. Test Webhook Endpoint
```bash
# Test POST /api/pdf/webhook (simulates Supabase webhook)
curl -X POST http://localhost:3000/api/pdf/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "type": "INSERT",
    "record": {
      "name": "pdfs/new-document.pdf",
      "bucket_id": "documents"
    }
  }'
```

## Part 3: Mobile Testing (Task 4.3)

### 3.1 Environment Setup
```bash
cd mobile
npm install
```

### 3.2 Test Upload Service Unit Functions

#### A. Create Test File
```bash
# Create mobile/test-upload-service.js
node -e "
const { uploadService } = require('./src/services/uploadService');

async function testUploadService() {
  console.log('Testing upload service methods...');
  
  // Test bucket validation
  const canAccess = await uploadService.canAccessBucket();
  console.log('Can access bucket:', canAccess);
  
  // Test unique filename generation
  const filename = uploadService.generateUniqueFilename('test.pdf');
  console.log('Generated filename:', filename);
  
  // Test file validation
  const mockFile = { size: 5000000, type: 'application/pdf' }; // 5MB PDF
  const validation = uploadService.validateFile(mockFile);
  console.log('File validation:', validation);
}

testUploadService();
"
```

### 3.3 Test Upload Component (React Native)

#### A. Test in Development
```bash
# Start Metro bundler
npx expo start

# Test on device/simulator:
# 1. Navigate to PDF upload screen
# 2. Select a small PDF file
# 3. Monitor upload progress
# 4. Test cancellation feature
# 5. Try uploading different file types
# 6. Test with large files
# 7. Test network interruption scenarios
```

#### B. Component Testing Checklist
- [ ] File picker opens correctly
- [ ] File validation works (size, type)
- [ ] Upload progress displays accurately
- [ ] Cancel button functions properly
- [ ] Success/error messages appear
- [ ] Multiple file upload handling
- [ ] Network error recovery

### 3.4 Integration Testing (Upload + Processing)

#### A. End-to-End Flow
1. **Upload a PDF from mobile app**
2. **Verify file appears in Supabase Storage**
3. **Check if webhook triggers processing**
4. **Verify processing results in database**

```bash
# Check Supabase Storage via CLI or dashboard
# Check database for processed_documents entries
psql -h your-host -U postgres -c "SELECT * FROM processed_documents ORDER BY created_at DESC LIMIT 5;"
```

## Part 4: Performance Testing

### 4.1 Backend Performance
```bash
# Test with various file sizes
node -e "
const { pdfService } = require('./dist/services/pdfService');

async function performanceTest() {
  const files = [
    'pdfs/small-file.pdf',
    'pdfs/medium-file.pdf', 
    'pdfs/large-file.pdf'
  ];
  
  for (const file of files) {
    console.log(\`Testing \${file}...\`);
    const start = Date.now();
    const result = await pdfService.processPDFFromStorage(file);
    const duration = Date.now() - start;
    console.log(\`\${file}: \${duration}ms, Success: \${result.success}\`);
  }
}

performanceTest();
"
```

### 4.2 Upload Performance
- Test upload speeds with different file sizes
- Monitor memory usage during large uploads
- Test concurrent uploads
- Measure retry mechanism effectiveness

## Part 5: Error Scenarios Testing

### 5.1 Network Issues
- Disconnect network during upload
- Simulate slow network conditions
- Test timeout scenarios

### 5.2 File Issues
- Upload corrupted PDFs
- Try password-protected PDFs
- Test unsupported file formats
- Upload files exceeding size limits

### 5.3 Storage Issues
- Test with insufficient storage space
- Simulate Supabase service downtime
- Test with invalid authentication

## Part 6: Verification Checklist

### Upload Service (4.3)
- [ ] Files upload successfully to Supabase Storage
- [ ] Progress tracking works accurately
- [ ] Cancellation feature functions
- [ ] Error handling displays proper messages
- [ ] Retry mechanism activates on failures
- [ ] Large files use chunked upload
- [ ] File validation prevents invalid uploads

### PDF Processing Service (4.4)
- [ ] Text extraction works on various PDFs
- [ ] Metadata extraction captures PDF properties
- [ ] Text cleaning removes headers/footers
- [ ] Section detection identifies document structure
- [ ] Database storage saves all required fields
- [ ] API endpoints respond correctly
- [ ] Error handling manages corrupted files
- [ ] Webhook processing triggers automatically

### Integration
- [ ] Upload triggers processing automatically
- [ ] Processed data appears in database
- [ ] Mobile app can query processed results
- [ ] Error states propagate properly
- [ ] Performance meets requirements

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Check Supabase environment variables
   - Verify database schema is applied
   - Ensure RLS policies allow access

2. **Upload Failures**
   - Check Supabase Storage bucket configuration
   - Verify file permissions
   - Test network connectivity

3. **Processing Errors**
   - Check PDF.js worker configuration
   - Verify file accessibility in storage
   - Monitor server logs for detailed errors

4. **Mobile App Issues**
   - Clear Metro cache: `npx expo start -c`
   - Restart development server
   - Check device/simulator connectivity

### Debug Commands
```bash
# Backend logs
npm run dev | grep -E "(ERROR|WARN|INFO)"

# Check database connections
npm run test:db

# Monitor Supabase Storage
npm run test:storage

# Check processing queue
npm run test:queue
```

This comprehensive testing approach ensures both components work individually and integrate properly for the complete PDF upload and processing workflow. 