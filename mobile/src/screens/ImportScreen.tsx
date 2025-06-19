import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Button, Card, FeatureCard, PDFUpload } from '../components';
import { YouTubeInput, VideoData } from '../components/YouTubeInput';
import type { PDFFile, UploadResult } from '../components';
import { theme } from '../constants/theme';
import { useContentRefresh, useNavigation, Note } from '../contexts/NavigationContext';
import { ContentItem } from '../services/contentAPI';

interface ImportScreenProps {
  navigation: any;
}

export const ImportScreen: React.FC<ImportScreenProps> = ({ navigation }) => {
  const { refreshContent } = useContentRefresh();
  const { setNoteDetailMode } = useNavigation();
  const [isUploading, setIsUploading] = useState(false);
  const [showPDFUpload, setShowPDFUpload] = useState(false);
  const [showYouTubeInput, setShowYouTubeInput] = useState(false);
  const [isProcessingVideo, setIsProcessingVideo] = useState(false);

  // Helper function to navigate to summary screen with processed content
  const navigateToSummary = (contentData: {
    title: string;
    contentType: 'pdf' | 'youtube' | 'lecture_recording';
    description?: string;
    summary?: string;
    videoId?: string;
    url?: string;
    duration?: number;
  }) => {
    // Create a ContentItem object for the processed content
    const contentItem: ContentItem = {
      id: `temp-${Date.now()}`, // Temporary ID until we get the real one from the API
      title: contentData.title,
      description: contentData.description || '',
      contentType: contentData.contentType,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      processed: true,
      summary: contentData.summary,
      fileUrl: contentData.url,
      youtubeUrl: contentData.contentType === 'youtube' ? contentData.url : undefined,
      youtubeVideoId: contentData.videoId,
      duration: contentData.duration,
    };

    // Convert to Note format for navigation
    const note: Note = {
      id: contentItem.id,
      title: contentItem.title,
      type: mapContentTypeToNoteType(contentItem.contentType),
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

  const mapContentTypeToNoteType = (contentType: ContentItem['contentType']): Note['type'] => {
    switch (contentType) {
      case 'pdf':
        return 'PDF';
      case 'youtube':
        return 'YouTube';
      case 'lecture_recording':
        return 'Audio';
      default:
        return 'Text';
    }
  };

  const handlePDFUpload = () => {
    setShowPDFUpload(true);
  };

  const handleFileSelected = (file: PDFFile) => {
    console.log('File selected:', file);
    Alert.alert('File Selected', `Selected: ${file.name} (${(file.size / 1024 / 1024).toFixed(1)}MB)`);
  };

  const handleUploadProgress = (progress: number) => {
    console.log('Upload progress:', progress);
  };

  const handleUploadComplete = async (result: UploadResult) => {
    console.log('Upload complete:', result);
    if (result.success) {
      // Refresh the content list immediately
      try {
        await refreshContent();
        console.log('✅ Content refreshed after PDF upload');
      } catch (error) {
        console.error('❌ Failed to refresh content:', error);
      }
      
      Alert.alert(
        'PDF Processed Successfully!',
        'Your PDF has been processed and is ready for AI analysis.',
        [
          {
            text: 'Later',
            style: 'cancel',
            onPress: () => {
              setShowPDFUpload(false);
            },
          },
          {
            text: 'View Summary',
            style: 'default',
            onPress: () => {
              setShowPDFUpload(false);
              // Use a generic PDF title since we don't have the original filename in UploadResult
              navigateToSummary({
                title: 'PDF Document',
                contentType: 'pdf',
                description: result.message || 'PDF document processed successfully',
                url: result.publicUrl || result.path,
              });
            },
          },
        ]
      );
    }
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    Alert.alert('Upload Error', error);
  };

  const handleYouTubeImport = () => {
    setShowYouTubeInput(true);
  };

  const handleVideoProcessed = async (videoData: VideoData) => {
    console.log('Video processed:', videoData);
    
    // Refresh the content list immediately
    try {
      await refreshContent();
      console.log('✅ Content refreshed after video processing');
    } catch (error) {
      console.error('❌ Failed to refresh content:', error);
    }
    
    Alert.alert(
      'Video Processed Successfully!',
      `Video: ${videoData.title}\nTranscript extracted and ready for AI analysis.`,
      [
        {
          text: 'Later',
          style: 'cancel',
          onPress: () => {
            setShowYouTubeInput(false);
          },
        },
        {
          text: 'View Summary',
          style: 'default',
          onPress: () => {
            setShowYouTubeInput(false);
            navigateToSummary({
              title: videoData.title || 'YouTube Video',
              contentType: 'youtube',
              description: videoData.description,
              summary: videoData.transcript || undefined,
              videoId: videoData.videoId,
              url: videoData.url,
              duration: videoData.duration ? parseInt(videoData.duration) : undefined,
            });
          },
        },
      ]
    );
  };

  const handleVideoProcessingStart = (videoId: string) => {
    console.log('Processing started for video:', videoId);
    setIsProcessingVideo(true);
  };

  const handleVideoProcessingProgress = (progress: number) => {
    console.log('Video processing progress:', progress);
  };

  const handleVideoProcessingError = (error: string) => {
    console.error('Video processing error:', error);
    setIsProcessingVideo(false);
    Alert.alert('Processing Error', error);
  };

  const handleRecordLecture = () => {
    navigation.navigate('AudioRecording');
  };

  const importOptions = [
    {
      id: 'pdf',
      title: 'Upload PDF',
      description: 'Import PDF documents for AI analysis',
      icon: <Ionicons name="document-text" size={24} color={theme.colors.primary[600]} />,
      color: theme.colors.primary[100],
      onPress: handlePDFUpload,
    },
    {
      id: 'youtube',
      title: 'YouTube Link',
      description: 'Extract content from YouTube videos',
      icon: <Ionicons name="logo-youtube" size={24} color={theme.colors.error[600]} />,
      color: theme.colors.error[100],
      onPress: handleYouTubeImport,
    },
    {
      id: 'record',
      title: 'Record Lecture',
      description: 'Record and transcribe live lectures',
      icon: <Ionicons name="mic" size={24} color={theme.colors.success[600]} />,
      color: theme.colors.success[100],
      onPress: handleRecordLecture,
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Import Content" />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Import Your Learning Materials</Text>
          <Text style={styles.welcomeDescription}>
            Upload PDFs, share YouTube links, or record lectures to get started with AI-powered learning.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Choose Import Method</Text>
        
        {!showPDFUpload && !showYouTubeInput ? (
          <View style={styles.optionsGrid}>
            {importOptions.map((option) => (
              <FeatureCard
                key={option.id}
                title={option.title}
                description={option.description}
                icon={option.icon}
                color={option.color}
                onPress={option.onPress}
              />
            ))}
          </View>
        ) : showPDFUpload ? (
          <View style={styles.uploadSection}>
            <View style={styles.uploadHeader}>
              <Button
                title="← Back to Options"
                onPress={() => setShowPDFUpload(false)}
                variant="ghost"
                style={styles.backButton}
              />
            </View>
            <PDFUpload
              onFileSelected={handleFileSelected}
              onUploadProgress={handleUploadProgress}
              onUploadComplete={handleUploadComplete}
              onUploadError={handleUploadError}
              maxFileSize={10}
              disabled={isUploading}
              navigation={navigation}
            />
          </View>
        ) : showYouTubeInput ? (
          <View style={styles.uploadSection}>
            <View style={styles.uploadHeader}>
              <Button
                title="← Back to Options"
                onPress={() => setShowYouTubeInput(false)}
                variant="ghost"
                style={styles.backButton}
              />
            </View>
            <YouTubeInput
              onVideoProcessed={handleVideoProcessed}
              onProcessingStart={handleVideoProcessingStart}
              onProcessingProgress={handleVideoProcessingProgress}
              onProcessingError={handleVideoProcessingError}
              disabled={isProcessingVideo}
              maxVideosPerDay={2}
              navigation={navigation}
            />
          </View>
        ) : null}

        <Card style={styles.infoCard}>
          <Text style={styles.infoTitle}>💡 Pro Tips</Text>
          <Text style={styles.infoText}>
            • PDFs work best with text-based content{'\n'}
            • YouTube videos should have clear audio{'\n'}
            • Record in quiet environments for best results
          </Text>
        </Card>
      </ScrollView>
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
  welcomeCard: {
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  welcomeTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  welcomeDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary[100],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.lg,
  },
  infoCard: {
    backgroundColor: theme.colors.warning[50],
    borderColor: theme.colors.warning[200],
  },
  infoTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  infoText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  uploadSection: {
    marginBottom: theme.spacing.lg,
  },
  uploadHeader: {
    marginBottom: theme.spacing.base,
  },
  backButton: {
    alignSelf: 'flex-start',
  },
}); 