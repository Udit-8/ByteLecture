const { getSubtitles } = require('youtube-caption-extractor');

async function testYoutubeCaptionExtractor() {
  const testVideos = [
    'vaA_O2FsHVE', // The problematic video that was failing with yt-dlp
    'oHg5SJYRHA0', // Rick Roll (should work)
    'dQw4w9WgXcQ', // Another Rick Roll variant
    'jNQXAC9IVRw', // "Me at the zoo" (first YouTube video, should have captions)
    'kJQP7kiw5Fk'  // Luis Fonsi - Despacito (popular song, might have captions)
  ];

  for (const videoId of testVideos) {
    console.log(`\n🧪 Testing video: ${videoId}`);
    console.log(`URL: https://www.youtube.com/watch?v=${videoId}`);
    
    try {
      console.log('📋 Trying default subtitles...');
      const subtitles = await getSubtitles({ videoID: videoId });
      console.log(`✅ SUCCESS: Got ${subtitles.length} subtitle lines`);
      
      // Show first few lines
      if (subtitles.length > 0) {
        console.log('📝 First 3 subtitle lines:');
        subtitles.slice(0, 3).forEach((line, i) => {
          console.log(`  ${i + 1}. [${line.start}s] ${line.text}`);
        });
      } else {
        console.log('⚠️ No subtitle lines found');
      }
      
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
      
      // Try with different language options
      const languages = ['en', 'hi', 'es', 'fr'];
      for (const lang of languages) {
        try {
          console.log(`🔄 Trying with ${lang} language...`);
          const subtitlesLang = await getSubtitles({ videoID: videoId, lang });
          console.log(`✅ SUCCESS with ${lang}: Got ${subtitlesLang.length} subtitle lines`);
          break; // Found one that works
        } catch (error2) {
          console.log(`❌ ${lang} also failed: ${error2.message}`);
        }
      }
    }
  }
}

// Run the test
testYoutubeCaptionExtractor()
  .then(() => {
    console.log('\n🎉 Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }); 