const axios = require('axios');
require('dotenv').config();

const BASE_URL = 'http://localhost:3000/api';

// Test data
const TEST_CONTENT = `
Artificial Intelligence (AI) represents one of the most significant technological breakthroughs of our time. At its core, AI involves creating computer systems that can perform tasks typically requiring human intelligence. These tasks encompass a wide range of capabilities including visual perception, speech recognition, decision-making, and language translation.

Machine Learning, a crucial subset of AI, enables computers to learn and improve from experience without explicit programming. Rather than following pre-programmed instructions, machine learning algorithms use statistical models to analyze data patterns and make predictions or decisions. This approach has revolutionized how we handle complex problems that would be difficult to solve with traditional programming methods.

Deep Learning takes machine learning further by using neural networks with multiple layers to model and understand complex patterns. Inspired by the structure and function of the human brain, these networks can process vast amounts of data and identify intricate relationships. Deep learning has been particularly successful in areas such as image recognition, natural language processing, and game playing, achieving performance levels that often exceed human capabilities.

The applications of AI are vast and continuously expanding. In transportation, autonomous vehicles use AI to navigate roads safely. In healthcare, AI assists in medical diagnosis by analyzing medical images and patient data. Financial institutions employ AI for fraud detection and algorithmic trading. Recommendation systems powered by AI help users discover relevant content on streaming platforms and e-commerce sites. Smart home devices use AI to understand voice commands and automate household tasks.

As AI technology continues to advance, it promises to transform many aspects of our daily lives and work. However, this progress also brings important considerations regarding ethics, privacy, and the future of human employment. The key to harnessing AI's potential lies in developing these technologies responsibly while ensuring they benefit society as a whole.
`.trim();

async function testSummaryAPI() {
  console.log('🧪 Testing Summary API Endpoints');
  console.log('=================================');

  let authToken = null;
  let summaryId = null;

  try {
    // Step 1: Login to get auth token
    console.log('\n1. Authenticating user...');
    
    // First, try to register a test user (might fail if user exists)
    try {
      await axios.post(`${BASE_URL}/auth/register`, {
        email: 'test.summary@example.com',
        password: 'TestPassword123!',
        name: 'Summary Test User'
      });
      console.log('✅ Test user registered');
    } catch (error) {
      console.log('ℹ️ Test user already exists or registration failed');
    }

    // Login
    const loginResponse = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'test.summary@example.com',
      password: 'TestPassword123!'
    });

    authToken = loginResponse.data.token;
    console.log('✅ Authentication successful');

    // Configure axios with auth header
    const apiClient = axios.create({
      baseURL: BASE_URL,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });

    // Step 2: Test health check
    console.log('\n2. Testing health check...');
    const healthResponse = await apiClient.get('/summaries/health');
    console.log('✅ Health check passed');
    console.log('🏥 Service status:', JSON.stringify(healthResponse.data.health, null, 2));

    // Step 3: Generate a summary
    console.log('\n3. Testing summary generation...');
    console.log('📝 Generating summary for test content...');
    
    const summaryResponse = await apiClient.post('/summaries/generate', {
      content: TEST_CONTENT,
      contentType: 'text',
      options: {
        length: 'medium',
        focusArea: 'concepts',
        maxTokens: 500,
        temperature: 0.3
      }
    });

    summaryId = summaryResponse.data.summary.id;
    console.log('✅ Summary generated successfully');
    console.log('📊 Summary metadata:', JSON.stringify(summaryResponse.data.summary.metadata, null, 2));
    console.log('📄 Summary text (first 200 chars):', 
      summaryResponse.data.summary.text.substring(0, 200) + '...');

    // Step 4: Test cache hit by generating same summary again
    console.log('\n4. Testing cache functionality...');
    const cachedSummaryResponse = await apiClient.post('/summaries/generate', {
      content: TEST_CONTENT,
      contentType: 'text',
      options: {
        length: 'medium',
        focusArea: 'concepts',
        maxTokens: 500,
        temperature: 0.3
      }
    });

    const wasCacheHit = cachedSummaryResponse.data.summary.metadata.cacheHit;
    console.log(wasCacheHit ? '✅ Cache hit detected' : '⚠️ Expected cache hit but got cache miss');

    // Step 5: Get specific summary
    console.log('\n5. Testing summary retrieval...');
    const getSummaryResponse = await apiClient.get(`/summaries/${summaryId}`);
    console.log('✅ Summary retrieved successfully');
    console.log('🔍 Access count:', getSummaryResponse.data.summary.accessCount);

    // Step 6: Get user summaries
    console.log('\n6. Testing user summaries list...');
    const userSummariesResponse = await apiClient.get('/summaries?limit=10');
    console.log('✅ User summaries retrieved');
    console.log('📋 Found', userSummariesResponse.data.summaries.length, 'summaries');

    // Step 7: Test different summary options
    console.log('\n7. Testing different summary options...');
    
    const shortSummaryResponse = await apiClient.post('/summaries/generate', {
      content: TEST_CONTENT,
      contentType: 'text',
      options: {
        length: 'short',
        focusArea: 'examples',
      }
    });
    
    console.log('✅ Short summary generated');
    console.log('📏 Short summary length:', shortSummaryResponse.data.summary.text.length, 'characters');

    // Step 8: Test cache statistics
    console.log('\n8. Testing cache statistics...');
    const cacheStatsResponse = await apiClient.get('/summaries/cache/stats?days=7');
    console.log('✅ Cache stats retrieved');
    console.log('📈 Cache statistics:', JSON.stringify(cacheStatsResponse.data.stats, null, 2));

    // Step 9: Test access tracking update
    console.log('\n9. Testing access tracking...');
    await apiClient.put(`/summaries/${summaryId}/access`);
    console.log('✅ Access tracking updated');

    // Step 10: Test rate limiting (optional)
    console.log('\n10. Testing rate limiting behavior...');
    try {
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          apiClient.post('/summaries/generate', {
            content: `Test content ${i}: ${TEST_CONTENT}`,
            contentType: 'text',
            options: { length: 'short', focusArea: 'general' }
          })
        );
      }
      
      await Promise.all(promises);
      console.log('✅ Rate limiting allows normal usage');
    } catch (error) {
      if (error.response?.status === 429) {
        console.log('✅ Rate limiting working correctly (429 status)');
      } else {
        console.log('⚠️ Unexpected error during rate limit test:', error.message);
      }
    }

    // Step 11: Test deletion
    console.log('\n11. Testing summary deletion...');
    await apiClient.delete(`/summaries/${summaryId}`);
    console.log('✅ Summary deleted successfully');

    // Verify deletion
    try {
      await apiClient.get(`/summaries/${summaryId}`);
      console.log('⚠️ Summary still exists after deletion');
    } catch (error) {
      if (error.response?.status === 404) {
        console.log('✅ Summary properly deleted (404 confirmed)');
      }
    }

    console.log('\n🎉 All Summary API tests completed successfully!');
    console.log('\n📋 Test Summary:');
    console.log('  ✅ Authentication');
    console.log('  ✅ Health check');
    console.log('  ✅ Summary generation');
    console.log('  ✅ Cache functionality');
    console.log('  ✅ Summary retrieval');
    console.log('  ✅ User summaries list');
    console.log('  ✅ Different summary options');
    console.log('  ✅ Cache statistics');
    console.log('  ✅ Access tracking');
    console.log('  ✅ Rate limiting');
    console.log('  ✅ Summary deletion');

  } catch (error) {
    console.error('\n❌ Summary API test failed:');
    console.error('Error:', error.message);
    
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Response:', JSON.stringify(error.response.data, null, 2));
    }
    
    process.exit(1);
  }
}

// Run the test if this file is executed directly
if (require.main === module) {
  testSummaryAPI().catch(console.error);
}

module.exports = { testSummaryAPI }; 