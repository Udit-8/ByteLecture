/**
 * AuthDebugger - Comprehensive debugging for authentication issues
 * Add this to any screen to debug auth state
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
}

export const AuthDebugger: React.FC = () => {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
    error: null,
  });
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [asyncStorageData, setAsyncStorageData] = useState<any>({});

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugInfo((prev) => [`[${timestamp}] ${message}`, ...prev].slice(0, 20));
    console.log(`[AuthDebugger] ${message}`);
  };

  useEffect(() => {
    addDebugLog('🔄 AuthDebugger initialized');
    checkAuthState();
    checkAsyncStorage();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      addDebugLog(`🔔 Auth event: ${event}`);
      if (session) {
        addDebugLog(`✅ Session received: ${session.user.email}`);
        setAuthState({
          user: session.user,
          session: session,
          loading: false,
          error: null,
        });
      } else {
        addDebugLog(`❌ No session in auth event`);
        setAuthState({
          user: null,
          session: null,
          loading: false,
          error: null,
        });
      }
    });

    return () => {
      addDebugLog('🧹 Cleanup auth listener');
      subscription.unsubscribe();
    };
  }, []);

  const checkAuthState = async () => {
    try {
      addDebugLog('🔍 Checking current auth state...');

      // Check session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        addDebugLog(`❌ Session error: ${sessionError.message}`);
        setAuthState((prev) => ({
          ...prev,
          error: sessionError.message,
          loading: false,
        }));
        return;
      }

      // Check user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        addDebugLog(`❌ User error: ${userError.message}`);
      }

      if (session && session.user) {
        addDebugLog(`✅ Active session found: ${session.user.email}`);
        addDebugLog(
          `📅 Expires: ${new Date(session.expires_at! * 1000).toLocaleString()}`
        );
        setAuthState({
          user: session.user,
          session: session,
          loading: false,
          error: null,
        });
      } else if (user) {
        addDebugLog(`👤 User found but no session: ${user.email}`);
        setAuthState({
          user: user,
          session: null,
          loading: false,
          error: 'User found but no active session',
        });
      } else {
        addDebugLog(`❌ No user or session found`);
        setAuthState({
          user: null,
          session: null,
          loading: false,
          error: null,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addDebugLog(`💥 Auth check failed: ${errorMsg}`);
      setAuthState((prev) => ({ ...prev, error: errorMsg, loading: false }));
    }
  };

  const checkAsyncStorage = async () => {
    try {
      addDebugLog('🔍 Checking AsyncStorage...');
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter((key) => key.includes('supabase'));

      addDebugLog(
        `📦 Found ${supabaseKeys.length} Supabase keys in AsyncStorage`
      );

      if (supabaseKeys.length > 0) {
        const values = await AsyncStorage.multiGet(supabaseKeys);
        const storageData: any = {};

        values.forEach(([key, value]) => {
          try {
            storageData[key] = value ? JSON.parse(value) : null;
            addDebugLog(`📦 ${key}: ${value ? 'Has data' : 'Empty'}`);
          } catch {
            storageData[key] = value;
            addDebugLog(`📦 ${key}: Raw value`);
          }
        });

        setAsyncStorageData(storageData);
      } else {
        addDebugLog('📦 No Supabase data in AsyncStorage');
      }
    } catch (error) {
      addDebugLog(`💥 AsyncStorage check failed: ${error}`);
    }
  };

  const refreshAuth = () => {
    setAuthState((prev) => ({ ...prev, loading: true }));
    addDebugLog('🔄 Manual refresh requested');
    checkAuthState();
    checkAsyncStorage();
  };

  const clearAsyncStorage = async () => {
    try {
      addDebugLog('🗑️ Clearing AsyncStorage...');
      const keys = await AsyncStorage.getAllKeys();
      const supabaseKeys = keys.filter((key) => key.includes('supabase'));

      if (supabaseKeys.length > 0) {
        await AsyncStorage.multiRemove(supabaseKeys);
        addDebugLog(`🗑️ Cleared ${supabaseKeys.length} Supabase keys`);
        setAsyncStorageData({});
      } else {
        addDebugLog('🗑️ No Supabase keys to clear');
      }
    } catch (error) {
      addDebugLog(`💥 Clear AsyncStorage failed: ${error}`);
    }
  };

  const testStorageAccess = async () => {
    try {
      addDebugLog('🧪 Testing storage access...');

      if (!authState.session) {
        Alert.alert('No Session', 'Please authenticate first');
        return;
      }

      const { data: buckets, error } = await supabase.storage.listBuckets();

      if (error) {
        addDebugLog(`❌ Storage error: ${error.message}`);
        Alert.alert('Storage Error', error.message);
      } else {
        addDebugLog(`✅ Storage accessible - ${buckets.length} buckets found`);
        Alert.alert(
          'Storage Test',
          `✅ Success! Found ${buckets.length} buckets`
        );
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      addDebugLog(`💥 Storage test failed: ${errorMsg}`);
      Alert.alert('Storage Test Failed', errorMsg);
    }
  };

  const signOut = async () => {
    try {
      addDebugLog('🚪 Signing out...');
      const { error } = await supabase.auth.signOut();

      if (error) {
        addDebugLog(`❌ Sign out error: ${error.message}`);
      } else {
        addDebugLog('✅ Sign out successful');
      }
    } catch (error) {
      addDebugLog(`💥 Sign out failed: ${error}`);
    }
  };

  if (authState.loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Checking authentication...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Text style={styles.title}>🔍 Auth Debugger</Text>

      {/* Current Auth State */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current State</Text>
        <View
          style={[
            styles.statusCard,
            authState.user ? styles.success : styles.warning,
          ]}
        >
          <Text style={styles.statusText}>
            {authState.user ? '✅ Authenticated' : '❌ Not Authenticated'}
          </Text>
          {authState.user && (
            <>
              <Text style={styles.detailText}>📧 {authState.user.email}</Text>
              <Text style={styles.detailText}>👤 {authState.user.id}</Text>
              {authState.session && (
                <Text style={styles.detailText}>
                  📅 Expires:{' '}
                  {new Date(
                    authState.session.expires_at! * 1000
                  ).toLocaleString()}
                </Text>
              )}
            </>
          )}
          {authState.error && (
            <Text style={styles.errorText}>❌ {authState.error}</Text>
          )}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={refreshAuth}>
            <Text style={styles.buttonText}>🔄 Refresh</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={testStorageAccess}>
            <Text style={styles.buttonText}>🧪 Test Storage</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.button, styles.dangerButton]}
            onPress={clearAsyncStorage}
          >
            <Text style={styles.buttonText}>🗑️ Clear Storage</Text>
          </TouchableOpacity>
          {authState.user && (
            <TouchableOpacity
              style={[styles.button, styles.dangerButton]}
              onPress={signOut}
            >
              <Text style={styles.buttonText}>🚪 Sign Out</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Debug Log */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Debug Log</Text>
        <View style={styles.logContainer}>
          {debugInfo.map((log, index) => (
            <Text key={index} style={styles.logText}>
              {log}
            </Text>
          ))}
          {debugInfo.length === 0 && (
            <Text style={styles.emptyText}>No debug logs yet</Text>
          )}
        </View>
      </View>

      {/* AsyncStorage Data */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AsyncStorage Data</Text>
        <View style={styles.logContainer}>
          {Object.keys(asyncStorageData).length > 0 ? (
            Object.entries(asyncStorageData).map(([key, value]) => (
              <View key={key} style={styles.storageItem}>
                <Text style={styles.storageKey}>{key}:</Text>
                <Text style={styles.storageValue}>
                  {typeof value === 'object'
                    ? JSON.stringify(value, null, 2)
                    : String(value)}
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.emptyText}>
              No Supabase data in AsyncStorage
            </Text>
          )}
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f8f9fa',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  loadingText: {
    textAlign: 'center',
    marginTop: 10,
    color: '#666',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#333',
  },
  statusCard: {
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  success: {
    backgroundColor: '#e8f5e8',
    borderColor: '#4caf50',
  },
  warning: {
    backgroundColor: '#fff3cd',
    borderColor: '#ffc107',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  errorText: {
    fontSize: 14,
    color: '#d32f2f',
    marginTop: 5,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  logContainer: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
  },
  logText: {
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
    color: '#333',
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  storageItem: {
    marginBottom: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  storageKey: {
    fontSize: 12,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  storageValue: {
    fontSize: 11,
    fontFamily: 'monospace',
    color: '#666',
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderRadius: 4,
  },
});

export default AuthDebugger;
