/**
 * Home Screen
 */

import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image as RNImage, RefreshControl, View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { useTheme } from '@nyumba254/ui';
import { ListingCard, CategoryCard, SearchBox, SkeletonListing, Button, Chip } from '@nyumba254/ui';
import { getLatestListings } from '@nyumba254/core';
import { CATEGORIES } from '@nyumba254/core';
import { cn } from '@nyumba254/design-system';

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [rows, setRows] = useState<any[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await getLatestListings(12);
      setRows(r);
      setOffline(false);
    } catch {
      setRows([]);
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (!rows) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={[1, 2, 3]}
          keyExtractor={(_, i) => String(i)}
          renderItem={() => <SkeletonListing />}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(l) => l.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
            tintColor={theme.colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <RNImage source={require('../../assets/icon.png')} style={styles.logo} resizeMode="contain" />
              <Text style={[styles.title, { color: theme.colors.text }]}>Nyumba254</Text>
            </View>
            <Text style={[styles.subtitle, { color: theme.colors.mutedForeground }]}>Find homes in Kenya and see who is behind each listing.</Text>
            <View style={styles.categories}>
              {Object.entries(CATEGORIES).map(([k, v]) => (
                <Chip
                  key={k}
                  label={v.label}
                  onPress={() => navigation.navigate('Listings', { category: k })}
                  style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border }}
                />
              ))}
            </View>
            {offline && (
              <View style={[styles.offlineBanner, { backgroundColor: theme.colors.amber + '20', borderColor: theme.colors.amber }]}>
                <Text style={{ color: theme.colors.amber, fontWeight: '600' }}>You are offline</Text>
                <Text style={{ color: theme.colors.amber, fontSize: 13 }}>Showing your last saved results.</Text>
                <Button title="Retry" variant="outline" size="sm" onPress={load} />
              </View>
            )}
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Recently added</Text>
          </View>
        }
        renderItem={({ item }) => (
          <ListingCard
            l={item}
            onPress={() => navigation.navigate('Listing', { id: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.colors.mutedForeground }}>No listings to show yet.</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16 },
  header: { marginBottom: 12 },
  headerTop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  logo: { width: 36, height: 36, borderRadius: 8 },
  title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, fontWeight: '600' },
  subtitle: { marginBottom: 12 },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  offlineBanner: { padding: 12, borderRadius: 10, marginBottom: 12, gap: 8, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  sectionTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, fontWeight: '600', marginBottom: 8 },
  empty: { padding: 40, alignItems: 'center' },
});