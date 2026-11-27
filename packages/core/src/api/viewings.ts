/**
 * Viewings API
 */

import { getBrowserClient, getServiceClient } from '../lib/supabase';
import type { Database } from '../types';

type ViewingRequest = Database['public']['Tables']['viewing_requests']['Row'];

/**
 * Create a viewing request
 */
export async function createViewingRequest(request: {
  listing_id: string;
  buyer_name: string;
  buyer_phone: string;
  buyer_email?: string;
  preferred_date: string;
  preferred_time: string;
  viewing_fee?: number;
}): Promise<ViewingRequest | null> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  const { data, error } = await client
    .from('viewing_requests')
    .insert({
      listing_id: request.listing_id,
      buyer_id: user.data.user?.id ?? null,
      buyer_name: request.buyer_name,
      buyer_phone: request.buyer_phone,
      buyer_email: request.buyer_email ?? null,
      preferred_date: request.preferred_date,
      preferred_time: request.preferred_time,
      viewing_fee: request.viewing_fee ?? null,
      fee_status: request.viewing_fee ? 'pending' : 'free',
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create viewing request: ${error.message}`);
  }

  return data;
}

/**
 * Get viewing requests for a listing (seller view)
 */
export async function getViewingRequestsForListing(listingId: string): Promise<ViewingRequest[]> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('viewing_requests')
    .select('*')
    .eq('listing_id', listingId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load viewing requests: ${error.message}`);
  }

  return (data ?? []) as ViewingRequest[];
}

/**
 * Get viewing requests for current user (buyer view)
 */
export async function getMyViewingRequests(): Promise<ViewingRequest[]> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return [];

  const { data, error } = await client
    .from('viewing_requests')
    .select(`
      *,
      listings(title, area, category, price, price_frequency, listing_photos(url, is_cover, position))
    `)
    .eq('buyer_id', user.data.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load my viewing requests: ${error.message}`);
  }

  return (data ?? []) as ViewingRequest[];
}

/**
 * Get viewing requests for seller's listings
 */
export async function getSellerViewingRequests(): Promise<ViewingRequest[]> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) return [];

  const { data, error } = await client
    .from('viewing_requests')
    .select(`
      *,
      listings!inner(title, area, seller_id)
    `)
    .eq('listings.seller_id', user.data.user.id)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load seller viewing requests: ${error.message}`);
  }

  return (data ?? []) as ViewingRequest[];
}

/**
 * Update viewing request status
 */
export async function updateViewingStatus(
  viewingId: string,
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show',
  notes?: string
): Promise<ViewingRequest | null> {
  const client = getBrowserClient();

  const updates: Partial<ViewingRequest> = { status, updated_at: new Date().toISOString() };
  if (notes) updates.notes = notes;
  if (status === 'confirmed') updates.confirmed_at = new Date().toISOString();
  if (status === 'completed') updates.completed_at = new Date().toISOString();

  const { data, error } = await client
    .from('viewing_requests')
    .update(updates)
    .eq('id', viewingId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update viewing status: ${error.message}`);
  }

  return data;
}

/**
 * Confirm viewing with fee
 */
export async function confirmViewingWithFee(
  viewingId: string,
  confirmedDate: string,
  confirmedTime: string
): Promise<ViewingRequest | null> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('viewing_requests')
    .update({
      status: 'confirmed',
      preferred_date: confirmedDate,
      preferred_time: confirmedTime,
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', viewingId)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to confirm viewing: ${error.message}`);
  }

  return data;
}

/**
 * Subscribe to viewing request changes (real-time)
 */
export function subscribeToViewingRequests(
  listingId: string,
  callback: (viewing: ViewingRequest) => void
): { unsubscribe: () => void } {
  const client = getBrowserClient();

  const channel = client
    .channel(`viewings:${listingId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'viewing_requests',
        filter: `listing_id=eq.${listingId}`,
      },
      (payload) => {
        callback(payload.new as ViewingRequest);
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
 * Get viewing statistics for seller
 */
export async function getViewingStats(): Promise<{
  total: number;
  pending: number;
  confirmed: number;
  completed: number;
  cancelled: number;
}> {
  const client = getBrowserClient();
  const user = await client.auth.getUser();

  if (!user.data.user) {
    return { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  }

  const { data, error } = await client
    .from('viewing_requests')
    .select('status', { count: 'exact' })
    .eq('listings.seller_id', user.data.user.id);

  if (error) {
    return { total: 0, pending: 0, confirmed: 0, completed: 0, cancelled: 0 };
  }

  const counts = {
    total: data?.length ?? 0,
    pending: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  };

  data?.forEach(v => {
    if (v.status in counts) {
      counts[v.status as keyof typeof counts]++;
    }
  });

  return counts;
}