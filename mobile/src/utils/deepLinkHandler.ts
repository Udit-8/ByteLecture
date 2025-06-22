import * as Linking from 'expo-linking';
import { Alert } from 'react-native';

export interface DeepLinkParams {
  type?: string;
  token?: string;
  email?: string;
  error?: string;
  error_description?: string;
}

export class DeepLinkHandler {
  private static instance: DeepLinkHandler;
  private navigationRef: any = null;

  static getInstance(): DeepLinkHandler {
    if (!DeepLinkHandler.instance) {
      DeepLinkHandler.instance = new DeepLinkHandler();
    }
    return DeepLinkHandler.instance;
  }

  setNavigationRef(ref: any) {
    this.navigationRef = ref;
  }

  initialize() {
    // Handle initial URL if app was opened via deep link
    this.handleInitialURL();

    // Listen for incoming deep links while app is running
    const subscription = Linking.addEventListener('url', this.handleDeepLink);

    return () => {
      subscription?.remove();
    };
  }

  private async handleInitialURL() {
    try {
      const initialURL = await Linking.getInitialURL();
      if (initialURL) {
        this.handleDeepLink({ url: initialURL });
      }
    } catch (error) {
      console.error('Error handling initial URL:', error);
    }
  }

  private handleDeepLink = ({ url }: { url: string }) => {
    try {
      console.log('Deep link received:', url);

      const parsed = Linking.parse(url);
      console.log('Parsed deep link:', parsed);

      if (parsed.hostname === 'auth') {
        this.handleAuthDeepLink(
          parsed.path,
          parsed.queryParams as DeepLinkParams
        );
      } else {
        console.log('Unhandled deep link:', parsed);
      }
    } catch (error) {
      console.error('Error parsing deep link:', error);
    }
  };

  private handleAuthDeepLink(path: string | null, params: DeepLinkParams) {
    switch (path) {
      case '/verify-email':
        this.handleEmailVerification(params);
        break;
      case '/reset-password':
        this.handlePasswordReset(params);
        break;
      default:
        console.log('Unhandled auth deep link path:', path);
    }
  }

  private handleEmailVerification(params: DeepLinkParams) {
    console.log('Email verification deep link:', params);

    if (params.error) {
      Alert.alert(
        'Email Verification Failed',
        params.error_description || params.error,
        [{ text: 'OK' }]
      );
      return;
    }

    if (params.type === 'signup' || params.token) {
      Alert.alert(
        'Email Verified!',
        'Your email has been successfully verified. You can now sign in to your account.',
        [
          {
            text: 'Sign In',
            onPress: () => {
              if (this.navigationRef?.current) {
                this.navigationRef.current.navigate('Login');
              }
            },
          },
        ]
      );
    }
  }

  private handlePasswordReset(params: DeepLinkParams) {
    console.log('Password reset deep link:', params);

    if (params.error) {
      Alert.alert(
        'Password Reset Failed',
        params.error_description || params.error,
        [{ text: 'OK' }]
      );
      return;
    }

    // Navigate to password reset screen with token
    if (this.navigationRef?.current && params.token) {
      this.navigationRef.current.navigate('ResetPassword', {
        token: params.token,
      });
    }
  }

  // Method to create deep link URLs
  static createDeepLink(path: string, params?: Record<string, string>): string {
    const baseURL = 'bytelecture://';
    const queryString = params
      ? '?' +
        Object.entries(params)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&')
      : '';

    return `${baseURL}${path}${queryString}`;
  }

  // Method to create universal link URLs (for production)
  static createUniversalLink(
    path: string,
    params?: Record<string, string>
  ): string {
    const baseURL = 'https://bytelecture.app/';
    const queryString = params
      ? '?' +
        Object.entries(params)
          .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
          .join('&')
      : '';

    return `${baseURL}${path}${queryString}`;
  }
}

export default DeepLinkHandler;
