// Premium Subscription Screen
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { Header, Button, Card } from '../components';
import { theme } from '../constants/theme';
import { paymentService } from '../services';
import {
  SubscriptionProduct,
  SubscriptionStatus,
  SubscriptionType,
} from '../types/payment';
import { 
  detectUserRegion, 
  getRegionalPricing, 
  formatPrice, 
  Region,
  getRegionName 
} from '../utils/regionHelper';

interface SubscriptionScreenProps {
  navigation: any;
  route?: {
    params?: {
      from?: string; // Where the user came from (feature gate, settings, etc.)
    };
  };
}

const SubscriptionScreen: React.FC<SubscriptionScreenProps> = ({
  navigation,
  route,
}) => {
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus>({ isActive: false });
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [userRegion, setUserRegion] = useState<Region>('us');
  const [regionalPricing, setRegionalPricing] = useState(getRegionalPricing('us'));

  const fromScreen = route?.params?.from;

  useEffect(() => {
    // Detect user region and set pricing
    const region = detectUserRegion();
    setUserRegion(region);
    setRegionalPricing(getRegionalPricing(region));
    
    initializePayments();
  }, []);

  const initializePayments = async () => {
    try {
      setLoading(true);

      // Initialize payment service
      const initialized = await paymentService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize payment service');
      }

      // Get subscription status and products simultaneously
      const [status, availableProducts] = await Promise.all([
        paymentService.getSubscriptionStatus(),
        paymentService.getAvailableProducts(),
      ]);

      setSubscriptionStatus(status);
      setProducts(availableProducts);
    } catch (error) {
      console.error('Failed to initialize payments:', error);
      Alert.alert(
        'Error',
        'Failed to load subscription information. Please check your connection and try again.',
        [
          { text: 'Retry', onPress: initializePayments },
          { text: 'Cancel', onPress: () => navigation.goBack() },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const handlePurchase = async (subscriptionType: SubscriptionType) => {
    try {
      setPurchasing(subscriptionType);

      const result =
        await paymentService.purchaseSubscription(subscriptionType);

      if (result.success) {
        Alert.alert(
          'Success! 🎉',
          'Welcome to ByteLecture Premium! You now have access to all premium features.',
          [
            {
              text: 'Start Learning',
              onPress: () => {
                // Refresh subscription status
                paymentService
                  .getSubscriptionStatus()
                  .then(setSubscriptionStatus);
                navigation.goBack();
              },
            },
          ]
        );
      } else if (result.error?.userCancelled) {
        // User cancelled, do nothing
      } else {
        Alert.alert(
          'Purchase Failed',
          result.error?.message ||
            'An error occurred during purchase. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Purchase error:', error);
      Alert.alert(
        'Purchase Failed',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setPurchasing(null);
    }
  };

  const handleRestorePurchases = async () => {
    try {
      setRestoring(true);

      const result = await paymentService.restorePurchases();

      if (result.success && result.restoredPurchases.length > 0) {
        Alert.alert(
          'Purchases Restored',
          `Successfully restored ${result.restoredPurchases.length} purchase(s).`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Refresh subscription status
                paymentService
                  .getSubscriptionStatus()
                  .then(setSubscriptionStatus);
              },
            },
          ]
        );
      } else if (result.success) {
        Alert.alert(
          'No Purchases Found',
          'No previous purchases were found to restore.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Restore Failed',
          result.error?.message ||
            'Failed to restore purchases. Please try again.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('Restore error:', error);
      Alert.alert(
        'Restore Failed',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setRestoring(false);
    }
  };

  const renderSubscriptionCard = (type: SubscriptionType) => {
    const product = products.find((p) => p.type === type);
    const isPurchasing = purchasing === type;
    const isRecommended = type === 'yearly';

    // Use product data if available, otherwise fall back to regional pricing
    const price = product ? product.localizedPrice : formatPrice(
      type === 'monthly' ? regionalPricing.monthly : regionalPricing.yearly, 
      userRegion
    );
    
    const monthlyEquivalent = type === 'yearly' ? formatPrice(
      regionalPricing.yearlyMonthlyEquivalent,
      userRegion
    ) : null;

    return (
      <Card
        key={type}
        style={{
          ...styles.planCard,
          ...(isRecommended && styles.recommendedCard),
        }}
      >
        {isRecommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>BEST VALUE</Text>
          </View>
        )}

        <View style={styles.planHeader}>
          <Text style={styles.planTitle}>
            {type === 'monthly' ? 'Monthly Plan' : 'Yearly Plan'}
          </Text>
          <View style={styles.priceContainer}>
            <Text style={styles.priceAmount}>{price}</Text>
            <Text style={styles.pricePeriod}>
              /{type === 'monthly' ? 'month' : 'year'}
            </Text>
          </View>
          {type === 'yearly' && monthlyEquivalent && (
            <Text style={styles.monthlyEquivalentText}>
              Just {monthlyEquivalent} per month
            </Text>
          )}
          {type === 'yearly' && (
            <Text style={styles.savingsText}>
              Save {regionalPricing.savings} per year!
            </Text>
          )}
        </View>

        <View style={styles.featuresContainer}>
          <Text style={styles.featuresTitle}>Premium Features:</Text>
          <View style={styles.featuresList}>
            <Text style={styles.featureItem}>
              ✅ Unlimited PDF & YouTube processing
            </Text>
            <Text style={styles.featureItem}>
              ✅ Unlimited lecture recordings
            </Text>
            <Text style={styles.featureItem}>
              ✅ Unlimited flashcards & quizzes
            </Text>
            <Text style={styles.featureItem}>
              ✅ Unlimited AI tutor questions
            </Text>
            <Text style={styles.featureItem}>✅ Full audio summaries</Text>
            <Text style={styles.featureItem}>✅ Multi-device sync</Text>
            <Text style={styles.featureItem}>✅ Priority support</Text>
          </View>
        </View>

        <Button
          title={
            isPurchasing
              ? 'Processing...'
              : `Subscribe ${type === 'monthly' ? 'Monthly' : 'Yearly'}`
          }
          onPress={() => handlePurchase(type)}
          disabled={isPurchasing || loading}
          loading={isPurchasing}
          style={{
            ...styles.subscribeButton,
            ...(isRecommended && styles.recommendedButton),
          }}
        />
      </Card>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Premium Subscription"
          leftAction={{
            icon: (
              <Ionicons
                name="arrow-back"
                size={24}
                color={theme.colors.gray[600]}
              />
            ),
            onPress: () => navigation.goBack(),
          }}
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary[600]} />
          <Text style={styles.loadingText}>Loading subscription plans...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Upgrade to Premium"
        leftAction={{
          icon: (
            <Ionicons
              name="arrow-back"
              size={24}
              color={theme.colors.gray[600]}
            />
          ),
          onPress: () => navigation.goBack(),
        }}
      />

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {subscriptionStatus.isActive ? (
          <Card style={styles.activeSubscriptionCard}>
            <Text style={styles.activeSubscriptionTitle}>
              🎉 You're a Premium Member!
            </Text>
            <Text style={styles.activeSubscriptionText}>
              Thank you for supporting ByteLecture. You have access to all
              premium features.
            </Text>
            {subscriptionStatus.expiryDate && (
              <Text style={styles.expiryText}>
                {subscriptionStatus.autoRenewing ? 'Renews' : 'Expires'} on:{' '}
                {new Date(subscriptionStatus.expiryDate).toLocaleDateString()}
              </Text>
            )}
          </Card>
        ) : (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Unlock Your Learning Potential</Text>
              <Text style={styles.subtitle}>
                Get unlimited access to all ByteLecture features and supercharge
                your studies.
              </Text>
            </View>

            <View style={styles.plansContainer}>
              {renderSubscriptionCard('monthly')}
              {renderSubscriptionCard('yearly')}
            </View>

            <View style={styles.trialInfo}>
              <Text style={styles.trialText}>
                📱 {Platform.OS === 'ios' ? 'App Store' : 'Google Play'} 7-day
                free trial included
              </Text>
              <Text style={styles.trialSubtext}>
                Cancel anytime during the trial period at no charge
              </Text>
            </View>
          </>
        )}

        <TouchableOpacity
          style={styles.restoreButton}
          onPress={handleRestorePurchases}
          disabled={restoring}
        >
          {restoring ? (
            <ActivityIndicator size="small" color={theme.colors.primary[600]} />
          ) : (
            <Text style={styles.restoreText}>Restore Previous Purchases</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            By subscribing, you agree to our Terms of Service and Privacy
            Policy. Subscription automatically renews unless cancelled 24 hours
            before the current period ends.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    padding: theme.spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: 16,
    color: theme.colors.textSecondary,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  activeSubscriptionCard: {
    backgroundColor: theme.colors.success[50],
    borderColor: theme.colors.success[500],
    borderWidth: 1,
    marginBottom: theme.spacing.xl,
  },
  activeSubscriptionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.success[500],
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  activeSubscriptionText: {
    fontSize: 16,
    color: theme.colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  expiryText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
  },
  plansContainer: {
    gap: theme.spacing.lg,
    marginBottom: theme.spacing.xl,
  },
  planCard: {
    position: 'relative',
    padding: theme.spacing.lg,
  },
  recommendedCard: {
    borderColor: theme.colors.primary[500],
    borderWidth: 2,
    backgroundColor: theme.colors.primary[50],
  },
  recommendedBadge: {
    position: 'absolute',
    top: -10,
    left: '50%',
    transform: [{ translateX: -40 }],
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.sm,
  },
  recommendedText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planHeader: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  planTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: theme.spacing.xs,
  },
  priceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: theme.colors.primary[500],
  },
  pricePeriod: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    marginLeft: 4,
  },
  savingsText: {
    fontSize: 14,
    color: theme.colors.success[500],
    fontWeight: '600',
  },
  featuresContainer: {
    marginBottom: theme.spacing.lg,
  },
  featuresTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
  },
  featuresList: {
    gap: theme.spacing.xs,
  },
  featureItem: {
    fontSize: 14,
    color: theme.colors.text,
    lineHeight: 20,
  },
  subscribeButton: {
    marginBottom: theme.spacing.sm,
  },
  recommendedButton: {
    backgroundColor: theme.colors.primary[500],
  },
  storePrice: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  monthlyEquivalentText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  trialInfo: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
    padding: theme.spacing.md,
    backgroundColor: theme.colors.primary[50],
    borderRadius: theme.borderRadius.md,
  },
  trialText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  trialSubtext: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  restoreButton: {
    alignSelf: 'center',
    padding: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  restoreText: {
    fontSize: 16,
    color: theme.colors.primary[500],
    fontWeight: '600',
  },
  footer: {
    marginTop: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  footerText: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default SubscriptionScreen;
