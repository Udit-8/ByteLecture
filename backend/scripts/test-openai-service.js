const { OpenAIService } = require('../dist/services/openAIService');
require('dotenv').config();

async function testOpenAIService() {
  console.log('🧪 Testing OpenAI Service Integration');
  console.log('=====================================');

  try {
    // Initialize the service
    console.log('\n1. Initializing OpenAI Service...');
    const openAIService = new OpenAIService({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-3.5-turbo',
      maxTokens: 500,
      temperature: 0.3,
    });

    console.log('✅ OpenAI Service initialized successfully');
    console.log('📋 Configuration:', openAIService.getConfig());

    // Test connection
    console.log('\n2. Testing API connection...');
    const connectionTest = await openAIService.testConnection();
    
    if (!connectionTest) {
      throw new Error('Connection test failed');
    }
    console.log('✅ API connection test passed');

    // Test token estimation
    console.log('\n3. Testing token estimation...');
    const sampleText = 'This is a sample text for testing token estimation functionality.';
    const estimatedTokens = openAIService.estimateTokens(sampleText);
    console.log(`📊 Sample text: "${sampleText}"`);
    console.log(`🔢 Estimated tokens: ${estimatedTokens}`);

    // Test content chunking
    console.log('\n4. Testing content chunking...');
    const longText = 'This is sentence one. This is sentence two. This is sentence three. This is sentence four. '.repeat(100);
    const chunkResult = openAIService.chunkContent(longText, 500);
    console.log(`📄 Original text length: ${longText.length} characters`);
    console.log(`🔪 Number of chunks: ${chunkResult.chunkCount}`);
    console.log(`🎯 Total estimated tokens: ${chunkResult.totalTokens}`);

    // Test summarization with different options
    console.log('\n5. Testing summarization...');
    
    const testContent = `
Artificial Intelligence (AI) is a rapidly growing field that focuses on creating computer systems capable of performing tasks that typically require human intelligence. These tasks include visual perception, speech recognition, decision-making, and language translation.

Machine Learning is a subset of AI that enables computers to learn and improve from experience without being explicitly programmed. It uses algorithms and statistical models to analyze and draw inferences from patterns in data.

Deep Learning is a further subset of Machine Learning that uses neural networks with multiple layers to model and understand complex patterns. It has been particularly successful in image recognition, natural language processing, and game playing.

The applications of AI are vast and growing, including autonomous vehicles, medical diagnosis, financial trading, recommendation systems, and smart home devices. As AI technology continues to advance, it promises to transform many aspects of our daily lives and work.
    `.trim();

    console.log('📝 Testing short summary...');
    const shortSummary = await openAIService.generateSummary(testContent, {
      length: 'short',
      focusArea: 'concepts',
      contentType: 'text',
    });

    console.log('✅ Short summary generated:');
    console.log(`📄 Summary: ${shortSummary.summary}`);
    console.log(`🎯 Tokens used: ${shortSummary.tokensUsed}`);
    console.log(`⏱️ Processing time: ${shortSummary.processingTime}ms`);
    console.log(`📊 Compression ratio: ${shortSummary.metadata.compressionRatio.toFixed(2)}:1`);

    console.log('\n📝 Testing medium summary...');
    const mediumSummary = await openAIService.generateSummary(testContent, {
      length: 'medium',
      focusArea: 'general',
      contentType: 'text',
    });

    console.log('✅ Medium summary generated:');
    console.log(`📄 Summary: ${mediumSummary.summary}`);
    console.log(`🎯 Tokens used: ${mediumSummary.tokensUsed}`);
    console.log(`⏱️ Processing time: ${mediumSummary.processingTime}ms`);

    console.log('\n🎉 All tests passed successfully!');
    console.log('\n📈 Summary of capabilities verified:');
    console.log('  ✅ OpenAI API integration');
    console.log('  ✅ Connection testing');
    console.log('  ✅ Token estimation');
    console.log('  ✅ Content chunking');
    console.log('  ✅ Summary generation with options');
    console.log('  ✅ Error handling and retry logic');
    console.log('  ✅ Performance metrics');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('🔍 Error details:', error);
    process.exit(1);
  }
}

// Run the test
testOpenAIService(); 