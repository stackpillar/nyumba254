#!/usr/bin/env node
/*
 * Nyumba254: listing extras patch (v3)
 * Run AFTER apply-listing-compact.js, apply-whatsapp-link.js and apply-listing-polish.js.
 *
 * Adds: reply-speed badge, one-tap "Is it still available?" on old listings,
 *       photo viewer thumbnails + swipe-down to close, swipeable similar-listings row on phones,
 *       "Near <institution>" walking-directions link for boarding houses, richer structured data.
 *
 *   node apply-listing-extras.js              -> patches ./listing.html or ./listing
 *   node apply-listing-extras.js path/to/file
 *   node apply-listing-extras.js --dry        -> check every edit point, write nothing
 *   node apply-listing-extras.js --revert     -> restore the backup
 *
 * Every edit point must match exactly once, otherwise NOTHING is written.
 * Backup: <file>.bak-extras (created the first time). Running twice is blocked.
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const REVERT = args.includes('--revert');
const given = args.find(a => !a.startsWith('--'));
const target = given || ['listing.html', 'listing'].find(f => fs.existsSync(f));
if (!target || !fs.existsSync(target)) {
  console.error('Could not find the listing file. Pass its path: node apply-listing-extras.js path/to/listing');
  process.exit(1);
}
const backup = target + '.bak-extras';

if (REVERT) {
  if (!fs.existsSync(backup)) { console.error('No backup found: ' + backup); process.exit(1); }
  fs.copyFileSync(backup, target);
  console.log('Restored ' + target + ' from ' + backup);
  process.exit(0);
}

const src = fs.readFileSync(target, 'utf8');
if (src.includes('NK-EXTRAS-V3')) { console.error('Already patched (NK-EXTRAS-V3 found). Use --revert first to re-apply.'); process.exit(1); }
if (!src.includes('NK-POLISH-V2')) { console.error('Run apply-listing-polish.js first: this patch builds on it.'); process.exit(1); }

const raw = fn => fn.toString().replace(/^[^]*?\/\*\n?/, '').replace(/\n?\*\/[^]*$/, '');
const edits = [];
const E = (name, find, repl) => edits.push({ name, find: typeof find === 'function' ? raw(find) : find, repl: typeof repl === 'function' ? raw(repl) : repl });

/* ───────── 1. reply-speed badge on the lister card ───────── */
E('reply badge: slot',
  '<small class="js-rate"></small>',
  '<small class="js-rate"></small><span class="rbadge js-reply" hidden></span>');
E('reply badge: update',
  "function updateRating(){qsa('.js-rate').forEach(e=>{e.textContent=[ratingText,replyText].filter(Boolean).join(' · ')})}",
  "function updateRating(){qsa('.js-rate').forEach(e=>{e.textContent=ratingText});qsa('.js-reply').forEach(e=>{e.hidden=!replyText;e.textContent=replyText?'⚡ '+replyText:''})}");

/* ───────── 2. one-tap "Is it still available?" on old listings ───────── */
E('stale: button',
  'days ago. Confirm it is still available before you visit.</div>',
  'days ago. Confirm it is still available before you visit. <button type="button" class="btn btn-outline nbtn" data-act="ask-avail">Ask if it is still available</button></div>');
E('stale: handler',
  "case 'status':ownerStatus();break;case 'map':window.__drawMap&&window.__drawMap();break;",
  "case 'status':ownerStatus();break;case 'map':window.__drawMap&&window.__drawMap();break;\n    case 'ask-avail':askAvail();break;");
E('stale: askAvail function',
  'function inTouchUI(){',
  function () {/*
async function askAvail(){
  if(!P||isOwner)return;
  const token=lsg('nk_buyer_'+P.id);
  if(token){if(typeof NKGlobalChat!=='undefined')NKGlobalChat.registerAndOpen(P.id,token);return}
  const pr=nkGetBuyerProfile(),hidden=!!P.contact_hidden,phone=nkNormalizePhone(pr.phone||''),m=baseMsg()+' Is it still available?';
  if(!pr.name||pr.name.length<2||(!hidden&&!okPhone(phone))){const q=$('q-msg');if(q)q.value=m;openContactSheet();return}
  if(cooling()){toast(COOLDOWN,'error');return}
  if(needNet())return;
  toast('Sending your question…');
  let r;try{r=await postEnquiry({name:pr.name,phone:hidden?'':phone,email:pr.email||'',message:m,notify:true},'form')}catch(e){r={error:e}}
  if(r.error){toast(enquiryFailure(r.error),'error');return}
  showSent(false);toast('Sent. The lister will reply in your chat.');
}
function inTouchUI(){*/});

/* ───────── 3. photo viewer: thumbnails + swipe down to close ───────── */
E('viewer: thumbnail strip markup',
  '<div class="lb-count" id="lb-count" aria-live="polite"></div>',
  '<div class="lb-thumbs" id="lb-thumbs" aria-label="Photo thumbnails" hidden></div>\n  <div class="lb-count" id="lb-count" aria-live="polite"></div>');
E('viewer: build thumbnails on show',
  "$('lb-box').scrollTo(0,0);",
  "$('lb-box').scrollTo(0,0);lbThumbs();");
E('viewer: thumbnail function',
  'function lbZoom(){',
  function () {/*
function lbThumbs(){
  const t=$('lb-thumbs');if(!t||!P)return;
  if(photos.length<2||document.body.classList.contains('nk-datasaver')){t.hidden=true;t.innerHTML='';t.dataset.n='';return}
  t.hidden=false;
  if(t.dataset.n!==String(photos.length)+':'+P.id){t.dataset.n=String(photos.length)+':'+P.id;t.innerHTML=photos.map((p,i)=>'<button type="button" class="lbt" data-act="lthumb" data-i="'+i+'" aria-label="Photo '+(i+1)+' of '+photos.length+'"><img src="'+escHtml(nkImgSrc(p.url,160))+'" data-orig="'+escHtml(p.url)+'" alt="" loading="lazy" decoding="async"/></button>').join('')}
  qsa('.lbt',t).forEach((b,i)=>{b.classList.toggle('on',i===idx);if(i===idx&&b.scrollIntoView)b.scrollIntoView({block:'nearest',inline:'center'})});
}
function lbZoom(){*/});
E('viewer: thumbnail click',
  "case 'lbzoom':lbZoom();break;",
  "case 'lbzoom':lbZoom();break;case 'lthumb':showPhoto(Number(t.dataset.i)||0);break;");
E('viewer: swipe down to close',
  "swipe($('lb-box'),d=>{if(!zoomed)showPhoto(idx+d)});",
  function () {/*
swipe($('lb-box'),d=>{if(!zoomed)showPhoto(idx+d)});
(function(){const b=$('lb-box');let y0=0,x0=0,on=false;
  b.addEventListener('touchstart',e=>{on=e.touches.length===1&&!zoomed;y0=e.touches[0].clientY;x0=e.touches[0].clientX},{passive:true});
  b.addEventListener('touchend',e=>{if(!on)return;on=false;const t=e.changedTouches[0],dy=t.clientY-y0,dx=t.clientX-x0;if(dy>110&&Math.abs(dx)<60&&!zoomed)nkCloseModal($('lb'))},{passive:true});
})();*/});

/* ───────── 4. boarding houses: "Near <institution>" with walking directions ───────── */
E('nearby: function',
  'function render(){',
  function () {/*
function nearbyHtml(){
  if(meta().group!=='boarding')return '';
  const inst=String((P.details||{}).institution||'').trim();if(!inst)return '';
  const la=parseFloat(P.latitude),ln=parseFloat(P.longitude);
  const origin=isFinite(la)&&isFinite(ln)?la+','+ln:encodeURIComponent([P.area,P.county,'Kenya'].filter(Boolean).join(', '));
  const href='https://www.google.com/maps/dir/?api=1&origin='+origin+'&destination='+encodeURIComponent(inst+', Kenya')+'&travelmode=walking';
  const d=(P._answers||[]).find(a=>a.k==='distance');
  return '<div class="nearby"><span class="nb-ic" aria-hidden="true">🎓</span><div class="nb-t"><b>Near '+escHtml(inst)+'</b>'+(d&&d.a?'<span>Lister says: '+escHtml(d.a)+'</span>':'')+'</div><a class="link" href="'+escHtml(href)+'" rel="noopener" target="_blank">Walking directions ↗</a></div>';
}
function render(){*/});
E('nearby: placement',
  '<p class="maphint" id="maphint" hidden>Pinch to zoom the map. Use Open in Maps for directions.</p></section>',
  '<p class="maphint" id="maphint" hidden>Pinch to zoom the map. Use Open in Maps for directions.</p>${nearbyHtml()}</section>');

/* ───────── 5. richer structured data (lister type + viewing fee) ───────── */
E('structured data: helper',
  'function seo(){',
  function () {/*
function ldExtra(){
  try{
    const p=P.profiles||{},role=P.listed_by_type||p.account_type,fee=P.viewing_fee;
    const labels={owner:'Direct from owner',landlord:'Direct from owner',caretaker:'Caretaker',agent:'Agent',company:'Company',buyer:'Tenant / Buyer'};
    const props=[{'@type':'PropertyValue',name:'Viewing fee',...(fee===null||fee===undefined?{value:'Confirm with the lister'}:{value:Number(fee),unitText:'KES'})}];
    if(role&&labels[role])props.push({'@type':'PropertyValue',name:'Listed by',value:labels[role]+(p.verified_role===role&&p.account_type===role?' (identity checked)':' (not verified)')});
    const out={additionalProperty:props};
    if(role==='company'&&(p.company_name||P.contact_name))out.seller={'@type':'Organization',name:p.company_name||P.contact_name};
    return out;
  }catch(e){return {}}
}
function seo(){*/});
E('structured data: attach to offer',
  "priceCurrency:'KES',availability:P.status==='occupied'?'https://schema.org/SoldOut':'https://schema.org/InStock',url},",
  "priceCurrency:'KES',availability:P.status==='occupied'?'https://schema.org/SoldOut':'https://schema.org/InStock',url,...ldExtra()},");

/* ───────── CSS ───────── */
const CSS = `
/* NK-EXTRAS-V3 */
/* reply-speed badge */
.rbadge{display:inline-flex;align-items:center;gap:4px;margin:3px 0;padding:2px 9px;border-radius:20px;background:var(--green-light);color:var(--green-dark);font-size:12px;font-weight:700}
.rbadge[hidden]{display:none}

/* stale-listing button */
.notice .nbtn{display:inline-flex;min-height:36px;padding:0 12px;margin-top:6px;font-size:13px}

/* photo viewer thumbnails */
.lb-thumbs{flex:0 0 auto;display:flex;gap:6px;overflow-x:auto;padding:8px 12px 2px;scrollbar-width:none;-webkit-overflow-scrolling:touch;position:relative;z-index:3}
.lb-thumbs::-webkit-scrollbar{display:none}
.lb-thumbs::before,.lb-thumbs::after{content:'';margin:auto}
.lb-thumbs[hidden]{display:none}
.lbt{flex:0 0 auto;width:58px;height:44px;padding:0;border-radius:6px;overflow:hidden;border:2px solid transparent;opacity:.55;background:#222}
.lbt.on{opacity:1;border-color:#fff}
.lbt img{width:100%;height:100%;object-fit:cover}
.lbt:focus-visible{outline:2px solid #fff;outline-offset:2px}

/* similar listings: swipeable row on phones */
@media(max-width:768px){
  .sim .card-grid{display:flex;gap:12px;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:none;-webkit-overflow-scrolling:touch;margin:0 calc(-1 * clamp(16px,4vw,32px));padding:0 clamp(16px,4vw,32px) 8px;scroll-padding-left:clamp(16px,4vw,32px)}
  .sim .card-grid::-webkit-scrollbar{display:none}
  .sim .card-grid>*{flex:0 0 78%;max-width:320px;scroll-snap-align:start}
}

/* boarding: near institution */
.nearby{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:10px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.nearby .nb-ic{font-size:18px}
.nearby .nb-t{flex:1 1 160px;min-width:0}
.nearby .nb-t b{display:block;font-size:14px;overflow-wrap:anywhere}
.nearby .nb-t span{display:block;font-size:12.5px;color:var(--text-3)}
.nearby .link{margin:0;min-height:36px;font-size:13px;white-space:nowrap}
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
out = out.split('</head>').join('<style id="nk-extras-v3">' + CSS + '</style>\n</head>');

if (DRY) { console.log('Dry run OK: all ' + (edits.length + 1) + ' edit points matched. Nothing written.'); process.exit(0); }
if (!fs.existsSync(backup)) fs.copyFileSync(target, backup);
fs.writeFileSync(target, out, 'utf8');
console.log('Patched ' + path.resolve(target));
console.log('Backup:  ' + path.resolve(backup));
console.log('Undo with: node apply-listing-extras.js --revert');
