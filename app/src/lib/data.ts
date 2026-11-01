import { db } from './supabase';

// ── Labels copied from the website (nk-shared.js) ──
export const CATEGORIES: Record<string, { label: string; group: string }> = {
  apartment: { label: 'Apartment', group: 'standard' },
  house: { label: 'House', group: 'standard' },
  boarding: { label: 'Boarding House', group: 'boarding' },
  airbnb: { label: 'Airbnb / Holiday Rental', group: 'airbnb' },
  commercial: { label: 'Shops & offices', group: 'commercial' },
};
export const FREQ_LABEL: Record<string, string> = { month: '/mo', night: '/night', week: '/week', term: '/term', once: '' };
const LISTED_BY: Record<string, string> = { buyer: 'Tenant / Buyer', owner: 'Direct from owner', landlord: 'Direct from owner', caretaker: 'Caretaker', agent: 'Agent', company: 'Company', seller: 'Lister' };
const SHORT_ROLE: Record<string, string> = { buyer: 'Tenant', owner: 'Owner', landlord: 'Owner', caretaker: 'Caretaker', agent: 'Agent', company: 'Company', seller: 'Lister' };

export type Photo = { url: string; is_cover?: boolean; position?: number };
export type Listing = {
  id: string; title: string; area: string; county?: string; category: string; price: number; price_frequency: string;
  status: string; is_featured?: boolean; created_at: string; listed_by_type?: string; seller_id?: string; description?: string;
  details?: Record<string, any>; listing_photos?: Photo[]; listing_videos?: { id: string }[]; amenities?: string[];
  latitude?: number; longitude?: number; whatsapp?: string; phone?: string; listing_number?: number;
  profiles?: { id: string; full_name?: string; identity_verified?: boolean; verification_status?: string; account_type?: string; verified_role?: string; page_handle?: string } | null;
  public_viewing_fee?: number | null; viewing_fee_status?: 'loaded' | 'error';
};

export const LISTING_SELECT = '*, listing_photos(*), listing_videos(id)';

export function formatPrice(l: Pick<Listing, 'category' | 'price' | 'price_frequency'>, fromPrefix = false) {
  const group = CATEGORIES[l.category]?.group ?? 'standard';
  const prefix = fromPrefix && group === 'boarding' ? 'From ' : '';
  return `${prefix}KES ${Number(l.price || 0).toLocaleString('en-KE')}${FREQ_LABEL[l.price_frequency] ?? ''}`;
}

export function viewingFeeText(l: Listing) {
  const loaded = l.viewing_fee_status !== 'error' && l.public_viewing_fee != null;
  if (!loaded) return 'Viewing fee: confirm with the lister';
  const fee = Number(l.public_viewing_fee) || 0;
  return fee > 0 ? `Viewing KES ${fee.toLocaleString('en-KE')}` : 'Free viewing';
}
export const isFreeViewing = (l: Listing) => l.viewing_fee_status !== 'error' && l.public_viewing_fee != null && Number(l.public_viewing_fee) === 0;

export function roleText(l: Listing) {
  const by = l.listed_by_type || l.profiles?.account_type || '';
  const cur = l.profiles?.account_type;
  const changed = !!by && !!cur && cur !== by;
  const verified = !!by && !changed && l.profiles?.verified_role === by;
  return {
    long: by ? `${LISTED_BY[by] ?? 'Lister'}${changed ? ' (role changed, not verified)' : verified ? ' · identity checked' : ' (not verified)'}` : 'Lister (not verified)',
    short: by ? `${SHORT_ROLE[by] ?? 'Lister'}${changed ? ' · unverified' : verified ? ' · checked' : ''}` : 'Lister',
    identityChecked: l.profiles?.identity_verified === true || l.profiles?.verification_status === 'verified',
  };
}

export function coverPhoto(l: Listing): Photo | null {
  const photos = [...(l.listing_photos ?? [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return photos.find((p) => p.is_cover) ?? photos[0] ?? null;
}

// Supabase only resizes through /render/image/public/ (same rule as the site).
export function imgSrc(url: string | undefined | null, width = 600) {
  if (!url) return '';
  const m = String(url).match(/^(https:\/\/[^/]+\.supabase\.co\/storage\/v1)\/object\/public\/([^?#]+)(\?[^#]*)?$/);
  if (m && !m[3]) return `${m[1]}/render/image/public/${m[2]}?width=${width}&quality=75`;
  return url;
}

async function hydrate(rows: Listing[]): Promise<Listing[]> {
  const ids = [...new Set(rows.map((r) => r.id))];
  const sellers = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))] as string[];
  if (!ids.length) return rows;
  const [fees, profs] = await Promise.all([
    db.rpc('get_public_viewing_fees', { p_listing_ids: ids }),
    sellers.length
      ? db.from('public_account_profiles').select('id,full_name,created_at,identity_verified,account_type,verified_role,page_handle,page_visibility').in('id', sellers)
      : Promise.resolve({ data: [], error: null } as any),
  ]);
  const feeBy = new Map<string, number>((fees.data ?? []).map((r: any) => [r.listing_id, Number(r.viewing_fee) || 0]));
  const profBy = new Map<string, any>((profs.data ?? []).map((p: any) => [p.id, p]));
  return rows.map((r) => ({
    ...r,
    profiles: profBy.get(r.seller_id ?? '') ?? r.profiles ?? null,
    public_viewing_fee: feeBy.has(r.id) ? feeBy.get(r.id)! : null,
    viewing_fee_status: feeBy.has(r.id) ? 'loaded' : 'error',
  }));
}

export type Filters = {
  q: string; category: string; freq: string; county: string; minPrice: string; maxPrice: string; beds: string;
  furn: string; listedBy: string; viewingFee: string; sort: string; occ: boolean; amen: string[]; areas: string[];
};
export const EMPTY_FILTERS: Filters = { q: '', category: '', freq: '', county: '', minPrice: '', maxPrice: '', beds: '', furn: '', listedBy: '', viewingFee: '', sort: '', occ: false, amen: [], areas: [] };
const safeQ = (q: string) => String(q || '').replace(/[,()%_\\]/g, ' ').replace(/\s+/g, ' ').trim();

export const PAGE_SIZE = 12;

// Same RPC the website's /listings page calls, so results and rules match.
export async function searchListings(f: Filters, page = 1): Promise<{ rows: Listing[]; total: number }> {
  const { data: matches, error } = await db.rpc('search_public_listing_ids', {
    p_category: f.category || '', p_frequency: f.freq || '', p_county: f.county || '', p_areas: f.areas,
    p_min_price: f.minPrice === '' ? null : Number(f.minPrice), p_max_price: f.maxPrice === '' ? null : Number(f.maxPrice),
    p_bedrooms: f.beds || '', p_furnished: f.furn || '', p_amenities: f.amen, p_search: safeQ(f.q),
    p_include_occupied: !!f.occ, p_lister_filter: f.listedBy || '', p_viewing_fee_filter: f.viewingFee || '',
    p_sort: f.sort || '', p_map_ids: [], p_offset: (page - 1) * PAGE_SIZE, p_limit: PAGE_SIZE,
  });
  if (error) throw error;
  const ids: string[] = (matches ?? []).map((m: any) => m.listing_id).filter(Boolean);
  const total = Number(matches?.[0]?.total_count) || 0;
  if (!ids.length) return { rows: [], total };
  const { data, error: e2 } = await db.from('listings').select(LISTING_SELECT).in('id', ids);
  if (e2) throw e2;
  const by = new Map((data ?? []).map((r: any) => [r.id, r]));
  const ordered = ids.map((id) => by.get(id)).filter(Boolean) as Listing[];
  return { rows: await hydrate(ordered), total };
}

export async function fetchListingsByIds(ids: string[]): Promise<Listing[]> {
  if (!ids.length) return [];
  const { data, error } = await db.from('listings').select(LISTING_SELECT).in('id', ids);
  if (error) throw error;
  const by = new Map((data ?? []).map((r: any) => [r.id, r]));
  return hydrate(ids.map((id) => by.get(id)).filter(Boolean) as Listing[]);
}

export async function fetchListing(id: string): Promise<Listing | null> {
  const q = db.from('listings').select('*, listing_photos(*), listing_videos(*), listing_units(*)');
  const { data, error } = await (/^\d+$/.test(id) ? q.eq('listing_number', parseInt(id, 10)) : q.eq('id', id)).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return (await hydrate([data as Listing]))[0];
}

export async function latestListings(limit = 8): Promise<Listing[]> {
  const { data, error } = await db.from('listings').select(LISTING_SELECT).eq('status', 'active').order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return hydrate((data ?? []) as Listing[]);
}

export async function fetchListerByHandle(handle: string) {
  const h = handle.replace(/^@/, '').toLowerCase();
  const { data: p } = await db.from('public_account_profiles').select('id,full_name,created_at,identity_verified,account_type,verified_role,page_handle,page_visibility').eq('page_handle', h).maybeSingle();
  if (!p) return null;
  const { data } = await db.from('listings').select(LISTING_SELECT).eq('seller_id', (p as any).id).eq('status', 'active').order('created_at', { ascending: false }).limit(30);
  return { profile: p as any, listings: await hydrate((data ?? []) as Listing[]) };
}
