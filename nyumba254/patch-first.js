const fs = require('fs');
const htmlFile = process.argv[2] || 'index.html';
const consentFile = process.argv[3] || 'nk-consent.js';
const done = [], skipped = [];

function load(f) { const raw = fs.readFileSync(f, 'utf8'); const crlf = raw.includes('\r\n'); return { text: crlf ? raw.replace(/\r\n/g, '\n') : raw, crlf }; }
function save(f, o) { fs.writeFileSync(f, o.crlf ? o.text.replace(/\n/g, '\r\n') : o.text); }
function swap(o, from, to, label) {
  if (o.text.includes(to)) { skipped.push(label + ' (already applied)'); return; }
  if (!o.text.includes(from)) { skipped.push(label + ' (text not found)'); return; }
  o.text = o.text.replace(from, () => to); done.push(label);
}

/* ===== index.html ===== */
const h = load(htmlFile);

// 2. Trust bar moves up, directly under the hero
{
  const t = h.text.indexOf('<div class="trust-bar">');
  const c = h.text.indexOf('<section class="section" id="categories"');
  if (t < 0 || c < 0) skipped.push('Trust bar move (not found)');
  else if (t < c) skipped.push('Trust bar move (already applied)');
  else {
    const end = h.text.indexOf('<!--', t);
    const block = h.text.slice(t, end).trimEnd();
    h.text = h.text.slice(0, t) + h.text.slice(end);
    const c2 = h.text.indexOf('<section class="section" id="categories"');
    h.text = h.text.slice(0, c2) + block + '\n\n' + h.text.slice(c2);
    done.push('Trust bar moved under the hero');
  }
}

// 1. Counties: hide empty ones behind a "Show all counties" button
swap(h,
  "  refreshScrollHints();\n}\nfunction renderFooterCounties() {",
  `  const hasAny = Object.keys(countyCounts).some(k => countyCounts[k] > 0);
  grid.classList.toggle('hide-empty', hasAny);
  const mb = $('more-counties-btn');
  if (mb) {
    mb.hidden = !hasAny;
    mb.textContent = grid.classList.contains('show-all') ? 'Show fewer counties' : 'Show all counties';
    if (!mb.dataset.bound) {
      mb.dataset.bound = '1';
      mb.addEventListener('click', () => {
        const on = grid.classList.toggle('show-all');
        mb.textContent = on ? 'Show fewer counties' : 'Show all counties';
        refreshScrollHints();
      });
    }
  }
  refreshScrollHints();
}
function renderFooterCounties() {`,
  'Empty counties hidden behind a button');
swap(h,
  '<div class="quicklinks" id="popular-area-links"></div>',
  '<button type="button" class="more-counties-btn" id="more-counties-btn" hidden>Show all counties</button>\n  <div class="quicklinks" id="popular-area-links"></div>',
  'Show all counties button');

// 4. Hero image: smaller WebP for phones (only if the file exists)
if (fs.existsSync('hero-kenya-apartments-800.webp')) {
  swap(h,
    'src="/hero-kenya-apartments.jpg" alt=""',
    'src="/hero-kenya-apartments.jpg" srcset="/hero-kenya-apartments-800.webp 800w, /hero-kenya-apartments.jpg 1672w" sizes="100vw" alt=""',
    'Hero image srcset');
} else {
  skipped.push('Hero srcset (create hero-kenya-apartments-800.webp first, then run this script again)');
}

// 6 + styles
const css = `
    /* First impression v1 */
    .areas.hide-empty:not(.show-all) .area-card.zero-listings, .areas.hide-empty:not(.show-all) .area-card.coming-soon { display: none; }
    .more-counties-btn { display: block; margin: 14px 0 0; font-size: 13.5px; font-weight: 600; color: var(--green-dark); background: #fff; border: 1.5px solid var(--green); border-radius: 20px; min-height: 40px; padding: 0 18px; }
    .more-counties-btn:hover { background: var(--green-light); }
    .card-role { color: var(--text-3); font-size: 11.5px; }
    @media (max-width: 768px) {
      .trust-bar { flex-wrap: nowrap; overflow-x: auto; justify-content: flex-start; gap: 8px; padding: 10px 16px; scrollbar-width: none; }
      .trust-bar::-webkit-scrollbar { display: none; }
      .trust-item { flex: 0 0 auto; white-space: nowrap; font-size: 12.5px; background: #fff; border: 1px solid #9FE1CB; border-radius: 20px; padding: 6px 12px; }
    }
`;
if (h.text.includes('First impression v1')) skipped.push('Styles (already applied)');
else {
  const i = h.text.lastIndexOf('</style>');
  if (i < 0) { console.log('NOTHING WRITTEN: no </style> found in ' + htmlFile); process.exit(1); }
  h.text = h.text.slice(0, i) + css + '  ' + h.text.slice(i);
  done.push('Styles (trust chips, county button, lighter role text)');
}
save(htmlFile, h);

/* ===== nk-consent.js ===== */
// 3. Cookie banner: sits above the tab bar, smaller and shorter
try {
  const c = load(consentFile);
  swap(c, 'bottom:calc(12px + env(safe-area-inset-bottom))', 'bottom:calc(var(--nk-tabbar-h, env(safe-area-inset-bottom, 0px)) + 10px)', 'Cookie banner above tab bar');
  swap(c, 'padding:16px 18px;', 'padding:12px 14px;', 'Cookie banner padding');
  swap(c, '#nk-consent button{min-height:44px;', '#nk-consent button{min-height:40px;', 'Cookie banner buttons');
  swap(c,
    '<p>We use essential storage to keep you signed in and remember your settings. With your permission we would also use analytics and show ads. Nothing optional loads until you choose.</p>',
    '<p>We use essential storage for sign-in and settings. With your permission we also use analytics and ads. Nothing optional loads until you choose.</p>',
    'Cookie banner shorter text');
  save(consentFile, c);
} catch (e) { skipped.push('Cookie banner (could not open ' + consentFile + ')'); }

console.log('Applied: ' + (done.length ? done.join('; ') : 'nothing'));
if (skipped.length) console.log('Skipped: ' + skipped.join('; '));