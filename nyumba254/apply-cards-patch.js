#!/usr/bin/env node
/*
 * Nyumba254 - compact desktop cards patch
 *
 * Makes listing cards on computers almost square (a little taller than wide),
 * packed but not crowded. Phones (<= 768px) are NOT touched.
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
/* Tweak the shape here: bigger second number = taller photo. 16/11 keeps the whole card just taller than wide. */
:root { --nk-photo-ratio: 16 / 11; --nk-card-min: 270px; }

@media (min-width: 769px) {
  /* Grid: 3-4 columns depending on width */
  .listings-grid { grid-template-columns: repeat(auto-fill, minmax(min(var(--nk-card-min), 100%), 1fr)) !important; gap: 14px !important; }
  .listings-grid .card { border-radius: 16px; }

  /* Photo */
  .listings-grid .card-img { aspect-ratio: var(--nk-photo-ratio) !important; }
  .listings-grid .skeleton-img { aspect-ratio: var(--nk-photo-ratio) !important; }

  /* Body: tighter, one line per row */
  .listings-grid .card-body { padding: 9px 12px 11px !important; }
  .listings-grid .card-area { flex-wrap: nowrap !important; white-space: nowrap; overflow: hidden; margin-bottom: 1px !important; font-size: 10.5px !important; }
  .listings-grid .card-area::before { display: none !important; }
  .listings-grid .card-title { font-size: 14.5px !important; line-height: 1.3 !important; -webkit-line-clamp: 1 !important; margin-bottom: 5px !important; }
  .listings-grid .card-sub { display: none !important; }              /* address repeats area + title */
  .listings-grid .card-price { font-size: 16px !important; margin-bottom: 4px !important; }

  /* Role + viewing fee on ONE line, fee never squeezed */
  .listings-grid .card-trust { flex-wrap: nowrap !important; gap: 6px !important; margin-bottom: 7px !important; align-items: center; }
  .listings-grid .card-role { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11.5px !important; }
  .listings-grid .card-viewing-fee { flex: none !important; white-space: nowrap !important; font-size: 11px !important; padding: 1px 8px !important; }

  /* Specs: one row, max 3 whole chips (never a half-cut word) */
  .listings-grid .card-specs-chips { flex-wrap: nowrap !important; overflow: hidden; gap: 5px !important; margin-bottom: 8px !important; }
  .listings-grid .card-spec-chip { flex: none; white-space: nowrap; }
  .listings-grid .card-spec-chip:nth-child(n+4) { display: none !important; }

  /* Boarding houses: compact meta + two room types */
  .listings-grid .card-meta { flex-wrap: nowrap !important; overflow: hidden; white-space: nowrap; margin-bottom: 6px !important; }
  .listings-grid .card-roomtypes { margin-bottom: 8px !important; }
  .listings-grid .card-roomtype-chip:nth-child(n+3) { display: none !important; }

  /* Amenities are on the listing page */
  .listings-grid .card-amenities { display: none !important; }

  /* Buttons stay pinned to the bottom so every card lines up */
  .listings-grid .card-foot { margin-top: auto; padding-top: 0 !important; }
  .listings-grid .card-inquire-btn, .listings-grid .card-wa-btn, .listings-grid .card-msg-btn { min-height: 36px !important; }

  /* Compare becomes a small round tick on the photo (next to the heart) */
  .listings-grid .nk-compare-check { position: absolute !important; top: 10px; right: 52px; z-index: 5; width: 30px; height: 30px; min-height: 30px !important; padding: 0 !important; justify-content: center; border-radius: 50%; background: rgba(255,255,255,.94) !important; box-shadow: 0 1px 6px rgba(0,0,0,.2); }
  .listings-grid .nk-compare-check span { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; }
  .listings-grid .nk-compare-check input { width: 16px; height: 16px; margin: 0; }
}
</style>
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

// Bump the polish script's cache tag so phones and browsers pick up the new page.
html = html.replace(/(\/nk-listings-polish\.js\?v=)[^"']*/, '$1' + Date.now().toString(36));

if (DRY) {
  console.log(`[dry run] would ${hadBlock ? 'update' : 'add'} the compact-cards block in ${path.basename(target)}. Nothing written.`);
  process.exit(0);
}
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, html);
console.log(`${hadBlock ? 'Updated' : 'Applied'} compact cards to ${path.basename(target)} (backup: ${path.basename(backup)}).`);
console.log('Hard refresh the page (Ctrl+Shift+R) to see it.');