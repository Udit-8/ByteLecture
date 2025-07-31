import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSummary } from '../hooks/useSummary';
import { SummaryOptions, Summary } from '../services/summaryAPI';
import { Button } from './Button';
import { Card } from './Card';

interface AISummaryProps {
  content: string;
  contentType: 'pdf' | 'youtube' | 'audio' | 'text';
  contentItemId?: string;
  initialOptions?: SummaryOptions;
  onSummaryGenerated?: (summary: Summary) => void;
  style?: any;
}

export const AISummary: React.FC<AISummaryProps> = ({
  content,
  contentType,
  contentItemId,
  initialOptions,
  onSummaryGenerated,
  style,
}) => {
  const {
    loading,
    error,
    summary,
    generateSummary,
    quickSummary,
    getSummariesByContentItem,
    clearError,
    reset,
  } = useSummary();

  // Local state to track if we've checked for existing summaries
  const [hasCheckedForExisting, setHasCheckedForExisting] = useState(false);
  // Local state for existing summary (since hook's summary is for newly generated ones)
  const [existingSummary, setExistingSummary] = useState<Summary | null>(null);

  // Check for existing summaries when component mounts or contentItemId changes
  useEffect(() => {
    const loadExistingSummary = async () => {
      if (contentItemId && !summary && !existingSummary && !hasCheckedForExisting) {
        console.log('🔍 Checking for existing summary for content item:', contentItemId);
        setHasCheckedForExisting(true);
        
        try {
          const existingSummaries = await getSummariesByContentItem(contentItemId);
          if (existingSummaries && existingSummaries.length > 0) {
            // Use the most recent summary (first in the array since they're sorted by created_at desc)
            const latestSummary = existingSummaries[0];
            console.log('✅ Found existing summary:', latestSummary.id);
            
            // Set the existing summary in local state
            setExistingSummary(latestSummary);
            
            // Also notify the parent component
            if (onSummaryGenerated) {
              onSummaryGenerated(latestSummary);
            }
          } else {
            console.log('📪 No existing summary found for this content item');
          }
        } catch (err) {
          console.error('❌ Error checking for existing summary:', err);
        }
      }
    };

    loadExistingSummary();
  }, [contentItemId, getSummariesByContentItem, summary, existingSummary, hasCheckedForExisting, onSummaryGenerated]);

  // Reset states when contentItemId changes
  useEffect(() => {
    setHasCheckedForExisting(false);
    setExistingSummary(null);
  }, [contentItemId]);

  // Simplified - no user options needed for comprehensive summaries

  const getContentTypeDisplay = () => {
    switch (contentType) {
      case 'pdf':
        return 'PDF Document';
      case 'youtube':
        return 'YouTube Video';
      case 'audio':
        return 'Audio Recording';
      case 'text':
        return 'Text Content';
      default:
        return 'Content';
    }
  };

  const getContentLength = () => {
    if (content.length < 1000) return `${content.length} characters`;
    if (content.length < 1000000)
      return `${(content.length / 1000).toFixed(1)}K characters`;
    return `${(content.length / 1000000).toFixed(1)}M characters`;
  };

  // Get the current summary to display (either newly generated or existing)
  const currentSummary = summary || existingSummary;

  const handleGenerateSummary = async () => {
    try {
      clearError();
      // Clear existing summary when generating a new one
      setExistingSummary(null);

      const result = await generateSummary({
        content,
        contentType,
        contentItemId,
        options: {
          length: 'long', // Always generate detailed summaries
          temperature: 0.3,
        },
      });

      if (result && onSummaryGenerated) {
        onSummaryGenerated(result);
      }
    } catch (err) {
      console.error('Error generating summary:', err);
    }
  };

  // Removed metadata formatting functions - no longer needed

  const renderFormattedSummary = (text: string) => {
    console.log('DEBUG: Full summary text:', text);
    const lines = text.split('\n');
    let hasSeenMainTitle = false;
    // Buffer to accumulate table rows
    let tableBuffer: string[] = [];
    const renderedElements: React.ReactElement[] = [];

    const flushTable = (keyPrefix: string) => {
      if (tableBuffer.length === 0) return;
      // Drop separator row (---) if present
      const cleanedRows = tableBuffer.filter(
        (l) => !/^\s*\|?[-: ]+\|[-| :]+$/.test(l)
      );
      const parsedRows = cleanedRows.map((row) =>
        row
          .trim()
          .replace(/^\|/, '')
          .replace(/\|$/, '')
          .split('|')
          .map((cell) => cell.trim())
      );

      renderedElements.push(
        <View key={`table-${keyPrefix}`} style={styles.tableContainer}>
          {parsedRows.map((cells, rIdx) => (
            <View
              key={`tr-${keyPrefix}-${rIdx}`}
              style={[styles.tableRow, rIdx === 0 && styles.tableHeaderRow]}
            >
              {cells.map((cell, cIdx) => (
                <View key={`td-${keyPrefix}-${rIdx}-${cIdx}`} style={styles.tableCell}>
                  <Text
                    style={[
                      styles.summaryText,
                      rIdx === 0 ? styles.tableHeaderText : styles.tableCellText,
                    ]}
                  >
                    {cell}
                  </Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      );
      tableBuffer = [];
    };

    lines.forEach((rawLine, lineIndex) => {
      // Work on a mutable copy
      let line = rawLine;
      console.log(`DEBUG Line ${lineIndex}:`, line);

      if (line.trim() === '') {
        // Flush any pending table before spacer
        flushTable(`${lineIndex}-blank`);
        renderedElements.push(<View key={`spacer-${lineIndex}`} style={styles.spacer} />);
        return;
      }

      // Detect table pattern (starts with | and has another |)
      if (/^\s*\|.*\|/.test(line)) {
        tableBuffer.push(line);
        return;
      } else {
        // If buffer has content and current line is not a table, flush
        flushTable(`${lineIndex}-flush`);
      }

      // Detect markdown heading levels (e.g., #, ##, ###)
      const headingMatch = line.match(/^\s*(#{1,6})\s+(.*)$/);
      let markdownHeadingLevel: number | null = null;
      if (headingMatch) {
        markdownHeadingLevel = headingMatch[1].length;
        line = headingMatch[2]; // remove leading hashes for rendering
      }

      // Check for emojis that indicate titles/headers
      const hasEmoji = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u.test(line);

      // Determine header types
      const isMarkdownMain = markdownHeadingLevel === 1;
      const isMarkdownSection = markdownHeadingLevel === 2;
      const isMarkdownSub = markdownHeadingLevel === 3;

      // Original emoji / pattern based detection
      const isEmojiMain = !hasSeenMainTitle && hasEmoji && lineIndex === 0;
      const isEmojiSection = !isEmojiMain && hasEmoji;

      const isMainTitleLine = isMarkdownMain || isEmojiMain;
      const isSectionHeaderLine = (isMarkdownSection || isEmojiSection) && !isMainTitleLine;
      const isSubHeaderLine = isMarkdownSub && !isMainTitleLine && !isSectionHeaderLine;

      if (isMainTitleLine) {
        hasSeenMainTitle = true;
        console.log('DEBUG: Found main title:', line);
      }
      
      if (isSectionHeaderLine || isSubHeaderLine) {
        console.log('DEBUG: Found section header:', line);
      }
      
      // Check if line contains bold text (**text**)
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;
      
      // Process bold text if it exists
      while ((match = boldRegex.exec(line)) !== null) {
        // Add text before the bold text
        if (match.index > lastIndex) {
          parts.push({
            text: line.substring(lastIndex, match.index),
            isBold: false,
            isMainTitle: isMainTitleLine,
            isSectionHeader: isSectionHeaderLine,
          });
        }
        
        // Add the bold text (without the **)
        parts.push({
          text: match[1],
          isBold: true,
          isMainTitle: isMainTitleLine,
          isSectionHeader: isSectionHeaderLine,
        });
        
        lastIndex = match.index + match[0].length;
      }
      
      // Add remaining text after last bold match
      if (lastIndex < line.length) {
        parts.push({
          text: line.substring(lastIndex),
          isBold: false,
          isMainTitle: isMainTitleLine,
          isSectionHeader: isSectionHeaderLine,
        });
      }
      
      // If no bold text found, treat the whole line
      if (parts.length === 0) {
        parts.push({
          text: line,
          isBold: false,
          isMainTitle: isMainTitleLine,
          isSectionHeader: isSectionHeaderLine,
        });
      }
      
      renderedElements.push(
        <View key={`line-${lineIndex}`} style={[
          isMainTitleLine && styles.mainTitleContainer,
          isSectionHeaderLine && styles.sectionHeaderContainer,
          isSubHeaderLine && styles.subHeaderContainer,
          !isMainTitleLine && !isSectionHeaderLine && !isSubHeaderLine && styles.regularLineContainer,
        ]}>
          <Text style={styles.summaryLine}>
            {parts.map((part, partIndex) => {
              console.log(`DEBUG Part ${partIndex}:`, part);
              return (
                <Text
                  key={partIndex}
                  style={[
                    styles.summaryText,
                    part.isBold && styles.boldText,
                    part.isMainTitle && styles.mainTitleText,
                    part.isSectionHeader && styles.sectionHeaderText,
                    isSubHeaderLine && styles.subHeaderText,
                  ]}
                >
                  {part.text}
                </Text>
              );
            })}
          </Text>
        </View>
      );
    });

    // Flush remaining table at end
    flushTable('end');

    return <View style={styles.summaryTextContainer}>{renderedElements}</View>;
  };

  return (
    <View style={[styles.container, style]}>
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError} style={styles.dismissButton}>
              <Ionicons name="close" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

      {!currentSummary && !loading && (
          <View style={styles.actionsContainer}>
            <Text style={styles.description}>
            Generate a detailed AI-powered summary of your {contentType} content
            </Text>

              <Button
            title="Generate Summary"
            onPress={handleGenerateSummary}
                style={styles.primaryButton}
                disabled={loading}
              />
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Generating AI summary...</Text>
            <Text style={styles.loadingSubtext}>This may take a moment</Text>
          </View>
        )}

      {currentSummary && !loading && (
          <View style={styles.summaryContainer}>
          {renderFormattedSummary(currentSummary.text)}
          </View>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  errorText: {
    flex: 1,
    color: '#ef4444',
    fontSize: 14,
    marginLeft: 8,
  },
  dismissButton: {
    padding: 4,
  },
  actionsContainer: {
    alignItems: 'center',
  },
  description: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
    marginTop: 8,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#d1d5db',
    borderWidth: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  loadingText: {
    fontSize: 16,
    color: '#374151',
    marginTop: 12,
    fontWeight: '500',
  },
  loadingSubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  summaryContainer: {
    flex: 1,
  },
  summaryTextContainer: {
    marginBottom: 24,
  },

  summaryLine: {
    marginBottom: 4,
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 26,
    color: '#111827',
    textAlign: 'left',
  },
  boldText: {
    fontWeight: 'bold',
    color: '#111827',
    fontSize: 17,
  },
  mainTitleText: {
    fontWeight: '900',
    color: '#111827',
    fontSize: 28,
    lineHeight: 36,
    marginBottom: 16,
    textShadowColor: 'rgba(139, 92, 246, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  sectionHeaderText: {
    fontWeight: '800',
    color: '#111827',
    fontSize: 22,
    lineHeight: 30,
    marginTop: 24,
    marginBottom: 12,
    textShadowColor: 'rgba(29, 78, 216, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 1,
  },
  mainTitleContainer: {
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeaderContainer: {
    marginTop: 20,
    marginBottom: 12,
  },
  subHeaderContainer: {
    marginTop: 16,
    marginBottom: 8,
  },
  regularLineContainer: {
    marginBottom: 4,
  },
  spacer: {
    height: 12,
  },
  summaryActions: {
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  tableContainer: {
    marginVertical: 12,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 4,
  },
  tableRow: {
    flexDirection: 'row',
  },
  tableHeaderRow: {
    backgroundColor: '#f3f4f6',
  },
  tableCell: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderRightWidth: 1,
    borderRightColor: '#d1d5db',
  },
  tableCellText: {
    color: '#111827',
  },
  tableHeaderText: {
    fontWeight: '700',
    color: '#111827',
  },
  subHeaderText: {
    fontWeight: '700',
    color: '#111827',
    fontSize: 18,
    lineHeight: 26,
    marginTop: 8,
    marginBottom: 6,
  },
});

export default AISummary;
