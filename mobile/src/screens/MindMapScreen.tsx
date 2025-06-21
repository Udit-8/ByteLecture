import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useMindMap } from '../hooks/useMindMap';
import { useContent } from '../hooks/useContent';
import { MindMapViewer } from '../components/MindMapViewer';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { theme } from '../constants/theme';
import { MindMap, CreateMindMapRequest, MindMapStyle } from '../services/mindMapAPI';

export const MindMapScreen: React.FC = () => {
  const {
    mindMaps,
    currentMindMap,
    loading,
    generating,
    error,
    loadMindMaps,
    loadMindMap,
    generateMindMap,
    deleteMindMap,
    exportMindMap,
    clearCurrentMindMap,
  } = useMindMap();

  const { contentItems, fetchContentItems } = useContent();

  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<string>('');
  const [mindMapTitle, setMindMapTitle] = useState('');
  const [mindMapStyle, setMindMapStyle] = useState<MindMapStyle>('hierarchical');
  const [maxNodes, setMaxNodes] = useState('20');
  
  // Export state
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadMindMaps();
    fetchContentItems();
  }, [loadMindMaps, fetchContentItems]);

  const handleGenerateMindMap = async () => {
    if (!selectedContentId) {
      Alert.alert('Error', 'Please select content to generate a mind map from');
      return;
    }

    const request: CreateMindMapRequest = {
      content_item_id: selectedContentId,
      title: mindMapTitle || undefined,
      style: mindMapStyle,
      max_nodes: parseInt(maxNodes) || 20,
      depth_preference: 'balanced',
    };

    const result = await generateMindMap(request);
    if (result) {
      setShowGenerateModal(false);
      setMindMapTitle('');
      setSelectedContentId('');
    }
  };

  const handleMindMapPress = (mindMap: MindMap) => {
    loadMindMap(mindMap.id);
  };

  const handleDeleteMindMap = (mindMap: MindMap) => {
    Alert.alert(
      'Delete Mind Map',
      `Are you sure you want to delete "${mindMap.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteMindMap(mindMap.id),
        },
      ]
    );
  };

  const handleExportMindMap = (mindMap: MindMap) => {
    Alert.alert(
      'Export Mind Map',
      'Choose export format:',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'JSON', 
          onPress: () => performExport(mindMap, 'json') 
        },
        { 
          text: 'PNG Image', 
          onPress: () => performExport(mindMap, 'png') 
        },
        { 
          text: 'SVG Vector', 
          onPress: () => performExport(mindMap, 'svg') 
        },
      ]
    );
  };

  const performExport = async (mindMap: MindMap, format: 'json' | 'png' | 'svg') => {
    setExporting(true);
    try {
      const result = await exportMindMap(mindMap.id, {
        format,
        include_notes: true,
        theme: 'light',
      });
      
      if (result) {
        Alert.alert(
          'Export Successful',
          `Mind map "${mindMap.title}" has been exported as ${format.toUpperCase()}`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Export failed:', error);
      Alert.alert(
        'Export Failed',
        'Failed to export mind map. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setExporting(false);
    }
  };

  const renderMindMapItem = ({ item }: { item: MindMap }) => (
    <Card style={styles.mindMapCard}>
      <TouchableOpacity
        style={styles.mindMapContent}
        onPress={() => handleMindMapPress(item)}
      >
        <View style={styles.mindMapHeader}>
          <Text style={styles.mindMapTitle}>{item.title}</Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity
              onPress={() => handleExportMindMap(item)}
              style={styles.actionButton}
              disabled={exporting}
            >
              <Ionicons 
                name="download-outline" 
                size={20} 
                color={exporting ? theme.colors.textSecondary : theme.colors.primary[500]} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleDeleteMindMap(item)}
              style={styles.actionButton}
            >
              <Ionicons name="trash-outline" size={20} color={theme.colors.error[500]} />
            </TouchableOpacity>
          </View>
        </View>
        
        {item.description && (
          <Text style={styles.mindMapDescription}>{item.description}</Text>
        )}
        
        <View style={styles.mindMapMeta}>
          <View style={styles.metaItem}>
            <Ionicons name="git-network-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>{item.node_count} nodes</Text>
          </View>
          
          <View style={styles.metaItem}>
            <Ionicons name="layers-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>{item.max_depth} levels</Text>
          </View>
          
          <View style={styles.metaItem}>
            <Ionicons name="shapes-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.metaText}>{item.style}</Text>
          </View>
        </View>
        
        <Text style={styles.mindMapDate}>
          Created {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const renderGenerateModal = () => (
    <Modal
      visible={showGenerateModal}
      animationType="slide"
      presentationStyle="pageSheet"
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Generate Mind Map</Text>
          <TouchableOpacity onPress={() => setShowGenerateModal(false)}>
            <Ionicons name="close" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.modalContent}>
          <Text style={styles.fieldLabel}>Select Content</Text>
          <FlatList
            data={contentItems}
            keyExtractor={(item) => item.id}
            style={styles.contentList}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.contentItem,
                  selectedContentId === item.id && styles.contentItemSelected,
                ]}
                onPress={() => setSelectedContentId(item.id)}
              >
                                 <View style={styles.contentItemContent}>
                   <Ionicons
                     name={
                       item.contentType === 'pdf'
                         ? 'document-text-outline'
                         : item.contentType === 'youtube'
                         ? 'logo-youtube'
                         : 'mic-outline'
                     }
                     size={20}
                     color={theme.colors.primary[500]}
                   />
                   <Text style={styles.contentItemTitle}>{item.title}</Text>
                 </View>
                {selectedContentId === item.id && (
                  <Ionicons name="checkmark" size={20} color={theme.colors.success[500]} />
                )}
              </TouchableOpacity>
            )}
          />

          <Text style={styles.fieldLabel}>Mind Map Title (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Enter custom title..."
            value={mindMapTitle}
            onChangeText={setMindMapTitle}
          />

          <Text style={styles.fieldLabel}>Style</Text>
          <View style={styles.styleOptions}>
            {(['hierarchical', 'radial', 'flowchart'] as MindMapStyle[]).map((style) => (
              <TouchableOpacity
                key={style}
                style={[
                  styles.styleOption,
                  mindMapStyle === style && styles.styleOptionSelected,
                ]}
                onPress={() => setMindMapStyle(style)}
              >
                <Text
                  style={[
                    styles.styleOptionText,
                    mindMapStyle === style && styles.styleOptionTextSelected,
                  ]}
                >
                  {style.charAt(0).toUpperCase() + style.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Max Nodes</Text>
          <TextInput
            style={styles.textInput}
            placeholder="20"
            value={maxNodes}
            onChangeText={setMaxNodes}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.modalFooter}>
          <Button
            title="Cancel"
            onPress={() => setShowGenerateModal(false)}
            style={styles.cancelButton}
            textStyle={styles.cancelButtonText}
          />
          <Button
            title={generating ? 'Generating...' : 'Generate'}
            onPress={handleGenerateMindMap}
            disabled={generating || !selectedContentId}
            style={styles.generateButton}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );

  if (currentMindMap) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.viewerHeader}>
          <TouchableOpacity
            onPress={clearCurrentMindMap}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <Text style={styles.viewerTitle}>{currentMindMap.title}</Text>
          <TouchableOpacity
            onPress={() => handleExportMindMap(currentMindMap)}
            style={styles.actionButton}
            disabled={exporting}
          >
            <Ionicons 
              name="download-outline" 
              size={24} 
              color={exporting ? theme.colors.textSecondary : theme.colors.primary[500]} 
            />
          </TouchableOpacity>
        </View>
        
        <MindMapViewer
          mindMapData={currentMindMap.mind_map_data}
          style={styles.viewer}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mind Maps</Text>
        <TouchableOpacity
          onPress={() => setShowGenerateModal(true)}
          style={styles.addButton}
        >
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary[500]} />
          <Text style={styles.loadingText}>Loading mind maps...</Text>
        </View>
      ) : mindMaps.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="git-network-outline" size={64} color={theme.colors.textSecondary} />
          <Text style={styles.emptyTitle}>No Mind Maps Yet</Text>
          <Text style={styles.emptyDescription}>
            Create your first mind map from uploaded content
          </Text>
          <Button
            title="Generate Mind Map"
            onPress={() => setShowGenerateModal(true)}
            style={styles.emptyButton}
          />
        </View>
      ) : (
        <FlatList
          data={mindMaps}
          keyExtractor={(item) => item.id}
          renderItem={renderMindMapItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {renderGenerateModal()}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
  },
  addButton: {
    backgroundColor: theme.colors.primary[500],
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
     errorContainer: {
     margin: theme.spacing.base,
     padding: theme.spacing.md,
     backgroundColor: theme.colors.error[50],
     borderRadius: theme.borderRadius.base,
     borderWidth: 1,
     borderColor: theme.colors.error[100],
   },
  errorText: {
    color: theme.colors.error[700],
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    color: theme.colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing['2xl'],
  },
  emptyTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.text,
    marginTop: theme.spacing.base,
  },
  emptyDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  emptyButton: {
    paddingHorizontal: theme.spacing['2xl'],
  },
  listContent: {
    padding: theme.spacing.base,
  },
  mindMapCard: {
    marginBottom: theme.spacing.md,
  },
  mindMapContent: {
    padding: theme.spacing.base,
  },
  mindMapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.sm,
  },
  mindMapTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionButton: {
    padding: theme.spacing.xs,
  },
  mindMapDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.md,
  },
  mindMapMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  metaText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.textSecondary,
  },
  mindMapDate: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.textSecondary,
  },
  viewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    marginRight: theme.spacing.md,
  },
  viewerTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
    flex: 1,
  },
  viewer: {
    flex: 1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  modalTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.text,
  },
  modalContent: {
    flex: 1,
    padding: theme.spacing.base,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  contentList: {
    maxHeight: 200,
    marginBottom: theme.spacing.md,
  },
  contentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  contentItemSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  contentItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  contentItemTitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.text,
    flex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.base,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.base,
    backgroundColor: theme.colors.white,
    marginBottom: theme.spacing.md,
  },
  styleOptions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  styleOption: {
    flex: 1,
    padding: theme.spacing.md,
    borderRadius: theme.borderRadius.base,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
  },
  styleOptionSelected: {
    borderColor: theme.colors.primary[500],
    backgroundColor: theme.colors.primary[50],
  },
  styleOptionText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.text,
  },
  styleOptionTextSelected: {
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    padding: theme.spacing.base,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  cancelButtonText: {
    color: theme.colors.text,
  },
  generateButton: {
    flex: 1,
  },
}); 