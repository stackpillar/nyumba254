export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/storefront' && (url.searchParams.has('seller') || url.searchParams.has('handle'))) {
      const lookup = url.searchParams.get('seller') || url.searchParams.get('handle');
      const handle = await legacyStorefrontHandle(env, lookup);
      if (handle) {
        const redirect = new URL(`/@${encodeURIComponent(handle)}`, request.url);
        for (const [key, value] of url.searchParams) {
          if (key !== 'seller' && key !== 'handle') redirect.searchParams.set(key, value);
        }
        return Response.redirect(redirect, 301);
      }
    }

    const listerRoute = url.pathname.match(/^\/(?:@|u\/)([a-z0-9._-]{3,30})\/?$/i);
    if (listerRoute) {
      const handle = listerRoute[1].toLowerCase();
      if (url.pathname.startsWith('/u/') || url.pathname.endsWith('/') || listerRoute[1] !== handle) {
        url.pathname = '/@' + handle;
        return Response.redirect(url, 301);
      }
      if (isSocialCrawler(request.headers.get('user-agent'))) {
        const rendered = await renderListerPage(request, env, handle);
        if (rendered) return rendered;
      }
      url.pathname = '/storefront';
      url.searchParams.delete('seller');
      url.searchParams.set('handle', handle);
      return env.ASSETS.fetch(new Request(url, request));
    }

    if (url.pathname === '/robots.txt') {
      return new Response(`User-agent: *\nDisallow: /dashboard\nDisallow: /nk-ctrl-7f3k2x9\nDisallow: /listing?preview\nAllow: /\n\nSitemap: ${url.origin}/sitemap.xml\n`, {
        headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' },
      });
    }

    if (url.pathname === '/sitemap.xml') {
      return renderSitemapXml(url.origin, env);
    }

    if (url.pathname === '/lister-page-card' && request.method === 'GET') {
      const card = await renderListerCard(request, env, url.searchParams.get('handle'));
      if (card) return card;
    }

    if (url.pathname === '/listing' && isSocialCrawler(request.headers.get('user-agent'))) {
      const rendered = await renderListingPreview(request, env, url.searchParams.get('id'));
      if (rendered) return rendered;
    }

    if (url.hostname === 'admin.nyumba254.com' && (url.pathname === '/' || url.pathname === '')) {
      url.pathname = '/nk-ctrl-7f3k2x9';
      return env.ASSETS.fetch(new Request(url, request));
    }

    const response = await env.ASSETS.fetch(request);

    if (response.status === 404) {
      const notFoundUrl = new URL('/404', request.url);
      const notFoundResponse = await env.ASSETS.fetch(new Request(notFoundUrl, request));
      return new Response(notFoundResponse.body, {
        status: 404,
        headers: notFoundResponse.headers,
      });
    }

    return response;
  },

  async scheduled(controller, env, ctx) {
    ctx.waitUntil(publishDueListings(env));
    ctx.waitUntil(pruneListerPageAnalytics(env));
  },
};

const roleNames = {
  owner: 'Direct from owner',
  caretaker: 'Caretaker',
  agent: 'Agent',
  company: 'Company',
};

function isSocialCrawler(userAgent) {
  return /facebookexternalhit|WhatsApp|Twitterbot|Instagram|LinkedInBot|Slackbot|TelegramBot|Googlebot/i.test(userAgent || '');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function escapeJsonLd(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function sanitizeCrawlerText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, 'contact details withheld')
    .replace(/(?:\+?254|0)[17](?:[\s()-]?\d){7,8}(?!\d)/g, 'contact details withheld')
    .replace(/\s+/g, ' ')
    .trim();
}

async function listerPageData(env, handle) {
  if (!env.NYUMBA254_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !handle) return null;
  const response = await fetch(`${env.NYUMBA254_SUPABASE_URL}/rest/v1/rpc/get_public_lister_page`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_handle: handle }),
  });
  if (!response.ok) {
    console.error('Lister Page lookup failed:', response.status);
    return null;
  }
  return response.json();
}

async function legacyStorefrontHandle(env, slug) {
  if (!slug || !env.NYUMBA254_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return null;
  const response = await fetch(`${env.NYUMBA254_SUPABASE_URL}/rest/v1/rpc/get_lister_page_handle`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ p_lookup: slug }),
  });
  if (!response.ok) {
    console.error('Legacy Lister Page URL lookup failed:', response.status);
    return null;
  }
  return response.json();
}

async function renderListerPage(request, env, handle) {
  try {
    const profile = await listerPageData(env, handle);
    if (!profile) return null;
    if (profile.redirect_to) {
      return Response.redirect(new URL(`/@${encodeURIComponent(profile.redirect_to)}`, request.url), 301);
    }
    const listingUrl = new URL('/rest/v1/listings', env.NYUMBA254_SUPABASE_URL);
    listingUrl.search = new URLSearchParams({
      select: 'listing_number,title,area,county,price,price_type,category',
      seller_id: `eq.${profile.id}`,
      status: 'eq.active',
      is_disabled: 'eq.false',
      order: 'created_at.desc',
      limit: '30',
    }).toString();
    const listingsResponse = await fetch(listingUrl, {
      headers: {
        apikey: env.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    if (!listingsResponse.ok) {
      console.error('Lister Page listings lookup failed:', listingsResponse.status);
      return null;
    }
    const listings = await listingsResponse.json();
    const name = profile.company_name || profile.full_name || 'Nyumba254 lister';
    const role = roleNames[profile.account_type] || 'Lister';
    const description = `${listings.length} active ${listings.length === 1 ? 'property' : 'properties'} from ${name} on Nyumba254. See the lister’s role and viewing information before making contact.`;
    const canonical = new URL(`/@${encodeURIComponent(profile.handle)}`, request.url).href;
    const indexable = profile.visibility === 'public' && listings.length > 0;
    const itemList = listings.map((listing, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: new URL(`/listing?id=${String(listing.listing_number).padStart(6, '0')}`, request.url).href,
      name: sanitizeCrawlerText(listing.title),
    }));
    const profileJsonLd = {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      name: `${name} — Nyumba254 Lister Page`,
      description,
      url: canonical,
      mainEntity: {
        '@type': 'RealEstateAgent',
        name,
        description: `${role} on Nyumba254. The role is selected by the lister.`,
      },
      hasPart: { '@type': 'ItemList', itemListElement: itemList },
    };
    const cards = listings.map(listing => {
      const href = `/listing?id=${String(listing.listing_number).padStart(6, '0')}`;
      const area = [listing.area, listing.county].filter(Boolean).join(', ');
      return `<li><a href="${escapeHtml(href)}">${escapeHtml(listing.title || 'Property listing')}</a><span>${escapeHtml(area)}</span></li>`;
    }).join('');
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(name)} — Nyumba254 Lister Page</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${indexable ? 'index,follow' : 'noindex,follow'}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="profile"><meta property="og:site_name" content="Nyumba254"><meta property="og:title" content="${escapeHtml(name)} — Nyumba254 Lister Page"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(new URL(`/lister-page-card?handle=${encodeURIComponent(profile.handle)}`, request.url).href)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(name)} — Nyumba254 Lister Page"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(new URL(`/lister-page-card?handle=${encodeURIComponent(profile.handle)}`, request.url).href)}"><script type="application/ld+json">${escapeJsonLd(profileJsonLd)}</script></head><body><main><header><a href="/">Nyumba254</a><h1>${escapeHtml(name)}</h1><p>${escapeHtml(role)} · ID verification does not verify a lister’s role.</p>${profile.profile_location ? `<p>${escapeHtml(profile.profile_location)}</p>` : ''}${profile.bio ? `<p>${escapeHtml(profile.bio)}</p>` : ''}</header><h2>Active listings</h2><ul>${cards || '<li>No active listings currently.</li>'}</ul><p>One link for all your properties. Organise your listings, share them anywhere, and let people view, ask and book in one place.</p></main></body></html>`;
    return new Response(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Could not render crawler-visible Lister Page:', error);
    return null;
  }
}

async function renderListerCard(request, env, handle) {
  try {
    const profile = await listerPageData(env, handle);
    if (!profile || profile.redirect_to) return null;
    const name = escapeHtml(profile.company_name || profile.full_name || 'Nyumba254 lister');
    const role = escapeHtml(roleNames[profile.account_type] || 'Lister');
    const area = escapeHtml(profile.profile_location || 'Across Kenya');
    const count = Number(profile.listing_count) || 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#085041"/><stop offset="1" stop-color="#1D9E75"/></linearGradient></defs><rect width="1200" height="630" rx="32" fill="url(#bg)"/><circle cx="1030" cy="90" r="260" fill="#fff" opacity=".06"/><text x="96" y="170" fill="#C9F0E0" font-family="Arial,sans-serif" font-size="28" font-weight="700">NYUMBA254 · LISTER PAGE</text><text x="96" y="300" fill="#fff" font-family="Arial,sans-serif" font-size="64" font-weight="700">${name}</text><text x="96" y="370" fill="#E1F5EE" font-family="Arial,sans-serif" font-size="34">${role}${profile.verified_role === profile.account_type ? ' · Role verified' : ' · Not verified'}</text><text x="96" y="450" fill="#fff" font-family="Arial,sans-serif" font-size="28">${count} ${count === 1 ? 'property' : 'properties'} · ${area}</text><text x="96" y="560" fill="#fff" opacity=".82" font-family="Arial,sans-serif" font-size="24">One link to browse, ask and request viewings.</text></svg>`;
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    console.error('Could not render Lister Page share card:', error);
    return null;
  }
}

async function renderSitemapXml(origin, env) {
  const staticPaths = ['/', '/plans', '/faq', '/how-it-works', '/terms', '/privacy', '/viewing-fee-policy', '/sitemap'];
  const urls = staticPaths.map((path) => ({ loc: origin + path }));
  if (env.NYUMBA254_SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
      const listingsQuery = new URL('/rest/v1/listings', env.NYUMBA254_SUPABASE_URL);
      listingsQuery.search = new URLSearchParams({
        select: 'listing_number,updated_at,county',
        status: 'eq.active',
        is_disabled: 'eq.false',
        recycle_bin: 'eq.false',
        order: 'listing_number.desc',
        limit: '5000',
      }).toString();
      const response = await fetch(listingsQuery, { headers });
      if (response.ok) {
        const counties = new Map();
        for (const row of await response.json()) {
          if (row.county && (!counties.has(row.county) || (row.updated_at || '') > counties.get(row.county))) {
            counties.set(row.county, row.updated_at || '');
          }
          urls.push({
            loc: `${origin}/listing?id=${String(row.listing_number).padStart(6, '0')}`,
            lastmod: row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 10) : '',
          });
        }
        for (const [county, updated] of counties) {
          urls.push({ loc: `${origin}/listings?county=${encodeURIComponent(county)}`, lastmod: updated ? new Date(updated).toISOString().slice(0, 10) : '' });
        }
      } else {
        console.error('Sitemap listings lookup failed:', response.status);
      }
      const pagesResponse = await fetch(new URL('/rest/v1/rpc/get_sitemap_lister_pages', env.NYUMBA254_SUPABASE_URL), {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: '{}',
      });
      if (pagesResponse.ok) {
        for (const row of await pagesResponse.json()) {
          urls.push({ loc: `${origin}/@${encodeURIComponent(row.handle)}`, lastmod: row.lastmod ? new Date(row.lastmod).toISOString().slice(0, 10) : '' });
        }
      } else {
        console.error('Sitemap Lister Page lookup failed:', pagesResponse.status);
      }
    } catch (error) {
      console.error('Sitemap generation failed:', error);
    }
  }
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `<url><loc>${escapeHtml(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
  return new Response(body, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

async function renderListingPreview(request, env, listingNumber) {
    if (!env.NYUMBA254_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY || !/^\d{1,12}$/.test(listingNumber || '')) return null;
    try {
      const query = new URL('/rest/v1/listings', env.NYUMBA254_SUPABASE_URL);
      query.search = new URLSearchParams({
        select: 'listing_number,title,description,area,county,price,price_type,category,bedrooms,status,is_disabled,recycle_bin',
        listing_number: `eq.${Number(listingNumber)}`,
        status: 'eq.active',
        is_disabled: 'eq.false',
        recycle_bin: 'eq.false',
        limit: '1',
      }).toString();
      const response = await fetch(query, {
        headers: {
          apikey: env.SUPABASE_SERVICE_ROLE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
        },
      });
      if (!response.ok) {
        console.error('Crawler listing lookup failed:', response.status);
        return null;
      }
      const [listing] = await response.json();
      if (!listing) return null;
      const title = sanitizeCrawlerText(listing.title) || 'Property listing';
      const location = sanitizeCrawlerText([listing.area, listing.county].filter(Boolean).join(', '));
      const listingDescription = sanitizeCrawlerText(listing.description);
      const price = Number(listing.price) > 0
        ? `KES ${Number(listing.price).toLocaleString('en-KE')}${listing.price_type === 'rent' ? ' per month' : ''}`
        : '';
      const description = [location, price, listingDescription].filter(Boolean).join(' · ').slice(0, 300);
      const canonical = new URL(`/listing?id=${String(listing.listing_number).padStart(6, '0')}`, request.url).href;
      const listingJsonLd = {
        '@context': 'https://schema.org',
        '@type': 'RealEstateListing',
        name: title,
        description,
        url: canonical,
        address: { '@type': 'PostalAddress', addressLocality: sanitizeCrawlerText(listing.area), addressRegion: sanitizeCrawlerText(listing.county), addressCountry: 'KE' },
        offers: { '@type': 'Offer', price: Number(listing.price) || undefined, priceCurrency: 'KES', availability: 'https://schema.org/InStock' },
      };
      const image = new URL('/hero-photo.jpg', request.url).href;
      const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)} — Nyumba254</title><meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="index,follow"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="Nyumba254"><meta property="og:title" content="${escapeHtml(title)} — Nyumba254"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)} — Nyumba254"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><script type="application/ld+json">${escapeJsonLd(listingJsonLd)}</script></head><body><main><a href="/">Nyumba254</a><h1>${escapeHtml(title)}</h1><p>${escapeHtml(location)}</p>${price ? `<p>${escapeHtml(price)}</p>` : ''}<p>${escapeHtml(listingDescription)}</p><a href="${escapeHtml(canonical)}">View listing details</a></main></body></html>`;
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'public, max-age=60, s-maxage=300',
          'X-Content-Type-Options': 'nosniff',
        },
      });
    } catch (error) {
      console.error('Could not render crawler-visible listing:', error);
      return null;
    }
  }

function supabaseRestUrl(baseUrl, table, params) {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

async function pruneListerPageAnalytics(env) {
  if (!env.NYUMBA254_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Cannot prune Lister Page analytics: Supabase service configuration is missing.');
    return;
  }
  const response = await fetch(`${env.NYUMBA254_SUPABASE_URL}/rest/v1/rpc/prune_lister_page_analytics`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `******`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) {
    console.error('Could not prune Lister Page analytics:', response.status);
    return;
  }
  console.info('Pruned expired Lister Page analytics:', await response.json());
}

async function supabaseRequest(env, table, params, options = {}) {
  if (!env.NYUMBA254_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Scheduled publishing requires NYUMBA254_SUPABASE_URL and the SUPABASE_SERVICE_ROLE_KEY secret.');
  }
  const response = await fetch(supabaseRestUrl(env.NYUMBA254_SUPABASE_URL, table, params), {
    ...options,
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase ${table} request failed (${response.status}): ${detail.slice(0, 500)}`);
  }
  if (response.status === 204) return [];
  const body = await response.text();
  return body ? JSON.parse(body) : [];
}

function sellerPlanCoversListing(profile, listing, now) {
  if (!profile) return false;
  const live = !profile.subscription_expires_at || new Date(profile.subscription_expires_at) > now;
  const elite = !!profile.subscription_tier &&
    profile.subscription_tier !== 'none' &&
    profile.subscription_plan === 'elite' &&
    live;
  const bnb = !!profile.has_bnb_capacity &&
    !!profile.bnb_expires_at &&
    new Date(profile.bnb_expires_at) > now;
  const rental = !!profile.has_rental_capacity &&
    !!profile.subscription_tier &&
    profile.subscription_tier !== 'none' &&
    live;
  return listing.category === 'airbnb' ? bnb || elite : rental;
}

async function publishDueListings(env) {
  const now = new Date();
  const nowIso = now.toISOString();
  const settings = await supabaseRequest(env, 'platform_settings', {
    select: 'value',
    key: 'eq.require_payment_to_publish',
    limit: '1',
  });
  const paymentBypassEnabled = Number(settings[0]?.value) === 0;
  const due = await supabaseRequest(env, 'listings', {
    select: 'id,seller_id,title,category,payment_status,publish_at,is_disabled,recycle_bin',
    status: 'eq.scheduled',
    publish_at: `lte.${nowIso}`,
    limit: '100',
    order: 'publish_at.asc',
  });
  const planCache = new Map();
  let published = 0;

  for (const listing of due) {
    if (listing.is_disabled || listing.recycle_bin) {
      console.warn('Skipped scheduled listing because it is disabled or in the recycle bin:', listing.id);
      continue;
    }

    let eligible = paymentBypassEnabled ||
      listing.payment_status === 'paid' ||
      listing.payment_status === 'trial';
    if (!eligible && listing.seller_id) {
      if (!planCache.has(listing.seller_id)) {
        planCache.set(listing.seller_id, supabaseRequest(env, 'profiles', {
          select: 'has_bnb_capacity,bnb_expires_at,has_rental_capacity,subscription_tier,subscription_plan,subscription_expires_at',
          id: `eq.${listing.seller_id}`,
          limit: '1',
        }).then(rows => rows[0] || null));
      }
      eligible = sellerPlanCoversListing(await planCache.get(listing.seller_id), listing, now);
    }
    if (!eligible) {
      console.warn('Skipped scheduled listing because payment or plan eligibility could not be confirmed:', listing.id);
      continue;
    }

    const filters = {
      id: `eq.${listing.id}`,
      status: 'eq.scheduled',
      publish_at: `lte.${nowIso}`,
      and: '(or(is_disabled.is.null,is_disabled.eq.false),or(recycle_bin.is.null,recycle_bin.eq.false))',
      select: 'id,seller_id,title',
    };
    filters.payment_status = listing.payment_status == null
      ? 'is.null'
      : `eq.${listing.payment_status}`;
    const updated = await supabaseRequest(env, 'listings', filters, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'active', publish_at: null }),
    });
    if (!updated.length) continue;
    published += updated.length;

    const notifications = updated.map(row => ({
      seller_id: row.seller_id,
      type: 'listing_approved',
      title: 'Scheduled listing is now live',
      body: `"${row.title}" is now visible to buyers.`,
      link: '/dashboard#listings',
    }));
    try {
      await supabaseRequest(env, 'notifications', {}, {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify(notifications),
      });
    } catch (error) {
      console.error('Scheduled listing published, but seller notification failed:', rowIds(updated), error);
    }
  }

  console.info(`Scheduled publishing completed: ${published} listing(s) published.`);
}

function rowIds(rows) {
  return rows.map(row => row.id);
}