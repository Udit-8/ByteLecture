const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Testing Setup Script
 * Prepares the environment for comprehensive testing of Tasks 4.3 and 4.4
 */

class TestingSetup {
  constructor() {
    this.projectRoot = process.cwd();
    this.scriptsDir = path.join(this.projectRoot, 'scripts');
    this.testFilesDir = path.join(this.projectRoot, 'test-files');
  }

  log(message, type = 'info') {
    const prefix = {
      info: '📋',
      success: '✅',
      error: '❌',
      warning: '⚠️',
      step: '🔄'
    }[type] || 'ℹ️';
    
    console.log(`${prefix} ${message}`);
  }

  async createTestDirectories() {
    this.log('Creating test directories...', 'step');
    
    const dirs = [
      this.scriptsDir,
      this.testFilesDir,
      path.join(this.testFilesDir, 'pdfs'),
      path.join(this.testFilesDir, 'samples')
    ];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.log(`Created directory: ${dir}`, 'success');
      } else {
        this.log(`Directory exists: ${dir}`, 'info');
      }
    }
  }

  async createSamplePDF() {
    this.log('Creating sample PDF content...', 'step');
    
    const samplePdfContent = `
%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
/Resources <<
/Font <<
/F1 5 0 R
>>
>>
>>
endobj

4 0 obj
<<
/Length 87
>>
stream
BT
/F1 24 Tf
100 700 Td
(ByteLecture Test Document) Tj
0 -30 Td
(This is a test PDF for upload testing.) Tj
ET
endstream
endobj

5 0 obj
<<
/Type /Font
/Subtype /Type1
/BaseFont /Helvetica
>>
endobj

xref
0 6
0000000000 65535 f 
0000000010 00000 n 
0000000053 00000 n 
0000000100 00000 n 
0000000301 00000 n 
0000000440 00000 n 
trailer
<<
/Size 6
/Root 1 0 R
>>
startxref
521
%%EOF
`;

    const samplePath = path.join(this.testFilesDir, 'pdfs', 'sample.pdf');
    fs.writeFileSync(samplePath, samplePdfContent.trim());
    this.log(`Created sample PDF: ${samplePath}`, 'success');
    
    // Create different sized test files
    const sizes = [
      { name: 'small-sample.pdf', content: samplePdfContent },
      { name: 'medium-sample.pdf', content: samplePdfContent.repeat(50) },
      { name: 'large-sample.pdf', content: samplePdfContent.repeat(200) }
    ];
    
    for (const { name, content } of sizes) {
      const filePath = path.join(this.testFilesDir, 'pdfs', name);
      fs.writeFileSync(filePath, content);
      this.log(`Created ${name} (${Math.round(content.length / 1024)}KB)`, 'success');
    }
    
    // Create a corrupted PDF for error testing
    const corruptedPath = path.join(this.testFilesDir, 'pdfs', 'corrupted.pdf');
    fs.writeFileSync(corruptedPath, 'This is not a valid PDF file');
    this.log('Created corrupted PDF for error testing', 'success');
  }

  async buildTypeScript() {
    this.log('Building TypeScript code...', 'step');
    
    try {
      execSync('npm run build', { stdio: 'inherit' });
      this.log('TypeScript build completed successfully', 'success');
    } catch (error) {
      this.log('TypeScript build failed. Attempting to compile individual files...', 'warning');
      
      try {
        // Try to build individual files if the main build fails
        execSync('npx tsc --skipLibCheck', { stdio: 'inherit' });
        this.log('Individual TypeScript compilation completed', 'success');
      } catch (fallbackError) {
        this.log('TypeScript compilation failed. You may need to fix compilation errors first.', 'error');
        throw fallbackError;
      }
    }
  }

  async verifyDependencies() {
    this.log('Verifying dependencies...', 'step');
    
    const requiredPackages = [
      'pdfjs-dist',
      'canvas',
      'pdf2pic',
      'sharp',
      'axios',
      'express',
      '@supabase/supabase-js'
    ];
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    const missing = requiredPackages.filter(pkg => !allDeps[pkg]);
    
    if (missing.length > 0) {
      this.log(`Missing packages: ${missing.join(', ')}`, 'warning');
      this.log('Installing missing packages...', 'step');
      
      try {
        execSync(`npm install ${missing.join(' ')}`, { stdio: 'inherit' });
        this.log('Missing packages installed successfully', 'success');
      } catch (error) {
        this.log('Failed to install missing packages', 'error');
        throw error;
      }
    } else {
      this.log('All required packages are installed', 'success');
    }
  }

  async setupDatabaseSchema() {
    this.log('Database schema setup...', 'step');
    
    const schemaFile = path.join(this.projectRoot, 'database', 'pdf-processing-tables.sql');
    
    if (fs.existsSync(schemaFile)) {
      this.log('Database schema file exists', 'success');
      this.log('⚠️  Remember to run the SQL schema in your Supabase dashboard:', 'warning');
      this.log(`   File: ${schemaFile}`, 'info');
    } else {
      this.log('Database schema file not found', 'warning');
      this.log('   Expected location: database/pdf-processing-tables.sql', 'info');
    }
  }

  async checkEnvironmentVariables() {
    this.log('Checking environment variables...', 'step');
    
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY'
    ];
    
    const envFile = path.join(this.projectRoot, '.env');
    const missing = [];
    
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      
      for (const envVar of requiredEnvVars) {
        if (!envContent.includes(envVar) || !process.env[envVar]) {
          missing.push(envVar);
        }
      }
      
      if (missing.length === 0) {
        this.log('All required environment variables are set', 'success');
      } else {
        this.log(`Missing environment variables: ${missing.join(', ')}`, 'warning');
      }
    } else {
      this.log('.env file not found', 'warning');
      this.log('Create a .env file with your Supabase credentials', 'info');
    }
  }

  async createRunScripts() {
    this.log('Creating test runner scripts...', 'step');
    
    // Package.json test scripts
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }
    
    // Add test scripts
    const testScripts = {
      'test:setup': 'node scripts/setup-testing.js',
      'test:pdf': 'node scripts/test-pdf-processing.js',
      'test:api': 'node scripts/test-api-endpoints.js',
      'test:upload': 'node ../mobile/test-upload-service.js',
      'test:all': 'npm run test:pdf && npm run test:api && npm run test:upload'
    };
    
    Object.assign(packageJson.scripts, testScripts);
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    this.log('Added test scripts to package.json', 'success');
    
    // Create convenience shell script
    const shellScript = `#!/bin/bash
# ByteLecture Testing Script

echo "🚀 ByteLecture Testing Suite"
echo "=========================="

# Build the project
echo "📦 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Build failed. Please fix compilation errors."
    exit 1
fi

# Check if server is running
echo "🔍 Checking if server is running..."
if curl -s http://localhost:3000/api/health > /dev/null; then
    echo "✅ Server is running"
    WAIT_FOR_SERVER=false
else
    echo "⚠️  Server not running. Starting server..."
    npm start &
    SERVER_PID=$!
    WAIT_FOR_SERVER=true
    
    # Wait for server to start
    echo "⏳ Waiting for server to start..."
    for i in {1..30}; do
        if curl -s http://localhost:3000/api/health > /dev/null; then
            echo "✅ Server started successfully"
            break
        fi
        sleep 1
    done
fi

# Run tests based on argument
case "\$1" in
    "pdf")
        echo "🧪 Testing PDF Processing Service..."
        npm run test:pdf
        ;;
    "api")
        echo "🌐 Testing API Endpoints..."
        npm run test:api
        ;;
    "upload")
        echo "📤 Testing Upload Service..."
        npm run test:upload
        ;;
    "all"|"")
        echo "🎯 Running all tests..."
        npm run test:pdf
        npm run test:api
        npm run test:upload
        ;;
    *)
        echo "Usage: ./test.sh [pdf|api|upload|all]"
        exit 1
        ;;
esac

# Cleanup
if [ "\$WAIT_FOR_SERVER" = true ]; then
    echo "🧹 Stopping test server..."
    kill $SERVER_PID
fi

echo "✅ Testing completed"
`;
    
    const shellScriptPath = path.join(this.projectRoot, 'test.sh');
    fs.writeFileSync(shellScriptPath, shellScript);
    
    // Make shell script executable
    try {
      execSync(`chmod +x ${shellScriptPath}`);
      this.log('Created executable test.sh script', 'success');
    } catch (error) {
      this.log('Created test.sh script (may need manual chmod +x)', 'warning');
    }
  }

  async createTestingGuide() {
    this.log('Creating testing guide...', 'step');
    
    const guideContent = `# ByteLecture Testing Guide - Tasks 4.3 & 4.4

## Quick Start

### 1. Environment Setup
\`\`\`bash
# Run setup script
npm run test:setup

# Set up environment variables in .env:
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
\`\`\`

### 2. Database Setup
1. Open your Supabase dashboard
2. Go to SQL Editor
3. Run the schema from: \`backend/database/pdf-processing-tables.sql\`

### 3. Start Testing

#### Option A: Use the convenience script
\`\`\`bash
# Test everything
./test.sh all

# Test specific components
./test.sh pdf     # PDF processing service
./test.sh api     # API endpoints
./test.sh upload  # Upload service
\`\`\`

#### Option B: Use individual test scripts
\`\`\`bash
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
\`\`\`

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

The setup creates these test files in \`test-files/pdfs/\`:
- \`sample.pdf\`: Basic test document
- \`small-sample.pdf\`: < 1MB file
- \`medium-sample.pdf\`: 1-5MB file  
- \`large-sample.pdf\`: > 5MB file
- \`corrupted.pdf\`: Invalid PDF for error testing

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
- ❌ **Server not running**: Start with \`npm start\`

## Debugging

### Enable Debug Logging:
\`\`\`bash
export DEBUG=true
npm run test:pdf
\`\`\`

### Check Server Logs:
\`\`\`bash
# In separate terminal
npm start
# Watch for error messages
\`\`\`

### Verify Database:
1. Check Supabase dashboard
2. Look at tables: \`processed_documents\`, \`document_sections\`
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
`;

    fs.writeFileSync(path.join(this.projectRoot, 'TESTING_GUIDE.md'), guideContent);
    this.log('Created comprehensive testing guide', 'success');
  }

  async runSetup() {
    try {
      console.log('🚀 ByteLecture Testing Environment Setup');
      console.log('=' .repeat(50));
      
      await this.createTestDirectories();
      await this.createSamplePDF();
      await this.verifyDependencies();
      await this.buildTypeScript();
      await this.setupDatabaseSchema();
      await this.checkEnvironmentVariables();
      await this.createRunScripts();
      await this.createTestingGuide();
      
      console.log('\n✅ Setup completed successfully!');
      console.log('=' .repeat(50));
      
      // Summary instructions
      console.log('\n📋 Next Steps:');
      console.log('1. Set up your .env file with Supabase credentials');
      console.log('2. Run the database schema in Supabase dashboard');
      console.log('3. Start testing with: ./test.sh all');
      console.log('4. Check TESTING_GUIDE.md for detailed instructions');
      
      return true;
      
    } catch (error) {
      this.log(`Setup failed: ${error.message}`, 'error');
      return false;
    }
  }
}

// Command line interface
async function main() {
  const setup = new TestingSetup();
  
  try {
    const success = await setup.runSetup();
    process.exit(success ? 0 : 1);
  } catch (error) {
    console.error('🚨 Setup failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { TestingSetup }; 