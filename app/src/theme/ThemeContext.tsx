import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { THEMES, Theme, ThemeName } from './tokens';

// Keys are prefixed "nkapp:" so they can never collide with the website's storage.
const KEY = 'nkapp:theme';
type Ctx = { theme: Theme; setTheme: (n: ThemeName) => void };
const C = createContext<Ctx>({ theme: THEMES.emerald, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [name, setName] = useState<ThemeName>('emerald');
  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => { if (v && v in THEMES) setName(v as ThemeName); }).catch(() => {});
  }, []);
  const value = useMemo(() => ({
    theme: THEMES[name],
    setTheme: (n: ThemeName) => { setName(n); AsyncStorage.setItem(KEY, n).catch(() => {}); },
  }), [name]);
  return <C.Provider value={value}>{children}</C.Provider>;
}
export const useTheme = () => useContext(C);
