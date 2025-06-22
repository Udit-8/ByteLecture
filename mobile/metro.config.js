const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add resolver for React Native compatibility
config.resolver = {
  ...config.resolver,
  alias: {
    // Resolve WebSocket to our polyfill
    ws: require.resolve('./src/config/websocket-polyfill.js'),
    // Handle other Node.js modules that might cause issues
    crypto: 'react-native-get-random-values',
  },
  resolverMainFields: ['react-native', 'browser', 'main'],
  platforms: ['ios', 'android', 'native', 'web'],
  // Block problematic modules from being bundled
  blockList: [
    // Block ws and related WebSocket modules
    /node_modules\/ws\//,
    /node_modules\/utf-8-validate\//,
    /node_modules\/bufferutil\//,
    // Block realtime-js if causing issues
    /node_modules\/@supabase\/realtime-js\/.*ws/,
  ],
};

// Configure transformer for better compatibility
config.transformer = {
  ...config.transformer,
  minifierConfig: {
    // Ensure proper minification for React Native
    keep_fnames: true,
    mangle: {
      keep_fnames: true,
    },
  },
};

module.exports = config;
