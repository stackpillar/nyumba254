/**
 * Notifications API
 */

import { getBrowserClient, getServiceClient } from '../lib/supabase';
import type { Database } from '../types';

type Notification = Database['public']['Tables']['notifications']['Row'];

/**
 * Get notifications for current user
 */
export async function getNotifications(
  options?: {
    unreadOnly?: boolean;
    limit?: number;
    offset?: number;
  }
): Promise<Notification[]> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return [];

  let query = client
    .from('notifications')
    .select('*')
    .eq('seller_id', user.data.user.id)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }
  if (options?.offset) {
    query = query.range(options.offset, options.offset + (options.limit ?? 20) - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load notifications: ${error.message}`);
  }

  return (data ?? []) as Notification[];
}

/**
 * Get unread notification count
 */
export async function getUnreadNotificationCount(): Promise<number> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return 0;

  const { count, error } = await client
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', user.data.user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Mark notifications as read
 */
export async function markNotificationsRead(
  notificationIds: string[]
): Promise<{ error: Error | null }> {
  const client = getBrowserClient();

  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .in('id', notificationIds);

  return { error };
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return { error: new Error('Not authenticated') };

  const { error } = await client
    .from('notifications')
    .update({ is_read: true })
    .eq('seller_id', user.data.user.id)
    .eq('is_read', false);

  return { error };
}

/**
 * Subscribe to real-time notifications
 */
export function subscribeToNotifications(
  callback: (notification: Notification) => void
): { unsubscribe: () => void } {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) {
    return { unsubscribe: () => {} };
  }

  const channel = client
    .channel(`notifications:${user.data.user.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `seller_id=eq.${user.data.user.id}`,
      },
      (payload) => {
        callback(payload.new as Notification);
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
 * Notification types for UI
 */
export const NOTIFICATION_TYPES = {
  enquiry: { label: 'New Enquiry', icon: 'mail', color: 'green' },
  message: { label: 'New Message', icon: 'message-square', color: 'blue' },
  viewing_request: { label: 'Viewing Request', icon: 'calendar', color: 'purple' },
  viewing_confirmed: { label: 'Viewing Confirmed', icon: 'check-circle', color: 'green' },
  viewing_completed: { label: 'Viewing Completed', icon: 'check-circle-2', color: 'blue' },
  payment: { label: 'Payment Received', icon: 'credit-card', color: 'gold' },
  listing_approved: { label: 'Listing Approved', icon: 'check', color: 'green' },
  listing_expiring: { label: 'Listing Expiring', icon: 'alert-triangle', color: 'amber' },
  review: { label: 'New Review', icon: 'star', color: 'gold' },
  system: { label: 'System', icon: 'info', color: 'gray' },
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;