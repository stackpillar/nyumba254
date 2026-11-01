import React, { useEffect, useRef, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../theme/ThemeContext';
import { Button, Chip, Empty, Field, H1, T } from '../components/ui';
import { db } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { CATEGORIES } from '../lib/data';
import { getJSON, setJSON } from '../lib/storage';

type Draft = { step: number; category: string; title: string; description: string; price: string; freq: string; county: string; area: string; bedrooms: string; phone: string; viewingFee: string; photos: string[]; agree: boolean; listingId?: string };
const EMPTY: Draft = { step: 1, category: '', title: '', description: '', price: '', freq: 'month', county: '', area: '', bedrooms: '', phone: '', viewingFee: '0', photos: [], agree: false };
const FREQS = [['month', 'Per month'], ['night', 'Per night'], ['week', 'Per week'], ['term', 'Per term'], ['once', 'Once (sale)']] as const;
const DRAFT_KEY = 'post-draft-v1';

export default function PostListingScreen({ navigation }: any) {
  const { theme } = useTheme();
  const { session, profile } = useAuth();
  const [d, setD] = useState<Draft>(EMPTY);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feeEligible = ['agent', 'company'].includes(profile?.account_type ?? '');

  // Draft autosave: on this device immediately, and to listing_drafts (same table as the website) after a pause.
  useEffect(() => { getJSON<Draft | null>(DRAFT_KEY, null).then((x) => { if (x) setD(x); setReady(true); }); }, []);
  useEffect(() => {
    if (!ready) return;
    setJSON(DRAFT_KEY, d);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (session) db.from('listing_drafts').upsert({ seller_id: session.user.id, draft_data: { ...d, source: 'app' }, updated_at: new Date().toISOString() }, { onConflict: 'seller_id' }).then(() => {}, () => {});
    }, 4000);
  }, [d, ready, session]);

  if (!session) return <Empty text="Sign in to post a listing." />;
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));

  const pick = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.8, selectionLimit: 12 });
    if (!r.canceled) set({ photos: [...d.photos, ...r.assets.map((a) => a.uri)].slice(0, 12) });
  };

  const validate = (s: number) => {
    if (s === 1 && !d.category) return 'Choose a category.';
    if (s === 2 && (d.title.trim().length < 5 || !d.county.trim() || !d.area.trim() || !(Number(d.price) > 0))) return 'Add a title, county, area and price.';
    if (s === 3 && d.photos.length < 1) return 'Add at least one photo.';
    if (s === 4 && (!d.phone.trim() || !d.agree)) return 'Add your phone and accept the Terms and Privacy Policy.';
    return '';
  };
  const next = () => { const e = validate(d.step); if (e) return Alert.alert('Almost there', e); set({ step: d.step + 1 }); };

  const submit = async () => {
    const e = validate(4); if (e) return Alert.alert('Almost there', e);
    setBusy(true);
    try {
      const uid = session.user.id;
      const { data: can, error: ce } = await db.rpc('can_create_listing', { p_profile_id: uid });
      if (ce) throw new Error('Could not check your listing allowance.');
      const ok = Array.isArray(can) ? can[0]?.allowed ?? can[0] : can;
      if (ok === false || (ok && typeof ok === 'object' && ok.allowed === false)) { Alert.alert('Listing limit reached', 'Verify your identity or choose a plan to list more.'); return; }
      const phone = d.phone.replace(/[^\d+]/g, '').replace(/^0/, '+254').replace(/^254/, '+254');
      let id = d.listingId;
      if (!id) {
        const { data: row, error } = await db.from('listings').insert({
          title: d.title.trim(), description: d.description.trim(), price: Number(d.price), price_frequency: d.freq, price_type: d.freq === 'once' ? 'sale' : 'rent',
          category: d.category, county: d.county.trim(), area: d.area.trim(), address: '', amenities: [], details: d.bedrooms ? { bedrooms: d.bedrooms } : {},
          contact_name: profile?.full_name ?? '', phone, whatsapp: phone, contact_email: session.user.email, contact_hidden: false,
          status: 'pending', payment_status: 'unpaid', seller_id: uid, views: 0, is_live: false,
        }).select().single();
        if (error) throw error;
        id = row.id; set({ listingId: id });
      }
      if (feeEligible) {
        const fee = Math.max(0, Math.min(5000, parseInt(d.viewingFee || '0', 10) || 0));
        await db.rpc('set_listing_viewing_fees', { p_listing_ids: [id], p_viewing_fee: fee });
      }
      const urls: string[] = [];
      for (let i = 0; i < d.photos.length; i++) {
        const blob = await (await fetch(d.photos[i])).blob();
        const path = `${id}/${Date.now()}-${i}.jpg`;
        const { error } = await db.storage.from('listing-photos').upload(path, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
        if (error) throw new Error(`Photo ${i + 1} failed to upload. Check your connection and tap Submit again.`);
        urls.push(db.storage.from('listing-photos').getPublicUrl(path).data.publicUrl);
      }
      const { error: pe } = await db.from('listing_photos').insert(urls.map((url, i) => ({ listing_id: id, url, is_cover: i === 0, position: i })));
      if (pe) throw pe;
      await db.from('listing_drafts').delete().eq('seller_id', uid);
      await setJSON(DRAFT_KEY, null);
      setD(EMPTY);
      Alert.alert('Submitted', 'Your listing is with our team for review.', [{ text: 'OK', onPress: () => navigation.navigate('Dashboard') }]);
    } catch (err: any) {
      Alert.alert('Could not submit', err?.message ?? 'Please try again. Your draft is saved.');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
      <T small muted>Step {d.step} of 4 · draft saved automatically</T>
      {d.step === 1 ? (<>
        <H1 style={{ marginVertical: 10 }}>What are you listing?</H1>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {Object.entries(CATEGORIES).map(([k, v]) => <Chip key={k} label={v.label} active={d.category === k} onPress={() => set({ category: k, freq: k === 'airbnb' ? 'night' : d.freq })} />)}
        </View>
      </>) : null}
      {d.step === 2 ? (<>
        <H1 style={{ marginVertical: 10 }}>Details</H1>
        <Field label="Title" value={d.title} onChangeText={(title) => set({ title })} />
        <Field label="Description" value={d.description} onChangeText={(description) => set({ description })} multiline style={{ minHeight: 90, textAlignVertical: 'top', paddingTop: 10 }} />
        <Field label="Price (KES)" value={d.price} onChangeText={(price) => set({ price })} keyboardType="number-pad" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>{FREQS.map(([k, l]) => <Chip key={k} label={l} active={d.freq === k} onPress={() => set({ freq: k })} />)}</View>
        <Field label="County" value={d.county} onChangeText={(county) => set({ county })} />
        <Field label="Area / estate" value={d.area} onChangeText={(area) => set({ area })} />
        <Field label="Bedrooms (optional)" value={d.bedrooms} onChangeText={(bedrooms) => set({ bedrooms })} keyboardType="number-pad" />
      </>) : null}
      {d.step === 3 ? (<>
        <H1 style={{ marginVertical: 10 }}>Photos</H1>
        <T muted style={{ marginBottom: 10 }}>The first photo is the cover.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {d.photos.map((u, i) => <Image key={u} source={{ uri: u }} style={{ width: 96, height: 72, borderRadius: 8 }} />)}
        </View>
        <Button kind="outline" title="Add photos" onPress={pick} />
        {d.photos.length ? <Button kind="outline" style={{ marginTop: 8 }} title="Remove last photo" onPress={() => set({ photos: d.photos.slice(0, -1) })} /> : null}
      </>) : null}
      {d.step === 4 ? (<>
        <H1 style={{ marginVertical: 10 }}>Contact and review</H1>
        <Field label="Phone" value={d.phone} onChangeText={(phone) => set({ phone })} keyboardType="phone-pad" />
        {feeEligible ? <Field label="Viewing fee (KES 0 to 5,000, whole number)" value={d.viewingFee} onChangeText={(viewingFee) => set({ viewingFee })} keyboardType="number-pad" /> : null}
        <Chip label={d.agree ? 'Terms and Privacy Policy accepted ✓' : 'Accept Terms and Privacy Policy'} active={d.agree} onPress={() => set({ agree: !d.agree })} />
        <T small muted style={{ marginTop: 10 }}>Nyumba254 does not collect viewing fees. Your listing is reviewed before it goes live.</T>
      </>) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
        {d.step > 1 ? <Button style={{ flex: 1 }} kind="outline" title="Back" onPress={() => set({ step: d.step - 1 })} /> : null}
        {d.step < 4 ? <Button style={{ flex: 1 }} title="Next" onPress={next} /> : <Button style={{ flex: 1 }} title="Submit for review" onPress={submit} loading={busy} />}
      </View>
    </ScrollView>
  );
}
