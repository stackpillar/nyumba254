import AsyncStorage from '@react-native-async-storage/async-storage';

const P = 'nkapp:';
export async function getJSON<T>(key: string, fallback: T): Promise<T> {
  try { const v = await AsyncStorage.getItem(P + key); return v ? (JSON.parse(v) as T) : fallback; } catch { return fallback; }
}
export async function setJSON(key: string, value: unknown) {
  try { await AsyncStorage.setItem(P + key, JSON.stringify(value)); } catch { /* storage full: ignore */ }
}

export async function getSaved(): Promise<string[]> { return getJSON<string[]>('saved', []); }
export async function toggleSaved(id: string): Promise<boolean> {
  const cur = await getSaved();
  const has = cur.includes(id);
  await setJSON('saved', has ? cur.filter((x) => x !== id) : [id, ...cur]);
  return !has;
}
