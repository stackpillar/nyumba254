#!/usr/bin/env node
// Usage:  node patch-home.js index.html     ->  writes index.new.html (your original is not touched)
const fs = require('fs');
const input = process.argv[2] || 'index.html';
const out = input.replace(/\.html$/, '') + '.new.html';
let s = fs.readFileSync(input, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const warn = [];

function rep(label, oldStr, newStr) {
  const n = s.split(oldStr).length - 1;
  if (n !== 1) { warn.push(label + ' (found ' + n + ' matches, expected 1)'); return; }
  s = s.replace(oldStr, () => newStr);
}

/* 1. CSS: compact hero, chip-style categories, tighter sections (appended last so it wins) */
const css = `
    /* ── Homepage v2: listings first ── */
    .hero{min-height:0;padding:36px 32px 40px}
    .hero h1{font-size:clamp(28px,3.6vw,42px);margin-bottom:12px}
    .hero-sub{margin-bottom:18px}
    .hero-quick-row{margin-bottom:0}
    .hero-stats{display:none}
    .section{padding:48px 32px}
    #categories.section{padding:18px 32px 6px}
    #categories .section-header{display:none}
    .categories{gap:10px}
    .categories .cat-card{display:flex;align-items:center;gap:10px;flex:0 0 auto;padding:9px 16px 9px 10px;border-radius:999px;background:#fff;border:1.5px solid var(--border)}
    .categories .cat-card::before{display:none}
    .categories .cat-card:hover{border-color:var(--green);background:var(--green-light);transform:none}
    .categories .cat-card .cat-icon{width:30px;height:30px;margin:0;border-radius:50%;background:var(--green-light)}
    .categories .cat-card .cat-icon svg{width:16px;height:16px;stroke:var(--green-dark)}
    .categories .cat-card .cat-title{font-size:13.5px;margin:0;color:var(--green-dark);white-space:nowrap}
    .categories .cat-card .cat-desc{display:none}
    .categories .cat-card .cat-count{font-size:11.5px;color:var(--text-3);margin:0;white-space:nowrap}
    .categories .cat-card .cat-count:empty{display:none}
    #featured-section,#latest-section{padding-top:28px}
    .sb-more{display:none}
    @media (max-width:768px){.hero{padding:22px 16px 26px}.section{padding:28px 16px}#categories.section{padding:14px 16px 4px}#featured-section,#latest-section{padding-top:20px}.categories .cat-card{flex:0 0 auto;max-width:none}}
    @media (max-width:560px){.hero-sub{display:none}.sb-more{display:block;width:100%;font-size:13px;font-weight:600;color:var(--green-dark);background:var(--green-light);border-radius:8px;min-height:40px}.search-box:not(.open) .sb-filters{display:none}}
`;
rep('css', '</style>', css + '</style>');

/* 2. Hero copy: shorter, Kisumu-first, no eyebrow label */
rep('eyebrow', '<div class="hero-eyebrow">Kisumu · Nairobi · Mombasa</div>', '');
rep('h1', '<h1 id="hero-title">Find your next home<br>anywhere in <span>Kenya</span></h1>', '<h1 id="hero-title">Find your next home in Kisumu and across Kenya</h1>');
rep('hero-sub', "Apartments, houses, boarding rooms, Airbnb rentals, and shops/offices across Kenya's counties. Buyers, owners, caretakers, agents, and companies are welcome.", 'Apartments, houses, boarding rooms and shops. See who is listing and what a viewing costs before you get in touch.');
rep('more-filters', '<div class="sb-filters" id="sb-filters">', '<button type="button" class="sb-more" id="sb-more" aria-expanded="false" aria-controls="sb-filters">More filters</button>\n      <div class="sb-filters" id="sb-filters">');

/* 3. Listings visible immediately: no fade-in on the top sections, no "Loading…" text on chips */
rep('categories-reveal', '<section class="section reveal" id="categories"', '<section class="section" id="categories"');
rep('featured-reveal', '<section class="section section-alt reveal" id="featured-section"', '<section class="section section-alt" id="featured-section"');
rep('latest-reveal', '<section class="section reveal" id="latest-section"', '<section class="section" id="latest-section"');
rep('recent-reveal', '<section class="section reveal nk-recently-viewed"', '<section class="section nk-recently-viewed"');
const before = s;
s = s.replace(/(<div class="cat-count" id="count-\w+">)Loading…(<\/div>)/g, '$1$2');
if (s === before) warn.push('category "Loading…" text (not found)');

/* 4. New section order: hero, category chips, recently viewed, featured, latest, counties, trust, why, how, CTA */
const D = '\u2500\u2500';
const names = ['HERO', 'TRUST BAR', 'RECENTLY VIEWED', 'CATEGORIES', 'FEATURED', 'LATEST', 'COUNTIES', 'WHY NYUMBA254', 'HOW IT WORKS', 'CTA BANNER'];
const mainOpen = '<main id="main-content">';
const a = s.indexOf(mainOpen), b = s.indexOf('</main>');
if (a < 0 || b < 0) {
  warn.push('<main> not found, reorder skipped');
} else {
  const body = s.slice(a + mainOpen.length, b);
  const idx = names.map(n => body.indexOf('<!-- ' + D + ' ' + n));
  if (idx.some(i => i < 0) || idx.some((v, i) => i && v < idx[i - 1])) {
    warn.push('section comments not found in expected order, reorder skipped');
  } else {
    const blocks = idx.map((start, i) => body.slice(start, i + 1 < idx.length ? idx[i + 1] : body.length));
    const order = [0, 3, 2, 4, 5, 6, 1, 7, 8, 9];
    s = s.slice(0, a + mainOpen.length) + '\n\n' + order.map(i => blocks[i]).join('') + '\n' + s.slice(b);
  }
}

/* 5. Page script: instant first paint from the last visit, optional default county, "More filters" toggle */
rep('js-constants',
  "const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;",
  [
    "const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;",
    "const HOME_DEFAULT_COUNTY = '';   // set to 'Kisumu' once Kisumu has about 20 live listings",
    "const NK_CACHE_KEYS = { 'featured-listings': 'nk_home_featured', 'latest-listings': 'nk_home_latest' };",
    "function cacheSave(id, el) { try { const k = NK_CACHE_KEYS[id]; if (!k) return; if (id === 'latest-listings' && (latest.county !== HOME_DEFAULT_COUNTY || latest.area)) return; const h = el.innerHTML; if (h.length < 250000) localStorage.setItem(k, h); } catch (e) {} }",
    "function cacheRestore() { try { Object.keys(NK_CACHE_KEYS).forEach(id => { const h = localStorage.getItem(NK_CACHE_KEYS[id]); if (h && $(id)) $(id).innerHTML = h; }); } catch (e) {} }"
  ].join('\n'));
rep('js-cache-save',
  "if (typeof NKSaved !== 'undefined' && NKSaved.hydrate) NKSaved.hydrate(el);",
  "cacheSave(containerId, el);\n  if (typeof NKSaved !== 'undefined' && NKSaved.hydrate) NKSaved.hydrate(el);");
rep('js-keep-cached',
  "$('latest-listings').innerHTML = SKELETON; syncLatestLink();",
  "const keepCached = !loadLatest.done && $('latest-listings').querySelector('.listings-grid'); loadLatest.done = true;\n  if (!keepCached) $('latest-listings').innerHTML = SKELETON;\n  syncLatestLink();");
rep('js-boot',
  "loadStats(); loadFeatured(); setLatestCounty(''); renderRecentlyViewed(); loadReviews();",
  "cacheRestore(); refreshScrollHints();\n  loadStats(); loadFeatured(); setLatestCounty(HOME_DEFAULT_COUNTY); renderRecentlyViewed(); loadReviews();");
rep('js-more-filters',
  "$('nk-nearme-btn').addEventListener('click', heroNearMe);",
  "$('nk-nearme-btn').addEventListener('click', heroNearMe);\n  const moreBtn = $('sb-more');\n  if (moreBtn) moreBtn.addEventListener('click', () => { const box = moreBtn.closest('.search-box'); const open = box.classList.toggle('open'); moreBtn.setAttribute('aria-expanded', String(open)); moreBtn.textContent = open ? 'Fewer filters' : 'More filters'; });");

/* 6. Safety check: every $('id') the page script uses must still exist in the markup */
const ids = new Set([...s.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
const used = [...new Set([...s.matchAll(/\$\('([\w-]+)'\)/g)].map(m => m[1]))];
const missing = used.filter(i => !ids.has(i) && i !== 'more-areas-pill');

fs.writeFileSync(out, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Wrote ' + out);
console.log(warn.length ? 'NOT APPLIED:\n - ' + warn.join('\n - ') : 'All edits applied.');
console.log(missing.length ? 'MISSING IDS (would break the page): ' + missing.join(', ') : 'ID check passed: every element the script uses still exists.');
