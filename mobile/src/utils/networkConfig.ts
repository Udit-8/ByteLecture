import { Platform } from 'react-native';
import Constants from 'expo-constants';

/**
 * Get the appropriate API base URL based on the environment
 * This handles differences between simulator, physical device, and production
 */
export function getApiBaseUrl(): string {
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;

  // Detect simulator / emulator first
  const isDevice = Constants.isDevice;
  const isSimulator = !isDevice && Platform.OS === 'ios';
  const isEmulator = !isDevice && Platform.OS === 'android';

  // If env variable is provided, use it UNLESS we are on an iOS simulator and the
  // value points to a private LAN IP (the simulator sometimes cannot reach the
  // host-only network address). In that case we transparently fall back to
  // localhost so that the API remains reachable without requiring the developer
  // to keep changing the .env file when switching between simulator and device.
  if (envApiUrl) {
    if (
      isSimulator &&
      /^(http\:\/\/)?10\./.test(envApiUrl) &&
      !envApiUrl.includes('localhost')
    ) {
      console.warn(
        '⚠️ iOS simulator detected and EXPO_PUBLIC_API_URL points to a LAN IP. Falling back to http://localhost:3000/api' +
          '\n   (The simulator cannot always reach the host IP address).'
      );
      return 'http://localhost:3000/api';
    }

    console.log('�� Using API URL from environment:', envApiUrl);
    return envApiUrl;
  }

  // Default fallback
  const defaultUrl = 'http://localhost:3000/api';

  // Check if we're in development mode
  const isDevelopment = __DEV__;

  if (!isDevelopment) {
    // Production - should have EXPO_PUBLIC_API_URL set
    console.warn('⚠️ No API URL set for production build');
    return defaultUrl;
  }

  // Development mode - we already have isDevice/isSimulator vars

  console.log('🔍 Network environment detected:', {
    isDevice,
    isSimulator,
    isEmulator,
    platform: Platform.OS,
  });

  if (isSimulator || isEmulator) {
    // Simulator/Emulator - use localhost
    console.log('📱 Using localhost for simulator/emulator');
    return 'http://localhost:3000/api';
  } else {
    // Physical device - need to use machine's IP
    console.log('📱 Physical device detected - ensure backend is accessible');
    return defaultUrl;
  }
}

/**
 * Create fetch with timeout and retry logic
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 15000,
  retries: number = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      console.log(`🔗 Network attempt ${attempt}/${retries + 1} to:`, url);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok && response.status >= 500 && attempt <= retries) {
        // Server error, retry
        console.log(`⚠️ Server error ${response.status}, retrying...`);
        continue;
      }

      return response;
    } catch (error) {
      clearTimeout;
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (attempt <= retries) {
        const isTimeoutError = lastError.name === 'AbortError';
        const isNetworkError = lastError.message.includes('Network request failed');

        if (isTimeoutError || isNetworkError) {
          console.log(`⚠️ Network error (attempt ${attempt}), retrying in ${attempt}s...`);
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
      }

      // If it's not a retryable error, throw immediately
      throw lastError;
    }
  }

  throw lastError || new Error('Max retries exceeded');
}

/**
 * Test network connectivity to the API
 */
export async function testApiConnectivity(): Promise<{
  success: boolean;
  error?: string;
  latency?: number;
}> {
  try {
    const startTime = Date.now();
    const apiUrl = getApiBaseUrl();
    const healthUrl = apiUrl.replace('/api', '/api/health');

    console.log('🏥 Testing connectivity to:', healthUrl);

    const response = await fetchWithTimeout(healthUrl, {
      method: 'GET',
    }, 5000, 1); // Quick test with 1 retry

    const latency = Date.now() - startTime;

    if (response.ok) {
      console.log(`✅ API connectivity test passed (${latency}ms)`);
      return { success: true, latency };
    } else {
      return {
        success: false,
        error: `Server responded with status ${response.status}`
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ API connectivity test failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
} 