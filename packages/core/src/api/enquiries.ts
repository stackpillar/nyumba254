/**
 * Enquiries API
 */

import { getBrowserClient, getServiceClient } from '../lib/supabase';
import type { Database } from '../types';

type Enquiry = Database['public']['Tables']['enquiries']['Row'];

/**
 * Create an enquiry
 */
export async function createEnquiry(enquiry: {
  listing_id: string;
  buyer_name: string;
  buyer_email?: string;
  buyer_phone?: string;
  message: string;
}): Promise<Enquiry | null> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  const { data, error } = await client
    .from('enquiries')
    .insert({
      listing_id: enquiry.listing_id,
      buyer_id: user.data.user?.id ?? null,
      buyer_name: enquiry.buyer_name,
      buyer_email: enquiry.buyer_email ?? null,
      buyer_phone: enquiry.buyer_phone ?? null,
      message: enquiry.message,
      status: 'new',
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create enquiry: ${error.message}`);
  }

  return data;
}

/**
 * Get enquiries for seller's listings
 */
export async function getSellerEnquiries(
  options?: {
    unreadOnly?: boolean;
    limit?: number;
  }
): Promise<Enquiry[]> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return [];

  let query = client
    .from('enquiries')
    .select(`
      *,
      listings(title, area, category, price, price_frequency, listing_photos(url, is_cover, position))
    `)
    .eq('listings.seller_id', user.data.user.id)
    .order('created_at', { ascending: false });

  if (options?.unreadOnly) {
    query = query.eq('is_read', false);
  }
  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load enquiries: ${error.message}`);
  }

  return (data ?? []) as Enquiry[];
}

/**
 * Get enquiries for a specific listing
 */
export async function getEnquiriesForListing(listingId: string): Promise<Enquiry[]> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('enquiries')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load enquiries for listing: ${error.message}`);
  }

  return (data ?? []) as Enquiry[];
}

/**
 * Mark enquiry as read
 */
export async function markEnquiryRead(enquiryId: string): Promise<void> {
  const client = getBrowserClient();

  const { error } = await client
    .from('enquiries')
    .update({ is_read: true, status: 'read' })
    .eq('id', enquiryId);

  if (error) {
    throw new Error(`Failed to mark enquiry as read: ${error.message}`);
  }
}

/**
 * Get unread enquiry count
 */
export async function getUnreadEnquiryCount(): Promise<number> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return 0;

  const { count, error } = await client
    .from('enquiries')
    .select('*', { count: 'exact', head: true })
    .eq('listings.seller_id', user.data.user.id)
    .eq('is_read', false);

  if (error) return 0;
  return count ?? 0;
}

/**
 * Subscribe to new enquiries (real-time)
 */
export function subscribeToEnquiries(
  callback: (enquiry: Enquiry) => void
): { unsubscribe: () => void } {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) {
    return { unsubscribe: () => {} };
  }

  const channel = client
    .channel(`enquiries:${user.data.user.id}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'enquiries',
        filter: `listings.seller_id=eq.${user.data.user.id}`,
      },
      (payload) => {
        callback(payload.new as Enquiry);
      }
    )
    .subscribe();

  return {
    unsubscribe: () => {
      client.removeChannel(channel);
    },
  };
}