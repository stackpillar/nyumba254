#!/usr/bin/env node
/*
 * Nyumba254: add the listing link to the WhatsApp message on the LISTINGS (search results) page cards
 * and in its enquiry popup.
 *
 *   node apply-listings-wa-link.js              -> patches ./listings.html or ./listings
 *   node apply-listings-wa-link.js path/to/listings
 *   node apply-listings-wa-link.js --dry
 *   node apply-listings-wa-link.js --revert
 *
 * Backup: <file>.bak-walink. Running twice is blocked. Nothing is written if the edit point is not found exactly once.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');
const given = args.find(a => !a.startsWith('--'));
const target = given || ['listings.html', 'listings'].find(f => fs.existsSync(f));
if (!target || !fs.existsSync(target)) {
  console.error('Could not find the listings file (not listing). Pass its path: node apply-listings-wa-link.js path/to/listings');
  process.exit(1);
}
const backup = target + '.bak-walink';

if (REVERT) {
  if (!fs.existsSync(backup)) { console.error('No backup found: ' + backup); process.exit(1); }
  fs.copyFileSync(backup, target);
  console.log('Restored ' + target + ' from ' + backup);
  process.exit(0);
}

const src = fs.readFileSync(target, 'utf8');
if (src.includes('NK-CARD-WA-LINK')) { console.error('Already patched. Use --revert first to re-apply.'); process.exit(1); }

const find = "const text = `Hi, I'm interested in \"${l.title}\" (ref #${pad(l.listing_number)}) on Nyumba254. Is it still available?`;";
const repl = "/* NK-CARD-WA-LINK */ const text = `Hi, I'm interested in \"${l.title}\" (ref #${pad(l.listing_number)}) on Nyumba254. Is it still available?\\n${SITE}${listingHref(l)}`;";

const n = src.split(find).length - 1;
if (n !== 1) {
  console.error('Patch NOT applied: expected 1 match for the WhatsApp message line, found ' + n + '. Make sure you are patching the listings page, not the listing page.');
  process.exit(1);
}
if (DRY) { console.log('Dry run OK: edit point matched. Nothing written.'); process.exit(0); }

if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, src.split(find).join(repl), 'utf8');
console.log('Patched ' + path.resolve(target));
console.log('Backup:  ' + path.resolve(backup));
console.log('Undo with: node apply-listings-wa-link.js --revert');
