/**
 * Counties Section
 */

'use client';

import { cn } from '@nyumba254/design-system';

const counties = [
  { name: 'Nairobi', count: 4200, tier: 1, live: true },
  { name: 'Mombasa', count: 1800, tier: 1, live: true },
  { name: 'Kisumu', count: 950, tier: 1, live: true },
  { name: 'Nakuru', count: 720, tier: 1, live: true },
  { name: 'Kiambu', count: 680, tier: 1, live: true },
  { name: 'Machakos', count: 540, tier: 1, live: true },
  { name: 'Uasin Gishu', count: 480, tier: 2, live: true },
  { name: 'Kajiado', count: 420, tier: 2, live: true },
  { name: 'Kilifi', count: 390, tier: 2, live: true },
  { name: 'Meru', count: 350, tier: 2, live: true },
  { name: 'Nyeri', count: 320, tier: 2, live: false },
  { name: 'Kakamega', count: 300, tier: 2, live: false },
  { name: 'Bungoma', count: 280, tier: 3, live: false },
  { name: 'Kericho', count: 250, tier: 3, live: false },
  { name: 'Laikipia', count: 220, tier: 3, live: false },
  { name: 'Trans Nzoia', count: 200, tier: 3, live: false },
];

export function Counties() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-[#F7F6F2]" aria-labelledby="counties-title">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 id="counties-title" className="font-serif text-3xl md:text-4xl text-[#1A1A18]">
              Browse by county
            </h2>
          </div>
          <a href="/listings" className="text-[#0F6E56] font-semibold hover:underline">
            All listings →
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {counties.map((county) => (
            <a
              key={county.name}
              href={county.live ? `/listings?county=${encodeURIComponent(county.name)}` : '#'}
              className={cn(
                'group flex flex-col items-center p-4 rounded-xl transition-all duration-200',
                county.live
                  ? 'bg-white border border-[#E0DED8] hover:border-[#0F6E56] hover:bg-[#E1F5EE] cursor-pointer'
                  : 'bg-white/50 border border-[#E0DED8] cursor-not-allowed opacity-70'
              )}
              aria-disabled={!county.live}
            >
              <span className={cn(
                'font-semibold text-sm transition-colors',
                county.live ? 'text-[#1A1A18] group-hover:text-[#0F6E56]' : 'text-[#888780]'
              )}>
                {county.name}
              </span>
              <span className={cn(
                'text-xs font-medium mt-1 transition-colors',
                county.live
                  ? 'text-[#0F6E56]'
                  : 'text-[#888780]'
              )}>
                {county.live
                  ? `${county.count.toLocaleString()} listing${county.count !== 1 ? 's' : ''}`
                  : 'Coming soon'}
              </span>
            </a>
          ))}
        </div>

        <button
          className="mt-8 w-full md:w-auto mx-auto md:mx-0 px-8 py-3 border-2 border-[#0F6E56] text-[#0F6E56] font-semibold rounded-full hover:bg-[#E1F5EE] transition-colors"
        >
          Show all counties
        </button>

        {/* Popular areas */}
        <div className="mt-10">
          <p className="text-sm font-semibold text-[#6B6A63] mb-3">Popular areas</p>
          <div className="flex flex-wrap gap-2">
            {['Kilimani, Nairobi', 'Nyali, Mombasa', 'Milimani, Kisumu', 'Westlands, Nairobi', 'Bamburi, Mombasa'].map((area) => (
              <a
                key={area}
                href={`/listings?q=${encodeURIComponent(area)}`}
                className="px-4 py-2 bg-white border border-[#9FE1CB] text-[#085041] font-semibold rounded-full hover:bg-[#E1F5EE] transition-colors text-sm"
              >
                {area}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}