import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts } from 'expo-font';
import { PlayfairDisplay_700Bold } from '@expo-google-fonts/playfair-display';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import { AuthProvider } from './src/lib/auth';
import RootNavigator from './src/navigation/RootNavigator';

function Shell() {
  const { theme } = useTheme();
  return (<><StatusBar style={theme.dark ? 'light' : 'dark'} /><RootNavigator /></>);
}

export default function App() {
  const [loaded] = useFonts({ PlayfairDisplay_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  if (!loaded) return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="#0F6E56" /></View>;
  return (
    <SafeAreaProvider>
      <ThemeProvider><AuthProvider><Shell /></AuthProvider></ThemeProvider>
    </SafeAreaProvider>
  );
}
