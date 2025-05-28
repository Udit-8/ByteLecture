# ByteLecture Testing Guide - Tasks 4.3 & 4.4

## Quick Start

### 1. Environment Setup
```bash
# Run setup script
npm run test:setup

# Set up environment variables in .env:
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### 2. Database Setup
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Run the schema from: `backend/database/pdf-processing-tables.sql`

### 3. Start Testing

#### Option A: Use the convenience script
```bash
# Test everything
./test.sh all

# Test specific components
./test.sh pdf     # PDF processing service
./test.sh api     # API endpoints
./test.sh upload  # Upload service
```

#### Option B: Use individual test scripts
```bash
# PDF Processing Service Tests
npm run test:pdf all                    # All tests
npm run test:pdf basic pdfs/sample.pdf  # Basic test
npm run test:pdf performance            # Performance test

# API Endpoint Tests
npm run test:api all                    # All API tests
npm run test:api health                 # Health check only
npm run test:api process pdfs/sample.pdf # Process endpoint

# Upload Service Tests  
npm run test:upload all                 # All upload tests
npm run test:upload validation          # Validation only
```

## Test Components

### Task 4.3 - Upload Service
- **File validation**: Size, type, format checks
- **Filename generation**: Unique naming with timestamps
- **Bucket access**: Supabase Storage connectivity
- **Upload functionality**: Basic and progress-tracked uploads
- **Error handling**: Invalid files, network issues

### Task 4.4 - PDF Processing Service
- **PDF parsing**: Text extraction using PDF.js
- **Text preprocessing**: Cleaning and section detection
- **Database operations**: Storing processed content
- **Status tracking**: Processing progress monitoring
- **Error handling**: Corrupted/invalid PDFs
- **API endpoints**: REST API for all operations

## Test Files

The setup creates these test files in `test-files/pdfs/`:
- `sample.pdf`: Basic test document
- `small-sample.pdf`: < 1MB file
- `medium-sample.pdf`: 1-5MB file  
- `large-sample.pdf`: > 5MB file
- `corrupted.pdf`: Invalid PDF for error testing

## Expected Results

### Successful Tests Should Show:
- ✅ File validation passes for valid PDFs
- ✅ Unique filenames generated consistently
- ✅ Supabase Storage upload/access works
- ✅ PDF text extraction completes
- ✅ Database storage operations succeed
- ✅ API endpoints return proper responses
- ✅ Error handling works for invalid inputs

### Common Issues:
- ❌ **Supabase connection**: Check environment variables
- ❌ **Database errors**: Ensure schema is created
- ❌ **Build failures**: Fix TypeScript compilation errors
- ❌ **Permission errors**: Check Supabase policies
- ❌ **Server not running**: Start with `npm start`

## Debugging

### Enable Debug Logging:
```bash
export DEBUG=true
npm run test:pdf
```

### Check Server Logs:
```bash
# In separate terminal
npm start
# Watch for error messages
```

### Verify Database:
1. Check Supabase dashboard
2. Look at tables: `processed_documents`, `document_sections`
3. Verify Row Level Security policies

## Integration Testing

After individual component tests pass:

1. **Upload → Process Flow**:
   - Upload PDF via mobile service
   - Trigger processing via API
   - Verify database storage
   - Check processing status

2. **End-to-End Workflow**:
   - Mobile app uploads file
   - Backend processes automatically
   - Results available in database
   - API returns processed content

## Performance Benchmarks

Expected processing times:
- Small PDF (< 1MB): < 2 seconds
- Medium PDF (1-5MB): < 10 seconds  
- Large PDF (> 5MB): < 30 seconds

Monitor memory usage and processing efficiency.
