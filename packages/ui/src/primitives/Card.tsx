/**
 * Card Primitive
 * Cross-platform card component with consistent styling
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface CardProps extends React.ComponentPropsWithoutRef<'div'> {
  children: React.ReactNode;
  variant?: 'default' | 'outlined' | 'elevated' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  disabled?: boolean;
}

const baseStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  variants: {
    default: {
      borderWidth: 1,
      borderColor: '#E0DED8',
    },
    outlined: {
      borderWidth: 1.5,
      borderColor: '#E0DED8',
    },
    elevated: {
      borderWidth: 0,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
    interactive: {
      borderWidth: 1,
      borderColor: '#E0DED8',
    },
  },
  padding: {
    none: { padding: 0 },
    sm: { padding: 12 },
    md: { padding: 16 },
    lg: { padding: 24 },
  },
  interactiveStates: {
    pressed: { opacity: 0.9 },
    focused: { borderColor: '#0F6E56', borderWidth: 2 },
  },
});

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      onPress,
      disabled,
      style,
      className,
      ...props
    },
    ref
  ) => {
    const Component = onPress && !disabled ? Pressable : View;
    const variantStyle = baseStyles.variants[variant];
    const paddingStyle = baseStyles.padding[padding];

    return (
      <Component
        ref={ref}
        onPress={onPress}
        disabled={disabled}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityState={{ disabled }}
        style={[
          baseStyles.card,
          variantStyle,
          paddingStyle,
          onPress && !disabled && baseStyles.interactiveStates.pressed,
          style,
        ]}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Card.displayName = 'Card';

export const CardHeader = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className, style, ...props }, ref) => (
    <View ref={ref} style={[styles.cardHeader, style]} {...props}>
      {children}
    </View>
  )
);

CardHeader.displayName = 'CardHeader';

export const CardContent = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className, style, ...props }, ref) => (
    <View ref={ref} style={[styles.cardContent, style]} {...props}>
      {children}
    </View>
  )
);

CardContent.displayName = 'CardContent';

export const CardFooter = React.forwardRef<HTMLDivElement, { children: React.ReactNode; className?: string }>(
  ({ children, className, style, ...props }, ref) => (
    <View ref={ref} style={[styles.cardFooter, style]} {...props}>
      {children}
    </View>
  )
);

CardFooter.displayName = 'CardFooter';

const styles = StyleSheet.create({
  cardHeader: { paddingBottom: 12 },
  cardContent: { flex: 1 },
  cardFooter: { paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0DED8' },
});