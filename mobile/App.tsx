import './src/config/polyfills';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from './src/contexts/AuthContextFallback';
import { NavigationProvider } from './src/contexts/NavigationContext';
import { AppNavigator } from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <NavigationProvider>
        <StatusBar style="dark" />
        <AppNavigator />
      </NavigationProvider>
    </AuthProvider>
  );
}
