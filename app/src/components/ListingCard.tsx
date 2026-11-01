import React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Listing, CATEGORIES, coverPhoto, formatPrice, imgSrc, isFreeViewing, roleText, viewingFeeText } from '../lib/data';
import { useTheme } from '../theme/ThemeContext';
import { RADIUS_LG, FONT } from '../theme/tokens';
import { Chip, T } from './ui';

export function ListingCard({ l, onPress }: { l: Listing; onPress: () => void }) {
  const { theme } = useTheme();
  const photo = coverPhoto(l);
  const role = roleText(l);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${l.title}, ${formatPrice(l, true)}`} onPress={onPress}
      style={{ backgroundColor: theme.card, borderRadius: RADIUS_LG, borderWidth: 1, borderColor: theme.border, marginBottom: 14, overflow: 'hidden' }}>
      <View style={{ aspectRatio: 16 / 10, backgroundColor: theme.greenLight }}>
        {photo ? <Image source={{ uri: imgSrc(photo.url, 600) }} style={{ flex: 1 }} contentFit="cover" transition={150} /> : null}
        {l.is_featured ? <View style={{ position: 'absolute', top: 10, left: 10 }}><Chip label="Featured" tone="gold" /></View> : null}
      </View>
      <View style={{ padding: 12, gap: 4 }}>
        <T style={{ fontFamily: FONT.serif, fontSize: 17, color: theme.green }}>{formatPrice(l, true)}</T>
        <T bold numberOfLines={2}>{l.title}</T>
        <T small muted>{l.area}{l.county ? `, ${l.county}` : ''} · {CATEGORIES[l.category]?.label ?? l.category}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          <Chip label={viewingFeeText(l)} tone={isFreeViewing(l) ? 'green' : 'muted'} />
          <Chip label={role.short} tone={role.identityChecked ? 'green' : 'muted'} />
        </View>
      </View>
    </Pressable>
  );
}
