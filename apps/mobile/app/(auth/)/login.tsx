/**
 * Login Screen
 */

import React, { useState } from 'react';
import { View, Text, Image, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { useTheme } from '@nyumba254/ui';
import { useAuth, useSignInWithEmail } from '@nyumba254/core';
import { Button, Input } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

export default function LoginScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const { session } = useAuth();
  const { mutate: signIn, isPending } = useSignInWithEmail();
  const [email, setEmail] = useState(route.params?.email || '');
  const [error, setError] = useState('');

  const handleSubmit = (e: any) => {
    e.preventDefault();
    setError('');

    if (!email) {
      setError('Please enter your email');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    signIn(email, {
      onSuccess: () => {
        navigation.navigate('(tabs)');
      },
      onError: (err) => {
        setError(err.message || 'Failed to send magic link');
      },
    });
  };

  if (session) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={[styles.title, { color: theme.colors.text }]}>Welcome back</Text>
          <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>Sign in with your email to access your account</Text>
        </View>

        <View style={styles.form}>
          <form onSubmit={handleSubmit}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={error}
              required
              size="lg"
            />

            {error && <Text style={[styles.error, { color: theme.colors.destructive }]}>{error}</Text>}

            <Button
              onPress={handleSubmit}
              disabled={isPending}
              size="lg"
              className="mt-4"
              fullWidth
            >
              {isPending ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </form>

          <View style={styles.divider}>
            <Text style={styles.dividerText}>Or continue with</Text>
          </View>

          <Button
            variant="outline"
            onPress={() => Alert.alert('Coming soon', 'Google sign-in will be available soon')}
            size="lg"
            fullWidth
            leftIcon={<svg width="20" height="20" viewBox="0 0 24 24"><path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>}
            size="lg"
            fullWidth
          >
            Continue with Google
          </Button>

          <Button
            variant="outline"
            onPress={() => Alert.alert('Coming soon', 'Apple sign-in will be available soon')}
            size="lg"
            fullWidth
            leftIcon={<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.697c-.439 1.04-1.61 1.825-3 1.825-1.73 0-3.228-1.292-3.6-2.897h2.31c.158.558.67.835 1.298.835.703 0 1.123-.623 1.123-1.372 0-.908-.61-1.568-1.705-1.568-1.085 0-1.808.872-1.808 2.123v1.607H7.797v-1.57c0-1.758.86-2.588 2.62-2.588 1.4 0 2.348.945 2.348 2.052 0 1.35-.945 1.76-2.378 1.76-1.225 0-2.253-.932-2.253-2.41v-1.043h-1.83V21h10.79c.32-1.924.58-3.518.58-4.303 0-2.273-1.732-3.57-4.34-3.57zm-8.43-10.034v4.52h2.65c1.1 0 1.773-1.133 1.773-2.59 0-1.74-.928-2.7-2.65-2.7zm13.54 10.034c0 3.238-2.45 5.24-7.76 5.24-4.023 0-6.68-2.167-6.68-5.877 0-4.043 2.94-6.383 7.76-6.383 3.17 0 4.807 1.21 4.807 2.72 0 1.896-1.87 3.29-4.12 3.29z"/></svg>}
            size="lg"
            fullWidth
          >
            Continue with Apple
          </Button>

          <View style={styles.footer}>
            <Text style={{ color: theme.colors.mutedForeground }}>
              By continuing, you agree to our{' '}
              <Text style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>Terms of Service</Text>{' '}
              and{' '}
              <Text style={{ color: theme.colors.primary, textDecorationLine: 'underline' }}>Privacy Policy</Text>
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F6F2' },
  scrollContent: { flexGrow: 1, padding: 24, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 60, height: 60, borderRadius: 16 },
  title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, fontWeight: '600', marginTop: 16 },
  subtitle: { color: '#6B6A63', marginTop: 8, textAlign: 'center' },
  form: { gap: 20 },
  error: { color: '#C53030', fontSize: 13, marginTop: -12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerText: { color: '#6B6A63', fontSize: 13 },
  footer: { marginTop: 24, alignItems: 'center', paddingHorizontal: 24 },
});