/**
 * Auth Hooks - Mobile specific
 */

import { useMutation } from '@tanstack/react-query';
import { signInWithEmail, signUpWithEmail, signOut, getSession, getUser } from '../api/auth';

/**
 * Sign in with email (magic link)
 */
export function useSignInWithEmail() {
  return useMutation({
    mutationFn: (email: string) => signInWithEmail(email),
  });
}

/**
 * Sign up with email (magic link)
 */
export function useSignUpWithEmail() {
  return useMutation({
    mutationFn: (email: string) => signUpWithEmail(email),
  });
}

/**
 * Sign out
 */
export function useSignOut() {
  return useMutation({
    mutationFn: signOut,
  });
}

/**
 * Get current session
 */
export function useSession() {
  return useMutation({
    mutationFn: getSession,
  });
}

/**
 * Get current user
 */
export function useUser() {
  return useMutation({
    mutationFn: getUser,
  });
}