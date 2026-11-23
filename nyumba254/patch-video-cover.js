#!/usr/bin/env node
/*
 * Nyumba254 - VIDEO AS COVER everywhere
 *
 *   node patch-video-cover.js            apply (run in the folder with index.html, listings.html ...)
 *   node patch-video-cover.js --revert   undo
 *
 * What it does
 *   1. Creates nk-video-cover.js. On every page that shows listing cards (home, browse, saved,
 *      similar listings, recently viewed, admin, dashboard) a listing that has a video now shows
 *      that video, muted and looping, as the cover. It fills the photo box edge to edge, exactly
 *      like a photo. No video = photo as before. Data Saver users keep photos only.
 *      Videos play only while on screen (max 5 at once, 2 for YouTube/Vimeo) so pages stay fast.
 *      Videos still waiting for admin review are never shown.
 *   2. post-listing: after choosing a video (link or upload) a tick box appears:
 *      "Use my video as the cover" (ticked by default). Untick = photos stay the cover.
 *   3. admin: in a listing's Video section, the same switch.
 *   The choice is saved inside the listing's existing "details" field, so NO database change.
 *
 * Safe: every file is checked first; nothing is written unless all edits match once.
 * Backups: <file>.bak-videocover
 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const REVERT = process.argv.includes('--revert');
const MARK = 'NK-VIDEOCOVER';
const die = m => { console.error('\n[ERROR] ' + m + '\n'); process.exit(1); };
const BAK = '.bak-videocover';
const SCRIPT_TAG = '<script src="/nk-video-cover.js?v=1"></script>\n';

const COVER_JS = String.raw`/* Nyumba254: video as the cover of listing cards (NK-VIDEOCOVER v1)
 * Loaded on every page that shows listing cards. It finds the cards, asks the database which
 * listings have a video, and plays that video muted inside the card's photo box, filling it
 * edge to edge (same look as the photo). Cards without a video are left untouched. */
(function () {
  'use strict';
  if (window.NKVideoCover) return;

  var LIVE_FILE = 5, LIVE_EMBED = 2;
  var BAD = /^(processing|pending|pending_review|rejected|failed|deleted|blocked|removed|hidden)$/i;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  /* card = the whole card; box = the photo area inside it; chip = show the small "Video" tag */
  var TARGETS = [
    { card: '.card', box: '.card-img', chip: true, skip: '.unavailable,.is-occupied' },
    { card: '.peek-card', box: 'self' },
    { card: '.nk-recent-card', box: 'img,.nk-recent-ph', overlay: true },
    { card: '.listing-card[data-id]', box: '.lc-media', chip: true },
    { card: '#listings-tbody [data-id],#quick-listings [data-id],.lc-list [data-id]', box: '.lc-thumb,.lc-img,.lc-photo,.lc-cover,[class*="thumb"]', chip: true }
  ];

  var cache = Object.create(null), queue = [], flushT = 0, tries = 0;
  var all = new Set(), byBox = new WeakMap(), liveFile = new Set(), liveEmbed = new Set();

  function DB() { try { return typeof db !== 'undefined' ? db : null; } catch (e) { return null; } }
  function saver() { return !!(document.body && document.body.classList.contains('nk-datasaver')); }
  function reduced() { return !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches); }

  function classify(u) {
    u = String(u || '').trim();
    var m;
    if (!/^https?:\/\//i.test(u)) return null;
    m = u.match(/youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/|v\/)([\w-]{11})|youtu\.be\/([\w-]{11})/i);
    if (m) return { kind: 'yt', id: m[1] || m[2], shorts: /\/shorts\//i.test(u), url: u };
    m = u.match(/vimeo\.com\/(?:video\/)?(\d+)(?:\/([a-f0-9]+))?/i);
    if (m) return { kind: 'vimeo', id: m[1], hash: m[2] || '', url: u };
    if (/tiktok\.com|instagram\.com|facebook\.com|fb\.watch/i.test(u)) return null;
    return { kind: 'file', url: u };
  }
  function pick(rows, meta) {
    var d = meta && meta.details;
    if (d && typeof d === 'object' && d.video_cover === false) return 0;
    rows = (rows || []).filter(function (r) { return r && r.url && !BAD.test(String(r.status || '')); })
      .sort(function (a, b) { return (a.position || 0) - (b.position || 0); });
    for (var i = 0; i < rows.length; i++) { var c = classify(rows[i].url); if (c) return c; }
    return 0;
  }

  function keyOf(card) {
    var id = card.getAttribute('data-listing-id') || card.getAttribute('data-recent') || card.getAttribute('data-id') || card.getAttribute('data-view-id');
    if (id && UUID.test(id)) return { t: 'id', v: id };
    var a = (card.matches && card.matches('a[href]')) ? card : card.querySelector('a[href*="/listing?id="],a[href*="listing.html?id="],a[href*="listing?id="]');
    if (a) {
      var m = (a.getAttribute('href') || '').match(/[?&]id=(\d{1,9})(?:&|$)/);
      if (m) return { t: 'num', v: String(parseInt(m[1], 10)) };
    }
    return null;
  }

  /* ---------- finding cards ---------- */
  function scan(root) {
    if (saver()) return;
    var scope = root || document;
    TARGETS.forEach(function (t) {
      scope.querySelectorAll(t.card).forEach(function (card) {
        if (card.__nkvc) return;
        if (t.skip && card.matches(t.skip)) return;
        var box = t.box === 'self' ? card : card.querySelector(t.box);
        if (!box) return;
        var k = keyOf(card);
        if (!k) return;
        card.__nkvc = 1;
        queue.push({ card: card, box: box, k: k, t: t });
        clearTimeout(flushT); flushT = setTimeout(flush, 120);
      });
    });
    prune();
  }
  function prune() {
    all.forEach(function (st) { if (!st.box.isConnected) destroy(st); });
  }

  /* ---------- asking the database ---------- */
  async function flush() {
    var q = queue; queue = [];
    if (!q.length) return;
    var d = DB();
    if (!d) { if (++tries < 12) { queue = q.concat(queue); flushT = setTimeout(flush, 500); } return; }
    var ids = [], nums = [], seen = {};
    q.forEach(function (it) {
      var ck = it.k.t + ':' + it.k.v;
      if (ck in cache || seen[ck]) return;
      seen[ck] = 1; (it.k.t === 'id' ? ids : nums).push(it.k.v);
    });
    var i, CH = 80;
    for (i = 0; i < ids.length; i += CH) await loadChunk(d, ids.slice(i, i + CH), []);
    for (i = 0; i < nums.length; i += CH) await loadChunk(d, [], nums.slice(i, i + CH));
    q.forEach(function (it) {
      var info = cache[it.k.t + ':' + it.k.v];
      if (info) attach(it.card, it.box, info, it.t);
    });
  }
  async function loadChunk(d, ids, nums) {
    var meta = {}, rows = [];
    try {
      var jobs = [];
      if (ids.length) jobs.push(d.from('listings').select('id,listing_number,details').in('id', ids));
      if (nums.length) jobs.push(d.from('listings').select('id,listing_number,details').in('listing_number', nums.map(Number)));
      var rs = await Promise.all(jobs);
      rs.forEach(function (r) { if (r && r.error) throw r.error; ((r && r.data) || []).forEach(function (x) { meta[x.id] = x; }); });
      var keys = Object.keys(meta);
      if (keys.length) {
        var v = await d.from('listing_videos').select('*').in('listing_id', keys);
        if (v.error) throw v.error;
        rows = v.data || [];
      }
    } catch (e) {
      ids.forEach(function (x) { cache['id:' + x] = 0; });
      nums.forEach(function (x) { cache['num:' + parseInt(x, 10)] = 0; });
      return;
    }
    var by = {};
    rows.forEach(function (r) { (by[r.listing_id] = by[r.listing_id] || []).push(r); });
    Object.keys(meta).forEach(function (id) {
      var m = meta[id], info = pick(by[id] || [], m);
      cache['id:' + id] = info; cache['num:' + parseInt(m.listing_number, 10)] = info;
    });
    ids.forEach(function (x) { if (!(('id:' + x) in cache)) cache['id:' + x] = 0; });
    nums.forEach(function (x) { var k = 'num:' + parseInt(x, 10); if (!(k in cache)) cache[k] = 0; });
  }

  /* ---------- putting the video in the card ---------- */
  function attach(card, box, info, t) {
    if (!card.isConnected || byBox.has(box)) return;
    var st = { card: card, box: box, info: info, t: t, host: box, el: null, live: false, near: false, vis: false, bad: false, chip: null, ro: null };
    card.classList.add('nkvc-has');
    if (t.overlay) {
      card.classList.add('nkvc-ov');
      var w = document.createElement('div'); w.className = 'nkvc-ovw'; card.appendChild(w);
      st.host = w;
      var sync = function () {
        w.style.left = box.offsetLeft + 'px'; w.style.top = box.offsetTop + 'px';
        w.style.width = box.offsetWidth + 'px'; w.style.height = box.offsetHeight + 'px';
        w.style.borderRadius = getComputedStyle(box).borderRadius;
        fit(st);
      };
      st.sync = sync; sync();
      if (window.ResizeObserver) { st.ro = new ResizeObserver(sync); st.ro.observe(box); }
    } else {
      if (getComputedStyle(box).position === 'static') box.classList.add('nkvc-rel');
      if (t.chip) {
        var c = document.createElement('span'); c.className = 'nkvc-chip'; c.setAttribute('aria-hidden', 'true'); c.textContent = '\u25B6 Video';
        box.appendChild(c); st.chip = c;
      }
      if (window.ResizeObserver && info.kind !== 'file') { st.ro = new ResizeObserver(function () { fit(st); }); st.ro.observe(box); }
    }
    all.add(st); byBox.set(box, st);
    if (!('IntersectionObserver' in window)) { st.near = st.vis = true; mount(st); tryLive(st); return; }
    ioNear.observe(box); ioView.observe(box);
  }

  function fit(st) {
    var f = st.el;
    if (!f || st.info.kind === 'file') return;
    var W = st.host.clientWidth, H = st.host.clientHeight;
    if (!W || !H) return;
    var a = st.info.shorts ? 0.5625 : 1.7778, w, h;
    if (a > W / H) { h = H; w = H * a; } else { w = W; h = W / a; }
    f.style.width = Math.ceil(w) + 'px'; f.style.height = Math.ceil(h) + 'px';
  }

  function canPlay() { return !saver() && !reduced(); }

  function mount(st) {                       /* a card is near the screen: prepare the media */
    if (st.bad || st.info.kind !== 'file' || st.el) return;
    var v = document.createElement('video');
    v.className = 'nkvc-v';
    v.muted = true; v.defaultMuted = true; v.loop = true; v.playsInline = true; v.disablePictureInPicture = true;
    v.setAttribute('muted', ''); v.setAttribute('playsinline', ''); v.setAttribute('aria-hidden', 'true'); v.tabIndex = -1;
    v.preload = 'metadata';
    v.addEventListener('loadeddata', function () { v.classList.add('on'); });
    v.addEventListener('error', function () { fail(st); });
    v.src = st.info.url + '#t=0.1';
    st.host.insertBefore(v, st.host.firstChild); st.el = v;
  }
  function unmount(st) {
    idle(st);
    if (st.info.kind === 'file' && st.el) { try { st.el.removeAttribute('src'); st.el.load(); } catch (e) {} st.el.remove(); st.el = null; }
  }
  function fail(st) {
    st.bad = true; idle(st);
    if (st.el) { st.el.remove(); st.el = null; }
    if (st.chip) st.chip.remove();
    st.card.classList.remove('nkvc-has');
  }
  function embedSrc(info) {
    if (info.kind === 'yt') return 'https://www.youtube-nocookie.com/embed/' + info.id + '?autoplay=1&mute=1&loop=1&playlist=' + info.id + '&controls=0&playsinline=1&rel=0&modestbranding=1&iv_load_policy=3&disablekb=1&fs=0';
    return 'https://player.vimeo.com/video/' + info.id + '?' + (info.hash ? 'h=' + info.hash + '&' : '') + 'autoplay=1&muted=1&loop=1&background=1&playsinline=1';
  }
  function tryLive(st) {                     /* a card is mostly on screen: start playing, within the limit */
    if (st.bad || st.live || !st.near || !canPlay()) return;
    if (st.info.kind === 'file') {
      if (liveFile.size >= LIVE_FILE) return;
      if (!st.el) mount(st);
      if (!st.el) return;
      var p = st.el.play(); if (p && p.catch) p.catch(function () {});
      liveFile.add(st); st.live = true;
    } else {
      if (liveEmbed.size >= LIVE_EMBED) return;
      var f = document.createElement('iframe');
      f.className = 'nkvc-v nkvc-f'; f.setAttribute('aria-hidden', 'true'); f.tabIndex = -1;
      f.setAttribute('allow', 'autoplay; encrypted-media'); f.setAttribute('loading', 'lazy');
      f.src = embedSrc(st.info);
      f.addEventListener('load', function () { setTimeout(function () { f.classList.add('on'); }, 700); });
      st.host.insertBefore(f, st.host.firstChild); st.el = f; fit(st);
      liveEmbed.add(st); st.live = true;
    }
  }
  function idle(st) {
    if (!st.live) return;
    st.live = false;
    if (st.info.kind === 'file') { liveFile.delete(st); if (st.el) { try { st.el.pause(); } catch (e) {} } }
    else { liveEmbed.delete(st); if (st.el) { st.el.remove(); st.el = null; } }
    promote();
  }
  function promote() {
    all.forEach(function (st) { if (st.vis && st.near && !st.live && !st.bad) tryLive(st); });
  }
  function destroy(st) {
    unmount(st); all.delete(st);
    try { ioNear.unobserve(st.box); ioView.unobserve(st.box); } catch (e) {}
    if (st.ro) st.ro.disconnect();
    if (st.t.overlay && st.host && st.host.parentNode) st.host.remove();
  }

  var ioNear = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var st = byBox.get(e.target); if (!st) return;
      st.near = e.isIntersecting;
      if (st.near) { mount(st); if (st.vis) tryLive(st); } else unmount(st);
    });
  }, { rootMargin: '400px 0px' });
  var ioView = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      var st = byBox.get(e.target); if (!st) return;
      if (e.intersectionRatio >= 0.55) st.vis = true; else if (e.intersectionRatio < 0.2) st.vis = false; else return;
      if (st.vis) tryLive(st); else idle(st);
    });
  }, { threshold: [0, 0.2, 0.55] });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) all.forEach(idle); else promote();
  });

  /* ---------- style ---------- */
  var css = document.createElement('style'); css.id = 'nk-video-cover-css';
  css.textContent =
    '.nkvc-rel{position:relative}.nkvc-ov{position:relative}' +
    '.nkvc-v{position:absolute;left:0;top:0;width:100%;height:100%;object-fit:cover;display:block;z-index:1;opacity:0;transition:opacity .3s ease;pointer-events:none;background:#111;border:0;max-width:none}' +
    '.nkvc-v.on{opacity:1}' +
    'iframe.nkvc-f{left:50%;top:50%;width:auto;height:auto;transform:translate(-50%,-50%);object-fit:fill}' +
    '.nkvc-ovw{position:absolute;overflow:hidden;z-index:1;pointer-events:none;background:transparent}' +
    '.nkvc-chip{position:absolute;right:10px;bottom:10px;z-index:3;display:inline-flex;align-items:center;gap:4px;background:rgba(0,0,0,.58);color:#fff;font:700 10.5px/1.2 Inter,system-ui,sans-serif;padding:3px 8px;border-radius:12px;pointer-events:none}' +
    '.nkvc-has .card-carousel-arrow,.nkvc-has .card-photo-counter,.nkvc-has .photo-nav,.nkvc-has .photo-count,.nkvc-has .card-photo-count{display:none!important}' +
    '@media(max-width:768px){.nkvc-chip{right:7px;bottom:7px;font-size:9.5px;padding:2px 6px}}';
  document.head.appendChild(css);

  /* ---------- go ---------- */
  var moT = 0;
  function start() {
    scan();
    new MutationObserver(function () { clearTimeout(moT); moT = setTimeout(function () { scan(); }, 150); })
      .observe(document.documentElement, { childList: true, subtree: true });
  }
  window.NKVideoCover = { scan: scan };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
  window.addEventListener('load', function () { scan(); });
})();
`;

const NAMES = ['index', 'listings', 'saved', 'dashboard', 'admin', 'listing', 'storefront', 'lister', 'inbox', 'post-listing'];
const find = n => [n + '.html', n].find(f => fs.existsSync(f) && fs.statSync(f).isFile());

if (REVERT) {
  let n = 0;
  NAMES.forEach(nm => { const f = find(nm); if (f && fs.existsSync(f + BAK)) { fs.copyFileSync(f + BAK, f); fs.unlinkSync(f + BAK); n++; } });
  if (fs.existsSync('nk-video-cover.js')) { fs.unlinkSync('nk-video-cover.js'); }
  console.log('Restored ' + n + ' page(s) and removed nk-video-cover.js.');
  process.exit(0);
}

const POST_ROW = '<div class="field-hint" id="video-status" aria-live="polite"></div>' +
  '<label id="video-cover-row" hidden style="display:flex;gap:10px;align-items:flex-start;margin-top:12px;padding:12px 14px;border:1.5px solid var(--green-mid);background:var(--green-light);border-radius:var(--radius);font-size:13px;font-weight:500;color:var(--green-dark);cursor:pointer"><input type="checkbox" id="video_cover" checked style="width:18px;height:18px;margin-top:2px;accent-color:var(--green);flex:0 0 auto"/><span><b>Use my video as the cover</b><br><span style="font-weight:400">It plays on your listing card in search, home and saved lists. Untick to keep your photo as the cover.</span></span></label></div>';
const POST_SCRIPT = '<script>/*' + MARK + '*/(function(){var u=document.getElementById("video_url"),row=document.getElementById("video-cover-row"),st=document.getElementById("video-status");if(!row)return;function sync(){var has=/^https?:\\/\\//i.test(((u&&u.value)||"").trim())||/^Ready:/.test((st&&st.textContent)||"");row.hidden=!has}if(u)u.addEventListener("input",sync);if(st&&window.MutationObserver)new MutationObserver(sync).observe(st,{childList:true,characterData:true,subtree:true});document.addEventListener("change",function(e){if(e.target&&(e.target.id==="vid-up"||e.target.id==="vid-rec"))setTimeout(sync,600)});sync()})();</script>\n';

const ADMIN_ROW = '<label class="chk" style="margin:8px 0"><input type="checkbox" id="vc" ${l.details?.video_cover===false?\'\':\'checked\'}> Use the video as the cover on listing cards</label>';
const ADMIN_FIND_A = '<div style="margin:8px 0"><input type="file" id="vf" accept="video/mp4,video/webm,video/quicktime"> <small id="vfs"></small></div>';
const ADMIN_FIND_B = "const vb=$('#vb',host);if(vb)vb.onchange=()=>{$('#vrw',host).hidden=!vb.checked;};";
const ADMIN_HANDLER = "/*" + MARK + "*/const vc=$('#vc',host);if(vc)vc.onchange=async()=>{const nd=Object.assign({},l.details||{},{video_cover:vc.checked});const{error}=await db.from('listings').update({details:nd}).eq('id',l.id);if(error){ui.toast(error.message,'err');vc.checked=!vc.checked;return;}l.details=nd;logAction('set_video_cover','listing',l.id,vc.checked?'on':'off');ui.toast(vc.checked?'Video is now the cover':'Photo is now the cover','ok');};";

const plans = [];
let scripts = 0;
NAMES.forEach(nm => {
  const f = find(nm); if (!f) return;
  const raw = fs.readFileSync(f, 'utf8');
  if (raw.includes(MARK) || raw.includes('nk-video-cover.js')) { console.log('  [skip] ' + f + ' already patched'); return; }
  const crlf = /\r\n/.test(raw);
  let out = raw.replace(/\r\n/g, '\n');
  const log = [];
  const once = (label, find, rep) => {
    const c = out.split(find).length - 1;
    if (c !== 1) { log.push({ label, ok: false, why: c ? 'found ' + c + 'x' : 'NOT FOUND' }); return; }
    out = out.split(find).join(rep); log.push({ label, ok: true });
  };
  if (nm === 'post-listing') {
    once('cover tick box', '<div class="field-hint" id="video-status" aria-live="polite"></div></div>', POST_ROW);
    once('save the choice with the listing', "if(val('area')==='__other__')d.custom_area=true;", "if(val('area')==='__other__')d.custom_area=true;/*" + MARK + "*/if($('video_cover')&&!$('video_cover').checked)d.video_cover=false;");
    once('show/hide the tick box', '</body>', POST_SCRIPT + '</body>');
  } else {
    if (nm === 'admin') {
      once('admin: cover switch', ADMIN_FIND_A, ADMIN_FIND_A + ADMIN_ROW);
      once('admin: save handler', ADMIN_FIND_B, ADMIN_FIND_B + ADMIN_HANDLER);
    }
    once('load the cover script', '</body>', SCRIPT_TAG + '</body>');
  }
  plans.push({ f, crlf, out, log });
});
if (!plans.length) die('No pages found. Run this in the folder that contains index.html, listings.html, etc.');

let bad = false;
plans.forEach(p => { console.log('File: ' + p.f); p.log.forEach(l => { console.log('  [' + (l.ok ? 'ok' : 'FAIL') + '] ' + l.label + (l.ok ? '' : ' -> ' + l.why)); if (!l.ok) bad = true; }); });
if (bad) die('Some edits did not match, so NOTHING was changed. Send me the page named above.');
try { new vm.Script(COVER_JS); } catch (e) { die('Cover script syntax error: ' + e.message); }
plans.forEach(p => {
  [...p.out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.includes(MARK)).forEach(s => {
    try { new vm.Script(s); } catch (e) { die('Patched script in ' + p.f + ' has a syntax error (' + e.message + '), so NOTHING was changed.'); }
  });
});
plans.forEach(p => { if (!fs.existsSync(p.f + BAK)) fs.copyFileSync(p.f, p.f + BAK); fs.writeFileSync(p.f, p.crlf ? p.out.replace(/\n/g, '\r\n') : p.out, 'utf8'); });
fs.writeFileSync('nk-video-cover.js', COVER_JS, 'utf8');
console.log('\nDone. Created nk-video-cover.js and patched ' + plans.length + ' page(s). Backups: *' + BAK);
console.log('Next: push to GitHub (include nk-video-cover.js) and hard refresh.');
console.log('Undo any time with:  node patch-video-cover.js --revert');
