/**
 * React Native Polyfills for Supabase
 * This file sets up necessary polyfills for React Native compatibility
 */

import 'react-native-url-polyfill/auto';
import 'react-native-get-random-values';
import 'text-encoding';

// Ensure WebSocket is available globally for Supabase realtime
declare const global: any;

// Use React Native's built-in WebSocket if not already available
if (typeof global !== 'undefined') {
  if (!global.WebSocket) {
    global.WebSocket = require('react-native/Libraries/WebSocket/WebSocket');
  }
  
  // Ensure other globals needed by Supabase are available
  if (!global.btoa) {
    global.btoa = require('base-64').encode;
  }
  
  if (!global.atob) {
    global.atob = require('base-64').decode;
  }
  
  // Mock ws module to prevent import errors
  const mockWS = global.WebSocket;
  global.ws = mockWS;
}

console.log('✅ React Native polyfills loaded successfully'); 