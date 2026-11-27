/**
 * Listing Detail Component
 */

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ListingCard, Button, Badge, Avatar } from '@nyumba254/ui';
import { formatPrice, formatRelativeTime, getInitials } from '@nyumba254/core';
import { cn } from '@nyumba254/design-system';

interface ListingDetailProps {
  listingId: string;
}

const freqLabels: Record<string, string> = {
  month: '/mo',
  night: '/night',
  week: '/week',
  term: '/term',
  semester: '/semester',
  once: '',
};

const categoryLabels: Record<string, string> = {
  apartment: 'Apartment',
  house: 'House',
  boarding: 'Boarding House',
  airbnb: 'Airbnb / Holiday Rental',
  commercial: 'Shops & Offices',
};

const roleLabels: Record<string, string> = {
  buyer: 'Tenant / Buyer',
  owner: 'Direct from owner',
  landlord: 'Direct from owner',
  caretaker: 'Caretaker',
  agent: 'Agent',
  company: 'Company',
  seller: 'Lister',
};

export function ListingDetail({ listingId }: ListingDetailProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [showContact, setShowContact] = useState(false);

  // Mock data - in production, fetch from API
  const listing = {
    id: listingId,
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
      { url: '/hero-kenya-apartments.jpg', is_cover: true, position: 0 },
      { url: '/hero-photo-3.jpg', position: 1 },
      { url: '/hero-photo-4.jpg', position: 2 },
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
  const formattedPrice = `${pricePrefix}KES ${Number(listing.price || 0).toLocaleString('en-KE')}${freqLabels[listing.price_frequency] ?? ''}`;

  const listedByType = listing.profiles?.account_type || '';
  const currentRole = listing.profiles?.account_type;
  const roleChanged = !!listedByType && !!currentRole && currentRole !== listedByType;
  const roleVerified = !!listedByType && !roleChanged && listing.profiles?.verified_role === listedByType;

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

  const categoryColors: Record<string, { bg: string; text: string; border?: string }> = {
    apartment: { bg: '#0F6E56', text: '#FFFFFF' },
    house: { bg: '#085041', text: '#FFFFFF' },
    boarding: { bg: '#E1F5EE', text: '#085041', border: '#9FE1CB' },
    airbnb: { bg: '#FFFFFF', text: '#085041', border: '#0F6E56' },
    commercial: { bg: '#1A1A18', text: '#FFFFFF' },
  };

  const catColors = categoryColors[listing.category] || categoryColors.apartment;

  return (
    <article className="min-h-screen bg-white">
      {/* Navigation breadcrumbs would go here */}

      {/* Gallery */}
      <section className="relative">
        <div className="aspect-[4/3] bg-[#F7F6F2] relative overflow-hidden">
          {coverPhoto && (
            <Image
              src={coverPhoto.url}
              alt={listing.title}
              fill
              priority
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          )}

          {/* Category badge */}
          <div className="absolute bottom-4 left-4 z-10">
            <span
              className={cn(
                'inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider',
                catColors.bg === '#FFFFFF'
                  ? 'bg-white text-[#085041] border border-[#0F6E56]'
                  : catColors.bg === '#E1F5EE'
                  ? 'bg-[#E1F5EE] text-[#085041] border border-[#9FE1CB]'
                  : `bg-${catColors.bg.replace('#', '')} text-white`
              )}
            >
              {categoryLabels[listing.category] || listing.category}
            </span>
          </div>

          {/* Featured badge */}
          {listing.is_featured && (
            <div className="absolute top-4 left-4 z-10">
              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-yellow-500 text-white text-xs font-bold">
                ★ Featured
              </span>
            </div>
          )}

          {/* Image navigation */}
          {photos.length > 1 && (
            <>
              <button
                className="absolute left-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                onClick={() => setActiveImage((prev) => (prev - 1 + photos.length) % photos.length)}
                aria-label="Previous image"
              >
                <svg className="w-6 h-6 text-[#1A1A18]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 z-10 w-12 h-12 rounded-full bg-white/90 shadow-lg flex items-center justify-center hover:bg-white transition-colors"
                onClick={() => setActiveImage((prev) => (prev + 1) % photos.length)}
                aria-label="Next image"
              >
                <svg className="w-6 h-6 text-[#1A1A18]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Thumbnail strip */}
          {photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
              {photos.map((photo, index) => (
                <button
                  key={photo.url}
                  onClick={() => setActiveImage(index)}
                  className={cn(
                    'w-16 h-10 rounded-lg overflow-hidden border-2 transition-all',
                    index === activeImage ? 'border-[#0F6E56]' : 'border-white/50 hover:border-white/70'
                  )}
                  aria-label={`View image ${index + 1}`}
                >
                  <Image
                    src={photo.url}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Viewing fee badge */}
        <div className="absolute bottom-4 right-4 z-10">
          <span className={cn(
            'inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold',
            feeLoaded && fee === 0
              ? 'bg-[#E1F5EE] text-[#085041]'
              : 'bg-white text-[#1A1A18] shadow-lg'
          )}>
            {viewingFeeText}
          </span>
        </div>
      </section>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8 py-8 md:py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-8">
            {/* Title & Location */}
            <div>
              <div className="flex items-center gap-2 text-sm text-[#6B6A63] mb-2">
                <span>📍</span>
                <span>{listing.area}{listing.county ? `, ${listing.county}` : ''}</span>
              </div>
              <h1 className="font-serif text-3xl md:text-4xl text-[#1A1A18] leading-tight mb-4">
                {listing.title}
              </h1>

              {/* Lister info */}
              <div className="flex items-center gap-4 p-4 bg-[#F7F6F2] rounded-xl">
                <Avatar
                  name={listing.profiles?.full_name || 'Lister'}
                  size="md"
                  fallbackColor="#0F6E56"
                />
                <div>
                  <p className="font-semibold text-[#1A1A18]">{listing.profiles?.full_name || 'Lister'}</p>
                  <p className="text-sm text-[#6B6A63]">
                    {roleText}
                    {identityChecked && <span className="text-[#0F6E56] font-medium ml-1">· ID verified</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Description */}
            <div className="prose prose-gray max-w-none">
              <h2 className="font-serif text-2xl text-[#1A1A18] mb-4">Description</h2>
              <p className="text-[#4A4A46] leading-relaxed whitespace-pre-line">{listing.description}</p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-6 bg-[#F7F6F2] rounded-xl">
              <div>
                <p className="text-xs text-[#6B6A63] uppercase tracking-wider mb-1">Bedrooms</p>
                <p className="font-semibold text-[#1A1A18]">{listing.details?.bedrooms ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#6B6A63] uppercase tracking-wider mb-1">Bathrooms</p>
                <p className="font-semibold text-[#1A1A18]">{listing.details?.bathrooms ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#6B6A63] uppercase tracking-wider mb-1">Furnished</p>
                <p className="font-semibold text-[#1A1A18] capitalize">{listing.details?.furnished ?? '—'}</p>
              </div>
              <div>
                <p className="text-xs text-[#6B6A63] uppercase tracking-wider mb-1">Floor Area</p>
                <p className="font-semibold text-[#1A1A18]">{listing.details?.floor_area ?? '—'}</p>
              </div>
            </div>

            {/* Amenities */}
            {listing.amenities && listing.amenities.length > 0 && (
              <div>
                <h2 className="font-serif text-2xl text-[#1A1A18] mb-4">Amenities</h2>
                <div className="flex flex-wrap gap-2">
                  {listing.amenities.map((amenity) => (
                    <span
                      key={amenity}
                      className="px-4 py-2 bg-[#F7F6F2] border border-[#E0DED8] rounded-full text-sm text-[#4A4A46]"
                    >
                      {amenity}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Viewing Fee */}
            <div className="p-6 bg-[#F7F6F2] rounded-xl border border-[#E0DED8]">
              <h2 className="font-serif text-xl text-[#1A1A18] mb-3">Viewing Information</h2>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56]">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-[#1A1A18]">Viewing fee</p>
                  <p className="text-[#6B6A63]">{viewingFeeText}</p>
                </div>
              </div>
              <p className="text-sm text-[#6B6A63] mt-3">
                You pay the viewing fee directly to the lister at the property. Nyumba254 does not collect viewing fees.
              </p>
            </div>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-6">
              {/* Price Card */}
              <div className="bg-white border border-[#E0DED8] rounded-2xl p-6 shadow-sm">
                <div className="mb-4">
                  <p className="text-sm text-[#6B6A63]">Monthly rent</p>
                  <p className="font-serif text-4xl font-bold text-[#085041]">{formattedPrice}</p>
                </div>

                <div className="space-y-3 text-sm text-[#6B6A63]">
                  <div className="flex justify-between">
                    <span>Viewing fee</span>
                    <span className="font-semibold text-[#1A1A18]">{viewingFeeText}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Deal commission</span>
                    <span className="font-semibold text-[#0F6E56]">0% (Free)</span>
                  </div>
                </div>

                <Button className="w-full mt-6 bg-[#0F6E56] hover:bg-[#085041]" size="lg">
                  Message Lister
                </Button>
                <Button variant="outline" className="w-full mt-3 border-[#0F6E56] text-[#0F6E56] hover:bg-[#E1F5EE]" size="lg">
                  Request Viewing
                </Button>
                <Button variant="ghost" className="w-full mt-3 text-[#6B6A63] hover:bg-[#F7F6F2]" size="lg">
                  Save
                </Button>
              </div>

              {/* Map placeholder */}
              <div className="bg-[#F7F6F2] border border-[#E0DED8] rounded-2xl p-6 aspect-[4/3] flex items-center justify-center">
                <div className="text-center text-[#6B6A63]">
                  <svg className="w-12 h-12 mx-auto mb-3 text-[#E0DED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="font-medium text-[#1A1A18]">Map view</p>
                  <p className="text-sm mt-1">{listing.area}, {listing.county}</p>
                </div>
              </div>

              {/* Share */}
              <div className="bg-white border border-[#E0DED8] rounded-2xl p-6">
                <h3 className="font-semibold text-[#1A1A18] mb-4">Share this listing</h3>
                <div className="flex gap-3">
                  <Button variant="outline" size="sm" className="flex-1">
                    WhatsApp
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}