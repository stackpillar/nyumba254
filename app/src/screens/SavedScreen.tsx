import React, { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Empty, Loading } from '../components/ui';
import { ListingCard } from '../components/ListingCard';
import { Listing, fetchListingsByIds } from '../lib/data';
import { getJSON, getSaved, setJSON } from '../lib/storage';

export default function SavedScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [rows, setRows] = useState<Listing[] | null>(null);
  const [stale, setStale] = useState(false);

  useFocusEffect(useCallback(() => {
    (async () => {
      const ids = await getSaved();
      try {
        const r = await fetchListingsByIds(ids);
        setRows(r); setStale(false); setJSON('saved-cache', r);
      } catch {
        setRows(await getJSON<Listing[]>('saved-cache', [])); setStale(true);
      }
    })();
  }, []));

  if (!rows) return <Loading />;
  return (
    <FlatList style={{ backgroundColor: theme.surface }} contentContainerStyle={{ padding: 16 }} data={rows} keyExtractor={(l) => l.id}
      ListHeaderComponent={stale ? <Empty text="You are offline. Showing your last saved list." /> : undefined}
      renderItem={({ item }) => <ListingCard l={item} onPress={() => navigation.navigate('Listing', { id: item.id })} />}
      ListEmptyComponent={<Empty text="Nothing saved yet. Tap Save on a listing." />} />
  );
}
