import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button, Card, Chip, Empty, H1, Loading, T } from '../components/ui';
import { db } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { formatPrice, Listing } from '../lib/data';

type Tab = 'overview' | 'listings' | 'messages' | 'enquiries' | 'viewings' | 'notifications' | 'verify' | 'plans';
const TABS: [Tab, string][] = [['overview', 'Overview'], ['listings', 'My listings'], ['messages', 'Messages'], ['enquiries', 'Enquiries'], ['viewings', 'Viewings'], ['notifications', 'Notifications'], ['verify', 'Verify'], ['plans', 'Plans']];
const ago = (d: string) => new Date(d).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' });

export default function DashboardScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { session, profile } = useAuth();
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [listings, setListings] = useState<Listing[]>([]);
  const [enq, setEnq] = useState<any[]>([]);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [views, setViews] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const uid = session?.user.id;

  const load = useCallback(async () => {
    if (!uid) return;
    const { data: ls } = await db.from('listings').select('*, listing_photos(*), listing_videos(id)').eq('seller_id', uid).order('created_at', { ascending: false });
    const L = (ls ?? []) as Listing[];
    setListings(L);
    const ids = L.map((l) => l.id);
    const since = new Date(Date.now() - 90 * 864e5).toISOString();
    const [e, m, v, n, p] = await Promise.all([
      ids.length ? db.from('enquiries').select('*, listings(title, area)').in('listing_id', ids).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      ids.length ? db.from('messages').select('*').in('listing_id', ids).gte('created_at', since).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      ids.length ? db.from('viewing_requests').select('*').in('listing_id', ids).order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
      db.from('notifications').select('*').eq('seller_id', uid).order('created_at', { ascending: false }).limit(30),
      db.rpc('get_public_plan_matrix'),
    ]);
    setEnq((e as any).data ?? []); setMsgs((m as any).data ?? []); setViews((v as any).data ?? []); setNotes((n as any).data ?? []); setPlans(((p as any).data ?? []) as any[]);
    setLoading(false);
  }, [uid]);
  useEffect(() => { load(); }, [load]);

  if (!session) return <Empty text="Sign in to open your dashboard." />;
  if (loading) return <Loading />;

  const unreadNotes = notes.filter((n) => !n.is_read).length;
  const title: Record<string, string> = Object.fromEntries(listings.map((l) => [l.id, l.title]));

  const markRead = async () => {
    await db.from('notifications').update({ is_read: true }).eq('seller_id', uid!).in('id', notes.filter((n) => !n.is_read).map((n) => n.id));
    load();
  };
  const setViewing = async (id: string, status: string) => {
    const { error } = await db.from('viewing_requests').update({ status }).eq('id', id);
    if (error) Alert.alert('Not updated', 'Please try again.'); else load();
  };

  const row = (key: string, top: string, sub: string, extra?: React.ReactNode) => (
    <Card key={key}><T bold>{top}</T><T small muted style={{ marginTop: 2 }}>{sub}</T>{extra}</Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {TABS.map(([k, l]) => <Chip key={k} label={k === 'notifications' && unreadNotes ? `${l} (${unreadNotes})` : l} active={tab === k} onPress={() => setTab(k)} />)}
      </ScrollView>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {tab === 'overview' ? (<>
          <H1 style={{ marginBottom: 12 }}>Hello, {profile?.full_name?.split(' ')[0] ?? 'there'}</H1>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            {[['Listings', listings.length], ['Live', listings.filter((l) => l.status === 'active').length], ['Enquiries', enq.length], ['Viewings', views.length]].map(([k, v]) => (
              <Card key={String(k)} style={{ width: '47%', marginBottom: 0 }}><T small muted>{k}</T><H1>{String(v)}</H1></Card>
            ))}
          </View>
          <View style={{ height: 14 }} />
          <Button title="Post a listing" onPress={() => navigation.navigate('PostListing')} />
        </>) : null}

        {tab === 'listings' ? (listings.length ? listings.map((l) => (
          <Card key={l.id}>
            <T bold>{l.title}</T><T small muted>{l.area} · {formatPrice(l)}</T>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}><Chip label={l.status} tone={l.status === 'active' ? 'green' : 'muted'} /></View>
            <Button kind="outline" style={{ marginTop: 10 }} title="View" onPress={() => navigation.navigate('Listing', { id: l.id })} />
          </Card>
        )) : <Empty text="You have no listings yet." />) : null}

        {tab === 'messages' ? (msgs.length ? msgs.map((m) => row(m.id, title[m.listing_id] ?? 'Listing', `${ago(m.created_at)} · ${m.sender ?? ''}`, <T style={{ marginTop: 6 }}>{m.body ?? m.message}</T>)) : <Empty text="No messages in the last 90 days." />) : null}

        {tab === 'enquiries' ? (enq.length ? enq.map((e) => row(e.id, e.buyer_name ?? 'Enquiry', `${e.listings?.title ?? ''} · ${ago(e.created_at)}`, <><T style={{ marginTop: 6 }}>{e.message}</T>{e.buyer_phone ? <Button kind="outline" style={{ marginTop: 8 }} title={`Call ${e.buyer_phone}`} onPress={() => Linking.openURL(`tel:${e.buyer_phone}`)} /> : null}</>)) : <Empty text="No enquiries yet." />) : null}

        {tab === 'viewings' ? (views.length ? views.map((v) => row(v.id, `${v.buyer_name} · ${v.requested_date} ${v.requested_time}`, `${title[v.listing_id] ?? ''} · ${v.status ?? 'pending'}`, (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button style={{ flex: 1 }} title="Confirm" onPress={() => setViewing(v.id, 'confirmed')} />
            <Button style={{ flex: 1 }} kind="outline" title="Decline" onPress={() => setViewing(v.id, 'declined')} />
          </View>
        ))) : <Empty text="No viewing requests yet." />) : null}

        {tab === 'notifications' ? (<>
          {unreadNotes ? <Button kind="outline" title="Mark all read" onPress={markRead} style={{ marginBottom: 12 }} /> : null}
          {notes.length ? notes.map((n) => row(n.id, n.title ?? 'Notification', ago(n.created_at), <T style={{ marginTop: 6 }}>{n.message ?? n.body}</T>)) : <Empty text="No notifications." />}
        </>) : null}

        {tab === 'verify' ? (
          <Card>
            <T bold>Identity check</T>
            <T style={{ marginTop: 6 }}>Status: {profile?.identity_verified ? 'Identity checked' : profile?.verification_status ?? 'Not verified'}</T>
            <T small muted style={{ marginTop: 6 }}>We check who you are, not whether you own the property. Upload your ID securely on the website.</T>
            <Button style={{ marginTop: 10 }} title="Verify identity" onPress={() => Linking.openURL('https://nyumba254.com/kyc?source=app')} />
          </Card>
        ) : null}

        {tab === 'plans' ? (<>
          <T muted style={{ marginBottom: 10 }}>One active Premium or Elite plan covers listings in every category.</T>
          {plans.length ? plans.map((p, i) => row(String(p.key ?? i), String(p.label ?? p.key ?? 'Feature'), '', <T small style={{ marginTop: 4 }}>Free: {String(p.free ?? '-')}  ·  Premium: {String(p.premium ?? '-')}  ·  Elite: {String(p.elite ?? '-')}</T>)) : null}
          <Button title="Manage plan on the website" onPress={() => Linking.openURL('https://nyumba254.com/dashboard#plans')} />
        </>) : null}
      </ScrollView>
    </View>
  );
}
