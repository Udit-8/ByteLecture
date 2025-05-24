const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add platform-specific extensions
config.resolver.platforms = ['native', 'android', 'ios', 'web'];

// Block WebSocket packages from being bundled for mobile
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];
config.resolver.alias = {
  'ws': false,
  'ws/lib/stream.js': false,
  'utf-8-validate': false,
  'bufferutil': false,
};

// Block problematic packages from being included in the bundle
config.resolver.blockList = [
  /node_modules\/ws\//,
  /node_modules\/utf-8-validate\//,
  /node_modules\/bufferutil\//,
];

// Transform configuration
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config; 