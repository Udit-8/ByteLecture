/**
 * Debug Authentication Script
 * Run with: node debug-auth.js
 */

// Load environment variables from .env file
require('dotenv').config();

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.log('❌ Missing environment variables');
  console.log(
    'EXPO_PUBLIC_SUPABASE_URL:',
    supabaseUrl ? '✅ Present' : '❌ Missing'
  );
  console.log(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY:',
    supabaseAnonKey ? '✅ Present' : '❌ Missing'
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testAuth() {
  console.log('🔍 Testing Supabase Authentication...\n');

  try {
    // Test 1: Check initial session
    console.log('1️⃣ Checking initial session...');
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      console.log('❌ Session error:', sessionError.message);
    } else if (session) {
      console.log('✅ Active session found:');
      console.log('   - User ID:', session.user.id);
      console.log('   - Email:', session.user.email);
      console.log(
        '   - Expires:',
        new Date(session.expires_at * 1000).toISOString()
      );
    } else {
      console.log('ℹ️ No active session');
    }

    // Test 2: Check user
    console.log('\n2️⃣ Checking user...');
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      console.log('❌ User error:', userError.message);
    } else if (user) {
      console.log('✅ User found:');
      console.log('   - User ID:', user.id);
      console.log('   - Email:', user.email);
      console.log('   - Created:', user.created_at);
    } else {
      console.log('ℹ️ No user found');
    }

    // Test 3: Try to sign in with test credentials
    console.log('\n3️⃣ Testing sign in...');
    console.log('Enter your credentials to test:');

    // For now, let's just test with dummy credentials to see the error
    const testEmail = 'test@example.com';
    const testPassword = 'testpassword';

    console.log(`Attempting sign in with: ${testEmail}`);
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      });

    if (signInError) {
      console.log(
        'ℹ️ Expected sign in error (using dummy credentials):',
        signInError.message
      );
    } else {
      console.log('✅ Sign in successful!');
      console.log('   - User:', signInData.user?.email);
      console.log(
        '   - Session:',
        signInData.session?.access_token ? 'Valid' : 'Invalid'
      );
    }

    // Test 4: Check storage access
    console.log('\n4️⃣ Testing storage access...');
    try {
      const { data: buckets, error: bucketsError } =
        await supabase.storage.listBuckets();

      if (bucketsError) {
        console.log('❌ Storage error:', bucketsError.message);
      } else {
        console.log('✅ Storage buckets accessible:');
        buckets.forEach((bucket) => {
          console.log(`   - ${bucket.name} (public: ${bucket.public})`);
        });
      }
    } catch (storageError) {
      console.log('❌ Storage connection error:', storageError.message);
    }
  } catch (error) {
    console.log('❌ Test failed:', error.message);
  }
}

// Run the test
testAuth()
  .then(() => {
    console.log('\n🏁 Authentication test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.log('💥 Test crashed:', error.message);
    process.exit(1);
  });
