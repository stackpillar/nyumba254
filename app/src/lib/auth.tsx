import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { db } from './supabase';

export type Profile = {
  id: string; full_name?: string; phone?: string; account_type?: string; verified_role?: string;
  identity_verified?: boolean; verification_status?: string; role?: string; page_handle?: string;
};
type Ctx = { session: Session | null; profile: Profile | null; loading: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };
const C = createContext<Ctx>({ session: null, profile: null, loading: true, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = async (s: Session | null) => {
    if (!s) { setProfile(null); return; }
    const { data } = await db.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? { id: s.user.id });
  };

  useEffect(() => {
    db.auth.getSession().then(async ({ data }) => {
      setSession(data.session); await loadProfile(data.session); setLoading(false);
    });
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => { setSession(s); loadProfile(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  return (
    <C.Provider value={{
      session, profile, loading,
      refresh: () => loadProfile(session),
      signOut: async () => { await db.auth.signOut(); },
    }}>{children}</C.Provider>
  );
}
export const useAuth = () => useContext(C);
