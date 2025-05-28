/**
 * Test Supabase Connection
 * Simple utility to test if Supabase is properly configured for React Native
 */

import { supabase } from '../config/supabase';

export interface SupabaseTestResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Test basic Supabase connection
 */
export async function testSupabaseConnection(): Promise<SupabaseTestResult> {
  try {
    console.log('🔄 Testing Supabase connection...');

    // Test basic storage connection
    const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
    
    if (bucketsError) {
      return {
        success: false,
        message: `Storage connection failed: ${bucketsError.message}`,
        details: bucketsError,
      };
    }

    console.log('✅ Supabase storage connection successful');
    console.log('📁 Available buckets:', buckets?.map(b => b.name));

    return {
      success: true,
      message: 'Supabase connection successful',
      details: {
        bucketsCount: buckets?.length || 0,
        availableBuckets: buckets?.map(b => b.name) || [],
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Supabase connection test failed:', error);

    return {
      success: false,
      message: `Connection test failed: ${errorMessage}`,
      details: error,
    };
  }
}

/**
 * Test Supabase auth functionality (without requiring login)
 */
export async function testSupabaseAuth(): Promise<SupabaseTestResult> {
  try {
    console.log('🔄 Testing Supabase auth...');

    // Test getting current session (should return null if not logged in)
    const { data: session, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      return {
        success: false,
        message: `Auth test failed: ${sessionError.message}`,
        details: sessionError,
      };
    }

    console.log('✅ Supabase auth test successful');
    console.log('👤 Current session:', session ? 'Active' : 'None');

    return {
      success: true,
      message: 'Auth functionality working',
      details: {
        hasActiveSession: !!session,
        sessionInfo: session ? 'User logged in' : 'No active session',
      },
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('❌ Supabase auth test failed:', error);

    return {
      success: false,
      message: `Auth test failed: ${errorMessage}`,
      details: error,
    };
  }
}

/**
 * Run all Supabase tests
 */
export async function runAllSupabaseTests(): Promise<{
  connection: SupabaseTestResult;
  auth: SupabaseTestResult;
  overall: boolean;
}> {
  console.log('🚀 Running complete Supabase test suite...');
  console.log('=' .repeat(50));

  const connectionResult = await testSupabaseConnection();
  const authResult = await testSupabaseAuth();

  const overall = connectionResult.success && authResult.success;

  console.log('\n📊 Test Results Summary:');
  console.log('=' .repeat(30));
  console.log(`Connection: ${connectionResult.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Auth: ${authResult.success ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Overall: ${overall ? '✅ SUCCESS' : '❌ FAILURE'}`);

  if (overall) {
    console.log('\n🎉 Supabase is properly configured for React Native!');
  } else {
    console.log('\n⚠️ Some Supabase tests failed. Check the details above.');
  }

  return {
    connection: connectionResult,
    auth: authResult,
    overall,
  };
} 