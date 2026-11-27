/**
 * Messages & Chat API
 */

import { getBrowserClient, getServiceClient } from '../lib/supabase';
import type { Database } from '../types';

type ChatSession = Database['public']['Tables']['chat_sessions']['Row'];
type Message = Database['public']['Tables']['messages']['Row'];

/**
 * Get or create a chat session for a listing
 */
export async function getOrCreateChatSession(
  listingId: string,
  buyerId: string | null,
  sessionType: 'buyer' | 'seller' = 'buyer',
  topic?: string
): Promise<ChatSession | null> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return null;

  const sessionKey = sessionType === 'buyer'
    ? `buyer_${user.data.user.id}_${listingId}`
    : `seller_${user.data.user.id}_${listingId}`;

  // Try to find existing session
  const { data: existing } = await client
    .from('chat_sessions')
    .select('*')
    .eq('session_key', sessionKey)
    .maybeSingle();

  if (existing) return existing;

  // Create new session
  const { data, error } = await client
    .from('chat_sessions')
    .insert({
      session_key: sessionKey,
      session_type: sessionType,
      seller_id: sessionType === 'seller' ? user.data.user.id : (await getSellerId(listingId))!,
      buyer_id: sessionType === 'buyer' ? user.data.user.id : buyerId,
      listing_id: listingId,
      visitor_name: sessionType === 'buyer' ? (await getBuyerName()) : undefined,
      page: 'app',
      topic,
      status: 'open',
      is_resolved: false,
      last_msg_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create chat session: ${error.message}`);
  }

  return data;
}

/**
 * Get chat sessions for current user
 */
export async function getChatSessions(userId: string): Promise<ChatSession[]> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('chat_sessions')
    .select(`
      *,
      listings(title, area, listing_photos(url, is_cover, position)),
      messages!chat_sessions_last_msg_at_fkey(content, created_at, sender_id)
    `)
    .or(`seller_id.eq.${userId},buyer_id.eq.${userId}`)
    .order('last_msg_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load chat sessions: ${error.message}`);
  }

  return (data ?? []) as ChatSession[];
}

/**
 * Get messages for a chat session
 */
export async function getMessages(sessionId: string, limit = 50): Promise<Message[]> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('messages')
    .select('*')
    .eq('listing_id', sessionId) // session_id is stored in listing_id for backwards compat
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load messages: ${error.message}`);
  }

  return (data ?? []) as Message[];
}

/**
 * Send a message
 */
export async function sendMessage(
  sessionId: string,
  content: string,
  messageType: 'text' | 'image' | 'system' | 'viewing_request' | 'quick_answer' = 'text',
  metadata?: Record<string, unknown>
): Promise<Message | null> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await client
    .from('messages')
    .insert({
      listing_id: sessionId,
      sender_id: user.data.user.id,
      content,
      message_type: messageType,
      metadata,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to send message: ${error.message}`);
  }

  // Update session last_msg_at
  await client
    .from('chat_sessions')
    .update({ last_msg_at: new Date().toISOString() })
    .eq('id', sessionId);

  return data;
}

/**
 * Mark messages as read
 */
export async function markMessagesRead(sessionId: string, userId: string): Promise<void> {
  const client = getBrowserClient();

  await client
    .from('messages')
    .update({ is_read: true })
    .eq('listing_id', sessionId)
    .neq('sender_id', userId)
    .eq('is_read', false);
}

/**
 * Subscribe to real-time messages
 */
export function subscribeToMessages(
  sessionId: string,
  callback: (message: Message) => void
): { unsubscribe: () => void } {
  const client = getBrowserClient();

  const channel = client
    .channel(`messages:${sessionId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `listing_id=eq.${sessionId}`,
      },
      (payload) => {
        callback(payload.new as Message);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      client.removeChannel(channel);
    },
  };
}

/**
 * Get unread message count
 */
export async function getUnreadMessageCount(userId: string): Promise<number> {
  const client = getBrowserClient();

  const { count, error } = await client
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('listing_id', userId) // This needs adjustment - messages don't have a direct user_id
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

// Helper functions
async function getSellerId(listingId: string): Promise<string | null> {
  const client = getBrowserClient();
  const { data } = await client
    .from('listings')
    .select('seller_id')
    .eq('id', listingId)
    .single();
  return data?.seller_id ?? null;
}

async function getBuyerName(): Promise<string | null> {
  const client = getBrowserClient();
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data } = await client
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  return data?.full_name ?? null;
}