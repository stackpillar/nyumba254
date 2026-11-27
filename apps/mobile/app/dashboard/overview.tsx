/**
 * Dashboard Overview Screen
 */

import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useTheme } from '@nyumba254/ui';
import { useAuth, useProfile } from '@nyumba254/core';
import { Card, Button, Chip, Avatar, Badge } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

export default function DashboardOverviewScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { session, user } = useAuth();
  const { data: profile } = useProfile(user?.id);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (!session) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Sign in to open your dashboard</Text>
          <Text style={[styles.emptySubtitle, { color: theme.colors.mutedForeground }]}>Manage your listings, messages, and viewings</Text>
          <Button onPress={() => navigation.navigate('Login')} size="lg" className="mt-4">
            Sign In
          </Button>
        </View>
      </View>
    );
  }

  const displayName = profile?.full_name || user?.user_metadata?.full_name || 'there';
  const firstName = displayName.split(' ')[0];

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.colors.primary} />
        }
      >
        {/* Welcome Header */}
        <View style={styles.welcomeHeader}>
          <View style={styles.welcomeInfo}>
            <Text style={[styles.welcomeGreeting, { color: theme.colors.mutedForeground }]}>Hello,</Text>
            <Text style={[styles.welcomeName, { color: theme.colors.text }]}>{firstName}</Text>
          </View>
          <Button onPress={() => navigation.navigate('PostListing')} size="lg" variant="primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Post Listing
          </Button>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Active Listings"
            value="0"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            onPress={() => navigation.navigate('DashboardListings')}
            color={theme.colors.primary}
          />
          <StatCard
            label="Total Enquiries"
            value="0"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
            onPress={() => navigation.navigate('DashboardMessages')}
            color={theme.colors.secondary}
          />
          <StatCard
            label="Unread Messages"
            value="0"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>}
            onPress={() => navigation.navigate('DashboardMessages')}
            color={theme.colors.amber}
          />
          <StatCard
            label="Viewings"
            value="0"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h3M8 17h6"/></svg>}
            onPress={() => navigation.navigate('DashboardViewings')}
            color={theme.colors.purple}
          />
        </View>

        {/* Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Quick Actions</Text>
        </View>

        <View style={styles.actionGrid}>
          <ActionCard
            title="My Listings"
            subtitle="Manage your properties"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>}
            onPress={() => navigation.navigate('DashboardListings')}
          />
          <ActionCard
            title="Messages"
            subtitle="Chat with buyers"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>}
            badge={0}
            onPress={() => navigation.navigate('DashboardMessages')}
          />
          <ActionCard
            title="Enquiries"
            subtitle="New buyer enquiries"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>}
            badge={0}
            onPress={() => navigation.navigate('DashboardEnquiries')}
          />
          <ActionCard
            title="Viewings"
            subtitle="Manage viewing requests"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><rect x="3" y="4" width="18" height="17" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h3M8 17h6"/></svg>}
            badge={0}
            onPress={() => navigation.navigate('DashboardViewings')}
          />
        </View>

        {/* Lister Page Promo */}
        <View style={styles.promoCard}>
          <View style={styles.promoIcon}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M3 9h18M8 4v5M16 4v5" />
            </svg>
          </View>
          <View style={styles.promoText}>
            <Text style={[styles.promoTitle, { color: theme.colors.text }]}>Your Lister Page</Text>
            <Text style={[styles.promoSubtitle, { color: theme.colors.mutedForeground }]}>One link for all your properties. Share it anywhere.</Text>
          </View>
          <Button variant="outline" size="sm" onPress={() => navigation.navigate('DashboardListerPage')}>
            Set up your page
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

function StatCard({ label, value, icon, onPress, color }: any) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        {icon}
      </View>
      <Text style={[styles.statLabel, { color: theme.colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.statValue, { color: theme.colors.text }]}>{value}</Text>
    </TouchableOpacity>
  );
}

function ActionCard({ title, subtitle, icon, badge, onPress }: any) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} style={styles.actionCard}>
      <View style={[styles.actionIcon, { backgroundColor: theme.colors.primary + '20' }]}>
        {icon}
      </View>
      <View style={styles.actionText}>
        <Text style={[styles.actionTitle, { color: theme.colors.text }]}>{title}</Text>
        <Text style={[styles.actionSubtitle, { color: theme.colors.mutedForeground }]}>{subtitle}</Text>
      </View>
      {badge !== undefined && badge > 0 && (
        <View style={styles.actionBadge}>
          <Text style={styles.actionBadgeText}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40, gap: 24 },
  welcomeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  welcomeInfo: { flex: 1 },
  welcomeGreeting: { color: '#6B6A63' },
  welcomeName: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  statCard: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 16 },
  statIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statLabel: { fontSize: 12, marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: '700', fontFamily: 'PlayfairDisplay_700Bold' },
  sectionHeader: { marginBottom: 12 },
  sectionTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, fontWeight: '600' },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  actionCard: { flex: 1, minWidth: '45%', padding: 16, borderRadius: 16, borderWidth: 1 },
  actionIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  actionText: { flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 2 },
  actionSubtitle: { fontSize: 12 },
  actionBadge: { position: 'absolute', top: 8, right: 8, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#C53030', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  actionBadgeText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  promoCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 16, borderWidth: 1 },
  promoIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  promoText: { flex: 1 },
  promoTitle: { fontSize: 16, fontWeight: '600' },
  promoSubtitle: { fontSize: 13, marginTop: 2 },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '600', textAlign: 'center' },
  emptySubtitle: { textAlign: 'center' },
});