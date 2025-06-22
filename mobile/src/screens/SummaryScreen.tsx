import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Card, Button, AISummary } from '../components';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';
import { contentAPI, ContentItem } from '../services/contentAPI';

export const SummaryScreen: React.FC = () => {
  const { selectedNote, setMainMode } = useNavigation();
  const [fullContent, setFullContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleBackPress = () => {
    setMainMode();
  };

  // Get content data from selected note
  const contentItem = selectedNote?.content?.contentItem;

  // Fetch full content when contentItem changes
  useEffect(() => {
    const fetchFullContent = async () => {
      if (!contentItem) {
        setFullContent('');
        return;
      }

      // If this is a temporary content item, try to find the real content item by URL
      if (contentItem.id.startsWith('temp-')) {
        console.log(
          '🔍 Temporary content item detected, trying to find real content by URL:',
          contentItem.fileUrl
        );
        console.log(
          '🔍 Temporary content item detected, trying to find real content by title:',
          contentItem.title
        );
        setIsLoading(true);
        setError(null);

        try {
          // Get all content items and try to find one that matches this temporary one
          const allContentResponse = await contentAPI.getContentItems();

          if (allContentResponse.success && allContentResponse.contentItems) {
            const matchingItem = allContentResponse.contentItems.find(
              (item: ContentItem) =>
                contentItem.fileUrl
                  ?.toLowerCase()
                  .includes(item.fileUrl?.toLowerCase()) ||
                item.title
                  .toLowerCase()
                  .includes(contentItem.title.toLowerCase())
            );

            if (matchingItem) {
              console.log(
                '✅ Found matching real content item:',
                matchingItem.id
              );
              const response = await contentAPI.getFullContent(matchingItem.id);

              if (response.success && response.fullContent) {
                console.log(
                  '✅ Full content fetched successfully, length:',
                  response.fullContent.length
                );
                setFullContent(response.fullContent);
                return;
              }
            } else {
              console.log('⚠️ No matching real content item found');
            }
          }

          // Fall back to default content if we can't find the real item
          setFullContent(getContentForSummaryFallback());
        } catch (err) {
          console.error('❌ Error finding real content item:', err);
          setError(
            err instanceof Error ? err.message : 'Failed to load content'
          );
          setFullContent(getContentForSummaryFallback());
        } finally {
          setIsLoading(false);
        }
        return;
      }

      // For real content items, fetch full content normally
      setIsLoading(true);
      setError(null);

      try {
        console.log('🔍 Fetching full content for item:', contentItem.id);
        const response = await contentAPI.getFullContent(contentItem.id);

        if (response.success && response.fullContent) {
          console.log(
            '✅ Full content fetched successfully, length:',
            response.fullContent.length
          );
          setFullContent(response.fullContent);
        } else {
          console.log('⚠️ No full content available, using fallback');
          setFullContent(getContentForSummaryFallback());
        }
      } catch (err) {
        console.error('❌ Error fetching full content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content');
        setFullContent(getContentForSummaryFallback());
      } finally {
        setIsLoading(false);
      }
    };

    fetchFullContent();
  }, [contentItem?.id]);

  const getContentForSummaryFallback = (): string => {
    if (!contentItem) return '';

    // Use existing summary if available, otherwise use description
    if (contentItem.summary) {
      return contentItem.summary;
    }

    if (contentItem.description) {
      return contentItem.description;
    }

    return `Content from ${contentItem.title}`;
  };

  const getContentForSummary = (): string => {
    // Return full content if available, otherwise fallback
    return fullContent || getContentForSummaryFallback();
  };

  const getContentType = (): 'pdf' | 'youtube' | 'audio' | 'text' => {
    if (!contentItem) return 'text';

    switch (contentItem.contentType) {
      case 'pdf':
        return 'pdf';
      case 'youtube':
        return 'youtube';
      case 'lecture_recording':
        return 'audio';
      default:
        return 'text';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title={selectedNote?.title || 'Summary'}
        leftAction={{
          icon: (
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.gray[600]}
            />
          ),
          onPress: handleBackPress,
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {selectedNote && contentItem ? (
          <View style={styles.summaryContainer}>
            {isLoading ? (
              <Card style={styles.loadingCard}>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.primary[600]}
                  />
                  <Text style={styles.loadingText}>Loading content...</Text>
                </View>
              </Card>
            ) : error ? (
              <Card style={styles.errorCard}>
                <View style={styles.errorContainer}>
                  <Ionicons
                    name="warning"
                    size={24}
                    color={theme.colors.error[600]}
                  />
                  <Text style={styles.errorText}>{error}</Text>
                  <Text style={styles.errorSubtext}>
                    Using available content for summary
                  </Text>
                </View>
              </Card>
            ) : null}

            <AISummary
              content={getContentForSummary()}
              contentType={getContentType()}
              contentItemId={contentItem.id}
              style={styles.aiSummaryComponent}
              onSummaryGenerated={(summary) => {
                console.log('Summary generated:', summary);
                // Could store this in local state or update the content item
              }}
            />

            <Card style={styles.sourceCard}>
              <Text style={styles.sourceTitle}>Source Material</Text>
              <View style={styles.sourceInfo}>
                <View style={styles.sourceIcon}>
                  <Ionicons
                    name={
                      selectedNote.type === 'PDF'
                        ? 'document-text'
                        : selectedNote.type === 'YouTube'
                          ? 'logo-youtube'
                          : 'headset'
                    }
                    size={20}
                    color={theme.colors.primary[600]}
                  />
                </View>
                <View style={styles.sourceDetails}>
                  <Text style={styles.sourceName}>{selectedNote.title}</Text>
                  <Text style={styles.sourceType}>
                    {selectedNote.type} • {selectedNote.progress}% complete
                  </Text>
                  {contentItem.description && (
                    <Text style={styles.sourceDescription} numberOfLines={2}>
                      {contentItem.description}
                    </Text>
                  )}
                  {fullContent && (
                    <Text style={styles.contentLengthInfo}>
                      Content: {fullContent.length.toLocaleString()} characters
                    </Text>
                  )}
                </View>
              </View>
            </Card>
          </View>
        ) : (
          <Card style={styles.placeholderCard}>
            <View style={styles.placeholderContent}>
              <Ionicons
                name="document-text-outline"
                size={48}
                color={theme.colors.gray[400]}
              />
              <Text style={styles.placeholderTitle}>No Content Selected</Text>
              <Text style={styles.placeholderText}>
                Select a note from the Recent Notes section to view its
                AI-generated summary.
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
  headerCard: {
    backgroundColor: theme.colors.primary[600],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
    marginBottom: theme.spacing.sm,
  },
  headerDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary[100],
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    marginBottom: theme.spacing.md,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.primary[200],
    fontWeight: theme.typography.fontWeight.medium,
  },
  summaryCard: {
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
  },
  keyPointsList: {
    gap: theme.spacing.md,
  },
  keyPointItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: theme.spacing.md,
  },
  keyPointBullet: {
    width: 24,
    height: 24,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  keyPointNumber: {
    fontSize: theme.typography.fontSize.xs,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
  },
  keyPointText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  topicsCard: {
    marginBottom: theme.spacing.lg,
  },
  topicsList: {
    gap: theme.spacing.sm,
  },
  topicItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  topicText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  actionCard: {
    backgroundColor: theme.colors.success[50],
    borderColor: theme.colors.success[100],
    marginBottom: theme.spacing.lg,
  },
  actionTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  actionDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.base,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
  },
  actionButton: {
    flex: 1,
  },
  sourceCard: {
    backgroundColor: theme.colors.gray[100],
  },
  sourceTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.md,
  },
  sourceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  sourceIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.lg,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sourceDetails: {
    flex: 1,
  },
  sourceName: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  sourceType: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  summaryContainer: {
    flex: 1,
  },
  aiSummaryComponent: {
    marginBottom: theme.spacing.lg,
  },
  sourceDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.xs,
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  placeholderCard: {
    marginTop: theme.spacing.xl,
  },
  placeholderContent: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl * 2,
  },
  placeholderTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[700],
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  placeholderText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[500],
    textAlign: 'center',
    lineHeight:
      theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    paddingHorizontal: theme.spacing.lg,
  },
  loadingCard: {
    marginBottom: theme.spacing.lg,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.md,
  },
  errorCard: {
    backgroundColor: theme.colors.error[50],
    borderColor: theme.colors.error[100],
    marginBottom: theme.spacing.lg,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.error[700],
    fontWeight: theme.typography.fontWeight.medium,
  },
  errorSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.error[600],
    marginTop: theme.spacing.xs,
  },
  contentLengthInfo: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[500],
    marginTop: theme.spacing.xs,
  },
});
