import React, { useEffect, useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContextFallback';
import { NavigationProvider } from '../contexts/NavigationContext';
import { LoadingIndicator } from '../components';
import { DeepLinkHandler } from '../utils/deepLinkHandler';

// Import screens
import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { EmailVerificationScreen } from '../screens/EmailVerificationScreen';
import { AITutorScreen } from '../screens/AITutorScreen';
import { AudioLearningScreen } from '../screens/AudioLearningScreen';
import { AudioRecordingScreen } from '../screens/AudioRecordingScreen';
import { AuthDebugScreen } from '../screens/AuthDebugScreen';
import SubscriptionScreen from '../screens/SubscriptionScreen';
import { BottomTabNavigator } from './BottomTabNavigator';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    const deepLinkHandler = DeepLinkHandler.getInstance();
    deepLinkHandler.setNavigationRef(navigationRef);
    
    const cleanup = deepLinkHandler.initialize();
    
    return cleanup;
  }, []);

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
              <Stack.Screen name="AudioLearning" component={AudioLearningScreen} />
              <Stack.Screen name="AudioRecording" component={AudioRecordingScreen} />
              <Stack.Screen name="Subscription" component={SubscriptionScreen} />
              <Stack.Screen 
                name="AuthDebug" 
                component={AuthDebugScreen} 
                options={{ headerShown: true, title: 'Auth Debug' }} 
              />
            </>
          ) : (
            // User is not signed in
            <>
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
              <Stack.Screen 
                name="AuthDebug" 
                component={AuthDebugScreen} 
                options={{ headerShown: true, title: 'Auth Debug' }} 
              />
            </>
          )}
        </Stack.Navigator>
      </NavigationProvider>
    </NavigationContainer>
  );
}; 