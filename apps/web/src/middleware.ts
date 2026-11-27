/**
 * Next.js Middleware - Auth handling
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@nyumba254/core';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://vliuuloyfhyxcsuchpss.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Refresh session if needed
  const {
    data: { session },
  } = await supabase.auth.getSession();

  // Protected routes that require authentication
  const protectedPaths = [
    '/dashboard',
    '/saved',
    '/post-listing',
    '/settings',
    '/profile',
  ];

  const isProtectedPath = protectedPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  // Auth routes that should redirect if already authenticated
  const authPaths = ['/login', '/signup', '/reset-password', '/auth/callback'];
  const isAuthPath = authPaths.some((path) =>
    request.nextUrl.pathname.startsWith(path)
  );

  if (isProtectedPath && !session) {
    // Redirect to login with redirect back to original page
    const redirectUrl = new URL('/login', request.url);
    redirectUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isAuthPath && session) {
    // Redirect authenticated users away from auth pages
    const redirectTo = request.nextUrl.searchParams.get('redirect') || '/dashboard';
    return NextResponse.redirect(new URL(redirectTo, request.url));
  }

  // Handle lister page routes (@handle)
  const listerPageMatch = request.nextUrl.pathname.match(/^\/@([a-zA-Z0-9._-]{3,30})$/);
  if (listerPageMatch) {
    // Rewrite to storefront page with handle parameter
    const handle = listerPageMatch[1];
    const url = request.nextUrl.clone();
    url.pathname = '/storefront';
    url.searchParams.set('handle', handle);
    return NextResponse.rewrite(url);
  }

  // Handle legacy storefront URLs
  if (request.nextUrl.pathname === '/storefront') {
    const seller = request.nextUrl.searchParams.get('seller');
    const handle = request.nextUrl.searchParams.get('handle');
    if (seller || handle) {
      // This will be handled by the storefront page component
      return response;
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};