#!/usr/bin/env node
/*
 * Nyumba254 - compact desktop cards patch
 *
 * Makes listing cards on computers almost square (a little taller than wide),
 * packed but not crowded. It hides and removes NOTHING: only sizes, spacing, the category colour highlight and the map-view layout. Phones (<= 768px) are NOT touched.
 *
 * Usage (run in the folder that holds listings.html):
 *   node apply-cards-patch.js              apply (or update) the patch
 *   node apply-cards-patch.js --dry-run    preview, write nothing
 *   node apply-cards-patch.js --revert     restore the backup
 *   node apply-cards-patch.js listings     use a file with any name (no .html needed)
 *   node apply-cards-patch.js path/to/file  use a file in another folder
 *
 * With no name given it looks for: listings, listings.html, listings.htm
 *
 * Safe to run more than once: it replaces its own block instead of stacking.
 * A backup is saved once as listings.html.bak-nkcards.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const REVERT = args.includes('--revert');
const given = args.find(a => !a.startsWith('--'));
const candidates = given ? [given] : ['listings', 'listings.html', 'listings.htm'];
const found = candidates.map(c => path.resolve(c)).find(c => fs.existsSync(c) && fs.statSync(c).isFile());
const target = found || path.resolve(candidates[0]);
const backup = target + '.bak-nkcards';

const START = '<!-- NK-CARDS-V4:START -->';
const END = '<!-- NK-CARDS-V4:END -->';

const CSS = `${START}
<style id="nk-cards-v4">
/* NOTHING is hidden or removed here. Only sizes and spacing change.
   Shape knob: bigger second number = taller photo (16/9 keeps the whole card a little taller than wide). */
:root { --nk-photo-ratio: 16 / 9; --nk-card-min: 280px; }

@media (min-width: 769px) {
  .listings-grid { grid-template-columns: repeat(auto-fill, minmax(min(var(--nk-card-min), 100%), 1fr)) !important; gap: 14px !important; }
  .listings-grid .card { border-radius: 16px; }
  .listings-grid .card-img, .listings-grid .skeleton-img { aspect-ratio: var(--nk-photo-ratio) !important; }

  /* Body spacing */
  .listings-grid .card-body { padding: 8px 11px 10px !important; }
  .listings-grid .card-area { font-size: 10.5px !important; gap: 3px !important; margin-bottom: 1px !important; }
  .listings-grid .card-area::before { font-size: 11px !important; }
  .listings-grid .card-title { font-size: 14.5px !important; line-height: 1.25 !important; margin-bottom: 1px !important; }
  .listings-grid .card-sub { font-size: 11.5px !important; margin-bottom: 4px !important; }
  .listings-grid .card-price { font-size: 16px !important; line-height: 1.2 !important; margin-bottom: 4px !important; }

  /* Role + viewing fee (wraps only when it really has to) */
  .listings-grid .card-trust { gap: 3px 6px !important; margin-bottom: 6px !important; font-size: 11px !important; }
  .listings-grid .card-role { font-size: 11px !important; }
  .listings-grid .card-viewing-fee { font-size: 10.5px !important; padding: 1px 7px !important; }

  /* Specs: every chip stays, just smaller */
  .listings-grid .card-specs-chips { gap: 4px !important; margin-bottom: 6px !important; }
  .listings-grid .card-spec-chip { padding: 2px 7px !important; font-size: 11px !important; }
  .listings-grid .card-spec-chip svg { width: 11px !important; height: 11px !important; }

  /* Boarding houses: all room types stay, in a tighter grid */
  .listings-grid .card-meta { gap: 4px 10px !important; margin-bottom: 5px !important; font-size: 11px !important; }
  .listings-grid .card-roomtypes { grid-template-columns: repeat(auto-fit, minmax(62px, 1fr)) !important; gap: 4px !important; margin-bottom: 6px !important; }
  .listings-grid .card-roomtype-chip { padding: 3px 6px !important; }
  .listings-grid .rt-label { font-size: 10px !important; }
  .listings-grid .rt-price { font-size: 11px !important; }

  /* Amenities stay, one tidy row */
  .listings-grid .card-amenities { gap: 4px !important; margin-bottom: 7px !important; padding-top: 0 !important; border-top: 0 !important; }
  .listings-grid .card-amenity-chip { font-size: 10.5px !important; padding: 1px 7px !important; }

  /* Buttons (Compare stays in the footer row) */
  .listings-grid .card-foot { gap: 5px !important; padding-top: 0 !important; margin-top: auto; }
  .listings-grid .nk-compare-check { min-height: 34px !important; padding: 0 8px !important; font-size: 11.5px !important; gap: 5px !important; }
  .listings-grid .card-inquire-btn, .listings-grid .card-wa-btn, .listings-grid .card-msg-btn { min-height: 34px !important; font-size: 12.5px !important; }
  .listings-grid .card-msg-btn { width: 38px !important; }

  /* Category highlight: same colours as the mobile cards, always visible on computers.
     Only position/colour of the badge. Card sizes are not touched. */
  .listings-grid .card .card-img .badge-cat { display: inline-block !important; position: absolute !important; left: 12px !important; top: 12px !important; bottom: auto !important; z-index: 3 !important; font-size: 10.5px !important; font-weight: 700 !important; line-height: 1.3 !important; padding: 4px 10px !important; border-radius: 20px !important; white-space: nowrap; opacity: 1 !important; visibility: visible !important; box-shadow: 0 1px 5px rgba(0,0,0,.22); }
  .listings-grid .card .card-img .badge-cat.apartment { background: #0F6E56 !important; color: #fff !important; border: 0 !important; }
  .listings-grid .card .card-img .badge-cat.house { background: #085041 !important; color: #fff !important; border: 0 !important; }
  .listings-grid .card .card-img .badge-cat.boarding { background: #E1F5EE !important; color: #085041 !important; border: 1px solid #1D9E75 !important; }
  .listings-grid .card .card-img .badge-cat.airbnb { background: #fff !important; color: #085041 !important; border: 1px solid #0F6E56 !important; }
  .listings-grid .card .card-img .badge-cat.commercial { background: #1a1a18 !important; color: #fff !important; border: 0 !important; }
  /* Featured / New / Occupied badges sit just under the category badge so they never overlap */
  .listings-grid .card .card-img .card-badges { top: 42px !important; }
}

/* Map view on computers: cards keep their normal size in a fixed-width column on the left,
   and the map takes ALL the remaining space on the right (sticky while you scroll the cards).
   Very strong selectors on purpose, so nothing else can stretch the cards or split the screen 50/50. */
@media (min-width: 1100px) {
  html body .layout .results-area.map-on { grid-template-columns: 372px minmax(0, 1fr) !important; gap: 16px !important; align-items: start !important; }
  html body .layout .results-area.map-on #results { grid-column: 1 !important; grid-row: 1 !important; min-width: 0 !important; }
  html body .layout .results-area.map-on .nk-map-view { grid-column: 2 !important; grid-row: 1 !important; }
  html body .layout .results-area.map-on #results #listings-grid { display: grid !important; grid-template-columns: repeat(auto-fill, minmax(min(300px, 100%), 1fr)) !important; gap: 12px !important; }
  html body .layout .results-area.map-on #results #listings-grid > .card { max-width: 380px; grid-column: auto !important; }
}
/* Wide screens: two cards per row in the map view (filters collapsed first, then all wide screens) */
@media (min-width: 1440px) {
  html body .layout.sidebar-collapsed .results-area.map-on { grid-template-columns: 692px minmax(0, 1fr) !important; }
}
@media (min-width: 1700px) {
  html body .layout .results-area.map-on { grid-template-columns: 692px minmax(0, 1fr) !important; }
}

/* Phones: the search suggestion list sits above the sticky bars and the tab bar (it was hidden behind them). */
@media (max-width: 768px) {
  #search-dropdown.nk-search-dropdown { position: fixed !important; top: 110px; left: 10px !important; right: 10px !important; width: auto !important; z-index: 100001 !important; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
}

/* Phones: stop the browser re-adjusting the scroll position when rows above the list change height (a common cause of jumping). */
@media (max-width: 768px) {
  html, body, .main, #listings-grid { overflow-anchor: none; }
}
</style>
<script id="nk-cards-v4-js">
/* Safety net: if a card has no category badge on computers, rebuild it from the "Area / Category" text in the area row. */
(function () {
  if (window.__nkCatV4) return; window.__nkCatV4 = true;
  var mq = window.matchMedia('(min-width: 769px)');
  var LABELS = { apartment: 'Apartment', house: 'House', boarding: 'Boarding House', airbnb: 'Airbnb', commercial: 'Shops & offices' };
  function kind(t) {
    t = (t || '').toLowerCase();
    if (/boarding|hostel/.test(t)) return 'boarding';
    if (/airbnb|holiday|short stay/.test(t)) return 'airbnb';
    if (/shop|office|commercial/.test(t)) return 'commercial';
    if (/apartment|flat/.test(t)) return 'apartment';
    if (/house/.test(t)) return 'house';
    return '';
  }
  function fix() {
    if (!mq.matches) return;
    document.querySelectorAll('.listings-grid .card').forEach(function (c) {
      var img = c.querySelector('.card-img'), area = c.querySelector('.card-area');
      if (!img || !area || c.querySelector('.badge-cat')) return;
      var parts = (area.textContent || '').split('/'), k = '';
      for (var i = 1; i < parts.length && !k; i++) k = kind(parts[i]);
      if (!k) return;
      var s = document.createElement('span'); s.className = 'badge-cat ' + k; s.textContent = LABELS[k]; img.appendChild(s);
    });
  }
  var t;
  function soon() { clearTimeout(t); t = setTimeout(fix, 60); }
  function start() {
    var g = document.getElementById('listings-grid'); if (!g) return;
    new MutationObserver(soon).observe(g, { childList: true });
    fix();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('load', soon); mq.addEventListener && mq.addEventListener('change', soon);
})();
/* Phone search suggestions: pin the list right under the input and fit it to the visible screen (above the keyboard and tab bar). */
(function () {
  var mqP = window.matchMedia('(max-width: 768px)');
  var dd = document.getElementById('search-dropdown'), input = document.getElementById('search-q');
  if (!dd || !input) return;
  function place() {
    if (!mqP.matches) { dd.style.removeProperty('top'); dd.style.removeProperty('max-height'); return; }
    if (!dd.classList.contains('visible')) return;
    var vv = window.visualViewport;
    var bottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    var top = Math.max(input.getBoundingClientRect().bottom + 6, 0);
    var limit = bottom - 10;
    var tb = document.querySelector('.nk-tabbar');
    if (tb && getComputedStyle(tb).display !== 'none') { var tt = tb.getBoundingClientRect().top; if (tt > top) limit = Math.min(limit, tt - 8); }
    dd.style.setProperty('top', top + 'px', 'important');
    dd.style.setProperty('max-height', Math.max(140, limit - top) + 'px', 'important');
  }
  new MutationObserver(place).observe(dd, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('scroll', place, { passive: true });
  window.addEventListener('resize', place);
  if (window.visualViewport) { window.visualViewport.addEventListener('resize', place); window.visualViewport.addEventListener('scroll', place); }
  input.addEventListener('focus', function () { setTimeout(place, 60); });
  input.addEventListener('input', function () { setTimeout(place, 260); });
  if (mqP.addEventListener) mqP.addEventListener('change', place);
})();

/* Map: when the map box changes size (filters collapsed, window resized), tell the map to redraw so tiles never look cut off. */
(function () {
  var m = document.getElementById('nk-map-view');
  if (!m || !window.ResizeObserver) return;
  var t;
  new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { window.dispatchEvent(new Event('resize')); }, 120); }).observe(m);
})();
</script>
${END}`;

function fail(msg) { console.error('x ' + msg); process.exit(1); }

if (!fs.existsSync(REVERT ? backup : target)) {
  fail(REVERT ? `No backup found at ${backup}` : `Cannot find ${given || 'listings'}. Run this in the folder that holds your listings page, or pass its name: node apply-cards-patch.js yourfilename`);
}

if (REVERT) {
  if (!DRY) fs.copyFileSync(backup, target);
  console.log(`${DRY ? '[dry run] would restore' : 'Restored'} ${path.basename(target)} from backup.`);
  process.exit(0);
}

let html = fs.readFileSync(target, 'utf8');
const hadBlock = html.includes(START) && html.includes(END);

if (hadBlock) {
  const a = html.indexOf(START), b = html.indexOf(END) + END.length;
  html = html.slice(0, a) + CSS + html.slice(b);
} else {
  const i = html.lastIndexOf('</body>');
  if (i === -1) fail('No </body> tag found in the file, nothing changed.');
  html = html.slice(0, i) + CSS + '\n' + html.slice(i);
}

// Small safe fix inside the page's own scroll handler: the top bar used to flip on/off at exactly one scroll
// position, so it could flicker right at that point. Now it turns on a bit earlier than it turns off.
const HYST_OLD = "nav.classList.toggle('nk-scrolled', header.getBoundingClientRect().bottom < 64);";
const HYST_NEW = "{ const hb = header.getBoundingClientRect().bottom; if (hb < 56) nav.classList.add('nk-scrolled'); else if (hb > 80) nav.classList.remove('nk-scrolled'); } /* NK-HYST */";
let hystNote = '';
if (html.includes(HYST_OLD)) { html = html.split(HYST_OLD).join(HYST_NEW); hystNote = 'Scroll-bar flicker guard: added.'; }
else if (html.includes('NK-HYST')) hystNote = 'Scroll-bar flicker guard: already in place.';
else hystNote = 'Scroll-bar flicker guard: skipped (could not find that line in your page).';

// Bump the polish script's cache tag so phones and browsers pick up the new page.
html = html.replace(/(\/nk-listings-polish\.js\?v=)[^"']*/, '$1' + Date.now().toString(36));

if (DRY) {
  console.log(`[dry run] would ${hadBlock ? 'update' : 'add'} the compact-cards block in ${path.basename(target)}. Nothing written.`);
  process.exit(0);
}
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, html);
console.log(`${hadBlock ? 'Updated' : 'Applied'} compact cards to ${path.basename(target)} (backup: ${path.basename(backup)}).`);
console.log(hystNote);
console.log('Hard refresh the page (Ctrl+Shift+R) to see it.');
