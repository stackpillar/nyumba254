export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
  },
};

function supabaseRestUrl(baseUrl, table, params) {
  const url = new URL(`/rest/v1/${table}`, baseUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
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