/**
 * Notifications Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsRead,
  markAllNotificationsRead,
  subscribeToNotifications,
  type Notification,
  type NotificationType,
  NOTIFICATION_TYPES,
} from '../api/notifications';

const NOTIFICATION_KEYS = {
  list: (unreadOnly?: boolean) => ['notifications', 'list', unreadOnly] as const,
  unreadCount: ['notifications', 'unread-count'] as const,
};

/**
 * Get notifications
 */
export function useNotifications(unreadOnly = false, limit = 20) {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.list(unreadOnly),
    queryFn: () => getNotifications({ unreadOnly, limit }),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Get unread notification count
 */
export function useUnreadNotificationCount() {
  return useQuery({
    queryKey: NOTIFICATION_KEYS.unreadCount,
    queryFn: getUnreadNotificationCount,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Mark notifications as read mutation
 */
export function useMarkNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationIds: string[]) => markNotificationsRead(notificationIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.unreadCount });
    },
  });
}

/**
 * Mark all notifications as read mutation
 */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.list() });
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.unreadCount });
    },
  });
}

/**
 * Subscribe to real-time notifications
 */
export function useNotificationSubscription(enabled = true) {
  const queryClient = useQueryClient();

  return {
    subscribe: (callback: (notification: Notification) => void) => {
      if (!enabled) return { unsubscribe: () => {} };
      return subscribeToNotifications((notification) => {
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.list() });
        queryClient.invalidateQueries({ queryKey: NOTIFICATION_KEYS.unreadCount });
        callback(notification);
      });
    },
  };
}

/**
 * Get notification type info for UI
 */
export function useNotificationType(type: NotificationType) {
  return NOTIFICATION_TYPES[type];
}

/**
 * Get all notification types
 */
export function useAllNotificationTypes() {
  return NOTIFICATION_TYPES;
}