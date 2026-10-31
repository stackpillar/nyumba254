#!/usr/bin/env node
/*
  Nyumba254 - saved page patch ("Your Shortlist")
  --------------------------------------------------------------
  Edits your EXISTING saved page in place so its cards match the
  improved listings cards. No new script is added to the page.
    - saved  (or saved.html)

  Usage (run from the folder that holds the saved page, or pass the folder):
    node apply-saved-patch.js
    node apply-saved-patch.js path/to/site
    node apply-saved-patch.js --dry-run     show what would change, write nothing
    node apply-saved-patch.js --revert      restore the backup
    node apply-saved-patch.js --no-syntax-check

  Safety: backup "<file>.bak-nkpatch" made once; every edit is anchor-matched
  (missing anchors are skipped and reported); patched inline JS is syntax-checked
  before writing; safe to run twice.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const BAK = '.bak-nkpatch';
const OPEN = '/*' + '@@DATA';
const CLOSE = '@@ENDDATA' + '*/';

const args = process.argv.slice(2);
const has = f => args.includes(f);
const DRY = has('--dry-run');
const REVERT = has('--revert');
const NOSYNTAX = has('--no-syntax-check');
const root = path.resolve(args.filter(a => !a.startsWith('--'))[0] || process.cwd());

const log = (...a) => console.log(...a);
const ICON = { applied: '  [applied] ', already: '  [already] ', missing: '  [MISSING] ', ambiguous: '  [AMBIGUOUS]' };

/* ---------- helpers ---------- */
function findSaved() {
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
  const dirs = [root, path.join(root, 'public')];
  try {
    fs.readdirSync(root, { withFileTypes: true }).forEach(d => {
      if (d.isDirectory() && !/^(node_modules|\.git)$/.test(d.name)) dirs.push(path.join(root, d.name));
    });
  } catch (e) {}
  for (const d of dirs) {
    for (const n of ['saved.html', 'saved']) {
      const p = path.join(d, n);
      if (isFile(p)) {
        try { if (/buildRecommendedCard/.test(fs.readFileSync(p, 'utf8'))) return p; } catch (e) {}
      }
    }
  }
  return null;
}
function load(p) {
  const raw = fs.readFileSync(p, 'utf8');
  return { text: raw.replace(/\r\n/g, '\n'), crlf: raw.includes('\r\n') };
}
function save(p, text, crlf) {
  fs.writeFileSync(p, crlf ? text.replace(/\n/g, '\r\n') : text, 'utf8');
}
function backup(p) {
  if (fs.existsSync(p) && !fs.existsSync(p + BAK)) fs.copyFileSync(p, p + BAK);
}
function fuzzy(find) {
  const esc = find.trim().replace(/[.*+?^${}()|[\]\\\/]/g, '\\$&');
  return new RegExp(esc.replace(/\s+/g, '\\s+'), 'g');
}
function parseData() {
  const src = fs.readFileSync(__filename, 'utf8').replace(/\r\n/g, '\n');
  const a = src.indexOf(OPEN), b = src.lastIndexOf(CLOSE);
  if (a < 0 || b < 0) throw new Error('Patch data block not found in this file.');
  const edits = [];
  let cur = null, mode = null;
  for (const line of src.slice(a + OPEN.length, b).split('\n')) {
    const m = line.match(/^=== (\w+) \| (.+)$/);
    if (m) { cur = { file: m[1], name: m[2].trim(), find: [], replace: [] }; edits.push(cur); mode = null; continue; }
    if (line === '--- FIND') { mode = 'find'; continue; }
    if (line === '--- REPLACE') { mode = 'replace'; continue; }
    if (cur && mode) cur[mode].push(line);
  }
  edits.forEach(e => { e.find = e.find.join('\n').trim(); e.replace = e.replace.join('\n').trim(); });
  return edits;
}
function runEdits(text, list) {
  const res = [];
  for (const e of list) {
    const re = fuzzy(e.find), single = new RegExp(re.source);
    const count = (text.match(re) || []).length;
    if (count > 0) {
      if (e.replace && single.test(e.replace) && text.includes(e.replace)) { res.push(['already', e.name]); continue; }
      if (count > 1) { res.push(['ambiguous', e.name + ' (' + count + ' matches)']); continue; }
      text = text.replace(re, () => e.replace);
      res.push(['applied', e.name]);
    } else if (text.includes(e.replace)) res.push(['already', e.name]);
    else res.push(['missing', e.name]);
  }
  return { text, res };
}
function syntaxErrors(kind, text) {
  if (NOSYNTAX) return [];
  const errs = [];
  if (kind === 'js') {
    try { new vm.Script(text); } catch (e) { errs.push(e.message); }
  } else {
    const re = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
    let m;
    while ((m = re.exec(text))) {
      if (/\bsrc\s*=/.test(m[1]) || /json/i.test(m[1]) || !m[2].trim()) continue;
      try { new vm.Script(m[2]); } catch (e) { errs.push(e.message); }
    }
  }
  return errs;
}
function printRes(title, res) {
  log('\n' + title);
  res.forEach(r => log(ICON[r[0]] + ' ' + r[1]));
}

(function main() {
  const p = findSaved();
  if (!p) { console.error('Could not find the saved page ("saved" or "saved.html") in ' + root + ', its public/ folder or its sub-folders. Run this from your site folder or pass the folder path.'); process.exit(1); }
  if (REVERT) {
    if (fs.existsSync(p + BAK)) { fs.copyFileSync(p + BAK, p); fs.unlinkSync(p + BAK); log('restored ' + path.basename(p)); }
    else log('No backup found for ' + path.basename(p));
    log('Revert done.');
    return;
  }
  log('File: ' + p + (DRY ? '   (dry run, nothing will be written)' : ''));
  const H = load(p);
  const run = runEdits(H.text, parseData());
  printRes(path.basename(p), run.res);
  let failed = run.res.some(r => r[0] === 'missing' || r[0] === 'ambiguous');
  const changed = run.text !== H.text;
  let ok = true;
  if (changed) {
    const before = syntaxErrors('html', H.text).length, after = syntaxErrors('html', run.text);
    if (after.length > before) { ok = false; failed = true; log('\n' + path.basename(p) + ' NOT written, patched script has a syntax error:\n  ' + after.join('\n  ')); }
  }
  if (!DRY && changed && ok) { backup(p); save(p, run.text, H.crlf); }
  log('\n' + (DRY ? 'Dry run finished.' : 'Done.') + (failed ? ' Some edits were skipped, see MISSING / AMBIGUOUS / NOT written above.' : ' All edits applied or already present.'));
  if (!DRY && changed && ok) log('Next: hard refresh the page (Ctrl+Shift+R).\nUndo any time with: node apply-saved-patch.js --revert');
  process.exit(failed ? 1 : 0);
})();

/*@@DATA
=== html | hover lift only on real hover devices
--- FIND
.card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px var(--shadow); }
--- REPLACE
@media (hover: hover) { .card:hover { transform: translateY(-2px); box-shadow: 0 4px 20px var(--shadow); } }

=== html | photo arrows: hover only on real hover devices
--- FIND
.card:hover .photo-nav, .photo-nav:focus-visible { opacity: 1; }
--- REPLACE
.photo-nav:focus-visible { opacity: 1; }
    @media (hover: hover) { .card:hover .photo-nav { opacity: 1; } }

=== html | card CSS (price on photo, area + category line, mobile specs, touch targets)
--- FIND
.side-section { margin-top: 36px; padding-top: 24px; }
    }
  </style>
--- REPLACE
.side-section { margin-top: 36px; padding-top: 24px; }
    }

    .card-img::after { content: ""; position: absolute; left: 0; right: 0; bottom: 0; height: 46%; background: linear-gradient(to top, rgba(0,0,0,.58), rgba(0,0,0,0)); pointer-events: none; z-index: 1; }
    .card.unavailable .card-img::after { display: none; }
    .lp-price { position: absolute; left: 10px; bottom: 9px; z-index: 2; color: #fff; font-weight: 800; font-size: 17px; line-height: 1.15; letter-spacing: -.01em; text-shadow: 0 1px 3px rgba(0,0,0,.6); max-width: calc(100% - 64px); pointer-events: none; }
    .lp-price span { font-size: 11.5px; font-weight: 600; color: rgba(255,255,255,.9); }
    .card-media:has(.sel-box) .lp-price { left: 50px; }
    .card:not(.unavailable) .card-price { display: none; }
    .card-top-row { min-width: 0; }
    .card-area { flex-wrap: nowrap; min-width: 0; overflow: hidden; }
    .lp-area-name { min-width: 0; flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .lp-cat { flex: 0 0 auto; white-space: nowrap; text-transform: none; letter-spacing: 0; font-weight: 600; font-size: 11px; color: var(--text-3); }
    .lp-cat::before { content: "\00b7"; margin-right: 6px; color: var(--text-3); }
    .card-area .card-verified-badge { flex: none; }
    @media (hover: none) {
      .remove-heart-btn:hover { background: rgba(255,255,255,.95); border-color: var(--border); }
      .remove-heart-btn:hover svg { transform: none; }
    }
    @media screen and (max-width: 768px) {
      .lp-price { left: 8px; bottom: 7px; font-size: 14.5px; max-width: calc(100% - 16px); }
      .lp-price span { font-size: 10.5px; }
      .card-media:has(.sel-box) .lp-price { left: 40px; }
      .card-img::after { height: 55%; }
      .lp-cat { display: none; }
      .remove-heart-btn::before, .add-heart-btn::before { content: ""; position: absolute; inset: -7px; }
      .card-meta { display: flex; gap: 4px 10px; font-size: 11px; padding-top: 0; border-top: 0; margin-bottom: 6px; }
      #listings-grid .card-meta-item:only-child:not(:has(svg)), #unavail-grid .card-meta-item:only-child:not(:has(svg)) { display: none; }
      .card-actions .act-btn { min-height: 40px; }
    }
  </style>

=== html | saved card: price on the photo
--- FIND
const mediaInner = `<div class="card-img">${imgHtml}${verifiedTag}${overlay}</div>`;
--- REPLACE
const priceTag = off ? '' : `<span class="lp-price">${nkFormatPriceLike(l.price, l.price_frequency)}</span>`;
  const mediaInner = `<div class="card-img">${imgHtml}${verifiedTag}${overlay}${priceTag}</div>`;

=== html | saved card: category beside area
--- FIND
${reorder}
        <div class="card-top-row">
          <div class="card-area">${escHtml(l.area)} ${nkBuildVerifiedBadge(l)}</div>
          <span class="card-cat-pill ${escHtml(l.category)}">${escHtml(catLabel)}</span>
        </div>
--- REPLACE
${reorder}
        <div class="card-top-row">
          <div class="card-area"><span class="lp-area-name">${escHtml(l.area)}</span><span class="lp-cat">${escHtml(catLabel)}</span>${nkBuildVerifiedBadge(l)}</div>
        </div>

=== html | recommended/recent card: price on the photo
--- FIND
<div class="card-img">${imgHtml}${l.is_admin_verified ? '<span class="badge-featured">Reviewed by Nyumba254</span>' : ''}</div>
--- REPLACE
<div class="card-img">${imgHtml}${l.is_admin_verified ? '<span class="badge-featured">Reviewed by Nyumba254</span>' : ''}<span class="lp-price">${nkFormatPriceLike(l.price, l.price_frequency)}</span></div>

=== html | recommended/recent card: category beside area
--- FIND
<div class="card-body">
        <div class="card-top-row">
          <div class="card-area">${escHtml(l.area)} ${nkBuildVerifiedBadge(l)}</div>
          <span class="card-cat-pill ${escHtml(l.category)}">${escHtml(catLabel)}</span>
        </div>
--- REPLACE
<div class="card-body">
        <div class="card-top-row">
          <div class="card-area"><span class="lp-area-name">${escHtml(l.area)}</span><span class="lp-cat">${escHtml(catLabel)}</span>${nkBuildVerifiedBadge(l)}</div>
        </div>
@@ENDDATA*/
