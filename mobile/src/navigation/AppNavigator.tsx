import React, { useEffect, useRef, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContextFallback';
import { NavigationProvider } from '../contexts/NavigationContext';
import { LoadingIndicator, SplashScreen } from '../components';
import { DeepLinkHandler } from '../utils/deepLinkHandler';

// Import screens
import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { EmailVerificationScreen } from '../screens/EmailVerificationScreen';
import { AITutorScreen } from '../screens/AITutorScreen';
import { AudioRecordingScreen } from '../screens/AudioRecordingScreen';
import { QuizPerformanceScreen } from '../screens/QuizPerformanceScreen';
import { SyncSettingsScreen } from '../screens/SyncSettingsScreen';
import { UsageOverviewScreen } from '../screens/UsageOverviewScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import { BottomTabNavigator } from './BottomTabNavigator';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  const navigationRef = useRef<any>(null);
  const [showSplash, setShowSplash] = useState(false); // Temporarily skip splash

  useEffect(() => {
    const deepLinkHandler = DeepLinkHandler.getInstance();
    deepLinkHandler.setNavigationRef(navigationRef);

    const cleanup = deepLinkHandler.initialize();

    return cleanup;
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  if (showSplash) {
    return <SplashScreen onFinish={handleSplashFinish} />;
  }

  if (loading) {
    return <LoadingIndicator text="Loading..." />;
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <NavigationProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            // User is signed in
            <>
              <Stack.Screen name="Main" component={BottomTabNavigator} />
              <Stack.Screen name="AITutor" component={AITutorScreen} />
              <Stack.Screen
                name="AudioRecording"
                component={AudioRecordingScreen}
              />
              <Stack.Screen
                name="QuizPerformance"
                component={QuizPerformanceScreen}
              />
              <Stack.Screen
                name="SyncSettings"
                component={SyncSettingsScreen}
              />
              <Stack.Screen
                name="UsageOverview"
                component={UsageOverviewScreen}
              />
              <Stack.Screen
                name="Subscription"
                component={SubscriptionScreen}
              />
            </>
          ) : (
            // User is not signed in
            <>
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen
                name="EmailVerification"
                component={EmailVerificationScreen}
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationProvider>
    </NavigationContainer>
  );
};
