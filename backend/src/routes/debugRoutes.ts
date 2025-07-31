import { Router } from 'express';
import { getSubtitles } from 'youtube-caption-extractor';

export const debugRoutes = Router();

debugRoutes.post('/youtube-caption-extractor', async (req, res) => {
  const { videoId, lang = 'en' } = req.body as { videoId?: string; lang?: string };
  if (!videoId) {
    return res.status(400).json({ success: false, error: 'videoId required' });
  }
  try {
    console.log(`🔍 Testing youtube-caption-extractor for video: ${videoId}`);
    const subtitles = await getSubtitles({ videoID: videoId, lang });
    
    res.json({
      success: true,
      data: {
        videoId,
        lang,
        subtitleCount: subtitles.length,
        subtitles: subtitles.slice(0, 3), // Show first 3 subtitles as preview
      },
      exitCode: 0
    });
  } catch (e: any) {
    res.json({
      success: false,
      error: e?.message ?? 'youtube-caption-extractor error',
      stderr: e?.stderr ?? null,
    });
  }
});

export default debugRoutes; 