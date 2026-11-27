/**
 * Listings Page
 */

'use client';

import { useState, useEffect } from 'react';
import { ListingCard, SearchBox, Select, SkeletonListing, Button } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

const categories = [
  { value: '', label: 'All categories' },
  { value: 'apartment', label: 'Apartment' },
  { value: 'house', label: 'House' },
  { value: 'boarding', label: 'Boarding House' },
  { value: 'airbnb', label: 'Airbnb / Holiday Rental' },
  { value: 'commercial', label: 'Shops & Offices' },
];

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

const budgets = [
  { value: '', label: 'Any budget' },
  { value: '10000', label: 'Under 10K' },
  { value: '30000', label: '10K–30K' },
  { value: '80000', label: '30K–80K' },
  { value: '80001', label: '80K+' },
];

const beds = [
  { value: '', label: 'Any beds' },
  { value: '0', label: 'Studio' },
  { value: '1', label: '1 bed' },
  { value: '2', label: '2 beds' },
  { value: '3', label: '3 beds' },
  { value: '4', label: '4+ beds' },
];

const sortOptions = [
  { value: '', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'featured', label: 'Featured first' },
];

const frequencyOptions = [
  { value: '', label: 'Any frequency' },
  { value: 'month', label: 'Monthly' },
  { value: 'night', label: 'Nightly' },
  { value: 'week', label: 'Weekly' },
  { value: 'term', label: 'Per term' },
  { value: 'once', label: 'One-time (Sale)' },
];

export default function ListingsPage() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    category: '',
    frequency: '',
    county: '',
    area: '',
    minPrice: '',
    maxPrice: '',
    beds: '',
    sort: '',
  });
  const [listings, setListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Mock data for now
  const mockListings = [
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
      listing_photos: [{ url: '/hero-kenya-apartments.jpg', is_cover: true, position: 0 }],
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
      is_featured: false,
      listing_photos: [{ url: '/hero-photo-3.jpg', is_cover: true, position: 0 }],
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
      is_featured: false,
      listing_photos: [{ url: '/hero-photo-4.jpg', is_cover: true, position: 0 }],
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
    {
      id: '4',
      listing_number: 100004,
      title: 'New Airbnb in Westlands',
      area: 'Westlands',
      county: 'Nairobi',
      category: 'airbnb',
      price: 8000,
      price_frequency: 'night',
      status: 'active',
      is_featured: false,
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
      created_at: new Date().toISOString(),
    },
  ];

  const handleSearch = () => {
    setPage(1);
    setLoading(true);
    // In production, call API
    setTimeout(() => {
      let filtered = mockListings;
      if (query) filtered = filtered.filter(l => l.title.toLowerCase().includes(query.toLowerCase()));
      if (filters.category) filtered = filtered.filter(l => l.category === filters.category);
      if (filters.frequency) filtered = filtered.filter(l => l.price_frequency === filters.frequency);
      if (filters.county) filtered = filtered.filter(l => l.county === filters.county);
      if (filters.maxPrice) filtered = filtered.filter(l => l.price <= Number(filters.maxPrice));
      if (filters.beds) filtered = filtered.filter(l => l.details?.bedrooms === Number(filters.beds));
      setListings(filtered);
      setHasMore(false);
      setLoading(false);
    }, 300);
  };

  useEffect(() => {
    handleSearch();
  }, []);

  const handleLoadMore = () => {
    setPage(prev => prev + 1);
    // Load more logic
  };

  return (
    <div className="min-h-screen bg-[#F7F6F2]">
      {/* Hero Search */}
      <section className="bg-[#085041] py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
          <SearchBox
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            filters={filters}
            onFilterChange={(filter, value) => setFilters(prev => ({ ...prev, [filter]: value }))}
            counties={counties}
            areas={[]}
            budgets={budgets}
            beds={beds}
            showMoreFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            placeholder="Search by area, price, keyword..."
          />
        </div>
      </section>

      {/* Results */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8 py-8 md:py-12">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Select
            options={categories}
            value={filters.category}
            onChange={(v) => setFilters(prev => ({ ...prev, category: v }))}
            placeholder="All categories"
            className="min-w-[160px]"
          />
          <Select
            options={frequencyOptions}
            value={filters.frequency}
            onChange={(v) => setFilters(prev => ({ ...prev, frequency: v }))}
            placeholder="Any frequency"
            className="min-w-[160px]"
          />
          <Select
            options={counties}
            value={filters.county}
            onChange={(v) => setFilters(prev => ({ ...prev, county: v }))}
            placeholder="All counties"
            className="min-w-[160px]"
          />
          <Select
            options={sortOptions}
            value={filters.sort}
            onChange={(v) => setFilters(prev => ({ ...prev, sort: v }))}
            placeholder="Sort by"
            className="min-w-[160px]"
          />
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            {showFilters ? 'Hide filters' : 'More filters'}
          </Button>
        </div>

        {/* Additional filters when expanded */}
        {showFilters && (
          <div className="flex flex-wrap gap-4 mb-6 p-4 bg-white rounded-xl border border-[#E0DED8]">
            <Select
              options={budgets}
              value={filters.maxPrice}
              onChange={(v) => setFilters(prev => ({ ...prev, maxPrice: v }))}
              placeholder="Max budget"
              className="min-w-[140px]"
            />
            <Select
              options={beds}
              value={filters.beds}
              onChange={(v) => setFilters(prev => ({ ...prev, beds: v }))}
              placeholder="Bedrooms"
              className="min-w-[120px]"
            />
          </div>
        )}

        {/* Results Count */}
        <p className="text-sm text-[#6B6A63] mb-4">
          {listings.length} listing{listings.length !== 1 ? 's' : ''} found
        </p>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map((i) => <SkeletonListing key={i} />)
          ) : listings.length > 0 ? (
            listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))
          ) : (
            <div className="col-span-full text-center py-16">
              <svg className="w-16 h-16 mx-auto text-[#E0DED8]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              </svg>
              <p className="mt-4 text-[#6B6A63] text-lg">No listings found</p>
              <p className="text-[#6B6A63] mt-2">Try adjusting your filters or search terms</p>
              <Button variant="outline" className="mt-6" onClick={() => {
                setQuery('');
                setFilters({ category: '', frequency: '', county: '', area: '', minPrice: '', maxPrice: '', beds: '', sort: '' });
                handleSearch();
              }}>
                Clear all filters
              </Button>
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <div className="text-center mt-8">
            <Button variant="outline" size="lg" onClick={handleLoadMore}>
              Load more listings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}