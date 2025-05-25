import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Button, Card } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';

interface AudioLearningScreenProps {
  navigation?: any;
  route?: any;
}

interface AudioContent {
  id: string;
  title: string;
  duration: number;
  transcript: Array<{
    id: string;
    timestamp: number;
    text: string;
    speaker?: string;
  }>;
  bookmarks: Array<{
    id: string;
    timestamp: number;
    note: string;
  }>;
}

export const AudioLearningScreen: React.FC<AudioLearningScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const { selectedNote, setMainMode } = useNavigation();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [showTranscript, setShowTranscript] = useState(true);
  const [activeTranscriptId, setActiveTranscriptId] = useState<string | null>(null);

  // Mock audio content data
  const audioContent: AudioContent = {
    id: '1',
    title: 'Introduction to Machine Learning - Lecture 1',
    duration: 3600, // 60 minutes in seconds
    transcript: [
      {
        id: '1',
        timestamp: 0,
        text: "Welcome to today's lecture on machine learning fundamentals.",
        speaker: 'Professor',
      },
      {
        id: '2',
        timestamp: 15,
        text: "We'll start by exploring what machine learning actually means and how it differs from traditional programming.",
        speaker: 'Professor',
      },
      {
        id: '3',
        timestamp: 45,
        text: "Machine learning is a subset of artificial intelligence that focuses on the development of algorithms.",
        speaker: 'Professor',
      },
      {
        id: '4',
        timestamp: 75,
        text: "These algorithms can learn and make decisions from data without being explicitly programmed for every scenario.",
        speaker: 'Professor',
      },
    ],
    bookmarks: [
      {
        id: '1',
        timestamp: 120,
        note: 'Important definition of supervised learning',
      },
      {
        id: '2',
        timestamp: 480,
        note: 'Key differences between classification and regression',
      },
    ],
  };

  useEffect(() => {
    // Simulate audio playback progress
    let interval: NodeJS.Timeout;
    if (isPlaying) {
      interval = setInterval(() => {
        setCurrentTime(prev => {
          const newTime = prev + 1;
          
          // Update active transcript based on current time
          const currentTranscript = audioContent.transcript.find((item, index) => {
            const nextItem = audioContent.transcript[index + 1];
            return newTime >= item.timestamp && (!nextItem || newTime < nextItem.timestamp);
          });
          
          if (currentTranscript) {
            setActiveTranscriptId(currentTranscript.id);
          }
          
          return Math.min(newTime, audioContent.duration);
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isPlaying, audioContent.transcript, audioContent.duration]);

  const handleBackPress = () => {
    if (selectedNote) {
      // Coming from note detail navigation
      setMainMode();
    } else {
      // Coming from standalone navigation
      navigation?.goBack();
    }
  };

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleSeek = (timestamp: number) => {
    setCurrentTime(timestamp);
    // In a real app, this would seek the audio player
  };

  const handleSpeedChange = () => {
    const speeds = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    setPlaybackSpeed(speeds[nextIndex]);
  };

  const handleAddBookmark = () => {
    Alert.alert(
      'Add Bookmark',
      `Would you like to add a bookmark at ${formatTime(currentTime)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Add', onPress: () => Alert.alert('Success', 'Bookmark added!') },
      ]
    );
  };

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getProgressPercentage = (): number => {
    return (currentTime / audioContent.duration) * 100;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title={selectedNote ? `${selectedNote.title} - Audio` : "Audio Learning"}
        leftAction={{
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackPress,
        }}
        rightAction={{
          icon: <Ionicons name="bookmark-outline" size={24} color={theme.colors.gray[600]} />,
          onPress: handleAddBookmark,
        }}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Audio Content Info */}
        <Card style={styles.audioInfoCard}>
          <View style={styles.audioHeader}>
            <View style={styles.audioIcon}>
              <Ionicons name="headset" size={32} color={theme.colors.primary[600]} />
            </View>
            <View style={styles.audioDetails}>
              <Text style={styles.audioTitle} numberOfLines={2}>
                {audioContent.title}
              </Text>
              <Text style={styles.audioDuration}>
                Duration: {formatTime(audioContent.duration)}
              </Text>
            </View>
          </View>
        </Card>

        {/* Audio Player Controls */}
        <Card style={styles.playerCard}>
          <View style={styles.progressContainer}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <View style={styles.progressBar}>
              <View 
                style={[styles.progressFill, { width: `${getProgressPercentage()}%` }]} 
              />
            </View>
            <Text style={styles.timeText}>{formatTime(audioContent.duration)}</Text>
          </View>

          <View style={styles.controlsContainer}>
            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleSeek(Math.max(0, currentTime - 15))}
            >
              <Ionicons name="play-back" size={20} color={theme.colors.gray[600]} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.playButton}
              onPress={handlePlayPause}
            >
              <Ionicons 
                name={isPlaying ? "pause" : "play"} 
                size={32} 
                color={theme.colors.white} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.controlButton}
              onPress={() => handleSeek(Math.min(audioContent.duration, currentTime + 15))}
            >
              <Ionicons name="play-forward" size={20} color={theme.colors.gray[600]} />
            </TouchableOpacity>
          </View>

          <View style={styles.optionsContainer}>
            <TouchableOpacity
              style={styles.speedButton}
              onPress={handleSpeedChange}
            >
              <Text style={styles.speedText}>{playbackSpeed}x</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.transcriptToggle}
              onPress={() => setShowTranscript(!showTranscript)}
            >
              <Ionicons 
                name={showTranscript ? "document" : "document-outline"} 
                size={20} 
                color={theme.colors.primary[600]} 
              />
              <Text style={styles.transcriptToggleText}>Transcript</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Transcript Section */}
        {showTranscript && (
          <Card style={styles.transcriptCard}>
            <Text style={styles.transcriptTitle}>Transcript</Text>
            <View style={styles.transcriptContent}>
              {audioContent.transcript.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.transcriptItem,
                    activeTranscriptId === item.id && styles.transcriptItemActive,
                  ]}
                  onPress={() => handleSeek(item.timestamp)}
                >
                  <Text style={styles.transcriptTimestamp}>
                    {formatTime(item.timestamp)}
                  </Text>
                  <Text 
                    style={[
                      styles.transcriptText,
                      activeTranscriptId === item.id && styles.transcriptTextActive,
                    ]}
                  >
                    {item.text}
                  </Text>
                  {item.speaker && (
                    <Text style={styles.transcriptSpeaker}>— {item.speaker}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </Card>
        )}

        {/* Bookmarks Section */}
        <Card style={styles.bookmarksCard}>
          <Text style={styles.bookmarksTitle}>Bookmarks</Text>
          {audioContent.bookmarks.length > 0 ? (
            <View style={styles.bookmarksList}>
              {audioContent.bookmarks.map((bookmark) => (
                <TouchableOpacity
                  key={bookmark.id}
                  style={styles.bookmarkItem}
                  onPress={() => handleSeek(bookmark.timestamp)}
                >
                  <View style={styles.bookmarkIcon}>
                    <Ionicons name="bookmark" size={16} color={theme.colors.primary[600]} />
                  </View>
                  <View style={styles.bookmarkContent}>
                    <Text style={styles.bookmarkTime}>
                      {formatTime(bookmark.timestamp)}
                    </Text>
                    <Text style={styles.bookmarkNote} numberOfLines={2}>
                      {bookmark.note}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyBookmarks}>
              No bookmarks yet. Tap the bookmark icon to add one.
            </Text>
          )}
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
  audioInfoCard: {
    marginBottom: theme.spacing.base,
  },
  audioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  audioIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  audioDetails: {
    flex: 1,
  },
  audioTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  audioDuration: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  playerCard: {
    marginBottom: theme.spacing.base,
    padding: theme.spacing.lg,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  timeText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: theme.colors.gray[200],
    borderRadius: theme.borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.full,
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.lg,
    gap: theme.spacing.xl,
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.base,
  },
  optionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  speedButton: {
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.sm,
    backgroundColor: theme.colors.gray[100],
    borderRadius: theme.borderRadius.base,
  },
  speedText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[700],
  },
  transcriptToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  transcriptToggleText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  transcriptCard: {
    marginBottom: theme.spacing.base,
  },
  transcriptTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  transcriptContent: {
    gap: theme.spacing.md,
  },
  transcriptItem: {
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.base,
    backgroundColor: theme.colors.gray[50],
  },
  transcriptItemActive: {
    backgroundColor: theme.colors.primary[50],
    borderWidth: 1,
    borderColor: theme.colors.primary[200],
  },
  transcriptTimestamp: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    fontWeight: theme.typography.fontWeight.medium,
    marginBottom: theme.spacing.xs,
  },
  transcriptText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    marginBottom: theme.spacing.xs,
  },
  transcriptTextActive: {
    color: theme.colors.gray[900],
    fontWeight: theme.typography.fontWeight.medium,
  },
  transcriptSpeaker: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    fontStyle: 'italic',
  },
  bookmarksCard: {
    marginBottom: theme.spacing.base,
  },
  bookmarksTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  bookmarksList: {
    gap: theme.spacing.md,
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.warning[50],
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.warning[200],
  },
  bookmarkIcon: {
    width: 32,
    height: 32,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.warning[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookmarkContent: {
    flex: 1,
  },
  bookmarkTime: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.xs,
  },
  bookmarkNote: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  emptyBookmarks: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: theme.spacing.lg,
  },
}); 