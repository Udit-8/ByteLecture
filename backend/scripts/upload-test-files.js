const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Upload Test Files to Supabase Storage
 * This script uploads the generated test PDF files to Supabase Storage
 * so they can be used in PDF processing tests.
 */

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUCKET_NAME = 'documents';
const TEST_FILES_DIR = path.join(__dirname, '..', 'test-files', 'pdfs');

async function uploadTestFiles() {
  console.log('🚀 Starting test file upload to Supabase Storage...');
  console.log('=' .repeat(60));
  
  try {
    // Check if bucket exists, create if it doesn't
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      console.error('❌ Failed to list buckets:', bucketsError);
      return;
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      console.log(`📦 Creating bucket: ${BUCKET_NAME}...`);
      const { error: createError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
        allowedMimeTypes: ['application/pdf'],
        fileSizeLimit: 50 * 1024 * 1024, // 50MB
      });
      
      if (createError) {
        console.error('❌ Failed to create bucket:', createError);
        return;
      }
      
      console.log('✅ Bucket created successfully');
    } else {
      console.log(`✅ Bucket '${BUCKET_NAME}' already exists`);
    }
    
    // Get list of test files
    const testFiles = fs.readdirSync(TEST_FILES_DIR).filter(file => file.endsWith('.pdf'));
    
    console.log(`\n📁 Found ${testFiles.length} test PDF files to upload:`);
    testFiles.forEach(file => console.log(`   - ${file}`));
    
    // Upload each file
    const uploadResults = [];
    
    for (const fileName of testFiles) {
      const filePath = path.join(TEST_FILES_DIR, fileName);
      const fileBuffer = fs.readFileSync(filePath);
      const storageKey = `pdfs/${fileName}`;
      
      console.log(`\n📤 Uploading ${fileName}...`);
      console.log(`   📏 Size: ${Math.round(fileBuffer.length / 1024)}KB`);
      console.log(`   🔑 Storage key: ${storageKey}`);
      
      const { data, error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(storageKey, fileBuffer, {
          contentType: 'application/pdf',
          upsert: true, // Overwrite if exists
        });
      
      if (error) {
        console.error(`   ❌ Upload failed: ${error.message}`);
        uploadResults.push({ file: fileName, success: false, error: error.message });
      } else {
        console.log(`   ✅ Upload successful`);
        console.log(`   🔗 Path: ${data.path}`);
        uploadResults.push({ file: fileName, success: true, path: data.path });
      }
    }
    
    // Summary
    console.log('\n📊 Upload Summary:');
    console.log('=' .repeat(40));
    
    const successful = uploadResults.filter(r => r.success);
    const failed = uploadResults.filter(r => !r.success);
    
    console.log(`✅ Successful uploads: ${successful.length}`);
    successful.forEach(result => {
      console.log(`   - ${result.file} → ${result.path}`);
    });
    
    if (failed.length > 0) {
      console.log(`\n❌ Failed uploads: ${failed.length}`);
      failed.forEach(result => {
        console.log(`   - ${result.file}: ${result.error}`);
      });
    }
    
    console.log('\n🎉 Test file upload completed!');
    console.log('\n💡 You can now run PDF processing tests:');
    console.log('   npm run test:pdf basic');
    console.log('   npm run test:pdf performance');
    console.log('   npm run test:pdf all');
    
  } catch (error) {
    console.error('💥 Unexpected error during upload:', error);
  }
}

// Verify environment variables
function checkEnvironment() {
  const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach(env => console.error(`   - ${env}`));
    console.error('\n💡 Make sure your .env file is properly configured.');
    return false;
  }
  
  return true;
}

// Main execution
if (require.main === module) {
  if (!checkEnvironment()) {
    process.exit(1);
  }
  
  uploadTestFiles().catch(error => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });
}

module.exports = { uploadTestFiles }; 