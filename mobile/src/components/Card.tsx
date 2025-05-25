import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { theme } from '../constants/theme';

interface CardProps {
  children?: React.ReactNode;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'feature' | 'elevated';
  style?: ViewStyle;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  description,
  icon,
  onPress,
  variant = 'default',
  style,
}) => {
  const Component = onPress ? TouchableOpacity : View;
  
  const cardStyle = [
    styles.base,
    styles[variant],
    style,
  ];

  return (
    <Component
      style={cardStyle}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      
      {title && (
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      )}
      
      {description && (
        <Text style={styles.description} numberOfLines={3}>
          {description}
        </Text>
      )}
      
      {children}
    </Component>
  );
};

interface FeatureCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  color?: string;
  onPress: () => void;
}

export const FeatureCard: React.FC<FeatureCardProps> = ({
  title,
  description,
  icon,
  color = theme.colors.primary[100],
  onPress,
}) => {
  return (
    <TouchableOpacity style={styles.featureCard} onPress={onPress} activeOpacity={0.7}>
      <View style={[styles.featureIconContainer, { backgroundColor: color }]}>
        {icon}
      </View>
      <Text style={styles.featureTitle} numberOfLines={1}>
        {title}
      </Text>
      <Text style={styles.featureDescription} numberOfLines={2}>
        {description}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
  },
  default: {
    borderWidth: 1,
    borderColor: theme.colors.gray[200],
  },
  feature: {
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray[100],
  },
  elevated: {
    ...theme.shadow.lg,
  },
  iconContainer: {
    marginBottom: theme.spacing.md,
  },
  title: {
    fontSize: theme.typography.fontSize.lg,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    marginBottom: theme.spacing.xs,
  },
  description: {
    fontSize: theme.typography.fontSize.sm,
    color: theme.colors.gray[600],
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.sm,
  },
  
  // Feature card specific styles
  featureCard: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.base,
    alignItems: 'center',
    ...theme.shadow.sm,
    borderWidth: 1,
    borderColor: theme.colors.gray[100],
    minHeight: 120,
    flex: 1,
  },
  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  featureTitle: {
    fontSize: theme.typography.fontSize.sm,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.gray[900],
    textAlign: 'center',
    marginBottom: theme.spacing.xs,
  },
  featureDescription: {
    fontSize: theme.typography.fontSize.xs,
    color: theme.colors.gray[600],
    textAlign: 'center',
    lineHeight: theme.typography.lineHeight.normal * theme.typography.fontSize.xs,
  },
}); 