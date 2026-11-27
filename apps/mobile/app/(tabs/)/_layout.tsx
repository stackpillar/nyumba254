/**
 * Tabs Layout - Main App Tabs
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '@nyumba254/ui';

export default function TabsLayout() {
  const { theme } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.border,
          height: 78,
          paddingBottom: 12,
        },
        tabBarLabelStyle: {
          fontFamily: 'Inter_600SemiBold',
          fontSize: 11,
        },
        tabBarIndicatorStyle: { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <svg
              width={21}
              height={21}
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth={focused ? 2.5 : 2}
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
        }}
      />
      <Tabs.Screen
        name="listings"
        options={{
          title: 'Browse',
          tabBarIcon: ({ color, focused }) => (
            <svg
              width={21}
              height={21}
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth={focused ? 2.5 : 2}
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          ),
        }}
      />
      <Tabs.Screen
        name="post-listing"
        options={{
          title: 'Post',
          tabBarIcon: ({ color, focused }) => (
            <View style={{ position: 'relative', top: -14, alignItems: 'center', justifyContent: 'center' }}>
              <View
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 21,
                  backgroundColor: theme.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: theme.colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.4,
                  shadowRadius: 14,
                  elevation: 6,
                  marginBottom: 2,
                }}
              >
                <svg
                  width={20}
                  height={20}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth={2.5}
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </View>
              <Text style={{ color: theme.colors.primary, fontSize: 10.5, fontWeight: '600', fontFamily: 'Inter_600SemiBold' }}>
                Post
              </Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="saved"
        options={{
          title: 'Saved',
          tabBarIcon: ({ color, focused }) => (
            <svg
              width={21}
              height={21}
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth={focused ? 2.5 : 2}
            >
              <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
            </svg>
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, focused }) => (
            <svg
              width={21}
              height={21}
              viewBox="0 0 24 24"
              fill="none"
              stroke={color}
              strokeWidth={focused ? 2.5 : 2}
            >
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          ),
        }}
      />
    </Tabs>
  );
}