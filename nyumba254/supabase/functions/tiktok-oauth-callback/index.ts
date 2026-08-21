import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SITE_URL = (Deno.env.get("SITE_URL") || "https://nyumba254.com/").replace(/\/+$/, "");

const FB_APP_ID = Deno.env.get("FB_APP_ID");
const FB_APP_SECRET = Deno.env.get("FB_APP_SECRET");
const FB_PAGE_ID = Deno.env.get("FB_PAGE_ID");
const FB_PAGE_ACCESS_TOKEN = Deno.env.get("FB_PAGE_ACCESS_TOKEN");
const IG_BUSINESS_ACCOUNT_ID = Deno.env.get("IG_BUSINESS_ACCOUNT_ID");
const IG_ACCESS_TOKEN = Deno.env.get("IG_ACCESS_TOKEN");
const FB_API_VERSION = "v19.0";

const TIKTOK_CLIENT_KEY = Deno.env.get("TIKTOK_CLIENT_KEY");
const TIKTOK_CLIENT_SECRET = Deno.env.get("TIKTOK_CLIENT_SECRET");
const TIKTOK_AUDITED = (Deno.env.get("TIKTOK_AUDITED") || "false") === "true";

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function fmtKES(n: unknown): string {
  const num = Number(n);
  return `KES ${(Number.isFinite(num) ? num : 0).toLocaleString("en-KE")}`;
}

async function requireAdmin(req: Request): Promise<{ id: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) return null;
  const { data: profile } = await supabaseAdmin.from("profiles").select("id, role").eq("id", userData.user.id).single();
  if (!profile || profile.role !== "admin") return null;
  return { id: profile.id };
}

function buildCaption(listing: any): string {
  const price = fmtKES(listing.price) + (listing.price_type === "rent" ? "/mo" : "");
  const location = [listing.area, listing.county].filter(Boolean).join(", ");
  const url = `${SITE_URL}/listing.html?id=${String(listing.listing_number).padStart(6, "0")}`;
  return [
    listing.title,
    `${price} — ${location}`,
    listing.description ? listing.description.slice(0, 200) : "",
    "",
    `View this listing: ${url}`,
    "",
    "Nyumba254 — no agents, no commission.",
  ].filter(Boolean).join("\n");
}

async function postToFacebook(listing: any, imageUrl: string, caption: string) {
  if (!FB_PAGE_ID || !FB_PAGE_ACCESS_TOKEN) {
    return { success: false, error: "Facebook Page ID / Access Token not configured" };
  }
  try {
    const params = new URLSearchParams({ url: imageUrl, caption, access_token: FB_PAGE_ACCESS_TOKEN });
    const res = await fetch(`https://graph.facebook.com/${FB_API_VERSION}/${FB_PAGE_ID}/photos`, {
      method: "POST",
      body: params,
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }
    return { success: true, postId: data.post_id || data.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function postToInstagram(listing: any, imageUrl: string, caption: string) {
  if (!IG_BUSINESS_ACCOUNT_ID || !IG_ACCESS_TOKEN) {
    return { success: false, error: "Instagram Business Account not linked yet" };
  }
  try {
    const createRes = await fetch(`https://graph.instagram.com/${FB_API_VERSION}/${IG_BUSINESS_ACCOUNT_ID}/media`, {
      method: "POST",
      body: new URLSearchParams({ image_url: imageUrl, caption, access_token: IG_ACCESS_TOKEN }),
    });
    const createData = await createRes.json();
    if (!createRes.ok || createData.error) {
      return { success: false, error: createData.error?.message || `HTTP ${createRes.status}` };
    }
    const publishRes = await fetch(`https://graph.instagram.com/${FB_API_VERSION}/${IG_BUSINESS_ACCOUNT_ID}/media_publish`, {
      method: "POST",
      body: new URLSearchParams({ creation_id: createData.id, access_token: IG_ACCESS_TOKEN }),
    });
    const publishData = await publishRes.json();
    if (!publishRes.ok || publishData.error) {
      return { success: false, error: publishData.error?.message || `HTTP ${publishRes.status}` };
    }
    return { success: true, postId: publishData.id };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

function toProxiedImageUrl(supabaseUrl: string): string {
  // Converts a raw Supabase storage URL into the nyumba254.com/img/ proxied version
  const marker = "/storage/v1/object/public/";
  const idx = supabaseUrl.indexOf(marker);
  if (idx === -1) return supabaseUrl; // not a Supabase storage URL, leave as-is
  const path = supabaseUrl.slice(idx + marker.length);
  return `https://nyumba254.com/img/${path}`;
}

async function getTiktokAccessToken(): Promise<string | null> {
  const { data: row } = await supabaseAdmin.from("social_oauth_tokens").select("*").eq("platform", "tiktok").single();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() > Date.now() + 60_000) return row.access_token;

  const res = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", "Cache-Control": "no-cache" },
    body: new URLSearchParams({
      client_key: TIKTOK_CLIENT_KEY!,
      client_secret: TIKTOK_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
  });
  const data = await res.json();
  if (!res.ok || data.error) return null;

  const now = Date.now();
  await supabaseAdmin.from("social_oauth_tokens").update({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: new Date(now + data.expires_in * 1000).toISOString(),
    refresh_expires_at: data.refresh_expires_in ? new Date(now + data.refresh_expires_in * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq("platform", "tiktok");

  return data.access_token;
}

async function postToTiktok(listing: any, imageUrl: string, caption: string) {
  imageUrl = toProxiedImageUrl(imageUrl);
  if (!TIKTOK_CLIENT_KEY || !TIKTOK_CLIENT_SECRET) {
    return { success: false, error: "TikTok not configured yet" };
  }
  const accessToken = await getTiktokAccessToken();
  if (!accessToken) {
    return { success: false, error: "TikTok not connected — visit the tiktok-oauth-callback URL to authorize" };
  }
  try {
    const res = await fetch("https://open.tiktokapis.com/v2/post/publish/content/init/", {
      method: "POST",
      headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify({
        post_info: {
          title: caption.slice(0, 90),
          privacy_level: TIKTOK_AUDITED ? "PUBLIC_TO_EVERYONE" : "SELF_ONLY",
          disable_comment: false,
        },
        source_info: { source: "PULL_FROM_URL", photo_images: [imageUrl], photo_cover_index: 0 },
        post_mode: "DIRECT_POST",
        media_type: "PHOTO",
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error?.code !== "ok") {
      return { success: false, error: data.error?.message || `HTTP ${res.status}` };
    }
    return { success: true, postId: data.data?.publish_id, note: TIKTOK_AUDITED ? undefined : "Posted as private/self-only — TikTok app not yet audited" };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

async function notifySellerOfSocialPost(listing: any, platform: string) {
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-notification-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SUPABASE_SERVICE_ROLE_KEY, "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}` },
      body: JSON.stringify({
        type: "listing_shared_social",
        audience: "seller",
        listingId: listing.id,
        listingTitle: listing.title,
        platform,
        sellerName: listing.profiles?.full_name,
        sellerEmail: listing.profiles?.email,
      }),
    });
  } catch (err) {
    console.error("notifySellerOfSocialPost failed:", err);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const admin = await requireAdmin(req);
  if (!admin) return json({ error: "Unauthorized — admin only" }, 401);

  let body: { listingId?: string; platforms?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { listingId, platforms } = body;
  if (!listingId || !Array.isArray(platforms) || !platforms.length) {
    return json({ error: "listingId and platforms[] are required" }, 400);
  }

  const { data: listing, error: listErr } = await supabaseAdmin
    .from("listings")
    .select("*, profiles(full_name, email), listing_photos(*)")
    .eq("id", listingId)
    .single();

  if (listErr || !listing) return json({ error: "Listing not found" }, 404);

  const cover = (listing.listing_photos || []).find((p: any) => p.is_cover) || listing.listing_photos?.[0];
  if (!cover?.url) return json({ error: "This listing has no photo to post" }, 400);

  const caption = buildCaption(listing);
  const results: Record<string, any> = {};

  for (const platform of platforms) {
    let result;
    if (platform === "facebook") result = await postToFacebook(listing, cover.url, caption);
    else if (platform === "instagram") result = await postToInstagram(listing, cover.url, caption);
    else if (platform === "tiktok") result = await postToTiktok(listing, cover.url, caption);
    else { results[platform] = { success: false, error: "Unknown platform" }; continue; }

    results[platform] = result;

    await supabaseAdmin.from("social_posts").insert({
      listing_id: listingId,
      platform,
      external_post_id: result.success ? result.postId : null,
      status: result.success ? "posted" : "failed",
      error_message: result.success ? null : result.error,
      posted_by: admin.id,
    });

    if (result.success && listing.profiles?.email) {
      await notifySellerOfSocialPost(listing, platform);
    }
  }

  return json({ success: true, results });
});