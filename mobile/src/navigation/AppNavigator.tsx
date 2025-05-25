import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContextFallback';
import { NavigationProvider } from '../contexts/NavigationContext';
import { LoadingIndicator } from '../components';

// Import screens
import { LandingScreen } from '../screens/LandingScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { RegisterScreen } from '../screens/RegisterScreen';
import { EmailVerificationScreen } from '../screens/EmailVerificationScreen';
import { AITutorScreen } from '../screens/AITutorScreen';
import { AudioLearningScreen } from '../screens/AudioLearningScreen';
import { BottomTabNavigator } from './BottomTabNavigator';

const Stack = createNativeStackNavigator();

export const AppNavigator: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingIndicator text="Loading..." />;
  }

  return (
    <NavigationContainer>
      <NavigationProvider>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {user ? (
            // User is signed in
            <>
              <Stack.Screen name="Main" component={BottomTabNavigator} />
              <Stack.Screen name="AITutor" component={AITutorScreen} />
              <Stack.Screen name="AudioLearning" component={AudioLearningScreen} />
            </>
          ) : (
            // User is not signed in
            <>
              <Stack.Screen name="Landing" component={LandingScreen} />
              <Stack.Screen name="Login" component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} />
              <Stack.Screen name="EmailVerification" component={EmailVerificationScreen} />
            </>
          )}
        </Stack.Navigator>
      </NavigationProvider>
    </NavigationContainer>
  );
}; 