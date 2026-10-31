#!/usr/bin/env node
/*
 * Nyumba254: compact listing page patch
 *
 * Usage (from the folder that holds your listing file):
 *   node apply-listing-compact.js              -> patches ./listing.html, or ./listing if that is the name
 *   node apply-listing-compact.js path/to/listing
 *   node apply-listing-compact.js --dry        -> checks every anchor, writes nothing
 *   node apply-listing-compact.js --revert     -> restores the backup
 *
 * Safe by design: every anchor must match exactly once, otherwise NOTHING is written.
 * A backup "<file>.bak-compact" is created the first time. Running twice is blocked.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');
const given = args.find(a => !a.startsWith('--'));
const target = given || ['listing.html', 'listing'].find(f => fs.existsSync(f));
if (!target || !fs.existsSync(target)) {
  console.error('Could not find the listing file. Pass its path: node apply-listing-compact.js path/to/listing');
  process.exit(1);
}
const backup = target + '.bak-compact';

if (REVERT) {
  if (!fs.existsSync(backup)) { console.error('No backup found: ' + backup); process.exit(1); }
  fs.copyFileSync(backup, target);
  console.log('Restored ' + target + ' from ' + backup);
  process.exit(0);
}

let src = fs.readFileSync(target, 'utf8');
const MARK = 'NK-COMPACT-PATCH';
if (src.includes(MARK)) { console.error('Already patched (' + MARK + ' found). Use --revert first to re-apply.'); process.exit(1); }

/* ───────────── 1. SOURCE EDITS (each anchor must occur exactly once) ───────────── */
const edits = [];
const edit = (name, find, repl) => edits.push({ name, find, repl });

/* Hero overlay on the photo: price bottom-left, status + viewing fee underneath */
edit('hero overlay helper',
  "function galleryHtml(){",
  "function heroOverlay(){const st=availState(),fee=viewingFeeText(P.viewing_fee);return '<div class=\"ghero\"><div class=\"ghero-price\">'+priceHtml()+'</div><div class=\"ghero-sub\"><span class=\"ghero-dot '+st.k+'\"></span>'+escHtml(st.t)+' · '+escHtml(fee)+'</div></div>'}\nfunction galleryHtml(){");

edit('hero overlay (phone carousel)',
  "${arrows}${count}<span class=\"gheart\">${heart}</span></div></div>",
  "${arrows}${count}${heroOverlay()}<span class=\"gheart\">${heart}</span></div></div>");

edit('hero overlay (desktop mosaic)',
  "<div class=\"gm-main\" id=\"gm-main\">${tileBtn(order[0],true)}${arrows}${count}</div>",
  "<div class=\"gm-main\" id=\"gm-main\">${tileBtn(order[0],true)}${arrows}${count}${heroOverlay()}</div>");

/* "Copy link" shortcut becomes "Video walkthrough" (only shown when the listing has a video) */
edit('copy link -> video walkthrough button',
  "<button type=\"button\" class=\"qtool\" data-act=\"copy\" data-url=\"${escHtml(listingUrl)}\">Copy link</button>",
  "${((P.listing_videos||[])[0]||{}).url?'<button type=\"button\" class=\"qtool qtool-video\" data-act=\"video-jump\">▶ Video walkthrough</button>':''}");

edit('video-jump click handler',
  "case 'map-jump':{const sec=$('sec-loc');",
  "case 'video-jump':{const sec=$('sec-video');if(sec){sec.scrollIntoView({behavior:'smooth',block:'start'});const pb=sec.querySelector('[data-act=\"vid\"]');if(pb)setTimeout(()=>pb.click(),450)}else toast('No video walkthrough for this listing yet.');break}\n    case 'map-jump':{const sec=$('sec-loc');");

edit('Video link in section nav',
  "if(am.length)anchors.push(['sec-amen','Amenities']);",
  "if(am.length)anchors.push(['sec-amen','Amenities']);if(((P.listing_videos||[])[0]||{}).url)anchors.push(['sec-video','Video']);");

/* ───────────── 2. COMPACT CSS ───────────── */
const CSS = `
/* ${MARK} v1 */
/* page rhythm */
.wrap{padding-top:8px;padding-bottom:40px}
.topbar{margin-bottom:8px;min-height:40px}
.chip{min-height:38px;padding:0 13px}
.backlink{min-height:38px}
.layout{gap:24px}
.reach{margin-bottom:10px;padding:8px 12px}
.notice{margin-bottom:10px;padding:8px 12px}

/* gallery: shorter, with the price on the photo */
.gallery{margin-bottom:12px}
.gmosaic{height:clamp(240px,29vw,370px);gap:4px}
.gtrack{aspect-ratio:16/11;max-height:min(46vh,340px)}
.gm-main .gcount{top:12px;bottom:auto;left:12px;right:auto}
.gcount{z-index:4}
.gall{min-height:38px;padding:0 13px;font-size:13px;right:12px;bottom:12px}
.gnav{width:34px;height:34px}
.ghero{position:absolute;left:0;right:0;bottom:0;z-index:3;display:flex;flex-direction:column;gap:2px;padding:48px 16px 12px;color:#fff;pointer-events:none;background:linear-gradient(180deg,rgba(0,0,0,0),rgba(0,0,0,.66))}
.ghero-price{font-family:'Playfair Display',serif;font-size:clamp(22px,5.4vw,30px);font-weight:700;line-height:1.1;letter-spacing:-.01em;text-shadow:0 1px 6px rgba(0,0,0,.5);overflow-wrap:anywhere}
.ghero-price small{font-family:'Inter',sans-serif;font-size:13px;font-weight:500;color:rgba(255,255,255,.9)}
.ghero-price .price-req{font-size:.62em}
.ghero-sub{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:rgba(255,255,255,.96);text-shadow:0 1px 4px rgba(0,0,0,.5)}
.ghero-dot{flex:0 0 8px;width:8px;height:8px;border-radius:50%;background:#4ade80}
.ghero-dot.bad{background:#f87171}.ghero-dot.soon{background:#fbbf24}
.gcar{border-radius:14px}
/* the price now lives on the photo, so the big duplicate under the title is kept for screen readers only */
.main-col:has(.ghero)>.price{position:absolute;width:1px;height:1px;margin:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}

/* header block */
.pills{margin-bottom:8px;gap:6px}
.pill{font-size:12px;padding:3px 10px}
h1.title{font-size:clamp(20px,4.6vw,27px);line-height:1.22;margin-bottom:4px}
.loc{font-size:13.5px;margin-bottom:8px}
.loc svg{margin-top:3px}
.pdrop{margin-top:0;margin-bottom:6px;padding:4px 10px;font-size:12.5px}
.cost{font-size:13px;margin-bottom:10px}
.price+.strip{margin-top:0}
.strip{margin-bottom:10px;border-radius:12px}
.strip .f{padding:8px 6px}
.strip .f svg{width:18px;height:18px;margin-bottom:2px}
.strip b{font-size:clamp(13px,3.4vw,15px)}
.strip span{font-size:11.5px}
.meta{gap:6px 14px;padding-bottom:10px;margin-bottom:10px;font-size:12.5px}
/* highlights: availability and viewing fee are already on the photo, keep Reference + Posted */
.insight-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:8px 0 4px}
.insight:nth-child(2),.insight:nth-child(3){display:none}
.insight{padding:6px 10px;border-radius:8px}
.insight b{font-size:13px}
.insight span{font-size:11.5px;margin-top:0}

/* quick tools: one swipeable row, video walkthrough first */
.quick-tools{flex-wrap:nowrap;gap:6px;margin:8px 0 4px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch}
.quick-tools::-webkit-scrollbar{display:none}
.quick-tools .qtool{flex:0 0 auto;min-height:34px;padding:0 12px;font-size:12.5px;white-space:nowrap}
.quick-tools .qtool-video{order:-1;background:var(--green);border-color:var(--green);color:#fff}
.quick-tools .qtool-video:hover{background:var(--green-dark);border-color:var(--green-dark);color:#fff}
.afford{margin-top:8px;padding:6px 12px}

/* phone action row */
.inline-cta{gap:6px;margin-bottom:10px}
.inline-cta .btn,.inline-cta .vbtn{min-height:42px}
.ctabar .btn{min-height:44px}

/* section nav and cards */
.anchors{margin-bottom:10px}
.anchors a{min-height:34px;padding:0 12px;font-size:13px}
.sec{padding:16px 18px;margin-bottom:10px;border-radius:14px}
.sec h2{font-size:16px;gap:8px;margin-bottom:10px}
.hic{width:28px;height:28px;border-radius:8px}
@media(max-width:480px){.sec{padding:14px}}
.dgrid{grid-template-columns:repeat(auto-fill,minmax(min(150px,100%),1fr));gap:8px}
.dgrid>div{padding:8px 11px}
.dgrid dd{font-size:14px}
.chips{gap:6px}
.achip{padding:5px 10px 5px 8px;font-size:13px}
.desc{font-size:14.5px;line-height:1.65}
.urow{padding:10px 0}
.occ{margin-top:12px;padding-top:12px}
.mapbox{height:220px}
.bnbcard{padding:10px 14px;margin-bottom:10px}

/* contact card (right column on desktop) */
.scard{padding:16px;border-radius:14px}
.s-top{padding-bottom:10px;margin-bottom:10px}
.s-price{font-size:22px}
.seller{gap:10px;margin-bottom:10px}
.av{width:40px;height:40px;font-size:14px}
.cbtns,.or{margin-bottom:10px}
.scard .nf-field{margin-bottom:10px}
.scard .nf-field label{margin-bottom:4px}
.scard .nf-field input,.scard .nf-field select{min-height:42px;padding-top:8px;padding-bottom:8px}
.scard .nf-field textarea{min-height:64px;padding-top:8px;padding-bottom:8px}
.qchip{min-height:34px;padding:0 11px;font-size:12.5px}
.tip{margin-top:10px;padding:8px 10px}
.side{max-height:calc(100dvh - var(--nav-h) - 24px)}

/* previous / next and similar */
.listnav{margin:0 0 6px}
.lncard{min-height:60px;padding:10px 14px}
.sim{margin-top:24px}
.sim-head{margin-bottom:12px}
`;

/* ───────────── 3. APPLY ───────────── */
let out = src;
const problems = [];
for (const e of edits) {
  const n = out.split(e.find).length - 1;
  if (n !== 1) { problems.push(`  - "${e.name}": expected 1 match, found ${n}`); continue; }
  out = out.split(e.find).join(e.repl);
}
const headCount = out.split('</head>').length - 1;
if (headCount !== 1) problems.push(`  - "</head>": expected 1 match, found ${headCount}`);

if (problems.length) {
  console.error('Patch NOT applied. Some anchors did not match (the file may differ from the version this patch was written for):');
  console.error(problems.join('\n'));
  process.exit(1);
}
out = out.split('</head>').join('<style id="nk-compact-v1">' + CSS + '</style>\n</head>');

if (DRY) { console.log('Dry run OK: all ' + (edits.length + 1) + ' anchors matched. Nothing written.'); process.exit(0); }

if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, out, 'utf8');
console.log('Patched ' + path.resolve(target));
console.log('Backup:  ' + path.resolve(backup));
console.log('Undo with: node apply-listing-compact.js --revert');
