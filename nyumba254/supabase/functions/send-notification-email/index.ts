import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { SMTPClient } from "https://deno.land/x/denomailer/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GMAIL_USER = Deno.env.get("GMAIL_USER");
const GMAIL_APP_PASSWORD = Deno.env.get("GMAIL_APP_PASSWORD");
// Trim any trailing slash so we never produce accidental "//listing.html" links.
const SITE_URL = (Deno.env.get("SITE_URL") || "https://nyumba254.com/").replace(/\/+$/, "");
const ADMIN_EMAIL = "hellonyumba254@gmail.com";
// Add any additional inbox that should also get contact-form and buyer-enquiry
// notifications — replace the placeholder below with your real email address.
const ADMIN_EMAIL_2 = "omondiedward616@gmail.com";
const ADMIN_EMAILS = [ADMIN_EMAIL, ADMIN_EMAIL_2];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Real, hosted brand asset (same file referenced as the apple-touch-icon on
// nyumba254.com) — used as the actual logo mark in every email header
// instead of an emoji placeholder.
const LOGO_URL = `${SITE_URL}/apple-touch-icon.png`;

// ── Supabase admin client, used ONLY to resolve a listing's public
// listing_number from its UUID when the caller didn't already include one
// in the payload. Supabase automatically injects SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY into every edge function's environment, so no
// extra secrets need to be configured for this to work. If for some reason
// they're missing, supabaseAdmin stays null and we fall back gracefully
// (see resolveListingUrl below) instead of throwing.
const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const supabaseAdmin =
  SUPABASE_URL_ENV && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL_ENV, SUPABASE_SERVICE_ROLE_KEY)
    : null;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value.trim());
}

function fmtKES(n: unknown): string {
  const num = Number(n);
  return `KES ${(Number.isFinite(num) ? num : 0).toLocaleString("en-KE")}`;
}

// ── MIME safety net for Subject headers ─────────────────────────────────
// ROOT CAUSE OF THE "raw MIME source shown as the email body" BUG:
// several Subject lines below contain an em dash (—, U+2014). Subject is a
// header, and headers must be 7-bit ASCII on the wire — anything outside
// ASCII has to be RFC 2047 encoded ("=?UTF-8?B?...?="). We now do that
// replacement at the template level (em dash -> plain hyphen, see every
// `subject:` string), but as defense-in-depth this function ALSO encodes
// the final subject right before sending, so no future handler — or an
// admin-typed subject in admin_seller_notice — can ever reintroduce the
// same corruption. A malformed/un-encoded Subject header is exactly what
// makes Gmail give up parsing the message and dump the raw multipart
// source (headers, boundaries and all) into the body pane.
// Denomailer applies its OWN internal header-safety encoding automatically
// whenever a subject contains characters like "=" or "?" — it does this
// even if the string is already a valid RFC 2047 encoded-word, wrapping it
// in a second layer of encoding (this is why you saw
// "=?utf-8?Q?=3d?UTF-8?B?..." — that's denomailer Q-encoding our own
// B-encoded output). So we don't hand-encode the subject anymore. Instead
// we strip it down to plain ASCII before it ever reaches denomailer, so
// its internal encoder never fires in the first place — this works no
// matter what a seller types into a listing title (dashes, curly quotes,
// accents, emoji, non-Latin scripts, anything).
function asciiSafeSubject(subject: string): string {
  const s = String(subject ?? "");
  return s
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")  // strip accents: é -> e, ñ -> n
    .replace(/[\u2013\u2014]/g, "-")  // en/em dash -> hyphen
    .replace(/[\u2018\u2019]/g, "'")  // curly single quotes -> '
    .replace(/[\u201c\u201d]/g, '"')  // curly double quotes -> "
    .replace(/\u2026/g, "...")        // ellipsis -> three dots
    .replace(/[^\x00-\x7F]/g, "")     // drop anything else non-ASCII (emoji etc.)
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Real plain-text alternative part. We stopped passing `content: "auto"` to
// denomailer — relying on its automatic text-extraction was the second half
// of the original bug. Generating our own plain-text version is cheap and
// guarantees a clean, simple multipart/alternative structure every time.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Collapses the template's newlines/indentation into a single compact line.
// Without this, blank/whitespace-only lines inside the template literal
// get quoted-printable encoded as a literal "=20" soft line break — and
// some mail clients render that literally instead of decoding it.
// The trailing replace() below is defense-in-depth: it strips any stray
// "=20"/"=0D"/"=0A" artifact that slips through despite the collapsing,
// e.g. from a future template that reintroduces the pattern.
function minifyHtml(html: string): string {
  return html
    .replace(/\r?\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/>\s+</g, "><")
    .replace(/=(20|0D|0A)(?=\s|<|$)/g, "")
    .trim();
}

// ── Listing URL resolution ──────────────────────────────────────────────
// listing.html only accepts its zero-padded listing_number in the URL
// (e.g. ?id=000024) — it no longer accepts the raw UUID. Every email
// template's "View listing" button goes through this one function, so
// fixing it here fixes every template at once.
//
// Resolution order:
//   1. If the caller already passed listingNumber in the payload, use it
//      directly — no DB round-trip needed.
//   2. Otherwise, look it up from listingId (the UUID) via Supabase.
//   3. If neither is available (or the lookup fails), link to the general
//      listings page instead of building a broken UUID URL.
// Resolves seller email/name for notifications so the frontend never has
// to fetch or pass a seller's email (which listing.html's RLS-scoped
// query doesn't expose anyway). Falls back to whatever the caller passed.
async function resolveSellerContact(p: Payload): Promise<{ sellerEmail: string | null; sellerName: string | null }> {
  if (isValidEmail(p.sellerEmail)) {
    return { sellerEmail: p.sellerEmail, sellerName: p.sellerName || null };
  }
  if (!supabaseAdmin || !p.listingId) return { sellerEmail: null, sellerName: p.sellerName || null };
  try {
    const { data, error } = await supabaseAdmin
      .from("listings")
      .select("profiles(email, full_name)")
      .eq("id", p.listingId)
      .single();
    if (!error && data?.profiles) {
      return {
        sellerEmail: (data.profiles as any).email || null,
        sellerName: (data.profiles as any).full_name || p.sellerName || null,
      };
    }
  } catch (err) {
    console.error("resolveSellerContact: lookup threw", err);
  }
  return { sellerEmail: null, sellerName: p.sellerName || null };
}
async function resolveListingUrl(p: Payload): Promise<string> {
  if (!p.listingId && p.listingNumber == null) return `${SITE_URL}/listings`;

  if (p.listingNumber != null) {
    return `${SITE_URL}/listing?id=${String(p.listingNumber).padStart(6, "0")}`;
  }

  if (supabaseAdmin && p.listingId) {
    try {
      const { data, error } = await supabaseAdmin
        .from("listings")
        .select("listing_number")
        .eq("id", p.listingId)
        .single();
      if (!error && data?.listing_number != null) {
        return `${SITE_URL}/listing?id=${String(data.listing_number).padStart(6, "0")}`;
      }
      console.error("resolveListingUrl: lookup returned no listing_number", { listingId: p.listingId, error });
    } catch (err) {
      console.error("resolveListingUrl: lookup threw", err);
    }
  }

  // Couldn't resolve a real listing_number — better to link somewhere that
  // works than to build a listing.html?id=<uuid> link that 404s.
  return `${SITE_URL}/listings`;
}

// ─── Standard nav-link sets, reused across templates ───
const sellerLinks: Array<[string, string]> = [
  ["Home", `${SITE_URL}/index.html`],
  ["My Dashboard", `${SITE_URL}/dashboard.html`],
  ["Browse Listings", `${SITE_URL}/listings`],
];
const buyerLinks: Array<[string, string]> = [
  ["Home", `${SITE_URL}/index.html`],
  ["Browse Listings", `${SITE_URL}/listings`],
];
const adminLinks: Array<[string, string]> = [
  ["Admin Dashboard", `${SITE_URL}/admin.html`],
  ["Home", `${SITE_URL}/index.html`],
];

// Small centered row of quick links, rendered inside the footer of every
// email so there's always a clickable way back into the site — not just
// the single main CTA button.
function quickLinksRow(links: Array<[string, string]>): string {
  const safeLinks = links && links.length ? links : ([["Home", `${SITE_URL}/index.html`]] as Array<[string, string]>);
  const items = safeLinks
    .map(
      ([label, url]) =>
        `<a href="${escapeHtml(url)}" style="color:#0F6E56;text-decoration:none;font-size:12.5px;font-weight:700;letter-spacing:.01em;">${escapeHtml(label)}</a>`
    )
    .join(`<span style="color:#d5d3ca;padding:0 10px;font-size:11px;">&bull;</span>`);
  return `<tr><td style="padding:18px 36px 0;text-align:center;">${items}</td></tr>`;
}

// ── Premium shared shell ─────────────────────────────────────────────────
// Refreshed for a "beyond professional" look: real logo mark, a slim brand
// accent bar, tighter type scale, a card that reads as a considered
// product rather than a generic transactional template, while staying
// within table-based, inline-styled, email-client-safe HTML.
function renderShell(opts: {
  heading: string;
  bodyHtml: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
  quickLinks?: Array<[string, string]>;
  preheader?: string;
  eyebrow?: string;
}): string {
  const { heading, bodyHtml, ctaLabel, ctaUrl, footerNote, quickLinks, preheader, eyebrow } = opts;
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0;">${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
    : "";
  const eyebrowHtml = eyebrow
    ? `<div style="display:inline-block;background:#E1F5EE;color:#0F6E56;font-size:11px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;padding:5px 12px;border-radius:20px;margin-bottom:14px;">${escapeHtml(eyebrow)}</div>`
    : "";
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${escapeHtml(heading)}</title>
</head>
<body style="margin:0;padding:0;background:#eeece4;font-family:Arial,Helvetica,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eeece4;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(8,80,65,0.06),0 12px 32px rgba(8,80,65,0.10);">
          <!-- Brand accent bar -->
          <tr>
            <td style="height:5px;line-height:5px;font-size:0;background:linear-gradient(90deg,#0F6E56 0%,#1D9E75 55%,#6FE0B8 100%);">&nbsp;</td>
          </tr>
          <!-- Header -->
          <tr>
            <td style="background:#085041;padding:30px 36px;text-align:center;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 14px;">
                <tr>
                  <td style="width:46px;height:46px;border-radius:12px;overflow:hidden;background:#ffffff;">
                    <img src="${LOGO_URL}" width="46" height="46" alt="Nyumba254" style="display:block;width:46px;height:46px;border-radius:12px;border:0;"/>
                  </td>
                </tr>
              </table>
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:700;color:#ffffff;letter-spacing:.01em;">Nyumba254</div>
              <div style="font-family:Arial,Helvetica,sans-serif;font-size:10.5px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8FD6BE;margin-top:5px;">Kenya's No-Agent Property Marketplace</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 36px 26px;">
              ${eyebrowHtml}
              <h1 style="margin:0 0 16px;font-family:Georgia,'Times New Roman',serif;font-size:21px;line-height:1.3;color:#161614;">${heading}</h1>
              ${bodyHtml}
              ${ctaUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px;"><tr><td style="border-radius:10px;background:#0F6E56;box-shadow:0 6px 14px rgba(15,110,86,0.28);"><a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;letter-spacing:.01em;">${escapeHtml(ctaLabel || "View")}</a></td></tr></table>` : ""}
              <hr style="border:none;border-top:1px solid #ece9e1;margin:28px 0 16px;"/>
              <p style="margin:0;font-size:12px;line-height:1.65;color:#8b8a82;">${footerNote || "This is an automated notification from Nyumba254."}</p>
            </td>
          </tr>
          ${quickLinksRow(quickLinks || [])}
          <!-- Footer -->
          <tr>
            <td style="padding:22px 36px 26px;border-top:1px solid #ece9e1;text-align:center;margin-top:10px;">
              <div style="font-family:Georgia,'Times New Roman',serif;font-size:13.5px;color:#4a4a46;font-weight:700;margin-bottom:6px;">Nyumba254</div>
              <p style="margin:0 0 4px;font-size:11.5px;color:#98978f;">Kisumu &middot; Nairobi &middot; Mombasa &middot; Kenya</p>
              <p style="margin:0;font-size:11px;color:#b3b2a9;">No agents. No commission. Just your listing in front of real buyers.</p>
            </td>
          </tr>
        </table>
        <table role="presentation" width="520" cellpadding="0" cellspacing="0" style="max-width:520px;width:100%;">
          <tr>
            <td style="padding:18px 8px 0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#a6a59c;">You're receiving this email because of activity on your Nyumba254 account or listing.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function factCard(rows: Array<[string, string]>): string {
  const safeRows = rows.filter(([, v]) => v !== undefined && v !== null && v !== "");
  if (!safeRows.length) return "";
  const inner = safeRows
    .map(
      ([label, value], i) =>
        `<tr><td style="padding:${i === 0 ? "0 0 8px" : "8px 0"};font-size:12.5px;color:#8b8a82;width:110px;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:${i === 0 ? "0 0 8px" : "8px 0"};font-size:13.5px;color:#161614;font-weight:600;vertical-align:top;">${value}</td></tr>`
    )
    .join("");
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#f7f6f2;border:1px solid #ece9e1;border-radius:12px;padding:14px 18px;margin:4px 0 20px;">${inner}</table>`;
}
function para(html: string): string {
  return `<p style="margin:0 0 14px;font-size:14.5px;line-height:1.65;color:#4a4a46;">${html}</p>`;
}
function tip(html: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 16px;"><tr><td style="background:#f7f6f2;border-left:3px solid #1D9E75;border-radius:0 8px 8px 0;padding:11px 15px;font-size:13px;line-height:1.6;color:#5c5b54;">${html}</td></tr></table>`;
}

type EmailOut = { subject: string; html: string; to: string; toName: string; replyTo?: string };
type Payload = Record<string, any>;

// HANDLERS receive ctx already resolved (listingUrl included) — see
// context() further down, which is now async because it may need to
// look up listing_number from Supabase.
const HANDLERS: Record<string, (p: Payload, ctx: Awaited<ReturnType<typeof context>>) => EmailOut[]> = {
  listing_scheduled: (p, { sellerName, listingTitle, listingUrl }) => {
    const when = p.publishAt ? new Date(p.publishAt).toLocaleString("en-KE", { dateStyle: "long", timeStyle: "short" }) : "the scheduled date";
    return [{
      to: p.sellerEmail, toName: p.sellerName || "Seller",
      subject: "Your listing is approved and scheduled - Nyumba254",
      html: renderShell({
        heading: "Approved and scheduled 🕐",
        eyebrow: "Listing update",
        preheader: `"${p.listingTitle || "Your listing"}" is approved and will go live automatically.`,
        bodyHtml:
          para(`Hi ${sellerName},`) +
          para(`Your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been approved. It's scheduled to go live automatically on <strong style="color:#161614;">${escapeHtml(when)}</strong> — no further action needed from you.`) +
          tip(`Want it live sooner? Open your dashboard and use "Publish now" on the listing to skip the wait.`),
        ctaLabel: "View in dashboard", ctaUrl: listingUrl,
        footerNote: "You're receiving this because your scheduled listing was approved on Nyumba254.",
        quickLinks: sellerLinks,
      }),
    }];
  },

  listing_scheduled_published: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your scheduled listing is now live! - Nyumba254",
    html: renderShell({
      heading: "You're live 🎉",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" just went live as scheduled.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`As scheduled, your listing <strong style="color:#161614;">"${listingTitle}"</strong> just went live and is now visible to buyers on Nyumba254.`),
      ctaLabel: "View your listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because your scheduled listing went live on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  price_change: (p, { sellerName, listingTitle, listingUrl }) => {
    const oldP = fmtKES(p.oldPrice) + (p.priceType === "rent" ? "/mo" : "");
    const newP = fmtKES(p.newPrice) + (p.priceType === "rent" ? "/mo" : "");
    return [{
      to: ADMIN_EMAIL, toName: "Admin",
      subject: `Price changed: ${p.listingTitle || ""}`,
      html: renderShell({
        heading: "Listing price changed 💰",
        eyebrow: "Admin alert",
        preheader: `${p.sellerName || "A seller"} changed the price on "${p.listingTitle || "a listing"}" from ${oldP} to ${newP}.`,
        bodyHtml:
          para(`<strong style="color:#161614;">${sellerName}</strong> changed the price on <strong style="color:#161614;">"${listingTitle}"</strong>.`) +
          factCard([["Old price", oldP], ["New price", newP], ["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`]]),
        ctaLabel: "View listing", ctaUrl: listingUrl,
        footerNote: "You're receiving this because a seller updated a listing price on Nyumba254.",
        quickLinks: adminLinks,
      }),
    }];
  },

  listing_pending: (p, { sellerName, listingTitle, listingUrl }) => {
    const adminEmail: EmailOut = {
      to: ADMIN_EMAIL, toName: "Admin",
      subject: `New listing awaiting approval: ${p.listingTitle || ""}`,
      html: renderShell({
        heading: "Listing awaiting your approval 🕐",
        eyebrow: "Admin alert",
        preheader: `"${p.listingTitle || "A listing"}" needs review.`,
        bodyHtml:
          para(`<strong style="color:#161614;">"${listingTitle}"</strong> was submitted (or resubmitted) and is now pending review.`) +
          factCard([["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`]]),
        ctaLabel: "Review listing", ctaUrl: listingUrl,
        footerNote: "You're receiving this because a new listing needs admin approval on Nyumba254.",
        quickLinks: adminLinks,
      }),
    };
    if (!isValidEmail(p.sellerEmail)) return [adminEmail];
    const sellerEmail: EmailOut = {
      to: p.sellerEmail, toName: p.sellerName || "Seller",
      subject: `Your listing is pending review - Nyumba254`,
      html: renderShell({
        heading: "Submitted for review 🕐",
        eyebrow: "Listing update",
        preheader: `"${p.listingTitle || "Your listing"}" is pending our team's review.`,
        bodyHtml:
          para(`Hi ${sellerName},`) +
          para(`Your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been resubmitted and is now pending our team's review. We'll email you the moment it's approved.`) +
          tip(`Approvals are usually completed within 24 hours. No action is needed from you in the meantime.`),
        ctaLabel: "View your listing", ctaUrl: listingUrl,
        footerNote: "You're receiving this because you resubmitted a listing on Nyumba254.",
        quickLinks: sellerLinks,
      }),
    };
    return [adminEmail, sellerEmail];
  },

  listing_submitted_set_password: (p, { sellerName, listingTitle }) => [{
    to: p.sellerEmail, toName: p.sellerName || "there",
    subject: "One more step - set your password | Nyumba254",
    html: renderShell({
      heading: "Your listing is submitted 🎉",
      eyebrow: "One more step",
      preheader: `We've received "${p.listingTitle || "your listing"}" - set a password to manage it.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Thanks — your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been submitted for review. Our team will take a look and you'll be notified once it's approved.`) +
        para(`We've created a free Nyumba254 seller account for you, so you can track this listing, reply to buyers, and manage everything from one dashboard. Just set a password below to activate it — takes less than a minute.`),
      ctaLabel: "Set my password", ctaUrl: p.actionLink,
      footerNote: `You're receiving this because you submitted a listing on Nyumba254. If this link expires, use "Forgot password" on the sign-in page with this same email.`,
      quickLinks: [["Browse Listings", `${SITE_URL}/listings`]],
    }),
  }],

  listing_approved: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your listing is now live! - Nyumba254",
    html: renderShell({
      heading: "You're live 🎉",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" is approved and visible to buyers.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Great news — your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been approved and is now visible to buyers searching on Nyumba254.`) +
        tip(`Add a few more photos or refresh your description any time — listings with complete details tend to get more enquiries.`),
      ctaLabel: "View your listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because your listing was approved on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],
  listing_approved_subscribe_bnb: (p, { sellerName, listingTitle, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Approved - subscribe to go live | Nyumba254",
    html: renderShell({
      heading: "Approved — one step left 🏖️",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" is approved. Subscribe to a BNB plan to make it live.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your Airbnb listing <strong style="color:#161614;">"${listingTitle}"</strong> has been approved. Airbnb listings run on a monthly BNB plan rather than a one-time fee — subscribe from the pricing page to make it live and keep it bookable.`),
      ctaLabel: "View BNB plans", ctaUrl: `${SITE_URL}/plans.html`,
      footerNote: "You're receiving this because your Airbnb listing was approved and needs an active BNB plan on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  listing_approved_payment_required: (p, { sellerName, listingTitle, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your listing is approved - pay to go live | Nyumba254",
    html: renderShell({
      heading: "Approved — one step left 💳",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" is approved. Pay the listing fee to make it live.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Good news — your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been reviewed and approved. Choose Standard or Featured and pay to go live.`) +
        factCard([["Standard", fmtKES(p.standardAmount)], ["Featured", fmtKES(p.featuredAmount)]]) +
        para(`Log in to your dashboard, open this listing, and follow the M-Pesa payment instructions there.`) +
        tip(`Managing several listings? A monthly subscription on our <a href="${SITE_URL}/plans.html" style="color:#0F6E56;font-weight:700">plans page</a> may work out cheaper than paying per listing.`),
      ctaLabel: "Pay from dashboard", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because your listing was approved and is awaiting payment on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  listing_payment_submitted: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Listing payment submitted: ${p.listingTitle || ""}`,
    html: renderShell({
      heading: "Listing payment submitted 💳",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} submitted a ${p.plan || "standard"} payment for "${p.listingTitle || "a listing"}".`,
      bodyHtml:
        para(`<strong style="color:#161614;">${sellerName}</strong> submitted a Paybill payment for <strong style="color:#161614;">"${listingTitle}"</strong>. Confirm it from the Payments tab to make the listing live.`) +
        factCard([["Plan", p.plan === "featured" ? "Featured" : "Standard"], ["Amount", fmtKES(p.amount)], ["M-Pesa ref", escapeHtml(p.reference || "—")]]),
      ctaLabel: "Open Payments tab", ctaUrl: `${SITE_URL}/admin.html`,
      footerNote: "You're receiving this because a seller submitted a listing payment on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  payment_confirmed_admin: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Payment confirmed: ${p.listingTitle || ""} - ${fmtKES(p.amount)}`,
    html: renderShell({
      heading: "Payment confirmed ✓",
      eyebrow: "Admin alert",
      preheader: `Confirmed ${fmtKES(p.amount)} for "${p.listingTitle || "a listing"}" — listing is now live.`,
      bodyHtml:
        para(`A payment was just confirmed and the listing has been activated automatically.`) +
        factCard([
          ["Listing", listingTitle],
          ["Amount", fmtKES(p.amount)],
          ["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`],
          ["M-Pesa ref", escapeHtml(p.reference || "—")],
        ]),
      ctaLabel: "View listing", ctaUrl: listingUrl,
      footerNote: "This is a confirmation record from Nyumba254's payment flow.",
      quickLinks: adminLinks,
    }),
  }],

  listing_rejected: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your listing needs changes - Nyumba254",
    html: renderShell({
      heading: "Listing not approved yet",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" needs a few changes before it can go live.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your listing <strong style="color:#161614;">"${listingTitle}"</strong> wasn't approved${p.reason ? "." : " — please review it and resubmit."}`) +
        factCard([["Reason", escapeHtml(p.reason || "")]]) +
        para(`Once you've made the changes, simply resubmit it from your dashboard and our team will take another look.`),
      ctaLabel: "Edit listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because your listing needs changes before it can go live on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  listing_deactivated: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your listing has been deactivated - Nyumba254",
    html: renderShell({
      heading: "Listing deactivated",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" was deactivated by our team.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been deactivated by our team and is no longer visible to buyers.`) +
        factCard([["Reason", escapeHtml(p.reason || "")]]) +
        para(`If you believe this was a mistake or would like more details, reach out to us and we'll be happy to help.`),
      ctaLabel: "View listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because your listing was deactivated on Nyumba254. Contact support if you have questions.",
      quickLinks: sellerLinks,
    }),
  }],

  listing_recycled: (p, { sellerName, listingTitle, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your listing was moved to the recycle bin - Nyumba254",
    html: renderShell({
      heading: "Listing moved to recycle bin 🗑",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" is in the recycle bin — restore it within 30 days.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been moved to the recycle bin and is hidden from buyers. It will be permanently deleted after 30 days unless restored.`) +
        factCard([["Reason", escapeHtml(p.reason || "")]]) +
        tip(`You can restore it yourself any time before the 30 days are up — just open your dashboard and look under Recycle Bin.`),
      ctaLabel: "Open dashboard", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because your listing was moved to the recycle bin on Nyumba254. Contact support if you'd like it restored sooner.",
      quickLinks: sellerLinks,
    }),
  }],

  listing_restored: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your listing has been restored - Nyumba254",
    html: renderShell({
      heading: "Listing restored ✓",
      eyebrow: "Listing update",
      preheader: `"${p.listingTitle || "Your listing"}" is back and visible to buyers.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Good news — your listing <strong style="color:#161614;">"${listingTitle}"</strong> has been restored from the recycle bin and is back on track.`) +
        tip(`Double check the details are still accurate — prices and availability can shift while a listing is inactive.`),
      ctaLabel: "View listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because your listing was restored on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  account_suspended: (p, { sellerName }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your account is under review - Nyumba254",
    html: renderShell({
      heading: "Account under review",
      eyebrow: "Account notice",
      preheader: `Your account is temporarily under review — no action needed.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your Nyumba254 account has been placed under review and your listings are temporarily hidden from buyers while our team looks into it.`) +
        tip(`Please don't email us about this — the review will be completed soon and we'll follow up here with the outcome.`),
      footerNote: "You're receiving this because your account status changed on Nyumba254.",
      quickLinks: [["Home", `${SITE_URL}/index.html`]],
    }),
  }],

  account_reinstated: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your account has been reinstated - Nyumba254",
    html: renderShell({
      heading: "Welcome back ✓",
      eyebrow: "Account notice",
      preheader: `Your account is reinstated — listings are visible again.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your Nyumba254 account has been reinstated and your listings are visible to buyers again.`) +
        tip(`It's worth a quick check of your listings to make sure prices and availability are still current before buyers start reaching out.`),
      ctaLabel: "Go to dashboard", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because your account status changed on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  payment_confirmed: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Payment confirmed - Nyumba254",
    html: renderShell({
      heading: "Payment confirmed ✓",
      eyebrow: "Payment",
      preheader: `We've confirmed your payment of ${fmtKES(p.amount)} for "${p.listingTitle || "your listing"}".`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`We've confirmed your payment for <strong style="color:#161614;">"${listingTitle}"</strong>. Thank you — your listing is now backed by this payment and will stay active as expected.`) +
        factCard([["Amount", fmtKES(p.amount)]]),
      ctaLabel: "View listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because a payment was confirmed on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  review_response: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Seller responded to a review${p.listingTitle ? ": " + p.listingTitle : ""}`,
    html: renderShell({
      heading: "Seller responded to a review 💬",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} responded to a buyer review.`,
      bodyHtml:
        para(`<strong style="color:#161614;">${sellerName}</strong> responded to a review from <strong style="color:#161614;">${escapeHtml(p.reviewerName || "a buyer")}</strong>${p.listingTitle ? ` on "${listingTitle}"` : ""}.`) +
        factCard([["Response", escapeHtml(p.responseText || "")]]),
      ctaLabel: p.listingId || p.listingNumber ? "View listing" : undefined,
      ctaUrl: p.listingId || p.listingNumber ? listingUrl : undefined,
      footerNote: "You're receiving this because a seller responded to a buyer review on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  new_support_ticket: (p, { sellerName, dashboardUrl }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `New support ticket: ${p.topic || "General"}`,
    html: renderShell({
      heading: "New support ticket 🎫",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} opened a ticket: ${p.topic || "General"}.`,
      bodyHtml:
        para(`<strong style="color:#161614;">${sellerName}</strong> opened a new support ticket.`) +
        factCard([["Ticket", escapeHtml(p.ticketRef || "—")], ["Topic", escapeHtml(p.topic || "General")], ["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`]]),
      ctaLabel: "Open in dashboard", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because a seller opened a support ticket on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  support_handoff: (p, { sellerName, dashboardUrl }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Ticket needs a human: ${p.category || p.ticketRef || ""}`,
    html: renderShell({
      heading: "A ticket needs a human reply 🙋",
      eyebrow: "Admin alert",
      preheader: `A support ticket was escalated and needs an agent reply.`,
      bodyHtml:
        para(`Our support bot couldn't resolve this one — it needs a reply from an agent.`) +
        factCard([["Ticket", escapeHtml(p.ticketRef || "—")], ["Category", escapeHtml(p.category || "—")], ["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`]]),
      ctaLabel: "Open in dashboard", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because a support ticket was escalated on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  // ─── Premium/Elite subscription payment submitted from plans.html.
  // Posted as notifyByEmail('premium_payment_submitted', { audience:'admin',
  // plan, tier, amount, reference, sellerName, sellerEmail }). The admin
  // confirms it from the Payments tab, which auto-activates the plan.
  premium_payment_submitted: (p, { sellerName }) => {
    const planLabel = p.plan === "elite" ? "Elite" : "Premium";
    const tierLabel = p.tier === "yearly" ? "Yearly" : "Monthly";
    return [{
      to: ADMIN_EMAIL, toName: "Admin",
      subject: `New ${planLabel} payment submitted: ${p.sellerName || p.sellerEmail || "a seller"}`,
      html: renderShell({
        heading: "Subscription payment submitted 💳",
        eyebrow: "Admin alert",
        preheader: `${p.sellerName || p.sellerEmail || "A seller"} submitted a ${planLabel} (${tierLabel}) payment for verification.`,
        bodyHtml:
          para(`<strong style="color:#161614;">${sellerName}</strong> (${escapeHtml(p.sellerEmail || "—")}) submitted a Paybill payment for a subscription plan. Confirm it from the Payments tab to activate their plan automatically.`) +
          factCard([
            ["Plan", `${planLabel} — ${tierLabel}`],
            ["Amount", fmtKES(p.amount)],
            ["M-Pesa ref", escapeHtml(p.reference || "—")],
            ["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`],
          ]) +
          tip(`Confirming this payment in the admin Payments tab activates the plan immediately — no separate "Grant Premium" step needed.`),
        ctaLabel: "Open Payments tab", ctaUrl: `${SITE_URL}/admin.html`,
        footerNote: "You're receiving this because a seller submitted a subscription payment on Nyumba254.",
        quickLinks: adminLinks,
      }),
    }];
  },

  // ─── Admin → seller email reminder (from the admin dashboard's
  // "Email reminder" modal). Posted as notifyByEmail('admin_seller_notice',
  // { audience:'seller', noticeType, subject, message, sellerName, sellerEmail }).
  // subject/message are whatever the admin typed after picking (and
  // optionally editing) a template — sent as-is (still passed through the
  // encodeMimeSubject() safety net at send time), no server-side templating.
  admin_seller_notice: (p, { sellerName, dashboardUrl }) => {
    const subject = String(p.subject || "A message from Nyumba254").trim() || "A message from Nyumba254";
    const messageHtml = escapeHtml(p.message || "").replace(/\n/g, "<br/>");
    return [{
      to: p.sellerEmail, toName: p.sellerName || "there",
      subject,
      html: renderShell({
        heading: escapeHtml(subject),
        eyebrow: "Message from Nyumba254",
        preheader: String(p.message || "").slice(0, 140),
        bodyHtml: para(`Hi ${sellerName},`) + para(messageHtml),
        ctaLabel: "Open dashboard", ctaUrl: dashboardUrl,
        footerNote: "You're receiving this because an admin sent you a notice on Nyumba254.",
        quickLinks: sellerLinks,
      }),
    }];
  },

  // ═══════════════════════════════════════════════════════════
  // NOTIFY ME — buyer listing alerts (listings.html "Notify me")
  // ═══════════════════════════════════════════════════════════

  alert_confirmation: (p) => {
    const alertName = escapeHtml(p.alertName || "there");
    return [{
      to: p.alertEmail, toName: p.alertName || "there",
      subject: "You're set - we'll email you about new matches | Nyumba254",
      html: renderShell({
        heading: "Alert created ✅",
        eyebrow: "Listing alert",
        preheader: `We'll email you the moment a matching listing goes live.`,
        bodyHtml:
          para(`Hi ${alertName},`) +
          para(`We've saved your search preferences. The moment a listing goes live that matches what you're looking for, we'll email you here — no need to keep checking back.`) +
          tip(`Alerts stay active until you find a place. You can manage or cancel them any time from the listings page.`),
        ctaLabel: "Keep browsing", ctaUrl: `${SITE_URL}/listings`,
        footerNote: "You're receiving this because you set up a listing alert on Nyumba254.",
        quickLinks: buyerLinks,
      }),
    }];
  },

  listing_alert_match: (p, { listingTitle, listingUrl }) => {
    const alertName = escapeHtml(p.alertName || "there");
    const listingPrice = fmtKES(p.listingPrice) + (p.priceType === "rent" ? "/mo" : "");
    return [{
      to: p.alertEmail, toName: p.alertName || "there",
      subject: `New match for you: ${p.listingTitle || "a new listing"} - Nyumba254`,
      html: renderShell({
        heading: "We found a match for you 🎯",
        eyebrow: "New match",
        preheader: `"${p.listingTitle || "A new listing"}" in ${p.listingArea || "your area"} matches your saved search.`,
        bodyHtml:
          para(`Hi ${alertName},`) +
          para(`A new listing just went live that matches what you told us you're looking for. Take a look before it's gone.`) +
          factCard([
            ["Listing", listingTitle],
            ["Area", escapeHtml(p.listingArea || "—")],
            ["Price", listingPrice],
          ]),
        ctaLabel: "View listing", ctaUrl: listingUrl,
        footerNote: "You're receiving this because you set up a listing alert on Nyumba254. Alerts stay active until you tell us you've found a place.",
        quickLinks: buyerLinks,
      }),
    }];
  },

  admin_message_unread_reminder: (p, { sellerName, dashboardUrl }) => {
    const ticketRef = escapeHtml(p.ticketRef || "—");
    return [{
      to: p.sellerEmail, toName: p.sellerName || "Seller",
      subject: `You have an unread reply from support - Nyumba254`,
      html: renderShell({
        heading: "Support replied — still unread 💬",
        eyebrow: "Support",
        preheader: `Support replied to ticket ${p.ticketRef || ""} and it's still unread.`,
        bodyHtml:
          para(`Hi ${sellerName},`) +
          para(`Our support team replied to your ticket <strong style="color:#161614;">${ticketRef}</strong> a little while ago and it looks like you haven't seen it yet.`) +
          factCard([["Topic", escapeHtml(p.topic || "—")], ["Message", escapeHtml(p.messagePreview || "")]]),
        ctaLabel: "Open conversation", ctaUrl: dashboardUrl,
        footerNote: "You're receiving this because you have an open support conversation on Nyumba254.",
        quickLinks: sellerLinks,
      }),
    }];
  },

  unread_message_reminder: (p, { listingUrl }) => {
    const alertName = escapeHtml(p.alertName || "there");
    return [{
      to: p.alertEmail, toName: p.alertName || "there",
      subject: "You have a new message - Nyumba254",
      html: renderShell({
        heading: "You have a new message 💬",
        eyebrow: "Message",
        preheader: `The seller of "${p.listingTitle || "a listing"}" sent you a message.`,
        bodyHtml:
          para(`Hi ${alertName},`) +
          para(`The seller of <strong style="color:#161614;">"${escapeHtml(p.listingTitle || "a listing")}"</strong> sent you a message a little while ago and it looks like you haven't seen it yet.`) +
          factCard([["Message", escapeHtml(p.messagePreview || "")]]),
        ctaLabel: "View conversation", ctaUrl: listingUrl,
        footerNote: "You're receiving this because you have an open conversation with a seller on Nyumba254.",
        quickLinks: buyerLinks,
      }),
    }];
  },

  profile_updated: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "there",
    subject: "Your profile was updated - Nyumba254",
    html: renderShell({
      heading: "Profile updated ✓",
      eyebrow: "Account notice",
      preheader: `Your ${p.changes || "profile details"} was just updated.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your ${escapeHtml(p.changes || "profile details")} was just updated on your Nyumba254 account.`) +
        tip(`If this wasn't you, secure your account right away and contact support — we're happy to help sort it out.`),
      ctaLabel: "Review my account", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because your profile was changed on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  password_changed: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "there",
    subject: "Your password was changed - Nyumba254",
    html: renderShell({
      heading: "Password changed 🔒",
      eyebrow: "Security",
      preheader: `This confirms your account password was just changed.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`This confirms your Nyumba254 account password was just changed. You can use your new password to sign in from now on.`) +
        tip(`If you didn't make this change, please contact support immediately at ${escapeHtml(ADMIN_EMAIL)} — don't wait, as this could mean someone else has access to your account.`),
      ctaLabel: "Go to my account", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this as a security notification from Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  notification_prefs_updated: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "there",
    subject: "Notification preferences updated - Nyumba254",
    html: renderShell({
      heading: "Preferences saved ✓",
      eyebrow: "Account notice",
      preheader: `Your notification preferences were just updated.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your notification preferences were just updated on Nyumba254. You'll now only hear from us about the things you asked to be notified about.`) +
        tip(`Changed your mind? You can update these again any time from your account settings.`),
      ctaLabel: "Manage settings", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because your account settings changed on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  account_deleted: (p, { sellerName }) => [
    {
      to: p.sellerEmail, toName: p.sellerName || "there",
      subject: "Your Nyumba254 account has been deleted",
      html: renderShell({
        heading: "Account deleted",
        eyebrow: "Account notice",
        preheader: `Your account and all associated data have been permanently deleted.`,
        bodyHtml:
          para(`Hi ${sellerName},`) +
          para(`This confirms your Nyumba254 account, listings, photos, and enquiry history have been permanently deleted, as requested.`) +
          para(`We're sorry to see you go. If you ever want to list a property again, you're always welcome back.`),
        ctaLabel: "Visit Nyumba254", ctaUrl: `${SITE_URL}/index.html`,
        footerNote: `You're receiving this as a final confirmation from Nyumba254. If you didn't request this, contact us immediately at ${escapeHtml(ADMIN_EMAIL)}.`,
      }),
    },
    {
      to: ADMIN_EMAIL, toName: "Admin",
      subject: `Seller account deleted: ${p.sellerName || p.sellerEmail || "a seller"}`,
      html: renderShell({
        heading: "A seller deleted their account",
        eyebrow: "Admin alert",
        preheader: `${p.sellerName || p.sellerEmail || "A seller"} permanently deleted their Nyumba254 account.`,
        bodyHtml:
          para(`<strong style="color:#161614;">${sellerName}</strong> (${escapeHtml(p.sellerEmail || "—")}) just permanently deleted their account, listings, photos, and enquiry history.`) +
          factCard([
            ["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`],
            ["Phone", escapeHtml(p.sellerPhone || "—")],
          ]),
        footerNote: "You're receiving this because a seller deleted their account on Nyumba254.",
        quickLinks: adminLinks,
      }),
    },
  ],

  new_seller_registered: (p) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `New seller registered: ${p.sellerName || p.sellerEmail || "someone"}`,
    html: renderShell({
      heading: "New seller joined Nyumba254 🎉",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || p.sellerEmail || "Someone"} just created a seller account.`,
      bodyHtml:
        para(`A new seller just registered on Nyumba254.`) +
        factCard([
          ["Name", escapeHtml(p.sellerName || "—")],
          ["Email", escapeHtml(p.sellerEmail || "—")],
          ["Phone", escapeHtml(p.sellerPhone || "—")],
        ]),
      ctaLabel: "View sellers", ctaUrl: `${SITE_URL}/admin.html`,
      footerNote: "You're receiving this because a new seller account was created on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  contact_form_message: (p) => {
    const name = escapeHtml(p.buyerName || "Someone");
    const emailAddr = escapeHtml(p.buyerEmail || "—");
    const phone = escapeHtml(p.buyerPhone || "—");
    const subj = escapeHtml(p.subject || "General");
    return ADMIN_EMAILS.map((addr) => ({
      to: addr, toName: "Admin",
      subject: `New contact form message: ${p.subject || "General"}`,
      ...(isValidEmail(p.buyerEmail) ? { replyTo: p.buyerEmail } : {}),
      html: renderShell({
        heading: "New message from the Contact page 📩",
        eyebrow: "Admin alert",
        preheader: `${p.buyerName || "Someone"} sent a message about "${p.subject || "General"}".`,
        bodyHtml:
          para(`<strong style="color:#161614;">${name}</strong> sent a message via the Contact page.`) +
          factCard([
            ["Subject", subj],
            ["Email", emailAddr],
            ["Phone", phone],
          ]) +
          para(escapeHtml(p.message || "").replace(/\n/g, "<br/>")) +
          tip(`Just hit Reply on this email to respond directly to ${name}.`),
        footerNote: "You're receiving this because someone submitted the Contact form on Nyumba254.",
        quickLinks: adminLinks,
      }),
    }));
  },

  new_buyer_enquiry: (p, { listingUrl, sellerName, sellerEmail }) => {
    const name = escapeHtml(p.buyerName || "A buyer");
    const emailAddr = escapeHtml(p.buyerEmail || "—");
    const phone = escapeHtml(p.buyerPhone || "—");
    const listingTitleEsc = escapeHtml(p.listingTitle || "your listing");
    const emails: EmailOut[] = ADMIN_EMAILS.map((addr) => ({
      to: addr, toName: "Admin",
      subject: `New buyer enquiry: ${p.listingTitle || "a listing"}`,
      ...(isValidEmail(p.buyerEmail) ? { replyTo: p.buyerEmail } : {}),
      html: renderShell({
        heading: "New buyer enquiry 📩",
        eyebrow: "Admin alert",
        preheader: `${p.buyerName || "A buyer"} enquired about "${p.listingTitle || "a listing"}".`,
        bodyHtml:
          para(`<strong style="color:#161614;">${name}</strong> sent an enquiry about <strong style="color:#161614;">"${listingTitleEsc}"</strong>.`) +
          factCard([["Name", name], ["Phone", phone], ["Email", emailAddr]]) +
          para(escapeHtml(p.message || "").replace(/\n/g, "<br/>")) +
          tip(`If they gave a real email, just hit Reply to respond directly. Otherwise use the phone number above.`),
        ctaLabel: "View listing", ctaUrl: listingUrl,
        footerNote: "You're receiving this because a buyer enquired about a listing on Nyumba254.",
        quickLinks: adminLinks,
      }),
    }));
    if (isValidEmail(sellerEmail)) {
      emails.push({
        to: sellerEmail, toName: sellerName,
        subject: `New buyer enquiry: ${p.listingTitle || "your listing"}`,
        ...(isValidEmail(p.buyerEmail) ? { replyTo: p.buyerEmail } : {}),
        html: renderShell({
          heading: "New buyer enquiry 📩",
          eyebrow: "Buyer enquiry",
          preheader: `${p.buyerName || "A buyer"} enquired about "${p.listingTitle || "your listing"}".`,
          bodyHtml:
            para(`Hi ${sellerName},`) +
            para(`<strong style="color:#161614;">${name}</strong> sent an enquiry about <strong style="color:#161614;">"${listingTitleEsc}"</strong>.`) +
            factCard([["Name", name], ["Phone", phone], ["Email", emailAddr]]) +
            para(escapeHtml(p.message || "").replace(/\n/g, "<br/>")) +
            tip(`Reply from your dashboard, or call/WhatsApp them directly using the details above.`),
          ctaLabel: "Open your dashboard", ctaUrl: `${SITE_URL}/dashboard.html`,
          footerNote: "You're receiving this because a buyer enquired about your listing on Nyumba254.",
          quickLinks: sellerLinks,
        }),
      });
    }
    const buyerEmail = isValidEmail(p.buyerEmail) ? p.buyerEmail.trim() : null;
    const alreadyNotified = buyerEmail && emails.some(
      (email) => email.to.trim().toLowerCase() === buyerEmail.toLowerCase(),
    );
    if (buyerEmail && !alreadyNotified) {
      emails.push({
        to: buyerEmail, toName: p.buyerName || "there",
        subject: "We received your enquiry - Nyumba254",
        html: renderShell({
          heading: "Your enquiry was sent",
          eyebrow: "Enquiry confirmation",
          preheader: `Your message about "${p.listingTitle || "a listing"}" has been sent.`,
          bodyHtml:
            para(`Hi ${escapeHtml(p.buyerName || "there")},`) +
            para(`Your enquiry about <strong style="color:#161614;">"${listingTitleEsc}"</strong> has been sent to the listing owner. They can reply through Nyumba254 or contact you using the details you provided.`) +
            factCard([["Your message", escapeHtml(p.message || "")]]),
          ctaLabel: "View listing", ctaUrl: listingUrl,
          footerNote: "You're receiving this because you provided your email when contacting a listing on Nyumba254.",
          quickLinks: buyerLinks,
        }),
      });
    }
    return emails;
  },
  viewing_request: (p, { sellerName, sellerEmail, listingUrl }) => {
    const name = escapeHtml(p.buyerName || "A buyer");
    const phone = escapeHtml(p.buyerPhone || "—");
    const when = escapeHtml(p.date || "—");
    const slot = escapeHtml(p.time || "—");
    const fee = Number(p.viewingFee);
    const feeLabel = Number.isFinite(fee) && fee > 0 ? `KES ${fee.toLocaleString("en-KE")} (paid directly to the lister; not collected by Nyumba254)` : "Free";
    const notesHtml = p.notes ? para(escapeHtml(p.notes)) : "";
    const emails: EmailOut[] = ADMIN_EMAILS.map((addr) => ({
      to: addr, toName: "Admin",
      subject: `New viewing request: ${p.listingTitle || "a listing"}`,
      html: renderShell({
        heading: "New viewing request 📅",
        eyebrow: "Admin alert",
        preheader: `${p.buyerName || "A buyer"} wants to view "${p.listingTitle || "a listing"}".`,
        bodyHtml:
          para(`<strong style="color:#161614;">${name}</strong> requested a viewing for <strong style="color:#161614;">"${escapeHtml(p.listingTitle || "a listing")}"</strong>.`) +
          factCard([["Name", name], ["Phone", phone], ["Preferred date", when], ["Time slot", slot], ["Viewing fee", escapeHtml(feeLabel)]]) +
          notesHtml,
        ctaLabel: "View listing", ctaUrl: listingUrl,
        footerNote: "You're receiving this because a buyer requested a viewing on Nyumba254.",
        quickLinks: adminLinks,
      }),
    }));
    if (isValidEmail(sellerEmail)) {
      emails.push({
        to: sellerEmail, toName: sellerName,
        subject: `New viewing request: ${p.listingTitle || "your listing"}`,
        html: renderShell({
          heading: "New viewing request 📅",
          eyebrow: "Viewing request",
          preheader: `${p.buyerName || "A buyer"} wants to view "${p.listingTitle || "your listing"}".`,
          bodyHtml:
            para(`Hi ${sellerName},`) +
            para(`<strong style="color:#161614;">${name}</strong> requested a viewing for <strong style="color:#161614;">"${escapeHtml(p.listingTitle || "your listing")}"</strong>.`) +
            factCard([["Name", name], ["Phone", phone], ["Preferred date", when], ["Time slot", slot], ["Viewing fee", escapeHtml(feeLabel)]]) +
            notesHtml +
            tip(`Call or WhatsApp them at ${phone} to confirm the exact time.`),
          ctaLabel: "Open your dashboard", ctaUrl: `${SITE_URL}/dashboard.html`,
          footerNote: "You're receiving this because a buyer requested a viewing on your listing on Nyumba254.",
          quickLinks: sellerLinks,
        }),
      });
    }
    return emails;
  },

  listings_paused: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "there",
    subject: "All your listings have been paused - Nyumba254",
    html: renderShell({
      heading: "Listings paused ⏸",
      eyebrow: "Account notice",
      preheader: `Your listings are paused and hidden from buyers until you reactivate them.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`All your active listings on Nyumba254 have been paused and are now hidden from buyers. You can reactivate them anytime from your dashboard.`) +
        tip(`Pausing doesn't delete anything — your listings, photos, and details are all saved exactly as you left them.`),
      ctaLabel: "Go to dashboard", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because you paused your listings on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  verification_submitted: (p, { sellerName }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `New verification submitted: ${p.sellerName || "a seller"}`,
    html: renderShell({
      heading: "New verification submitted 🪪",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} submitted ID + proof of ownership for review.`,
      bodyHtml:
        para(`<strong style="color:#161614;">${sellerName}</strong> submitted their verification documents and is waiting for review.`) +
        factCard([
          ["Seller", `${sellerName} (${escapeHtml(p.sellerEmail || "—")})`],
          ["Ownership", p.isOwner ? "Property owner" : "Listing on someone's behalf"],
          ["Proof type", escapeHtml(p.proofType || "—")],
        ]),
      ctaLabel: "Review in admin panel", ctaUrl: `${SITE_URL}/admin.html`,
      footerNote: "You're receiving this because a seller submitted verification documents on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  verification_approved: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "You're verified! - Nyumba254",
    html: renderShell({
      heading: "You're verified ✓",
      eyebrow: "Verification",
      preheader: `Your account is now verified — unlimited listings unlocked.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Your identity and proof of ownership have been reviewed and approved. Your account now shows the <strong style="color:#0F6E56;">Verified</strong> badge, and the 2-listing limit for new sellers no longer applies to you.`) +
        tip(`Keep your documents on file matching what you list — if we ever need to double-check a specific property (e.g. after a buyer report), we'll only ask for a bit more, never start you over.`),
      ctaLabel: "Go to dashboard", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because your Nyumba254 verification was approved.",
      quickLinks: sellerLinks,
    }),
  }],

  verification_rejected: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Your verification needs another look - Nyumba254",
    html: renderShell({
      heading: "Verification not approved yet",
      eyebrow: "Verification",
      preheader: `Your submitted documents need a small fix before approval.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`We reviewed the documents you submitted, but couldn't approve your verification yet.`) +
        factCard([["Reason", escapeHtml(p.reason || "—")]]) +
        para(`You can resubmit clearer or corrected documents any time from your dashboard.`),
      ctaLabel: "Resubmit documents", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because your Nyumba254 verification needs changes.",
      quickLinks: sellerLinks,
    }),
  }],

  extra_verification_requested: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: "Additional documents needed - Nyumba254",
    html: renderShell({
      heading: "A few more documents needed 📄",
      eyebrow: "Verification",
      preheader: `We need a bit more proof for one of your listings.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`One of your listings was flagged for extra review, so we need a bit more documentation before it can stay active.`) +
        factCard([["Reason", escapeHtml(p.reason || "—")]]) +
        tip(`This is a routine extra check, not an accusation — upload what's requested from your dashboard and our team will review it quickly.`),
      ctaLabel: "Upload documents", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because additional verification was requested on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  extra_verification_submitted: (p, { sellerName }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Extra verification docs submitted: ${p.sellerName || "a seller"}`,
    html: renderShell({
      heading: "Extra documents submitted 📄",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} uploaded the extra documents you requested.`,
      bodyHtml: para(`<strong style="color:#161614;">${sellerName}</strong> uploaded the additional documents you requested. Please review.`),
      ctaLabel: "Review in admin panel", ctaUrl: `${SITE_URL}/admin.html`,
      footerNote: "You're receiving this because a seller submitted extra verification documents on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  concierge_enabled: (p, { sellerName }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Managed chat turned on: ${p.sellerName || "a seller"}`,
    html: renderShell({
      heading: "A seller turned on managed chat 🎧",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} wants Nyumba254 to manage their enquiries.`,
      bodyHtml:
        para(`<strong style="color:#161614;">${sellerName}</strong> (${escapeHtml(p.sellerEmail || "—")}) just turned on managed chat. You now have access to reply to their buyer enquiries directly from the admin panel's Concierge tab.`) +
        tip(`You're only replying to buyer messages on their behalf — you still don't have their password or account access.`),
      ctaLabel: "Open Concierge tab", ctaUrl: `${SITE_URL}/admin.html`,
      footerNote: "You're receiving this because a seller enabled managed chat on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  rent_overdue_alert: (p) => {
    const tenantName = escapeHtml(p.tenantName || "there");
    return [{
      to: p.tenantEmail, toName: p.tenantName || "there",
      subject: `Overdue rent notice - ${p.unitLabel || "your unit"}`,
      html: renderShell({
        heading: "Overdue rent notice ⚠️",
        eyebrow: "Rent Ledger",
        preheader: `Rent for ${p.unitLabel || "your unit"} is overdue.`,
        bodyHtml:
          para(`Hi ${tenantName},`) +
          para(`Your landlord's records show rent for <strong style="color:#161614;">${escapeHtml(p.unitLabel || "your unit")}</strong> is currently overdue.`) +
          factCard([["Monthly rent", fmtKES(p.monthlyRent)], ["Overdue balance", fmtKES(p.overdueAmount)], ["Landlord", escapeHtml(p.sellerName || "—")]]) +
          para(`Please reach out to your landlord directly to arrange payment as soon as possible.`),
        footerNote: "This reminder was sent by your landlord via Nyumba254's Rent Ledger tool.",
      }),
    }];
  },

  lease_expiring_alert: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: `Lease expiring soon - ${p.unitLabel || "a unit"}`,
    html: renderShell({
      heading: "Lease expiring soon ⏰",
      eyebrow: "Rent Ledger",
      preheader: `${p.tenantName || "A tenant"}'s lease on ${p.unitLabel || "a unit"} expires soon.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`<strong style="color:#161614;">${escapeHtml(p.tenantName || "A tenant")}</strong>'s lease on <strong style="color:#161614;">${escapeHtml(p.unitLabel || "a unit")}</strong> is expiring soon.`) +
        factCard([["Lease end date", escapeHtml(p.leaseEndDate || "—")], ["Monthly rent", fmtKES(p.monthlyRent)]]) +
        tip(`Reach out now to discuss renewal terms, or start planning for the vacancy.`),
      ctaLabel: "Open Rent Ledger", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because a tenant's lease is expiring soon on Nyumba254 Elite.",
      quickLinks: sellerLinks,
    }),
  }],

  demand_weekly_digest: (p, { sellerName, dashboardUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: `Your weekly demand digest - Nyumba254`,
    html: renderShell({
      heading: "This week's buyer demand 📊",
      eyebrow: "Demand Insights",
      preheader: `Top opportunity areas this week on Nyumba254.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Here's where buyers were most active this week — worth checking if you're thinking about a new listing.`) +
        factCard((p.topAreas || []).slice(0,5).map((a: any) => [a.area, `${a.count} enquiries`])) +
        tip(`Areas with high enquiries and few active listings are your best bet for a fast let or sale.`),
      ctaLabel: "Open Demand Insights", ctaUrl: dashboardUrl,
      footerNote: "You're receiving this because you opted into the weekly demand digest on Nyumba254 Elite.",
      quickLinks: sellerLinks,
    }),
  }],

  rent_reminder: (p) => {
    const tenantName = escapeHtml(p.tenantName || "there");
    return [{
      to: p.tenantEmail, toName: p.tenantName || "there",
      subject: `Rent reminder - ${p.unitLabel || "your unit"}`,
      html: renderShell({
        heading: "Rent reminder 🏠",
        eyebrow: "Rent Ledger",
        preheader: `A friendly reminder that rent for ${p.unitLabel || "your unit"} is due.`,
        bodyHtml:
          para(`Hi ${tenantName},`) +
          para(`This is a friendly reminder from your landlord that rent for <strong style="color:#161614;">${escapeHtml(p.unitLabel || "your unit")}</strong> is due.`) +
          factCard([["Monthly rent", fmtKES(p.monthlyRent)], ["Landlord", escapeHtml(p.sellerName || "—")]]) +
          para(`Please reach out to your landlord directly to arrange payment.`),
        footerNote: "This reminder was sent by your landlord via Nyumba254's Rent Ledger tool.",
      }),
    }];
  },

  // ─── BNB Booking Ledger: sent to the GUEST (not admin/seller) when a host
  // taps ✉️ Check-in on a booking row. sellerPhone is passed through from
  // sendBnbCheckinReminder() so the guest has a direct contact number.
  bnb_checkin_instructions: (p) => {
    const guestName = escapeHtml(p.guestName || "there");
    const checkInDate = p.checkIn ? new Date(p.checkIn).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—";
    const checkOutDate = p.checkOut ? new Date(p.checkOut).toLocaleDateString("en-KE", { day: "numeric", month: "long", year: "numeric" }) : "—";
    return [{
      to: p.guestEmail, toName: p.guestName || "there",
      subject: `Check-in details for your stay at ${p.propertyLabel || "your booking"} - Nyumba254`,
      html: renderShell({
        heading: "Your check-in details 🔑",
        eyebrow: "Booking",
        preheader: `Everything you need for check-in at ${p.propertyLabel || "your booking"}.`,
        bodyHtml:
          para(`Hi ${guestName},`) +
          para(`Here are your check-in details for <strong style="color:#161614;">${escapeHtml(p.propertyLabel || "your booking")}</strong>.`) +
          factCard([
            ["Check-in", checkInDate],
            ["Check-out", checkOutDate],
            ["Host", escapeHtml(p.sellerName || "—")],
            ["Host phone", escapeHtml(p.sellerPhone || "—")],
          ]) +
          para(`If you have any questions before you arrive, feel free to contact your host directly using the details above.`),
        footerNote: "You're receiving this because your host sent check-in details via Nyumba254's BNB Booking Ledger.",
      }),
    }];
  },

  // ─── BNB Booking Ledger: sent to the GUEST when a host taps ⭐ Review
  // on a completed stay, asking for feedback.
  bnb_review_request: (p) => {
    const guestName = escapeHtml(p.guestName || "there");
    return [{
      to: p.guestEmail, toName: p.guestName || "there",
      subject: `How was your stay at ${p.propertyLabel || "your recent booking"}? - Nyumba254`,
      html: renderShell({
        heading: "How was your stay? ⭐",
        eyebrow: "Booking",
        preheader: `${p.sellerName || "Your host"} would love to hear about your stay at ${p.propertyLabel || "their property"}.`,
        bodyHtml:
          para(`Hi ${guestName},`) +
          para(`Thanks for staying at <strong style="color:#161614;">${escapeHtml(p.propertyLabel || "your recent booking")}</strong>! Your host, <strong style="color:#161614;">${escapeHtml(p.sellerName || "your host")}</strong>, would really appreciate a quick review of your experience.`) +
          para(`Reply to this email with your feedback, or get in touch with your host directly to share your thoughts.`),
        footerNote: "You're receiving this because your host requested a review via Nyumba254's BNB Booking Ledger.",
      }),
    }];
  },

  listing_shared_social: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: `Your listing was shared on ${p.platform === "facebook" ? "Facebook" : "Instagram"}! - Nyumba254`,
    html: renderShell({
      heading: `Shared on ${p.platform === "facebook" ? "Facebook" : "Instagram"} 📣`,
      eyebrow: "Marketing boost",
      preheader: `"${p.listingTitle || "Your listing"}" is now being promoted on our ${p.platform === "facebook" ? "Facebook" : "Instagram"} page.`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`Good news — your listing <strong style="color:#161614;">"${listingTitle}"</strong> has just been shared on Nyumba254's official ${p.platform === "facebook" ? "Facebook" : "Instagram"} page, putting it in front of even more buyers.`) +
        tip(`No action needed from you — this is included at no extra cost.`),
      ctaLabel: "View your listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because your listing was shared on Nyumba254's social media.",
      quickLinks: sellerLinks,
    }),
  }],

  listing_video_added: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Video added to listing: ${p.listingTitle || ""}`,
    html: renderShell({
      heading: "Seller added a video walkthrough 🎥",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} added a video to "${p.listingTitle || "a listing"}".`,
      bodyHtml:
        para(`<strong style="color:#161614;">${sellerName}</strong> added a video walkthrough to <strong style="color:#161614;">"${listingTitle}"</strong>. Worth a quick check that it embeds correctly and shows the right property.`) +
        factCard([["Video URL", escapeHtml(p.videoUrl || "—")]]),
      ctaLabel: "View listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because a seller added a video walkthrough on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  seller_video_uploaded: (p, { listingTitle, listingUrl }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `New video uploaded for review: ${p.listingTitle || "a listing"}`,
    html: renderShell({
      heading: "New seller video ready for review 🎥",
      eyebrow: "Admin alert",
      preheader: `A seller uploaded a video walkthrough directly — it's waiting in the review queue.`,
      bodyHtml:
        para(`A seller just recorded or uploaded a video walkthrough directly (not a pasted link) for <strong style="color:#161614;">"${listingTitle}"</strong>. It's sitting in the pending review queue on that listing's video panel.`) +
        factCard([["YouTube link", escapeHtml(p.youtubeUrl || "—")]]),
      ctaLabel: "Review listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because a seller uploaded a video for review on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  demand_match: (p, { sellerName, listingTitle, listingUrl }) => [{
    to: p.sellerEmail, toName: p.sellerName || "Seller",
    subject: `${p.matchCount || "Some"} buyer(s) are searching for what you're listing - Nyumba254`,
    html: renderShell({
      heading: "Buyers are searching for this 🎯",
      eyebrow: "Demand match",
      preheader: `${p.matchCount || "Some"} buyer(s) have a saved search matching "${p.listingTitle || "your listing"}".`,
      bodyHtml:
        para(`Hi ${sellerName},`) +
        para(`<strong style="color:#161614;">${p.matchCount || "Some"} buyer(s)</strong> have a saved search that matches your listing <strong style="color:#161614;">"${listingTitle}"</strong>${p.area ? ` in ${escapeHtml(p.area)}` : ""}.`) +
        tip(`Make sure your photos and price are up to date — matched buyers are actively looking right now.`),
      ctaLabel: "View your listing", ctaUrl: listingUrl,
      footerNote: "You're receiving this because a buyer search matched your listing on Nyumba254.",
      quickLinks: sellerLinks,
    }),
  }],

  shortlist_email_sent: (p) => [{
    to: p.buyerEmail, toName: p.buyerName || "there",
    subject: "Your Nyumba254 shortlist - keep shopping anytime",
    html: renderShell({
      heading: "Your shortlist 📋",
      eyebrow: "Saved listings",
      preheader: `${p.listingCount || 0} listings you saved on Nyumba254.`,
      bodyHtml:
        para(`Hi ${escapeHtml(p.buyerName || "there")},`) +
        para(`Here's your shortlist with ${p.listingCount || 0} listing${p.listingCount !== 1 ? "s" : ""}. Open it anytime on any phone or computer.`) +
        (p.listings && p.listings.length ? 
          `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:14px 0;"><tbody>` +
          p.listings.slice(0, 10).map((l: any, i: number) => 
            `<tr><td style="padding:${i === 0 ? "0" : "9px"} 0 9px;border-bottom:1px solid #ece9e1;"><strong>${escapeHtml(l.title || "—")}</strong><br/><span style="font-size:12px;color:#8b8a82;">${escapeHtml(l.area || "—")} · ${fmtKES(l.price || 0)}</span></td></tr>`
          ).join('') +
          (p.listingCount > 10 ? `<tr><td style="padding:9px 0;font-size:13px;color:#8b8a82;">...and ${p.listingCount - 10} more</td></tr>` : '') +
          `</tbody></table>`
          : ""
        ) +
        tip(`Save this link or screenshot it — your shortlist stays active for 90 days. No account needed.`),
      ctaLabel: "Open shortlist", ctaUrl: p.shortlistUrl,
      footerNote: "You're receiving this because you emailed yourself your Nyumba254 shortlist.",
      quickLinks: buyerLinks,
    }),
  }],

  shortlist_link_shared: (p) => [{
    to: p.recipientEmail, toName: p.recipientName || "there",
    subject: `${p.senderName || "Someone"} shared a Nyumba254 shortlist with you`,
    html: renderShell({
      heading: `${p.senderName || "Someone"} shared a shortlist 📋`,
      eyebrow: "Shared properties",
      preheader: `Check out ${p.listingCount || 0} listings they saved.`,
      bodyHtml:
        para(`Hi ${escapeHtml(p.recipientName || "there")},`) +
        para(`<strong style="color:#161614;">${escapeHtml(p.senderName || "Someone")}</strong> shared a shortlist of ${p.listingCount || 0} property listing${p.listingCount !== 1 ? "s" : ""} with you.`) +
        (p.listings && p.listings.length ? 
          `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:14px 0;"><tbody>` +
          p.listings.slice(0, 8).map((l: any, i: number) => 
            `<tr><td style="padding:${i === 0 ? "0" : "9px"} 0 9px;border-bottom:1px solid #ece9e1;"><strong>${escapeHtml(l.title || "—")}</strong><br/><span style="font-size:12px;color:#8b8a82;">${escapeHtml(l.area || "—")} · ${fmtKES(l.price || 0)}</span></td></tr>`
          ).join('') +
          (p.listingCount > 8 ? `<tr><td style="padding:9px 0;font-size:13px;color:#8b8a82;">...and ${p.listingCount - 8} more</td></tr>` : '') +
          `</tbody></table>`
          : ""
        ) +
        tip(`You can save any of these to your own shortlist, or just browse them without an account.`),
      ctaLabel: "View shortlist", ctaUrl: p.shortlistUrl,
      footerNote: "You're receiving this because someone shared a Nyumba254 shortlist with you. The link expires in 90 days.",
      quickLinks: buyerLinks,
    }),
  }],

  team_invite: (p) => [{
    to: p.sellerEmail, toName: p.sellerName || "there",
    subject: `${p.ownerName || "A seller"} invited you to help manage their Nyumba254 listings`,
    html: renderShell({
      heading: "You've been invited 🤝",
      eyebrow: "Team invite",
      preheader: `${p.ownerName || "A seller"} invited you to help manage their Nyumba254 account.`,
      bodyHtml:
        para(`Hi there,`) +
        para(`<strong style="color:#161614;">${escapeHtml(p.ownerName || "A seller")}</strong> has invited you to help manage their listings on Nyumba254 — you'll be able to see and reply to their listings, messages, and payments.`) +
        tip(`Click below to accept. If you already have a Nyumba254 account, you'll just sign in — otherwise you can create one in a few seconds, right on that page.`),
      ctaLabel: "Accept invite",
      ctaUrl: p.inviteToken
        ? `${SITE_URL}/accept-invite.html?token=${encodeURIComponent(p.inviteToken)}`
        : `${SITE_URL}/login.html?tab=register`,
      footerNote: "You're receiving this because someone invited you to their Nyumba254 team.",
      quickLinks: [["Home", `${SITE_URL}/index.html`]],
    }),
  }],

  buyer_access_link: (p) => [{
    to: p.buyerEmail, toName: p.buyerName || "there",
    subject: "Your Nyumba254 chat access link",
    html: renderShell({
      heading: "Your access link 🔑",
      eyebrow: "My Chats",
      preheader: "Use this link to open your conversations on any device.",
      bodyHtml:
        para(`Hi ${escapeHtml(p.buyerName || "there")},`) +
        para(`Here's your personal link to open all your Nyumba254 conversations from any phone or computer — nothing is shared publicly.`) +
        tip(`Keep this link private. Anyone with it can see your saved conversations.`),
      ctaLabel: "Open my chats", ctaUrl: p.accessLink,
      footerNote: "You're receiving this because you asked for your Nyumba254 chat access link.",
      quickLinks: buyerLinks,
    }),
  }],

  buyer_new_message_alert: (p) => [{
    to: p.buyerEmail, toName: p.buyerName || "there",
    subject: `New reply from ${p.sellerName || "the seller"} - Nyumba254`,
    html: renderShell({
      heading: "You have a new reply 💬",
      eyebrow: "New message",
      preheader: `${p.sellerName || "The seller"} replied about "${p.listingTitle || "your enquiry"}".`,
      bodyHtml:
        para(`Hi ${escapeHtml(p.buyerName || "there")},`) +
        para(`<strong style="color:#161614;">${escapeHtml(p.sellerName || "The seller")}</strong> replied about <strong style="color:#161614;">"${escapeHtml(p.listingTitle || "your enquiry")}"</strong>:`) +
        factCard([["Message", escapeHtml(p.messagePreview || "")]]),
      ctaLabel: "View conversation", ctaUrl: p.accessLink,
      footerNote: "You're receiving this because you asked to be notified about replies on Nyumba254.",
      quickLinks: buyerLinks,
    }),
  }],

  concierge_disabled: (p, { sellerName }) => [{
    to: ADMIN_EMAIL, toName: "Admin",
    subject: `Managed chat turned off: ${p.sellerName || "a seller"}`,
    html: renderShell({
      heading: "A seller turned off managed chat",
      eyebrow: "Admin alert",
      preheader: `${p.sellerName || "A seller"} will now handle their own enquiries again.`,
      bodyHtml: para(`<strong style="color:#161614;">${sellerName}</strong> (${escapeHtml(p.sellerEmail || "—")}) turned off managed chat. Please stop replying on their behalf going forward.`),
      footerNote: "You're receiving this because a seller disabled managed chat on Nyumba254.",
      quickLinks: adminLinks,
    }),
  }],

  platform_update: (p, { sellerName }) => {
    const CATEGORY_META = {
      policy_update:  { eyebrow: "Policy update",      icon: "📜" },
      security_alert: { eyebrow: "Security alert",     icon: "🔒" },
      feature:        { eyebrow: "New feature",        icon: "✨" },
      maintenance:    { eyebrow: "Maintenance notice", icon: "🛠️" },
      promotion:      { eyebrow: "Special offer",      icon: "🎁" },
      billing:        { eyebrow: "Billing notice",     icon: "💳" },
      milestone:      { eyebrow: "Nyumba254 news",     icon: "🎉" },
      general:        { eyebrow: "Platform update",    icon: "📣" },
    };
    const meta = CATEGORY_META[p.category] || CATEGORY_META.general;
    const isPolicy = p.category === "policy_update";
    return [{
      to: p.sellerEmail, toName: p.sellerName || "there",
      subject: isPolicy
        ? `Updated: ${p.title || "Our Terms & Privacy Policy"} - Nyumba254`
        : `${p.title || "Platform update"} - Nyumba254`,
      html: renderShell({
        heading: `${meta.icon} ${escapeHtml(p.title || "Platform update")}`,
        eyebrow: meta.eyebrow,
        preheader: String(p.message || "").slice(0, 140),
        bodyHtml:
          para(`Hi ${sellerName},`) +
          para(escapeHtml(p.message || "").replace(/\n/g, "<br/>")) +
          (isPolicy ? tip(`Continuing to use Nyumba254 after this date means you accept the updated terms.`) : ""),
        ctaLabel: p.link ? "Learn more" : "Open dashboard",
        ctaUrl: p.link ? (p.link.startsWith("http") ? p.link : `${SITE_URL}${p.link}`) : `${SITE_URL}/dashboard.html`,
        footerNote: "You're receiving this because you have a seller account on Nyumba254.",
        quickLinks: sellerLinks,
      }),
    }];
  },
};

// Shared, derived values every handler can use — computed once per payload
// so handlers stay short and consistent. Now async because listingUrl may
// require a Supabase lookup (see resolveListingUrl above).
async function context(p: Payload) {
  const { sellerEmail, sellerName } = await resolveSellerContact(p);
  return {
    sellerName: escapeHtml(sellerName || p.sellerName || "there"),
    sellerEmail,
    listingTitle: escapeHtml(p.listingTitle || "the listing"),
    listingUrl: await resolveListingUrl(p),
    dashboardUrl: `${SITE_URL}/dashboard.html`,
  };
}

async function buildEmails(p: Payload): Promise<EmailOut[]> {
  const key = String(p?.type ?? "").trim().toLowerCase();
  const handler = HANDLERS[key];

  if (!handler) {
    // Robust fallback: still a real, readable email instead of raw JSON,
    // and still gets nav links — even for a type we've never seen before.
    return [{
      to: p.audience === "admin" ? ADMIN_EMAIL : p.sellerEmail,
      toName: p.audience === "admin" ? "Admin" : (p.sellerName || "there"),
      subject: `Nyumba254 notification: ${p.type || "update"}`,
      html: renderShell({
        heading: "Notification",
        eyebrow: "Nyumba254",
        preheader: `You have a new notification from Nyumba254.`,
        bodyHtml:
          para(`You have a new notification from Nyumba254${p.type ? ` regarding <strong style="color:#161614;">${escapeHtml(p.type)}</strong>` : ""}.`) +
          factCard(
            Object.entries(p)
              .filter(([k]) => k !== "type")
              .map(([k, v]) => [k, escapeHtml(typeof v === "object" ? JSON.stringify(v) : String(v))]) as Array<[string, string]>
          ),
        footerNote: "This is an automated notification from Nyumba254.",
        quickLinks: p.audience === "admin" ? adminLinks : sellerLinks,
      }),
    }];
  }

  try {
    const ctx = await context(p);
    return handler(p, ctx);
  } catch (err) {
    // A malformed payload (or a failed listing lookup) for a known type
    // shouldn't crash the whole request — fall back to a minimal, safe
    // notice instead.
    console.error(`Handler for type "${key}" threw:`, err);
    return [{
      to: p.audience === "admin" ? ADMIN_EMAIL : p.sellerEmail,
      toName: p.audience === "admin" ? "Admin" : (p.sellerName || "there"),
      subject: `Nyumba254 notification: ${p.type || "update"}`,
      html: renderShell({
        heading: "Notification",
        eyebrow: "Nyumba254",
        bodyHtml: para(`You have a new notification from Nyumba254, but we couldn't render the full details. Please check your dashboard.`),
        ctaLabel: "Open dashboard", ctaUrl: `${SITE_URL}/dashboard.html`,
        footerNote: "This is an automated notification from Nyumba254.",
        quickLinks: p.audience === "admin" ? adminLinks : sellerLinks,
      }),
    }];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed, use POST" }, 405);
  }
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    console.error("Missing GMAIL_USER / GMAIL_APP_PASSWORD env vars");
    return jsonResponse({ error: "Email service is not configured" }, 500);
  }

  let body: Payload;
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Request body must be valid JSON" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return jsonResponse({ error: "Request body must be a JSON object" }, 400);
  }

  try {
    const isDbWebhook = body?.table === "listing_alert_matches" && body?.record;
    const payload = isDbWebhook ? { ...body.record, type: "listing_alert_match" } : body;

    const candidates = await buildEmails(payload);
    const emails = candidates.filter((e) => isValidEmail(e.to));
    const skipped = candidates.length - emails.length;

    if (!emails.length) {
      return jsonResponse({ error: "No valid recipient email resolved", type: payload?.type ?? null }, 400);
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: GMAIL_USER, password: GMAIL_APP_PASSWORD },
      },
    });

    const results = await Promise.allSettled(
      emails.map((email) => {
        const cleanHtml = minifyHtml(email.html);
        return client.send({
          from: `Nyumba254 <${GMAIL_USER}>`,
          to: email.to,
          // Both fixes applied here, at the single point every email passes
          // through, so no handler above has to remember to do this itself:
          //  1. subject is RFC 2047-encoded if it contains any non-ASCII
          //     character (the actual cause of the "raw MIME source shown
          //     as the email body" bug).
          //  2. a real plain-text alternative replaces the old `"auto"`
          //     content type, giving denomailer a clean, simple
          //     multipart/alternative structure to build every time.
          subject: asciiSafeSubject(email.subject),
          content: htmlToPlainText(cleanHtml),
          html: cleanHtml,
          ...(email.replyTo ? { replyTo: email.replyTo } : {}),
        });
      })
    );

    try {
      await client.close();
    } catch (closeErr) {
      console.error("SMTP client close error:", closeErr);
    }

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status === "rejected")
      .map(({ r, i }) => ({
        to: emails[i].to,
        error: (r as PromiseRejectedResult).reason?.message ?? String((r as PromiseRejectedResult).reason),
      }));

    if (failed.length) console.error("Some notification emails failed to send:", failed);

    return jsonResponse(
      {
        success: sent > 0,
        sent,
        failed: failed.length,
        skippedInvalidRecipients: skipped,
        ...(failed.length ? { failedRecipients: failed } : {}),
      },
      sent > 0 ? 200 : 500
    );
  } catch (err) {
    console.error(err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});