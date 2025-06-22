import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet, Modal } from 'react-native';
import { theme } from '../constants/theme';

interface LoadingIndicatorProps {
  size?: 'small' | 'large';
  color?: string;
  text?: string;
  overlay?: boolean;
  visible?: boolean;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  size = 'large',
  color = theme.colors.primary[600],
  text,
  overlay = false,
  visible = true,
}) => {
  if (!visible) return null;

  const content = (
    <View style={[styles.container, overlay && styles.overlayContainer]}>
      <View style={[styles.content, overlay && styles.overlayContent]}>
        <ActivityIndicator size={size} color={color} />
        {text && <Text style={styles.text}>{text}</Text>}
      </View>
    </View>
  );

  if (overlay) {
    return (
      <Modal transparent visible={visible} animationType="fade">
        {content}
      </Modal>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
  },
  overlayContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContent: {
    backgroundColor: theme.colors.white,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.xl,
    minWidth: 120,
    ...theme.shadow.lg,
  },
  text: {
    fontSize: theme.typography.fontSize.base,
    color: theme.colors.gray[600],
    marginTop: theme.spacing.md,
    textAlign: 'center',
  },
});
