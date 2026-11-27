/**
 * How It Works Section
 */

'use client';

import { cn } from '@nyumba254/design-system';

const steps = [
  {
    number: '1',
    title: 'Search or browse',
    description: 'Filter by county, area, price and category to find places that match what you need.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    number: '2',
    title: 'Message the lister',
    description: 'Contact the owner, caretaker, agent, or company listing the property. Nyumba254 charges no deal commission on your agreement.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
  },
  {
    number: '3',
    title: 'Go view it',
    description: 'Check the viewing fee on the listing, arrange a viewing directly with the lister, and move in.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="17" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <path d="M8 14h3M8 17h6" />
      </svg>
    ),
  },
];

export function HowItWorks() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-[#F7F6F2]" aria-labelledby="how-title">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="how-title" className="font-serif text-3xl md:text-4xl text-[#1A1A18]">
            How it works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white border border-[#E0DED8] rounded-2xl p-8 hover:border-[#0F6E56] transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56]">
                  {step.icon}
                </div>
                <span className="font-serif text-3xl font-bold text-[#0F6E56]">{step.number}</span>
              </div>
              <h3 className="text-xl font-semibold text-[#1A1A18] mb-3">{step.title}</h3>
              <p className="text-[#6B6A63] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}