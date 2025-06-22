import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { theme } from '../constants/theme';

interface HeaderProps {
  title: string;
  subtitle?: string;
  leftAction?: {
    icon: React.ReactNode;
    onPress: () => void;
  };
  rightAction?: {
    icon: React.ReactNode;
    onPress: () => void;
  };
  variant?: 'default' | 'large';
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  leftAction,
  rightAction,
  variant = 'default',
}) => {
  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor={theme.colors.white} />
      <SafeAreaView style={styles.safeArea}>
        <View
          style={[
            styles.container,
            variant === 'large' && styles.containerLarge,
          ]}
        >
          <View style={styles.content}>
            {leftAction ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={leftAction.onPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {leftAction.icon}
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton} />
            )}

            <View style={styles.titleContainer}>
              <Text
                style={[styles.title, variant === 'large' && styles.titleLarge]}
                numberOfLines={1}
              >
                {title}
              </Text>
              {subtitle && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
            </View>

            {rightAction ? (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={rightAction.onPress}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {rightAction.icon}
              </TouchableOpacity>
            ) : (
              <View style={styles.actionButton} />
            )}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: theme.colors.white,
  },
  container: {
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.gray[200],
    paddingHorizontal: theme.spacing.base,
    paddingVertical: theme.spacing.md,
  },
  containerLarge: {
    paddingVertical: theme.spacing.lg,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
  },
  titleLarge: {
    fontSize: theme.typography.fontSize['2xl'],
    fontWeight: theme.typography.fontWeight.bold,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  actionButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
