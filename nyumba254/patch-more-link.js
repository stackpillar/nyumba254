/* ============================================================
   Nyumba254 — listings.html UX patch  (patch-more-link.js, completes patch.js v1)
   Use INSTEAD of /patch.js (same position: last script on listings.html).
   Works purely by enhancing the DOM and wrapping global helpers, so it
   needs no edits to listings.html or nk-shared.js. Safe to remove.

   What it does
   1. Price + photo count ON the photo (desktop AND phones); category moves into the text line
   2. Removes duplicated "identity checked" text; adds a tag icon to the viewing-fee chip
   3. Adds "Listed 2d ago" (desktop in the area line, mobile in the key line)
   4. Mobile: one compact key line (Category · beds · baths) under the title
   5. Faster first paint: profile + viewing-fee requests run in parallel
   6. Images: responsive srcset + Supabase transforms, automatic fallback to
      the original file if transforms are not enabled, fade-in on load
   7. Recently Viewed moves below the results; popular-search chips on top
   8. Desktop: sticky category tabs.  Mobile: nav hides on scroll-down
   9. Repeated "Get alerts" cards removed from infinite scroll; a11y heading

   Completed / fixed compared with patch.js v1
   A. Image fallback now actually fires. v1 compared the <img src> attribute, but when
      a srcset is in use the browser requests a srcset candidate, so the check never matched
      and photos stayed broken when transforms were off. The fallback also only switches
      transforms off globally once the original file has really loaded (one bad photo
      no longer disables transforms for everyone).
   B. A photo can no longer stay invisible: the photo is prepared first and every
      enhancement step is isolated, so one failing step cannot leave opacity:0 behind.
   C. Cards are enhanced synchronously in the MutationObserver microtask, not a frame
      later: no flash of un-enhanced cards and no scroll drift when "Back to results"
      restores the scroll position.
   D. "Listed …" label now reads "Listed 2d ago" as promised (v1 showed only "2d ago").
      The age comes from the rows the page already fetched, so the extra
      listings.created_at query only runs as a fallback.
   E. Photo counter is shown on phones too (v1 only styled it for desktop).
   F. Stretched-link focus ring follows the new card radius.
   G. Double-load guard: warns instead of applying the patch twice if patch.js is also loaded.
   ============================================================ */
(function () {
  'use strict';
  if (window.__nkPatchMoreLink) return;
  if (window.__nkPatchV1) {
    try { console.warn('[nk-patch] patch.js is also loaded. Remove it and keep only patch-more-link.js.'); } catch (x) {}
    return;
  }
  window.__nkPatchMoreLink = true;
  window.__nkPatchV1 = true;   // so a late-loading patch.js stays out of the way

  var $ = function (id) { return document.getElementById(id); };
  var warn = function (e) { try { console.warn('[nk-patch]', e); } catch (x) {} };
  var step = function (fn) { try { fn(); } catch (e) { warn(e); } };

  var agoCache = {};   // listing id -> created_at (filled from the page's own rows, DB only as fallback)

  var CAM = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2'%3E%3Cpath d='M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z'/%3E%3Ccircle cx='12' cy='13' r='4'/%3E%3C/svg%3E")`;

  /* ───────────────────────── 1. CSS ───────────────────────── */
  var CSS = `
/* ===== page header ===== */
html.nk-patched .page-header{background:linear-gradient(180deg,#fff 0%,#f3faf7 100%)}
.page-header h1{letter-spacing:-.01em}
.header-search{max-width:820px}
.header-search input{padding:13px 16px;border-radius:14px;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.05)}
.hs-btn{border-radius:14px;box-shadow:0 4px 12px rgba(15,110,86,.25)}

/* ===== category tabs ===== */
.cat-tab.active{background:var(--green);border-color:var(--green);box-shadow:0 3px 10px rgba(15,110,86,.25)}
@media (min-width:901px){
  .cat-tabs{position:sticky;top:var(--nav-h);z-index:45;background:var(--surface);margin:-6px -2px 12px;padding:8px 2px}
}

/* ===== popular searches ===== */
.nk-discover{display:flex;align-items:center;gap:8px;overflow-x:auto;scrollbar-width:none;margin:0 0 14px;padding:2px 0}
.nk-discover::-webkit-scrollbar{display:none}
.nk-discover-label{flex:none;font-size:12.5px;font-weight:600;color:var(--text-3);margin-right:2px}
.nk-dchip{flex:none;min-height:36px;padding:0 14px;border-radius:20px;background:#fff;border:1.5px solid var(--border);color:var(--text-2);font-size:13px;font-weight:600;white-space:nowrap;transition:border-color .15s,color .15s,background .15s}
.nk-dchip:hover{border-color:var(--green);color:var(--green-dark);background:var(--green-light)}
@media (max-width:768px){.nk-discover{display:none}}

/* ===== listing grid ===== */
.listings-grid{gap:20px;grid-template-columns:repeat(auto-fill,minmax(min(285px,100%),1fr))}
.listings-grid .card{border-radius:16px;border:1px solid #ebe9e3;box-shadow:0 1px 2px rgba(0,0,0,.04),0 6px 18px rgba(15,110,86,.06)}
.listings-grid .card:hover,.listings-grid .card.is-hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(15,110,86,.15)}
.listings-grid .card:has(.badge-featured){border-color:#EBC57A;box-shadow:0 0 0 1px rgba(235,197,122,.55),0 8px 22px rgba(232,151,58,.14)}
.listings-grid .card-link:focus-visible::after{border-radius:16px}
.skeleton{border-radius:16px}

/* ===== photo ===== */
.card-img{aspect-ratio:3/2}
.skeleton-img{aspect-ratio:3/2}
.card-img:not(.nk-ready){background:linear-gradient(90deg,#f0efe9 25%,#e8e7e1 50%,#f0efe9 75%);background-size:200% 100%;animation:shimmer 1.4s infinite}
html.nk-patched .card-img>img{opacity:0;transition:opacity .35s ease,transform .5s ease}
html.nk-patched .card-img>img.is-loaded{opacity:1}
@media (hover:hover){.card:hover .card-img>img.is-loaded{transform:scale(1.035)}}
.card-img::after{height:46%;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.28))}
.card-img .badge-cat{display:none}

/* price sits on the photo: the one memorable element */
.card-price-overlay{position:absolute;left:10px;bottom:10px;z-index:3;pointer-events:none;max-width:calc(100% - 20px);
  background:rgba(10,22,17,.76);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:#fff;
  font-size:16.5px;font-weight:800;line-height:1.2;letter-spacing:-.01em;padding:6px 12px;border-radius:12px;white-space:nowrap}
.card-price-overlay span{font-size:11.5px;font-weight:500;opacity:.85;margin-left:1px}
.card-body .card-price{display:none}

/* photo counter (multi-photo cards) */
.card-photo-counter{display:flex;align-items:center;gap:5px;right:10px;bottom:10px;padding:4px 9px;font-size:11px;background:rgba(10,22,17,.6)}
.card-photo-counter::before{content:"";width:12px;height:12px;background:currentColor;
  -webkit-mask:${CAM} center/contain no-repeat;mask:${CAM} center/contain no-repeat}
.card:has(.card-photo-counter) .card-price-overlay{max-width:calc(100% - 92px)}

/* ===== card text ===== */
.card-body{padding:13px 15px 15px}
.card-area{text-transform:none;letter-spacing:0;font-size:12.5px;font-weight:700;gap:5px;margin-bottom:5px}
.card-area::before{font-size:12px}
.card-cat{font-weight:500;color:var(--text-3);font-size:12.5px}
.card-cat::before{content:"/";margin-right:5px;color:#c9c7bf}
.card-ago{margin-left:auto;font-size:11.5px;font-weight:500;color:var(--text-3)}
.card-ago:empty,.kl-ago:empty{display:none}
.card-title{font-size:15.5px;font-weight:700;line-height:1.3;min-height:2.6em;margin-bottom:3px}
.card-keyline{display:none}
.card-sub{margin-bottom:8px}

/* trust row: who is listing and what a viewing costs */
.card-trust{padding-top:9px;margin-top:2px;border-top:1px solid #f0eee8;gap:6px 8px}
.card-role{font-size:12.5px;font-weight:600;color:var(--text-2)}
.card-viewing-fee{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;padding:2px 9px}
.card-viewing-fee svg{width:11px;height:11px;stroke:currentColor;fill:none;stroke-width:2.2;flex:none}
.card-specs-chips{margin-top:2px}

/* actions */
.card-inquire-btn,.card-wa-btn{border-radius:12px;font-weight:700}
.card-msg-btn,.nk-compare-check{border-radius:12px}

/* ===== phones ===== */
@media (max-width:768px){
  .listings-grid{gap:12px 10px}
  .listings-grid .card{border-radius:14px}
  .listings-grid .card-link:focus-visible::after{border-radius:14px}
  .card-img,.skeleton-img{aspect-ratio:4/3}
  .card-price-overlay{left:6px;bottom:6px;max-width:calc(100% - 12px);font-size:13px;padding:4px 9px;border-radius:10px}
  .card-price-overlay span{font-size:10px}
  /* the page hides the counter on phones; swipe still works, so show the count as a small pill */
  .card-photo-counter{display:flex;right:6px;bottom:6px;padding:3px 7px;gap:4px;font-size:10px}
  .card-photo-counter::before{width:10px;height:10px}
  .card:has(.card-photo-counter) .card-price-overlay{max-width:calc(100% - 66px)}
  .card-body{padding:9px 10px 11px}
  .card-area{font-size:11px;margin-bottom:3px}
  .card-cat,.card-ago{display:none}
  .card-title{font-size:13.5px;min-height:2.6em;margin-bottom:3px}
  .card-keyline{display:flex;flex-wrap:wrap;gap:0 6px;font-size:11.5px;line-height:1.4;font-weight:500;color:var(--text-2);margin-bottom:5px}
  .kl-ago{color:var(--text-3)}
  .card-trust{padding-top:6px;margin-bottom:8px}
  .card-role{font-size:11px}
  .card-inquire-btn,.card-wa-btn{min-height:40px;font-size:12.5px}
  .nav-count{display:none}
  nav#main-nav{transition:transform .28s ease}
  nav#main-nav.nk-nav-hidden{transform:translateY(-100%)}
  .nk-quickbar{transition:top .28s ease}
}

/* ===== recently viewed now sits under the results ===== */
#recent-mount{margin-top:28px}
.nk-recent-card img,.nk-recent-ph{border-radius:12px}

/* ===== trust bar ===== */
.trust-bar{background:#fff;border-color:var(--border);color:var(--green-dark)}
`;

  function injectCss() {
    if ($('nk-patch-style')) return;
    var s = document.createElement('style');
    s.id = 'nk-patch-style';
    s.textContent = CSS;
    document.head.appendChild(s);
    document.documentElement.classList.add('nk-patched');
  }

  /* ───────────── 2. Faster data: run profile + fee requests together ─────────────
     runSearch awaits nkHydratePublicProfiles, THEN nkHydrateViewingFees.
     Both only need listing ids, so start the fee request as soon as the
     profile request starts, and hand the result back when it is asked for.
     The rows passed in already carry created_at, so we keep it for "Listed 2d ago". */
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

    /* If the transform endpoint is not available on this plan, fall back to the original file.
       The failing request can be a srcset candidate, so look at currentSrc and srcset too,
       not only the src attribute. Transforms are switched off for everyone only after the
       original file has loaded, so one broken photo does not disable them site-wide. */
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

  function fmtAgo(iso) {
    var h = (Date.now() - new Date(iso).getTime()) / 36e5;
    if (!isFinite(h) || h < 0) return '';
    if (h < 1) return 'Just now';
    if (h < 24) return Math.floor(h) + 'h ago';
    var d = Math.floor(h / 24);
    return d < 30 ? d + 'd ago' : '';
  }
  function applyAgo(card) {
    var iso = agoCache[card.dataset.listingId];
    if (!iso) return;
    var t = fmtAgo(iso);
    var a = card.querySelector('.card-ago'), k = card.querySelector('.kl-ago');
    var full = '';
    try { full = new Date(iso).toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) {}
    if (a) {
      a.textContent = t ? 'Listed ' + (t === 'Just now' ? 'just now' : t) : '';
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

    var catLabel = '';
    var area = body.querySelector('.card-area');

    // price on the photo
    step(function () {
      var priceEl = body.querySelector('.card-price');
      if (priceEl && !wrap.querySelector('.card-price-overlay')) {
        var ov = document.createElement('span');
        ov.className = 'card-price-overlay';
        ov.innerHTML = priceEl.innerHTML;
        wrap.appendChild(ov);
      }
    });

    // category label moves into the text line, plus the "Listed …" slot
    step(function () {
      var bc = wrap.querySelector('.badge-cat'), catKey = '';
      if (bc) Object.keys(CAT_SHORT).forEach(function (k) { if (bc.classList.contains(k)) catKey = k; });
      catLabel = CAT_SHORT[catKey] || (bc ? bc.textContent.trim() : '');
      if (!area) return;
      if (catLabel) {
        var c = document.createElement('span');
        c.className = 'card-cat';
        c.textContent = catLabel;
        var vb = area.querySelector('.card-verified-badge');
        vb ? area.insertBefore(c, vb) : area.appendChild(c);
      }
      var ago = document.createElement('span');
      ago.className = 'card-ago';
      area.appendChild(ago);
    });

    // role line: the pill already says "Identity checked"
    step(function () {
      var role = body.querySelector('.card-role');
      if (role && area && area.querySelector('.card-verified-badge')) {
        role.textContent = role.textContent.replace(/\s*·\s*identity checked/i, '');
      }
    });

    // viewing-fee chip icon
    step(function () {
      var fee = body.querySelector('.card-viewing-fee');
      if (fee && !fee.querySelector('svg')) fee.insertAdjacentHTML('afterbegin', ICON_TAG);
    });

    // compact key line (shown on phones, where spec chips are hidden)
    step(function () {
      var parts = [];
      if (catLabel) parts.push(catLabel);
      var chips = [].map.call(body.querySelectorAll('.card-spec-chip'), function (n) { return n.textContent.trim(); }).filter(Boolean);
      if (!chips.length) chips = [].map.call(body.querySelectorAll('.card-meta-item'), function (n) { return n.textContent.trim(); }).filter(Boolean).slice(0, 2);
      parts = parts.concat(chips.slice(0, 3));
      var kl = document.createElement('div');
      kl.className = 'card-keyline';
      var ks = document.createElement('span');
      ks.className = 'kl-specs';
      ks.textContent = parts.join(' · ');
      var ka = document.createElement('span');
      ka.className = 'kl-ago';
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
    // Synchronous on purpose: this runs as a microtask right after the page renders the cards,
    // before the browser paints and before the page restores the scroll position.
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
    if (!r || r.querySelector('.nk-results-h')) return;
    var h = document.createElement('h2');
    h.className = 'sr-only nk-results-h';
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
    if (!anchor || $('nk-discover')) return;
    var d = document.createElement('div');
    d.id = 'nk-discover';
    d.className = 'nk-discover';
    d.setAttribute('role', 'group');
    d.setAttribute('aria-label', 'Popular searches');
    d.innerHTML = '<span class="nk-discover-label">Popular</span>' + DISCOVER.map(function (x) {
      return '<button type="button" class="nk-dchip" data-q="' + x[1] + '">' + x[0] + '</button>';
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