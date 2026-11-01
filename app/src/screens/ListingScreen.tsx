import React, { useEffect, useState } from 'react';
import { Alert, Dimensions, FlatList, Linking, Pressable, ScrollView, Share, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../theme/ThemeContext';
import { Button, Card, Chip, Empty, Field, H1, Loading, T } from '../components/ui';
import { CATEGORIES, Listing, fetchListing, formatPrice, imgSrc, isFreeViewing, roleText, viewingFeeText } from '../lib/data';
import { db } from '../lib/supabase';
import { getSaved, toggleSaved } from '../lib/storage';
import { useAuth } from '../lib/auth';
import { FONT } from '../theme/tokens';

const SAFETY = 'Pay any listed viewing fee only at the property, to the person you meet, and ask for a receipt. Never pay rent, a deposit or any other fee before you have viewed the property. Nyumba254 does not collect viewing fees.';
const W = Dimensions.get('window').width;

function UploadedVideo({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => { p.loop = false; });
  return <VideoView player={player} style={{ width: '100%', aspectRatio: 16 / 9, borderRadius: 12, backgroundColor: '#000' }} nativeControls contentFit="contain" />;
}

export default function ListingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { session } = useAuth();
  const [l, setL] = useState<Listing | null>(null);
  const [state, setState] = useState<'loading' | 'missing' | 'error'>('loading');
  const [answers, setAnswers] = useState<{ k: string; a: string }[]>([]);
  const [saved, setSaved] = useState(false);
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [sending, setSending] = useState(false);
  const [vDate, setVDate] = useState('');
  const [vTime, setVTime] = useState('');
  const [vOpen, setVOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const x = await fetchListing(route.params.id);
        if (!x) return setState('missing');
        setL(x);
        getSaved().then((s) => setSaved(s.includes(x.id)));
        const { data } = await db.from('lister_quick_answers').select('question_key,answer,listing_id').eq('lister_id', x.seller_id).or(`listing_id.is.null,listing_id.eq.${x.id}`);
        const m = new Map<string, string>();
        (data ?? []).filter((r: any) => !r.listing_id).forEach((r: any) => m.set(r.question_key, r.answer));
        (data ?? []).filter((r: any) => r.listing_id).forEach((r: any) => m.set(r.question_key, r.answer));
        setAnswers([...m].map(([k, a]) => ({ k, a })));
      } catch { setState('error'); }
    })();
  }, [route.params.id]);

  if (!l) return state === 'loading' ? <Loading /> : <Empty text={state === 'missing' ? 'This listing is no longer available.' : 'Could not load this listing. Check your connection and try again.'} />;

  const role = roleText(l);
  const photos = [...(l.listing_photos ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const uploaded = ((l as any).listing_videos ?? []).filter((v: any) => v?.url && (v.source === 'upload' || /listing-videos\//.test(v.url)));
  const links = ((l as any).listing_videos ?? []).filter((v: any) => v?.url && !uploaded.includes(v));

  // The lister's number is never in the listing row. It is released by this RPC, which enforces the privacy toggle and rate limit.
  const reveal = async (channel: 'call' | 'whatsapp') => {
    const { data, error } = await db.rpc('reveal_seller_contact', { p_listing_id: l.id, p_device_id: 'app', p_channel: channel });
    if (error || !data) return Alert.alert('Contact unavailable', 'Send a message instead.');
    const n = String(data).replace(/[^\d+]/g, '').replace(/^0/, '254').replace('+', '');
    if (channel === 'call') Linking.openURL(`tel:+${n}`);
    else Linking.openURL(`https://wa.me/${n}?text=${encodeURIComponent(`Hello, I saw your listing "${l.title}" on Nyumba254. Is it still available?\nhttps://nyumba254.com/listing?id=${l.listing_number}`)}`);
  };

  const send = async () => {
    if (!name.trim() || !phone.trim() || !msg.trim()) return Alert.alert('Missing details', 'Add your name, phone and a message.');
    setSending(true);
    const { error } = await db.rpc('submit_enquiry', { p_listing_id: l.id, p_name: name.trim(), p_phone: phone.trim(), p_email: session?.user.email ?? null, p_message: msg.trim(), p_buyer_token: `app-${l.id}-${session?.user.id ?? 'guest'}` });
    setSending(false);
    if (error) return Alert.alert('Not sent', 'Your message could not be sent. Please try again.');
    setMsg(''); Alert.alert('Sent', 'The lister will reply by phone or on Nyumba254.');
  };

  const requestViewing = async () => {
    if (!name.trim() || !phone.trim() || !vDate.trim() || !vTime.trim()) return Alert.alert('Missing details', 'Add your name, phone, date (YYYY-MM-DD) and time.');
    setSending(true);
    const fee = l.public_viewing_fee ?? null;
    const { error } = await db.from('viewing_requests').insert({
      listing_id: l.id, buyer_token: `app-${l.id}-${session?.user.id ?? 'guest'}`, buyer_name: name.trim(), buyer_phone: phone.trim(),
      requested_date: vDate.trim(), requested_time: vTime.trim(), notes: null,
      viewing_fee_acknowledged: !!fee && fee > 0, fee_at_request: fee,
    });
    setSending(false);
    if (error) return Alert.alert('Not sent', 'Could not send the viewing request. Please try again.');
    setVOpen(false); Alert.alert('Request sent', 'The lister will confirm the time.');
  };

  const feeNote = l.public_viewing_fee == null
    ? `Viewing fee: confirm with the lister. ${SAFETY}`
    : Number(l.public_viewing_fee) > 0 ? `This lister charges a viewing fee of KES ${Number(l.public_viewing_fee).toLocaleString('en-KE')}. ${SAFETY} You should not be charged more than the listed fee.` : `Free viewing. ${SAFETY}`;

  return (
    <ScrollView style={{ backgroundColor: theme.surface }} contentContainerStyle={{ paddingBottom: 40 }}>
      {photos.length ? (
        <FlatList horizontal pagingEnabled showsHorizontalScrollIndicator={false} data={photos} keyExtractor={(p, i) => p.url + i}
          renderItem={({ item }) => <Image source={{ uri: imgSrc(item.url, 900) }} style={{ width: W, aspectRatio: 4 / 3, backgroundColor: theme.greenLight }} contentFit="cover" />} />
      ) : <View style={{ width: W, aspectRatio: 4 / 3, backgroundColor: theme.greenLight }} />}
      <View style={{ padding: 16 }}>
        <T style={{ fontFamily: FONT.serif, fontSize: 24, color: theme.green }}>{formatPrice(l, true)}</T>
        <H1 style={{ fontSize: 20, marginTop: 4 }}>{l.title}</H1>
        <T muted style={{ marginTop: 4 }}>{l.area}{l.county ? `, ${l.county}` : ''} · {CATEGORIES[l.category]?.label ?? l.category}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 10 }}>
          <Chip label={viewingFeeText(l)} tone={isFreeViewing(l) ? 'green' : 'muted'} />
          <Chip label={role.long} tone={role.identityChecked ? 'green' : 'muted'} />
          {role.identityChecked ? <Chip label="Identity checked" tone="green" /> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button style={{ flex: 1 }} title="Call" onPress={() => reveal('call')} />
          <Button style={{ flex: 1 }} kind="outline" title="WhatsApp" onPress={() => reveal('whatsapp')} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
          <Button style={{ flex: 1 }} kind="outline" title={saved ? 'Saved ✓' : 'Save'} onPress={async () => setSaved(await toggleSaved(l.id))} />
          <Button style={{ flex: 1 }} kind="outline" title="Share" onPress={() => Share.share({ message: `${l.title} — https://nyumba254.com/listing?id=${l.listing_number}` })} />
        </View>

        {l.description ? <Card style={{ marginTop: 14 }}><T bold>About this property</T><T style={{ marginTop: 6 }}>{l.description}</T></Card> : null}
        {uploaded.map((v: any) => <View key={v.id} style={{ marginBottom: 12 }}><UploadedVideo url={v.url} /></View>)}
        {links.map((v: any) => <Button key={v.id} kind="outline" title="Watch video" style={{ marginBottom: 8 }} onPress={() => Linking.openURL(v.url)} />)}

        {answers.length ? (
          <Card><T bold>Quick answers from the lister</T>
            {answers.map((a) => <View key={a.k} style={{ marginTop: 8 }}><T small muted>{a.k.replace(/_/g, ' ')}</T><T>{a.a}</T></View>)}
          </Card>
        ) : null}

        <Card style={{ backgroundColor: theme.greenLight }}>
          <T bold>Viewing fee and safety</T>
          <T small style={{ marginTop: 6 }}>{feeNote}</T>
          <Pressable onPress={() => Linking.openURL('https://nyumba254.com/viewing-fee-policy')} style={{ minHeight: 44, justifyContent: 'center' }}><T bold style={{ color: theme.green }}>Read the Viewing Fee Policy</T></Pressable>
        </Card>

        <Card>
          <T bold>Message the lister</T>
          <View style={{ height: 8 }} />
          <Field label="Your name" value={name} onChangeText={setName} />
          <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <Field label="Message" value={msg} onChangeText={setMsg} multiline style={{ minHeight: 80, textAlignVertical: 'top', paddingTop: 10 }} placeholder="Is it still available?" />
          <Button title="Send message" onPress={send} loading={sending} />
          <Button kind="outline" style={{ marginTop: 8 }} title={vOpen ? 'Cancel viewing request' : 'Request a viewing'} onPress={() => setVOpen((v) => !v)} />
          {vOpen ? (
            <View style={{ marginTop: 10 }}>
              <Field label="Date (YYYY-MM-DD)" value={vDate} onChangeText={setVDate} />
              <Field label="Time (e.g. 10:00)" value={vTime} onChangeText={setVTime} />
              <Button title="Send viewing request" onPress={requestViewing} loading={sending} />
            </View>
          ) : null}
        </Card>

        <Pressable onPress={() => l.profiles?.page_handle && navigation.navigate('Lister', { handle: l.profiles.page_handle })} style={{ minHeight: 44, justifyContent: 'center' }}>
          <T muted small>Listed by {l.profiles?.full_name ?? 'a lister'}{l.profiles?.page_handle ? ' · View Lister Page' : ''}</T>
        </Pressable>
        <Pressable onPress={() => Linking.openURL(`https://nyumba254.com/listing?id=${l.listing_number}`)} style={{ minHeight: 44, justifyContent: 'center' }}><T small muted>Report a problem on the website</T></Pressable>
      </View>
    </ScrollView>
  );
}
