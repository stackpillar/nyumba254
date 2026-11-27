/**
 * Messages Hooks
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getChatSessions,
  getMessages,
  sendMessage,
  markMessagesRead,
  subscribeToMessages,
  type ChatSession,
  type Message,
} from '../api/messages';

const MESSAGE_KEYS = {
  sessions: ['messages', 'sessions'] as const,
  session: (id: string) => ['messages', 'session', id] as const,
  messages: (sessionId: string) => ['messages', 'messages', sessionId] as const,
};

/**
 * Get chat sessions for current user
 */
export function useChatSessions() {
  return useQuery({
    queryKey: MESSAGE_KEYS.sessions,
    queryFn: async () => {
      const { getUser } = await import('../api/auth');
      const user = await getUser();
      if (!user) return [];
      return getChatSessions(user.id);
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}

/**
 * Get messages for a session
 */
export function useMessages(sessionId: string, limit = 50) {
  return useQuery({
    queryKey: MESSAGE_KEYS.messages(sessionId),
    queryFn: () => getMessages(sessionId, limit),
    enabled: !!sessionId,
    staleTime: 10_000,
  });
}

/**
 * Send message mutation
 */
export function useSendMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      sessionId,
      content,
      messageType,
      metadata,
    }: {
      sessionId: string;
      content: string;
      messageType?: 'text' | 'image' | 'system' | 'viewing_request' | 'quick_answer';
      metadata?: Record<string, unknown>;
    }) => sendMessage(sessionId, content, messageType, metadata),
    onMutate: async ({ sessionId, content }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: MESSAGE_KEYS.messages(sessionId) });
      const previousMessages = queryClient.getQueryData<Message[]>(MESSAGE_KEYS.messages(sessionId));

      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        listing_id: sessionId,
        sender_id: 'current-user',
        content,
        message_type: 'text',
        is_read: false,
        created_at: new Date().toISOString(),
      };

      queryClient.setQueryData<Message[]>(MESSAGE_KEYS.messages(sessionId), (old) =>
        old ? [...old, optimisticMessage] : [optimisticMessage]
      );

      return { previousMessages };
    },
    onError: (err, { sessionId }, context) => {
      if (context?.previousMessages) {
        queryClient.setQueryData(MESSAGE_KEYS.messages(sessionId), context.previousMessages);
      }
    },
    onSettled: (_data, _err, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: MESSAGE_KEYS.messages(sessionId) });
    },
  });
}

/**
 * Mark messages as read mutation
 */
export function useMarkMessagesRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ sessionId, userId }: { sessionId: string; userId: string }) =>
      markMessagesRead(sessionId, userId),
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: MESSAGE_KEYS.messages(sessionId) });
      queryClient.invalidateQueries({ queryKey: MESSAGE_KEYS.sessions });
    },
  });
}

/**
 * Subscribe to real-time messages
 */
export function useMessageSubscription(sessionId: string, enabled = true) {
  const queryClient = useQueryClient();

  // This would be called in a useEffect in the component
  // Returns subscribe/unsubscribe functions
  return {
    subscribe: (callback: (message: Message) => void) => {
      if (!enabled || !sessionId) return { unsubscribe: () => {} };
      return subscribeToMessages(sessionId, (message) => {
        queryClient.setQueryData<Message[]>(MESSAGE_KEYS.messages(sessionId), (old) =>
          old ? [...old, message] : [message]
        );
        queryClient.invalidateQueries({ queryKey: MESSAGE_KEYS.sessions });
        callback(message);
      });
    },
  };
}

/**
 * Get unread message count
 */
export function useUnreadMessageCount() {
  return useQuery({
    queryKey: ['messages', 'unread-count'],
    queryFn: async () => {
      const { getUser } = await import('../api/auth');
      const user = await getUser();
      if (!user) return 0;

      // This is a simplified version - in reality you'd query the database
      // For now return 0 as placeholder
      return 0;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
}