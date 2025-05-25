import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';
import { useNavigation } from '../contexts/NavigationContext';

// Import screens
import { HomeScreen } from '../screens/HomeScreen';
import { ImportScreen } from '../screens/ImportScreen';
import { RecentNotesScreen } from '../screens/RecentNotesScreen';
import { SummaryScreen } from '../screens/SummaryScreen';
import { FlashcardsScreen } from '../screens/FlashcardsScreen';
import { QuizScreen } from '../screens/QuizScreen';
import { AudioLearningScreen } from '../screens/AudioLearningScreen';

const Tab = createBottomTabNavigator();

export const BottomTabNavigator: React.FC = () => {
  const { mode } = useNavigation();

  if (mode === 'note-detail') {
    // Show note detail tabs: Summary, Cards, Quiz, Audio Summary
    return (
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: theme.colors.primary[600],
          tabBarInactiveTintColor: theme.colors.gray[400],
          tabBarStyle: {
            backgroundColor: theme.colors.white,
            borderTopColor: theme.colors.gray[200],
            paddingBottom: 8,
            paddingTop: 8,
            height: 88,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '500',
          },
        }}
      >
        <Tab.Screen 
          name="Summary" 
          component={SummaryScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="document-text-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen 
          name="Cards" 
          component={FlashcardsScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="library-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen 
          name="Quiz" 
          component={QuizScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="help-circle-outline" size={size} color={color} />
            ),
          }}
        />
        <Tab.Screen 
          name="Audio" 
          component={AudioLearningScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="headset-outline" size={size} color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    );
  }

  // Show main tabs: Home, Import, Recent Notes
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary[600],
        tabBarInactiveTintColor: theme.colors.gray[400],
        tabBarStyle: {
          backgroundColor: theme.colors.white,
          borderTopColor: theme.colors.gray[200],
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Import" 
        component={ImportScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cloud-upload-outline" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen 
        name="Recent Notes" 
        component={RecentNotesScreen}
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}; 