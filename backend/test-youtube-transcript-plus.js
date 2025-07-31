const { fetchTranscript } = require('youtube-transcript-plus');

async function testYoutubeTranscriptPlus() {
  const testVideos = [
    'uqah6bDkSxs', // The problematic video
    'vaA_O2FsHVE', // Previous problematic
    'oHg5SJYRHA0', // Rick Roll
    'jNQXAC9IVRw'  // Me at the zoo
  ];

  for (const videoId of testVideos) {
    console.log(`\n🧪 Testing video: ${videoId}`);
    console.log(`URL: https://www.youtube.com/watch?v=${videoId}`);
    try {
      const transcript = await fetchTranscript(videoId);
      if (transcript && transcript.length > 0) {
        console.log(`✅ SUCCESS: Got ${transcript.length} transcript lines`);
        // Show first 3 lines
        transcript.slice(0, 3).forEach((line, i) => {
          console.log(`  ${i + 1}. [${line.start}] ${line.text}`);
        });
      } else {
        console.log('⚠️ No transcript lines found');
      }
    } catch (error) {
      console.log(`❌ FAILED: ${error.message}`);
    }
  }
}

testYoutubeTranscriptPlus()
  .then(() => {
    console.log('\n🎉 Test completed!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  }); 