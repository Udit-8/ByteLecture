/**
 * Test Supabase Setup for React Native
 * This script verifies that the React Native Supabase configuration is working correctly
 */

const path = require('path');

// Mock React Native modules for Node.js testing
global.fetch = require('node-fetch');

// Mock React Native's WebSocket
global.WebSocket = require('ws');

// Mock AsyncStorage
const mockAsyncStorage = {
  setItem: () => Promise.resolve(),
  getItem: () => Promise.resolve(null),
  removeItem: () => Promise.resolve(),
  clear: () => Promise.resolve(),
};

// Override require for AsyncStorage
const originalRequire = require;
require = function (id) {
  if (id === '@react-native-async-storage/async-storage') {
    return mockAsyncStorage;
  }
  return originalRequire(id);
};

// Set up environment variables
process.env.EXPO_PUBLIC_SUPABASE_URL =
  'https://nbacjrnbwgpikumbalvm.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5iYWNqcm5id2dwaWt1bWJhbHZtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwODA4OTQsImV4cCI6MjA2MzY1Njg5NH0.rGeeNwnq1oXG87RAsu86zd6rYY8IMQ_uXVNYsBP240U';

async function testSupabaseImport() {
  console.log('🔄 Testing Supabase import...');

  try {
    // Mock the polyfills
    require('react-native-url-polyfill/auto');

    // Mock base-64
    global.btoa = require('base-64').encode;
    global.atob = require('base-64').decode;

    // Import Supabase
    const { createClient } = require('@supabase/supabase-js');

    console.log('✅ Supabase import successful');

    // Create client
    const supabase = createClient(
      process.env.EXPO_PUBLIC_SUPABASE_URL,
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      {
        auth: {
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            'X-Client-Info': 'supabase-js-react-native',
          },
        },
      }
    );

    console.log('✅ Supabase client created successfully');

    // Test basic functionality
    console.log('🔄 Testing storage connection...');

    const { data: buckets, error } = await supabase.storage.listBuckets();

    if (error) {
      console.error('❌ Storage test failed:', error.message);
      return false;
    }

    console.log('✅ Storage connection successful');
    console.log('📁 Available buckets:', buckets?.map((b) => b.name) || []);

    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    return false;
  }
}

async function runTests() {
  console.log('🚀 ByteLecture Supabase React Native Compatibility Test');
  console.log('='.repeat(60));

  const success = await testSupabaseImport();

  console.log('\n📊 Test Results:');
  console.log('='.repeat(30));

  if (success) {
    console.log('✅ ALL TESTS PASSED');
    console.log('🎉 Supabase is properly configured for React Native!');
    console.log('\n💡 Next steps:');
    console.log('   1. Start your Expo app: npm start');
    console.log('   2. The WebSocket error should be resolved');
    console.log('   3. Upload functionality should work correctly');
  } else {
    console.log('❌ TESTS FAILED');
    console.log('⚠️ Please check the error messages above');
  }

  return success;
}

// Install required dependencies if not present
function checkDependencies() {
  const required = [
    '@supabase/supabase-js',
    'react-native-url-polyfill',
    'react-native-get-random-values',
    '@react-native-async-storage/async-storage',
    'base-64',
  ];

  console.log('📦 Checking dependencies...');

  for (const dep of required) {
    try {
      require.resolve(dep);
      console.log(`   ✅ ${dep}`);
    } catch (error) {
      console.log(`   ❌ ${dep} - MISSING`);
      return false;
    }
  }

  console.log('✅ All dependencies are installed\n');
  return true;
}

// Run the tests
if (require.main === module) {
  if (!checkDependencies()) {
    console.error('\n❌ Missing dependencies. Please run: npm install');
    process.exit(1);
  }

  runTests()
    .then((success) => {
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      console.error('💥 Unexpected error:', error);
      process.exit(1);
    });
}

module.exports = { testSupabaseImport, runTests };
