/**
 * Web-specific Supabase Client
 * Uses @supabase/ssr for cookie-based auth
 */

import { createBrowserClient, createServerClient, type SupabaseClient } from '@supabase/ssr';
import type { Database } from '@nyumba254/core';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vliuuloyfhyxcsuchpss.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Missing Supabase environment variables');
}

/**
 * Create a browser client for client components
 */
export function createClient(): SupabaseClient<Database> {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
    },
  });
}

/**
 * Create a server client for server components and API routes
 */
export function createServerClient(
  cookieStore: {
    get: (name: string) => { value: string } | undefined;
    set: (name: string, value: string, options?: unknown) => void;
    delete: (name: string) => void;
  }
): SupabaseClient<Database> {
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll?.() ?? [];
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // The `setAll` method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  });
}

/**
 * Get the singleton browser client
 */
let browserClient: SupabaseClient<Database> | null = null;

export function getBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient() can only be called in browser environment');
  }

  if (!browserClient) {
    browserClient = createClient();
  }

  return browserClient;
}

/**
 * Create a client with user's access token (for RLS)
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

// Export types
export type { SupabaseClient } from '@supabase/ssr';