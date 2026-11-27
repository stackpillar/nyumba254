/**
 * NavBar Composite
 * Cross-platform navigation bar
 */

import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { Button } from '../primitives/Button';
import { Avatar } from '../primitives/Avatar';
import { cn } from '@nyumba254/design-system';

export interface NavBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  leftAction?: React.ReactNode;
  rightAction?: React.ReactNode;
  actions?: Array<{ label: string; onPress: () => void; variant?: 'primary' | 'outline' | 'ghost' }>;
  user?: {
    name: string;
    avatar?: string;
    initials: string;
  } | null;
  onProfilePress?: () => void;
  className?: string;
  style?: any;
}

const baseStyles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0DED8',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
  },
  logoText: {
    fontFamily: 'PlayfairDisplay_700Bold',
    fontSize: 20,
    color: '#085041',
    fontWeight: '600',
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A18',
    fontFamily: 'Inter_600SemiBold',
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  userButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1A1A18',
    fontFamily: 'Inter_500Medium',
  },
});

export const NavBar = React.forwardRef<HTMLDivElement, NavBarProps>(
  (
    {
      title,
      showBack = false,
      onBack,
      leftAction,
      rightAction,
      actions = [],
      user,
      onProfilePress,
      className,
      style,
    },
    ref
  ) => {
    return (
      <View ref={ref} style={[baseStyles.nav, style]} className={cn(className)}>
        <View style={baseStyles.left}>
          {showBack && (
            <TouchableOpacity onPress={onBack} activeOpacity={0.8} style={baseStyles.backButton}>
              <Text style={{ fontSize: 20, color: '#1A1A18' }}>←</Text>
            </TouchableOpacity>
          )}
          {leftAction}
          {!showBack && !leftAction && (
            <View style={baseStyles.logo}>
              <View style={baseStyles.logoIcon}>
                <Image
                  source={{ uri: '/logo-icon.png' }}
                  style={{ width: 36, height: 36, borderRadius: 8 }}
                  resizeMode="cover"
                />
              </View>
              <Text style={baseStyles.logoText}>Nyumba254</Text>
            </View>
          )}
          {title && <Text style={baseStyles.title}>{title}</Text>}
        </View>

        <View style={baseStyles.right}>
          {rightAction}
          {actions.map((action, index) => (
            <Button
              key={index}
              variant={action.variant || 'outline'}
              size="sm"
              onPress={action.onPress}
            >
              {action.label}
            </Button>
          ))}
          {user && (
            <TouchableOpacity onPress={onProfilePress} activeOpacity={0.8} style={baseStyles.userButton}>
              <Avatar name={user.name} src={user.avatar} size="sm" fallbackColor="#0F6E56" />
              <Text style={baseStyles.userName}>{user.name.split(' ')[0]}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  }
);

NavBar.displayName = 'NavBar';