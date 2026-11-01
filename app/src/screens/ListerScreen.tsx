import React, { useEffect, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Chip, Empty, H1, Loading, T } from '../components/ui';
import { ListingCard } from '../components/ListingCard';
import { fetchListerByHandle } from '../lib/data';

const ROLE: Record<string, string> = { buyer: 'Tenant / Buyer', owner: 'Owner', landlord: 'Owner', caretaker: 'Caretaker', agent: 'Agent', company: 'Company', seller: 'Lister' };

export default function ListerScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const [d, setD] = useState<any>(undefined);
  useEffect(() => { fetchListerByHandle(route.params.handle).then(setD).catch(() => setD(null)); }, [route.params.handle]);
  if (d === undefined) return <Loading />;
  if (!d || d.profile.page_visibility === 'hidden') return <Empty text="This Lister Page is not available." />;
  const p = d.profile;
  const checked = !!p.identity_verified && p.verified_role === p.account_type;
  return (
    <FlatList style={{ backgroundColor: theme.surface }} contentContainerStyle={{ padding: 16 }} data={d.listings} keyExtractor={(l: any) => l.id}
      ListHeaderComponent={
        <View style={{ marginBottom: 14 }}>
          <H1>{p.full_name ?? 'Lister'}</H1>
          <T muted>@{p.page_handle}</T>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
            <Chip label={ROLE[p.account_type] ?? 'Lister'} tone="muted" />
            {checked ? <Chip label="Identity checked" tone="green" /> : null}
          </View>
        </View>
      }
      renderItem={({ item }) => <ListingCard l={item} onPress={() => navigation.navigate('Listing', { id: item.id })} />}
      ListEmptyComponent={<Empty text="No active listings right now." />} />
  );
}
