/**
 * Viewings Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createViewingRequest,
  getViewingRequestsForListing,
  getMyViewingRequests,
  getSellerViewingRequests,
  updateViewingStatus,
  confirmViewingWithFee,
  getViewingStats,
  subscribeToViewingRequests,
  type ViewingRequest,
} from '../api/viewings';

const VIEWING_KEYS = {
  listing: (listingId: string) => ['viewings', 'listing', listingId] as const,
  my: ['viewings', 'my'] as const,
  seller: ['viewings', 'seller'] as const,
  stats: ['viewings', 'stats'] as const,
};

/**
 * Get viewing requests for a listing (seller)
 */
export function useViewingRequestsForListing(listingId: string) {
  return useQuery({
    queryKey: VIEWING_KEYS.listing(listingId),
    queryFn: () => getViewingRequestsForListing(listingId),
    enabled: !!listingId,
    staleTime: 30_000,
  });
}

/**
 * Get my viewing requests (buyer)
 */
export function useMyViewingRequests() {
  return useQuery({
    queryKey: VIEWING_KEYS.my,
    queryFn: getMyViewingRequests,
    staleTime: 30_000,
  });
}

/**
 * Get seller viewing requests
 */
export function useSellerViewingRequests() {
  return useQuery({
    queryKey: VIEWING_KEYS.seller,
    queryFn: getSellerViewingRequests,
    staleTime: 30_000,
  });
}

/**
 * Get viewing stats
 */
export function useViewingStats() {
  return useQuery({
    queryKey: VIEWING_KEYS.stats,
    queryFn: getViewingStats,
    staleTime: 60_000,
  });
}

/**
 * Create viewing request mutation
 */
export function useCreateViewingRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createViewingRequest,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.my });
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.listing(variables.listing_id) });
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.stats });
    },
  });
}

/**
 * Update viewing status mutation
 */
export function useUpdateViewingStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      viewingId,
      status,
      notes,
    }: {
      viewingId: string;
      status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
      notes?: string;
    }) => updateViewingStatus(viewingId, status, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.seller });
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.my });
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.stats });
    },
  });
}

/**
 * Confirm viewing with fee mutation
 */
export function useConfirmViewingWithFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      viewingId,
      confirmedDate,
      confirmedTime,
    }: {
      viewingId: string;
      confirmedDate: string;
      confirmedTime: string;
    }) => confirmViewingWithFee(viewingId, confirmedDate, confirmedTime),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.seller });
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.my });
      queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.stats });
    },
  });
}

/**
 * Subscribe to real-time viewing updates
 */
export function useViewingSubscription(listingId: string, enabled = true) {
  const queryClient = useQueryClient();

  return {
    subscribe: (callback: (viewing: ViewingRequest) => void) => {
      if (!enabled || !listingId) return { unsubscribe: () => {} };
      return subscribeToViewingRequests(listingId, (viewing) => {
        queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.listing(listingId) });
        queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.seller });
        queryClient.invalidateQueries({ queryKey: VIEWING_KEYS.stats });
        callback(viewing);
      });
    },
  };
}