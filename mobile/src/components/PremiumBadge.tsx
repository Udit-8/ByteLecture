import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../constants/theme';

export type PremiumBadgeVariant =
  | 'pill'
  | 'compact'
  | 'icon'
  | 'banner'
  | 'corner';
export type PremiumBadgeSize = 'xs' | 'sm' | 'md' | 'lg';

interface PremiumBadgeProps {
  variant?: PremiumBadgeVariant;
  size?: PremiumBadgeSize;
  text?: string;
  style?: ViewStyle;
  textStyle?: TextStyle;
  showIcon?: boolean;
  animated?: boolean;
}

export const PremiumBadge: React.FC<PremiumBadgeProps> = ({
  variant = 'pill',
  size = 'md',
  text = 'Premium',
  style,
  textStyle,
  showIcon = true,
  animated = false,
}) => {
  const getContainerStyle = (): ViewStyle => {
    const sizeStyles = {
      xs: { paddingHorizontal: 4, paddingVertical: 2, borderRadius: 8 },
      sm: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: 10 },
      md: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
      lg: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
    };

    const variantStyles: Record<PremiumBadgeVariant, ViewStyle> = {
      pill: {
        backgroundColor: theme.colors.warning[100],
        borderColor: theme.colors.warning[200],
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        ...sizeStyles[size],
      },
      compact: {
        backgroundColor: theme.colors.success[500],
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        ...sizeStyles[size],
      },
      icon: {
        backgroundColor: theme.colors.warning[500],
        width:
          size === 'xs' ? 16 : size === 'sm' ? 20 : size === 'md' ? 24 : 28,
        height:
          size === 'xs' ? 16 : size === 'sm' ? 20 : size === 'md' ? 24 : 28,
        borderRadius:
          (size === 'xs' ? 16 : size === 'sm' ? 20 : size === 'md' ? 24 : 28) /
          2,
        justifyContent: 'center',
        alignItems: 'center',
      },
      banner: {
        backgroundColor: theme.colors.warning[500],
        paddingHorizontal: theme.spacing.md,
        paddingVertical: theme.spacing.sm,
        borderRadius: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      },
      corner: {
        position: 'absolute',
        top: -6,
        right: -6,
        backgroundColor: theme.colors.warning[500],
        borderRadius: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        zIndex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        ...theme.shadow.sm,
      },
    };

    return variantStyles[variant];
  };

  const getTextStyle = (): TextStyle => {
    const sizeStyles = {
      xs: { fontSize: 10 },
      sm: { fontSize: 11 },
      md: { fontSize: 12 },
      lg: { fontSize: 14 },
    };

    const variantStyles: Record<PremiumBadgeVariant, TextStyle> = {
      pill: {
        color: theme.colors.warning[700],
        fontWeight: theme.typography.fontWeight.semibold,
        ...sizeStyles[size],
      },
      compact: {
        color: theme.colors.white,
        fontWeight: theme.typography.fontWeight.bold,
        ...sizeStyles[size],
      },
      icon: {
        color: theme.colors.white,
        fontSize:
          size === 'xs' ? 8 : size === 'sm' ? 10 : size === 'md' ? 12 : 14,
        fontWeight: theme.typography.fontWeight.bold,
      },
      banner: {
        color: theme.colors.white,
        fontWeight: theme.typography.fontWeight.bold,
        fontSize: 16,
        textAlign: 'center',
      },
      corner: {
        color: theme.colors.white,
        fontWeight: theme.typography.fontWeight.bold,
        fontSize: 10,
      },
    };

    return variantStyles[variant];
  };

  const getIconSize = () => {
    if (variant === 'icon') {
      return size === 'xs' ? 8 : size === 'sm' ? 10 : size === 'md' ? 12 : 14;
    }
    return size === 'xs' ? 10 : size === 'sm' ? 12 : size === 'md' ? 14 : 16;
  };

  const getIconName = () => {
    switch (variant) {
      case 'compact':
      case 'corner':
        return 'star';
      case 'banner':
        return 'diamond';
      default:
        return 'star-outline';
    }
  };

  const shouldShowText = variant !== 'icon' && text;
  const shouldShowIcon = showIcon;

  return (
    <View style={[getContainerStyle(), animated && styles.animated, style]}>
      {shouldShowIcon && (
        <Ionicons
          name={getIconName() as any}
          size={getIconSize()}
          color={
            variant === 'pill' ? theme.colors.warning[600] : theme.colors.white
          }
          style={shouldShowText ? { marginRight: 4 } : undefined}
        />
      )}
      {shouldShowText && (
        <Text style={[getTextStyle(), textStyle]}>{text}</Text>
      )}
    </View>
  );
};

// Specialized premium badge variants for common use cases
export const PremiumPillBadge: React.FC<Omit<PremiumBadgeProps, 'variant'>> = (
  props
) => <PremiumBadge {...props} variant="pill" />;

export const PremiumIconBadge: React.FC<Omit<PremiumBadgeProps, 'variant'>> = (
  props
) => <PremiumBadge {...props} variant="icon" />;

export const PremiumCornerBadge: React.FC<
  Omit<PremiumBadgeProps, 'variant'>
> = (props) => <PremiumBadge {...props} variant="corner" />;

export const PremiumBannerBadge: React.FC<
  Omit<PremiumBadgeProps, 'variant'>
> = (props) => <PremiumBadge {...props} variant="banner" />;

const styles = StyleSheet.create({
  animated: {
    // Could add animation styles here
  },
});
