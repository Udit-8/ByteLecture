import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import { useAuth } from '../contexts/AuthContextFallback';

interface HomeScreenProps {
  navigation: any;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut();
            if (error) {
              Alert.alert('Error', 'Failed to logout: ' + error);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Welcome to ByteLecture!</Text>
        
        <View style={styles.userInfo}>
          <Text style={styles.userInfoTitle}>User Information</Text>
          <Text style={styles.userInfoText}>
            Email: {user?.email || 'No email'}
          </Text>
          <Text style={styles.userInfoText}>
            ID: {user?.id || 'No ID'}
          </Text>
          <Text style={styles.userInfoText}>
            Created: {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}
          </Text>
        </View>

        <View style={styles.features}>
          <Text style={styles.featuresTitle}>Coming Soon</Text>
          <Text style={styles.featureText}>• Upload PDFs and YouTube videos</Text>
          <Text style={styles.featureText}>• Generate AI flashcards</Text>
          <Text style={styles.featureText}>• Create interactive quizzes</Text>
          <Text style={styles.featureText}>• Track learning progress</Text>
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  content: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 32,
  },
  userInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  userInfoTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  userInfoText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  features: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  featureText: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 8,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 