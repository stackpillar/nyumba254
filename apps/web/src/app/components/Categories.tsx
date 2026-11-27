/**
 * Categories Section
 */

'use client';

import { CategoryCard } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

const categories = [
  { category: 'apartment', title: 'Apartment', description: 'Flats, units, and compounds', count: 4200, href: '/listings?category=apartment' },
  { category: 'house', title: 'House', description: 'Standalone homes and yards', count: 1800, href: '/listings?category=house' },
  { category: 'boarding', title: 'Boarding House', description: 'Student rooms and bed spaces', count: 950, href: '/listings?category=boarding' },
  { category: 'airbnb', title: 'Airbnb / Holiday Rental', description: 'Short stays and furnished rentals', count: 1200, href: '/listings?category=airbnb' },
  { category: 'commercial', title: 'Shops & Offices', description: 'Retail shops, offices, and business spaces', count: 650, href: '/listings?category=commercial' },
];

export function Categories() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-white" aria-labelledby="categories-title">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 id="categories-title" className="font-serif text-3xl md:text-4xl text-[#1A1A18]">
              What are you looking for?
            </h2>
          </div>
          <a href="/how-it-works" className="text-[#0F6E56] font-semibold hover:underline">
            How it works →
          </a>
        </div>

        <div className="flex gap-4 md:gap-6 overflow-x-auto scrollbar-hide pb-4 -mx-4 md:mx-0 px-4 md:px-0">
          {categories.map((cat) => (
            <a key={cat.category} href={cat.href} style={{ flexShrink: 0, width: '240px', maxWidth: '300px' }}>
              <CategoryCard
                category={cat.category as any}
                title={cat.title}
                description={cat.description}
                count={cat.count}
              />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}