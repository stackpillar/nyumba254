/**
 * Homepage - Nyumba254
 */

import { Suspense } from 'react';
import { Hero } from './components/Hero';
import { Categories } from './components/Categories';
import { FeaturedListings } from './components/FeaturedListings';
import { LatestListings } from './components/LatestListings';
import { Counties } from './components/Counties';
import { WhyNyumba254 } from './components/WhyNyumba254';
import { HowItWorks } from './components/HowItWorks';
import { CTASection } from './components/CTASection';
import { Footer } from './components/Footer';

export default function HomePage() {
  return (
    <>
      <Hero />
      <Categories />
      <FeaturedListings />
      <LatestListings />
      <Counties />
      <WhyNyumba254 />
      <HowItWorks />
      <CTASection />
      <Footer />
    </>
  );
}