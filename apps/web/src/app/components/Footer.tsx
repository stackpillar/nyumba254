/**
 * Footer Component
 */

'use client';

import { cn } from '@nyumba254/design-system';

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-[#1A1A18] text-white/60 py-14 md:py-20" role="contentinfo">
      <div className="max-w-7xl mx-auto px-4 md:px-8 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 mb-12">
          {/* Brand */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <span className="font-serif text-2xl font-semibold text-white">Nyumba254</span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-xs mb-6">
              Find and list property across Kenya. Open to buyers, owners, caretakers, agents, and companies, with no deal commission from Nyumba254.
            </p>
            <div className="flex gap-3">
              <a href="https://wa.me/254739348560" target="_blank" rel="noopener" aria-label="WhatsApp" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#0F6E56] transition-colors">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/nyumba.254" target="_blank" rel="noopener" aria-label="Instagram" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#0F6E56] transition-colors">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                  <circle cx="12" cy="12" r="4" />
                  <circle cx="17.5" cy="6.5" r="1" fill="currentColor" />
                </svg>
              </a>
              <a href="https://www.facebook.com/share/1EdzJKujSK/" target="_blank" rel="noopener" aria-label="Facebook" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#0F6E56] transition-colors">
                <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M18 2h-3a5 5 0 00-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 011-1h3z" />
                </svg>
              </a>
              <a href="https://www.tiktok.com/@nyumba.254" target="_blank" rel="noopener" aria-label="TikTok" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#0F6E56] transition-colors">
                <svg className="w-5 h-5 text-white/70" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C8 7 5 11 5 14.5a7 7 0 0014 0C19 11 16 7 12 2z" />
                </svg>
              </a>
              <a href="https://x.com/Nyumba254" target="_blank" rel="noopener" aria-label="X (Twitter)" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#0F6E56] transition-colors">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4l16 16M20 4L4 20" />
                </svg>
              </a>
              <a href="mailto:hello@nyumba254.co.ke" aria-label="Email" className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center hover:bg-[#0F6E56] transition-colors">
                <svg className="w-5 h-5 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </a>
            </div>
          </div>

          {/* Browse */}
          <div>
            <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Browse</h3>
            <nav className="space-y-3">
              <a href="/listings" className="text-white/55 hover:text-white transition-colors text-sm block">All listings</a>
              <a href="/listings?category=apartment" className="text-white/55 hover:text-white transition-colors text-sm block">Apartment</a>
              <a href="/listings?category=house" className="text-white/55 hover:text-white transition-colors text-sm block">House</a>
              <a href="/listings?category=boarding" className="text-white/55 hover:text-white transition-colors text-sm block">Boarding House</a>
              <a href="/listings?category=airbnb" className="text-white/55 hover:text-white transition-colors text-sm block">Airbnb / Holiday Rental</a>
              <a href="/listings?category=commercial" className="text-white/55 hover:text-white transition-colors text-sm block">Shops & Offices</a>
            </nav>
          </div>

          {/* Counties */}
          <div>
            <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Counties</h3>
            <div className="columns-2 gap-4">
              <nav className="space-y-2">
                <a href="/listings?county=Nairobi" className="text-white/55 hover:text-white transition-colors text-sm block">Nairobi</a>
                <a href="/listings?county=Mombasa" className="text-white/55 hover:text-white transition-colors text-sm block">Mombasa</a>
                <a href="/listings?county=Kisumu" className="text-white/55 hover:text-white transition-colors text-sm block">Kisumu</a>
                <a href="/listings?county=Nakuru" className="text-white/55 hover:text-white transition-colors text-sm block">Nakuru</a>
                <a href="/listings?county=Kiambu" className="text-white/55 hover:text-white transition-colors text-sm block">Kiambu</a>
                <a href="/listings?county=Machakos" className="text-white/55 hover:text-white transition-colors text-sm block">Machakos</a>
              </nav>
              <nav className="space-y-2">
                <a href="/listings?county=Uasin+Gishu" className="text-white/55 hover:text-white transition-colors text-sm block">Uasin Gishu</a>
                <a href="/listings?county=Kajiado" className="text-white/55 hover:text-white transition-colors text-sm block">Kajiado</a>
                <a href="/listings?county=Kilifi" className="text-white/55 hover:text-white transition-colors text-sm block">Kilifi</a>
                <a href="/listings?county=Meru" className="text-white/55 hover:text-white transition-colors text-sm block">Meru</a>
                <a href="/listings?county=Nyeri" className="text-white/30 cursor-not-allowed text-sm block">Nyeri (soon)</a>
                <a href="/listings?county=Kakamega" className="text-white/30 cursor-not-allowed text-sm block">Kakamega (soon)</a>
              </nav>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Platform</h3>
            <nav className="space-y-3">
              <a href="/post-listing" className="text-white/55 hover:text-white transition-colors text-sm block">List a property</a>
              <a href="/how-it-works" className="text-white/55 hover:text-white transition-colors text-sm block">How it works</a>
              <a href="/login" className="text-white/55 hover:text-white transition-colors text-sm block">Account sign in</a>
            </nav>
          </div>

          {/* Company */}
          <div>
            <h3 className="text-white font-semibold text-xs uppercase tracking-wider mb-4">Company</h3>
            <nav className="space-y-3">
              <a href="/contact" className="text-white/55 hover:text-white transition-colors text-sm block">Contact us</a>
              <a href="/terms" className="text-white/55 hover:text-white transition-colors text-sm block">Terms of service</a>
              <a href="/viewing-fee-policy" className="text-white/55 hover:text-white transition-colors text-sm block">Viewing Fee Policy</a>
              <a href="/trust-and-safety" className="text-white/55 hover:text-white transition-colors text-sm block">Trust & Safety</a>
              <a href="/privacy" className="text-white/55 hover:text-white transition-colors text-sm block">Privacy policy</a>
              <a href="/faq" className="text-white/55 hover:text-white transition-colors text-sm block">FAQ</a>
            </nav>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/40 text-sm">
            © {currentYear} Nyumba254. All rights reserved. Built for Kenya.
          </p>
          <div className="flex gap-6">
            <a href="/terms" className="text-white/40 hover:text-white transition-colors text-sm">Terms</a>
            <a href="/privacy" className="text-white/40 hover:text-white transition-colors text-sm">Privacy</a>
            <a href="#" data-nk-cookie-settings className="text-white/40 hover:text-white transition-colors text-sm">Cookie settings</a>
            <a href="/contact" className="text-white/40 hover:text-white transition-colors text-sm">Contact</a>
            <a href="/sitemap" className="text-white/40 hover:text-white transition-colors text-sm">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}