/**
 * Core Types - Public API
 */

export * from './database';

// Application-specific types
export interface ListingWithRelations extends Database['public']['Tables']['listings']['Row'] {
  listing_photos?: Database['public']['Tables']['listing_photos']['Row'][];
  listing_videos?: Database['public']['Tables']['listing_videos']['Row'][];
  profiles?: Database['public']['Views']['public_account_profiles']['Row'] | null;
  public_viewing_fee?: number | null;
  viewing_fee_status?: 'loaded' | 'error';
}

export interface EnrichedListing extends ListingWithRelations {
  // Computed fields
  coverPhoto?: Database['public']['Tables']['listing_photos']['Row'] | null;
  formattedPrice: string;
  roleText: {
    long: string;
    short: string;
    identityChecked: boolean;
  };
  viewingFeeText: string;
  isFreeViewing: boolean;
}

export interface SearchFilters {
  q: string;
  category: string;
  freq: string;
  county: string;
  minPrice: string;
  maxPrice: string;
  beds: string;
  furn: string;
  listedBy: string;
  viewingFee: string;
  sort: string;
  occ: boolean;
  amen: string[];
  areas: string[];
}

export interface PaginatedResponse<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface AuthUser {
  id: string;
  email?: string;
  phone?: string;
  user_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
  app_metadata?: {
    provider?: string;
  };
}

export interface Session {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

// Re-export enums for convenience
export type AccountType = Database['public']['Enums']['account_type'];
export type ListingCategory = Database['public']['Enums']['listing_category'];
export type PriceType = Database['public']['Enums']['price_type'];
export type PriceFrequency = Database['public']['Enums']['price_frequency'];
export type ListingStatus = Database['public']['Enums']['listing_status'];