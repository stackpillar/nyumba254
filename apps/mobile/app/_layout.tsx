/**
 * Root Layout - Nyumba254 Mobile App
 */

import { useCallback, useEffect, useState } from 'react';
import { View, StatusBar, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import { ThemeProvider, useTheme } from '@nyumba254/ui';
import { AuthProvider, useAuth } from '@nyumba254/core';
import { Providers } from './providers';

function Shell() {
  const { theme } = useTheme();
  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} backgroundColor={theme.colors.background} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.card },
          headerTintColor: theme.colors.primary,
          headerTitleStyle: { fontFamily: 'Inter_600SemiBold', color: theme.colors.text },
          contentStyle: { backgroundColor: theme.colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ title: 'Sign In' }} />
        <Stack.Screen name="(auth)/signup" options={{ title: 'Create Account' }} />
        <Stack.Screen name="listing/[id]" options={{ title: 'Listing' }} />
        <Stack.Screen name="storefront/@[handle]" options={{ title: 'Lister Page' }} />
        <Stack.Screen name="dashboard/*" options={{ title: 'Dashboard' }} />
        <Stack.Screen name="post-listing" options={{ title: 'Post a Listing' }} />
        <Stack.Screen name="saved" options={{ title: 'Saved' }} />
      </Stack>
    </>
  );
}

function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#0F6E56" />
    </View>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PlayfairDisplay_700Bold,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) return <LoadingScreen />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <Providers>
            <Shell />
          </Providers>
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F7F6F2',
  },
});