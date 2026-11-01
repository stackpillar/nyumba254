import React, { useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button, Card, Chip, H1, T } from '../components/ui';
import { THEMES, ThemeName } from '../theme/tokens';
import { useAuth } from '../lib/auth';
import { db, SUPABASE_KEY, SUPABASE_URL } from '../lib/supabase';
import AuthScreen from './AuthScreen';

const ROLES: [string, string][] = [['buyer', 'Tenant / Buyer'], ['owner', 'Direct from owner'], ['caretaker', 'Caretaker'], ['agent', 'Agent'], ['company', 'Company']];

export default function AccountScreen({ navigation }: any) {
  const { theme, setTheme } = useTheme();
  const { session, profile, signOut, refresh } = useAuth();
  const [busy, setBusy] = useState(false);

  if (!session) return <AuthScreen />;

  const setRole = (type: string) => Alert.alert('Change account type', 'Your identity check applies to one role. Changing it clears it until you verify again. Continue?', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Continue', onPress: async () => {
      const { error } = await db.rpc('change_account_type', { p_account_type: type });
      if (error) Alert.alert('Not changed', error.message); else refresh();
    } },
  ]);

  const deleteAccount = () => Alert.alert('Delete account', 'This permanently deletes your account, listings and messages. This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete forever', style: 'destructive', onPress: async () => {
      setBusy(true);
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}` } });
        if (!res.ok) { const b = await res.json().catch(() => ({})); Alert.alert('Not deleted', b.error || 'Please try again or use nyumba254.com/delete-account.'); return; }
        await signOut();
      } catch { Alert.alert('Not deleted', 'Network problem. Please try again.'); }
      finally { setBusy(false); }
    } },
  ]);

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={{ padding: 16 }}>
      <H1>{profile?.full_name ?? 'Your account'}</H1>
      <T muted style={{ marginBottom: 12 }}>{session.user.email}</T>
      <Button title="Open dashboard" onPress={() => navigation.navigate('Dashboard')} />
      <View style={{ height: 8 }} />
      <Button kind="outline" title="Post a listing" onPress={() => navigation.navigate('PostListing')} />
      <View style={{ height: 8 }} />
      <Button kind="outline" title="Support chat" onPress={() => navigation.navigate('Support')} />

      <Card style={{ marginTop: 16 }}>
        <T bold>Account type</T>
        <T small muted style={{ marginBottom: 8 }}>Shown on your listings. Identity checks apply to one role.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {ROLES.map(([k, l]) => <Chip key={k} label={l} active={profile?.account_type === k} onPress={() => profile?.account_type !== k && setRole(k)} />)}
        </View>
      </Card>

      <Card>
        <T bold style={{ marginBottom: 8 }}>Theme</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {(Object.keys(THEMES) as ThemeName[]).map((n) => <Chip key={n} label={THEMES[n].label} active={theme.name === n} onPress={() => setTheme(n)} />)}
        </View>
      </Card>

      <Button kind="outline" title="Sign out" onPress={signOut} />
      <View style={{ height: 8 }} />
      <Button kind="outline" title="Privacy policy" onPress={() => Linking.openURL('https://nyumba254.com/privacy')} />
      <View style={{ height: 8 }} />
      <Button kind="danger" title="Delete my account" onPress={deleteAccount} loading={busy} />
    </ScrollView>
  );
}
