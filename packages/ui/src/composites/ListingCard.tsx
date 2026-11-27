/**
 * ListingCard Composite
 * Main property listing card used across web and mobile
 */

import React from 'react';
import { View, Text, Image, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Card } from '../primitives/Card';
import { Badge } from '../primitives/Badge';
import { Avatar } from '../primitives/Avatar';
import { formatPrice, formatRelativeTime, getInitials } from '@nyumba254/core';
import { cn } from '@nyumba254/design-system';

export interface ListingCardProps {
  listing: {
    id: string;
    listing_number: number;
    title: string;
    area: string;
    county?: string;
    category: string;
    price: number;
    price_frequency: string;
    status: string;
    is_featured?: boolean;
    listing_photos?: Array<{ url: string; is_cover?: boolean; position?: number }>;
    listing_videos?: Array<{ id: string }>;
    profiles?: {
      full_name?: string;
      identity_verified?: boolean;
      verification_status?: string;
      account_type?: string;
      verified_role?: string;
      page_handle?: string;
    } | null;
    public_viewing_fee?: number | null;
    viewing_fee_status?: 'loaded' | 'error';
    created_at: string;
  };
  variant?: 'default' | 'compact' | 'featured';
  onPress?: () => void;
  onSave?: () => void;
  onShare?: () => void;
  isSaved?: boolean;
  showActions?: boolean;
  compact?: boolean;
}

const categoryColors: Record<string, { bg: string; text: string; border?: string }> = {
  apartment: { bg: '#0F6E56', text: '#FFFFFF' },
  house: { bg: '#085041', text: '#FFFFFF' },
  boarding: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
  airbnb: { bg: '#FFFFFF', text: '#085041', border: '#0F6E56' },
  commercial: { bg: '#1A1A18', text: '#FFFFFF' },
};

const freqLabels: Record<string, string> = {
  month: '/mo',
  night: '/night',
  week: '/week',
  term: '/term',
  semester: '/semester',
  once: '',
};

const getCoverPhoto = (photos?: ListingCardProps['listing']['listing_photos']) => {
  if (!photos?.length) return null;
  const sorted = [...photos].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted.find(p => p.is_cover) ?? sorted[0];
};

const baseStyles = StyleSheet.create({
  card: {
    borderRadius: 18,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  cardCompact: {
    flexDirection: 'row',
    minHeight: 120,
  },
  imageWrapper: {
    aspectRatio: 4 / 3,
    backgroundColor: '#F7F6F2',
    position: 'relative',
  },
  imageWrapperCompact: {
    width: 120,
    aspectRatio: 1,
    borderRadius: 0,
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  badges: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 2,
  },
  heartButton: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 3,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoCount: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    zIndex: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoCountText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  content: {
    padding: 16,
    flex: 1,
  },
  contentCompact: {
    padding: 12,
    justifyContent: 'space-between',
  },
  areaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  areaText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0F6E56',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Inter_700Bold',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#E1F5EE',
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 20,
  },
  verifiedText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#085041',
    fontFamily: 'Inter_700Bold',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1A1A18',
    marginBottom: 3,
    lineHeight: 20,
    fontFamily: 'Inter_700Bold',
  },
  titleCompact: {
    fontSize: 14,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12.5,
    color: '#6B6A63',
    marginBottom: 12,
    fontFamily: 'Inter_400Regular',
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginTop: 8,
  },
  price: {
    fontSize: 18,
    fontWeight: '700',
    color: '#085041',
    fontFamily: 'Inter_700Bold',
  },
  priceCompact: {
    fontSize: 16,
  },
  priceFreq: {
    fontSize: 13,
    fontWeight: '500',
    color: '#4A4A46',
    fontFamily: 'Inter_500Medium',
  },
  listerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0DED8',
  },
  listerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  listerInfo: {
    flex: 1,
    minWidth: 0,
  },
  listerName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A18',
    fontFamily: 'Inter_600SemiBold',
  },
  listerRole: {
    fontSize: 11.5,
    color: '#6B6A63',
    fontFamily: 'Inter_400Regular',
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E0DED8',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E0DED8',
    backgroundColor: '#FFFFFF',
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4A46',
    fontFamily: 'Inter_600SemiBold',
  },
  actionButtonPrimary: {
    backgroundColor: '#0F6E56',
    borderColor: '#0F6E56',
  },
  actionButtonPrimaryText: {
    color: '#FFFFFF',
  },
});

export const ListingCard = React.forwardRef<HTMLDivElement, ListingCardProps>(
  (
    {
      listing,
      variant = 'default',
      onPress,
      onSave,
      onShare,
      isSaved = false,
      showActions = true,
      compact = false,
      style,
      className,
    },
    ref
  ) => {
    const coverPhoto = getCoverPhoto(listing.listing_photos);
    const catColors = categoryColors[listing.category] || categoryColors.apartment;
    const isBoarding = listing.category === 'boarding';
    const pricePrefix = isBoarding ? 'From ' : '';
    const formattedPrice = `${pricePrefix}KES ${Number(listing.price || 0).toLocaleString('en-KE')}${freqLabels[listing.price_frequency] ?? ''}`;

    // Role text
    const listedByType = listing.profiles?.account_type || '';
    const currentRole = listing.profiles?.account_type;
    const roleChanged = !!listedByType && !!currentRole && currentRole !== listedByType;
    const roleVerified = !!listedByType && !roleChanged && listing.profiles?.verified_role === listedByType;

    const roleLabels: Record<string, string> = {
      buyer: 'Tenant / Buyer',
      owner: 'Direct from owner',
      landlord: 'Direct from owner',
      caretaker: 'Caretaker',
      agent: 'Agent',
      company: 'Company',
      seller: 'Lister',
    };

    const shortRoleLabels: Record<string, string> = {
      buyer: 'Tenant',
      owner: 'Owner',
      landlord: 'Owner',
      caretaker: 'Caretaker',
      agent: 'Agent',
      company: 'Company',
      seller: 'Lister',
    };

    const roleText = listedByType
      ? `${roleLabels[listedByType] ?? 'Lister'}${roleChanged ? ' (role changed, not verified)' : roleVerified ? ' · identity checked' : ' (not verified)'}`
      : 'Lister (not verified)';

    const shortRoleText = listedByType
      ? `${shortRoleLabels[listedByType] ?? 'Lister'}${roleChanged ? ' · unverified' : roleVerified ? ' · checked' : ''}`
      : 'Lister';

    const listerName = listing.profiles?.full_name || 'Lister';
    const identityChecked = listing.profiles?.identity_verified === true || listing.profiles?.verification_status === 'verified';

    // Viewing fee
    const feeLoaded = listing.viewing_fee_status !== 'error' && listing.public_viewing_fee != null;
    const fee = Number(listing.public_viewing_fee) || 0;
    const viewingFeeText = feeLoaded
      ? fee > 0
        ? `Viewing KES ${fee.toLocaleString('en-KE')}`
        : 'Free viewing'
      : 'Viewing fee: confirm with the lister';

    const isCompact = compact || variant === 'compact';

    return (
      <Card
        ref={ref}
        variant="default"
        padding="none"
        onPress={onPress}
        style={[
          baseStyles.card,
          isCompact && baseStyles.cardCompact,
          style,
        ]}
        className={cn(className, 'group')}
      >
        <View style={isCompact ? baseStyles.imageWrapperCompact : baseStyles.imageWrapper}>
          {coverPhoto ? (
            <Image
              source={{ uri: coverPhoto.url }}
              style={baseStyles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={baseStyles.placeholder}>
              <Text style={{ color: '#888780', fontSize: 14 }}>🏠</Text>
            </View>
          )}

          {/* Badges */}
          <View style={baseStyles.badges}>
            {listing.is_featured && (
              <Badge variant="warning" size="sm">★ Featured</Badge>
            )}
            {listing.status === 'active' && (
              <Badge variant="success" size="sm" dot dotColor="#1D9E75">
                Active
              </Badge>
            )}
          </View>

          {/* Category badge */}
          <View style={baseStyles.categoryBadge}>
            <Badge
              variant={listing.category === 'boarding' ? 'outline' : 'default'}
              size="sm"
              style={{ backgroundColor: catColors.bg, borderColor: catColors.border }}
            >
              <Text style={{ color: catColors.text, fontSize: 10.5, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>
                {listing.category.charAt(0).toUpperCase() + listing.category.slice(1)}
              </Text>
            </Badge>
          </View>

          {/* Heart button */}
          <TouchableOpacity style={baseStyles.heartButton} onPress={onSave} activeOpacity={0.8}>
            <Text style={{ fontSize: 20 }}>{isSaved ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>

          {/* Photo count */}
          {listing.listing_photos && listing.listing_photos.length > 1 && (
            <View style={baseStyles.photoCount}>
              <Text>📷</Text>
              <Text style={baseStyles.photoCountText}>{listing.listing_photos.length}</Text>
            </View>
          )}
        </View>

        <View style={isCompact ? baseStyles.contentCompact : baseStyles.content}>
          {/* Area */}
          <View style={baseStyles.areaRow}>
            <Text>📍</Text>
            <Text style={baseStyles.areaText}>{listing.area}{listing.county ? `, ${listing.county}` : ''}</Text>
            {listing.profiles?.verified_role === listing.profiles?.account_type && (
              <View style={baseStyles.verifiedBadge}>
                <Text style={{ fontSize: 9, color: '#085041' }}>✓</Text>
                <Text style={baseStyles.verifiedText}>Verified</Text>
              </View>
            )}
          </View>

          {/* Title */}
          <Text style={[baseStyles.title, isCompact && baseStyles.titleCompact]}>
            {listing.title}
          </Text>

          {/* Subtitle */}
          {!isCompact && (
            <Text style={baseStyles.subtitle}>
              {roleText}
            </Text>
          )}

          {/* Price */}
          <View style={baseStyles.priceRow}>
            <Text style={[baseStyles.price, isCompact && baseStyles.priceCompact]}>{formattedPrice}</Text>
            <Text style={baseStyles.priceFreq}>{freqLabels[listing.price_frequency] ?? ''}</Text>
          </View>

          {/* Lister info */}
          {!isCompact && listing.profiles && (
            <View style={baseStyles.listerRow}>
              <Avatar
                name={listerName}
                size="sm"
                fallbackColor="#0F6E56"
              />
              <View style={baseStyles.listerInfo}>
                <Text style={baseStyles.listerName}>{listerName}</Text>
                <Text style={baseStyles.listerRole}>
                  {shortRoleText}{identityChecked ? ' · ID verified' : ''}
                </Text>
              </View>
            </View>
          )}

          {/* Actions */}
          {!isCompact && showActions && (
            <View style={baseStyles.actions}>
              <TouchableOpacity
                style={[baseStyles.actionButton, isSaved && baseStyles.actionButtonPrimary]}
                onPress={onSave}
                activeOpacity={0.8}
              >
                <Text style={[baseStyles.actionButtonText, isSaved && baseStyles.actionButtonPrimaryText]}>
                  {isSaved ? 'Saved' : 'Save'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[baseStyles.actionButton, baseStyles.actionButtonPrimary]}
                onPress={onShare}
                activeOpacity={0.8}
              >
                <Text style={baseStyles.actionButtonPrimaryText}>Share</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Viewing fee indicator */}
          {!isCompact && (
            <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#E0DED8' }}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: feeLoaded && fee === 0 ? '#085041' : '#6B6A63', fontFamily: 'Inter_600SemiBold' }}>
                {viewingFeeText}
              </Text>
            </View>
          )}
        </View>
      </Card>
    );
  }
);

ListingCard.displayName = 'ListingCard';