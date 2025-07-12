import React from 'react';
import { View, Text, ScrollView, StyleSheet, SafeAreaView } from 'react-native';
import { Header } from '../components/Header';

const LegalScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Header title="Legal Information" />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        
        <Text style={styles.sectionTitle}>Copyright Notice</Text>
        <Text style={styles.text}>
          ByteLecture Mobile Application{'\n'}
          Copyright © 2024 ByteLecture. All rights reserved.{'\n\n'}
          This application and its contents are protected by copyright law. 
          Unauthorized reproduction or distribution is prohibited.
        </Text>

        <Text style={styles.sectionTitle}>Third-Party Licenses</Text>
        <Text style={styles.text}>
          ByteLecture uses the following open-source software:
        </Text>

        <View style={styles.licenseItem}>
          <Text style={styles.licenseName}>React Native</Text>
          <Text style={styles.licenseText}>Copyright (c) Meta Platforms, Inc. and affiliates.{'\n'}Licensed under the MIT License.</Text>
        </View>

        <View style={styles.licenseItem}>
          <Text style={styles.licenseName}>Expo SDK</Text>
          <Text style={styles.licenseText}>Copyright (c) Expo, Inc.{'\n'}Licensed under the MIT License.</Text>
        </View>

        <View style={styles.licenseItem}>
          <Text style={styles.licenseName}>Supabase JavaScript Client</Text>
          <Text style={styles.licenseText}>Copyright (c) Supabase Inc.{'\n'}Licensed under the MIT License.</Text>
        </View>

        <View style={styles.licenseItem}>
          <Text style={styles.licenseName}>React Navigation</Text>
          <Text style={styles.licenseText}>Copyright (c) React Navigation Contributors{'\n'}Licensed under the MIT License.</Text>
        </View>

        <View style={styles.licenseItem}>
          <Text style={styles.licenseName}>PDF.js</Text>
          <Text style={styles.licenseText}>Copyright (c) Mozilla Foundation{'\n'}Licensed under the Apache License 2.0.</Text>
        </View>

        <Text style={styles.sectionTitle}>Content Rights</Text>
        <Text style={styles.text}>
          USER-GENERATED CONTENT:{'\n'}
          • You retain full ownership of your uploaded content{'\n'}
          • ByteLecture processes content solely for educational features{'\n'}
          • No claim of ownership over user-provided materials{'\n\n'}
          
          AI-GENERATED CONTENT:{'\n'}
          • AI-generated summaries and flashcards are derivative works{'\n'}
          • You retain rights to AI-generated content based on your source materials{'\n'}
          • ByteLecture does not claim ownership of AI-generated educational content{'\n\n'}
          
          EDUCATIONAL FAIR USE:{'\n'}
          • Content processing is for legitimate educational purposes{'\n'}
          • Transformative use through AI summarization{'\n'}
          • Private use by individual users for personal study
        </Text>

        <Text style={styles.sectionTitle}>Contact Information</Text>
        <Text style={styles.text}>
          For copyright inquiries or DMCA notices:{'\n'}
          Email: legal@bytelecture.com
        </Text>

        <Text style={styles.footer}>
          For complete license texts, visit:{'\n'}
          https://opensource.org/licenses/MIT
        </Text>

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
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    color: '#1a1a1a',
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: '#4a4a4a',
    marginBottom: 16,
  },
  licenseItem: {
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  licenseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  licenseText: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 18,
  },
  footer: {
    fontSize: 12,
    color: '#888888',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});

export default LegalScreen; 