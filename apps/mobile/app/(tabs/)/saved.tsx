/**
 * Saved Screen
 */

import React, { useState, useEffect } from 'react';
import { FlatList, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@nyumba254/ui';
import { ListingCard, SkeletonListing, Empty } from '@nyumba254/ui';

export default function SavedScreen({ navigation }: any) {
  const { theme } = useTheme();
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // In production, fetch saved listings from API
    setTimeout(() => {
      setRows([]);
      setLoading(false);
    }, 500);
  }, []);

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
        renderItem={({ item }) => (
          <ListingCard
            l={item}
            onPress={() => navigation.navigate('Listing', { id: item.id })}
          />
        )}
        ListEmptyComponent={
          <Empty text="No saved properties yet. Tap the heart on a listing to save it." />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16 },
});