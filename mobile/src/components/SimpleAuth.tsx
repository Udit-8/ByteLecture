/**
 * Simple Authentication Component
 * Use this to test upload functionality with authenticated users
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { supabase } from '../config/supabase';
import type { User } from '@supabase/supabase-js';

interface SimpleAuthProps {
  onAuthStateChange?: (user: User | null) => void;
}

export const SimpleAuth: React.FC<SimpleAuthProps> = ({ onAuthStateChange }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    console.log('[SimpleAuth] Component mounted, checking auth state...');
    
    // Check initial auth state
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      console.log('[SimpleAuth] Initial session check:', { 
        hasSession: !!session, 
        hasUser: !!session?.user, 
        email: session?.user?.email,
        error: error?.message 
      });
      
      setUser(session?.user || null);
      onAuthStateChange?.(session?.user || null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('[SimpleAuth] Auth state change:', { 
          event, 
          hasSession: !!session, 
          hasUser: !!session?.user, 
          email: session?.user?.email 
        });
        
        setUser(session?.user || null);
        onAuthStateChange?.(session?.user || null);
      }
    );

    return () => {
      console.log('[SimpleAuth] Component unmounting, cleaning up subscription');
      subscription.unsubscribe();
    };
  }, [onAuthStateChange]);

  const signIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    console.log('[SimpleAuth] Attempting sign in for:', email);
    setLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    console.log('[SimpleAuth] Sign in result:', { 
      success: !error, 
      hasUser: !!data?.user, 
      hasSession: !!data?.session,
      email: data?.user?.email,
      error: error?.message 
    });

    if (error) {
      Alert.alert('Sign In Error', error.message);
    } else {
      Alert.alert('Success', 'Signed in successfully!');
      setEmail('');
      setPassword('');
    }
    setLoading(false);
  };

  const signUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      Alert.alert('Sign Up Error', error.message);
    } else {
      Alert.alert(
        'Success', 
        'Account created! Check your email for verification. You can also sign in immediately to test uploads.'
      );
    }
    setLoading(false);
  };

  const signOut = async () => {
    setLoading(true);
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      Alert.alert('Sign Out Error', error.message);
    } else {
      Alert.alert('Success', 'Signed out successfully!');
    }
    setLoading(false);
  };

  const testAuthState = async () => {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      Alert.alert('Auth Error', error.message);
      return;
    }
    
    if (session?.user) {
      Alert.alert(
        'Authentication Status', 
        `✅ Logged in as: ${session.user.email}\n👤 User ID: ${session.user.id}\n\n🎯 You can now upload files!`
      );
    } else {
      Alert.alert(
        'Authentication Status', 
        '❌ Not logged in\n\nPlease sign in to upload files'
      );
    }
  };

  if (user) {
    return (
      <View style={styles.container}>
        <View style={styles.userInfo}>
          <Text style={styles.title}>✅ Authenticated</Text>
          <Text style={styles.userText}>📧 {user.email}</Text>
          <Text style={styles.userText}>👤 {user.id}</Text>
        </View>
        
        <TouchableOpacity style={styles.button} onPress={testAuthState}>
          <Text style={styles.buttonText}>Test Auth Status</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.signOutButton]} onPress={signOut}>
          <Text style={styles.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔐 Authentication Required</Text>
      <Text style={styles.subtitle}>Sign in to upload files</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <TextInput
        style={styles.input}
        placeholder="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, loading && styles.buttonDisabled]} 
          onPress={signIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Sign In</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.signUpButton, loading && styles.buttonDisabled]} 
          onPress={signUp}
          disabled={loading}
        >
          <Text style={styles.buttonText}>Sign Up</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.testButton} onPress={testAuthState}>
        <Text style={styles.testButtonText}>Test Current Auth State</Text>
      </TouchableOpacity>

      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          💡 Create an account or use test credentials to upload files
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    margin: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 20,
  },
  userInfo: {
    backgroundColor: '#e8f5e8',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  userText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  button: {
    flex: 1,
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  signUpButton: {
    backgroundColor: '#34C759',
  },
  signOutButton: {
    backgroundColor: '#FF3B30',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  testButton: {
    padding: 10,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#007AFF',
    fontSize: 14,
  },
  helpContainer: {
    marginTop: 10,
    padding: 10,
    backgroundColor: '#fff3cd',
    borderRadius: 6,
  },
  helpText: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
  },
});

export default SimpleAuth; 