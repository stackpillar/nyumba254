/**
 * Featured Listings Section
 */

'use client';

import { Suspense } from 'react';
import { ListingCard, SkeletonListing } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

async function getFeaturedListings() {
  // In production, this would call the API
  // For now, return mock data
  return [
    {
      id: '1',
      listing_number: 100001,
      title: 'Modern 2BR Apartment in Kilimani',
      area: 'Kilimani',
      county: 'Nairobi',
      category: 'apartment',
      price: 65000,
      price_frequency: 'month',
      status: 'active',
      is_featured: true,
      listing_photos: [
        { url: '/hero-kenya-apartments.jpg', is_cover: true, position: 0 },
        { url: '/hero-photo-3.jpg', position: 1 },
      ],
      listing_videos: [],
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
    },
    {
      id: '2',
      listing_number: 100002,
      title: 'Spacious 3BR House in Nyali',
      area: 'Nyali',
      county: 'Mombasa',
      category: 'house',
      price: 120000,
      price_frequency: 'month',
      status: 'active',
      is_featured: true,
      listing_photos: [
        { url: '/hero-photo-3.jpg', is_cover: true, position: 0 },
      ],
      listing_videos: [],
      profiles: {
        full_name: 'Ahmed Properties',
        identity_verified: true,
        verification_status: 'verified',
        account_type: 'agent',
        verified_role: 'agent',
        page_handle: 'ahmed-properties',
      },
      public_viewing_fee: 1000,
      viewing_fee_status: 'loaded',
      created_at: new Date().toISOString(),
    },
    {
      id: '3',
      listing_number: 100003,
      title: 'Cozy Boarding Room near UoN',
      area: 'Kileleshwa',
      county: 'Nairobi',
      category: 'boarding',
      price: 8500,
      price_frequency: 'month',
      status: 'active',
      is_featured: true,
      listing_photos: [
        { url: '/hero-photo-4.jpg', is_cover: true, position: 0 },
      ],
      listing_videos: [],
      profiles: {
        full_name: 'Peter Ochieng',
        identity_verified: false,
        verification_status: 'pending',
        account_type: 'caretaker',
        verified_role: null,
        page_handle: null,
      },
      public_viewing_fee: 500,
      viewing_fee_status: 'loaded',
      created_at: new Date().toISOString(),
    },
  ];
}

export async function FeaturedListings() {
  const listings = await getFeaturedListings();

  if (!listings.length) return null;

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-[#F7F6F2]" aria-labelledby="featured-title">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 id="featured-title" className="font-serif text-3xl md:text-4xl text-[#1A1A18]">
              Featured listings
            </h2>
            <p className="text-[#6B6A63] mt-1">Hand-picked and verified. Updated daily.</p>
          </div>
          <a href="/listings?sort=featured" className="text-[#0F6E56] font-semibold hover:underline">
            See all →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map((listing) => (
            <ListingCard key={listing.id} listing={listing as any} />
          ))}
        </div>
      </div>
    </section>
  );
}

export function FeaturedListingsSkeleton() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-[#F7F6F2]">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="font-serif text-3xl md:text-4xl text-[#1A1A18]">Featured listings</h2>
            <p className="text-[#6B6A63] mt-1">Hand-picked and verified. Updated daily.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <SkeletonListing key={i} />
          ))}
        </div>
      </div>
    </section>
  );
}