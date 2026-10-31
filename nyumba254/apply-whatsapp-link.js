#!/usr/bin/env node
/*
 * Nyumba254: add the listing link to the WhatsApp message
 *
 *   node apply-whatsapp-link.js              -> patches ./listing.html or ./listing
 *   node apply-whatsapp-link.js path/to/file
 *   node apply-whatsapp-link.js --dry        -> check only
 *   node apply-whatsapp-link.js --revert     -> restore backup
 *
 * The WhatsApp message becomes:
 *   Hello, I saw your listing "<title>" (ref #000123) on Nyumba254. Is it still available?
 *   https://nyumba254.com/listing?id=000123
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');
const given = args.find(a => !a.startsWith('--'));
const target = given || ['listing.html', 'listing'].find(f => fs.existsSync(f));
if (!target || !fs.existsSync(target)) {
  console.error('Could not find the listing file. Pass its path: node apply-whatsapp-link.js path/to/listing');
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
if (src.includes('NK-WA-LINK')) { console.error('Already patched. Use --revert first to re-apply.'); process.exit(1); }

const find = "const url=`https://wa.me/${n.replace('+','')}?text=${encodeURIComponent(`Hello, I saw your listing \"${P.title}\" (ref ${shortRef()}) on Nyumba254. Is it still available?`)}`;";
const repl = "/* NK-WA-LINK */const listingLink=location.origin+'/listing?id='+pad(P.listing_number);\n    const url=`https://wa.me/${n.replace('+','')}?text=${encodeURIComponent(`Hello, I saw your listing \"${P.title}\" (ref ${shortRef()}) on Nyumba254. Is it still available?\\n${listingLink}`)}`;";

const count = src.split(find).length - 1;
if (count !== 1) {
  console.error('Patch NOT applied: expected 1 match for the WhatsApp line, found ' + count + '. The file may differ from the expected version.');
  process.exit(1);
}
if (DRY) { console.log('Dry run OK: anchor matched. Nothing written.'); process.exit(0); }

if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, src.split(find).join(repl), 'utf8');
console.log('Patched ' + path.resolve(target));
console.log('Backup:  ' + path.resolve(backup));
console.log('Undo with: node apply-whatsapp-link.js --revert');
