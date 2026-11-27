/**
 * Skeleton Composite
 * Loading placeholders for async content
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface SkeletonProps {
  variant?: 'text' | 'circular' | 'rectangular' | 'card' | 'listing';
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: any;
  animated?: boolean;
}

const baseStyles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#F7F6F2',
    borderRadius: 8,
    overflow: 'hidden',
  },
  circular: {
    borderRadius: 9999,
  },
  animated: {
    backgroundColor: 'transparent',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  textLine: {
    height: 12,
    borderRadius: 4,
    marginBottom: 8,
  },
  textLineShort: { width: '60%' },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0DED8',
    overflow: 'hidden',
  },
  cardImage: {
    aspectRatio: 4 / 3,
  },
  cardContent: { padding: 16 },
  listing: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E0DED8',
    overflow: 'hidden',
  },
  listingImage: {
    aspectRatio: 4 / 3,
  },
  listingContent: { padding: 16 },
  listingTitle: { height: 20, borderRadius: 4, marginBottom: 8, width: '80%' },
  listingSubtitle: { height: 14, borderRadius: 4, marginBottom: 12, width: '60%' },
  listingPrice: { height: 24, borderRadius: 4, width: '40%' },
});

const shimmerKeyframes = {
  '0%': { backgroundPosition: '200% 0' },
  '100%': { backgroundPosition: '-200% 0' },
};

export const Skeleton = React.forwardRef<HTMLDivElement, SkeletonProps>(
  (
    {
      variant = 'rectangular',
      width = '100%',
      height,
      className,
      style,
      animated = true,
    },
    ref
  ) => {
    const shimmerStyle = animated
      ? {
          background: 'linear-gradient(90deg, #F7F6F2 25%, #E8E7E1 50%, #F7F6F2 75%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s infinite linear',
        }
      : { backgroundColor: '#F7F6F2' };

    const variants = {
      text: {
        ...baseStyles.skeleton,
        ...baseStyles.textLine,
        ...shimmerStyle,
      },
      circular: {
        ...baseStyles.skeleton,
        ...baseStyles.circular,
        ...shimmerStyle,
        width: width || 40,
        height: height || 40,
      },
      rectangular: {
        ...baseStyles.skeleton,
        ...shimmerStyle,
        width,
        height: height || 16,
      },
      card: {
        ...baseStyles.card,
        ...shimmerStyle,
        width,
        height,
      },
      listing: {
        ...baseStyles.listing,
        ...shimmerStyle,
        width,
        height,
      },
    };

    if (variant === 'card') {
      return (
        <View ref={ref} style={[{ width, height }, style]} className={cn(className)}>
          <View style={[baseStyles.cardImage, { ...shimmerStyle, width: '100%' }]} />
          <View style={baseStyles.cardContent}>
            <View style={[baseStyles.textLine, { ...shimmerStyle, width: '60%' }]} />
            <View style={[baseStyles.textLine, { ...shimmerStyle, width: '100%' }]} />
            <View style={[baseStyles.textLine, { ...shimmerStyle, width: '40%' }]} />
          </View>
        </View>
      );
    }

    if (variant === 'listing') {
      return (
        <View ref={ref} style={[{ width, height }, style]} className={cn(className)}>
          <View style={[baseStyles.listingImage, { ...shimmerStyle, width: '100%' }]} />
          <View style={baseStyles.listingContent}>
            <View style={[baseStyles.listingTitle, { ...shimmerStyle }]} />
            <View style={[baseStyles.listingSubtitle, { ...shimmerStyle }]} />
            <View style={[baseStyles.listingPrice, { ...shimmerStyle }]} />
          </View>
        </View>
      );
    }

    return (
      <View
        ref={ref}
        style={[
          variants[variant],
          { width, height },
          style,
        ]}
        className={cn(className)}
      />
    );
  }
);

Skeleton.displayName = 'Skeleton';

export const SkeletonText = ({ lines = 3, ...props }: { lines?: number } & Omit<SkeletonProps, 'variant'>) => (
  <View style={{ gap: 8 }}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} variant="text" width={i === lines - 1 ? '60%' : '100%'} {...props} />
    ))}
  </View>
);

export const SkeletonCard = ({ ...props }: Omit<SkeletonProps, 'variant'>) => (
  <Skeleton variant="card" {...props} />
);

export const SkeletonListing = ({ ...props }: Omit<SkeletonProps, 'variant'>) => (
  <Skeleton variant="listing" {...props} />
);