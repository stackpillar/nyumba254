/**
 * Listings Hooks
 */

import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  searchListings,
  getLatestListings,
  getFeaturedListings,
  getListing,
  getListingStats,
  getPublicViewingFees,
  createListing,
  updateListing,
  deleteListing,
  toggleFeaturedListing,
  toggleListingStatus,
  type SearchFilters,
  type EnrichedListing,
} from '../api/listings';

const LISTING_KEYS = {
  all: ['listings'] as const,
  lists: () => [...LISTING_KEYS.all, 'list'] as const,
  list: (filters: SearchFilters) => [...LISTING_KEYS.lists(), filters] as const,
  infinite: (filters: SearchFilters) => [...LISTING_KEYS.all, 'infinite', filters] as const,
  detail: (id: string) => [...LISTING_KEYS.all, 'detail', id] as const,
  latest: (limit: number) => [...LISTING_KEYS.all, 'latest', limit] as const,
  featured: (limit: number) => [...LISTING_KEYS.all, 'featured', limit] as const,
  stats: () => [...LISTING_KEYS.all, 'stats'] as const,
};

/**
 * Search listings with filters (paginated)
 */
export function useListings(filters: SearchFilters, page = 1, pageSize = 12) {
  return useQuery({
    queryKey: LISTING_KEYS.list(filters),
    queryFn: () => searchListings(filters, page, pageSize),
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Infinite scroll listings
 */
export function useInfiniteListings(filters: SearchFilters, pageSize = 12) {
  return useInfiniteQuery({
    queryKey: LISTING_KEYS.infinite(filters),
    queryFn: ({ pageParam = 1 }) => searchListings(filters, pageParam, pageSize),
    getNextPageParam: (lastPage) => (lastPage.hasMore ? lastPage.page + 1 : undefined),
    initialPageParam: 1,
  });
}

/**
 * Get latest listings for homepage
 */
export function useLatestListings(limit = 8) {
  return useQuery({
    queryKey: LISTING_KEYS.latest(limit),
    queryFn: () => getLatestListings(limit),
    staleTime: 60_000, // 1 minute
  });
}

/**
 * Get featured listings
 */
export function useFeaturedListings(limit = 12) {
  return useQuery({
    queryKey: LISTING_KEYS.featured(limit),
    queryFn: () => getFeaturedListings(limit),
    staleTime: 60_000,
  });
}

/**
 * Get single listing detail
 */
export function useListing(id: string) {
  return useQuery({
    queryKey: LISTING_KEYS.detail(id),
    queryFn: () => getListing(id),
    enabled: !!id,
    staleTime: 30_000,
  });
}

/**
 * Get listing stats for homepage
 */
export function useListingStats() {
  return useQuery({
    queryKey: LISTING_KEYS.stats(),
    queryFn: getListingStats,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Prefetch listing detail
 */
export function usePrefetchListing() {
  const queryClient = useQueryClient();

  return (id: string) => {
    queryClient.prefetchQuery({
      queryKey: LISTING_KEYS.detail(id),
      queryFn: () => getListing(id),
      staleTime: 30_000,
    });
  };
}

/**
 * Create listing mutation
 */
export function useCreateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createListing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.stats() });
    },
  });
}

/**
 * Update listing mutation
 */
export function useUpdateListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Parameters<typeof updateListing>[1] }) =>
      updateListing(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.lists() });
    },
  });
}

/**
 * Delete listing mutation
 */
export function useDeleteListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteListing,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.stats() });
    },
  });
}

/**
 * Toggle featured mutation
 */
export function useToggleFeatured() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isFeatured }: { id: string; isFeatured: boolean }) =>
      toggleFeaturedListing(id, isFeatured),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.featured(12) });
    },
  });
}

/**
 * Toggle listing status mutation
 */
export function useToggleListingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'active' | 'pending' | 'scheduled' | 'expired' | 'occupied' | 'disabled' | 'draft' }) =>
      toggleListingStatus(id, status),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.detail(id) });
      queryClient.invalidateQueries({ queryKey: LISTING_KEYS.lists() });
    },
  });
}

/**
 * Hydrate viewing fees for listings
 */
export function useHydrateViewingFees(listings: EnrichedListing[]) {
  return useQuery({
    queryKey: ['listings', 'viewing-fees', listings.map(l => l.id).sort()],
    queryFn: async () => {
      const ids = listings.map(l => l.id);
      if (!ids.length) return new Map();
      return getPublicViewingFees(ids);
    },
    enabled: listings.length > 0,
    staleTime: 60_000,
  });
}