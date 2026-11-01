import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { Button, Chip, Empty, Field, T } from '../components/ui';
import { db } from '../lib/supabase';
import { useAuth } from '../lib/auth';

const TOPICS = ['Posting a listing', 'Editing a listing', 'Verification', 'Plans and payments', 'Something else'];

export default function SupportScreen() {
  const { theme } = useTheme();
  const { session, profile } = useAuth();
  const [ticket, setTicket] = useState<any>(null);
  const [msgs, setMsgs] = useState<any[]>([]);
  const [text, setText] = useState('');
  const list = useRef<FlatList>(null);

  const loadMsgs = useCallback(async (id: string) => {
    const { data } = await db.from('chat_messages').select('*').eq('session_id', id).order('created_at', { ascending: true });
    setMsgs(data ?? []);
  }, []);

  useEffect(() => {
    if (!session) return;
    db.from('chat_sessions').select('*').eq('seller_id', session.user.id).eq('session_type', 'seller').eq('is_resolved', false).order('last_msg_at', { ascending: false }).limit(1)
      .then(({ data }) => { if (data?.[0]) { setTicket(data[0]); loadMsgs(data[0].id); } });
  }, [session, loadMsgs]);

  useEffect(() => {
    if (!ticket) return;
    const ch = db.channel(`support-${ticket.id}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${ticket.id}` }, () => loadMsgs(ticket.id)).subscribe();
    return () => { db.removeChannel(ch); };
  }, [ticket, loadMsgs]);

  if (!session) return <Empty text="Sign in to chat with support." />;

  const start = async (topic: string) => {
    const { data, error } = await db.from('chat_sessions').insert({ session_key: `seller_${session.user.id}_${Date.now()}`, session_type: 'seller', seller_id: session.user.id, visitor_name: profile?.full_name ?? 'Lister', page: 'app', topic, status: 'open', is_resolved: false, last_msg_at: new Date().toISOString() }).select().single();
    if (!error) { setTicket(data); setMsgs([]); }
  };
  const send = async () => {
    const body = text.trim(); if (!body || !ticket) return;
    setText('');
    const { data } = await db.from('chat_messages').insert({ session_id: ticket.id, sender: 'visitor', body }).select().single();
    if (data) { setMsgs((m) => [...m, data]); await db.from('chat_sessions').update({ last_msg_at: data.created_at }).eq('id', ticket.id); }
  };

  if (!ticket) {
    return (
      <View style={{ flex: 1, padding: 16, backgroundColor: theme.surface }}>
        <T bold style={{ marginBottom: 10 }}>What do you need help with?</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{TOPICS.map((t) => <Chip key={t} label={t} onPress={() => start(t)} />)}</View>
      </View>
    );
  }
  return (
    <View style={{ flex: 1, backgroundColor: theme.surface }}>
      <FlatList ref={list} data={msgs} keyExtractor={(m) => m.id} contentContainerStyle={{ padding: 16 }} onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => (
          <View style={{ alignSelf: item.sender === 'visitor' ? 'flex-end' : 'flex-start', maxWidth: '82%', backgroundColor: item.sender === 'visitor' ? theme.green : theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 14, padding: 10, marginBottom: 8 }}>
            <T style={{ color: item.sender === 'visitor' ? '#fff' : theme.text }}>{item.body}</T>
          </View>
        )}
        ListEmptyComponent={<Empty text="Tell us what is happening and we will reply here." />} />
      <View style={{ padding: 12, borderTopWidth: 1, borderColor: theme.border, backgroundColor: theme.card }}>
        <Field label="Message" value={text} onChangeText={setText} />
        <Button title="Send" onPress={send} disabled={!text.trim()} />
      </View>
    </View>
  );
}
