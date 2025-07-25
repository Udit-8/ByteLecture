import 'dotenv/config';
import { ExpoConfig, ConfigContext } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const cfg: ExpoConfig = {
    name: 'ByteLecture',
    slug: 'bytelecture',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/appstore.png',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    scheme: 'bytelecture',
    splash: {
      image: './assets/appstore.png',
      resizeMode: 'contain',
      backgroundColor: '#FAFAFA'
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bytelecture.app',
      buildNumber: '1',
      infoPlist: {
        NSCameraUsageDescription: 'This app uses camera to capture documents for AI processing.',
        NSMicrophoneUsageDescription: 'This app uses microphone to record audio for AI-powered summaries.',
        NSPhotoLibraryUsageDescription: 'This app accesses photo library to upload documents for processing.',
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FAFAFA'
      },
      edgeToEdgeEnabled: true,
      package: 'com.bytelecture.app',
      versionCode: 1,
      permissions: [
        'CAMERA',
        'RECORD_AUDIO',
        'READ_EXTERNAL_STORAGE',
        'WRITE_EXTERNAL_STORAGE',
        'com.android.vending.BILLING'
      ],
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            {
              scheme: 'https',
              host: 'bytelecture.app'
            },
            {
              scheme: 'bytelecture'
            }
          ],
          category: [
            'BROWSABLE',
            'DEFAULT'
          ]
        }
      ]
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      [
        'react-native-iap',
        {
          paymentProvider: 'Play Store'
        }
      ]
    ],
    extra: {
      // Supabase
      SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,

      // Backend API
      API_URL: process.env.EXPO_PUBLIC_API_URL,

      // App metadata
      APP_NAME: process.env.EXPO_PUBLIC_APP_NAME,
      APP_VERSION: process.env.EXPO_PUBLIC_APP_VERSION,
      SCHEME: process.env.EXPO_PUBLIC_SCHEME,

      // Google OAuth
      GOOGLE_WEB_CLIENT_ID: process.env.GOOGLE_WEB_CLIENT_ID,
      GOOGLE_IOS_CLIENT_ID: process.env.GOOGLE_IOS_CLIENT_ID,
      GOOGLE_ANDROID_CLIENT_ID: process.env.GOOGLE_ANDROID_CLIENT_ID,

      // Keep existing EAS project id so EAS CLI continues to work
      eas: {
        projectId: '7edcee34-112c-4334-9abe-4de4a2d5acd1',
      },
    },
  };

  return cfg;
}; 