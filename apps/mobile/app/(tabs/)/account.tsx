/**
 * Account Screen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { useTheme } from '@nyumba254/ui';
import { useAuth, useProfile, useSignOut } from '@nyumba254/core';
import { Button, Avatar, Card, Chip } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

export default function AccountScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { session, user, profile, loading: authLoading } = useAuth();
  const { data: profileData, isLoading: profileLoading } = useProfile(user?.id);
  const { mutate: signOut, isPending: signOutPending } = useSignOut();

  const isLoading = authLoading || profileLoading;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.loading}>
          <Text style={{ color: theme.colors.mutedForeground }}>Loading...</Text>
        </View>
      </View>
    );
  }

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.guestHeader}>
            <Avatar name="Guest" size="xl" fallbackColor={theme.colors.primary} />
            <Text style={styles.guestTitle}>Welcome to Nyumba254</Text>
            <Text style={styles.guestSubtitle}>Sign in to save properties, list your own, and manage your account</Text>
          </View>
          <View style={styles.buttonGroup}>
            <Button onPress={() => navigation.navigate('Login')} size="lg" className="mb-3">
              Sign In
            </Button>
            <Button variant="outline" onPress={() => navigation.navigate('Signup')} size="lg">
              Create Account
            </Button>
          </View>
          <View style={styles.divider}>
            <Text style={styles.dividerText}>Or continue as guest</Text>
          </View>
          <Button variant="ghost" onPress={() => navigation.navigate('(tabs)')}>
            Browse Listings
          </Button>
        </ScrollView>
      </View>
    );
  }

  const displayName = profileData?.full_name || user?.user_metadata?.full_name || 'User';
  const initials = displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <Avatar
            name={displayName}
            src={profileData?.avatar_url}
            size="xl"
            fallbackColor={theme.colors.primary}
          />
          <View style={styles.profileInfo}>
            <Text style={[styles.profileName, { color: theme.colors.text }]}>{displayName}</Text>
            <Text style={[styles.profileEmail, { color: theme.colors.mutedForeground }]}>{user?.email || user?.phone}</Text>
          </View>
        </View>

        {/* Role */}
        {profileData?.account_type && (
          <View style={styles.roleSection}>
            <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>Your Role</Text>
            <View style={styles.roleChips}>
              {['buyer', 'owner', 'caretaker', 'agent', 'company'].map((role) => (
                <Chip
                  key={role}
                  label={role.charAt(0).toUpperCase() + role.slice(1)}
                  active={profileData?.account_type === role}
                  onPress={() => navigation.navigate('Settings', { section: 'role' })}
                  style={{
                    backgroundColor: profileData?.account_type === role
                      ? theme.colors.primary + '20'
                      : theme.colors.card,
                    borderColor: profileData?.account_type === role
                      ? theme.colors.primary
                      : theme.colors.border,
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {/* Quick Stats */}
        <View style={styles.statsSection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>Quick Stats</Text>
          <View style={styles.statsGrid}>
            <Card style={styles.statCard}>
              <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>Active Listings</Text>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>0</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>Saved Properties</Text>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>0</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>Messages</Text>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>0</Text>
            </Card>
            <Card style={styles.statCard}>
              <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>Viewings</Text>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>0</Text>
            </Card>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>Account</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Settings')}
            >
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Settings</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Dashboard')}
            >
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Dashboard</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('Saved')}
            >
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Saved Properties</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => navigation.navigate('PostListing')}
            >
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Post a Listing</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Support */}
        <View style={styles.menuSection}>
          <Text style={[styles.sectionLabel, { color: theme.colors.mutedForeground }]}>Support</Text>
          <Card style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Help Center</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Contact Us</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Terms of Service</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuItem}>
              <Text style={[styles.menuItemLabel, { color: theme.colors.text }]}>Privacy Policy</Text>
              <Text style={{ color: theme.colors.primary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          </Card>
        </View>

        {/* Sign Out */}
        <View style={styles.signOutSection}>
          <Button
            variant="outline"
            onPress={() => {
              Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Sign Out', onPress: () => signOut(), style: 'destructive' },
              ]);
            }}
            disabled={signOutPending}
            style={{ marginTop: 8 }}
          >
            {signOutPending ? 'Signing out...' : 'Sign Out'}
          </Button>
        </View>

        <View style={styles.version}>
          <Text style={{ color: theme.colors.mutedForeground, fontSize: 12 }}>
            Nyumba254 v1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 24 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  guestHeader: { alignItems: 'center', padding: 24, gap: 12 },
  guestTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, fontWeight: '600' },
  guestSubtitle: { textAlign: 'center', color: '#6B6A63' },
  buttonGroup: { width: '100%', gap: 12 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 16 },
  dividerText: { color: '#6B6A63', fontSize: 13 },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, fontWeight: '600' },
  profileEmail: { color: '#6B6A63', marginTop: 2 },
  roleSection: { gap: 8 },
  roleChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sectionLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  statsSection: { gap: 12 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', padding: 16 },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '700', fontFamily: 'PlayfairDisplay_700Bold' },
  menuSection: { gap: 8 },
  menuCard: { padding: 0 },
  menuItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  menuItemLabel: { fontSize: 16, fontWeight: '500' },
  signOutSection: { paddingHorizontal: 4 },
  version: { alignItems: 'center', paddingTop: 24, paddingBottom: 16 },
});