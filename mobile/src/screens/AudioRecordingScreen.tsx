import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Dimensions,
  Animated,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import * as MediaLibrary from 'expo-media-library';
import { Header, Button, Card, PremiumUpsellModal } from '../components';
import {
  getAudioFileInfo,
  uploadAudioToSupabase,
  AudioUploadController,
  getAudioProgressText,
  type AudioUploadProgress,
} from '../services/audioService';
import {
  audioAPI,
  type TranscriptionOptions,
  type TranscriptionResult,
} from '../services/audioAPI';
import { usageService, type QuotaInfo } from '../services/usageService';
import { permissionService } from '../services';
import { theme } from '../constants/theme';
import { supabase } from '../config/supabase';
import { authDebug } from '../services';
import {
  useContentRefresh,
  useNavigation,
  Note,
} from '../contexts/NavigationContext';
import { ContentItem } from '../services/contentAPI';
import { contentAPI } from '../services/contentAPI';

interface AudioRecordingScreenProps {
  navigation: any;
}

type RecordingStatus =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'processing'
  | 'transcribing'
  | 'completed';

export const AudioRecordingScreen: React.FC<AudioRecordingScreenProps> = ({
  navigation,
}) => {
  const { refreshContent } = useContentRefresh();
  const { setNoteDetailMode } = useNavigation();
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [recordingStatus, setRecordingStatus] =
    useState<RecordingStatus>('idle');
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [soundLevels, setSoundLevels] = useState<number[]>([]);
  const [hasAudioPermission, setHasAudioPermission] = useState(false);
  const [hasMediaLibraryPermission, setHasMediaLibraryPermission] =
    useState(false);
  const [uploadProgress, setUploadProgress] =
    useState<AudioUploadProgress | null>(null);
  const [transcriptionProgress, setTranscriptionProgress] = useState<{
    message: string;
    progress: number;
  } | null>(null);
  const [transcriptionResult, setTranscriptionResult] =
    useState<TranscriptionResult | null>(null);
  const [quotaInfo, setQuotaInfo] = useState<QuotaInfo | null>(null);
  const [showPremiumUpsell, setShowPremiumUpsell] = useState(false);

  // Helper function to navigate to summary screen with processed audio content
  const navigateToSummary = (audioData: {
    title: string;
    description?: string;
    summary?: string;
    duration?: number;
  }) => {
    // Create a ContentItem object for the processed audio content
    const contentItem: ContentItem = {
      id: `temp-${Date.now()}`, // Temporary ID until we get the real one from the API
      title: audioData.title,
      description: audioData.description || '',
      contentType: 'lecture_recording',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processed: true,
      summary: audioData.summary,
      duration: audioData.duration,
    };

    // Convert to Note format for navigation
    const note: Note = {
      id: contentItem.id,
      title: contentItem.title,
      type: 'Audio',
      date: contentItem.createdAt,
      progress: 100, // Processing is complete
      content: {
        contentItem: contentItem,
        processed: true,
        summary: contentItem.summary,
      },
    };

    // Navigate to note detail mode with summary tab
    setNoteDetailMode(note);
  };
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [uploadController] = useState(new AudioUploadController());

  // Animation values
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const initializeScreen = async () => {
      await requestPermissions();

      // Wait a bit for authentication to be established, then check quota
      setTimeout(async () => {
        try {
          await checkUserQuota();
        } catch (error) {
          console.log(
            'Authentication not ready yet, will try again when needed'
          );
        }
      }, 1000);
    };

    initializeScreen();

    // Listen for auth state changes with detailed logging
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth State Change Event:', {
        event,
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        expiresAt: session?.expires_at,
        timestamp: new Date().toISOString(),
      });

      if (event === 'SIGNED_IN' && session?.access_token) {
        console.log('✅ User signed in successfully');
        setIsAuthReady(true);
        checkUserQuota();
      } else if (event === 'SIGNED_OUT') {
        console.log('❌ User signed out');
        setIsAuthReady(false);
        setQuotaInfo(null);
      } else if (event === 'TOKEN_REFRESHED') {
        console.log('🔄 Token refreshed');
        setIsAuthReady(true);
        checkUserQuota();
      } else {
        console.log(`⚠️ Unhandled auth event: ${event}`);
      }
    });

    // Check initial auth state with detailed logging
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('🔍 Initial session check on mount:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        hasUser: !!session?.user,
        sessionError: error?.message,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
      });

      if (session?.access_token) {
        console.log('✅ Initial session found - setting auth ready');
        setIsAuthReady(true);
      } else {
        console.log('❌ No initial session found');
        setIsAuthReady(false);
      }
    });

    return () => {
      if (recording) {
        recording.stopAndUnloadAsync();
      }
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (recordingStatus === 'recording') {
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
        // Simulate sound levels for visualization
        setSoundLevels((prev) => [...prev.slice(-19), Math.random() * 100]);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [recordingStatus]);

  // Pulse animation for recording button
  useEffect(() => {
    if (recordingStatus === 'recording') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [recordingStatus]);

  const checkUserQuota = async (retryCount = 0) => {
    try {
      // First, use our AuthDebug utility for comprehensive checking
      console.log('🚀 Starting comprehensive auth check...');
      const authStatus = await authDebug.getAuthStatus();
      console.log('🔍 AuthDebug result:', authStatus);

      // Check if user is authenticated first with detailed logging
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      console.log('🔍 Auth Debug - Session check:', {
        hasSession: !!session,
        hasAccessToken: !!session?.access_token,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        sessionError: error?.message,
        expiresAt: session?.expires_at,
        tokenType: session?.token_type,
      });

      if (error) {
        console.error('❌ Session error:', error);
        return;
      }

      if (!session) {
        console.log('⚠️ No session found');
        return;
      }

      if (!session.access_token) {
        console.log('⚠️ Session exists but no access token found');
        console.log('Session details:', {
          expires_at: session.expires_at,
          refresh_token: session.refresh_token ? 'present' : 'missing',
          user: session.user ? 'present' : 'missing',
        });

        // Try to refresh the session if we have a refresh token
        if (session.refresh_token) {
          console.log('🔄 Attempting to refresh session...');
          const { data: refreshData, error: refreshError } =
            await supabase.auth.refreshSession({
              refresh_token: session.refresh_token,
            });

          if (refreshError) {
            console.error('❌ Session refresh failed:', refreshError);
          } else {
            console.log('✅ Session refreshed successfully');
            // Retry the quota check with the refreshed session
            setTimeout(() => checkUserQuota(retryCount + 1), 1000);
          }
        }

        return;
      }

      console.log('✅ Authentication verified, checking quota...');

      // Use permission service for unified quota checking
      try {
        const permissionResult = await permissionService.checkFeatureUsage(
          'audio_transcription'
        );
        if (permissionResult.limit !== undefined) {
          // Convert permission result to legacy quota format for backward compatibility
          const legacyQuota = {
            allowed: permissionResult.allowed,
            current_usage: permissionResult.current_usage || 0,
            daily_limit: permissionResult.limit,
            remaining: permissionResult.remaining || 0,
            plan_type: permissionResult.plan_type || 'free',
          };
          setQuotaInfo(legacyQuota);
          console.log('✅ Permission-based quota loaded successfully');
        }
      } catch (permissionError) {
        console.error(
          'Permission service quota check failed:',
          permissionError
        );

        // Fallback to legacy quota check
        const quotaCheck = await audioAPI.getQuotaInfo();
        if (quotaCheck.success && quotaCheck.quota) {
          setQuotaInfo(quotaCheck.quota);
          console.log('✅ Legacy quota loaded successfully');
        } else {
          console.log(
            '❌ Both permission and legacy quota checks failed:',
            quotaCheck.error
          );
        }
      }
    } catch (error) {
      console.error('Error checking user quota:', error);

      // Retry once if authentication failed and this is the first attempt
      if (
        retryCount === 0 &&
        error instanceof Error &&
        error.message.includes('not authenticated')
      ) {
        console.log('Retrying quota check in 2 seconds...');
        setTimeout(() => checkUserQuota(1), 2000);
      }
    }
  };

  const requestPermissions = async () => {
    try {
      const audioPermission = await Audio.requestPermissionsAsync();
      const mediaLibraryPermission =
        await MediaLibrary.requestPermissionsAsync();

      setHasAudioPermission(audioPermission.status === 'granted');
      setHasMediaLibraryPermission(mediaLibraryPermission.status === 'granted');

      if (audioPermission.status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Please grant microphone permission to record lectures.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => Audio.requestPermissionsAsync(),
            },
          ]
        );
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const startRecording = async () => {
    if (!hasAudioPermission) {
      Alert.alert(
        'Permission Required',
        'Microphone permission is required to record.'
      );
      return;
    }

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const recordingOptions: Audio.RecordingOptions = {
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.HIGH,
          sampleRate: 44100,
          numberOfChannels: 2,
          bitRate: 128000,
          linearPCMBitDepth: 16,
          linearPCMIsBigEndian: false,
          linearPCMIsFloat: false,
        },
        web: {
          mimeType: 'audio/webm',
          bitsPerSecond: 128000,
        },
      };

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync(recordingOptions);
      await newRecording.startAsync();

      setRecording(newRecording);
      setRecordingStatus('recording');
      setRecordingDuration(0);
      setSoundLevels([]);
    } catch (error) {
      console.error('Failed to start recording:', error);
      Alert.alert('Error', 'Failed to start recording. Please try again.');
    }
  };

  const pauseRecording = async () => {
    if (recording && recordingStatus === 'recording') {
      try {
        await recording.pauseAsync();
        setRecordingStatus('paused');
      } catch (error) {
        console.error('Failed to pause recording:', error);
      }
    }
  };

  const resumeRecording = async () => {
    if (recording && recordingStatus === 'paused') {
      try {
        await recording.startAsync();
        setRecordingStatus('recording');
      } catch (error) {
        console.error('Failed to resume recording:', error);
      }
    }
  };

  const stopRecording = async () => {
    if (recording) {
      try {
        await recording.stopAndUnloadAsync();
        const uri = recording.getURI();
        setRecording(null);
        setRecordingStatus('stopped');

        if (uri) {
          Alert.alert(
            'Recording Complete',
            `Recording saved! Duration: ${formatDuration(recordingDuration)}`,
            [
              {
                text: 'Discard',
                style: 'destructive',
                onPress: discardRecording,
              },
              {
                text: 'Process Recording',
                onPress: () => processRecording(uri),
              },
            ]
          );
        }
      } catch (error) {
        console.error('Failed to stop recording:', error);
        Alert.alert('Error', 'Failed to stop recording');
      }
    }
  };

  const discardRecording = () => {
    setRecordingStatus('idle');
    setRecordingDuration(0);
    setSoundLevels([]);
  };

  const processRecording = async (uri: string) => {
    try {
      setRecordingStatus('processing');
      setUploadProgress(null);
      setTranscriptionProgress(null);
      setTranscriptionResult(null);

      // Step 1: Get audio file information
      const audioFile = await getAudioFileInfo(uri);
      if (!audioFile) {
        throw new Error('Could not get audio file information');
      }

      // Step 2: Upload to Supabase with progress tracking
      const uploadResult = await uploadAudioToSupabase(
        audioFile,
        {
          onProgress: (progress) => {
            setUploadProgress(progress);
          },
        },
        uploadController
      );

      if (!uploadResult.success) {
        throw new Error(uploadResult.error || 'Upload failed');
      }

      setUploadProgress(null);

      // Step 3: Check quota before transcription
      const permissionResult = await permissionService.checkFeatureUsage(
        'audio_transcription'
      );
      if (!permissionResult.allowed) {
        await usageService.logError({
          error_type: 'quota_exceeded',
          error_message:
            permissionResult.reason || 'AI processing quota exceeded',
          error_details: {
            quota: {
              current_usage: permissionResult.current_usage || 0,
              daily_limit: permissionResult.limit || 0,
              remaining: permissionResult.remaining || 0,
              plan_type: permissionResult.plan_type || 'free',
            },
          },
        });

        setShowPremiumUpsell(true);
        return;
      }

      // Step 4: Transcribe the uploaded audio using backend API
      setRecordingStatus('transcribing');

      // Set initial progress
      setTranscriptionProgress({
        message: 'Starting transcription...',
        progress: 0,
      });

      // Simulate progress updates for better UX
      let progressValue = 0;
      const progressInterval = setInterval(() => {
        progressValue += 10;
        if (progressValue <= 90) {
          setTranscriptionProgress({
            message: 'Processing audio...',
            progress: progressValue,
          });
        }
      }, 500);

      try {
        const transcription = await audioAPI.transcribeAudio(
          uploadResult.path || '',
          {
            provider: 'openai',
            language: 'en',
            enableWordTimestamps: true,
            temperature: 0,
          }
        );

        clearInterval(progressInterval);
        setTranscriptionProgress({ message: 'Completed!', progress: 100 });

        if (transcription.success) {
          setTranscriptionResult(transcription);
          setRecordingStatus('completed');

          // Step 5: Record usage after successful transcription
          try {
            const usageResult = await usageService.recordAIProcessingUsage();
            if (usageResult.success && usageResult.quota_info) {
              setQuotaInfo(usageResult.quota_info);
            }
          } catch (usageError) {
            console.warn('Failed to record usage:', usageError);
            // Don't fail the whole operation for usage tracking errors
          }

          // Step 6: Refresh content list and navigate using real contentItemId if provided
          let contentItemId: string | undefined = transcription.contentItemId;

          try {
            await refreshContent();
            console.log('✅ Content refreshed after audio transcription');
          } catch (error) {
            console.error('❌ Failed to refresh content:', error);
          }

          if (!contentItemId) {
            // Fallback: try to locate the newest item by title
            try {
              const itemsResponse = await contentAPI.getRecentItems();
              if (itemsResponse.success && itemsResponse.contentItems && itemsResponse.contentItems.length > 0) {
                contentItemId = itemsResponse.contentItems[0].id;
              }
            } catch (e) {}
          }

          const onViewSummary = async () => {
            if (contentItemId) {
              // Fetch full content item to build note
              try {
                const contentResponse = await contentAPI.getContentItem(contentItemId);
                if (contentResponse.success && contentResponse.contentItem) {
                  const item = contentResponse.contentItem;
                  const note: Note = {
                    id: item.id,
                    title: item.title,
                    type: 'Audio',
                    date: item.createdAt,
                    progress: 100,
                    content: { contentItem: item, processed: true, summary: item.summary },
                  };
                  setNoteDetailMode(note);
                  return;
                }
              } catch (e) {
                console.warn('Failed to fetch content item, will fallback');
              }
            }

            // Fallback to temp
            const audioTitle = `Audio Recording ${new Date().toLocaleDateString()}`;
            navigateToSummary({
              title: audioTitle,
              description: `Lecture recording transcribed (${Math.round((transcription.duration || 0) / 60)} minutes)`,
              summary: transcription.transcript,
              duration: transcription.duration,
            });
          };

          // Automatically navigate to summary view after successful transcription
          console.log('✅ Audio transcription completed, navigating to summary view');
          onViewSummary();
        } else {
          clearInterval(progressInterval);
          await usageService.logError({
            error_type: 'processing_error',
            error_message: transcription.error || 'Transcription failed',
            error_details: { transcription },
          });

          throw new Error(transcription.error || 'Transcription failed');
        }
      } catch (transcriptionError) {
        clearInterval(progressInterval);
        throw transcriptionError;
      }
    } catch (error) {
      setRecordingStatus('stopped');
      console.error('Error processing recording:', error);

      await usageService.logError({
        error_type: 'processing_error',
        error_message:
          error instanceof Error ? error.message : 'Unknown processing error',
        error_details: {
          error: error instanceof Error ? error.stack : String(error),
        },
      });

      Alert.alert(
        'Processing Error',
        usageService.getUserFriendlyErrorMessage('processing_error'),
        [
          { text: 'Retry', onPress: () => processRecording(uri) },
          { text: 'Cancel' },
        ]
      );
    }
  };

  const showTranscriptionResult = (result: TranscriptionResult) => {
    Alert.alert(
      'Transcription Result',
      `Transcript: ${result.transcript?.substring(0, 200)}${result.transcript && result.transcript.length > 200 ? '...' : ''}\n\nConfidence: ${result.confidence ? Math.round(result.confidence * 100) : 'N/A'}%\nProcessing Time: ${result.processingTime ? (result.processingTime / 1000).toFixed(1) : 'N/A'}s`,
      [{ text: 'OK' }]
    );
  };

  const resetRecording = async () => {
    setRecordingStatus('idle');
    setRecordingDuration(0);
    setSoundLevels([]);
    setUploadProgress(null);
    setTranscriptionProgress(null);
    setTranscriptionResult(null);
    uploadController.reset();

    // Refresh quota info after reset (with error handling)
    try {
      await checkUserQuota();
    } catch (error) {
      console.log('Failed to refresh quota info after reset:', error);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderWaveform = () => {
    return (
      <View style={styles.waveformContainer}>
        {soundLevels.map((level, index) => (
          <View
            key={index}
            style={[styles.waveformBar, { height: Math.max(2, level * 0.4) }]}
          />
        ))}
      </View>
    );
  };

  const renderRecordingControls = () => {
    switch (recordingStatus) {
      case 'idle':
        return (
          <TouchableOpacity
            style={[styles.recordButton, styles.recordButtonIdle]}
            onPress={startRecording}
            disabled={!hasAudioPermission}
          >
            <Ionicons name="mic" size={32} color={theme.colors.white} />
          </TouchableOpacity>
        );

      case 'recording':
        return (
          <View style={styles.recordingControls}>
            <Animated.View
              style={[
                styles.recordButton,
                styles.recordButtonRecording,
                { transform: [{ scale: pulseAnim }] },
              ]}
            >
              <Ionicons name="stop" size={32} color={theme.colors.white} />
            </Animated.View>
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={pauseRecording}
              >
                <Ionicons
                  name="pause"
                  size={24}
                  color={theme.colors.primary[600]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={stopRecording}
              >
                <Ionicons
                  name="stop"
                  size={24}
                  color={theme.colors.error[600]}
                />
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'paused':
        return (
          <View style={styles.recordingControls}>
            <View style={[styles.recordButton, styles.recordButtonPaused]}>
              <Ionicons name="pause" size={32} color={theme.colors.white} />
            </View>
            <View style={styles.controlButtons}>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={resumeRecording}
              >
                <Ionicons
                  name="play"
                  size={24}
                  color={theme.colors.success[600]}
                />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={stopRecording}
              >
                <Ionicons
                  name="stop"
                  size={24}
                  color={theme.colors.error[600]}
                />
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'stopped':
        return (
          <TouchableOpacity
            style={[styles.recordButton, styles.recordButtonStopped]}
            onPress={() => setRecordingStatus('idle')}
          >
            <Ionicons name="refresh" size={32} color={theme.colors.white} />
          </TouchableOpacity>
        );

      default:
        return null;
    }
  };

  const renderProcessingStatus = () => {
    if (
      (recordingStatus === 'processing' ||
        recordingStatus === 'transcribing') &&
      (uploadProgress || transcriptionProgress)
    ) {
      const currentProgress = transcriptionProgress || uploadProgress;
      const isTranscribing = recordingStatus === 'transcribing';

      return (
        <Card style={styles.processingCard}>
          <Text style={styles.processingTitle}>
            {isTranscribing
              ? 'Transcribing Audio...'
              : 'Processing Recording...'}
          </Text>
          <Text style={styles.processingText}>
            {isTranscribing && transcriptionProgress
              ? transcriptionProgress.message
              : uploadProgress
                ? getAudioProgressText(uploadProgress)
                : 'Processing...'}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${currentProgress?.progress || 0}%` },
              ]}
            />
          </View>
          <Text style={styles.progressPercentage}>
            {Math.round(currentProgress?.progress || 0)}%
          </Text>
        </Card>
      );
    }
    return null;
  };

  const renderTranscriptionResult = () => {
    if (recordingStatus === 'completed' && transcriptionResult?.success) {
      return (
        <Card style={styles.resultCard}>
          <Text style={styles.resultTitle}>🎯 Transcription Complete</Text>
          <ScrollView
            style={styles.transcriptContainer}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.transcriptText}>
              {transcriptionResult.transcript}
            </Text>
          </ScrollView>
          <View style={styles.resultStats}>
            <Text style={styles.statText}>
              Confidence:{' '}
              {transcriptionResult.confidence
                ? Math.round(transcriptionResult.confidence * 100)
                : 'N/A'}
              %
            </Text>
            <Text style={styles.statText}>
              Duration:{' '}
              {transcriptionResult.duration
                ? Math.round(transcriptionResult.duration)
                : 'N/A'}
              s
            </Text>
            <Text style={styles.statText}>
              Provider: {transcriptionResult.provider || 'Unknown'}
            </Text>
          </View>
          <View style={styles.resultActions}>
            <Button
              title="New Recording"
              onPress={resetRecording}
              variant="outline"
              style={styles.actionButton}
            />
            <Button
              title="Continue to Analysis"
              onPress={() => {
                // TODO: Navigate to AI analysis screen
                Alert.alert(
                  'Coming Soon',
                  'AI analysis will be available in the next update!'
                );
              }}
              style={styles.actionButton}
            />
          </View>
        </Card>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Record Lecture"
        leftAction={{
          icon: (
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.gray[700]}
            />
          ),
          onPress: () => navigation.goBack(),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Card style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <Text style={styles.statusTitle}>
              {recordingStatus === 'idle' && 'Ready to Record'}
              {recordingStatus === 'recording' && 'Recording...'}
              {recordingStatus === 'paused' && 'Recording Paused'}
              {recordingStatus === 'stopped' && 'Recording Complete'}
              {recordingStatus === 'processing' && 'Processing...'}
              {recordingStatus === 'transcribing' && 'Transcribing...'}
              {recordingStatus === 'completed' && 'All Done!'}
            </Text>
            <Text style={styles.duration}>
              {formatDuration(recordingDuration)}
            </Text>
          </View>

          {recordingStatus !== 'idle' &&
            recordingStatus !== 'processing' &&
            recordingStatus !== 'transcribing' &&
            recordingStatus !== 'completed' && (
              <View style={styles.visualizationContainer}>
                {renderWaveform()}
              </View>
            )}
        </Card>

        {renderProcessingStatus()}
        {renderTranscriptionResult()}

        {recordingStatus !== 'completed' && (
          <View style={styles.controlsContainer}>
            {renderRecordingControls()}
          </View>
        )}

        <Card style={styles.tipsCard}>
          <Text style={styles.tipsTitle}>📋 Recording Tips</Text>
          <Text style={styles.tipsText}>
            • Find a quiet environment{'\n'}• Hold device steady{'\n'}• Speak
            clearly and at normal pace{'\n'}• Pause recording during breaks
            {'\n'}• Maximum recording length: 2 hours
          </Text>
        </Card>

        {!hasAudioPermission && (
          <Card style={styles.permissionCard}>
            <Text style={styles.permissionTitle}>⚠️ Permission Required</Text>
            <Text style={styles.permissionText}>
              Microphone access is required to record lectures.
            </Text>
            <Button
              title="Grant Permission"
              onPress={requestPermissions}
              style={styles.permissionButton}
            />
          </Card>
        )}
      </ScrollView>

      <PremiumUpsellModal
        visible={showPremiumUpsell}
        onClose={() => setShowPremiumUpsell(false)}
        onUpgrade={() => {
          setShowPremiumUpsell(false);
          navigation.navigate('Subscription', { from: 'audio-quota' });
        }}
        featureType="audio-transcription"
        currentUsage={quotaInfo?.current_usage}
        limit={quotaInfo?.daily_limit}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.gray[50],
  },
  content: {
    flex: 1,
    padding: theme.spacing.base,
  },
  statusCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
  },
  statusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  statusTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[800],
  },
  duration: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    fontFamily: 'monospace',
  },
  visualizationContainer: {
    height: 60,
    justifyContent: 'center',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
  },
  waveformBar: {
    width: 3,
    backgroundColor: theme.colors.primary[400],
    marginHorizontal: 1,
    borderRadius: 1.5,
  },
  controlsContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  recordButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  recordButtonIdle: {
    backgroundColor: theme.colors.primary[600],
  },
  recordButtonRecording: {
    backgroundColor: theme.colors.error[600],
  },
  recordButtonPaused: {
    backgroundColor: theme.colors.warning[600],
  },
  recordButtonStopped: {
    backgroundColor: theme.colors.gray[600],
  },
  recordingControls: {
    alignItems: 'center',
  },
  controlButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  controlButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.shadow.base,
  },
  tipsCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.base,
  },
  tipsTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[800],
    marginBottom: theme.spacing.sm,
  },
  tipsText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  permissionCard: {
    padding: theme.spacing.base,
    backgroundColor: theme.colors.warning[50],
    borderColor: theme.colors.warning[200],
    borderWidth: 1,
  },
  permissionTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.warning[800],
    marginBottom: theme.spacing.sm,
  },
  permissionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.warning[700],
    marginBottom: theme.spacing.md,
  },
  permissionButton: {
    backgroundColor: theme.colors.warning[600],
  },
  processingCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[200],
    borderWidth: 1,
  },
  processingTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.primary[800],
    marginBottom: theme.spacing.sm,
  },
  processingText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[700],
    marginBottom: theme.spacing.md,
  },
  progressBar: {
    height: 8,
    backgroundColor: theme.colors.primary[100],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
    marginBottom: theme.spacing.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.full,
  },
  progressPercentage: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[700],
    textAlign: 'center',
  },
  resultCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.success[50],
    borderColor: theme.colors.success[200],
    borderWidth: 1,
  },
  resultTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.success[800],
    marginBottom: theme.spacing.md,
  },
  transcriptContainer: {
    maxHeight: 200,
    marginBottom: theme.spacing.md,
  },
  transcriptText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  resultStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.success[200],
  },
  statText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.success[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  resultActions: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
});
