import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Header, Button, Card, Input, LoadingIndicator } from '../components';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContextFallback';

interface EmailVerificationScreenProps {
  navigation: any;
  route: any;
}

export const EmailVerificationScreen: React.FC<EmailVerificationScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const { user, resendVerificationEmail } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [isUpdatingEmail, setIsUpdatingEmail] = useState(false);
  const [showUpdateEmail, setShowUpdateEmail] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const userEmail = user?.email || route?.params?.email || '';

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (resendCooldown > 0) {
      interval = setInterval(() => {
        setResendCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    setIsResending(true);
    try {
      const { error } = await resendVerificationEmail();
      if (error) {
        Alert.alert('Error', `Failed to resend verification email: ${error}`);
      } else {
        Alert.alert(
          'Email Sent',
          'A new verification email has been sent to your inbox. Please check your email and spam folder.'
        );
        setResendCooldown(60); // 60 second cooldown
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  const handleUpdateEmail = async () => {
    if (!newEmail.trim()) {
      Alert.alert('Error', 'Please enter a valid email address.');
      return;
    }

    setIsUpdatingEmail(true);
    try {
      // This would need to be implemented in the auth context
      Alert.alert(
        'Coming Soon',
        'Email update functionality will be available in a future update.'
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to update email address.');
    } finally {
      setIsUpdatingEmail(false);
    }
  };

  const handleBackToLogin = () => {
    navigation.navigate('Login');
  };

  const handleCheckEmailApp = () => {
    Alert.alert(
      'Open Email App',
      'Please check your email app for the verification email. Make sure to check your spam/junk folder as well.',
      [
        { text: 'OK', style: 'default' }
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header 
        title="Verify Email"
        leftAction={{
          icon: <Ionicons name="arrow-back" size={24} color={theme.colors.gray[600]} />,
          onPress: handleBackToLogin,
        }}
      />
      
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.iconContainer}>
          <View style={styles.emailIcon}>
            <Ionicons name="mail" size={48} color={theme.colors.primary[600]} />
          </View>
        </View>

        <Text style={styles.title}>Check Your Email</Text>
        <Text style={styles.subtitle}>
          We've sent a verification link to:
        </Text>
        
        <Card style={styles.emailCard}>
          <View style={styles.emailDisplay}>
            <Ionicons name="mail-outline" size={20} color={theme.colors.gray[600]} />
            <Text style={styles.emailText}>{userEmail}</Text>
          </View>
        </Card>

        <Card style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>📧 Verification Instructions</Text>
          <View style={styles.instructionsList}>
            <Text style={styles.instructionItem}>• Check your inbox for a verification email</Text>
            <Text style={styles.instructionItem}>• Click the verification link in the email</Text>
            <Text style={styles.instructionItem}>• You'll be automatically redirected back to the app</Text>
            <Text style={styles.instructionItem}>• Check your spam/junk folder if you don't see the email</Text>
          </View>
        </Card>

        <View style={styles.actionButtons}>
          <Button
            title="Open Email App"
            onPress={handleCheckEmailApp}
            variant="primary"
            style={styles.primaryButton}
          />

          <Button
            title={
              resendCooldown > 0 
                ? `Resend in ${resendCooldown}s` 
                : "Resend Verification Email"
            }
            onPress={handleResendVerification}
            variant="outline"
            disabled={isResending || resendCooldown > 0}
            loading={isResending}
            style={styles.resendButton}
          />
        </View>

        <View style={styles.troubleshootSection}>
          <Text style={styles.troubleshootTitle}>Having trouble?</Text>
          
          {!showUpdateEmail ? (
            <Button
              title="Use Different Email Address"
              onPress={() => setShowUpdateEmail(true)}
              variant="ghost"
              style={styles.troubleshootButton}
            />
          ) : (
            <Card style={styles.updateEmailCard}>
              <Text style={styles.updateEmailTitle}>Update Email Address</Text>
              <Input
                label="New Email Address"
                value={newEmail}
                onChangeText={setNewEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                placeholder="Enter your new email"
              />
              <View style={styles.updateEmailButtons}>
                <Button
                  title="Cancel"
                  onPress={() => {
                    setShowUpdateEmail(false);
                    setNewEmail('');
                  }}
                  variant="outline"
                  style={styles.updateButton}
                />
                <Button
                  title="Update"
                  onPress={handleUpdateEmail}
                  variant="primary"
                  loading={isUpdatingEmail}
                  style={styles.updateButton}
                />
              </View>
            </Card>
          )}
        </View>
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
  iconContainer: {
    alignItems: 'center',
    marginVertical: theme.spacing.xl,
  },
  emailIcon: {
    width: 80,
    height: 80,
    borderRadius: theme.borderRadius.full,
    backgroundColor: theme.colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  emailCard: {
    marginBottom: theme.spacing.lg,
    padding: theme.spacing.base,
  },
  emailDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
  },
  emailText: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
  },
  instructionsCard: {
    backgroundColor: theme.colors.primary[50],
    borderColor: theme.colors.primary[200],
    marginBottom: theme.spacing.lg,
  },
  instructionsTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.md,
  },
  instructionsList: {
    gap: theme.spacing.sm,
  },
  instructionItem: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[700],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  actionButtons: {
    gap: theme.spacing.md,
    marginBottom: theme.spacing.xl,
  },
  primaryButton: {
    // Default styles from Button component
  },
  resendButton: {
    // Default styles from Button component
  },
  troubleshootSection: {
    alignItems: 'center',
  },
  troubleshootTitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    marginBottom: theme.spacing.sm,
  },
  troubleshootButton: {
    // Default styles from Button component
  },
  updateEmailCard: {
    width: '100%',
    padding: theme.spacing.lg,
  },
  updateEmailTitle: {
    fontSize: theme.typography.fontSize.base,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.base,
    textAlign: 'center',
  },
  updateEmailButtons: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.base,
  },
  updateButton: {
    flex: 1,
  },
}); 