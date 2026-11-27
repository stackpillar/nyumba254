/**
 * Hero Section
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { SearchBox, Button } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

export function Hero() {
  const [activeSlide, setActiveSlide] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  const slides = [
    '/hero-kenya-apartments.jpg',
    '/hero-photo-3.jpg',
    '/hero-photo-4.jpg',
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

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

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({
    county: '',
    area: '',
    budget: '',
    beds: '',
  });

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (filters.county) params.set('county', filters.county);
    if (filters.area) params.set('area', filters.area);
    if (filters.budget) params.set('maxPrice', filters.budget);
    if (filters.beds) params.set('beds', filters.beds);
    window.location.href = `/listings?${params.toString()}`;
  };

  return (
    <section className="relative min-h-[600px] flex items-center overflow-hidden bg-[#085041]">
      {/* Background Slideshow */}
      <div className="absolute inset-0 z-0" aria-hidden="true">
        {slides.map((slide, index) => (
          <Image
            key={slide}
            src={slide}
            alt=""
            fill
            priority={index === 0}
            className={cn(
              'absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-1400 ease-in-out',
              index === activeSlide ? 'opacity-100' : 'opacity-0'
            )}
            sizes="100vw"
          />
        ))}
        <div className="absolute inset-0 z-10 bg-gradient-to-r from-[#04342C]/85 via-[#04342C]/72 via-[#04342C]/28 to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-20 w-full max-w-7xl mx-auto px-4 md:px-8 lg:px-8 py-16 md:py-24">
        <div className="max-w-2xl">
          {/* Eyebrow */}
          <span className="inline-block bg-white/16 text-[#C9F0E0] text-xs font-medium uppercase tracking-wider px-4 py-2 rounded-full mb-6">
            Find your home in Kenya
          </span>

          {/* Headline */}
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-white leading-tight mb-6 text-balance">
            Find your next home{' '}
            <span className="text-[#6FE0B8]">across Kenya</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/92 mb-8 max-w-xl text-balance">
            Apartments, houses, boarding rooms and shops. See who is listing and what a viewing costs before you get in touch.
          </p>

          {/* Search Box */}
          <SearchBox
            query={query}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            filters={filters}
            onFilterChange={(filter, value) => setFilters((prev) => ({ ...prev, [filter]: value }))}
            counties={counties}
            areas={[]}
            budgets={budgets}
            beds={beds}
            showMoreFilters={showFilters}
            onToggleFilters={() => setShowFilters(!showFilters)}
            placeholder="Try "2 bedroom Kilimani under 50k""
          />

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-4 mt-6">
            <Button variant="outline" size="lg" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Near me
            </Button>
            <span className="px-4 py-2 bg-white/10 border border-white/25 rounded-full text-sm text-white/90">
              Recent searches
            </span>
          </div>

          {/* Stats */}
          <div className="flex flex-wrap gap-8 md:gap-12 mt-8">
            <div>
              <div className="text-3xl md:text-4xl font-bold text-white">10,000+</div>
              <div className="text-white/78 text-sm mt-1">Active listings</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-white">47</div>
              <div className="text-white/78 text-sm mt-1">Counties covered</div>
            </div>
            <div>
              <div className="text-3xl md:text-4xl font-bold text-white">0%</div>
              <div className="text-white/78 text-sm mt-1">Deal commission</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <svg className="w-6 h-6 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
        </svg>
      </div>
    </section>
  );
}