/**
 * Input Primitive
 * Cross-platform text input with consistent styling
 */

import React from 'react';
import { TextInput, Text, StyleSheet, View } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface InputProps extends React.ComponentPropsWithoutRef<'input'> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  required?: boolean;
}

const baseStyles = StyleSheet.create({
  container: {
    width: '100%',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A18',
    fontFamily: 'Inter_600SemiBold',
  },
  required: {
    color: '#C53030',
    marginLeft: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.5,
    backgroundColor: '#FFFFFF',
    transition: 'all 150ms ease-out',
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    color: '#1A1A18',
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  inputSm: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  inputLg: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
  },
  icon: {
    paddingHorizontal: 12,
    color: '#6B6A63',
  },
  helperText: {
    fontSize: 12,
    fontFamily: 'Inter_400Regular',
  },
  errorText: {
    color: '#C53030',
  },
  helperTextNormal: {
    color: '#6B6A63',
  },
});

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      size = 'md',
      fullWidth = true,
      disabled,
      required,
      style,
      className,
      onChangeText,
      value,
      onBlur,
      onFocus,
      ...props
    },
    ref
  ) => {
    const inputSizeStyles = {
      sm: baseStyles.inputSm,
      md: baseStyles.input,
      lg: baseStyles.inputLg,
    };

    const borderColor = error
      ? '#C53030'
      : props.focused
      ? '#0F6E56'
      : '#E0DED8';

    const backgroundColor = disabled ? '#F7F6F2' : '#FFFFFF';

    return (
      <View style={[baseStyles.container, fullWidth && { width: '100%' }, style]}>
        {label && (
          <Text style={baseStyles.label}>
            {label}
            {required && <Text style={baseStyles.required}>*</Text>}
          </Text>
        )}
        <View
          style={[
            baseStyles.inputWrapper,
            inputSizeStyles[size],
            { borderColor, backgroundColor },
          ]}
        >
          {leftIcon && <View style={baseStyles.icon}>{leftIcon}</View>}
          <TextInput
            ref={ref}
            style={[baseStyles.input, inputSizeStyles[size]]}
            value={value}
            onChangeText={onChangeText}
            onBlur={onBlur}
            onFocus={onFocus}
            disabled={disabled}
            editable={!disabled}
            {...props}
          />
          {rightIcon && <View style={baseStyles.icon}>{rightIcon}</View>}
        </View>
        {(error || helperText) && (
          <Text style={[baseStyles.helperText, error ? baseStyles.errorText : baseStyles.helperTextNormal]}>
            {error || helperText}
          </Text>
        )}
      </View>
    );
  }
);

Input.displayName = 'Input';