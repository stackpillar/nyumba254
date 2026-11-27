/**
 * Listing Detail Screen
 */

import React, { useState } from 'react';
import { View, Text, Image, ScrollView, StyleSheet, TouchableOpacity, FlatList, Dimensions } from 'react-native';
import { useTheme } from '@nyumba254/ui';
import { Button, Badge, Avatar } from '@nyumba254/ui';
import { formatPrice, formatRelativeTime } from '@nyumba254/core';
import { cn } from '@nyumba254/design-system';

const { width } = Dimensions.get('window');

export default function ListingScreen({ route, navigation }: any) {
  const { theme } = useTheme();
  const { id } = route.params;
  const [activeImage, setActiveImage] = useState(0);
  const [showContact, setShowContact] = useState(false);

  // Mock data - in production, fetch from API
  const listing = {
    id: id,
    listing_number: 100001,
    title: 'Modern 2BR Apartment in Kilimani',
    area: 'Kilimani',
    county: 'Nairobi',
    category: 'apartment',
    price: 65000,
    price_frequency: 'month',
    status: 'active',
    is_featured: true,
    description: 'Beautiful modern 2 bedroom apartment in the heart of Kilimani. Features spacious living area, modern kitchen with appliances, en-suite master bedroom, balcony with city views, and secure parking. Close to shopping malls, restaurants, and major roads.',
    listing_photos: [
      { url: 'https://nyumba254.com/hero-kenya-apartments.jpg', is_cover: true, position: 0 },
      { url: 'https://nyumba254.com/hero-photo-3.jpg', position: 1 },
      { url: 'https://nyumba254.com/hero-photo-4.jpg', position: 2 },
    ],
    listing_videos: [],
    amenities: ['Parking', 'Security', 'Water', 'Internet Ready', 'Balcony', 'Backup Generator'],
    details: {
      bedrooms: 2,
      bathrooms: 2,
      furnished: 'unfurnished',
      floor_area: '85 sqm',
    },
    profiles: {
      full_name: 'Jane Mwangi',
      identity_verified: true,
      verification_status: 'verified',
      account_type: 'owner',
      verified_role: 'owner',
      page_handle: 'jane-properties',
    },
    public_viewing_fee: 0,
    viewing_fee_status: 'loaded',
    created_at: new Date().toISOString(),
    latitude: -1.2921,
    longitude: 36.8219,
  };

  const photos = listing.listing_photos || [];
  const coverPhoto = photos.find(p => p.is_cover) || photos[0];
  const isBoarding = listing.category === 'boarding';
  const pricePrefix = isBoarding ? 'From ' : '';
  const freqLabels: Record<string, string> = {
    month: '/mo',
    night: '/night',
    week: '/week',
    term: '/term',
    semester: '/semester',
    once: '',
  };
  const formattedPrice = `${pricePrefix}KES ${Number(listing.price || 0).toLocaleString('en-KE')}${freqLabels[listing.price_frequency] ?? ''}`;

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

  const identityChecked = listing.profiles?.identity_verified === true || listing.profiles?.verification_status === 'verified';

  const feeLoaded = listing.viewing_fee_status !== 'error' && listing.public_viewing_fee != null;
  const fee = Number(listing.public_viewing_fee) || 0;
  const viewingFeeText = feeLoaded
    ? fee > 0
      ? `Viewing KES ${fee.toLocaleString('en-KE')}`
      : 'Free viewing'
    : 'Viewing fee: confirm with the lister';

  const categoryLabels: Record<string, string> = {
    apartment: 'Apartment',
    house: 'House',
    boarding: 'Boarding House',
    airbnb: 'Airbnb / Holiday Rental',
    commercial: 'Shops & Offices',
  };

  const categoryColors: Record<string, { bg: string; text: string; border?: string }> = {
    apartment: { bg: '#0F6E56', text: '#FFFFFF' },
    house: { bg: '#085041', text: '#FFFFFF' },
    boarding: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
    airbnb: { bg: '#FFFFFF', text: '#085041', border: '#0F6E56' },
    commercial: { bg: '#1A1A18', text: '#FFFFFF' },
  };

  const catColors = categoryColors[listing.category] || categoryColors.apartment;

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]} contentContainerStyle={styles.content}>
      {/* Gallery */}
      <View style={styles.gallery}>
        <Image
          source={{ uri: coverPhoto?.url }}
          style={styles.galleryImage}
          resizeMode="cover"
        />

        {/* Category badge */}
        <View style={styles.categoryBadge}>
          <Badge
            variant={listing.category === 'boarding' ? 'outline' : 'default'}
            size="sm"
            style={{ backgroundColor: catColors.bg, borderColor: catColors.border }}
          >
            <Text style={{ color: catColors.text, fontSize: 10.5, fontWeight: '700', fontFamily: 'Inter_700Bold' }}>
              {categoryLabels[listing.category] || listing.category}
            </Text>
          </Badge>
        </View>

        {/* Featured badge */}
        {listing.is_featured && (
          <View style={styles.featuredBadge}>
            <Badge variant="warning" size="sm">★ Featured</Badge>
          </View>
        )}

        {/* Image navigation */}
        {photos.length > 1 && (
          <>
            <TouchableOpacity
              style={styles.navButton}
              onPress={() => setActiveImage((prev) => (prev - 1 + photos.length) % photos.length)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, color: '#FFFFFF' }}>‹</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.navButton, styles.navButtonRight]}
              onPress={() => setActiveImage((prev) => (prev + 1) % photos.length)}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 24, color: '#FFFFFF' }}>›</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Thumbnail strip */}
        {photos.length > 1 && (
          <FlatList
            data={photos}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbnailStrip}
            keyExtractor={(item) => item.url}
            renderItem={({ item, index }) => (
              <TouchableOpacity
                style={[
                  styles.thumbnail,
                  index === activeImage && styles.thumbnailActive,
                ]}
                onPress={() => setActiveImage(index)}
              >
                <Image
                  source={{ uri: item.url }}
                  style={styles.thumbnailImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )}
          />
        )}

        {/* Viewing fee badge */}
        <View style={styles.viewingFeeBadge}>
          <Badge
            variant={feeLoaded && fee === 0 ? 'success' : 'default'}
            size="md"
          >
            {viewingFeeText}
          </Badge>
        </View>
      </View>

      {/* Content */}
      <View style={styles.details}>
        {/* Title & Location */}
        <View style={styles.titleSection}>
          <View style={styles.locationRow}>
            <Text style={styles.locationIcon}>📍</Text>
            <Text style={styles.locationText}>{listing.area}{listing.county ? `, ${listing.county}` : ''}</Text>
          </View>
          <Text style={styles.title}>{listing.title}</Text>

          {/* Lister info */}
          <View style={styles.listerRow}>
            <Avatar
              name={listing.profiles?.full_name || 'Lister'}
              size="sm"
              fallbackColor={theme.colors.primary}
            />
            <View style={styles.listerInfo}>
              <Text style={styles.listerName}>{listing.profiles?.full_name || 'Lister'}</Text>
              <Text style={styles.listerRole}>
                {listedByType ? `${shortRoleLabels[listedByType] ?? 'Lister'}${roleChanged ? ' · unverified' : roleVerified ? ' · verified' : ''}` : 'Lister'}
                {identityChecked && <Text style={{ color: theme.colors.primary, marginLeft: 4 }}>✓ Verified</Text>}
              </Text>
            </View>
          </View>
        </View>

        {/* Price */}
        <View style={styles.priceSection}>
          <Text style={styles.priceLabel}>Monthly rent</Text>
          <Text style={styles.price}>{formattedPrice}</Text>
        </View>

        {/* Viewing Fee */}
        <View style={styles.viewingFeeSection}>
          <View style={styles.viewingFeeRow}>
            <View style={[styles.viewingFeeIcon, { backgroundColor: theme.colors.primary + '20' }]}>
              <Text style={{ fontSize: 20 }}>📅</Text>
            </View>
            <View>
              <Text style={styles.viewingFeeLabel}>Viewing fee</Text>
              <Text style={[styles.viewingFeeValue, { color: feeLoaded && fee === 0 ? theme.colors.success : theme.colors.text }]}>
                {viewingFeeText}
              </Text>
            </View>
          </View>
          <Text style={styles.viewingFeeNote}>
            You pay the viewing fee directly to the lister at the property. Nyumba254 does not collect viewing fees.
          </Text>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{listing.description}</Text>
        </View>

        {/* Details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Property Details</Text>
          <View style={styles.detailsGrid}>
            <DetailItem label="Bedrooms" value={listing.details?.bedrooms ?? '—'} />
            <DetailItem label="Bathrooms" value={listing.details?.bathrooms ?? '—'} />
            <DetailItem label="Furnished" value={listing.details?.furnished ?? '—'} />
            <DetailItem label="Floor Area" value={listing.details?.floor_area ?? '—'} />
          </View>
        </View>

        {/* Amenities */}
        {listing.amenities && listing.amenities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Amenities</Text>
            <View style={styles.amenitiesGrid}>
              {listing.amenities.map((amenity) => (
                <View key={amenity} style={styles.amenityChip}>
                  <Text style={styles.amenityText}>{amenity}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <Button onPress={() => setShowContact(true)} size="lg" fullWidth>
            Message Lister
          </Button>
          <Button variant="outline" size="lg" fullWidth onPress={() => navigation.navigate('ViewingRequest', { listingId: id })}>
            Request Viewing
          </Button>
          <Button variant="ghost" size="lg" fullWidth>
            Save
          </Button>
        </View>

        {/* Share */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Share this listing</Text>
          <View style={styles.shareButtons}>
            <Button variant="outline" size="md" className="flex-1">
              WhatsApp
            </Button>
            <Button variant="outline" size="md" className="flex-1">
              Copy Link
            </Button>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.detailItem}>
      <Text style={[styles.detailLabel, { color: theme.colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 100 },
  gallery: {
    width: '100%',
    aspectRatio: 4 / 3,
    backgroundColor: theme.colors.muted,
    position: 'relative',
  },
  galleryImage: {
    width: '100%',
    height: '100%',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 12,
    left: 12,
    zIndex: 2,
  },
  featuredBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    left: 12,
    marginTop: -24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  navButtonRight: {
    left: 'auto',
    right: 12,
  },
  thumbnailStrip: {
    position: 'absolute',
    bottom: 12,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    flexDirection: 'row',
    gap: 8,
    zIndex: 2,
  },
  thumbnail: {
    width: 64,
    height: 40,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  thumbnailActive: {
    borderColor: theme.colors.primary,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  viewingFeeBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    zIndex: 2,
  },
  details: { padding: 16 },
  titleSection: { marginBottom: 16 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  locationIcon: { fontSize: 14 },
  locationText: { fontSize: 14, color: '#6B6A63', fontWeight: '600' },
  title: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 24, fontWeight: '700', marginBottom: 12 },
  listerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#E0DED8' },
  listerInfo: { flex: 1 },
  listerName: { fontSize: 16, fontWeight: '600' },
  listerRole: { fontSize: 13, color: '#6B6A63', marginTop: 2 },
  priceSection: { marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: '#E0DED8' },
  priceLabel: { fontSize: 14, color: '#6B6A63', marginBottom: 4 },
  price: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 28, fontWeight: '700', color: '#085041' },
  viewingFeeSection: { marginBottom: 24, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E0DED8', backgroundColor: '#F7F6F2' },
  viewingFeeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  viewingFeeIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  viewingFeeLabel: { fontSize: 13, color: '#6B6A63', marginBottom: 2 },
  viewingFeeValue: { fontSize: 16, fontWeight: '600' },
  viewingFeeNote: { fontSize: 12, color: '#6B6A63', marginTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontFamily: 'PlayfairDisplay_700Bold', fontSize: 20, fontWeight: '600', marginBottom: 12 },
  description: { fontSize: 15, lineHeight: 24, color: '#4A4A46' },
  detailsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  amenitiesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  amenityChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#E0DED8', backgroundColor: '#FFFFFF' },
  amenityText: { fontSize: 13, color: '#4A4A46' },
  actions: { flexDirection: 'column', gap: 12, marginBottom: 24 },
  shareButtons: { flexDirection: 'row', gap: 12 },
  detailItem: { flex: 1, minWidth: '45%' },
  detailLabel: { fontSize: 12, marginBottom: 4 },
  detailValue: { fontSize: 16, fontWeight: '600' },
});

// Need to import useTheme
import { useTheme } from '@nyumba254/ui';