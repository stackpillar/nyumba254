/**
 * Authentication API
 */

import { getBrowserClient, getServerClient, getServiceClient } from '../lib/supabase';
import type { AuthUser, Session } from '../types';

/**
 * Sign in with email (magic link)
 */
export async function signInWithEmail(email: string): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
    },
  });
  return { error };
}

/**
 * Sign up with email
 */
export async function signUpWithEmail(email: string, metadata?: { full_name?: string }): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      data: metadata,
    },
  });
  return { error };
}

/**
 * Sign in with OAuth provider
 */
export async function signInWithOAuth(
  provider: 'google' | 'apple',
  redirectTo?: string
): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectTo ?? `${window.location.origin}/auth/callback`,
    },
  });
  return { error };
}

/**
 * Sign out
 */
export async function signOut(): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  return client.auth.signOut();
}

/**
 * Get current session (browser)
 */
export async function getSession(): Promise<Session | null> {
  const client = getBrowserClient();
  const { data } = await client.auth.getSession();
  return data.session;
}

/**
 * Get current user (browser)
 */
export async function getUser(): Promise<AuthUser | null> {
  const client = getBrowserClient();
  const { data } = await client.auth.getUser();
  return data.user;
}

/**
 * Get user profile from profiles table
 */
export async function getProfile(userId: string) {
  const client = getBrowserClient();
  const { data, error } = await client
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw new Error(`Failed to load profile: ${error.message}`);
  }

  return data;
}

/**
 * Update user profile
 */
export async function updateProfile(
  userId: string,
  updates: Partial<{
    full_name: string;
    phone: string;
    avatar_url: string;
    account_type: string;
    page_handle: string;
    page_visibility: string;
    page_bio: string;
    page_location: string;
    company_name: string;
    company_type: string;
    company_registration: string;
    company_logo: string;
    company_description: string;
    company_website: string;
    viewing_fee_default: number;
    viewing_fee_policy_accepted: boolean;
    concierge_enabled: boolean;
    sms_alerts_enabled: boolean;
    push_notifications_enabled: boolean;
    email_notifications_enabled: boolean;
  }>
): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  return { error };
}

/**
 * Update account type (role)
 */
export async function updateAccountType(
  userId: string,
  accountType: 'buyer' | 'owner' | 'caretaker' | 'agent' | 'company'
): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client
    .from('profiles')
    .update({
      account_type: accountType,
      role_set_at: new Date().toISOString(),
    })
    .eq('id', userId);

  return { error };
}

/**
 * Set lister page handle
 */
export async function setListerPageHandle(
  userId: string,
  handle: string
): Promise<{ error: Error | null; data: { handle: string } | null }> {
  const client = getBrowserClient();

  // Check if handle is available
  const { data: existing } = await client
    .from('profiles')
    .select('id')
    .eq('page_handle', handle.toLowerCase())
    .neq('id', userId)
    .maybeSingle();

  if (existing) {
    return { error: new Error('Handle already taken'), data: null };
  }

  const { data, error } = await client
    .from('profiles')
    .update({
      page_handle: handle.toLowerCase(),
      page_visibility: 'public',
    })
    .eq('id', userId)
    .select('page_handle')
    .single();

  return { error, data };
}

/**
 * Update lister page visibility
 */
export async function updateListerPageVisibility(
  userId: string,
  visibility: 'public' | 'unlisted' | 'hidden'
): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client
    .from('profiles')
    .update({ page_visibility: visibility })
    .eq('id', userId);

  return { error };
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  preferences: {
    sms_alerts_enabled?: boolean;
    push_notifications_enabled?: boolean;
    email_notifications_enabled?: boolean;
  }
): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client
    .from('profiles')
    .update(preferences)
    .eq('id', userId);

  return { error };
}

/**
 * Set default viewing fee
 */
export async function setDefaultViewingFee(
  userId: string,
  fee: number,
  policyAccepted: boolean
): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client
    .from('profiles')
    .update({
      viewing_fee_default: fee,
      viewing_fee_policy_accepted: policyAccepted,
    })
    .eq('id', userId);

  return { error };
}

/**
 * Apply viewing fee to all active listings
 */
export async function applyViewingFeeToActiveListings(
  userId: string,
  fee: number
): Promise<{ error: Error | null; count: number }> {
  const client = getServiceClient();

  const { data, error } = await client
    .from('listings')
    .update({ viewing_fee: fee, viewing_fee_status: 'loaded' })
    .eq('seller_id', userId)
    .eq('status', 'active')
    .select('id');

  if (error) {
    return { error, count: 0 };
  }

  return { error: null, count: data?.length ?? 0 };
}

/**
 * Listen to auth state changes
 */
export function onAuthStateChange(
  callback: (event: string, session: Session | null) => void
): { data: { subscription: { unsubscribe: () => void } } } {
  const client = getBrowserClient();
  return client.auth.onAuthStateChange(callback);
}

/**
 * Reset password
 */
export async function resetPassword(email: string): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  });
  return { error };
}

/**
 * Update password (when logged in)
 */
export async function updatePassword(newPassword: string): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client.auth.updateUser({ password: newPassword });
  return { error };
}

/**
 * Verify email OTP
 */
export async function verifyOtp(email: string, token: string): Promise<{ error: Error | null }> {
  const client = getBrowserClient();
  const { error } = await client.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  return { error };
}

/**
 * Get user's public profile (for lister pages)
 */
export async function getPublicProfile(handle: string) {
  const client = getServiceClient();
  const { data, error } = await client
    .from('public_account_profiles')
    .select('*')
    .eq('page_handle', handle)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load public profile: ${error.message}`);
  }

  return data;
}

/**
 * Check if handle is available
 */
export async function checkHandleAvailability(handle: string): Promise<{ available: boolean; error: Error | null }> {
  const client = getServiceClient();
  const { data, error } = await client
    .from('profiles')
    .select('id')
    .eq('page_handle', handle.toLowerCase())
    .maybeSingle();

  return { available: !data, error };
}