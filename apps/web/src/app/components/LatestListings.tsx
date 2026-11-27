/**
 * Latest Listings Section
 */

'use client';

import { useState } from 'react';
import { ListingCard, SkeletonListing, Select } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

const counties = [
  { value: '', label: 'All counties' },
  { value: 'Nairobi', label: 'Nairobi' },
  { value: 'Mombasa', label: 'Mombasa' },
  { value: 'Kisumu', label: 'Kisumu' },
  { value: 'Nakuru', label: 'Nakuru' },
  { value: 'Eldoret', label: 'Eldoret' },
  { value: 'Thika', label: 'Thika' },
  { value: 'Machakos', label: 'Machakos' },
];

const areasByCounty: Record<string, Array<{ value: string; label: string }>> = {
  Nairobi: [
    { value: '', label: 'All areas' },
    { value: 'Kilimani', label: 'Kilimani' },
    { value: 'Westlands', label: 'Westlands' },
    { value: 'Kileleshwa', label: 'Kileleshwa' },
    { value: 'Lavington', label: 'Lavington' },
    { value: 'Karen', label: 'Karen' },
  ],
  Mombasa: [
    { value: '', label: 'All areas' },
    { value: 'Nyali', label: 'Nyali' },
    { value: 'Bamburi', label: 'Bamburi' },
    { value: 'Shanzu', label: 'Shanzu' },
    { value: 'Mombasa Island', label: 'Mombasa Island' },
  ],
  Kisumu: [
    { value: '', label: 'All areas' },
    { value: 'Milimani', label: 'Milimani' },
    { value: 'Nyalenda', label: 'Nyalenda' },
    { value: 'Kondele', label: 'Kondele' },
  ],
};

async function getLatestListings(county?: string, area?: string) {
  // In production, this would call the API
  // For now, return mock data
  const mockListings = [
    {
      id: '1',
      listing_number: 100004,
      title: 'New 1BR Apartment in Westlands',
      area: 'Westlands',
      county: 'Nairobi',
      category: 'apartment',
      price: 45000,
      price_frequency: 'month',
      status: 'active',
      listing_photos: [{ url: '/hero-kenya-apartments.jpg', is_cover: true, position: 0 }],
      listing_videos: [],
      profiles: {
        full_name: 'New Landlord',
        identity_verified: false,
        verification_status: 'not_started',
        account_type: 'owner',
        verified_role: null,
        page_handle: null,
      },
      public_viewing_fee: 0,
      viewing_fee_status: 'loaded',
      created_at: new Date().toISOString(),
    },
    {
      id: '2',
      listing_number: 100005,
      title: 'Fresh 2BR House in Nyali',
      area: 'Nyali',
      county: 'Mombasa',
      category: 'house',
      price: 80000,
      price_frequency: 'month',
      status: 'active',
      listing_photos: [{ url: '/hero-photo-3.jpg', is_cover: true, position: 0 }],
      listing_videos: [],
      profiles: {
        full_name: 'Coastal Properties',
        identity_verified: true,
        verification_status: 'verified',
        account_type: 'agent',
        verified_role: 'agent',
        page_handle: 'coastal-properties',
      },
      public_viewing_fee: 1000,
      viewing_fee_status: 'loaded',
      created_at: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      id: '3',
      listing_number: 100006,
      title: 'Brand New Boarding Room Milimani',
      area: 'Milimani',
      county: 'Kisumu',
      category: 'boarding',
      price: 7000,
      price_frequency: 'month',
      status: 'active',
      listing_photos: [{ url: '/hero-photo-4.jpg', is_cover: true, position: 0 }],
      listing_videos: [],
      profiles: {
        full_name: 'Student Housing Co',
        identity_verified: false,
        verification_status: 'pending',
        account_type: 'caretaker',
        verified_role: null,
        page_handle: null,
      },
      public_viewing_fee: 300,
      viewing_fee_status: 'loaded',
      created_at: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: '4',
      listing_number: 100007,
      title: 'New Airbnb in Kilimani',
      area: 'Kilimani',
      county: 'Nairobi',
      category: 'airbnb',
      price: 8000,
      price_frequency: 'night',
      status: 'active',
      listing_photos: [{ url: '/hero-kenya-apartments.jpg', is_cover: true, position: 0 }],
      listing_videos: [],
      profiles: {
        full_name: 'Holiday Homes KE',
        identity_verified: true,
        verification_status: 'verified',
        account_type: 'company',
        verified_role: 'company',
        page_handle: 'holiday-homes-ke',
      },
      public_viewing_fee: 0,
      viewing_fee_status: 'loaded',
      created_at: new Date(Date.now() - 10800000).toISOString(),
    },
  ];

  let filtered = mockListings;
  if (county) filtered = filtered.filter(l => l.county === county);
  if (area) filtered = filtered.filter(l => l.area === area);
  return filtered;
}

export async function LatestListings({ initialCounty = '', initialArea = '' }: { initialCounty?: string; initialArea?: string }) {
  const listings = await getLatestListings(initialCounty, initialArea);

  return (
    <LatestListingsClient initialListings={listings} initialCounty={initialCounty} initialArea={initialArea} />
  );
}

function LatestListingsClient({ initialListings, initialCounty, initialArea }: { initialListings: any[]; initialCounty?: string; initialArea?: string }) {
  const [county, setCounty] = useState(initialCounty || '');
  const [area, setArea] = useState(initialArea || '');
  const [listings, setListings] = useState(initialListings);
  const [loading, setLoading] = useState(false);

  const handleCountyChange = async (newCounty: string) => {
    setCounty(newCounty);
    setArea('');
    setLoading(true);
    const newListings = await getLatestListings(newCounty);
    setListings(newListings);
    setLoading(false);
  };

  const handleAreaChange = async (newArea: string) => {
    setArea(newArea);
    setLoading(true);
    const newListings = await getLatestListings(county, newArea);
    setListings(newListings);
    setLoading(false);
  };

  return (
    <section className="py-12 md:py-16 lg:py-20 bg-white" aria-labelledby="latest-title">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="flex items-end justify-between mb-6">
          <div>
            <h2 id="latest-title" className="font-serif text-3xl md:text-4xl text-[#1A1A18] flex items-center gap-3">
              Latest listings
              <span className="bg-[#E1F5EE] text-[#085041] text-xs font-bold px-3 py-1 rounded-full">NEW</span>
            </h2>
            <p className="text-[#6B6A63] mt-1">Newest properties, updated in real time</p>
          </div>
          <a href="/listings" className="text-[#0F6E56] font-semibold hover:underline">
            See all →
          </a>
        </div>

        {/* County/Area Filters */}
        <div className="flex flex-wrap gap-3 mb-6">
          <Select
            options={counties}
            value={county}
            onChange={(v) => handleCountyChange(v)}
            placeholder="All counties"
            className="min-w-[180px]"
          />
          {county && areasByCounty[county] && (
            <Select
              options={areasByCounty[county]}
              value={area}
              onChange={(v) => handleAreaChange(v)}
              placeholder="All areas"
              className="min-w-[180px]"
            />
          )}
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3].map((i) => <SkeletonListing key={i} />)
          ) : listings.length > 0 ? (
            listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <svg className="w-16 h-16 mx-auto text-[#E0DED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <p className="mt-4 text-[#6B6A63]">No listings found</p>
              <a href="/post-listing" className="mt-4 inline-block text-[#0F6E56] font-semibold hover:underline">
                Be the first to list!
              </a>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}