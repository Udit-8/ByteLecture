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
    clearError,
    reset,
  } = useSummary();

  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState<SummaryOptions>(
    initialOptions || {
      length: 'medium',
      focusArea: 'general',
      temperature: 0.3,
    }
  );

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

  const handleGenerateSummary = async () => {
    try {
      clearError();

      const result = await generateSummary({
        content,
        contentType,
        contentItemId,
        options,
      });

      if (result && onSummaryGenerated) {
        onSummaryGenerated(result);
      }
    } catch (err) {
      console.error('Error generating summary:', err);
    }
  };

  const handleQuickSummary = async (length: 'short' | 'medium' | 'long') => {
    try {
      clearError();

      const result = await quickSummary(content, contentType, length);

      if (result && onSummaryGenerated) {
        onSummaryGenerated(result);
      }
    } catch (err) {
      console.error('Error generating quick summary:', err);
    }
  };

  const formatProcessingTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatTokenCost = (tokens: number, cost: number): string => {
    return `${tokens} tokens (~$${cost.toFixed(4)})`;
  };

  return (
    <View style={[styles.container, style]}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <Ionicons name="sparkles" size={20} color="#6366f1" />
            <Text style={styles.title}>AI Summary</Text>
          </View>
          <View style={styles.contentInfo}>
            <Text style={styles.contentType}>{getContentTypeDisplay()}</Text>
            <Text style={styles.contentLength}>{getContentLength()}</Text>
          </View>
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="warning" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={clearError} style={styles.dismissButton}>
              <Ionicons name="close" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}

        {!summary && !loading && (
          <View style={styles.actionsContainer}>
            <Text style={styles.description}>
              Generate an AI-powered summary of your {contentType} content
            </Text>

            <View style={styles.quickActions}>
              <Button
                title="Quick Summary"
                onPress={() => handleQuickSummary('medium')}
                style={styles.primaryButton}
                disabled={loading}
              />

              <TouchableOpacity
                style={styles.optionsButton}
                onPress={() => setShowOptions(true)}
                disabled={loading}
              >
                <Ionicons name="settings" size={16} color="#6b7280" />
                <Text style={styles.optionsButtonText}>Options</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.lengthButtons}>
              <TouchableOpacity
                style={styles.lengthButton}
                onPress={() => handleQuickSummary('short')}
                disabled={loading}
              >
                <Text style={styles.lengthButtonText}>Short</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lengthButton}
                onPress={() => handleQuickSummary('medium')}
                disabled={loading}
              >
                <Text style={styles.lengthButtonText}>Medium</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.lengthButton}
                onPress={() => handleQuickSummary('long')}
                disabled={loading}
              >
                <Text style={styles.lengthButtonText}>Long</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Generating AI summary...</Text>
            <Text style={styles.loadingSubtext}>This may take a moment</Text>
          </View>
        )}

        {summary && !loading && (
          <View style={styles.summaryContainer}>
            <View style={styles.summaryHeader}>
              <View style={styles.summaryTitleContainer}>
                <Ionicons name="document-text" size={16} color="#059669" />
                <Text style={styles.summaryTitle}>Summary</Text>
              </View>

              {summary.metadata.cacheHit && (
                <View style={styles.cacheIndicator}>
                  <Ionicons name="flash" size={12} color="#f59e0b" />
                  <Text style={styles.cacheText}>Cached</Text>
                </View>
              )}
            </View>

            <ScrollView style={styles.summaryScrollView}>
              <Text style={styles.summaryText}>{summary.text}</Text>
            </ScrollView>

            <View style={styles.metadataContainer}>
              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Processing Time:</Text>
                <Text style={styles.metadataValue}>
                  {formatProcessingTime(summary.metadata.processingTime)}
                </Text>
              </View>

              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Token Usage:</Text>
                <Text style={styles.metadataValue}>
                  {formatTokenCost(
                    summary.metadata.tokensUsed,
                    summary.metadata.estimatedCost
                  )}
                </Text>
              </View>

              <View style={styles.metadataRow}>
                <Text style={styles.metadataLabel}>Compression:</Text>
                <Text style={styles.metadataValue}>
                  {summary.metadata.compressionRatio.toFixed(1)}:1
                </Text>
              </View>
            </View>

            <View style={styles.summaryActions}>
              <Button
                title="New Summary"
                onPress={reset}
                style={styles.secondaryButton}
                variant="outline"
              />
            </View>
          </View>
        )}

        {/* Options Modal */}
        <Modal
          visible={showOptions}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Summary Options</Text>
              <TouchableOpacity onPress={() => setShowOptions(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.optionGroup}>
                <Text style={styles.optionLabel}>Summary Length</Text>
                <View style={styles.optionSelector}>
                  {['short', 'medium', 'long'].map((length) => (
                    <TouchableOpacity
                      key={length}
                      style={[
                        styles.optionItem,
                        options.length === length && styles.optionItemSelected,
                      ]}
                      onPress={() =>
                        setOptions((prev) => ({
                          ...prev,
                          length: length as 'short' | 'medium' | 'long',
                        }))
                      }
                    >
                      <Text
                        style={[
                          styles.optionItemText,
                          options.length === length &&
                            styles.optionItemTextSelected,
                        ]}
                      >
                        {length === 'short' && 'Short (2-3 sentences)'}
                        {length === 'medium' && 'Medium (1-2 paragraphs)'}
                        {length === 'long' && 'Long (3-4 paragraphs)'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.optionGroup}>
                <Text style={styles.optionLabel}>Focus Area</Text>
                <View style={styles.optionSelector}>
                  {['general', 'concepts', 'examples', 'applications'].map(
                    (focus) => (
                      <TouchableOpacity
                        key={focus}
                        style={[
                          styles.optionItem,
                          options.focusArea === focus &&
                            styles.optionItemSelected,
                        ]}
                        onPress={() =>
                          setOptions((prev) => ({
                            ...prev,
                            focusArea: focus as
                              | 'general'
                              | 'concepts'
                              | 'examples'
                              | 'applications',
                          }))
                        }
                      >
                        <Text
                          style={[
                            styles.optionItemText,
                            options.focusArea === focus &&
                              styles.optionItemTextSelected,
                          ]}
                        >
                          {focus === 'general' && 'General Overview'}
                          {focus === 'concepts' && 'Key Concepts'}
                          {focus === 'examples' && 'Examples & Applications'}
                          {focus === 'applications' && 'Practical Applications'}
                        </Text>
                      </TouchableOpacity>
                    )
                  )}
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title="Generate Summary"
                onPress={() => {
                  setShowOptions(false);
                  handleGenerateSummary();
                }}
                style={styles.primaryButton}
              />
            </View>
          </View>
        </Modal>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  card: {
    margin: 16,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  contentInfo: {
    alignItems: 'flex-end',
  },
  contentType: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  contentLength: {
    fontSize: 10,
    color: '#9ca3af',
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
  quickActions: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#6366f1',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderColor: '#d1d5db',
    borderWidth: 1,
  },
  optionsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
  },
  optionsButtonText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 4,
  },
  lengthButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  lengthButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  lengthButtonText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
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
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#059669',
    marginLeft: 6,
  },
  cacheIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  cacheText: {
    fontSize: 10,
    color: '#f59e0b',
    fontWeight: '500',
    marginLeft: 2,
  },
  summaryScrollView: {
    maxHeight: 200,
    marginBottom: 16,
  },
  summaryText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  metadataContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metadataLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  metadataValue: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  summaryActions: {
    alignItems: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  optionGroup: {
    marginBottom: 24,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  optionSelector: {
    flexDirection: 'column',
    gap: 8,
  },
  optionItem: {
    padding: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  optionItemSelected: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  optionItemText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
    textAlign: 'center',
  },
  optionItemTextSelected: {
    color: '#fff',
  },
  modalActions: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
});

export default AISummary;
