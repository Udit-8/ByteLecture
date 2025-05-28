import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, FeatureCard } from '../components';
import { theme } from '../constants/theme';

interface LandingScreenProps {
  navigation: any;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ navigation }) => {
  const features = [
    {
      id: 'ai-summaries',
      title: 'AI Summaries',
      description: 'Get instant, concise summaries of any learning material',
      icon: <Ionicons name="document-text" size={32} color={theme.colors.primary[600]} />,
      color: theme.colors.primary[100],
    },
    {
      id: 'smart-flashcards',
      title: 'Smart Flashcards',
      description: 'Auto-generated flashcards that adapt to your learning pace',
      icon: <Ionicons name="library" size={32} color={theme.colors.success[600]} />,
      color: theme.colors.success[100],
    },
    {
      id: 'practice-quizzes',
      title: 'Practice Quizzes',
      description: 'Test your knowledge with intelligent, adaptive quizzes',
      icon: <Ionicons name="help-circle" size={32} color={theme.colors.warning[600]} />,
      color: theme.colors.warning[100],
    },
    {
      id: 'ai-tutor',
      title: 'AI Tutor',
      description: 'Get personalized help and explanations 24/7',
      icon: <Ionicons name="chatbubbles" size={32} color={theme.colors.error[600]} />,
      color: theme.colors.error[100],
    },
  ];

  const handleGetStarted = () => {
    navigation.navigate('Register');
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  const handleAuthDebug = () => {
    navigation.navigate('AuthDebug');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.heroSection}>
          <View style={styles.logoContainer}>
            <View style={styles.logo}>
              <Ionicons name="school" size={48} color={theme.colors.primary[600]} />
            </View>
            <Text style={styles.appName}>ByteLecture</Text>
          </View>
          
          <Text style={styles.heroTitle}>
            Transform Your Learning with AI
          </Text>
          <Text style={styles.heroSubtitle}>
            Upload PDFs, YouTube videos, or record lectures to create personalized study materials powered by artificial intelligence.
          </Text>
        </View>

        <View style={styles.featuresSection}>
          <Text style={styles.sectionTitle}>Everything You Need to Learn Better</Text>
          
          <View style={styles.featuresGrid}>
            {features.map((feature) => (
              <View key={feature.id} style={styles.featureWrapper}>
                <FeatureCard
                  title={feature.title}
                  description={feature.description}
                  icon={feature.icon}
                  color={feature.color}
                  onPress={() => {}} // No action on landing page
                />
              </View>
            ))}
          </View>
        </View>

        <View style={styles.benefitsSection}>
          <Text style={styles.sectionTitle}>Why Choose ByteLecture?</Text>
          
          <View style={styles.benefitsList}>
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="flash" size={20} color={theme.colors.primary[600]} />
              </View>
              <Text style={styles.benefitText}>
                Learn 3x faster with AI-powered study materials
              </Text>
            </View>
            
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="bulb" size={20} color={theme.colors.primary[600]} />
              </View>
              <Text style={styles.benefitText}>
                Personalized learning that adapts to your style
              </Text>
            </View>
            
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="time" size={20} color={theme.colors.primary[600]} />
              </View>
              <Text style={styles.benefitText}>
                Save hours of manual note-taking and summarizing
              </Text>
            </View>
            
            <View style={styles.benefitItem}>
              <View style={styles.benefitIcon}>
                <Ionicons name="trophy" size={20} color={theme.colors.primary[600]} />
              </View>
              <Text style={styles.benefitText}>
                Track your progress and improve retention
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.ctaSection}>
          <Text style={styles.ctaTitle}>Ready to Transform Your Learning?</Text>
          <Text style={styles.ctaSubtitle}>
            Join thousands of students already learning smarter with ByteLecture.
          </Text>
          
          <View style={styles.ctaButtons}>
            <Button
              title="Get Started Free"
              onPress={handleGetStarted}
              variant="primary"
              size="lg"
              style={styles.primaryCta}
            />
            
            <Button
              title="I Have an Account"
              onPress={handleSignIn}
              variant="outline"
              size="lg"
              style={styles.secondaryCta}
            />
            
            <Button
              title="🔍 Debug Authentication"
              onPress={handleAuthDebug}
              variant="outline"
              size="sm"
              style={styles.debugCta}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  content: {
    flex: 1,
  },
  heroSection: {
    padding: theme.spacing.xl,
    alignItems: 'center',
    paddingTop: theme.spacing['3xl'],
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logo: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.base,
  },
  appName: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.primary[600],
  },
  heroTitle: {
    fontSize: theme.typography.fontSize['3xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.base,
    lineHeight: theme.typography.lineHeight.tight * theme.typography.fontSize['3xl'],
  },
  heroSubtitle: {
    fontSize: theme.typography.fontSize.lg,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.lg,
    paddingHorizontal: theme.spacing.base,
  },
  featuresSection: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.gray[50],
  },
  sectionTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.spacing.base,
    justifyContent: 'center',
  },
  featureWrapper: {
    width: '47%', // Slightly less than 50% to account for gap
    minWidth: 140,
  },
  benefitsSection: {
    padding: theme.spacing.xl,
  },
  benefitsList: {
    gap: theme.spacing.lg,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.base,
  },
  benefitIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  benefitText: {
    flex: 1,
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[700],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.base,
  },
  ctaSection: {
    padding: theme.spacing.xl,
    backgroundColor: theme.colors.primary[600],
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.white,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  ctaSubtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.primary[100],
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    paddingHorizontal: theme.spacing.base,
  },
  ctaButtons: {
    width: '100%',
    gap: theme.spacing.md,
  },
  primaryCta: {
    backgroundColor: theme.colors.white,
  },
  secondaryCta: {
    borderColor: theme.colors.white,
  },
  debugCta: {
    borderColor: theme.colors.white,
    marginTop: 10,
  },
}); 