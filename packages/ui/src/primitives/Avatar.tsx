/**
 * Avatar Primitive
 * Cross-platform avatar with fallback initials
 */

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { getInitials } from '@nyumba254/core';

export interface AvatarProps {
  src?: string;
  alt?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  shape?: 'circle' | 'square';
  fallbackColor?: string;
  className?: string;
  style?: any;
}

const sizeMap = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 64,
  '2xl': 80,
};

const fontSizeMap = {
  xs: 8,
  sm: 10,
  md: 13,
  lg: 16,
  xl: 20,
  '2xl': 26,
};

const baseStyles = StyleSheet.create({
  avatar: {
    borderRadius: 9999,
    overflow: 'hidden',
    backgroundColor: '#E0DED8',
  },
  square: {
    borderRadius: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  fallback: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fallbackText: {
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
  },
});

export const Avatar = React.forwardRef<View, AvatarProps>(
  ({ src, alt, name, size = 'md', shape = 'circle', fallbackColor, style, className }, ref) => {
    const dimension = sizeMap[size];
    const fontSize = fontSizeMap[size];

    const initials = name ? getInitials(name) : '?';
    const bgColor = fallbackColor || '#0F6E56';

    return (
      <View
        ref={ref}
        style={[
          baseStyles.avatar,
          shape === 'square' && baseStyles.square,
          { width: dimension, height: dimension },
          style,
        ]}
      >
        {src ? (
          <Image
            source={{ uri: src }}
            style={[baseStyles.image, { width: dimension, height: dimension }]}
            resizeMode="cover"
            accessibilityLabel={alt || name || 'Avatar'}
          />
        ) : (
          <View style={[baseStyles.fallback, { backgroundColor: bgColor }]}>
            <Text
              style={[
                baseStyles.fallbackText,
                { fontSize },
              ]}
            >
              {initials}
            </Text>
          </View>
        )}
      </View>
    );
  }
);

Avatar.displayName = 'Avatar';