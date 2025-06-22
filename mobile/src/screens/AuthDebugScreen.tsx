/**
 * AuthDebugScreen - Complete authentication debugging interface
 * Use this screen to debug authentication issues
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { SimpleAuth } from '../components/SimpleAuth';
import { AuthDebugger } from '../components/AuthDebugger';
import type { User } from '@supabase/supabase-js';

export const AuthDebugScreen: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<'auth' | 'debug'>('auth');

  const handleAuthStateChange = (user: User | null) => {
    console.log('[AuthDebugScreen] Auth state changed:', {
      hasUser: !!user,
      email: user?.email,
    });
    setCurrentUser(user);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🔍 Authentication Debug Center</Text>
          <Text style={styles.subtitle}>
            Debug authentication issues and test upload functionality
          </Text>
        </View>

        {/* Status Banner */}
        <View
          style={[
            styles.statusBanner,
            currentUser ? styles.success : styles.warning,
          ]}
        >
          <Text style={styles.statusText}>
            {currentUser
              ? `✅ Authenticated as ${currentUser.email}`
              : '❌ Not Authenticated'}
          </Text>
          {currentUser && (
            <Text style={styles.statusSubtext}>Ready to upload files! 🎯</Text>
          )}
        </View>

        {/* Tab Navigation */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'auth' && styles.activeTab]}
            onPress={() => setActiveTab('auth')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'auth' && styles.activeTabText,
              ]}
            >
              🔐 Authentication
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'debug' && styles.activeTab]}
            onPress={() => setActiveTab('debug')}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === 'debug' && styles.activeTabText,
              ]}
            >
              🔍 Debug Info
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        <View style={styles.content}>
          {activeTab === 'auth' ? (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Sign In / Sign Up</Text>
              <Text style={styles.sectionDescription}>
                Use this to test authentication. Check the debug tab and console
                logs for detailed information.
              </Text>
              <SimpleAuth onAuthStateChange={handleAuthStateChange} />
            </View>
          ) : (
            <View style={styles.tabContent}>
              <Text style={styles.sectionTitle}>Debug Information</Text>
              <Text style={styles.sectionDescription}>
                View authentication state, AsyncStorage data, and test storage
                access.
              </Text>
              <AuthDebugger />
            </View>
          )}
        </View>

        {/* Instructions */}
        <View style={styles.instructions}>
          <Text style={styles.instructionsTitle}>📋 Debugging Steps</Text>
          <Text style={styles.instructionText}>
            1. 🔐 Try signing in with your credentials on the Authentication tab
          </Text>
          <Text style={styles.instructionText}>
            2. 🔍 Check the Debug Info tab to see what's happening
          </Text>
          <Text style={styles.instructionText}>
            3. 📱 Open React Native debugger or Metro logs for console output
          </Text>
          <Text style={styles.instructionText}>
            4. 🧪 Use the "Test Storage" button to verify upload capability
          </Text>
          <Text style={styles.instructionText}>
            5. 🗑️ Try "Clear Storage" if auth state seems stuck
          </Text>
        </View>

        {/* Console Log Reminder */}
        <View style={styles.reminder}>
          <Text style={styles.reminderText}>
            💡 Don't forget to check the console logs in your terminal or React
            Native debugger for detailed authentication flow information!
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    alignItems: 'center',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  statusBanner: {
    margin: 15,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
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
  statusSubtext: {
    fontSize: 14,
    color: '#666',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 15,
    marginBottom: 15,
    backgroundColor: '#e9ecef',
    borderRadius: 8,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 6,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
  },
  activeTabText: {
    color: '#333',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  instructions: {
    margin: 15,
    padding: 15,
    backgroundColor: '#e3f2fd',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2196f3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  instructionText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 5,
    lineHeight: 18,
  },
  reminder: {
    margin: 15,
    padding: 15,
    backgroundColor: '#f3e5f5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#9c27b0',
  },
  reminderText: {
    fontSize: 13,
    color: '#7b1fa2',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default AuthDebugScreen;
