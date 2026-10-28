#!/usr/bin/env node
// Usage:  node patch-cards.js listings.html  ->  writes listings.new.html (original is not touched)
const fs = require('fs');
const vm = require('vm');
const input = process.argv[2] || 'listings.html';
const out = input;
let s = fs.readFileSync(input, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const warn = [];

// Multi-line string helper: the text between /*! and */ is taken literally (backticks and ${} are safe).
const raw = fn => fn.toString().replace(/^[^]*?\/\*!/, '').replace(/\*\/[^]*$/, '').trim();

function rep(label, oldStr, newStr) {
  const n = s.split(oldStr).length - 1;
  if (n !== 1) { warn.push(label + ' (found ' + n + ' matches, expected 1)'); return; }
  s = s.replace(oldStr, () => newStr);
}

/* 1. CSS: appended last so it wins. Photo overlays (badges, arrows, counter, heart) are NOT touched. */
const css = raw(() => {/*!

    .card-img{aspect-ratio:3/2}
    .skeleton-img{aspect-ratio:3/2}
    .card-body{padding:12px 14px 12px}
    .card-area{margin-bottom:4px}
    .card-title{font-size:15px;line-height:1.3;margin-bottom:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}
    .card-sub{font-size:12.5px;margin-bottom:6px}
    .card-price{font-size:18px;line-height:1.25;margin-bottom:6px}
    .card-trust{display:flex;flex-wrap:wrap;align-items:center;gap:4px 8px;margin-bottom:8px;font-size:12px;line-height:1.35}
    .card-role{color:var(--text-2);font-weight:500}
    .card-viewing-fee{display:inline-block;max-width:100%;font-size:11.5px;font-weight:700;line-height:1.35;padding:2px 9px;border-radius:20px;background:var(--surface);border:1px solid var(--border);color:var(--text-2)}
    .card-viewing-fee.free{background:var(--green-light);border-color:#9FE1CB;color:var(--green-dark)}
    .card-specs-chips{gap:5px;margin-bottom:8px}
    .card-spec-chip{padding:3px 8px;font-size:11.5px}
    .card-meta{margin-bottom:8px}
    .card-roomtypes{margin-bottom:8px}
    .card-amenities{flex-wrap:nowrap;overflow:hidden;gap:5px;margin-bottom:10px;padding-top:8px}
    .card-amenity-chip{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 8px}
    .card-amenity-chip.more{flex:none}
    .card-foot{gap:6px;padding-top:2px}
    .nk-compare-check,.card-inquire-btn,.card-wa-btn,.card-msg-btn{min-height:38px}
    .nk-compare-check{padding:0 9px;font-size:12px}
    .card-msg-btn{width:42px}
    @media (max-width:768px){
      .nk-compare-check,.card-inquire-btn,.card-wa-btn,.card-msg-btn{min-height:44px}
      .card-msg-btn{width:46px}
      .card-body{padding:12px 14px 14px}
    }
*/});
rep('css', '</style>', css + '\n  </style>');

/* 2. Remove the old role + viewing-fee lines (two big text rows) */
{
  const a = s.indexOf('<div class="card-role" title=');
  const endMark = "'Free viewing'}</div>";
  const b = a < 0 ? -1 : s.indexOf(endMark, a);
  const seg = (a >= 0 && b >= 0) ? s.slice(a, b + endMark.length) : '';
  if (!seg || seg.includes('card-price') || seg.length > 700) warn.push('role/fee lines (not found or unexpected shape)');
  else s = s.slice(0, a) + s.slice(b + endMark.length);
}

/* 3. Price right under the title/address, then ONE compact trust line (role + viewing fee) */
const trust = raw(() => {/*!
<div class="card-trust" title="Role claims are self-declared. Identity checks do not verify property ownership or authority to list."><span class="card-role">${escHtml(roleText)}</span><span class="card-viewing-fee${viewingFee===0?' free':''}">${viewingFee===null?'Viewing fee: confirm with the lister':viewingFee>0?'Viewing fee: KES '+viewingFee.toLocaleString('en-KE'):'Free viewing'}</span></div>
*/});
const priceLine = '<div class="card-price">${formatPrice(l, { showFromPrefix: true })}</div>';
rep('price+trust', priceLine, priceLine + '\n      ' + trust);

/* 4. Amenities: filtered ones first, max 2 chips + "+N more" on a single row */
rep('amen-order', 'const list = Array.isArray(l.amenities) ? l.amenities : [];',
  'const rawAm = Array.isArray(l.amenities) ? l.amenities : [], want = S.amen || [];\n  const list = [...rawAm.filter(k => want.includes(k)), ...rawAm.filter(k => !want.includes(k))];');
rep('amen-extra', 'const extra = labels.length - 3;', 'const extra = labels.length - 2;');
rep('amen-slice', 'labels.slice(0, 3).map(x =>', 'labels.slice(0, 2).map(x =>');

/* 5. Photo size hint matches the new 3:2 ratio (CSS still controls the real size; src/lazy-load/swipe untouched) */
rep('img-hint', 'width="360" height="270"', 'width="360" height="240"');

/* 6. Safety: the page script must still compile */
const scripts = [...s.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const main = scripts.find(t => t.includes('LISTING_SELECT'));
let syntax = 'Page script compiles OK.';
try { if (!main) throw new Error('main script not found'); new vm.Script(main); }
catch (e) { syntax = 'SYNTAX PROBLEM, do not use this output: ' + e.message; }

if (s.includes('.card-trust{display:flex') && warn.length === 0 && !syntax.startsWith('SYNTAX')) {
  fs.writeFileSync(out, crlf ? s.replace(/\n/g, '\r\n') : s);
  console.log('Updated ' + out + ' in place.');
  console.log('All edits applied.');
  console.log(syntax);
} else {
  console.log('NOTHING WRITTEN, your file is unchanged.');
  if (warn.length) console.log('NOT APPLIED:\n - ' + warn.join('\n - '));
  console.log(syntax);
  process.exit(1);
}