import { Router } from 'express';
import YTDlpExec from 'yt-dlp-exec';

export const debugRoutes = Router();

/**
 * POST /api/debug/yt-dlp
 * {
 *   "url": "https://www.youtube.com/watch?v=..."
 * }
 *
 * Returns raw stdout/stderr from yt-dlp so we can see why Railway fails.
 */
debugRoutes.post('/yt-dlp', async (req, res) => {
  const { url } = req.body as { url?: string };

  if (!url) {
    return res.status(400).json({ success: false, error: 'url required' });
  }

  try {
    const result = await YTDlpExec(url, {
      dumpJson: true,
      noWarnings: true,
      verbose: true,
      forceIpv4: true,
      geoBypassCountry: 'US',
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.json({
      success: false,
      error: e?.message ?? 'yt-dlp error',
      stderr: e?.stderr ?? null,
    });
  }
});

export default debugRoutes; 