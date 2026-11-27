/**
 * Listings Screen - Browse/Search
 */

import React, { useState, useEffect, useCallback } from 'react';
import { FlatList, View, Text, TouchableOpacity, StyleSheet, RefreshControl, Keyboard } from 'react-native';
import { useTheme } from '@nyumba254/ui';
import { ListingCard, SearchBox, Select, Chip, SkeletonListing, Button } from '@nyumba254/ui';
import { searchListings } from '@nyumba254/core';
import { cn } from '@nyumba254/design-system';

const categories = [
  { value: '', label: 'All categories' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'boarding', label: 'Boarding House' },
  { value: 'airbnb', label: 'Airbnb / Holiday Rental' },
  { value: 'commercial', label: 'Shops & Offices' },
];

const counties = [
  { value: '', label: 'All counties' },
  { value: 'Nairobi', label: 'Nairobi' },
  { value: 'Mombasa', label: 'Mombasa' },
  { value: 'Kisumu', label: 'Kisumu' },
  { value: 'Nakuru', label: 'Nakuru' },
  { value: 'Eldoret', label: 'Eldoret' },
  { value: 'Thika', label: 'Thika' },
  { value: 'Machakos', label: 'Machakos' },
];

const budgets = [
  { value: '', label: 'Any budget' },
  { value: '10000', label: 'Under 10K' },
  { value: '30000', label: '10K–30K' },
  { value: '80000', label: '30K–80K' },
  { value: '80001', label: '80K+' },
];

const beds = [
  { value: '', label: 'Any beds' },
  { value: '0', label: 'Studio' },
  { value: '1', label: '1 bed' },
  { value: '2', label: '2 beds' },
  { value: '3', label: '3 beds' },
  { value: '4', label: '4+ beds' },
];

const sortOptions = [
  { value: '', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
];

export default function ListingsScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const [query, setQuery] = useState(route.params?.query || '');
  const [filters, setFilters] = useState({
    category: route.params?.category || '',
    county: '',
    maxPrice: '',
    beds: '',
    sort: '',
  });
  const [rows, setRows] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const r = await searchListings(filters, reset ? 1 : page, 12);
      if (reset) {
        setRows(r.rows);
      } else {
        setRows((prev) => [...(prev || []), ...r.rows]);
      }
      setHasMore(r.hasMore);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filters, page]);

  useEffect(() => {
    load(true);
  }, [filters.category, filters.county, filters.maxPrice, filters.beds, filters.sort]);

  const handleSearch = () => {
    Keyboard.dismiss();
    setPage(1);
    load(true);
  };

  const handleLoadMore = () => {
    setPage((p) => p + 1);
    load(false);
  };

  if (!rows) {
    return (
      <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <FlatList
          data={[1, 2, 3, 4, 5, 6]}
          keyExtractor={(_, i) => String(i)}
          renderItem={() => <SkeletonListing />}
          contentContainerStyle={styles.listContent}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.searchBar}>
        <SearchBox
          query={query}
          onQueryChange={setQuery}
          onSearch={handleSearch}
          filters={filters}
          onFilterChange={(filter, value) => setFilters((prev) => ({ ...prev, [filter]: value }))}
          counties={counties}
          areas={[]}
          budgets={budgets}
          beds={beds}
          placeholder="Search area or keyword..."
        />
      </View>

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        data={rows}
        keyExtractor={(l) => l.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={theme.colors.primary}
          />
        }
        renderItem={({ item }) => (
          <ListingCard
            l={item}
            onPress={() => navigation.navigate('Listing', { id: item.id })}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: theme.colors.mutedForeground }}>No listings found</Text>
            <Button title="Clear filters" variant="outline" size="sm" onPress={() => {
              setFilters({ category: '', county: '', maxPrice: '', beds: '', sort: '' });
              setQuery('');
              handleSearch();
            }} />
          </View>
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  list: { flex: 1 },
  listContent: { padding: 16, paddingBottom: 100 },
  searchBar: { padding: 16, paddingBottom: 8 },
  empty: { padding: 40, alignItems: 'center', gap: 12 },
});