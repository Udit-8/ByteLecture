import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import {
  youtubeAPI,
  YouTubeProcessingResult,
  YouTubeVideoInfo,
} from '../services/youtubeAPI';
import { validateYouTubeUrl, extractVideoId } from '../utils/youtubeValidation';

export interface YouTubeInputProps {
  onVideoProcessed?: (videoData: VideoData) => void;
  onProcessingStart?: (videoId: string) => void;
  onProcessingProgress?: (progress: number) => void;
  onProcessingError?: (error: string) => void;
  disabled?: boolean;
  maxVideosPerDay?: number;
  navigation?: any; // Optional navigation prop for quota exceeded cases
}

export interface VideoData {
  videoId: string;
  url: string;
  title?: string;
  description?: string;
  duration?: string;
  thumbnailUrl?: string;
  channelName?: string;
  transcript?: string;
  recordId?: string;
  processed?: boolean;
}

export const YouTubeInput: React.FC<YouTubeInputProps> = ({
  onVideoProcessed,
  onProcessingStart,
  onProcessingProgress,
  onProcessingError,
  disabled = false,
  maxVideosPerDay = 2,
  navigation,
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [videoPreview, setVideoPreview] = useState<VideoData | null>(null);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');

  const handleInputChange = useCallback((text: string) => {
    setInputValue(text);
    setValidationError('');
    setVideoPreview(null);
  }, []);

  const handleValidation = useCallback(() => {
    const validation = validateYouTubeUrl(inputValue);

    if (!validation.isValid) {
      setValidationError(validation.error || 'Invalid URL');
      return null;
    }

    return validation.videoId;
  }, [inputValue]);

  const handlePreview = useCallback(async () => {
    const videoId = handleValidation();
    if (!videoId) return;

    setVideoPreview({
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/medium.jpg`,
      title: 'Loading video information...',
    });

    try {
      // Get video metadata to enhance preview
      const metadata = await youtubeAPI.getVideoMetadata(videoId);
      setVideoPreview({
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: metadata.title,
        description: metadata.description,
        duration: metadata.duration,
        thumbnailUrl: metadata.thumbnails.medium || metadata.thumbnails.default,
        channelName: metadata.channelTitle,
      });
    } catch (error) {
      console.warn('Could not fetch video metadata for preview:', error);
      // Keep the basic preview if metadata fetch fails
    }
  }, [handleValidation]);

  const updateProgress = (step: number, message: string) => {
    setProgress(step);
    setProgressMessage(message);
    onProcessingProgress?.(step);
  };

  const handleProcess = useCallback(async () => {
    const videoId = handleValidation();
    if (!videoId || !inputValue.trim()) return;

    setIsProcessing(true);
    setProgress(0);
    setProgressMessage('Starting processing...');

    try {
      onProcessingStart?.(videoId);

      // Step 1: Validate video
      updateProgress(0.1, 'Validating YouTube video...');
      const validation = await youtubeAPI.validateVideo(inputValue.trim());

      if (!validation.isValid) {
        throw new Error(validation.error || 'Video validation failed');
      }

      if (!validation.hasTranscript) {
        Alert.alert(
          'No Transcript Available',
          "This video doesn't have captions/transcript available. Processing may be limited.",
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Continue Anyway', onPress: () => continueProcessing() },
          ]
        );
        return;
      }

      await continueProcessing();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to process video';
      console.error('YouTube processing error:', error);
      onProcessingError?.(errorMessage);

      // Check for quota exceeded errors
      if (
        errorMessage.includes('quota') ||
        errorMessage.includes('limit') ||
        errorMessage.includes('exceeded')
      ) {
        if (navigation) {
          Alert.alert(
            'Daily Limit Reached',
            'You have reached your daily YouTube processing limit. Upgrade to premium for unlimited processing.',
            [
              { text: 'Cancel' },
              {
                text: 'Upgrade Plan',
                style: 'default',
                onPress: () =>
                  navigation.navigate('Subscription', {
                    from: 'youtube-quota',
                  }),
              },
            ]
          );
        } else {
          Alert.alert(
            'Daily Limit Reached',
            'You have reached your daily YouTube processing limit. Please try again tomorrow or upgrade your plan.'
          );
        }
      } else {
        Alert.alert('Processing Error', errorMessage);
      }
    } finally {
      setIsProcessing(false);
      setProgress(0);
      setProgressMessage('');
    }

    async function continueProcessing() {
      try {
        // Step 2: Process video (this calls the backend and stores in DB)
        updateProgress(0.3, 'Processing video and extracting transcript...');

        const result: YouTubeProcessingResult = await youtubeAPI.processVideo(
          inputValue.trim()
        );

        updateProgress(0.7, 'Analyzing content...');

        // Step 3: Simulate final processing steps
        await new Promise((resolve) => setTimeout(resolve, 1000));
        updateProgress(0.9, 'Finalizing...');

        await new Promise((resolve) => setTimeout(resolve, 500));
        updateProgress(1.0, 'Complete!');

        // Create final video data for the component callback
        const finalVideoData: VideoData = {
          videoId: result.videoInfo.videoId,
          url: inputValue.trim(),
          title: result.videoInfo.title,
          description: result.videoInfo.description,
          duration: result.videoInfo.duration,
          thumbnailUrl:
            result.videoInfo.thumbnails.medium ||
            result.videoInfo.thumbnails.default,
          channelName: result.videoInfo.channelTitle,
          transcript: result.fullTranscriptText,
          recordId: result.recordId,
          processed: true,
        };

        onVideoProcessed?.(finalVideoData);
        setInputValue('');
        setVideoPreview(null);

        const cacheMessage = result.fromCache
          ? ' (retrieved from cache)'
          : ' (newly processed and stored)';
        Alert.alert('Success', `Video processed successfully${cacheMessage}!`);
      } catch (processingError) {
        throw processingError;
      }
    }
  }, [
    handleValidation,
    inputValue,
    onProcessingStart,
    onProcessingProgress,
    onVideoProcessed,
    onProcessingError,
  ]);

  const handleClearPreview = useCallback(() => {
    setVideoPreview(null);
    setValidationError('');
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>YouTube Video URL</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[styles.input, validationError && styles.inputError]}
          placeholder="Paste YouTube URL here..."
          value={inputValue}
          onChangeText={handleInputChange}
          editable={!disabled && !isProcessing}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          returnKeyType="done"
          onSubmitEditing={handlePreview}
        />

        <TouchableOpacity
          style={[
            styles.previewButton,
            (disabled || isProcessing || !inputValue.trim()) &&
              styles.previewButtonDisabled,
          ]}
          onPress={handlePreview}
          disabled={disabled || isProcessing || !inputValue.trim()}
        >
          <Ionicons name="eye" size={20} color={theme.colors.white} />
        </TouchableOpacity>
      </View>

      {validationError ? (
        <Text style={styles.errorText}>{validationError}</Text>
      ) : null}

      <Text style={styles.hint}>
        Supports YouTube videos with captions/transcripts. Daily limit:{' '}
        {maxVideosPerDay} videos.
      </Text>

      {videoPreview && (
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>Video Preview</Text>
            <TouchableOpacity
              onPress={handleClearPreview}
              style={styles.closeButton}
            >
              <Ionicons name="close" size={20} color={theme.colors.gray[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.videoInfo}>
            <Image
              source={{ uri: videoPreview.thumbnailUrl }}
              style={styles.thumbnail}
              resizeMode="cover"
            />
            <View style={styles.videoDetails}>
              <Text style={styles.videoTitle} numberOfLines={2}>
                {videoPreview.title}
              </Text>
              {videoPreview.channelName && (
                <Text style={styles.channelName} numberOfLines={1}>
                  {videoPreview.channelName}
                </Text>
              )}
              {videoPreview.duration && (
                <Text style={styles.videoDuration}>
                  Duration: {videoPreview.duration}
                </Text>
              )}
              <Text style={styles.videoId}>ID: {videoPreview.videoId}</Text>
            </View>
          </View>

          {!isProcessing ? (
            <TouchableOpacity
              style={[
                styles.processButton,
                disabled && styles.processButtonDisabled,
              ]}
              onPress={handleProcess}
              disabled={disabled}
            >
              <Ionicons
                name="play-circle"
                size={20}
                color={theme.colors.white}
              />
              <Text style={styles.processButtonText}>
                Process & Store Video
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.processingContainer}>
              <ActivityIndicator
                size="small"
                color={theme.colors.primary[600]}
              />
              <Text style={styles.processingText}>
                {progressMessage ||
                  `Processing... ${Math.round(progress * 100)}%`}
              </Text>
              <View style={styles.progressBar}>
                <View
                  style={[styles.progressFill, { width: `${progress * 100}%` }]}
                />
              </View>
            </View>
          )}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    shadowColor: theme.colors.gray[900],
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.gray[300],
    borderRadius: theme.borderRadius.lg,
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[900],
    backgroundColor: theme.colors.white,
  },
  inputError: {
    borderColor: theme.colors.error[500],
  },
  previewButton: {
    marginLeft: theme.spacing.sm,
    padding: theme.spacing.sm,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary[600],
  },
  previewButtonDisabled: {
    backgroundColor: theme.colors.gray[400],
  },
  errorText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error[600],
    marginBottom: theme.spacing.sm,
  },
  hint: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.lg,
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  previewContainer: {
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.base,
    backgroundColor: theme.colors.gray[50],
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.base,
  },
  previewTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
  },
  closeButton: {
    padding: theme.spacing.xs,
  },
  videoInfo: {
    flexDirection: 'row',
    marginBottom: theme.spacing.base,
  },
  thumbnail: {
    width: 80,
    height: 60,
    borderRadius: theme.borderRadius.sm,
    backgroundColor: theme.colors.gray[200],
  },
  videoDetails: {
    flex: 1,
    marginLeft: theme.spacing.md,
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  channelName: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    fontFamily: 'monospace',
  },
  videoDuration: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    fontFamily: 'monospace',
  },
  videoId: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    fontFamily: 'monospace',
  },
  processButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.lg,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.base,
  },
  processButtonDisabled: {
    backgroundColor: theme.colors.gray[400],
  },
  processButtonText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.white,
    marginLeft: theme.spacing.sm,
  },
  processingContainer: {
    alignItems: 'center',
    padding: theme.spacing.base,
  },
  processingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[600],
    borderRadius: 2,
  },
});
