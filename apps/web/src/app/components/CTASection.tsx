/**
 * CTA Section
 */

'use client';

import { Button } from '@nyumba254/ui';
import { cn } from '@nyumba254/design-system';

export function CTASection() {
  return (
    <section className="py-12 md:py-16 lg:py-20" aria-labelledby="cta-title">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="rounded-2xl bg-[#085041] p-8 md:p-12 lg:p-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="text-center md:text-left max-w-2xl">
            <h2 id="cta-title" className="font-serif text-3xl md:text-4xl text-white mb-4">
              Selling or renting out your apartment, house, or bed space?
            </h2>
            <p className="text-white/75 text-lg leading-relaxed">
              List your property (apartment, house, boarding room, Airbnb, or commercial space) and reach buyers and tenants across Kenya, starting with Kisumu, Nairobi, and Mombasa. Owners, caretakers, agents, and companies can all participate.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <Button size="lg" className="bg-white text-[#085041] hover:bg-[#E1F5EE] min-w-[180px]">
              List your property
            </Button>
            <Button variant="outline" size="lg" className="border-white/40 text-white hover:border-white min-w-[180px]">
              How it works
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}