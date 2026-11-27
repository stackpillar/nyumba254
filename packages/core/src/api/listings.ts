/**
 * Listings API - Typed wrappers around Supabase queries and RPCs
 */

import { getServiceClient, getBrowserClient } from '../lib/supabase';
import type {
  Listing,
  ListingWithRelations,
  EnrichedListing,
  SearchFilters,
  PaginatedResponse,
  Database,
} from '../types';

const LISTING_SELECT = `
  *,
  listing_photos(*),
  listing_videos(*),
  profiles:public_account_profiles(
    id,
    full_name,
    identity_verified,
    verification_status,
    account_type,
    verified_role,
    page_handle,
    page_visibility
  )
`;

/**
 * Sanitize search query for full-text search
 */
function safeQuery(q: string): string {
  return q
    .replace(/[,()%_\\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Convert database listing to enriched listing with computed fields
 */
export function enrichListing(listing: ListingWithRelations): EnrichedListing {
  const photos = listing.listing_photos ?? [];
  const sortedPhotos = [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const coverPhoto = sortedPhotos.find(p => p.is_cover) ?? sortedPhotos[0] ?? null;

  // Role text
  const listedByType = listing.listed_by_type ?? listing.profiles?.account_type ?? '';
  const currentRole = listing.profiles?.account_type;
  const roleChanged = !!listedByType && !!currentRole && currentRole !== listedByType;
  const roleVerified = !!listedByType && !roleChanged && listing.profiles?.verified_role === listedByType;

  const roleLabels: Record<string, string> = {
    buyer: 'Tenant / Buyer',
    owner: 'Direct from owner',
    landlord: 'Direct from owner',
    caretaker: 'Caretaker',
    agent: 'Agent',
    company: 'Company',
    seller: 'Lister',
  };

  const shortRoleLabels: Record<string, string> = {
    buyer: 'Tenant',
    owner: 'Owner',
    landlord: 'Owner',
    caretaker: 'Caretaker',
    agent: 'Agent',
    company: 'Company',
    seller: 'Lister',
  };

  // Price formatting
  const freqLabels: Record<string, string> = {
    month: '/mo',
    night: '/night',
    week: '/week',
    term: '/term',
    semester: '/semester',
    once: '',
  };

  const category = listing.category;
  const isBoarding = category === 'boarding';
  const pricePrefix = isBoarding ? 'From ' : '';
  const formattedPrice = `${pricePrefix}KES ${Number(listing.price || 0).toLocaleString('en-KE')}${freqLabels[listing.price_frequency] ?? ''}`;

  // Viewing fee
  const feeLoaded = listing.viewing_fee_status !== 'error' && listing.public_viewing_fee != null;
  const fee = Number(listing.public_viewing_fee) || 0;
  const viewingFeeText = feeLoaded
    ? fee > 0
      ? `Viewing KES ${fee.toLocaleString('en-KE')}`
      : 'Free viewing'
    : 'Viewing fee: confirm with the lister';

  return {
    ...listing,
    listing_photos: photos,
    listing_videos: listing.listing_videos ?? [],
    coverPhoto,
    formattedPrice,
    roleText: {
      long: listedByType
        ? `${roleLabels[listedByType] ?? 'Lister'}${roleChanged ? ' (role changed, not verified)' : roleVerified ? ' · identity checked' : ' (not verified)'}`
        : 'Lister (not verified)',
      short: listedByType
        ? `${shortRoleLabels[listedByType] ?? 'Lister'}${roleChanged ? ' · unverified' : roleVerified ? ' · checked' : ''}`
        : 'Lister',
      identityChecked: listing.profiles?.identity_verified === true || listing.profiles?.verification_status === 'verified',
    },
    viewingFeeText,
    isFreeViewing: feeLoaded && fee === 0,
  };
}

/**
 * Search listings using the public RPC
 */
export async function searchListings(
  filters: SearchFilters,
  page = 1,
  pageSize = 12
): Promise<PaginatedResponse<EnrichedListing>> {
  const client = getBrowserClient();

  const { data: matches, error } = await client.rpc('search_public_listing_ids', {
    p_category: filters.category || '',
    p_frequency: filters.freq || '',
    p_county: filters.county || '',
    p_areas: filters.areas.length ? filters.areas : null,
    p_min_price: filters.minPrice === '' ? null : Number(filters.minPrice),
    p_max_price: filters.maxPrice === '' ? null : Number(filters.maxPrice),
    p_bedrooms: filters.beds || '',
    p_furnished: filters.furn || '',
    p_amenities: filters.amen.length ? filters.amen : null,
    p_search: safeQuery(filters.q),
    p_include_occupied: filters.occ,
    p_lister_filter: filters.listedBy || '',
    p_viewing_fee_filter: filters.viewingFee || '',
    p_sort: filters.sort || '',
    p_map_ids: [],
    p_offset: (page - 1) * pageSize,
    p_limit: pageSize,
  });

  if (error) {
    throw new Error(`Search failed: ${error.message}`);
  }

  const ids: string[] = (matches ?? []).map((m: { listing_id: string; total_count: number }) => m.listing_id).filter(Boolean);
  const total = Number(matches?.[0]?.total_count) || 0;

  if (!ids.length) {
    return { rows: [], total, page, pageSize, hasMore: false };
  }

  const { data: listings, error: listingsError } = await client
    .from('listings')
    .select(LISTING_SELECT)
    .in('id', ids);

  if (listingsError) {
    throw new Error(`Failed to load listings: ${listingsError.message}`);
  }

  // Maintain order from RPC
  const byId = new Map((listings ?? []).map(l => [l.id, l]));
  const ordered = ids.map(id => byId.get(id)).filter(Boolean) as ListingWithRelations[];

  return {
    rows: ordered.map(enrichListing),
    total,
    page,
    pageSize,
    hasMore: page * pageSize < total,
  };
}

/**
 * Get latest listings for homepage
 */
export async function getLatestListings(limit = 8): Promise<EnrichedListing[]> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('listings')
    .select(LISTING_SELECT)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load latest listings: ${error.message}`);
  }

  return ((data ?? []) as ListingWithRelations[]).map(enrichListing);
}

/**
 * Get featured listings
 */
export async function getFeaturedListings(limit = 12): Promise<EnrichedListing[]> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('listings')
    .select(LISTING_SELECT)
    .eq('status', 'active')
    .eq('is_featured', true)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load featured listings: ${error.message}`);
  }

  return ((data ?? []) as ListingWithRelations[]).map(enrichListing);
}

/**
 * Get single listing by ID or listing_number
 */
export async function getListing(identifier: string): Promise<EnrichedListing | null> {
  const client = getBrowserClient();

  const isNumber = /^\d+$/.test(identifier);
  const query = client
    .from('listings')
    .select(`${LISTING_SELECT}, listing_units(*)`)
    .eq(isNumber ? 'listing_number' : 'id', isNumber ? parseInt(identifier, 10) : identifier)
    .maybeSingle();

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to load listing: ${error.message}`);
  }

  if (!data) return null;

  return enrichListing(data as ListingWithRelations);
}

/**
 * Get listings by seller ID
 */
export async function getListingsBySeller(sellerId: string): Promise<EnrichedListing[]> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('listings')
    .select(LISTING_SELECT)
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load seller listings: ${error.message}`);
  }

  return ((data ?? []) as ListingWithRelations[]).map(enrichListing);
}

/**
 * Get listing stats (for homepage counters)
 */
export async function getListingStats(): Promise<{
  total: number;
  categories: Record<string, number>;
  counties: Record<string, number>;
}> {
  const client = getBrowserClient();

  const { data, error } = await client.rpc('nk_listing_stats');

  if (error) {
    throw new Error(`Failed to load stats: ${error.message}`);
  }

  return data as { total: number; categories: Record<string, number>; counties: Record<string, number> };
}

/**
 * Get public viewing fees for multiple listings
 */
export async function getPublicViewingFees(listingIds: string[]): Promise<Map<string, number>> {
  if (!listingIds.length) return new Map();

  const client = getBrowserClient();

  const { data, error } = await client.rpc('get_public_viewing_fees', {
    p_listing_ids: listingIds,
  });

  if (error) {
    throw new Error(`Failed to load viewing fees: ${error.message}`);
  }

  return new Map((data ?? []).map((r: { listing_id: string; viewing_fee: number }) => [r.listing_id, Number(r.viewing_fee) || 0]));
}

/**
 * Create a new listing
 */
export async function createListing(
  listing: Database['public']['Tables']['listings']['Insert']
): Promise<Listing | null> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('listings')
    .insert(listing)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create listing: ${error.message}`);
  }

  return data;
}

/**
 * Update a listing
 */
export async function updateListing(
  id: string,
  updates: Database['public']['Tables']['listings']['Update']
): Promise<Listing | null> {
  const client = getBrowserClient();

  const { data, error } = await client
    .from('listings')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to update listing: ${error.message}`);
  }

  return data;
}

/**
 * Delete a listing (move to recycle bin)
 */
export async function deleteListing(id: string): Promise<void> {
  const client = getBrowserClient();

  const { error } = await client
    .from('listings')
    .update({ recycle_bin: true, status: 'disabled' })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to delete listing: ${error.message}`);
  }
}

/**
 * Toggle listing featured status
 */
export async function toggleFeaturedListing(id: string, isFeatured: boolean): Promise<void> {
  const client = getBrowserClient();

  const { error } = await client
    .from('listings')
    .update({ is_featured: isFeatured })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update featured status: ${error.message}`);
  }
}

/**
 * Toggle listing active status
 */
export async function toggleListingStatus(id: string, status: Database['public']['Enums']['listing_status']): Promise<void> {
  const client = getBrowserClient();

  const { error } = await client
    .from('listings')
    .update({ status })
    .eq('id', id);

  if (error) {
    throw new Error(`Failed to update listing status: ${error.message}`);
  }
}

/**
 * Upload listing photo
 */
export async function uploadListingPhoto(
  listingId: string,
  file: File,
  position: number,
  isCover = false
): Promise<Database['public']['Tables']['listing_photos']['Row'] | null> {
  const client = getBrowserClient();

  const fileExt = file.name.split('.').pop();
  const fileName = `${listingId}/${Date.now()}-${position}.${fileExt}`;

  const { error: uploadError } = await client.storage
    .from('listing-photos')
    .upload(fileName, file);

  if (uploadError) {
    throw new Error(`Failed to upload photo: ${uploadError.message}`);
  }

  const { data: urlData } = client.storage.from('listing-photos').getPublicUrl(fileName);

  const { data, error } = await client
    .from('listing_photos')
    .insert({
      listing_id: listingId,
      url: urlData.publicUrl,
      position,
      is_cover: isCover,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to save photo record: ${error.message}`);
  }

  return data;
}

/**
 * Delete listing photo
 */
export async function deleteListingPhoto(photoId: string): Promise<void> {
  const client = getBrowserClient();

  // First get the photo to delete from storage
  const { data: photo } = await client
    .from('listing_photos')
    .select('url')
    .eq('id', photoId)
    .single();

  if (photo) {
    const url = new URL(photo.url);
    const path = url.pathname.split('/listing-photos/')[1];
    if (path) {
      await client.storage.from('listing-photos').remove([path]);
    }
  }

  const { error } = await client
    .from('listing_photos')
    .delete()
    .eq('id', photoId);

  if (error) {
    throw new Error(`Failed to delete photo: ${error.message}`);
  }
}

/**
 * Reorder listing photos
 */
export async function reorderListingPhotos(
  listingId: string,
  photoIds: string[]
): Promise<void> {
  const client = getBrowserClient();

  const updates = photoIds.map((id, index) =>
    client.from('listing_photos').update({ position: index }).eq('id', id)
  );

  await Promise.all(updates);
}