import 'dotenv/config';
import { ExpoConfig, ConfigContext } from '@expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const cfg: ExpoConfig = {
    ...config,
    name: config.name || 'ByteLecture',
    slug: config.slug || 'bytelecture',
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