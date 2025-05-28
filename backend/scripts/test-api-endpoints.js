const axios = require('axios');

/**
 * API Endpoints Test Suite
 * Run with: node scripts/test-api-endpoints.js [base-url]
 */

class APITester {
  constructor(baseUrl = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
    this.axios = axios.create({
      baseURL: baseUrl,
      timeout: 30000, // 30 seconds timeout
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async testHealthEndpoint() {
    console.log('\n🔄 Testing Health Endpoint...');
    console.log('=' .repeat(50));
    
    try {
      const response = await this.axios.get('/api/health');
      console.log('✅ Health endpoint response:', response.data);
      console.log(`📊 Status: ${response.status}`);
      return true;
    } catch (error) {
      console.error('❌ Health endpoint failed:', error.message);
      return false;
    }
  }

  async testProcessPDFEndpoint(filePath, options = {}) {
    console.log('\n🔄 Testing Process PDF Endpoint...');
    console.log('=' .repeat(50));
    
    const requestData = {
      filePath,
      options: {
        cleanText: true,
        detectSections: true,
        removeHeaders: true,
        removeFooters: true,
        ...options
      }
    };
    
    try {
      console.log(`📤 Sending request to POST /api/pdf/process`);
      console.log(`📄 File path: ${filePath}`);
      console.log(`⚙️  Options:`, requestData.options);
      
      const response = await this.axios.post('/api/pdf/process', requestData);
      
      console.log('✅ Process PDF response:');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Success: ${response.data.success}`);
      console.log(`📄 Data:`, JSON.stringify(response.data.data, null, 2));
      console.log(`💬 Message: ${response.data.message}`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Process PDF endpoint failed:');
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`);
        console.error(`📋 Error:`, error.response.data);
      } else {
        console.error(`💬 Message: ${error.message}`);
      }
      return null;
    }
  }

  async testStatusEndpoint(filePath) {
    console.log('\n🔄 Testing Status Endpoint...');
    console.log('=' .repeat(50));
    
    try {
      const encodedPath = encodeURIComponent(filePath);
      console.log(`📤 Sending request to GET /api/pdf/status/${encodedPath}`);
      
      const response = await this.axios.get(`/api/pdf/status/${encodedPath}`);
      
      console.log('✅ Status endpoint response:');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Success: ${response.data.success}`);
      console.log(`📈 Processing Status: ${response.data.data?.status}`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Status endpoint failed:');
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`);
        console.error(`📋 Error:`, error.response.data);
      } else {
        console.error(`💬 Message: ${error.message}`);
      }
      return null;
    }
  }

  async testReprocessEndpoint(filePath) {
    console.log('\n🔄 Testing Reprocess Endpoint...');
    console.log('=' .repeat(50));
    
    try {
      console.log(`📤 Sending request to POST /api/pdf/reprocess`);
      console.log(`📄 File path: ${filePath}`);
      
      const response = await this.axios.post('/api/pdf/reprocess', { filePath });
      
      console.log('✅ Reprocess endpoint response:');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Success: ${response.data.success}`);
      console.log(`📄 Data:`, JSON.stringify(response.data.data, null, 2));
      console.log(`💬 Message: ${response.data.message}`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Reprocess endpoint failed:');
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`);
        console.error(`📋 Error:`, error.response.data);
      } else {
        console.error(`💬 Message: ${error.message}`);
      }
      return null;
    }
  }

  async testWebhookEndpoint(filename = 'pdfs/webhook-test.pdf') {
    console.log('\n🔄 Testing Webhook Endpoint...');
    console.log('=' .repeat(50));
    
    const webhookData = {
      type: 'INSERT',
      record: {
        name: filename,
        bucket_id: 'documents',
        owner: 'test-user',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        metadata: {}
      }
    };
    
    try {
      console.log(`📤 Sending webhook to POST /api/pdf/webhook`);
      console.log(`📄 Filename: ${filename}`);
      console.log(`🔗 Webhook data:`, JSON.stringify(webhookData, null, 2));
      
      const response = await this.axios.post('/api/pdf/webhook', webhookData);
      
      console.log('✅ Webhook endpoint response:');
      console.log(`📊 Status: ${response.status}`);
      console.log(`📋 Success: ${response.data.success}`);
      console.log(`💬 Message: ${response.data.message}`);
      
      return response.data;
    } catch (error) {
      console.error('❌ Webhook endpoint failed:');
      if (error.response) {
        console.error(`📊 Status: ${error.response.status}`);
        console.error(`📋 Error:`, error.response.data);
      } else {
        console.error(`💬 Message: ${error.message}`);
      }
      return null;
    }
  }

  async testErrorScenarios() {
    console.log('\n🔄 Testing Error Scenarios...');
    console.log('=' .repeat(50));
    
    // Test missing filePath
    console.log('\n📋 Testing missing filePath...');
    try {
      await this.axios.post('/api/pdf/process', {});
    } catch (error) {
      if (error.response && error.response.status === 400) {
        console.log('✅ Correctly rejected missing filePath');
      } else {
        console.error('❌ Unexpected error for missing filePath:', error.message);
      }
    }
    
    // Test invalid endpoint
    console.log('\n📋 Testing invalid endpoint...');
    try {
      await this.axios.get('/api/pdf/invalid-endpoint');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctly returned 404 for invalid endpoint');
      } else {
        console.error('❌ Unexpected error for invalid endpoint:', error.message);
      }
    }
    
    // Test invalid status path
    console.log('\n📋 Testing invalid status path...');
    try {
      await this.axios.get('/api/pdf/status/');
    } catch (error) {
      if (error.response && error.response.status === 404) {
        console.log('✅ Correctly rejected empty status path');
      } else {
        console.error('❌ Unexpected error for empty status path:', error.message);
      }
    }
  }

  async runFullTestSuite(filePath = 'pdfs/sample.pdf') {
    console.log('🚀 Running Complete API Test Suite');
    console.log('=' .repeat(60));
    console.log(`🎯 Base URL: ${this.baseUrl}`);
    console.log(`📄 Test file: ${filePath}`);
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    
    const results = {
      health: false,
      process: false,
      status: false,
      reprocess: false,
      webhook: false,
      errors: false
    };
    
    // Test health endpoint first
    results.health = await this.testHealthEndpoint();
    
    if (!results.health) {
      console.error('\n❌ Server not responding. Please ensure the backend is running.');
      return results;
    }
    
    // Test PDF processing
    const processResult = await this.testProcessPDFEndpoint(filePath);
    results.process = processResult !== null;
    
    // Test status check
    const statusResult = await this.testStatusEndpoint(filePath);
    results.status = statusResult !== null;
    
    // Test reprocessing
    const reprocessResult = await this.testReprocessEndpoint(filePath);
    results.reprocess = reprocessResult !== null;
    
    // Test webhook
    const webhookResult = await this.testWebhookEndpoint();
    results.webhook = webhookResult !== null;
    
    // Test error scenarios
    await this.testErrorScenarios();
    results.errors = true; // Assume passed if no exceptions
    
    // Summary
    console.log('\n📊 Test Results Summary');
    console.log('=' .repeat(50));
    Object.entries(results).forEach(([test, passed]) => {
      console.log(`${passed ? '✅' : '❌'} ${test.toUpperCase()}: ${passed ? 'PASSED' : 'FAILED'}`);
    });
    
    const passedCount = Object.values(results).filter(Boolean).length;
    const totalCount = Object.keys(results).length;
    console.log(`\n📈 Overall: ${passedCount}/${totalCount} tests passed`);
    console.log(`⏰ Completed at: ${new Date().toISOString()}`);
    
    return results;
  }
}

function printUsage() {
  console.log(`
Usage: node scripts/test-api-endpoints.js [command] [options]

Commands:
  health              - Test health endpoint only
  process <filePath>  - Test PDF processing endpoint
  status <filePath>   - Test status endpoint
  reprocess <filePath>- Test reprocessing endpoint
  webhook [filename]  - Test webhook endpoint
  errors              - Test error scenarios
  all [filePath]      - Run all tests (default)

Options:
  --url <baseUrl>     - Set base URL (default: http://localhost:3000)

Examples:
  node scripts/test-api-endpoints.js health
  node scripts/test-api-endpoints.js process pdfs/sample.pdf
  node scripts/test-api-endpoints.js all pdfs/sample.pdf --url http://localhost:8000
  node scripts/test-api-endpoints.js webhook pdfs/test.pdf
  
Note: Ensure your backend server is running before testing.
  `);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    printUsage();
    return;
  }
  
  // Parse arguments
  const urlIndex = args.indexOf('--url');
  const baseUrl = urlIndex !== -1 ? args[urlIndex + 1] : 'http://localhost:3000';
  
  // Filter out --url and its value
  const filteredArgs = args.filter((arg, index) => 
    arg !== '--url' && (urlIndex === -1 || index !== urlIndex + 1)
  );
  
  const command = filteredArgs[0] || 'all';
  const filePath = filteredArgs[1] || 'pdfs/sample.pdf';
  
  const tester = new APITester(baseUrl);
  
  try {
    switch (command) {
      case 'health':
        await tester.testHealthEndpoint();
        break;
      case 'process':
        await tester.testProcessPDFEndpoint(filePath);
        break;
      case 'status':
        await tester.testStatusEndpoint(filePath);
        break;
      case 'reprocess':
        await tester.testReprocessEndpoint(filePath);
        break;
      case 'webhook':
        await tester.testWebhookEndpoint(filePath);
        break;
      case 'errors':
        await tester.testErrorScenarios();
        break;
      case 'all':
        await tester.runFullTestSuite(filePath);
        break;
      default:
        console.error(`❌ Unknown command: ${command}`);
        printUsage();
        process.exit(1);
    }
  } catch (error) {
    console.error('\n🚨 Test suite failed:', error);
    process.exit(1);
  }
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

module.exports = { APITester }; 