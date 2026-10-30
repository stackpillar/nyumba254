#!/usr/bin/env node
// Nyumba254 first-impression patch (complete version)
//
// Usage (from your site root, where index.html and nk-shared.js live):
//   node patch.js              apply everything
//   node patch.js --dry        show what would change, write nothing
//   node patch.js --force      write even if some edits could not be matched
//   node patch.js /path/to/site
//
// Safe to re-run: every edit checks whether it is already applied.
// Backups are saved once as index.html.bak and nk-shared.js.bak.
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const flags = new Set(args.filter(a => a.startsWith('--')));
const dir = path.resolve(args.find(a => !a.startsWith('--')) || process.cwd());
const DRY = flags.has('--dry'), FORCE = flags.has('--force');

/* ---------- payloads (stored in the last block comment of this file) ---------- */
const self = fs.readFileSync(__filename, 'utf8').replace(/\r\n/g, '\n');
const pStart = self.lastIndexOf('/*' + 'PAYLOADS');
const pEnd = self.lastIndexOf('PAYLOADS' + '*/');
if (pStart < 0 || pEnd < 0 || pEnd < pStart) { console.error('patch.js is damaged: payload block not found.'); process.exit(1); }
const P = {};
self.slice(pStart + 10, pEnd).split(/^@@@ (\w+)\n/m).slice(1).forEach((v, i, a) => { if (i % 2 === 0) P[v] = a[i + 1].replace(/\n+$/, '\n'); });
['CSS', 'SHARED_HELPERS', 'SHARED_PRE', 'SHARED_BADGE', 'SHARED_METAROW', 'PEEK_HTML', 'PICTURE_HTML', 'HEAD_PRELOAD', 'INDEX_JS'].forEach(k => {
  if (!P[k] || !P[k].trim()) { console.error('patch.js is damaged: payload ' + k + ' is missing.'); process.exit(1); }
});

/* ---------- helpers ---------- */
function sub(text, find, repl) {
  if (typeof find === 'string') {
    const i = text.indexOf(find);
    if (i < 0) return null;
    return text.slice(0, i) + repl + text.slice(i + find.length);
  }
  const m = find.exec(text);
  if (!m) return null;
  return text.slice(0, m.index) + (typeof repl === 'function' ? repl(m) : repl) + text.slice(m.index + m[0].length);
}
const has = s => t => t.includes(s);
const lacks = s => t => !t.includes(s);

function runEdits(label, text, edits) {
  const results = [];
  for (const e of edits) {
    if (e.skip) { results.push(['skip', e.n, e.skip]); continue; }
    if (e.done(text)) { results.push(['done', e.n]); continue; }
    const out = e.fn(text);
    if (out === null) { results.push(['FAIL', e.n]); continue; }
    text = out; results.push(['ok', e.n]);
  }
  console.log('\n' + label);
  results.forEach(([s, n, why]) => console.log('  ' + ({ ok: '[applied]', done: '[already]', FAIL: '[FAILED ]', skip: '[skipped]' })[s] + ' ' + n + (why ? ' (' + why + ')' : '')));
  return { text, failed: results.filter(r => r[0] === 'FAIL').length };
}

async function makeImages() {
  const src = path.join(dir, 'hero-kenya-apartments.jpg');
  const small = path.join(dir, 'hero-kenya-apartments-800.webp'), big = path.join(dir, 'hero-kenya-apartments.webp');
  if (fs.existsSync(small) && fs.existsSync(big)) return true;
  if (!fs.existsSync(src)) { console.log('\n  hero-kenya-apartments.jpg not found, skipping hero image optimisation.'); return false; }
  if (DRY) return false;
  let sharp;
  try { sharp = require(require.resolve('sharp', { paths: [dir, process.cwd(), __dirname] })); }
  catch (e) { console.log('\n  "sharp" is not installed, so mobile/WebP hero images were skipped.\n  Run:  npm i --no-save sharp   then   node patch.js   again.'); return false; }
  await sharp(src).resize({ width: 800 }).webp({ quality: 72 }).toFile(small);
  await sharp(src).webp({ quality: 78 }).toFile(big);
  console.log('\n  Created hero-kenya-apartments-800.webp and hero-kenya-apartments.webp');
  return true;
}

function readNormalised(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: /\r\n/.test(raw) };
}
function save(file, text, crlf) {
  const bak = file + '.bak';
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
  fs.writeFileSync(file, crlf ? text.replace(/\n/g, '\r\n') : text);
}

/* ---------- edits: nk-shared.js ---------- */
const sharedEdits = [
  { n: 'shared: nkCardMeta() helper (beds / baths / amenities)', done: has('function nkCardMeta('),
    fn: t => sub(t, 'function nkCardCoverPhoto(listing) {', P.SHARED_HELPERS + '\nfunction nkCardCoverPhoto(listing) {') },
  { n: 'shared: eager first images (opts.eager)', done: has('o.eager ?'),
    fn: t => sub(t, 'alt="${safeTitle}" loading="lazy" width=', 'alt="${safeTitle}" ${o.eager ? \'loading="eager" fetchpriority="high"\' : \'loading="lazy"\'} width=') },
  { n: 'shared: price overlay / photo count / short role vars', done: has('const nkPhotoCount'),
    fn: t => sub(t, '  return `\n    <a class="card"', P.SHARED_PRE + '  return `\n    <a class="card"') },
  { n: 'shared: card gets has-overlay class', done: has('has-overlay'),
    fn: t => sub(t, '<a class="card" href="${href}"', '<a class="card${o.priceOverlay ? \' has-overlay\' : \'\'}" href="${href}"') },
  { n: 'shared: price + photo count on image, category moves to meta row', done: has('overlayHtml :'),
    fn: t => sub(t, '        <span class="badge-cat ${escHtml(listing.category)}">${meta.label}</span>', P.SHARED_BADGE.replace(/\n$/, '')) },
  { n: 'shared: meta row (category, beds, baths, amenities)', done: has('class="card-meta"'),
    fn: t => sub(t, '<div class="card-sub">${escHtml(subText)}</div>', P.SHARED_METAROW.replace(/\n$/, '')) },
  { n: 'shared: short role text on compact cards', done: has('shortRoleText : roleText'),
    fn: t => sub(t, '">${escHtml(roleText)}</div>', '">${escHtml(o.priceOverlay ? shortRoleText : roleText)}</div>') },
  { n: 'shared: "free" class on free viewing pill', done: has('card-viewing-fee${viewingFee'),
    fn: t => sub(t, '<div class="card-viewing-fee">${viewingFee===null', '<div class="card-viewing-fee${viewingFee===0 ? \' free\' : \'\'}">${viewingFee===null') },
];

/* ---------- edits: index.html ---------- */
function indexEdits(imagesOk) {
  const stamp = Date.now().toString(36);
  return [
    { n: 'css: first-impression styles (cards, peek strip, mobile hero, search icon)', done: has('nk-patch:first-impression'),
      fn: t => sub(t, /<\/style>\s*<link rel="stylesheet" href="\/theme\.css"\/>/, () => '/* nk-patch:first-impression */\n' + P.CSS + '  </style>\n  <link rel="stylesheet" href="/theme.css"/>') },
    { n: 'html: replace hidden hero stats with newest-listings peek strip', done: has('id="hero-peek"'),
      fn: t => sub(t, /[ \t]*<div class="hero-stats">[\s\S]*?Deal commission \(Nyumba254\)<\/div><\/div>\s*<\/div>/, '    ' + P.PEEK_HTML.replace(/\n$/, '')) },
    { n: 'html: "new this week" pill next to Latest listings', done: has('id="latest-fresh"'),
      fn: t => sub(t, '<h2 class="section-title" id="latest-title">Latest listings</h2>', '<h2 class="section-title" id="latest-title">Latest listings <span class="fresh-pill" id="latest-fresh" hidden></span></h2>') },
    { n: 'html: move Recently viewed below Latest', done: t => t.indexOf('id="recently-viewed-section"') > t.indexOf('id="latest-section"'),
      fn: t => {
        const m = /<!-- [^\n]*RECENTLY VIEWED[^\n]*-->[\s\S]*?<\/section>\n?/.exec(t); if (!m) return null;
        const out = t.slice(0, m.index) + t.slice(m.index + m[0].length);
        const m2 = /<!-- [^\n]*COUNTIES[^\n]*-->/.exec(out); if (!m2) return null;
        return out.slice(0, m2.index) + m[0].replace(/\n?$/, '\n') + '\n' + out.slice(m2.index);
      } },
    { n: 'html: cache-bust nk-shared.js', done: t => /nk-shared\.js\?v=/.test(t),
      fn: t => sub(t, '<script src="/nk-shared.js"></script>', '<script src="/nk-shared.js?v=' + stamp + '"></script>') },
    imagesOk
      ? { n: 'html: hero <picture> (WebP + mobile size) and preload', done: has('<picture>'),
          fn: t => {
            const o = sub(t, '<img class="hero-slide active" src="/hero-kenya-apartments.jpg" alt="" width="1672" height="941" decoding="async" fetchpriority="high"/>', P.PICTURE_HTML.replace(/\n$/, ''));
            if (o === null) return null;
            return sub(o, '<link rel="preconnect" href="https://fonts.googleapis.com"/>', P.HEAD_PRELOAD.replace(/\n$/, '') + '\n  <link rel="preconnect" href="https://fonts.googleapis.com"/>');
          } }
      : { n: 'html: hero <picture> (WebP + mobile size) and preload', skip: 'WebP files not available, see message above', done: () => false, fn: t => t },

    { n: 'js: remove hero-stats counters', done: lacks("$('stat-listings').dataset.target"),
      fn: t => sub(t, /[ \t]*\$\('stat-listings'\)\.dataset\.target[^\n]*\n[ \t]*\$\('stat-areas'\)\.dataset\.target[^\n]*\n/, '') },
    { n: 'js: remove startCountUp() call', done: lacks('startCountUp();'),
      fn: t => sub(t, 'renderCountiesGrid(); startCountUp();', 'renderCountiesGrid();') },
    { n: 'js: remove dead hero slideshow', done: lacks('initHeroSlideshow'),
      fn: t => { const a = sub(t, 'initHeroSlideshow(); ', ''); return a === null ? null : sub(a, /function initHeroSlideshow\(\) \{[\s\S]*?\n\}\n/, ''); } },
    { n: 'js: statsReady flag', done: has('statsReady = true'),
      fn: t => sub(t, 'countyCounts = stats.counties || {};', 'countyCounts = stats.counties || {}; statsReady = true;') },
    { n: 'js: hide "Browse by county" until 2+ counties have listings', done: has('/*gate*/'),
      fn: t => sub(t, "grid.classList.toggle('hide-empty', hasAny);", "grid.classList.toggle('hide-empty', hasAny);\n  /*gate*/ if (statsReady) { const sec = $('areas'); if (sec) sec.hidden = Object.keys(countyCounts).filter(k => countyCounts[k] > 0).length < MIN_COUNTIES_SECTION; }") },
    { n: 'js: homepage cache expires after 10 minutes', done: has("k + '_ts'"),
      fn: t => {
        const a = sub(t, 'const h = el.innerHTML; if (h.length < 250000) localStorage.setItem(k, h);', "const h = el.innerHTML; if (h.length < 250000) { localStorage.setItem(k, h); localStorage.setItem(k + '_ts', String(Date.now())); }");
        if (a === null) return null;
        return sub(a, 'const h = localStorage.getItem(NK_CACHE_KEYS[id]); if (h && $(id)) $(id).innerHTML = h;', "const k = NK_CACHE_KEYS[id], ts = Number(localStorage.getItem(k + '_ts')) || 0, h = localStorage.getItem(k); if (h && ts && Date.now() - ts < 600000 && $(id)) $(id).innerHTML = h;");
      } },
    { n: 'js: cards use price overlay, meta row, eager first 2 images', done: has('priceOverlay: true'),
      fn: t => sub(t, 'listings.map(l => nkBuildCard(l, { compact: true, imgWidth: imgWidth || 480 }))', "listings.map((l, i) => nkBuildCard(l, { compact: true, imgWidth: imgWidth || 480, priceOverlay: true, eager: i < 2 && containerId !== 'recently-viewed-listings' && !document.body.classList.contains('nk-datasaver') }))") },
    { n: 'js: Featured shows photo listings first', done: has("renderListings('featured-listings', withPhotosFirst"),
      fn: t => sub(t, "renderListings('featured-listings', listings);", "renderListings('featured-listings', withPhotosFirst(listings));") },
    { n: 'js: Latest = photos first + thin-inventory fallback', done: has('homeThinFill(listings'),
      fn: t => sub(t, "renderListings('latest-listings', listings, 480, ", "const thin = await homeThinFill(listings, county, area, where);\n  if (my !== latest.token) return;\n  listings = thin.list;\n  renderListings('latest-listings', listings, 480, ") },
    { n: 'js: Latest post-render hook (note, fresh pill, peek strip)', done: has('homeAfterLatest(thin'),
      fn: t => sub(t, "Be the first to list!</a></p></div>`);", "Be the first to list!</a></p></div>`); homeAfterLatest(thin, county, area);") },
    { n: 'js: identity-checked count in boot', done: has('loadCheckedCount(); loadFeatured();'),
      fn: t => sub(t, 'loadStats(); loadFeatured();', 'loadStats(); loadCheckedCount(); loadFeatured();') },
    { n: 'js: nav search keeps Rent/Buy intent', done: has('const f = { category: intent.cat, freq: intent.freq }; applyText'),
      fn: t => sub(t, 'const f = {}; applyText(f, raw); finishSearch(f);', 'const f = { category: intent.cat, freq: intent.freq }; applyText(f, raw); finishSearch(f);') },
    { n: 'js: inject new helpers (peek, thin fill, filter badge, nav placeholder, hover photo)', done: has('nk-patch:index-js'),
      fn: t => sub(t, /\nboot\(\);\s*\n\}\)\(\);/, () => '\n/* nk-patch:index-js */\n' + P.INDEX_JS + '\nboot();\n\n})();') },
  ];
}

/* ---------- main ---------- */
(async () => {
  const idxFile = path.join(dir, 'index.html'), shFile = path.join(dir, 'nk-shared.js');
  for (const f of [idxFile, shFile]) if (!fs.existsSync(f)) { console.error('Missing ' + f + '\nRun this from your site root or pass the folder as an argument.'); process.exit(1); }
  console.log('Nyumba254 patch' + (DRY ? ' (dry run)' : '') + ' in ' + dir);

  const imagesOk = await makeImages();
  const sh = readNormalised(shFile), ix = readNormalised(idxFile);
  const r1 = runEdits('nk-shared.js', sh.text, sharedEdits);
  const r2 = runEdits('index.html', ix.text, indexEdits(imagesOk));
  const failed = r1.failed + r2.failed;

  if (DRY) { console.log('\nDry run: nothing written.'); return; }
  if (failed && !FORCE) {
    console.log('\n' + failed + ' edit(s) could not be matched, so NOTHING was written (your files may differ from the versions this patch was written for).\nSend me the [FAILED] names, or run with --force to write the edits that did match.');
    process.exit(2);
  }
  save(shFile, r1.text, sh.crlf); save(idxFile, r2.text, ix.crlf);
  console.log('\nDone. Backups: index.html.bak, nk-shared.js.bak');
  console.log('Next: deploy, then hard-refresh (your service worker /sw.js may serve the old files until you bump its cache version).');
})();

/*PAYLOADS
@@@ CSS
    .hero-illustration picture{display:block}
    .search-btn::before{content:'';font-size:0;width:16px;height:16px;flex-shrink:0;background:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23fff' stroke-width='2.4' stroke-linecap='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cline x1='21' y1='21' x2='16.65' y2='16.65'/%3E%3C/svg%3E") center/contain no-repeat}

    .hero-peek{margin-top:18px;max-width:640px}
    .hero-peek-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}
    .hero-peek-title{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#C9F0E0;text-shadow:0 1px 6px rgba(0,0,0,.35)}
    .hero-peek-all{font-size:12.5px;font-weight:600;color:#fff;text-decoration:underline;text-underline-offset:3px;white-space:nowrap}
    .hero-peek-row{display:flex;gap:10px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}
    .hero-peek-row::-webkit-scrollbar{display:none}
    .peek-card{position:relative;display:block;flex:1 1 0;min-width:136px;max-width:170px;aspect-ratio:4/3;border-radius:12px;overflow:hidden;background:rgba(255,255,255,.12);box-shadow:0 4px 14px rgba(0,0,0,.3);transition:transform .15s}
    .peek-card:hover,.peek-card:focus-visible{transform:translateY(-3px)}
    .peek-card img{width:100%;height:100%;object-fit:cover}
    .peek-card::after{content:'';position:absolute;inset:auto 0 0 0;height:65%;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.72));pointer-events:none}
    .peek-area{position:absolute;left:8px;right:8px;bottom:24px;z-index:1;font-size:10.5px;font-weight:600;color:rgba(255,255,255,.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .peek-price{position:absolute;left:8px;right:8px;bottom:7px;z-index:1;font-size:13px;font-weight:800;color:#fff;white-space:nowrap}
    .peek-price span{font-size:10px;font-weight:600;opacity:.9;margin-left:1px}
    .hero-peek-note{font-size:11.5px;color:rgba(255,255,255,.8);margin-top:8px}
    body.nk-datasaver .hero-peek{display:none}

    .card.has-overlay .card-price{display:none}
    .card-price-overlay{position:absolute;left:10px;bottom:9px;z-index:2;font-size:16px;font-weight:800;color:#fff;letter-spacing:-.01em;line-height:1.15;text-shadow:0 1px 6px rgba(0,0,0,.55)}
    .card-price-overlay span{font-size:11.5px;font-weight:600;opacity:.92;margin-left:2px}
    .card-photo-count{position:absolute;right:10px;bottom:9px;z-index:2;display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:700;color:#fff;background:rgba(0,0,0,.55);padding:3px 8px;border-radius:12px;line-height:1.2}
    .card-photo-count svg{width:12px;height:12px;stroke:#fff;fill:none;stroke-width:2}
    .card-img-alt{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transition:opacity .25s ease;z-index:0}
    .card:hover .card-img-alt.loaded{opacity:1}
    .card-meta{flex:0 0 100%;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:3px 8px;font-size:12px;line-height:1.3;color:var(--text-2);margin-bottom:6px}
    .card-meta span+span::before{content:'\00B7';margin-right:8px;color:var(--text-3);font-weight:700}
    .card-meta .meta-cat+span::before{display:none}
    .card-meta .meta-cat{font-size:10.5px;font-weight:700;padding:2px 9px;border-radius:20px;white-space:nowrap}
    .meta-cat.apartment{background:var(--green);color:#fff}
    .meta-cat.house{background:var(--green-dark);color:#fff}
    .meta-cat.boarding{background:var(--green-light);color:var(--green-dark);border:1px solid var(--green-mid)}
    .meta-cat.airbnb{background:#fff;color:var(--green-dark);border:1px solid var(--green)}
    .meta-cat.commercial{background:var(--text);color:#fff}
    .card-viewing-fee.free{background:#E1F5EE;border-color:#9FE1CB;color:#085041}

    .fresh-pill{display:inline-block;vertical-align:middle;margin-left:8px;font-family:'Inter',system-ui,sans-serif;font-size:11px;font-weight:700;letter-spacing:0;color:var(--green-dark);background:var(--green-light);border:1px solid #9FE1CB;padding:3px 9px;border-radius:20px}
    .thin-note{font-size:13px;color:var(--text-2);background:var(--green-light);border:1px solid #9FE1CB;border-radius:10px;padding:9px 12px;margin:0 0 12px}
    .thin-note a{color:var(--green-dark);font-weight:700;text-decoration:underline}
    .sb-more[data-count]:not([data-count="0"])::after{content:attr(data-count);display:inline-flex;align-items:center;justify-content:center;min-width:18px;height:18px;margin-left:6px;padding:0 5px;border-radius:9px;background:var(--green);color:#fff;font-size:11px;font-weight:800;vertical-align:middle}
    #featured-listings,#latest-listings{min-height:210px}
    @keyframes nkfade{from{opacity:.55}to{opacity:1}}
    #featured-listings .listings-grid,#latest-listings .listings-grid{animation:nkfade .3s ease}
    @media (min-width:561px){.hero-peek-note{display:none}}
    @media (max-width:768px){
      .hero h1{font-size:25px;line-height:1.18;margin-bottom:10px}
      .hero-quick-row{margin-top:8px}
      .nk-nearme-btn{min-height:34px;padding:0 12px;font-size:12.5px}
      #nk-recent-searches{display:none!important}
      .hero-peek{margin-top:12px;max-width:none}
      .peek-card{flex:0 0 42%;max-width:190px;min-width:0}
      .trust-bar{padding:8px 16px}
      .trust-item{padding:5px 11px;font-size:12px}
      .fresh-pill{margin-left:6px}
      #latest-listings .card-price-overlay{left:7px;bottom:6px;font-size:13.5px}
      #latest-listings .card-photo-count{right:7px;bottom:6px;font-size:10px;padding:2px 6px}
      #latest-listings .card-meta{font-size:10.5px;gap:2px 6px;margin-bottom:4px}
      #latest-listings .card-meta .meta-cat{font-size:9.5px;padding:1px 7px}
      #latest-listings .card-meta span:nth-child(n+4){display:none}
      #latest-listings .card-verified-badge{display:none}
    }
@@@ SHARED_HELPERS
function nkCardMeta(listing) {
  const out = [];
  const l = listing || {};
  const d = (l.details && typeof l.details === 'object') ? l.details : {};
  const num = v => (v === null || v === undefined || v === '' || isNaN(Number(v))) ? null : Number(v);
  const cat = l.category;
  if (cat !== 'boarding' && cat !== 'commercial') {
    const beds = num(d.bedrooms);
    if (beds !== null) out.push(beds === 0 ? 'Studio' : beds + (beds === 1 ? ' bed' : ' beds'));
    const baths = num(d.bathrooms);
    if (baths !== null && baths > 0) out.push(baths + (baths === 1 ? ' bath' : ' baths'));
  }
  const listed = Array.isArray(d.amenities) ? d.amenities : (Array.isArray(l.amenities) ? l.amenities : []);
  const on = k => l[k] === true || d[k] === true || listed.includes(k);
  const short = { has_parking: 'Parking', has_wifi: 'WiFi', has_security: 'Security', has_private_bathroom: 'Private bath', has_balcony: 'Balcony', has_pool: 'Pool', has_gym: 'Gym', has_study_area: 'Study area', has_shared_bathroom: 'Shared bath', has_water: 'Water', has_backup_power: 'Backup power', has_solar: 'Solar' };
  Object.keys(short).forEach(k => { if (out.length < 3 && on(k)) out.push(short[k]); });
  return out;
}
@@@ SHARED_PRE
  const nkPhotoCount = Array.isArray(listing.listing_photos) ? listing.listing_photos.length : 0;
  const nkCamera = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>';
  const overlayHtml = `<span class="card-price-overlay">${formatPrice(listing, { showFromPrefix: !compact })}</span>${nkPhotoCount > 1 ? `<span class="card-photo-count" aria-label="${nkPhotoCount} photos">${nkCamera}${nkPhotoCount}</span>` : ''}`;
  const nkAlt = (nkPhotoCount > 1 && cover) ? [...listing.listing_photos].sort((a, b) => (a.position || 0) - (b.position || 0)).find(p => p !== cover) : null;
  const altImgHtml = (o.priceOverlay && nkAlt) ? `<img class="card-img-alt" data-src="${escHtml(nkImgSrc(nkAlt.url, o.imgWidth))}" alt="" aria-hidden="true" width="${compact ? 400 : 360}" height="${compact ? 300 : 240}"/>` : '';
  const nkMetaCat = `<span class="meta-cat ${escHtml(listing.category)}">${meta.label}</span>`;
  const nkMetaBits = nkCardMeta(listing).map(b => `<span>${escHtml(b)}</span>`).join('');
  const nkShortRoles = { buyer: 'Tenant', owner: 'Owner', landlord: 'Owner', caretaker: 'Caretaker', agent: 'Agent', company: 'Company', seller: 'Lister' };
  const shortRoleText = listedByType ? `${nkShortRoles[listedByType] || 'Lister'}${roleChanged ? ' · unverified' : roleVerified ? ' · checked' : ''}` : 'Lister';
@@@ SHARED_BADGE
        ${altImgHtml}
        ${o.priceOverlay ? overlayHtml : `<span class="badge-cat ${escHtml(listing.category)}">${meta.label}</span>`}
@@@ SHARED_METAROW
<div class="card-sub">${escHtml(subText)}</div>
        ${o.priceOverlay ? `<div class="card-meta">${nkMetaCat}${nkMetaBits}</div>` : ''}
@@@ PEEK_HTML
<div class="hero-peek" id="hero-peek" hidden>
      <div class="hero-peek-head"><span class="hero-peek-title" id="hero-peek-title">Newest listings</span><a class="hero-peek-all" id="hero-peek-all" href="/listings">See all</a></div>
      <div class="hero-peek-row" id="hero-peek-row"></div>
      <p class="hero-peek-note">Every card shows who is listing and the viewing fee.</p>
    </div>
@@@ PICTURE_HTML
<picture>
      <source media="(max-width: 768px)" srcset="/hero-kenya-apartments-800.webp" type="image/webp"/>
      <source srcset="/hero-kenya-apartments.webp" type="image/webp"/>
      <img class="hero-slide active" src="/hero-kenya-apartments.jpg" alt="" width="1672" height="941" decoding="async" fetchpriority="high"/>
    </picture>
@@@ HEAD_PRELOAD
<link rel="preload" as="image" href="/hero-kenya-apartments-800.webp" type="image/webp" media="(max-width: 768px)" fetchpriority="high"/>
  <link rel="preload" as="image" href="/hero-kenya-apartments.webp" type="image/webp" media="(min-width: 769px)" fetchpriority="high"/>
@@@ INDEX_JS
let statsReady = false;
const MIN_COUNTIES_SECTION = 2, MIN_CHECKED_SHOWN = 10, THIN_MIN = 4, THIN_TARGET = 8;

function homeHasPhoto(l) { return !!(l && l.listing_photos && l.listing_photos.length); }
function withPhotosFirst(list) {
  return (list || []).map((l, i) => ({ l, i })).sort((a, b) => (homeHasPhoto(b.l) - homeHasPhoto(a.l)) || (a.i - b.i)).map(x => x.l);
}
function homeWhere(county, area) { return area ? area + (county ? ', ' + nkCountyLabel(county) : '') : (county ? nkCountyLabel(county) : ''); }

async function homeThinFill(listings, county, area, where) {
  const list = withPhotosFirst(listings || []);
  const out = { list, primary: list.length, extra: 0, labels: [] };
  if (list.length >= THIN_MIN || (!county && !area)) return out;
  const seen = new Set(list.map(l => l.id));
  const fetchMore = async (apply, label) => {
    if (out.list.length >= THIN_TARGET) return;
    try {
      let q = db.from('listings').select('*, listing_photos(*)').eq('status', 'active');
      q = apply(q);
      const { data, error } = await q.order('created_at', { ascending: false }).order('id').limit(THIN_TARGET * 2);
      if (error || !data) return;
      let more = withPhotosFirst(data.filter(l => !seen.has(l.id))).slice(0, THIN_TARGET - out.list.length);
      if (!more.length) return;
      try { more = await nkHydratePublicProfiles(more); more = await nkHydrateViewingFees(more); } catch (e) { console.error(e); }
      more.forEach(l => seen.add(l.id));
      out.list = out.list.concat(more); out.extra += more.length; out.labels.push(label);
    } catch (e) { console.error(e); }
  };
  if (area && county) await fetchMore(q => q.eq('county', county).neq('area', area), 'other areas in ' + nkCountyLabel(county));
  const others = NK_TIER1.filter(c => c !== county);
  await fetchMore(q => q.in('county', others), others.map(nkCountyLabel).join(' and '));
  return out;
}

function homeRenderNote(thin, county, area) {
  let note = $('latest-note');
  if (!thin || !thin.extra) { if (note) note.hidden = true; return; }
  if (!note) {
    note = document.createElement('p'); note.id = 'latest-note'; note.className = 'thin-note';
    const anchor = $('latest-listings').closest('.scroll-wrap') || $('latest-listings');
    anchor.parentNode.insertBefore(note, anchor);
  }
  const where = homeWhere(county, area);
  const first = thin.primary === 0 ? 'No listings in ' + where + ' yet.' : 'Only ' + thin.primary + ' listing' + (thin.primary === 1 ? '' : 's') + ' in ' + where + ' so far.';
  note.innerHTML = escHtml(first) + ' Showing popular homes from ' + escHtml(thin.labels.join(', ')) + ' too. <a href="/post-listing">List yours</a>';
  note.hidden = false;
}

function homeRenderPeek(thin, county, area) {
  const box = $('hero-peek'); if (!box) return;
  const withPhoto = ((thin && thin.list) || []).filter(l => nkCardCoverPhoto(l));
  if (withPhoto.length < 2) { box.hidden = true; return; }
  const where = homeWhere(county, area);
  $('hero-peek-title').textContent = thin.extra > 0 ? 'Popular right now' : (where ? 'Newest in ' + where : 'Newest listings');
  $('hero-peek-all').href = nkBuildListingsUrl({ county, area });
  $('hero-peek-row').innerHTML = withPhoto.slice(0, 6).map((l, i) => {
    const c = nkCardCoverPhoto(l);
    return `<a class="peek-card" href="${escHtml(listingHref(l))}" data-listing-id="${escHtml(l.id)}" aria-label="${escHtml(l.title)}"><img src="${escHtml(nkImgSrc(c.url, 360))}" alt="" width="180" height="135" loading="${i < 3 ? 'eager' : 'lazy'}" decoding="async"/><span class="peek-area">${escHtml(l.area)}</span><span class="peek-price">${formatPrice(l)}</span></a>`;
  }).join('');
  box.hidden = false;
}

function homeAfterLatest(thin, county, area) {
  const list = (thin && thin.list) || [];
  const primary = list.slice(0, thin ? thin.primary : 0);
  const pill = $('latest-fresh');
  if (pill) {
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const n = primary.filter(l => l.created_at && new Date(l.created_at).getTime() > weekAgo).length;
    if (n > 0) { pill.textContent = n + (primary.length >= 20 ? '+' : '') + ' new this week'; pill.hidden = false; } else pill.hidden = true;
  }
  homeRenderNote(thin, county, area);
  if (!homeAfterLatest.peeked) { homeAfterLatest.peeked = true; homeRenderPeek(thin, county, area); }
}

async function loadCheckedCount() {
  try {
    const { count, error } = await db.from('public_account_profiles').select('id', { count: 'exact', head: true }).eq('identity_verified', true);
    if (error || !count || count < MIN_CHECKED_SHOWN) return;
    const el = qsa('.trust-item')[1];
    if (el && el.lastChild && el.lastChild.nodeType === 3) el.lastChild.textContent = count.toLocaleString('en-KE') + ' identity-checked listers';
  } catch (e) {}
}

function updateFilterBadge() {
  const b = $('sb-more'); if (!b) return;
  const n = ['search-county', 'search-area', 'search-budget', 'search-beds'].filter(id => { const el = $(id); return el && !el.hidden && el.value !== ''; }).length;
  b.dataset.count = String(n);
}
function syncNavIntent(tab) {
  const inp = $('nav-compact-input'); if (!inp) return;
  inp.placeholder = (tab ? tab.textContent.trim() : 'Rent') + ': area or price…';
}
if ($('sb-filters')) $('sb-filters').addEventListener('change', updateFilterBadge);
if ($('intent-tabs')) $('intent-tabs').addEventListener('click', e => {
  const tab = e.target.closest('.intent-tab');
  if (tab) { syncNavIntent(tab); setTimeout(updateFilterBadge, 0); }
});
syncNavIntent(null); updateFilterBadge();

if (window.matchMedia('(hover: hover)').matches) {
  document.addEventListener('mouseover', e => {
    const card = e.target.closest ? e.target.closest('.card') : null; if (!card) return;
    const alt = card.querySelector('.card-img-alt:not([src])');
    if (!alt || !alt.dataset.src || document.body.classList.contains('nk-datasaver')) return;
    alt.addEventListener('load', () => alt.classList.add('loaded'), { once: true });
    alt.src = alt.dataset.src;
  }, { passive: true });
}
PAYLOADS*/