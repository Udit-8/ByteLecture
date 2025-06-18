import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useNavigation, Note } from '../contexts/NavigationContext';
import { useContent } from '../hooks/useContent';
import { ContentItem } from '../services/contentAPI';

export const RecentNotesScreen: React.FC = () => {
  const { setNoteDetailMode } = useNavigation();
  const {
    contentItems,
    loading,
    error,
    refreshing,
    stats,
    fetchRecentItems,
    refresh,
    clearError,
  } = useContent();

  // Load content items on component mount
  useEffect(() => {
    fetchRecentItems();
  }, [fetchRecentItems]);

  // Clear error when component unmounts
  useEffect(() => {
    return () => {
      if (error) {
        clearError();
      }
    };
  }, [error, clearError]);

  const handleNotePress = (contentItem: ContentItem) => {
    // Convert ContentItem to Note format for the navigation context
    const note: Note = {
      id: contentItem.id,
      title: contentItem.title,
      type: mapContentTypeToNoteType(contentItem.contentType),
      date: contentItem.createdAt,
      progress: contentItem.processed ? 100 : 0, // Simple processed/not processed for now
      content: {
        contentItem: contentItem, // Store the full content item for later use
        processed: contentItem.processed,
        summary: contentItem.summary,
      },
    };
    
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

  const getTypeIcon = (type: Note['type']) => {
    switch (type) {
      case 'PDF':
        return 'document-text';
      case 'YouTube':
        return 'logo-youtube';
      case 'Audio':
        return 'headset';
      case 'Text':
        return 'reader';
      default:
        return 'document';
    }
  };

  const getTypeColor = (type: Note['type']) => {
    switch (type) {
      case 'PDF':
        return theme.colors.primary[600];
      case 'YouTube':
        return theme.colors.error[600];
      case 'Audio':
        return theme.colors.success[600];
      case 'Text':
        return theme.colors.warning[600];
      default:
        return theme.colors.gray[600];
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const handleRefresh = async () => {
    await refresh();
  };

  const handleErrorDismiss = () => {
    clearError();
  };

  // Show loading on first load
  if (loading && contentItems.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="Recent Notes" />
        <View style={styles.loadingContainer}>
          <LoadingIndicator size="large" color={theme.colors.primary[600]} />
          <Text style={styles.loadingText}>Loading your content...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Recent Notes" />
      
      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.colors.primary[600]]}
            tintColor={theme.colors.primary[600]}
          />
        }
      >
        {error && (
          <Card style={styles.errorCard}>
            <View style={styles.errorContent}>
              <Ionicons name="alert-circle" size={24} color={theme.colors.error[600]} />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={handleErrorDismiss}>
                <Text style={styles.dismissText}>Dismiss</Text>
              </TouchableOpacity>
            </View>
          </Card>
        )}

        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Your Learning Materials</Text>
          <Text style={styles.welcomeDescription}>
            Access your imported content and continue learning where you left off.
          </Text>
        </View>

        {stats && (
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>{stats.totalItems}</Text>
              <Text style={styles.statLabel}>Total Notes</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {stats.processedItems}
              </Text>
              <Text style={styles.statLabel}>Processed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statNumber}>
                {stats.pendingItems}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
          </View>
        )}

        <View style={styles.notesList}>
          {contentItems.map((contentItem) => {
            const noteType = mapContentTypeToNoteType(contentItem.contentType);
            return (
              <TouchableOpacity
                key={contentItem.id}
                onPress={() => handleNotePress(contentItem)}
                activeOpacity={0.7}
              >
                <Card style={styles.noteCard}>
                  <View style={styles.noteHeader}>
                    <View style={styles.noteIcon}>
                      <Ionicons 
                        name={getTypeIcon(noteType) as any} 
                        size={24} 
                        color={getTypeColor(noteType)} 
                      />
                    </View>
                    <View style={styles.noteInfo}>
                      <Text style={styles.noteTitle} numberOfLines={2}>
                        {contentItem.title}
                      </Text>
                      <View style={styles.noteMeta}>
                        <View style={styles.typeTag}>
                          <Text style={[styles.typeText, { color: getTypeColor(noteType) }]}>
                            {noteType}
                          </Text>
                        </View>
                        <Text style={styles.dateText}>
                          {formatDate(contentItem.createdAt)}
                        </Text>
                      </View>
                      {contentItem.description && (
                        <Text style={styles.noteDescription} numberOfLines={2}>
                          {contentItem.description}
                        </Text>
                      )}
                    </View>
                    <View style={styles.statusSection}>
                      {contentItem.processed ? (
                        <View style={styles.processedBadge}>
                          <Ionicons name="checkmark-circle" size={16} color={theme.colors.success[600]} />
                          <Text style={styles.processedText}>Ready</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingBadge}>
                          <Ionicons name="time" size={16} color={theme.colors.warning[600]} />
                          <Text style={styles.pendingText}>Processing</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  
                  {contentItem.processed && (
                    <View style={styles.aiFeatures}>
                      <Text style={styles.aiFeaturesTitle}>AI Features Available</Text>
                      <View style={styles.featuresList}>
                        <View style={styles.featureItem}>
                          <Ionicons name="document-text" size={14} color={theme.colors.primary[600]} />
                          <Text style={styles.featureText}>Summary</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Ionicons name="library" size={14} color={theme.colors.primary[600]} />
                          <Text style={styles.featureText}>Flashcards</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Ionicons name="help-circle" size={14} color={theme.colors.primary[600]} />
                          <Text style={styles.featureText}>Quiz</Text>
                        </View>
                        <View style={styles.featureItem}>
                          <Ionicons name="chatbubbles" size={14} color={theme.colors.primary[600]} />
                          <Text style={styles.featureText}>AI Tutor</Text>
                        </View>
                      </View>
                    </View>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
        </View>

        {contentItems.length === 0 && !loading && (
          <Card style={styles.emptyCard}>
            <View style={styles.emptyContent}>
              <Ionicons name="folder-open-outline" size={48} color={theme.colors.gray[400]} />
              <Text style={styles.emptyTitle}>No Content Yet</Text>
              <Text style={styles.emptyDescription}>
                Import some content from the Import tab to see your learning materials here. Upload PDFs, add YouTube videos, or record lectures to get started.
              </Text>
            </View>
          </Card>
        )}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.spacing['2xl'],
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
  errorCard: {
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.error[50],
    borderColor: theme.colors.error[500],
    borderWidth: 1,
  },
  errorContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  errorText: {
    flex: 1,
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error[700],
  },
  dismissText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  welcomeSection: {
    marginBottom: theme.spacing.lg,
  },
  welcomeTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  welcomeDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    marginBottom: theme.spacing.lg,
    ...theme.shadow.sm,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.xs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  notesList: {
    gap: theme.spacing.md,
  },
  noteCard: {
    padding: theme.spacing.base,
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  noteIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  noteInfo: {
    flex: 1,
  },
  noteTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  noteDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.xs,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  noteMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  typeTag: {
    backgroundColor: theme.colors.gray[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  typeText: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  dateText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
  },
  statusSection: {
    alignItems: 'center',
  },
  processedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.success[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  processedText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.success[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.warning[100],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  pendingText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.warning[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  aiFeatures: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  aiFeaturesTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.sm,
  },
  featuresList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.sm,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
    gap: theme.spacing.xs,
  },
  featureText: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.primary[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  emptyCard: {
    padding: theme.spacing['2xl'],
  },
  emptyContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginTop: theme.spacing.base,
    marginBottom: theme.spacing.sm,
  },
  emptyDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
}); 