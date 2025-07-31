const { YoutubeTranscript } = require('youtube-transcript');

async function testYoutubeTranscript() {
  const testVideos = [
    'uqah6bDkSxs', // The problematic video that was failing with yt-dlp
  ];

  for (const videoId of testVideos) {
    console.log(`\n🧪 Testing video: ${videoId}`);
    console.log(`URL: https://www.youtube.com/watch?v=${videoId}`);
    
    try {
      console.log('📋 Trying default transcript...');
      const transcript = await YoutubeTranscript.fetchTranscript(videoId);
      console.log(`✅ SUCCESS: Got ${transcript.length} transcript segments`);
      
      // Show first few lines
      if (transcript.length > 0) {
        console.log('📝 First 3 transcript lines:');
        transcript.slice(0, 3).forEach((line, i) => {
          console.log(`  ${i + 1}. [${line.offset}ms] ${line.text}`);
        });
      } else {
        console.log('⚠️ No transcript segments found');
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      
      // Try with different language options
      const languages = ['en', 'hi', 'es', 'fr'];
      for (const lang of languages) {
        try {
          console.log(`🔄 Trying with ${lang} language...`);
          const transcriptLang = await YoutubeTranscript.fetchTranscript(videoId, [lang]);
          console.log(`✅ SUCCESS with ${lang}: Got ${transcriptLang.length} transcript segments`);
          break; // Found one that works
        } catch (error2) {
          console.log(`❌ ${lang} also failed: ${error2.message}`);
        }
      }
    }
  }
}

// Run the test
testYoutubeTranscript()
  .then(() => {
    console.log('\n🎉 Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }); 