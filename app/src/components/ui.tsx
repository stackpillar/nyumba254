import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';
import { FONT, RADIUS } from '../theme/tokens';

export function H1({ children, style }: { children: React.ReactNode; style?: any }) {
  const { theme } = useTheme();
  return <Text style={[{ fontFamily: FONT.serif, fontSize: 24, color: theme.text }, style]}>{children}</Text>;
}
export function T({ children, style, bold, small, muted, numberOfLines }: { children: React.ReactNode; style?: any; bold?: boolean; small?: boolean; muted?: boolean; numberOfLines?: number }) {
  const { theme } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontFamily: bold ? FONT.sansSemi : FONT.sans, fontSize: small ? 12 : 14, color: muted ? theme.text3 : theme.text, lineHeight: small ? 17 : 20 }, style]}>
      {children}
    </Text>
  );
}

export function Button({ title, onPress, kind = 'primary', loading, disabled, style }: { title: string; onPress: () => void; kind?: 'primary' | 'outline' | 'danger'; loading?: boolean; disabled?: boolean; style?: ViewStyle }) {
  const { theme } = useTheme();
  const bg = kind === 'primary' ? theme.green : kind === 'danger' ? theme.red : 'transparent';
  const fg = kind === 'outline' ? theme.green : '#fff';
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={title}
      onPress={onPress} disabled={disabled || loading}
      style={[{ minHeight: 48, borderRadius: RADIUS, backgroundColor: bg, borderWidth: kind === 'outline' ? 1.5 : 0, borderColor: theme.green, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, opacity: disabled ? 0.5 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text style={{ color: fg, fontFamily: FONT.sansSemi, fontSize: 15 }}>{title}</Text>}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { theme } = useTheme();
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={{ fontFamily: FONT.sansSemi, fontSize: 13, color: theme.text2, marginBottom: 4 }}>{label}</Text>
      <TextInput
        accessibilityLabel={label} placeholderTextColor={theme.text3}
        style={[{ minHeight: 48, borderWidth: 1, borderColor: theme.border, borderRadius: RADIUS, backgroundColor: theme.card, color: theme.text, paddingHorizontal: 12, fontFamily: FONT.sans, fontSize: 15 }, style]}
        {...rest}
      />
    </View>
  );
}

export function Chip({ label, tone = 'green', onPress, active }: { label: string; tone?: 'green' | 'gold' | 'red' | 'muted'; onPress?: () => void; active?: boolean }) {
  const { theme } = useTheme();
  const map = {
    green: [theme.greenLight, theme.greenDark], gold: [theme.goldLight, theme.gold],
    red: [theme.redLight, theme.red], muted: [theme.surface, theme.text2],
  } as const;
  const [bg, fg] = active ? [theme.green, '#fff'] : map[tone];
  const body = <Text style={{ fontFamily: FONT.sansSemi, fontSize: 12, color: fg }}>{label}</Text>;
  const style = { backgroundColor: bg, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: active ? theme.green : theme.border, minHeight: onPress ? 36 : undefined, justifyContent: 'center' as const };
  return onPress ? <Pressable accessibilityRole="button" onPress={onPress} style={style}>{body}</Pressable> : <View style={style}>{body}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { theme } = useTheme();
  return <View style={[{ backgroundColor: theme.card, borderRadius: RADIUS * 1.6, borderWidth: 1, borderColor: theme.border, padding: 14, marginBottom: 12 }, style]}>{children}</View>;
}

export function Empty({ text }: { text: string }) {
  return <View style={st.empty}><T muted style={{ textAlign: 'center' }}>{text}</T></View>;
}
export function Loading() {
  const { theme } = useTheme();
  return <View style={st.empty}><ActivityIndicator color={theme.green} /></View>;
}
const st = StyleSheet.create({ empty: { padding: 32, alignItems: 'center' } });
