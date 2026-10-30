/* ============================================================
   Nyumba254 — listings.html card polish  (nk-listings-polish.js)
   Replaces patch-more-link.js / patch.js. Load it as the LAST script on
   listings.html, in the same place:  <script src="/nk-listings-polish.js"></script>
   Needs no edits to listings.html or nk-shared.js. Safe to remove.

   What it does
   - Desktop: same look as before (price on the photo, category beside the area,
     "Listed 2d ago", sticky category tabs, popular-search chips, faster hydration).
   - Mobile: rebuilt to match the homepage cards, with NO details dropped:
       * real 2-column grid (the old patch accidentally forced ONE wide column on phones)
       * price as light text on the photo, photo-count pill bottom-right
       * one compact line under the title: [category chip] beds · baths · size   2d ago
       * short role line ("Owner · checked") + viewing-fee chip with tag icon
       * address, boarding info, room types, amenities, Compare, WhatsApp / enquiry
         and message buttons all stay, just sized for a small card
   - Images: responsive srcset + Supabase transforms with a reliable fallback,
     fade-in on load, a photo can never stay invisible.
   - Cards are enhanced synchronously (no flash, no scroll drift on "Back to results").
   - Recently Viewed moves below the results; only one "Get alerts" card in the feed.
   - Mobile: top nav hides on scroll-down.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nkListingsPolish) return;
  if (window.__nkPatchMoreLink || window.__nkPatchV1) {
    try { console.warn('[nk-lp] An older patch (patch.js / patch-more-link.js) is also loaded. Remove it and keep only nk-listings-polish.js.'); } catch (x) {}
    return;
  }
  window.__nkListingsPolish = true;
  window.__nkPatchV1 = true;   // keeps a late-loading old patch out of the way

  var $ = function (id) { return document.getElementById(id); };
  var warn = function (e) { try { console.warn('[nk-lp]', e); } catch (x) {} };
  var step = function (fn) { try { fn(); } catch (e) { warn(e); } };

  var agoCache = {};   // listing id -> created_at (filled from the page's own rows; DB only as fallback)

  var CAM = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2'%3E%3Cpath d='M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z'/%3E%3Ccircle cx='12' cy='13' r='4'/%3E%3C/svg%3E")`;

  /* ───────────────────────── 1. CSS ───────────────────────── */
  var CSS = `
/* ============ shared (all screen sizes) ============ */
html.nk-lp .page-header{background:linear-gradient(180deg,#fff 0%,#f3faf7 100%)}
html.nk-lp .page-header h1{letter-spacing:-.01em}
html.nk-lp .header-search input{background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05)}
html.nk-lp .cat-tab.active{background:var(--green);border-color:var(--green);box-shadow:0 3px 10px rgba(15,110,86,.25)}

html.nk-lp .listings-grid{align-items:stretch}
html.nk-lp .listings-grid .card{border:1px solid #ebe9e3;overflow:hidden}
html.nk-lp .listings-grid .card:has(.badge-featured){border-color:#EBC57A;box-shadow:0 0 0 1px rgba(235,197,122,.55),0 8px 22px rgba(232,151,58,.14)}

/* photo */
html.nk-lp .card-img:not(.nk-ready){background:linear-gradient(90deg,#f0efe9 25%,#e8e7e1 50%,#f0efe9 75%);background-size:200% 100%;animation:shimmer 1.4s infinite}
html.nk-lp .card-img>img{opacity:0;transition:opacity .35s ease,transform .5s ease}
html.nk-lp .card-img>img.is-loaded{opacity:1}
@media (hover:hover){html.nk-lp .card:hover .card-img>img.is-loaded{transform:scale(1.035)}}
html.nk-lp .card-img .badge-cat{display:none}

/* price on the photo (the original price line in the body is hidden) */
html.nk-lp .card-body .card-price{display:none}
html.nk-lp .lp-price{position:absolute;z-index:3;pointer-events:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#fff;font-weight:800;line-height:1.2;letter-spacing:-.01em}
html.nk-lp .lp-price span{font-weight:500;opacity:.9;margin-left:1px}

/* photo count */
html.nk-lp .card-photo-counter{display:flex;align-items:center;gap:4px;z-index:3;background:rgba(10,22,17,.6)}
html.nk-lp .card-photo-counter::before{content:"";width:12px;height:12px;background:currentColor;flex:none;
  -webkit-mask:${CAM} center/contain no-repeat;mask:${CAM} center/contain no-repeat}

/* text pieces */
html.nk-lp .lp-cat{font-weight:500;color:var(--text-3)}
html.nk-lp .lp-cat::before{content:"/";margin-right:5px;color:#c9c7bf}
html.nk-lp .lp-ago{margin-left:auto;font-weight:500;color:var(--text-3)}
html.nk-lp .lp-ago:empty,html.nk-lp .lp-kl-ago:empty{display:none}
html.nk-lp .lp-keyline{display:none}
html.nk-lp .lp-chip{flex:none;font-size:9.5px;font-weight:700;padding:1px 7px;border-radius:20px;white-space:nowrap;line-height:1.55;background:var(--surface);color:var(--text-2);border:1px solid var(--border)}
html.nk-lp .lp-chip.apartment{background:var(--green);color:#fff;border-color:var(--green)}
html.nk-lp .lp-chip.house{background:var(--green-dark);color:#fff;border-color:var(--green-dark)}
html.nk-lp .lp-chip.boarding{background:var(--green-light);color:var(--green-dark);border-color:var(--green-mid)}
html.nk-lp .lp-chip.airbnb{background:#fff;color:var(--green-dark);border-color:var(--green)}
html.nk-lp .lp-chip.commercial{background:var(--text);color:#fff;border-color:var(--text)}
html.nk-lp .card-viewing-fee{display:inline-flex;align-items:center;gap:4px}
html.nk-lp .card-viewing-fee svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2.2;flex:none}
html.nk-lp .card-inquire-btn,html.nk-lp .card-wa-btn{font-weight:700}

html.nk-lp #recent-mount{margin-top:28px}

html.nk-lp nav#main-nav .logo,html.nk-lp nav#main-nav .logo-icon,html.nk-lp .mobile-menu-btn{flex:none}
html.nk-lp nav#main-nav .nav-compact-search{flex:1 1 0;min-width:0}
html.nk-lp .nav-links .btn,html.nk-lp .nav-links .nav-link{white-space:nowrap;flex:none}
@media (min-width:769px) and (max-width:1200px){
  html.nk-lp nav#main-nav.nk-scrolled .nav-links a[href="/about"],html.nk-lp nav#main-nav.nk-scrolled .nav-links a[href="/faq"]{display:none}
}

html.nk-lp .card-area{flex-wrap:nowrap;min-width:0}
html.nk-lp .card-area::before{flex:none}
html.nk-lp .lp-area-name,html.nk-lp .lp-cat{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.nk-lp .lp-ago{flex:none;white-space:nowrap}
html.nk-lp .lp-badge{flex:none}
html.nk-lp .lp-trust-br{flex:0 0 100%;height:0;margin-top:-6px}
html.nk-lp .card-role{flex:0 1 auto;min-width:0;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
html.nk-lp .card-role.is-checked{color:var(--green-dark)}
html.nk-lp .trust-bar{background:#fff;border-color:var(--border);color:var(--green-dark)}

/* popular searches */
.lp-discover{display:flex;align-items:center;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 0 14px;padding:2px 0}
.lp-discover::-webkit-scrollbar{display:none}
.lp-discover-label{flex:none;font-size:12.5px;font-weight:600;color:var(--text-3);margin-right:2px}
.lp-dchip{flex:none;min-height:36px;padding:0 14px;border-radius:20px;background:#fff;border:1.5px solid var(--border);color:var(--text-2);font-size:13px;font-weight:600;white-space:nowrap;transition:border-color .15s,color .15s,background .15s}
.lp-dchip:hover{border-color:var(--green);color:var(--green-dark);background:var(--green-light)}

/* ============ DESKTOP / TABLET (769px and up) ============ */
@media (min-width:769px){
  html.nk-lp .header-search{max-width:820px}
  html.nk-lp .header-search input{padding:13px 16px;border-radius:14px}
  html.nk-lp .hs-btn{border-radius:14px;box-shadow:0 4px 12px rgba(15,110,86,.25)}
  html.nk-lp .cat-tabs{position:sticky;top:var(--nav-h);z-index:45;background:var(--surface);margin:-6px -2px 12px;padding:8px 2px}

  html.nk-lp .listings-grid{gap:20px;grid-template-columns:repeat(auto-fill,minmax(min(285px,100%),1fr))}
  html.nk-lp .listings-grid .card{border-radius:16px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 18px rgba(15,110,86,.06)}
  html.nk-lp .listings-grid .card.is-hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(15,110,86,.15)}
  @media (hover:hover){html.nk-lp .listings-grid .card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(15,110,86,.15)}}
  html.nk-lp .listings-grid .card-link:focus-visible::after{border-radius:16px}
  html.nk-lp .skeleton{border-radius:16px}
  html.nk-lp .card-img,html.nk-lp .skeleton-img{aspect-ratio:3/2}
  html.nk-lp .card-img::after{height:46%;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.28))}

  html.nk-lp .lp-price{left:10px;bottom:10px;max-width:calc(100% - 20px);background:rgba(10,22,17,.76);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);font-size:16.5px;padding:6px 12px;border-radius:12px}
  html.nk-lp .lp-price span{font-size:11.5px}
  html.nk-lp .card-photo-counter{right:10px;bottom:10px;padding:4px 9px;font-size:11px}
  html.nk-lp .card:has(.card-photo-counter) .lp-price{max-width:calc(100% - 92px)}

  html.nk-lp .card-body{padding:13px 15px 15px}
  html.nk-lp .card-area{text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:700;gap:5px;margin-bottom:5px}
  html.nk-lp .card-area::before{font-size:12px}
  html.nk-lp .lp-cat{font-size:12.5px}
  html.nk-lp .lp-ago{font-size:11.5px}
  html.nk-lp .card-title{font-size:15.5px;font-weight:700;line-height:1.3;min-height:2.6em;margin-bottom:3px}
  html.nk-lp .card-sub{margin-bottom:8px}
  html.nk-lp .lp-role-short{display:none}

  html.nk-lp .card-trust{padding-top:9px;margin-top:2px;border-top:1px solid #f0eee8;gap:6px 8px}
  html.nk-lp .card-role{font-size:12.5px;font-weight:600;color:var(--text-2)}
  html.nk-lp .card-viewing-fee{font-size:11.5px;padding:2px 9px}
  html.nk-lp .card-specs-chips{margin-top:2px}
  html.nk-lp .card-inquire-btn,html.nk-lp .card-wa-btn,html.nk-lp .card-msg-btn,html.nk-lp .nk-compare-check{border-radius:12px}
}

/* ============ PHONES (768px and down): same look as the homepage cards ============ */
@media (max-width:768px){
  html.nk-lp .main{padding:10px 12px 20px}
  html.nk-lp .hs-pill{border-radius:22px}

  /* real 2-column grid (equal specificity or later wins over the page's own rule) */
  html.nk-lp .listings-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:stretch}
  html.nk-lp .listings-grid .card{border-radius:14px;box-shadow:0 1px 2px rgba(0,0,0,.04),0 4px 12px rgba(15,110,86,.06)}
  html.nk-lp .listings-grid .card:active{transform:scale(.985)}
  html.nk-lp .listings-grid .card-link:focus-visible::after{border-radius:14px}
  html.nk-lp .skeleton{border-radius:14px}
  html.nk-lp .card-img,html.nk-lp .skeleton-img{aspect-ratio:4/3}
  html.nk-lp .card-img::after{height:55%;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.4))}

  /* photo overlays */
  html.nk-lp .lp-price{left:7px;bottom:6px;max-width:calc(100% - 14px);font-size:13.5px;text-shadow:0 1px 6px rgba(0,0,0,.55)}
  html.nk-lp .lp-price span{font-size:10px}
  html.nk-lp .lp-price.lp-m1{font-size:12px}
  html.nk-lp .lp-price.lp-m2{font-size:11px}
  html.nk-lp .card-photo-counter{right:7px;bottom:6px;padding:2px 7px;gap:4px;font-size:10px;line-height:1.3;border-radius:12px;background:rgba(0,0,0,.55)}
  html.nk-lp .card-photo-counter::before{width:10px;height:10px}
  html.nk-lp .card:has(.card-photo-counter) .lp-price{max-width:calc(100% - 62px)}
  html.nk-lp .card-badges{top:7px;left:7px;gap:4px}
  html.nk-lp .card-img .nk-heart-overlay{top:6px;right:6px}

  /* text block */
  html.nk-lp .card-body{padding:8px 10px 10px}
  html.nk-lp .card-area{font-size:10px;letter-spacing:.04em;margin-bottom:2px;gap:4px;flex-wrap:nowrap;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  html.nk-lp .card-area::before{display:none}
  html.nk-lp .card-verified-badge,html.nk-lp .lp-cat{display:none}
  html.nk-lp .lp-ago{margin-left:auto;font-size:10px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--text-3)}
  html.nk-lp .lp-ago-l{display:none}
  html.nk-lp .lp-trust-br{display:none}
  html.nk-lp .card-title{font-size:13px;line-height:1.3;min-height:0;margin-bottom:3px}
  html.nk-lp .card-sub{display:none}

  /* compact key line: [category chip] beds · baths · size        2d ago */
  html.nk-lp .lp-keyline{display:flex;align-items:center;gap:6px;min-width:0;margin-bottom:4px;font-size:10.5px;line-height:1.35;font-weight:500;color:var(--text-2)}
  html.nk-lp .lp-kl-specs{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;overflow:hidden;max-height:1.35em;white-space:nowrap}
  html.nk-lp .lp-kl-s{flex:none;white-space:nowrap}
  html.nk-lp .lp-kl-s+.lp-kl-s::before{content:"·";margin:0 4px}
  html.nk-lp .lp-kl-ago{display:none}
  html.nk-lp .card-specs-chips{display:none}   /* same info is in the key line */

  /* boarding extras stay, just smaller */
  html.nk-lp .card-meta{display:flex;flex-wrap:nowrap;gap:8px;font-size:10.5px;margin-bottom:5px;overflow:hidden}
  html.nk-lp .card-meta-item{gap:3px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  html.nk-lp .card-meta-item svg{width:11px;height:11px}
  html.nk-lp .card-roomtypes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px;margin-bottom:6px}
  html.nk-lp .card-roomtype-chip{padding:3px 6px;border-radius:7px}
  html.nk-lp .rt-label{font-size:10px}
  html.nk-lp .rt-price{font-size:10.5px}

  /* who is listing + viewing fee */
  html.nk-lp .card-trust{display:flex;flex-wrap:wrap;align-items:center;gap:3px 6px;padding-top:0;margin:0 0 6px;border-top:0}
  html.nk-lp .lp-role-full{display:none}
  html.nk-lp .card-role{flex:0 0 100%;min-width:0;font-size:10.5px;font-weight:500;line-height:1.3;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin:0}
  html.nk-lp .card-viewing-fee{font-size:10.5px;padding:1px 8px;margin:0}
  html.nk-lp .card-viewing-fee svg{width:10px;height:10px}

  /* amenities: one line */
  html.nk-lp .card-amenities{display:flex;flex-wrap:nowrap;overflow:hidden;gap:4px;margin-bottom:7px;padding-top:0;border-top:0}
  html.nk-lp .card-amenity-chip{font-size:10px;padding:1px 7px}

  /* actions: buttons on top, compare underneath */
  html.nk-lp .card-foot{flex-direction:column;align-items:stretch;gap:4px;padding-top:2px}
  html.nk-lp .card-cta{width:100%;gap:6px;order:1}
  html.nk-lp .card-inquire-btn,html.nk-lp .card-wa-btn{min-height:44px;font-size:12px;padding:0 6px;border-radius:10px}
  html.nk-lp .card-inquire-btn svg,html.nk-lp .card-wa-btn svg{width:14px;height:14px}
  html.nk-lp .card-msg-btn{display:flex;width:44px;min-height:44px;border-radius:10px}
  html.nk-lp .nk-compare-check{position:absolute;top:46px;right:6px;z-index:4;display:flex;align-items:center;justify-content:center;width:30px;height:30px;min-height:0;padding:0;margin:0;border:0;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,0,0,.25);font-size:0;gap:0;color:var(--text-2)}
  html.nk-lp .nk-compare-check::before{content:"";width:16px;height:16px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 2v20'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 2v20'/%3E%3C/svg%3E") center/contain no-repeat}
  html.nk-lp .nk-compare-check input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
  html.nk-lp .nk-compare-check span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
  html.nk-lp .nk-compare-check:has(input:checked){background:var(--green);color:#fff}
  html.nk-lp .nk-compare-check:has(input:focus-visible){outline:2px solid var(--green);outline-offset:2px}

  html.nk-lp .nk-inline-notify{padding:10px 12px;font-size:12.5px}

  /* nav hides on scroll-down */
  nav#main-nav{transition:transform .28s ease}
  nav#main-nav.nk-nav-hidden{transform:translateY(-100%)}
  .nk-quickbar{transition:top .28s ease}
  .lp-discover{display:none}
  .nk-chat-fab{scale:.82;transform-origin:100% 100%}
}
`;

  function injectCss() {
    if ($('nk-lp-style')) return;
    var s = document.createElement('style');
    s.id = 'nk-lp-style';
    s.textContent = CSS;
    document.head.appendChild(s);
    document.documentElement.classList.add('nk-lp');
  }

  /* ───────────── 2. Faster data: run profile + fee requests together ─────────────
     runSearch awaits nkHydratePublicProfiles, THEN nkHydrateViewingFees. Both only need
     listing ids, so start the fee request as soon as the profile request starts.
     The rows already carry created_at, so keep it for "Listed 2d ago". */
  function parallelHydration() {
    var origP = window.nkHydratePublicProfiles, origF = window.nkHydrateViewingFees;
    if (typeof origP !== 'function' || typeof origF !== 'function') return;
    var pending = new Map();
    var key = function (rows) { return (rows || []).map(function (r) { return r.id; }).join(','); };

    window.nkHydratePublicProfiles = function (rows) {
      try {
        (rows || []).forEach(function (r) { if (r && r.id && r.created_at) agoCache[r.id] = r.created_at; });
        var k = key(rows);
        if (rows && rows.length && !pending.has(k)) {
          var p = origF(rows);
          p.catch(function () {});
          pending.set(k, p);
          setTimeout(function () { pending.delete(k); }, 15000);
        }
      } catch (e) { warn(e); }
      return origP.apply(this, arguments);
    };

    window.nkHydrateViewingFees = async function (rows) {
      var k = key(rows), p = pending.get(k);
      if (!p) return origF.apply(this, arguments);
      pending.delete(k);
      try {
        var fed = await p;
        var m = new Map((fed || []).map(function (r) { return [r.id, r]; }));
        return rows.map(function (r) {
          var f = m.get(r.id);
          return Object.assign({}, r, {
            public_viewing_fee: f ? f.public_viewing_fee : null,
            viewing_fee_status: f ? f.viewing_fee_status : 'error'
          });
        });
      } catch (e) { return origF.call(this, rows); }
    };
  }

  /* ───────────── 3. Images: transforms, srcset, graceful fallback ───────────── */
  var noTransform = false;
  try { noTransform = sessionStorage.getItem('nk_no_tf') === '1'; } catch (e) {}
  var RE_SB = /^(https?:\/\/[^/]+)\/storage\/v1\/(?:object|render\/image)\/public\/([^?]+)/;

  function baseUrl(src) {
    var m = String(src || '').match(RE_SB);
    return m ? m[1] + '/storage/v1/object/public/' + m[2] : String(src || '').split('?')[0];
  }
  function patchImgSrc() {
    var orig = window.nkImgSrc;
    window.nkImgSrc = function (url, w) {
      if (!url || !w) return url;
      var m = String(url).match(RE_SB);
      if (m) {
        if (noTransform) return m[1] + '/storage/v1/object/public/' + m[2];
        return m[1] + '/storage/v1/render/image/public/' + m[2] + '?width=' + w + '&quality=72';
      }
      return typeof orig === 'function' ? orig(url, w) : url;
    };

    /* If transforms are not available on this plan, fall back to the original file.
       The failing request can be a srcset candidate, so look at currentSrc and srcset too.
       Transforms are switched off for everyone only after the original has really loaded. */
    document.addEventListener('error', function (e) {
      var t = e.target;
      if (!t || t.tagName !== 'IMG') return;
      var tried = [t.currentSrc, t.getAttribute('src'), t.getAttribute('srcset')].join(' ');
      if (tried.indexOf('/render/image/') === -1) return;
      var original = baseUrl(t.getAttribute('src') || t.currentSrc);
      t.addEventListener('load', function () {
        if (noTransform) return;
        noTransform = true;
        try { sessionStorage.setItem('nk_no_tf', '1'); } catch (x) {}
      }, { once: true });
      t.removeAttribute('srcset');
      t.src = original;
    }, true);
  }

  function prepImg(img, wrap) {
    var ready = function () { img.classList.add('is-loaded'); wrap.classList.add('nk-ready'); };
    if (img.complete && img.naturalWidth) ready();
    else {
      img.addEventListener('load', ready, { once: true });
      img.addEventListener('error', ready, { once: true });
      setTimeout(ready, 5000);   // never leave a photo invisible
    }
    if (noTransform || img.tagName !== 'IMG' || !RE_SB.test(img.src)) return;
    var b = baseUrl(img.src);
    img.srcset = [360, 520, 800].map(function (w) { return window.nkImgSrc(b, w) + ' ' + w + 'w'; }).join(', ');
    img.sizes = '(max-width:768px) 50vw, (max-width:1100px) 33vw, 300px';
  }

  /* ───────────── 4. Card enhancement ───────────── */
  var CAT_SHORT = { apartment: 'Apartment', house: 'House', boarding: 'Boarding', airbnb: 'Airbnb', commercial: 'Shop / office' };
  var ICON_TAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>';

  function shortRole(t) {
    return String(t || '')
      .replace(/Direct from owner/i, 'Owner')
      .replace(/Tenant \/ Buyer/i, 'Tenant')
      .replace(/\s*\(role changed, not verified\)/i, ' · unverified')
      .replace(/\s*·\s*identity checked/i, ' · checked')
      .replace(/\s*\(not verified\)/i, ' · unverified')
      .trim();
  }

  function fmtAgo(iso) {
    var h = (Date.now() - new Date(iso).getTime()) / 36e5;
    if (!isFinite(h) || h < 0) return '';
    if (h < 1) return 'Just now';
    if (h < 24) return Math.floor(h) + 'h ago';
    var d = Math.floor(h / 24);
    if (d < 30) return d + 'd ago';
    if (d < 365) return Math.floor(d / 30) + 'mo ago';
    return Math.floor(d / 365) + 'y ago';
  }
  function applyAgo(card) {
    var iso = agoCache[card.dataset.listingId];
    if (!iso) return;
    var t = fmtAgo(iso);
    var a = card.querySelector('.lp-ago'), k = card.querySelector('.lp-kl-ago');
    var full = '';
    try { full = new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) {}
    if (a) {
      a.textContent = '';
      if (t) {
        var al = document.createElement('span');
        al.className = 'lp-ago-l';
        al.textContent = 'Listed ';
        a.appendChild(al);
        a.appendChild(document.createTextNode(t === 'Just now' ? 'just now' : t));
      }
      if (full) a.title = 'Listed ' + full;
    }
    if (k) k.textContent = t;
  }
  function loadAgo(cards) {
    var need = cards.map(function (c) { return c.dataset.listingId; }).filter(function (id) { return id && !agoCache[id]; });
    if (!need.length) { cards.forEach(applyAgo); return; }
    if (typeof db === 'undefined') return;
    db.from('listings').select('id,created_at').in('id', need).then(function (r) {
      (r.data || []).forEach(function (row) { agoCache[row.id] = row.created_at; });
      document.querySelectorAll('#listings-grid .card').forEach(applyAgo);
    }, warn);
  }

  function enhanceCard(card) {
    if (card.dataset.nkp) return;
    card.dataset.nkp = '1';
    var wrap = card.querySelector('.card-img'), body = card.querySelector('.card-body');
    if (!wrap || !body) return;

    // photo first, so no later step can ever leave it hidden
    var img = wrap.querySelector(':scope > img');
    try {
      if (img) prepImg(img, wrap); else wrap.classList.add('nk-ready');
    } catch (e) {
      warn(e);
      wrap.classList.add('nk-ready');
      if (img) img.classList.add('is-loaded');
    }

    var catLabel = '', catKey = '';
    var area = body.querySelector('.card-area');

    step(function () {
      if (!area || area.querySelector('.lp-area-name')) return;
      var n = area.firstChild;
      while (n && !(n.nodeType === 3 && n.textContent.trim())) n = n.nextSibling;
      if (!n) return;
      var nm = document.createElement('span');
      nm.className = 'lp-area-name';
      nm.textContent = n.textContent.trim();
      area.replaceChild(nm, n);
    });

    // price on the photo
    step(function () {
      var priceEl = body.querySelector('.card-price');
      if (priceEl && !wrap.querySelector('.lp-price')) {
        var ov = document.createElement('span');
        ov.className = 'lp-price';
        ov.innerHTML = priceEl.innerHTML;
        var plen = priceEl.textContent.trim().length;
        if (plen >= 17) ov.classList.add('lp-m2'); else if (plen >= 14) ov.classList.add('lp-m1');
        wrap.appendChild(ov);
      }
    });

    // category: text beside the area (desktop) + "Listed …" slot
    step(function () {
      var bc = wrap.querySelector('.badge-cat');
      if (bc) Object.keys(CAT_SHORT).forEach(function (k) { if (bc.classList.contains(k)) catKey = k; });
      catLabel = CAT_SHORT[catKey] || (bc ? bc.textContent.trim() : '');
      if (!area) return;
      if (catLabel) {
        var c = document.createElement('span');
        c.className = 'lp-cat';
        c.textContent = catLabel;
        var vb = area.querySelector('.card-verified-badge');
        vb ? area.insertBefore(c, vb) : area.appendChild(c);
      }
      var ago = document.createElement('span');
      ago.className = 'lp-ago';
      area.appendChild(ago);
    });

    // role line: full text for desktop (without the duplicated "identity checked"), short text for phones
    step(function () {
      var role = body.querySelector('.card-role');
      if (!role) return;
      var full = role.textContent.trim();
      var shown = (area && area.querySelector('.card-verified-badge')) ? full.replace(/\s*·\s*identity checked/i, '') : full;
      role.textContent = '';
      var f = document.createElement('span');
      f.className = 'lp-role-full';
      f.textContent = shown;
      var s = document.createElement('span');
      s.className = 'lp-role-short';
      s.textContent = shortRole(full);
      role.appendChild(f);
      role.appendChild(s);
      var vbadge = area && area.querySelector('.card-verified-badge');
      if (vbadge) {
        vbadge.classList.add('lp-badge');
        role.insertAdjacentElement('afterend', vbadge);
      }
      var feeChip = body.querySelector('.card-viewing-fee');
      if (feeChip && feeChip.parentNode) {
        var tbr = document.createElement('span');
        tbr.className = 'lp-trust-br';
        feeChip.parentNode.insertBefore(tbr, feeChip);
      }
      if (/identity checked/i.test(full)) role.classList.add('is-checked');
    });

    // viewing-fee chip icon
    step(function () {
      var fee = body.querySelector('.card-viewing-fee');
      if (fee && !fee.querySelector('svg')) fee.insertAdjacentHTML('afterbegin', ICON_TAG);
    });

    // compact key line (visible on phones): [category chip] specs ...... age
    step(function () {
      var chips = [].map.call(body.querySelectorAll('.card-spec-chip'), function (n) { return n.textContent.trim(); }).filter(Boolean);
      var kl = document.createElement('div');
      kl.className = 'lp-keyline';
      if (catLabel) {
        var chip = document.createElement('span');
        chip.className = 'lp-chip' + (catKey ? ' ' + catKey : '');
        chip.textContent = catLabel;
        kl.appendChild(chip);
      }
      var ks = document.createElement('span');
      ks.className = 'lp-kl-specs';
      chips.slice(0, 3).forEach(function (c) {
        var si = document.createElement('span');
        si.className = 'lp-kl-s';
        si.textContent = c;
        ks.appendChild(si);
      });
      var ka = document.createElement('span');
      ka.className = 'lp-kl-ago';
      kl.appendChild(ks);
      kl.appendChild(ka);
      var sub = body.querySelector('.card-sub');
      body.insertBefore(kl, sub || body.querySelector('.card-trust') || null);
    });
  }

  function enhanceAll() {
    var grid = $('listings-grid');
    if (!grid) return;
    var fresh = [].slice.call(grid.querySelectorAll('article.card:not([data-nkp])'));
    fresh.forEach(function (c) { try { enhanceCard(c); } catch (e) { warn(e); } });
    // keep only one inline "Get alerts" card (infinite scroll adds one per page)
    var n = grid.querySelectorAll('.nk-inline-notify');
    for (var i = 1; i < n.length; i++) n[i].remove();
    if (fresh.length) loadAgo(fresh);
  }

  function watchGrid() {
    var grid = $('listings-grid');
    if (!grid) return;
    // Synchronous on purpose: runs as a microtask right after the page renders the cards,
    // before paint and before the page restores the scroll position.
    new MutationObserver(function () { enhanceAll(); }).observe(grid, { childList: true });

    // the page swaps img.src for the photo carousel: drop srcset so the new photo actually shows
    var dropSrcset = function (e) {
      var card = e.target.closest && e.target.closest('.card');
      var img = card && card.querySelector('.card-img>img');
      if (img && img.hasAttribute('srcset') && (e.type === 'touchend' || e.target.closest('[data-photo-nav]'))) img.removeAttribute('srcset');
    };
    grid.addEventListener('click', dropSrcset, true);
    grid.addEventListener('touchend', dropSrcset, true);
    enhanceAll();
  }

  /* ───────────── 5. Layout tweaks ───────────── */
  function moveRecent() {
    var m = $('recent-mount'), area = $('results-area');
    if (m && area && area.nextElementSibling !== m) area.insertAdjacentElement('afterend', m);
  }
  function addResultsHeading() {
    var r = $('results');
    if (!r || r.querySelector('.lp-results-h')) return;
    var h = document.createElement('h2');
    h.className = 'sr-only lp-results-h';
    h.textContent = 'Search results';
    r.insertBefore(h, r.firstChild);
  }

  var DISCOVER = [
    ['Under 10K', 'under 10000'], ['Bedsitters', 'bedsitter'], ['1 bedroom', '1 bedroom'], ['Hostels', 'hostel'], ['Airbnb', 'airbnb'],
    ['Kondele', 'Kondele Kisumu'], ['Milimani', 'Milimani Kisumu'], ['Maseno', 'Maseno Kisumu'],
    ['Nyali', 'Nyali Mombasa'], ['Kilimani', 'Kilimani Nairobi'], ['Westlands', 'Westlands Nairobi']
  ];
  function buildDiscover() {
    var anchor = $('active-filters');
    if (!anchor || $('lp-discover')) return;
    var d = document.createElement('div');
    d.id = 'lp-discover';
    d.className = 'lp-discover';
    d.setAttribute('role', 'group');
    d.setAttribute('aria-label', 'Popular searches');
    d.innerHTML = '<span class="lp-discover-label">Popular</span>' + DISCOVER.map(function (x) {
      return '<button type="button" class="lp-dchip" data-q="' + x[1] + '">' + x[0] + '</button>';
    }).join('');
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-q]');
      var q = $('search-q'), go = $('search-btn');
      if (!b || !q || !go) return;
      q.value = b.dataset.q;
      go.click();
    });
    anchor.insertAdjacentElement('afterend', d);
    var sync = function () { d.hidden = anchor.children.length > 0; };
    new MutationObserver(sync).observe(anchor, { childList: true });
    sync();
  }

  function navAutoHide() {
    var nav = $('main-nav'), root = document.documentElement;
    if (!nav) return;
    var lastY = window.scrollY, hidden = false, ticking = false;
    function setHidden(h) {
      if (h === hidden) return;
      hidden = h;
      nav.classList.toggle('nk-nav-hidden', h);
      if (h) root.style.setProperty('--nav-h', '0px'); else root.style.removeProperty('--nav-h');
    }
    function tick() {
      ticking = false;
      if (window.innerWidth > 768) { setHidden(false); lastY = window.scrollY; return; }
      var y = window.scrollY, dy = y - lastY;
      if (Math.abs(dy) < 8) return;
      var mn = $('mobile-nav');
      if (document.body.classList.contains('nk-modal-open') || (mn && mn.classList.contains('open'))) setHidden(false);
      else if (dy > 0 && y > 160) setHidden(true);
      else if (dy < 0) setHidden(false);
      lastY = y;
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; requestAnimationFrame(tick); }
    }, { passive: true });
    window.addEventListener('resize', function () { if (window.innerWidth > 768) setHidden(false); });
  }

  /* ───────────── boot ───────────── */
  function run(fn) { try { fn(); } catch (e) { warn(e); } }
  run(parallelHydration);
  run(patchImgSrc);
  run(injectCss);
  run(moveRecent);
  run(addResultsHeading);
  run(buildDiscover);
  run(watchGrid);
  run(navAutoHide);
})();