/**
 * WebSocket Polyfill for React Native
 * This module provides a WebSocket implementation compatible with React Native
 */

// Use React Native's built-in WebSocket
const WebSocketImpl = require('react-native/Libraries/WebSocket/WebSocket');

// Export in the format expected by ws library
module.exports = WebSocketImpl;
module.exports.default = WebSocketImpl;
module.exports.WebSocket = WebSocketImpl;

// Add any additional properties that might be expected
if (WebSocketImpl) {
  module.exports.CONNECTING = WebSocketImpl.CONNECTING || 0;
  module.exports.OPEN = WebSocketImpl.OPEN || 1;
  module.exports.CLOSING = WebSocketImpl.CLOSING || 2;
  module.exports.CLOSED = WebSocketImpl.CLOSED || 3;
}
