/**
 * Why Nyumba254 Section
 */

'use client';

import { cn } from '@nyumba254/design-system';

const steps = [
  {
    number: '1',
    title: 'Know who you deal with',
    description: 'Each listing shows whether the lister is an owner, caretaker, agent or company.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" />
        <polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
  {
    number: '2',
    title: 'See the viewing fee first',
    description: 'Any viewing fee is shown on the listing before you get in touch, and you pay it only at the property.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    number: '3',
    title: 'Role-verified listers',
    description: 'A role is a claim; verification is proof. Verified roles carry a badge.',
    icon: (
      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

export function WhyNyumba254() {
  return (
    <section className="py-12 md:py-16 lg:py-20 bg-white" aria-labelledby="why-title">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 id="why-title" className="font-serif text-3xl md:text-4xl text-[#1A1A18]">
            Why Nyumba254
          </h2>
          <p className="mt-4 text-[#4A4A46] text-lg leading-relaxed">
            Nyumba254 is Kenya&rsquo;s open platform to list, find and manage property. Every listing shows who listed it and what a viewing costs, before you get in touch.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {steps.map((step) => (
            <div
              key={step.number}
              className="bg-white border border-[#E0DED8] rounded-2xl p-8 hover:border-[#0F6E56] hover:shadow-[0_12px_36px_rgba(15,110,86,0.22)] transition-all duration-300"
            >
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-xl bg-[#E1F5EE] flex items-center justify-center text-[#0F6E56]">
                  {step.icon}
                </div>
                <span className="font-serif text-3xl font-bold text-[#0F6E56]">{step.number}</span>
              </div>
              <h3 className="text-xl font-semibold text-[#1A1A18] mb-3">{step.title}</h3>
              <p className="text-[#6B6A63] leading-relaxed">
                {step.description}
                <a href="/trust-and-safety" className="text-[#0F6E56] font-semibold underline ml-1">
                  Read about trust and safety
                </a>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}