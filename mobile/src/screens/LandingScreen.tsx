import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { supabase } from '../config/supabase';
import { theme } from '../constants/theme';

// Complete the auth session on web
WebBrowser.maybeCompleteAuthSession();

interface LandingScreenProps {
  navigation: any;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ navigation }) => {
  const [loading, setLoading] = useState(false);

  // Create redirect URI for OAuth
  const redirectTo = makeRedirectUri();

  // Function to create session from URL
  const createSessionFromUrl = async (url: string) => {
    const { params, errorCode } = QueryParams.getQueryParams(url);
    
    if (errorCode) {
      throw new Error(errorCode);
    }
    
    const { access_token, refresh_token } = params;
    
    if (!access_token) {
      return;
    }

    const { data, error } = await supabase.auth.setSession({
      access_token,
      refresh_token,
    });
    
    if (error) {
      throw error;
    }
    
    return data.session;
  };

  // Handle deep links for OAuth callback
  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('🔍 DEBUG - Deep link received:', url);
      
      // Check if this is an OAuth callback
      if (url && loading) {
        try {
          const session = await createSessionFromUrl(url);
          if (session) {
            console.log('✅ Session created from deep link!');
            setLoading(false);
          }
        } catch (error: any) {
          console.error('❌ OAuth callback error:', error);
          Alert.alert('Authentication Error', `OAuth failed: ${error.message}`);
          setLoading(false);
        }
      }
    };

    // Listen for incoming URLs
    const urlSubscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    // Check if app was opened with a URL (when app was closed)
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink(url);
      }
    });

    return () => {
      urlSubscription?.remove();
    };
  }, [loading]);

  // Listen for authentication state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔍 DEBUG - Auth state change:', { event, hasSession: !!session });
        
        if (event === 'SIGNED_IN' && session) {
          console.log('✅ User signed in successfully, navigating to main app...');
          setLoading(false);
          // Navigate to the main app or home screen
          // This will be handled by your main navigation logic
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  // Google OAuth function following Supabase React Native documentation
  const performOAuth = async () => {
    try {
      setLoading(true);
      console.log('🔍 DEBUG - Starting Google OAuth...');
      console.log('🔍 DEBUG - Redirect URI:', redirectTo);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) {
        console.error('❌ Supabase OAuth error:', error);
        throw error;
      }

      if (!data?.url) {
        throw new Error('No OAuth URL returned from Supabase');
      }

      console.log('🔍 DEBUG - Opening OAuth URL...');
      
      const res = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

      console.log('🔍 DEBUG - WebBrowser result:', res);

      if (res.type === 'success') {
        const { url } = res;
        console.log('✅ OAuth success, processing callback...');
        await createSessionFromUrl(url);
      } else if (res.type === 'cancel') {
        console.log('ℹ️ User cancelled OAuth');
        setLoading(false);
      } else {
        console.log('ℹ️ OAuth dismissed');
        setLoading(false);
      }
    } catch (error: any) {
      console.error('❌ OAuth error:', error);
      Alert.alert(
        'Authentication Error',
        `Failed to authenticate with Google: ${error?.message || 'Unknown error'}`
      );
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Top Rating Section */}
        <View style={styles.topSection}>
          <View style={styles.ratingContainer}>
            <View style={styles.ratingBadge}>
              <Text style={styles.ratingNumber}>4.8</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <Ionicons
                    key={star}
                    name="star"
                    size={14}
                    color="#FFD700"
                  />
                ))}
              </View>
            </View>
          </View>
        </View>

        {/* Main Content */}
        <View style={styles.mainContent}>
          {/* App Icon */}
          <View style={styles.iconContainer}>
            <View style={styles.appIcon}>
              <Ionicons
                name="school"
                size={64}
                color={theme.colors.primary[600]}
              />
            </View>
            <View style={styles.badgeContainer}>
              <Ionicons
                name="trophy"
                size={20}
                color={theme.colors.warning[600]}
              />
              <Text style={styles.badgeText}>AI-Powered Learning</Text>
            </View>
          </View>

          {/* Main Heading */}
          <Text style={styles.mainHeading}>
            AI-powered summaries for{'\n'}PDFs, videos & audio
          </Text>

          {/* Free to try */}
          <View style={styles.freeContainer}>
            <Text style={styles.freeText}>free to try</Text>
            <Ionicons
              name="arrow-down"
              size={20}
              color={theme.colors.primary[500]}
              style={styles.arrowIcon}
            />
          </View>
        </View>

        {/* Bottom Actions */}
        <View style={styles.bottomSection}>
          {/* Google Sign-In Button */}
          <View style={styles.googleButtonContainer}>
            <TouchableOpacity
              style={[styles.googleButton, loading && styles.googleButtonDisabled]}
              onPress={performOAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#4285F4" />
              ) : (
                <Ionicons
                  name="logo-google"
                  size={20}
                  color="#4285F4"
                  style={styles.googleIcon}
                />
              )}
              <Text style={styles.googleButtonText}>
                {loading ? 'Signing in...' : 'Continue with Google'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Alternative Sign In */}
          <Text style={styles.alternativeText} onPress={handleSignIn}>
            Already have an account? <Text style={styles.signInLink}>Sign in</Text>
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAFA',
  },
  content: {
    flex: 1,
    paddingHorizontal: theme.spacing.xl,
  },
  topSection: {
    alignItems: 'center',
    paddingTop: theme.spacing.xl,
    marginBottom: theme.spacing['2xl'],
  },
  ratingContainer: {
    alignItems: 'center',
  },
  ratingBadge: {
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.lg,
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.xl,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  ratingNumber: {
    fontSize: theme.typography.fontSize.xl,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 64,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing['3xl'],
  },
  appIcon: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: theme.colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
    marginBottom: theme.spacing.lg,
  },
  badgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.primary[50],
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.full,
    gap: theme.spacing.xs,
  },
  badgeText: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[700],
  },
  mainHeading: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.gray[900],
    textAlign: 'center',
    lineHeight: 40,
    marginBottom: theme.spacing.xl,
    letterSpacing: -0.5,
  },
  freeContainer: {
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  freeText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary[600],
  },
  arrowIcon: {
    marginTop: theme.spacing.xs,
  },
  bottomSection: {
    paddingBottom: theme.spacing.xl,
    gap: theme.spacing.lg,
  },
  googleButtonContainer: {
    alignItems: 'center',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.white,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: theme.borderRadius.xl,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    width: '100%',
    maxWidth: 320,
    gap: theme.spacing.md,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleIcon: {
    marginRight: theme.spacing.sm,
  },
  googleButtonText: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.gray[700],
  },
  alternativeText: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    textAlign: 'center',
  },
  signInLink: {
    color: theme.colors.primary[600],
    fontWeight: theme.typography.fontWeight.medium,
  },
});
