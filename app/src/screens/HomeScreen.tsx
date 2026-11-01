import React, { useCallback, useEffect, useState } from 'react';
import { FlatList, Image as RNImage, Pressable, RefreshControl, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTheme } from '../theme/ThemeContext';
import { Button, Chip, Empty, H1, Loading, T } from '../components/ui';
import { ListingCard } from '../components/ListingCard';
import { CATEGORIES, Listing, latestListings } from '../lib/data';
import { getJSON, setJSON } from '../lib/storage';

export default function HomeScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [offline, setOffline] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await latestListings(12);
      setRows(r); setOffline(false);
      setJSON('home-cache', { at: Date.now(), rows: r });
    } catch {
      const c = await getJSON<{ rows: Listing[] } | null>('home-cache', null);
      setRows(c?.rows ?? []); setOffline(true);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => NetInfo.addEventListener((s) => { if (s.isConnected && offline) load(); }), [offline, load]);

  if (!rows) return <Loading />;
  return (
    <FlatList
      style={{ backgroundColor: theme.surface }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(l) => l.id}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={theme.green} />}
      ListHeaderComponent={
        <View style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <RNImage source={require('../../assets/icon.png')} style={{ width: 36, height: 36, borderRadius: 8 }} />
            <H1>Nyumba254</H1>
          </View>
          <T muted style={{ marginBottom: 12 }}>Find homes in Kenya and see who is behind each listing.</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {Object.entries(CATEGORIES).map(([k, v]) => (
              <Chip key={k} label={v.label} onPress={() => navigation.navigate('Search', { category: k })} />
            ))}
          </View>
          {offline ? (
            <View style={{ backgroundColor: theme.amberLight, borderRadius: 10, padding: 12, marginBottom: 12, gap: 8 }}>
              <T bold style={{ color: theme.amber }}>You are offline</T>
              <T small style={{ color: theme.amber }}>Showing your last saved results.</T>
              <Button title="Retry" kind="outline" onPress={load} />
            </View>
          ) : null}
          <H1 style={{ fontSize: 20 }}>Recently added</H1>
        </View>
      }
      renderItem={({ item }) => <ListingCard l={item} onPress={() => navigation.navigate('Listing', { id: item.id })} />}
      ListEmptyComponent={<Empty text="No listings to show yet." />}
    />
  );
}
