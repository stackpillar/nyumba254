import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// Same Supabase project as the website. Only the public (publishable) key is used here.
const extra = (Constants.expoConfig?.extra ?? {}) as { supabaseUrl?: string; supabaseKey?: string };
export const SUPABASE_URL = extra.supabaseUrl ?? 'https://vliuuloyfhyxcsuchpss.supabase.co';
export const SUPABASE_KEY = extra.supabaseKey ?? 'sb_publishable_oIIcecf3wzKMual5K24Z8Q_zmxVfgsx';

// SecureStore values are limited to ~2KB on some devices, so sessions are chunked.
const CHUNK = 1800;
const secureStorage = {
  async getItem(key: string) {
    const n = await SecureStore.getItemAsync(`${key}.n`);
    if (!n) return SecureStore.getItemAsync(key);
    let out = '';
    for (let i = 0; i < Number(n); i++) out += (await SecureStore.getItemAsync(`${key}.${i}`)) ?? '';
    return out || null;
  },
  async setItem(key: string, value: string) {
    const parts = Math.ceil(value.length / CHUNK);
    for (let i = 0; i < parts; i++) await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK, (i + 1) * CHUNK));
    await SecureStore.setItemAsync(`${key}.n`, String(parts));
  },
  async removeItem(key: string) {
    const n = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0);
    for (let i = 0; i < n; i++) await SecureStore.deleteItemAsync(`${key}.${i}`);
    await SecureStore.deleteItemAsync(`${key}.n`);
    await SecureStore.deleteItemAsync(key);
  },
};

export const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
});
