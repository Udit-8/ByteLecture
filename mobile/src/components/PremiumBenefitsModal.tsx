import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { Button } from './Button';
import { PremiumBadge } from './PremiumBadge';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface PremiumBenefitsModalProps {
  visible: boolean;
  onClose: () => void;
  onUpgrade?: () => void;
  showUpgradeButton?: boolean;
  variant?: 'showcase' | 'comparison';
}

interface BenefitItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  freeFeature: string;
  premiumFeature: string;
  highlight?: boolean;
}

const benefits: BenefitItem[] = [
  {
    id: 'pdf-processing',
    title: 'PDF Processing',
    description: 'Transform your documents into interactive learning materials',
    icon: 'document-text',
    color: theme.colors.primary[600],
    freeFeature: '2 PDFs per day',
    premiumFeature: 'Unlimited PDFs',
    highlight: true,
  },
  {
    id: 'youtube-processing',
    title: 'YouTube Learning',
    description: 'Convert any educational video into study materials',
    icon: 'logo-youtube',
    color: theme.colors.error[600],
    freeFeature: '2 videos per day',
    premiumFeature: 'Unlimited videos',
    highlight: true,
  },
  {
    id: 'ai-tutor',
    title: 'AI Tutor Chat',
    description: 'Get instant answers and explanations from your personal AI tutor',
    icon: 'chatbubbles',
    color: theme.colors.success[600],
    freeFeature: '10 questions per day',
    premiumFeature: 'Unlimited questions',
  },
  {
    id: 'flashcards',
    title: 'Smart Flashcards',
    description: 'Automatically generated flashcards from your content',
    icon: 'library',
    color: theme.colors.warning[600],
    freeFeature: '3 sets per day',
    premiumFeature: 'Unlimited flashcard sets',
  },
  {
    id: 'quizzes',
    title: 'Practice Quizzes',
    description: 'Test your knowledge with AI-generated practice tests',
    icon: 'help-circle',
    color: theme.colors.primary[700],
    freeFeature: '3 quizzes per day',
    premiumFeature: 'Unlimited quizzes',
  },
  {
    id: 'mind-maps',
    title: 'Mind Maps',
    description: 'Visual learning with interactive mind map generation',
    icon: 'git-network',
    color: theme.colors.success[700],
    freeFeature: '2 maps per day (20 nodes)',
    premiumFeature: 'Unlimited maps (100 nodes)',
  },
  {
    id: 'audio-transcription',
    title: 'Audio Transcription',
    description: 'Convert lectures and recordings into searchable text',
    icon: 'mic',
    color: theme.colors.warning[700],
    freeFeature: '3 transcriptions per day',
    premiumFeature: 'Unlimited transcriptions',
  },
  {
    id: 'sync',
    title: 'Multi-Device Sync',
    description: 'Access your learning materials across all your devices',
    icon: 'sync',
    color: theme.colors.primary[500],
    freeFeature: '2 devices (30s sync)',
    premiumFeature: 'Unlimited devices (5s sync)',
  },
];

export const PremiumBenefitsModal: React.FC<PremiumBenefitsModalProps> = ({
  visible,
  onClose,
  onUpgrade,
  showUpgradeButton = false,
  variant = 'showcase',
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison'>('overview');

  const renderBenefitCard = (benefit: BenefitItem) => (
    <View key={benefit.id} style={[styles.benefitCard, benefit.highlight && styles.highlightCard]}>
      <View style={styles.benefitHeader}>
        <View style={[styles.benefitIcon, { backgroundColor: benefit.color + '20' }]}>
          <Ionicons name={benefit.icon as any} size={24} color={benefit.color} />
        </View>
        <View style={styles.benefitTitleContainer}>
          <Text style={styles.benefitTitle}>{benefit.title}</Text>
          {benefit.highlight && (
            <PremiumBadge variant="pill" size="xs" text="Popular" />
          )}
        </View>
      </View>
      <Text style={styles.benefitDescription}>{benefit.description}</Text>
      
      {variant === 'comparison' && (
        <View style={styles.comparisonContainer}>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Free:</Text>
            <Text style={styles.freeFeature}>{benefit.freeFeature}</Text>
          </View>
          <View style={styles.comparisonRow}>
            <Text style={styles.comparisonLabel}>Premium:</Text>
            <Text style={styles.premiumFeature}>{benefit.premiumFeature}</Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.heroSection}>
        <PremiumBadge variant="banner" text="Premium Learning Experience" size="lg" />
        <Text style={styles.heroTitle}>Unlock Your Full Potential</Text>
        <Text style={styles.heroSubtitle}>
          Transform how you learn with unlimited access to all ByteLecture features
        </Text>
      </View>

      <View style={styles.benefitsGrid}>
        {benefits.map(renderBenefitCard)}
      </View>

      <View style={styles.additionalBenefits}>
        <Text style={styles.additionalTitle}>Plus Premium Perks:</Text>
        <View style={styles.perksList}>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success[600]} />
            <Text style={styles.perkText}>Priority customer support</Text>
          </View>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success[600]} />
            <Text style={styles.perkText}>Early access to new features</Text>
          </View>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success[600]} />
            <Text style={styles.perkText}>Enhanced performance & speed</Text>
          </View>
          <View style={styles.perkItem}>
            <Ionicons name="checkmark-circle" size={20} color={theme.colors.success[600]} />
            <Text style={styles.perkText}>No daily limits or restrictions</Text>
          </View>
        </View>
      </View>

      <View style={styles.testimonialSection}>
        <Text style={styles.testimonialTitle}>💬 What Premium Users Say</Text>
        <View style={styles.testimonial}>
          <Text style={styles.testimonialText}>
            "ByteLecture Premium completely transformed my study routine. Unlimited access to all features means I can learn at my own pace without hitting daily limits."
          </Text>
          <Text style={styles.testimonialAuthor}>— Sarah K., Medical Student</Text>
        </View>
      </View>
    </ScrollView>
  );

  const renderComparisonTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      <View style={styles.comparisonHeader}>
        <Text style={styles.comparisonTitle}>Free vs Premium</Text>
        <Text style={styles.comparisonSubtitle}>
          See exactly what you get with each plan
        </Text>
      </View>

      <View style={styles.comparisonBenefits}>
        {benefits.map(renderBenefitCard)}
      </View>

      <View style={styles.summarySection}>
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Free Plan</Text>
          <Text style={styles.summaryPrice}>₹0</Text>
          <Text style={styles.summaryDescription}>
            Great for trying out ByteLecture with basic daily limits
          </Text>
        </View>
        <View style={[styles.summaryCard, styles.premiumSummaryCard]}>
          <Text style={styles.summaryTitle}>Premium Plan</Text>
          <Text style={styles.summaryPrice}>₹99/month</Text>
          <Text style={styles.summaryDescription}>
            Everything unlimited + premium perks and priority support
          </Text>
          <PremiumBadge variant="pill" text="Best Value" size="sm" />
        </View>
      </View>
    </ScrollView>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={theme.colors.gray[600]} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Premium Benefits</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
            onPress={() => setActiveTab('overview')}
          >
            <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
              Overview
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'comparison' && styles.activeTab]}
            onPress={() => setActiveTab('comparison')}
          >
            <Text style={[styles.tabText, activeTab === 'comparison' && styles.activeTabText]}>
              Compare Plans
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === 'overview' ? renderOverviewTab() : renderComparisonTab()}

        {showUpgradeButton && onUpgrade && (
          <View style={styles.footer}>
            <Button
              title="Upgrade to Premium"
              onPress={onUpgrade}
              style={styles.upgradeButton}
            />
          </View>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
  },
  closeButton: {
    padding: theme.spacing.sm,
  },
  headerTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
  },
  placeholder: {
    width: 40,
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.gray[50],
    margin: theme.spacing.lg,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xs,
  },
  tab: {
    flex: 1,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    borderRadius: theme.borderRadius.md,
  },
  activeTab: {
    backgroundColor: theme.colors.white,
    ...theme.shadow.sm,
  },
  tabText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[600],
  },
  activeTabText: {
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeight.semibold,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: theme.spacing.lg,
  },
  heroSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  heroTitle: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginTop: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  heroSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  benefitsGrid: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  benefitCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    ...theme.shadow.sm,
  },
  highlightCard: {
    borderColor: theme.colors.primary[300],
    backgroundColor: theme.colors.primary[25],
  },
  benefitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  benefitIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.md,
  },
  benefitTitleContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  benefitTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
  },
  benefitDescription: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  comparisonContainer: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  comparisonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.sm,
  },
  comparisonLabel: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[700],
  },
  freeFeature: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
  },
  premiumFeature: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.success[600],
  },
  additionalBenefits: {
    marginBottom: theme.spacing.xl,
  },
  additionalTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.md,
  },
  perksList: {
    gap: theme.spacing.md,
  },
  perkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  perkText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
  },
  testimonialSection: {
    backgroundColor: theme.colors.primary[50],
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  testimonialTitle: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[800],
    marginBottom: theme.spacing.md,
  },
  testimonial: {
    // No specific styles
  },
  testimonialText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary[700],
    fontStyle: 'italic',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
    marginBottom: theme.spacing.sm,
  },
  testimonialAuthor: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[600],
  },
  comparisonHeader: {
    alignItems: 'center',
    paddingVertical: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
  },
  comparisonTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.sm,
  },
  comparisonSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  comparisonBenefits: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  summarySection: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  summaryCard: {
    flex: 1,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
    alignItems: 'center',
  },
  premiumSummaryCard: {
    borderColor: theme.colors.primary[300],
    backgroundColor: theme.colors.primary[50],
  },
  summaryTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  summaryPrice: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
    marginBottom: theme.spacing.sm,
  },
  summaryDescription: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  footer: {
    padding: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.gray[200],
  },
  upgradeButton: {
    backgroundColor: theme.colors.primary[600],
  },
}); 