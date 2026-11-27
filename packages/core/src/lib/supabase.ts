/**
 * Supabase Client Factory
 * Single source for creating Supabase clients across all environments
 */

import { createClient, type SupabaseClient, type SupabaseClientOptions } from '@supabase/supabase-js';
import type { Database } from '../types/database';

// Environment validation
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? 'https://vliuuloyfhyxcsuchpss.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  throw new Error('Missing SUPABASE_URL environment variable');
}

if (!SUPABASE_ANON_KEY) {
  console.warn('Missing SUPABASE_ANON_KEY - some features will not work');
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('Missing SUPABASE_SERVICE_ROLE_KEY - admin operations will not work');
}

// Default options for all clients
const defaultOptions: SupabaseClientOptions<Database> = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
  },
  global: {
    headers: {
      'X-Client-Info': 'nyumba254-core',
    },
  },
  db: {
    schema: 'public',
  },
};

// Singleton instances
let browserClient: SupabaseClient<Database> | null = null;
let serverClient: SupabaseClient<Database> | null = null;
let serviceClient: SupabaseClient<Database> | null = null;

/**
 * Get or create browser client (for client-side usage)
 * Uses localStorage for session persistence
 */
export function getBrowserClient(): SupabaseClient<Database> {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient() can only be called in browser environment');
  }

  if (!browserClient) {
    browserClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY ?? '', {
      ...defaultOptions,
      auth: {
        ...defaultOptions.auth,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
        storageKey: 'nyumba254-auth',
      },
    });
  }

  return browserClient;
}

/**
 * Get or create server client (for SSR/Server Components)
 * Uses cookies for session persistence
 */
export function getServerClient(
  cookieStore?: { get: (name: string) => { value: string } | undefined; set: (name: string, value: string, options?: unknown) => void }
): SupabaseClient<Database> {
  if (!serverClient) {
    const options: SupabaseClientOptions<Database> = {
      ...defaultOptions,
      auth: {
        ...defaultOptions.auth,
        storage: cookieStore
          ? {
              getItem: (key: string) => cookieStore.get(key)?.value ?? null,
              setItem: (key: string, value: string) => cookieStore.set(key, value, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' }),
              removeItem: (key: string) => cookieStore.set(key, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 }),
            }
          : undefined,
      },
    };

    serverClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY ?? '', options);
  }

  return serverClient;
}

/**
 * Get service role client (for admin operations)
 * Bypasses RLS - use only in trusted server environments
 */
export function getServiceClient(): SupabaseClient<Database> {
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client');
  }

  if (!serviceClient) {
    serviceClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      ...defaultOptions,
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serviceClient;
}

/**
 * Create a new client with custom options (for testing or special cases)
 */
export function createSupabaseClient(
  options?: SupabaseClientOptions<Database>
): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY ?? '', {
    ...defaultOptions,
    ...options,
  });
}

/**
 * Create a client with user's access token (for RLS)
 */
export function createUserClient(accessToken: string): SupabaseClient<Database> {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY ?? '', {
    ...defaultOptions,
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Reset all singleton clients (useful for testing)
 */
export function resetClients(): void {
  browserClient = null;
  serverClient = null;
  serviceClient = null;
}

/**
 * Get the current auth session (browser only)
 */
export async function getSession(): Promise<{ access_token: string; refresh_token: string; expires_at: number; user: unknown } | null> {
  const client = getBrowserClient();
  const { data } = await client.auth.getSession();
  return data.session;
}

/**
 * Get the current user (browser only)
 */
export async function getUser() {
  const client = getBrowserClient();
  const { data } = await client.auth.getUser();
  return data.user;
}

/**
 * Sign out (browser only)
 */
export async function signOut(): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  return client.auth.signOut();
}

/**
 * Listen to auth changes (browser only)
 */
export function onAuthStateChange(
  callback: (event: string, session: { access_token: string; refresh_token: string; expires_at: number; user: unknown } | null) => void
): { data: { subscription: { unsubscribe: () => void } } } {
  const client = getBrowserClient();
  return client.auth.onAuthStateChange(callback);
}

// Export types
export type { SupabaseClient } from '@supabase/supabase-js';