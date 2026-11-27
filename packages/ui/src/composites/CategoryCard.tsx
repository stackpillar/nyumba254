/**
 * CategoryCard Composite
 * Category selection card for homepage
 */

import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface CategoryCardProps {
  category: 'apartment' | 'house' | 'boarding' | 'airbnb' | 'commercial';
  title: string;
  description: string;
  count?: number;
  icon?: React.ReactNode;
  onPress?: () => void;
  variant?: 'default' | 'pill';
  className?: string;
  style?: any;
}

const categoryStyles: Record<string, { bg: string; iconBg: string; iconColor: string; textColor: string; descColor: string; borderColor?: string }> = {
  apartment: { bg: '#0F6E56', iconBg: 'rgba(255,255,255,0.2)', iconColor: '#FFFFFF', textColor: '#FFFFFF', descColor: 'rgba(255,255,255,0.88)' },
  house: { bg: '#085041', iconBg: 'rgba(255,255,255,0.15)', iconColor: '#FFFFFF', textColor: '#FFFFFF', descColor: 'rgba(255,255,255,0.82)' },
  boarding: { bg: '#E1F5EE', iconBg: '#FFFFFF', iconColor: '#085041', textColor: '#085041', descColor: '#4A4A46', borderColor: '#9FE1CB' },
  airbnb: { bg: '#FFFFFF', iconBg: '#E1F5EE', iconColor: '#085041', textColor: '#085041', descColor: '#4A4A46', borderColor: '#0F6E56' },
  commercial: { bg: '#1A1A18', iconBg: 'rgba(255,255,255,0.12)', iconColor: '#FFFFFF', textColor: '#FFFFFF', descColor: 'rgba(255,255,255,0.78)' },
};

const categoryIcons: Record<string, React.ReactNode> = {
  apartment: (
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="1.8" fill="none">
      <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
      <polyline points="9 22 9 12 15 12 15 22"/>
    </svg>
  ),
  house: (
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="1.8" fill="none">
      <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10"/>
    </svg>
  ),
  boarding: (
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="1.8" fill="none">
      <path d="M22 10v6M2 10l10-5 10 5-10 5-10-5z"/>
      <path d="M6 12v5c3 3 9 3 12 0v-5"/>
    </svg>
  ),
  airbnb: (
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="1.8" fill="none">
      <path d="M12 2C8 7 5 11 5 14.5a7 7 0 0014 0C19 11 16 7 12 2z"/>
    </svg>
  ),
  commercial: (
    <svg viewBox="0 0 24 24" width="22" height="22" stroke="currentColor" strokeWidth="1.8" fill="none">
      <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6M9 11h.01M15 11h.01M9 7h.01M15 7h.01"/>
    </svg>
  ),
};

const baseStyles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  cardDefault: {
    flex: 1,
    padding: 24,
  },
  cardPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  iconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrapperPill: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginBottom: 0,
    marginRight: 10,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
    fontFamily: 'Inter_600SemiBold',
  },
  titlePill: {
    fontSize: 13.5,
    marginBottom: 0,
    whiteSpace: 'nowrap',
  },
  description: {
    fontSize: 13,
    marginBottom: 10,
    fontFamily: 'Inter_400Regular',
  },
  count: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  countPill: {
    fontSize: 11.5,
    marginLeft: 8,
  },
  overlay: {
    position: 'absolute',
    inset: 0,
  },
  radialGradient: {
    position: 'absolute',
    top: '15%',
    right: '15%',
    width: '70%',
    height: '70%',
    borderRadius: '50%',
    opacity: 0.1,
  },
});

export const CategoryCard = React.forwardRef<HTMLDivElement, CategoryCardProps>(
  (
    {
      category,
      title,
      description,
      count,
      icon,
      onPress,
      variant = 'default',
      className,
      style,
    },
    ref
  ) => {
    const styles = categoryStyles[category];
    const isPill = variant === 'pill';

    return (
      <Pressable
        ref={ref}
        onPress={onPress}
        activeOpacity={0.9}
        style={[
          baseStyles.card,
          isPill ? baseStyles.cardPill : baseStyles.cardDefault,
          { backgroundColor: styles.bg, borderColor: styles.borderColor },
          style,
        ]}
        className={cn(className)}
        accessibilityRole="button"
      >
        {!isPill && (
          <View style={baseStyles.overlay}>
            <View style={[
              baseStyles.radialGradient,
              { backgroundColor: category === 'boarding' || category === 'airbnb' ? styles.iconColor : '#FFFFFF' },
            ]} />
          </View>
        )}

        <View style={[
          isPill ? baseStyles.iconWrapperPill : baseStyles.iconWrapper,
          { backgroundColor: styles.iconBg },
        ]}>
          {icon || categoryIcons[category]}
        </View>

        {!isPill && <Text style={[baseStyles.title, { color: styles.textColor }]}>{title}</Text>}
        {!isPill && <Text style={[baseStyles.description, { color: styles.descColor }]}>{description}</Text>}
        {!isPill && count !== undefined && <Text style={[baseStyles.count, { color: styles.textColor }]}>{count} listing{count !== 1 ? 's' : ''}</Text>}

        {isPill && (
          <>
            <Text style={[baseStyles.titlePill, { color: styles.textColor }]}>{title}</Text>
            {count !== undefined && <Text style={[baseStyles.countPill, { color: styles.descColor }]}>{count}</Text>}
          </>
        )}
      </Pressable>
    );
  }
);

CategoryCard.displayName = 'CategoryCard';