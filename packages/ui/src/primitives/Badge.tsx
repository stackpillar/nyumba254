/**
 * Badge Primitive
 * Cross-platform badge/chip component
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  dotColor?: string;
  className?: string;
  style?: any;
}

const baseStyles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    fontFamily: 'Inter_600SemiBold',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  sizes: {
    sm: { paddingVertical: 2, paddingHorizontal: 8, fontSize: 10 },
    md: { paddingVertical: 4, paddingHorizontal: 10, fontSize: 11 },
    lg: { paddingVertical: 6, paddingHorizontal: 12, fontSize: 12 },
  },
});

const variantStyles = {
  default: {
    backgroundColor: '#EDE9FE',
    color: '#5B21B6',
  },
  success: {
    backgroundColor: '#E1F5EE',
    color: '#085041',
  },
  warning: {
    backgroundColor: '#FAEEDA',
    color: '#72470D',
  },
  danger: {
    backgroundColor: '#FEF2F2',
    color: '#991B1B',
  },
  info: {
    backgroundColor: '#E0F2FE',
    color: '#0369A1',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#E0DED8',
    color: '#4A4A46',
  },
};

export const Badge = React.forwardRef<View, BadgeProps>(
  ({ children, variant = 'default', size = 'md', dot, dotColor, style, className }, ref) => {
    const variantStyle = variantStyles[variant];
    const sizeStyle = baseStyles.sizes[size];

    return (
      <View
        ref={ref}
        style={[
          baseStyles.badge,
          variantStyle,
          sizeStyle,
          style,
        ]}
      >
        {dot && (
          <View
            style={[
              baseStyles.dot,
              { backgroundColor: dotColor || variantStyle.color },
            ]}
          />
        )}
        <Text style={{ color: variantStyle.color, fontSize: sizeStyle.fontSize, fontFamily: 'Inter_600SemiBold' }}>
          {children}
        </Text>
      </View>
    );
  }
);

Badge.displayName = 'Badge';