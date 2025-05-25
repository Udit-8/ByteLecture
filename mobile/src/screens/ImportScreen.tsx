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
import { Header, Button, Card, FeatureCard } from '../components';
import { theme } from '../constants/theme';

export const ImportScreen: React.FC = () => {
  const [isUploading, setIsUploading] = useState(false);

  const handlePDFUpload = () => {
    Alert.alert('Coming Soon', 'PDF upload functionality will be available soon!');
  };

  const handleYouTubeImport = () => {
    Alert.alert('Coming Soon', 'YouTube import functionality will be available soon!');
  };

  const handleRecordLecture = () => {
    Alert.alert('Coming Soon', 'Lecture recording functionality will be available soon!');
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
}); 