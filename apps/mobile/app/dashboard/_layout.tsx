/**
 * Dashboard Layout
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Stack } from 'expo-router';
import { useTheme } from '@nyumba254/ui';

export default function DashboardLayout() {
  const { theme } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.card },
        headerTintColor: theme.colors.primary,
        headerTitleStyle: { fontFamily: 'Inter_600SemiBold', color: theme.colors.text },
        contentStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="overview" options={{ title: 'Overview' }} />
      <Stack.Screen name="listings" options={{ title: 'My Listings' }} />
      <Stack.Screen name="messages" options={{ title: 'Messages' }} />
      <Stack.Screen name="enquiries" options={{ title: 'Enquiries' }} />
      <Stack.Screen name="viewings" options={{ title: 'Viewings' }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
      <Stack.Screen name="settings" options={{ title: 'Settings' }} />
    </Stack>
  );
}