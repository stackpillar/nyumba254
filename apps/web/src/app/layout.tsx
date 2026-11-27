/**
 * Root Layout - Nyumba254 Web App
 */

import type { Metadata, Viewport } from 'next';
import { Inter, Playfair_Display, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { NavBar } from '@nyumba254/ui';
import { Toaster } from './components/Toaster';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['700'],
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    default: 'Nyumba254 — Apartments, Houses & Rentals Across Kenya',
    template: '%s | Nyumba254',
  },
  description: 'Find and list apartments, houses, boarding rooms, Airbnb rentals, and commercial property across Kenya. Open to buyers, owners, caretakers, agents, and companies.',
  keywords: ['property', 'rentals', 'apartments', 'houses', 'Kenya', 'real estate', 'boarding', 'Airbnb', 'commercial'],
  authors: [{ name: 'Nyumba254' }],
  creator: 'Nyumba254',
  publisher: 'Nyumba254',
  robots: 'index, follow',
  openGraph: {
    type: 'website',
    locale: 'en_KE',
    url: 'https://nyumba254.com',
    siteName: 'Nyumba254',
    title: 'Nyumba254 — Apartments, Houses & Rentals Across Kenya',
    description: 'Find and list property across Kenya. Open to buyers, owners, caretakers, agents, and companies, with no deal commission charged by Nyumba254.',
    images: [
      {
        url: '/hero-kenya-apartments.jpg',
        width: 1200,
        height: 630,
        alt: 'Nyumba254 - Kenya Property Listings',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nyumba254 — Apartments, Houses & Rentals Across Kenya',
    description: 'Find and list property across Kenya. Open to buyers, owners, caretakers, agents, and companies.',
    images: ['/hero-kenya-apartments.jpg'],
    site: '@Nyumba254',
  },
  verification: {
    google: 'google-site-verification-code',
  },
  other: {
    'google-adsense-account': 'ca-pub-7668208654108171',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F6E56',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://vliuuloyfhyxcsuchpss.supabase.co" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" href="/favicon-96.png" type="image/png" sizes="96x96" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var t = localStorage.getItem('ny_theme');
                  if (!t) {
                    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
                    t = prefersDark ? 'dark' : 'light';
                    localStorage.setItem('ny_theme', t);
                  }
                  if (t && t !== 'light') document.documentElement.setAttribute('data-theme', t);
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`${inter.variable} ${playfair.variable} ${jetbrains.variable} font-sans antialiased`}>
        <Providers>
          <a href="#main-content" className="skip-link">
            Skip to content
          </a>
          <NavBar />
          <main id="main-content">{children}</main>
          <Toaster />
        </Providers>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function(error) {
                    console.error('Service worker registration failed:', error);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}