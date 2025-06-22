import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { theme } from '../constants/theme';
import { Button } from './Button';

const { width: screenWidth } = Dimensions.get('window');

export type FeatureType = 
  | 'pdf-processing'
  | 'youtube-processing'
  | 'flashcard-generation'
  | 'quiz-generation'
  | 'ai-tutor'
  | 'mind-map'
  | 'audio-transcription'
  | 'general';

interface PremiumUpsellModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  featureType: FeatureType;
  currentUsage?: number;
  limit?: number;
}

interface FeatureConfig {
  title: string;
  subtitle: string;
  description: string;
  benefits: string[];
  icon: string;
  color: string;
}

const featureConfigs: Record<FeatureType, FeatureConfig> = {
  'pdf-processing': {
    title: 'PDF Processing Limit Reached',
    subtitle: 'Unlock unlimited PDF uploads',
    description: 'You\'ve reached your daily limit of 2 PDF uploads. Upgrade to premium for unlimited document processing.',
    benefits: [
      'Unlimited PDF uploads per day',
      'Advanced AI summarization',
      'Enhanced text extraction',
      'Priority processing speed'
    ],
    icon: '📄',
    color: theme.colors.primary[500],
  },
  'youtube-processing': {
    title: 'YouTube Processing Limit Reached',
    subtitle: 'Unlock unlimited YouTube learning',
    description: 'You\'ve reached your daily limit of 2 YouTube video processing. Upgrade to premium for unlimited video learning.',
    benefits: [
      'Unlimited YouTube video processing',
      'Advanced transcript analysis',
      'Multi-language support',
      'Video bookmark features'
    ],
    icon: '📺',
    color: theme.colors.error[500],
  },
  'flashcard-generation': {
    title: 'Flashcard Generation Limit Reached',
    subtitle: 'Unlock unlimited flashcard creation',
    description: 'You\'ve reached your daily limit of 3 flashcard sets. Upgrade to premium for unlimited study materials.',
    benefits: [
      'Unlimited flashcard generation',
      'Advanced spaced repetition',
      'Custom card templates',
      'Progress analytics'
    ],
    icon: '🃏',
    color: theme.colors.warning[500],
  },
  'quiz-generation': {
    title: 'Quiz Generation Limit Reached',
    subtitle: 'Unlock unlimited quiz creation',
    description: 'You\'ve reached your daily limit of 3 quiz generations. Upgrade to premium for unlimited practice tests.',
    benefits: [
      'Unlimited quiz generation',
      'Custom difficulty levels',
      'Detailed explanations',
      'Performance tracking'
    ],
    icon: '📝',
    color: theme.colors.primary[600],
  },
  'ai-tutor': {
    title: 'AI Tutor Questions Limit Reached',
    subtitle: 'Unlock unlimited AI assistance',
    description: 'You\'ve reached your daily limit of 10 AI tutor questions. Upgrade to premium for unlimited learning support.',
    benefits: [
      'Unlimited AI tutor conversations',
      'Advanced context understanding',
      'Personalized learning paths',
      'Priority response times'
    ],
    icon: '🤖',
    color: theme.colors.success[500],
  },
  'mind-map': {
    title: 'Mind Map Generation Limit Reached',
    subtitle: 'Unlock unlimited mind maps',
    description: 'You\'ve reached your daily limit of 2 mind map generations. Upgrade to premium for unlimited visual learning.',
    benefits: [
      'Unlimited mind map creation',
      'Advanced visualization options',
      'Export to multiple formats',
      'Collaborative features'
    ],
    icon: '🧠',
    color: theme.colors.primary[700],
  },
  'audio-transcription': {
    title: 'Audio Transcription Limit Reached',
    subtitle: 'Unlock unlimited audio processing',
    description: 'You\'ve reached your daily limit of 3 audio transcriptions. Upgrade to premium for unlimited lecture processing.',
    benefits: [
      'Unlimited audio transcription',
      'Enhanced accuracy',
      'Speaker identification',
      'Automatic summaries'
    ],
    icon: '🎵',
    color: theme.colors.warning[600],
  },
  'general': {
    title: 'Upgrade to Premium',
    subtitle: 'Unlock all premium features',
    description: 'Get unlimited access to all ByteLecture features and enhance your learning experience.',
    benefits: [
      'Unlimited access to all features',
      'Priority customer support',
      'Advanced AI capabilities',
      'Export and sharing options'
    ],
    icon: '⭐',
    color: theme.colors.primary[600],
  },
};

export const PremiumUpsellModal: React.FC<PremiumUpsellModalProps> = ({
  visible,
  onClose,
  onUpgrade,
  featureType,
  currentUsage,
  limit,
}) => {
  const config = featureConfigs[featureType];

  const renderUsageInfo = () => {
    if (currentUsage !== undefined && limit !== undefined) {
      return (
        <View style={styles.usageContainer}>
          <Text style={styles.usageText}>
            Daily Usage: {currentUsage} / {limit}
          </Text>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { 
                  width: `${Math.min((currentUsage / limit) * 100, 100)}%`,
                  backgroundColor: config.color 
                }
              ]} 
            />
          </View>
        </View>
      );
    }
    return null;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modalContainer}>
          <ScrollView 
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Close button */}
            <TouchableOpacity 
              style={styles.closeButton} 
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {/* Header */}
            <View style={styles.header}>
              <View style={[styles.iconContainer, { backgroundColor: config.color + '20' }]}>
                <Text style={styles.icon}>{config.icon}</Text>
              </View>
              <Text style={styles.title}>{config.title}</Text>
              <Text style={styles.subtitle}>{config.subtitle}</Text>
            </View>

            {/* Usage Info */}
            {renderUsageInfo()}

            {/* Description */}
            <Text style={styles.description}>{config.description}</Text>

            {/* Benefits */}
            <View style={styles.benefitsContainer}>
              <Text style={styles.benefitsTitle}>Premium Benefits:</Text>
              {config.benefits.map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <View style={[styles.checkmark, { backgroundColor: config.color }]}>
                    <Text style={styles.checkmarkText}>✓</Text>
                  </View>
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {/* Pricing highlight */}
            <View style={styles.pricingContainer}>
              <Text style={styles.pricingText}>
                Starting at <Text style={styles.priceHighlight}>₹99/month</Text>
              </Text>
              <Text style={styles.pricingSubtext}>7-day free trial • Cancel anytime</Text>
            </View>
          </ScrollView>

          {/* Action buttons */}
          <View style={styles.buttonContainer}>
            <Button
              title="Upgrade to Premium"
              onPress={onUpgrade}
              variant="primary"
              style={[styles.upgradeButton, { backgroundColor: config.color }]}
            />
            <TouchableOpacity onPress={onClose} style={styles.notNowButton}>
              <Text style={styles.notNowText}>Not now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.base,
  },
  modalContainer: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    width: Math.min(screenWidth - theme.spacing.base * 2, 400),
    maxHeight: '80%',
    ...theme.shadow.lg,
  },
  content: {
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.base,
  },
  closeButton: {
    position: 'absolute',
    top: theme.spacing.base,
    right: theme.spacing.base,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.gray[100],
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  closeButtonText: {
    fontSize: 20,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[600],
    lineHeight: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
    marginTop: theme.spacing.sm,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  icon: {
    fontSize: 32,
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  usageContainer: {
    marginBottom: theme.spacing.lg,
  },
  usageText: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  progressBar: {
    height: 6,
    backgroundColor: theme.colors.gray[200],
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  description: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    marginBottom: theme.spacing.xl,
  },
  benefitsContainer: {
    marginBottom: theme.spacing.xl,
  },
  benefitsTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.md,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  checkmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  checkmarkText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: theme.typography.fontWeight.bold,
  },
  benefitText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    flex: 1,
  },
  pricingContainer: {
    backgroundColor: theme.colors.gray[50],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  pricingText: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray[700],
    marginBottom: theme.spacing.xs,
  },
  priceHighlight: {
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
  },
  pricingSubtext: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[500],
  },
  buttonContainer: {
    padding: theme.spacing.xl,
    paddingTop: 0,
  },
  upgradeButton: {
    marginBottom: theme.spacing.md,
  },
  notNowButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
  },
  notNowText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
}); 