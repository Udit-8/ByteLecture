/**
 * YouTube URL validation and processing utilities
 */

export interface YouTubeValidationResult {
  isValid: boolean;
  videoId?: string;
  error?: string;
}

export interface YouTubeVideoInfo {
  videoId: string;
  url: string;
  title?: string;
  duration?: string;
  channelName?: string;
}

/**
 * Extract video ID from various YouTube URL formats
 */
export const extractVideoId = (url: string): string | null => {
  if (!url || typeof url !== 'string') {
    return null;
  }

  // Remove whitespace and convert to lowercase
  const cleanUrl = url.trim();

  // YouTube URL patterns
  const patterns = [
    // Standard watch URL: https://www.youtube.com/watch?v=VIDEO_ID
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    // Short URL: https://youtu.be/VIDEO_ID
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    // Embedded URL: https://www.youtube.com/embed/VIDEO_ID
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    // Mobile URL: https://m.youtube.com/watch?v=VIDEO_ID
    /m\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    // YouTube URL with additional parameters
    /youtube\.com\/.*[?&]v=([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = cleanUrl.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // Check if it's just a video ID (11 characters)
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanUrl)) {
    return cleanUrl;
  }

  return null;
};

/**
 * Validate YouTube URL and extract video information
 */
export const validateYouTubeUrl = (url: string): YouTubeValidationResult => {
  if (!url || typeof url !== 'string') {
    return {
      isValid: false,
      error: 'Please enter a YouTube URL',
    };
  }

  const trimmedUrl = url.trim();

  if (!trimmedUrl) {
    return {
      isValid: false,
      error: 'Please enter a YouTube URL',
    };
  }

  const videoId = extractVideoId(trimmedUrl);

  if (!videoId) {
    return {
      isValid: false,
      error: 'Invalid YouTube URL. Please enter a valid YouTube video link.',
    };
  }

  // Additional validation for video ID format
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return {
      isValid: false,
      error: 'Invalid video ID format',
    };
  }

  return {
    isValid: true,
    videoId,
  };
};

/**
 * Generate standard YouTube watch URL from video ID
 */
export const generateYouTubeUrl = (videoId: string): string => {
  return `https://www.youtube.com/watch?v=${videoId}`;
};

/**
 * Generate YouTube thumbnail URL from video ID
 */
export const generateThumbnailUrl = (
  videoId: string,
  quality: 'default' | 'medium' | 'high' | 'standard' | 'maxres' = 'medium'
): string => {
  return `https://img.youtube.com/vi/${videoId}/${quality}default.jpg`;
};

/**
 * Check if URL is a YouTube URL (basic check)
 */
export const isYouTubeUrl = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false;

  const cleanUrl = url.toLowerCase().trim();
  return cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be');
};

/**
 * Sanitize and format YouTube URL input
 */
export const sanitizeYouTubeUrl = (input: string): string => {
  if (!input || typeof input !== 'string') return '';

  let sanitized = input.trim();

  // If it's just a video ID, convert to full URL
  if (/^[a-zA-Z0-9_-]{11}$/.test(sanitized)) {
    sanitized = generateYouTubeUrl(sanitized);
  }

  // Ensure protocol
  if (sanitized.includes('youtube.') && !sanitized.startsWith('http')) {
    sanitized = 'https://' + sanitized;
  }

  return sanitized;
};

/**
 * Format error messages for user display
 */
export const formatValidationError = (error: string): string => {
  const errorMap: Record<string, string> = {
    'Please enter a YouTube URL': '🔗 Please enter a YouTube URL',
    'Invalid YouTube URL. Please enter a valid YouTube video link.':
      '❌ Invalid YouTube URL. Please check the link and try again.',
    'Invalid video ID format':
      '❌ This does not appear to be a valid YouTube video.',
  };

  return errorMap[error] || `❌ ${error}`;
};
