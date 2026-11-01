import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button, Chip, Empty, Field, Loading, T } from '../components/ui';
import { ListingCard } from '../components/ListingCard';
import { CATEGORIES, EMPTY_FILTERS, Filters, Listing, PAGE_SIZE, searchListings } from '../lib/data';
import { getJSON, setJSON } from '../lib/storage';

const FEE = [['', 'Any fee'], ['free', 'Free viewing']] as const;
const LISTED = [['', 'Anyone'], ['owner', 'Owner'], ['caretaker', 'Caretaker'], ['agent', 'Agent'], ['company', 'Company']] as const;

export default function SearchScreen({ navigation, route }: any) {
  const { theme } = useTheme();
  const [f, setF] = useState<Filters>({ ...EMPTY_FILTERS, category: route.params?.category ?? '' });
  const [rows, setRows] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState(false);
  const [showF, setShowF] = useState(false);
  const seq = useRef(0);

  const run = useCallback(async (filters: Filters, p: number, append: boolean) => {
    const my = ++seq.current;
    setBusy(true); setErr(false);
    try {
      const r = await searchListings(filters, p);
      if (my !== seq.current) return;
      setRows((cur) => (append ? [...cur, ...r.rows] : r.rows)); setTotal(r.total); setPage(p);
      if (!append && p === 1) setJSON('search-cache', { f: filters, rows: r.rows, total: r.total });
    } catch {
      if (my !== seq.current) return;
      setErr(true);
      if (!append) { const c = await getJSON<any>('search-cache', null); if (c) { setRows(c.rows); setTotal(c.total); } }
    } finally { if (my === seq.current) setBusy(false); }
  }, []);

  useEffect(() => { run(f, 1, false); }, [f.category, f.freq, f.viewingFee, f.listedBy, f.sort]);
  useEffect(() => { if (route.params?.category !== undefined) setF((x) => ({ ...x, category: route.params.category })); }, [route.params?.category]);

  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));

  return (
    <FlatList
      style={{ backgroundColor: theme.surface }}
      contentContainerStyle={{ padding: 16 }}
      data={rows}
      keyExtractor={(l) => l.id}
      ListHeaderComponent={
        <View style={{ marginBottom: 8 }}>
          <Field label="Search" value={f.q} onChangeText={(q) => set({ q })} placeholder="Area, estate or keyword" returnKeyType="search" onSubmitEditing={() => run(f, 1, false)} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 8 }}>
            <Chip label="All" active={!f.category} onPress={() => set({ category: '' })} />
            {Object.entries(CATEGORIES).map(([k, v]) => <Chip key={k} label={v.label} active={f.category === k} onPress={() => set({ category: k })} />)}
          </ScrollView>
          <Chip label={showF ? 'Hide filters' : 'More filters'} tone="muted" onPress={() => setShowF((s) => !s)} />
          {showF ? (
            <View style={{ marginTop: 10 }}>
              <T bold small style={{ marginBottom: 6 }}>Viewing fee</T>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>{FEE.map(([k, l]) => <Chip key={k} label={l} active={f.viewingFee === k} onPress={() => set({ viewingFee: k })} />)}</View>
              <T bold small style={{ marginBottom: 6 }}>Listed by</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>{LISTED.map(([k, l]) => <Chip key={k} label={l} active={f.listedBy === k} onPress={() => set({ listedBy: k })} />)}</View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Field label="Min price" keyboardType="number-pad" value={f.minPrice} onChangeText={(minPrice) => set({ minPrice })} /></View>
                <View style={{ flex: 1 }}><Field label="Max price" keyboardType="number-pad" value={f.maxPrice} onChangeText={(maxPrice) => set({ maxPrice })} /></View>
              </View>
              <Button title="Apply" onPress={() => run(f, 1, false)} />
            </View>
          ) : null}
          <T small muted style={{ marginTop: 10 }}>{busy && !rows.length ? 'Searching…' : `${total} listing${total === 1 ? '' : 's'}`}</T>
          {err ? <T small style={{ color: theme.red, marginTop: 4 }}>Could not refresh. Showing the last results we have.</T> : null}
        </View>
      }
      renderItem={({ item }) => <ListingCard l={item} onPress={() => navigation.navigate('Listing', { id: item.id })} />}
      onEndReachedThreshold={0.4}
      onEndReached={() => { if (!busy && rows.length < total) run(f, page + 1, true); }}
      ListFooterComponent={busy && rows.length ? <Loading /> : undefined}
      ListEmptyComponent={busy ? <Loading /> : <Empty text="No listings match these filters." />}
    />
  );
}
void PAGE_SIZE;
