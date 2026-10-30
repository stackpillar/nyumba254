#!/usr/bin/env node
/*
  Nyumba254 - listings patch
  --------------------------------------------------------------
  Edits your EXISTING files in place. No new script is added to the page.
    - listings.html
    - nk-listings-polish.js   (also accepts the spaced name "nk listings polish.js")

  Usage (run from the folder that holds listings.html, or pass the folder):
    node apply-listings-patch.js
    node apply-listings-patch.js path/to/site
    node apply-listings-patch.js --dry-run     show what would change, write nothing
    node apply-listings-patch.js --revert      restore the backups
    node apply-listings-patch.js --no-syntax-check

  Safety:
    - A backup "<file>.bak-nkpatch" is made once before the first write.
    - Every edit is matched by an anchor. If an anchor is missing the edit is
      skipped and reported, nothing is guessed.
    - The patched JavaScript is syntax-checked before a file is written.
    - Safe to run twice: edits that are already applied are reported as "already".
*/
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const VERSION = '20261031a';
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
function findHtml() {
  const isFile = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
  const dirs = [root, path.join(root, 'public')];
  try {
    fs.readdirSync(root, { withFileTypes: true }).forEach(d => {
      if (d.isDirectory() && !/^(node_modules|\.git)$/.test(d.name)) dirs.push(path.join(root, d.name));
    });
  } catch (e) {}
  for (const d of dirs) {
    for (const n of ['listings.html', 'listings']) {
      const p = path.join(d, n);
      if (isFile(p)) return p;
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
function fixTags(html) {
  const res = [];
  let s = html;
  const patchRe = /^[ \t]*<script\s+src="\/patch\.js[^"]*"\s*><\/script>[ \t]*\n/m;
  if (patchRe.test(s)) { s = s.replace(patchRe, ''); res.push(['applied', 'remove <script src="/patch.js"> (dashboard script, does nothing on this page)']); }
  else res.push(['already', 'no /patch.js tag']);

  const tagRe = /<script\s+src="\/nk(?:[ _-]|%20)listings(?:[ _-]|%20)polish\.js[^"]*"\s*><\/script>/i;
  const tag = '<script src="/nk-listings-polish.js?v=' + VERSION + '"></script>';
  const m = s.match(tagRe);
  if (m && m[0] === tag) res.push(['already', 'polish script tag']);
  else if (m) { s = s.replace(tagRe, () => tag); res.push(['applied', 'polish script tag -> /nk-listings-polish.js?v=' + VERSION]); }
  else if (s.includes('</body>')) { s = s.replace('</body>', () => tag + '\n</body>'); res.push(['applied', 'polish script tag added before </body>']); }
  else res.push(['missing', 'polish script tag (no </body> found)']);
  return { text: s, res };
}
function printRes(title, res) {
  log('\n' + title);
  res.forEach(r => log(ICON[r[0]] + ' ' + r[1]));
}

/* ---------- main ---------- */
(function main() {
  const htmlP = findHtml();
  if (!htmlP) { console.error('Could not find the listings page ("listings" or "listings.html") in ' + root + ', its public/ folder or its sub-folders. Run this from your site folder or pass the folder path.'); process.exit(1); }
  const dir = path.dirname(htmlP);
  const hyP = path.join(dir, 'nk-listings-polish.js');
  const spP = path.join(dir, 'nk listings polish.js');

  if (REVERT) {
    const restore = p => { if (fs.existsSync(p + BAK)) { fs.copyFileSync(p + BAK, p); fs.unlinkSync(p + BAK); log('restored ' + path.basename(p)); return true; } return false; };
    restore(htmlP);
    if (restore(spP)) { if (fs.existsSync(hyP)) fs.unlinkSync(hyP); } else restore(hyP);
    log('Revert done.');
    return;
  }

  const names = fs.readdirSync(dir);
  let polP = null, rename = false;
  if (names.includes('nk-listings-polish.js')) polP = hyP;
  else { const alt = names.find(n => /^nk[ _]listings[ _]polish\.js$/i.test(n)); if (alt) { polP = path.join(dir, alt); rename = true; } }
  if (!polP) { console.error('nk-listings-polish.js (or "nk listings polish.js") not found next to listings.html.'); process.exit(1); }

  const edits = parseData();
  let failed = false;
  log('Folder: ' + dir + (DRY ? '   (dry run, nothing will be written)' : ''));

  /* listings.html */
  const H = load(htmlP);
  const hRun = runEdits(H.text, edits.filter(e => e.file === 'html'));
  const hTags = fixTags(hRun.text);
  const hAll = hRun.res.concat(hTags.res);
  printRes(path.basename(htmlP), hAll);

  /* polish script */
  const P = load(polP);
  const pRun = runEdits(P.text, edits.filter(e => e.file === 'polish'));
  printRes(path.basename(polP) + (rename ? '  (will be renamed to nk-listings-polish.js)' : ''), pRun.res);

  if (hAll.concat(pRun.res).some(r => r[0] === 'missing' || r[0] === 'ambiguous')) failed = true;

  const hChanged = hTags.text !== H.text;
  const pChanged = pRun.text !== P.text;

  let hOk = true, pOk = true;
  if (hChanged) {
    const before = syntaxErrors('html', H.text).length, after = syntaxErrors('html', hTags.text);
    if (after.length > before) { hOk = false; failed = true; log('\nlistings.html NOT written, patched script has a syntax error:\n  ' + after.join('\n  ')); }
  }
  if (pChanged || rename) {
    const before = syntaxErrors('js', P.text).length, after = syntaxErrors('js', pRun.text);
    if (after.length > before) { pOk = false; failed = true; log('\n' + path.basename(polP) + ' NOT written, patched script has a syntax error:\n  ' + after.join('\n  ')); }
  }

  if (!DRY) {
    if (hChanged && hOk) { backup(htmlP); save(htmlP, hTags.text, H.crlf); }
    if ((pChanged || rename) && pOk) {
      backup(polP);
      save(hyP, pRun.text, P.crlf);
      if (rename) fs.unlinkSync(polP);
    }
  }

  log('\n' + (DRY ? 'Dry run finished.' : 'Done.') + (failed ? ' Some edits were skipped, see MISSING / AMBIGUOUS / NOT written above.' : ' All edits applied or already present.'));
  if (!DRY && (hChanged || pChanged)) log('Next: hard refresh the page (Ctrl+Shift+R). If you use the service worker, close and reopen the tab once.\nUndo any time with: node apply-listings-patch.js --revert');
  process.exit(failed ? 1 : 0);
})();

/*@@DATA
=== polish | shared css: nav logo, button wrap, card rows
--- FIND
html.nk-lp #recent-mount{margin-top:28px}
--- REPLACE
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
=== polish | desktop hover only on real hover devices
--- FIND
html.nk-lp .listings-grid .card:hover,html.nk-lp .listings-grid .card.is-hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(15,110,86,.15)}
--- REPLACE
html.nk-lp .listings-grid .card.is-hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(15,110,86,.15)}
  @media (hover:hover){html.nk-lp .listings-grid .card:hover{transform:translateY(-3px);box-shadow:0 14px 32px rgba(15,110,86,.15)}}
=== polish | mobile: listed-ago in area row, hide badge and spacer
--- FIND
html.nk-lp .card-verified-badge,html.nk-lp .lp-cat,html.nk-lp .lp-ago{display:none}
--- REPLACE
html.nk-lp .card-verified-badge,html.nk-lp .lp-cat{display:none}
  html.nk-lp .lp-ago{margin-left:auto;font-size:10px;font-weight:600;letter-spacing:0;text-transform:none;color:var(--text-3)}
  html.nk-lp .lp-ago-l{display:none}
  html.nk-lp .lp-trust-br{display:none}
=== polish | mobile: hide address line
--- FIND
html.nk-lp .card-sub{display:block;font-size:11px;margin-bottom:5px}
--- REPLACE
html.nk-lp .card-sub{display:none}
=== polish | mobile: smaller price text for long prices
--- FIND
html.nk-lp .lp-price span{font-size:10px}
--- REPLACE
html.nk-lp .lp-price span{font-size:10px}
  html.nk-lp .lp-price.lp-m1{font-size:12px}
  html.nk-lp .lp-price.lp-m2{font-size:11px}
=== polish | mobile: specs line cuts whole items, never half words
--- FIND
html.nk-lp .lp-kl-specs{flex:1 1 auto;min-width:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
--- REPLACE
html.nk-lp .lp-kl-specs{flex:1 1 auto;min-width:0;display:flex;flex-wrap:wrap;overflow:hidden;max-height:1.35em;white-space:nowrap}
  html.nk-lp .lp-kl-s{flex:none;white-space:nowrap}
  html.nk-lp .lp-kl-s+.lp-kl-s::before{content:"·";margin:0 4px}
=== polish | mobile: remove ago from specs line
--- FIND
html.nk-lp .lp-kl-ago{flex:none;font-size:10px;color:var(--text-3)}
--- REPLACE
html.nk-lp .lp-kl-ago{display:none}
=== polish | mobile: compare becomes a small icon on the photo
--- FIND
html.nk-lp .nk-compare-check{display:inline-flex;order:2;align-self:flex-start;min-height:30px;padding:0 2px;border:0;background:none;border-radius:8px;font-size:11px;gap:5px}
  html.nk-lp .nk-compare-check input{width:15px;height:15px}
  html.nk-lp .nk-compare-check:has(input:checked){background:none}
--- REPLACE
html.nk-lp .nk-compare-check{position:absolute;top:46px;right:6px;z-index:4;display:flex;align-items:center;justify-content:center;width:30px;height:30px;min-height:0;padding:0;margin:0;border:0;border-radius:50%;background:rgba(255,255,255,.92);box-shadow:0 1px 4px rgba(0,0,0,.25);font-size:0;gap:0;color:var(--text-2)}
  html.nk-lp .nk-compare-check::before{content:"";width:16px;height:16px;background:currentColor;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 2v20'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 3H5a2 2 0 00-2 2v14a2 2 0 002 2h3M16 3h3a2 2 0 012 2v14a2 2 0 01-2 2h-3M12 2v20'/%3E%3C/svg%3E") center/contain no-repeat}
  html.nk-lp .nk-compare-check input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
  html.nk-lp .nk-compare-check span{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
  html.nk-lp .nk-compare-check:has(input:checked){background:var(--green);color:#fff}
  html.nk-lp .nk-compare-check:has(input:focus-visible){outline:2px solid var(--green);outline-offset:2px}
=== polish | mobile: 44px touch targets (buttons)
--- FIND
html.nk-lp .card-inquire-btn,html.nk-lp .card-wa-btn{min-height:38px;font-size:12px;padding:0 6px;border-radius:10px}
--- REPLACE
html.nk-lp .card-inquire-btn,html.nk-lp .card-wa-btn{min-height:44px;font-size:12px;padding:0 6px;border-radius:10px}
=== polish | mobile: 44px touch targets (message button)
--- FIND
html.nk-lp .card-msg-btn{display:flex;width:38px;min-height:38px;border-radius:10px}
--- REPLACE
html.nk-lp .card-msg-btn{display:flex;width:44px;min-height:44px;border-radius:10px}
=== polish | mobile: smaller chat button
--- FIND
.lp-discover{display:none}
--- REPLACE
.lp-discover{display:none}
  .nk-chat-fab{scale:.82;transform-origin:100% 100%}
=== polish | short role: show "unverified"
--- FIND
.replace(/\s*\(not verified\)/i, '')
--- REPLACE
.replace(/\s*\(not verified\)/i, ' · unverified')
=== polish | listed-ago: months and years instead of hiding after 30 days
--- FIND
return d < 30 ? d + 'd ago' : '';
--- REPLACE
if (d < 30) return d + 'd ago';
    if (d < 365) return Math.floor(d / 30) + 'mo ago';
    return Math.floor(d / 365) + 'y ago';
=== polish | listed-ago: two-part text so phones can show just "15d ago"
--- FIND
a.textContent = t ? 'Listed ' + (t === 'Just now' ? 'just now' : t) : '';
--- REPLACE
a.textContent = '';
      if (t) {
        var al = document.createElement('span');
        al.className = 'lp-ago-l';
        al.textContent = 'Listed ';
        a.appendChild(al);
        a.appendChild(document.createTextNode(t === 'Just now' ? 'just now' : t));
      }
=== polish | wrap area name so it truncates cleanly
--- FIND
var area = body.querySelector('.card-area');
--- REPLACE
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
=== polish | long price gets a smaller font class
--- FIND
ov.innerHTML = priceEl.innerHTML;
--- REPLACE
ov.innerHTML = priceEl.innerHTML;
        var plen = priceEl.textContent.trim().length;
        if (plen >= 17) ov.classList.add('lp-m2'); else if (plen >= 14) ov.classList.add('lp-m1');
=== polish | move verified badge next to the role, even fee line
--- FIND
role.appendChild(s);
--- REPLACE
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
=== polish | specs as separate items
--- FIND
ks.textContent = chips.slice(0, 3).join(' · ');
--- REPLACE
chips.slice(0, 3).forEach(function (c) {
        var si = document.createElement('span');
        si.className = 'lp-kl-s';
        si.textContent = c;
        ks.appendChild(si);
      });
=== html | hover lift only on real hover devices
--- FIND
.card:hover, .card.is-hover { transform: translateY(-4px); box-shadow: 0 10px 32px rgba(15,110,86,.18); }
--- REPLACE
.card.is-hover { transform: translateY(-4px); box-shadow: 0 10px 32px rgba(15,110,86,.18); }
    @media (hover: hover) { .card:hover { transform: translateY(-4px); box-shadow: 0 10px 32px rgba(15,110,86,.18); } }
=== html | scroll-to-results ignores the auto-hidden nav
--- FIND
#results-start { scroll-margin-top: calc(var(--nav-h) + 60px); }
--- REPLACE
#results-start { scroll-margin-top: calc(64px + 60px); }
=== html | carousel starts on the cover photo (no more 4/7 on first view)
--- FIND
const sortedPhotos = l => (l.listing_photos || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
--- REPLACE
const sortedPhotos = l => {
  const p = (l.listing_photos || []).slice().sort((a, b) => (a.position || 0) - (b.position || 0));
  const c = nkCardCoverPhoto(l), i = c ? p.indexOf(c) : -1;
  if (i > 0) { p.splice(i, 1); p.unshift(c); }
  return p;
};
=== html | first photos load eagerly, not lazily
--- FIND
${i === 0 ? 'fetchpriority="high"' : 'loading="lazy"'}
--- REPLACE
${i === 0 ? 'fetchpriority="high"' : (i > 0 && i < 4 ? '' : 'loading="lazy"')}
=== html | amenities: two variants (desktop 2 chips, phone 1 chip + count)
--- FIND
return `<div class="card-amenities">${labels.slice(0, 2).map(x => `<span class="card-amenity-chip">${escHtml(x)}</span>`).join('')}${extra > 0 ? `<span class="card-amenity-chip more">+${extra} more</span>` : ''}</div>`;
--- REPLACE
const chip = (x, cls) => `<span class="card-amenity-chip${cls ? ' ' + cls : ''}">${escHtml(x)}</span>`;
  return `<div class="card-amenities">${chip(labels[0])}${labels[1] ? chip(labels[1], 'am-d-only') : ''}${extra > 0 ? `<span class="card-amenity-chip more am-d-only">+${extra} more</span>` : ''}${labels.length > 1 ? `<span class="card-amenity-chip more am-m-only">+${labels.length - 1} more</span>` : ''}</div>`;
=== html | css for the amenity variants
--- FIND
.card-amenity-chip.more { background: var(--surface); color: var(--text-3); border: 1px solid var(--border); }
--- REPLACE
.card-amenity-chip.more { background: var(--surface); color: var(--text-3); border: 1px solid var(--border); }
    .am-m-only { display: none; }
    @media (max-width: 768px) { .am-d-only { display: none; } .am-m-only { display: inline-block; } }
@@ENDDATA*/