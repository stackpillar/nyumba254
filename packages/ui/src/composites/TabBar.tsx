/**
 * TabBar Composite
 * Cross-platform bottom tab bar for mobile
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable } from 'react-native';
import { cn } from '@nyumba254/design-system';

export interface TabBarItem {
  name: string;
  label: string;
  icon: React.ReactNode;
  activeIcon?: React.ReactNode;
  badge?: number;
  isCenter?: boolean;
}

export interface TabBarProps {
  items: TabBarItem[];
  activeTab: string;
  onTabPress: (name: string) => void;
  className?: string;
  style?: any;
}

const baseStyles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    height: 78,
    paddingBottom: 12,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0DED8',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    minHeight: 46,
    paddingHorizontal: 8,
  },
  tabCenter: {
    position: 'relative',
  },
  tabIcon: {
    width: 21,
    height: 21,
  },
  tabIconCenter: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#0F6E56',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F6E56',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 6,
    marginBottom: 2,
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: '22%',
    minWidth: 15,
    height: 15,
    borderRadius: 7.5,
    backgroundColor: '#0F6E56',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
    fontFamily: 'Inter_800ExtraBold',
  },
});

export const TabBar = React.forwardRef<HTMLDivElement, TabBarProps>(
  (
    { items, activeTab, onTabPress, className, style },
    ref
  ) => {
    return (
      <View ref={ref} style={[baseStyles.tabBar, style]} className={cn(className)}>
        {items.map((item, index) => (
          <TouchableOpacity
            key={item.name}
            onPress={() => onTabPress(item.name)}
            activeOpacity={0.8}
            style={[
              baseStyles.tab,
              item.isCenter && baseStyles.tabCenter,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === item.name }}
            accessibilityLabel={item.label}
          >
            {item.isCenter ? (
              <View style={baseStyles.tabIconCenter}>
                {item.icon}
              </View>
            ) : (
              <>
                <View style={baseStyles.tabIcon}>
                  {activeTab === item.name ? item.activeIcon : item.icon}
                </View>
                <Text
                  style={[
                    baseStyles.tabLabel,
                    { color: activeTab === item.name ? '#0F6E56' : '#6B6A63' },
                  ]}
                >
                  {item.label}
                </Text>
                {item.badge && item.badge > 0 && (
                  <View style={baseStyles.badge}>
                    <Text style={baseStyles.badgeText}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </Text>
                  </View>
                )}
              </>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }
);

TabBar.displayName = 'TabBar';