#!/usr/bin/env node
/*
 * Nyumba254: listing polish patch (v2)
 * Run AFTER apply-listing-compact.js and apply-whatsapp-link.js.
 *
 *   node apply-listing-polish.js              -> patches ./listing.html or ./listing
 *   node apply-listing-polish.js path/to/file
 *   node apply-listing-polish.js --dry        -> check every anchor, write nothing
 *   node apply-listing-polish.js --revert     -> restore the backup
 *
 * Every edit point must match exactly once, otherwise NOTHING is written.
 * Backup: <file>.bak-polish (created the first time). Running twice is blocked.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');
const given = args.find(a => !a.startsWith('--'));
const target = given || ['listing.html', 'listing'].find(f => fs.existsSync(f));
if (!target || !fs.existsSync(target)) {
  console.error('Could not find the listing file. Pass its path: node apply-listing-polish.js path/to/listing');
  process.exit(1);
}
const backup = target + '.bak-polish';

if (REVERT) {
  if (!fs.existsSync(backup)) { console.error('No backup found: ' + backup); process.exit(1); }
  fs.copyFileSync(backup, target);
  console.log('Restored ' + target + ' from ' + backup);
  process.exit(0);
}

const src = fs.readFileSync(target, 'utf8');
if (src.includes('NK-POLISH-V2')) { console.error('Already patched (NK-POLISH-V2 found). Use --revert first to re-apply.'); process.exit(1); }
if (!src.includes('NK-COMPACT-PATCH')) { console.error('Run apply-listing-compact.js first: this patch builds on it.'); process.exit(1); }

/* raw(): returns the text inside a block comment, so code can be written without escaping */
const raw = fn => fn.toString().replace(/^[^]*?\/\*\n?/, '').replace(/\n?\*\/[^]*$/, '');
const edits = [];
const E = (name, find, repl) => edits.push({ name, find: typeof find === 'function' ? raw(find) : find, repl: typeof repl === 'function' ? raw(repl) : repl });

/* ───────── A. loading skeleton now matches the compact hero ───────── */
E('skeleton: hero block',
  '<div class="main-col"><div class="sk" style="aspect-ratio:16/10;margin-bottom:20px"></div>',
  '<div class="main-col"><div class="sk sk-hero" style="margin-bottom:12px"></div>');
E('skeleton: contact card',
  '<div class="sk" style="height:440px"></div>',
  '<div class="sk" style="height:360px"></div>');

/* ───────── B. hero: move-in cost line + swipe dots (phones) ───────── */
E('hero: helpers + move-in line (head)',
  "function heroOverlay(){const st=availState(),fee=viewingFeeText(P.viewing_fee);",
  function () {/*
function moveInText(){const c=(typeof costLine==='function'?costLine():'')||'';return c.replace(/^Move-in about (KES [\d,]+).*$/,'Move-in $1')}
function dotsHtml(){return photos.length>1&&photos.length<=10?'<div class="gdots" id="gdots" aria-hidden="true">'+photos.map((_,i)=>'<i'+(i===idx?' class="on"':'')+'></i>').join('')+'</div>':''}
function syncDots(){const t=$('gtrack'),d=$('gdots');if(!t||!d||!t.clientWidth)return;const i=Math.round(t.scrollLeft/t.clientWidth);Array.prototype.forEach.call(d.children,(x,j)=>x.classList.toggle('on',j===i))}
function heroOverlay(){const st=availState(),fee=viewingFeeText(P.viewing_fee),mv=moveInText();*/});
E('hero: move-in line (tail)',
  "escHtml(st.t)+' · '+escHtml(fee)+'</div></div>'}",
  "escHtml(st.t)+' · '+escHtml(fee)+'</div>'+(mv?'<div class=\"ghero-sub ghero-move\">'+escHtml(mv)+'</div>':'')+'</div>'}");
E('hero: dots in phone carousel',
  '${arrows}${count}${heroOverlay()}<span class="gheart">${heart}</span></div></div>',
  '${arrows}${count}${heroOverlay()}${dotsHtml()}<span class="gheart">${heart}</span></div></div>');
E('hero: dots after gallery re-render',
  'g.outerHTML=galleryHtml();syncTrack();',
  'g.outerHTML=galleryHtml();syncTrack();syncDots();');
E('hero: dots follow swipe',
  '/* carousel: keep the counter and index in step with the native swipe */',
  "document.addEventListener('scroll',e=>{if(e.target&&e.target.id==='gtrack')syncDots()},true);\n/* carousel: keep the counter and index in step with the native swipe */");

/* ───────── C. lighter photos (first tile ~800px on phones) ───────── */
E('photos: phone carousel size', '${escHtml(srcFor(p,saver?640:900))}', '${escHtml(srcFor(p,saver?560:800))}');
E('photos: desktop tile sizes', 'w=main?(saver?640:1200):(saver?400:640)', 'w=main?(saver?640:1000):(saver?400:560)');
E('photos: neighbour prefetch', 'srcFor(p,phoneGallery()?900:1200)', 'srcFor(p,phoneGallery()?800:1000)');

/* ───────── D. contact: sticky bar on desktop, "View messages" when already in touch ───────── */
E('sticky bar: desktop logic',
  "ctaObs=new IntersectionObserver(([e])=>show(!e.isIntersecting),{rootMargin:'0px 0px -8px 0px'});ctaObs.observe(inl)}else show(true);",
  function () {/*
ctaObs=new IntersectionObserver(([e])=>{if(isMobileWidth())show(!e.isIntersecting);else deskUpd()},{rootMargin:'0px 0px -8px 0px'});ctaObs.observe(inl)}else show(isMobileWidth()||window.scrollY>460);
  deskUpd();*/});
E('sticky bar: desktop helper',
  "const show=on=>{bar.classList.toggle('show',on);document.body.classList.toggle('nk-cta-show',on)},inl=$('inline-cta');",
  function () {/*
const show=on=>{bar.classList.toggle('show',on);document.body.classList.toggle('nk-cta-show',on)},inl=$('inline-cta');
  const deskUpd=()=>{if(!isMobileWidth())show(window.scrollY>460)};window.__nkDeskUpd=deskUpd;
  if(!window.__nkDeskBound){window.__nkDeskBound=true;addEventListener('scroll',()=>{if(window.__nkDeskUpd)window.__nkDeskUpd()},{passive:true});matchMedia('(max-width:900px)').addEventListener('change',()=>{if(window.__nkDeskUpd)window.__nkDeskUpd()})}*/});
E('in touch: helper',
  'function showSent(existing){',
  function () {/*
function inTouchUI(){qsa('[data-act="scroll"]').forEach(b=>{b.dataset.act='chat';b.classList.add('intouch');b.innerHTML=IC.msg+'View messages'})}
function showSent(existing){*/});
E('in touch: convert buttons',
  "const s=$('sent'),e=$('enq');if(!s||!e)return;e.hidden=true;s.hidden=false;",
  "const s=$('sent'),e=$('enq');if(!s||!e)return;e.hidden=true;s.hidden=false;inTouchUI();");

/* ───────── E. report options tucked into one small menu ───────── */
E('report menu',
  '<button type="button" class="link" data-act="report-fee">Report a fee problem</button></div></div><button type="button" class="link report" data-act="report">Report this listing</button></div>',
  '</div></div><details class="rmenu"><summary>⋯ Report a problem</summary><div class="rmenu-b"><button type="button" class="link" data-act="report-fee">Report a fee problem</button><button type="button" class="link" data-act="report">Report this listing</button></div></details></div>');

/* ───────── F. share text and sticky price in the section nav ───────── */
E('share: clean WhatsApp text',
  "['💬','WhatsApp',`https://wa.me/?text=${e(txt+'\\n'+url)}`]",
  "['💬','WhatsApp',`https://wa.me/?text=${e('🏠 '+P.title+'\\n'+(basePrice()>0?money(basePrice())+(FREQ[freq()]||''):'Price on request')+' · '+where()+'\\n'+viewingFeeText(P.viewing_fee)+'\\n'+url)}`]");
E('section nav: price slot',
  'data-anchor="${id}">${escHtml(l)}</a>`).join(\'\')}</nav>`}',
  'data-anchor="${id}">${escHtml(l)}</a>`).join(\'\')}<span class="anc-price" aria-hidden="true">${priceHtml()}</span></nav>`}');
E('section nav: stuck detector',
  'function initAnchors(){',
  function () {/*
function stickyPrice(){if(window.__nkAncBound)return;window.__nkAncBound=true;let t=false;addEventListener('scroll',()=>{if(t)return;t=true;requestAnimationFrame(()=>{t=false;const b=$('anchors');if(!b)return;const nh=parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h'),10)||64;b.classList.toggle('stuck',b.getBoundingClientRect().top<=nh+2)})},{passive:true})}
function initAnchors(){stickyPrice();*/});

/* ───────── G. CSS ───────── */
const CSS = `
/* NK-POLISH-V2 */
/* loading skeleton matches the hero */
.sk-hero{height:clamp(220px,29vw,370px);border-radius:16px}
@media(max-width:768px){.sk-hero{height:min(66vw,300px);border-radius:14px}}

/* hero extras */
.ghero-move{font-weight:500;opacity:.92}
.main-col:has(.ghero)>.cost{display:none}
.gdots{position:absolute;top:12px;left:50%;transform:translateX(-50%);z-index:4;display:flex;gap:5px;align-items:center;padding:5px 8px;border-radius:10px;background:rgba(0,0,0,.38);pointer-events:none}
.gdots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.6);transition:width .15s,background .15s}
.gdots i.on{width:14px;border-radius:4px;background:#fff}

/* shorter contact form: name and phone side by side, unit picker without its label, scrollable quick replies */
.scard .nf-field:has(#q-unit)>label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}
.scard .nf-field:has(#q-unit){margin-bottom:8px}
#q-fields{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));column-gap:10px}
#q-fields[hidden]{display:none}
#q-fields>details{grid-column:1/-1}
.scard details.more{margin-bottom:8px}
.scard details.more summary{min-height:34px}
.qchips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}
.qchips::-webkit-scrollbar{display:none}
.qchip{flex:0 0 auto;white-space:nowrap}
.scard #q-msg{min-height:56px}

/* buttons never wrap, "View messages" state */
.ctabar .btn,.inline-cta .btn{white-space:nowrap}
.btn.intouch{font-size:13.5px}

/* report options menu */
.rmenu{margin-top:8px;text-align:center}
.rmenu summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;min-height:36px;padding:0 10px;font-size:12.5px;font-weight:600;color:var(--text-3)}
.rmenu summary::-webkit-details-marker{display:none}
.rmenu summary:hover{color:var(--text)}
.rmenu-b{display:flex;flex-direction:column;align-items:center}
.rmenu-b .link{min-height:36px;font-size:12.5px;margin:0}

/* price in the section nav once it sticks (desktop) */
.anchors .anc-price{display:none;margin-left:auto;align-items:center;padding:0 12px;font-family:'Playfair Display',serif;font-weight:700;font-size:15px;color:var(--green-dark);white-space:nowrap}
.anchors .anc-price small{font-family:'Inter',sans-serif;font-size:11.5px;font-weight:500;color:var(--text-3)}
.anchors.stuck .anc-price{display:inline-flex}

/* desktop: the action bar slides up after the hero, aligned to the 1200px page width */
@media(min-width:901px){
  .ctabar:not([hidden]){display:flex;left:0;right:0;bottom:0;justify-content:center;gap:10px;padding:8px max(24px,calc((100vw - 1200px)/2 + 24px))}
  .ctabar .ctabar-price{flex:1 1 auto}
  .ctabar .ctabar-price span:last-child{display:none}
  .ctabar .btn:not(.ctabar-icon){flex:0 0 auto;min-width:150px}
  .ctabar .ctabar-icon{flex:0 0 48px}
  body.nk-cta-show{padding-bottom:var(--nk-cta-h,0px)}
  body.nk-cta-show .nk-chat-fab{bottom:calc(var(--nk-cta-h,0px) + 16px)!important}
  body.nk-cta-show .nk-scrolltop-btn{bottom:calc(var(--nk-cta-h,0px) + 16px)}
  body.nk-cta-show .toast{bottom:calc(var(--nk-cta-h,0px) + 20px)}
}
`;

/* ───────── APPLY ───────── */
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
  console.error('Patch NOT applied. Some edit points did not match (the file differs from the expected version):');
  console.error(problems.join('\n'));
  process.exit(1);
}
out = out.split('</head>').join('<style id="nk-polish-v2">' + CSS + '</style>\n</head>');

if (DRY) { console.log('Dry run OK: all ' + (edits.length + 1) + ' edit points matched. Nothing written.'); process.exit(0); }
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, out, 'utf8');
console.log('Patched ' + path.resolve(target));
console.log('Backup:  ' + path.resolve(backup));
console.log('Undo with: node apply-listing-polish.js --revert');
