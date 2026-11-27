/**
 * Button Primitive
 * Cross-platform button with consistent styling
 */

import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface ButtonProps extends React.ComponentPropsWithoutRef<'button'> {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  type?: 'button' | 'submit' | 'reset';
}

const baseStyles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    fontFamily: 'Inter_600SemiBold',
    transition: 'all 150ms ease-out',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginHorizontal: 4,
  },
  loading: {
    opacity: 0.7,
  },
  sizes: {
    sm: { paddingVertical: 8, paddingHorizontal: 12, fontSize: 13, minHeight: 36 },
    md: { paddingVertical: 10, paddingHorizontal: 16, fontSize: 14, minHeight: 44 },
    lg: { paddingVertical: 12, paddingHorizontal: 20, fontSize: 15, minHeight: 48 },
    xl: { paddingVertical: 14, paddingHorizontal: 24, fontSize: 16, minHeight: 52 },
  },
});

const variantStyles = {
  primary: {
    backgroundColor: '#0F6E56',
    borderWidth: 0,
    color: '#FFFFFF',
  },
  secondary: {
    backgroundColor: '#EDE9FE',
    borderWidth: 0,
    color: '#5B21B6',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#0F6E56',
    color: '#0F6E56',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 0,
    color: '#0F6E56',
  },
  destructive: {
    backgroundColor: '#C53030',
    borderWidth: 0,
    color: '#FFFFFF',
  },
  success: {
    backgroundColor: '#0F6E56',
    borderWidth: 0,
    color: '#FFFFFF',
  },
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      disabled,
      onPress,
      style,
      className,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;
    const sizeStyle = baseStyles.sizes[size];
    const variantStyle = variantStyles[variant];

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        style={[
          baseStyles.button,
          sizeStyle,
          variantStyle,
          fullWidth && { width: '100%' },
          isDisabled && { opacity: 0.5 },
          style,
        ]}
        {...props}
      >
        {loading ? (
          <View style={baseStyles.content}>
            <Text style={{ color: variantStyle.color }}>Loading...</Text>
          </View>
        ) : (
          <View style={baseStyles.content}>
            {leftIcon && <View style={baseStyles.icon}>{leftIcon}</View>}
            <Text style={{ color: variantStyle.color, fontSize: sizeStyle.fontSize, fontFamily: 'Inter_600SemiBold' }}>
              {children}
            </Text>
            {rightIcon && <View style={baseStyles.icon}>{rightIcon}</View>}
          </View>
        )}
      </Pressable>
    );
  }
);

Button.displayName = 'Button';