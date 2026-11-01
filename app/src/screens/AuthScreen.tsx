import React, { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button, Card, Field, H1, T } from '../components/ui';
import { db } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const SITE = 'https://nyumba254.com';

export default function AuthScreen() {
  const { theme } = useTheme();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState('');

  const normPhone = (v: string) => { const d = v.replace(/[^\d+]/g, ''); return d.startsWith('+') ? d : d.startsWith('0') ? '+254' + d.slice(1) : d.startsWith('254') ? '+' + d : '+254' + d; };
  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());

  const submit = async () => {
    setInfo('');
    if (!validEmail) return setInfo('Enter a valid email.');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await db.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) setInfo(/confirm/i.test(error.message) ? 'Please confirm your email first. Check your inbox.' : 'Email or password is not correct.');
      } else if (mode === 'register') {
        if (!first.trim() || !last.trim()) return setInfo('Enter your first and last name.');
        if (!/^\+\d{9,15}$/.test(normPhone(phone))) return setInfo('Enter a valid phone number.');
        if (pw.length < 8) return setInfo('Password must be at least 8 characters.');
        if (pw !== pw2) return setInfo('Passwords do not match.');
        const p = normPhone(phone);
        const { data, error } = await db.auth.signUp({ email: email.trim(), password: pw, options: { data: { full_name: `${first.trim()} ${last.trim()}`, phone: p }, emailRedirectTo: `${SITE}/verify-email` } });
        if (error) return setInfo(error.message.includes('already registered') ? 'An account with this email already exists. Try signing in.' : error.message);
        if (data.user && data.user.identities?.length === 0) return setInfo('An account with this email already exists. Try signing in.');
        if (data.user) await db.from('profiles').upsert({ id: data.user.id, full_name: `${first.trim()} ${last.trim()}`, phone: p, email: email.trim() });
        setInfo('Account created. Check your email to confirm it, then sign in.'); setMode('login');
      } else {
        const { error } = await db.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${SITE}/reset-confirm` });
        setInfo(error ? error.message : 'If that email has an account, a reset link is on its way.');
      }
    } catch { setInfo('Network problem. Check your connection and try again.'); }
    finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
      <H1 style={{ marginBottom: 4 }}>{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset password'}</H1>
      <T muted style={{ marginBottom: 16 }}>{mode === 'register' ? 'Pick your role after you sign in.' : 'Sign in to save listings and manage yours.'}</T>
      {mode === 'register' ? (<>
        <Field label="First name" value={first} onChangeText={setFirst} />
        <Field label="Last name" value={last} onChangeText={setLast} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" placeholder="0712 345 678" />
      </>) : null}
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      {mode !== 'reset' ? <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoCapitalize="none" /> : null}
      {mode === 'register' ? <Field label="Confirm password" value={pw2} onChangeText={setPw2} secureTextEntry autoCapitalize="none" /> : null}
      {info ? <T style={{ color: /created|on its way/.test(info) ? theme.green : theme.red, marginBottom: 10 }}>{info}</T> : null}
      <Button title={mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Send reset link'} onPress={submit} loading={busy} />
      <View style={{ height: 12 }} />
      {mode === 'register' ? <T small muted style={{ marginBottom: 8 }}>By creating an account you agree to the Terms and Privacy Policy.</T> : null}
      {mode !== 'login' ? <Button kind="outline" title="Back to sign in" onPress={() => setMode('login')} /> : (<>
        <Button kind="outline" title="Create an account" onPress={() => setMode('register')} />
        <View style={{ height: 8 }} />
        <Button kind="outline" title="Forgot password?" onPress={() => setMode('reset')} />
      </>)}
      <View style={{ height: 16 }} />
      <Button kind="outline" title="Privacy policy" onPress={() => Linking.openURL(`${SITE}/privacy`)} />
    </ScrollView>
  );
}
void Alert;
