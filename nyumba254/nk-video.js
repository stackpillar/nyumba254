/* Nyumba254 shared video component. Every page renders and writes video through this file:
   NKVideo.mountInto(el, videos, opts)  render one or many videos in a fixed, correctly fitted frame
   NKVideo.parse(url)                    detect provider, id, embed URL and default ratio for a link
   NKVideo.prepareFile(file, limits)     check a file in the browser and capture a poster frame
   NKVideo.uploadFile(db, listingId, prepared, onProgress) upload straight to the listing-videos bucket
   NKVideo.saveUpload / saveLink / remove  thin wrappers over the save_listing_video / delete_listing_video RPCs */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NKVideo = api;
})(typeof self !== 'undefined' ? self : this, function (root) {
  'use strict';

  const BUCKET = 'listing-videos';
  const LAND_MIN = 4 / 3, LAND_MAX = 21 / 9, PORT_MIN = 9 / 16, PORT_MAX = 0.95;
  const MIME_EXT = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null; };

  /* ── Ratio rules ───────────────────────────────────────────── */
  function clampRatio(r) {
    r = num(r);
    if (!r || r <= 0) return 16 / 9;
    if (r >= 0.95 && r <= 1.05) return 1;
    if (r < 1) return Math.min(PORT_MAX, Math.max(PORT_MIN, r));
    return Math.min(LAND_MAX, Math.max(LAND_MIN, r));
  }
  function orientationOf(r) { r = num(r); return !r ? 'landscape' : r > 1.05 ? 'landscape' : r < 0.95 ? 'portrait' : 'square'; }

  /* ── Link detection ────────────────────────────────────────── */
  function parse(raw) {
    let u;
    try { u = new URL(String(raw || '').trim()); } catch (e) { return { provider: 'invalid' }; }
    if (u.protocol !== 'https:') return { provider: 'invalid' };
    const h = u.hostname.replace(/^www\./, '').replace(/^m\./, '');
    const path = u.pathname;
    let m;
    if (h === 'youtu.be') {
      m = path.match(/^\/([\w-]{6,15})/);
      if (m) return { provider: 'youtube', id: m[1], embed: `https://www.youtube.com/embed/${m[1]}`, ratio: 16 / 9, original: u.href };
    }
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
      if ((m = path.match(/^\/shorts\/([\w-]{6,15})/))) return { provider: 'youtube', id: m[1], embed: `https://www.youtube.com/embed/${m[1]}`, ratio: 9 / 16, short: true, original: u.href };
      if ((m = path.match(/^\/(?:embed|live|v)\/([\w-]{6,15})/))) return { provider: 'youtube', id: m[1], embed: `https://www.youtube.com/embed/${m[1]}`, ratio: 16 / 9, original: u.href };
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{6,15}$/.test(v)) return { provider: 'youtube', id: v, embed: `https://www.youtube.com/embed/${v}`, ratio: 16 / 9, original: u.href };
    }
    if (h === 'vimeo.com' || h === 'player.vimeo.com') {
      m = path.match(/(?:\/video)?\/(\d{5,12})(?:\/([\w]+))?/);
      if (m) return { provider: 'vimeo', id: m[1], embed: `https://player.vimeo.com/video/${m[1]}${m[2] ? '?h=' + m[2] : ''}`, ratio: null, original: u.href };
    }
    if (/(^|\.)tiktok\.com$/.test(h)) {
      m = path.match(/\/video\/(\d{8,25})/);
      if (m) return { provider: 'tiktok', id: m[1], embed: `https://www.tiktok.com/embed/v2/${m[1]}`, ratio: 9 / 16, original: u.href };
      return { provider: 'tiktok', ratio: 9 / 16, original: u.href };
    }
    if (/(^|\.)instagram\.com$/.test(h)) {
      m = path.match(/\/(reel|reels|p|tv)\/([\w-]+)/);
      if (m) { const kind = m[1] === 'reels' ? 'reel' : m[1]; return { provider: 'instagram', id: m[2], embed: `https://www.instagram.com/${kind}/${m[2]}/embed`, ratio: 9 / 16, original: u.href }; }
      return { provider: 'instagram', ratio: 9 / 16, original: u.href };
    }
    if (/\.(mp4|webm|mov|m4v)$/i.test(path)) return { provider: 'direct', direct: u.href, ratio: null, original: u.href };
    return { provider: 'link', original: u.href };
  }

  /* One normalised description of a stored row, whichever page asks. */
  function describe(v) {
    const url = v.url || '';
    const isUpload = v.source === 'upload' || /\/storage\/v1\/object\/public\/listing-videos\//.test(url);
    if (isUpload) return { kind: 'file', src: url, poster: v.poster_url || '', ratio: num(v.aspect_ratio), original: url, provider: 'upload' };
    const p = parse(url);
    if (p.provider === 'direct') return { kind: 'file', src: p.direct, poster: v.poster_url || '', ratio: num(v.aspect_ratio), original: p.original, provider: 'direct' };
    if (p.embed) return { kind: 'embed', id: p.id, src: v.embed_url && /^https:\/\//.test(v.embed_url) ? v.embed_url.replace('www.youtube-nocookie.com', 'www.youtube.com') : p.embed, poster: v.poster_url || '', ratio: p.short ? 9 / 16 : (num(v.aspect_ratio) || p.ratio), original: p.original, provider: p.provider };
    return { kind: 'link', src: '', poster: v.poster_url || '', ratio: num(v.aspect_ratio) || p.ratio, original: p.original || url, provider: p.provider };
  }

  /* ── Styles ────────────────────────────────────────────────── */
  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('nkv-css')) return;
    const st = document.createElement('style');
    st.id = 'nkv-css';
    st.textContent = `
.nkv{width:100%;margin:0 auto}
.nkv-box{display:flex;flex-direction:column;width:100%}
.nkv-stage{--r:1.7778;position:relative;width:100%;aspect-ratio:16/9;max-height:min(72vh,560px);overflow:hidden;isolation:isolate;border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-lg,14px);background:#1f3a33}
.nkv-stage[data-theater="1"]{aspect-ratio:4/3;max-height:85vh}
.nkv-bg{position:absolute;inset:0;z-index:0;overflow:hidden;background:linear-gradient(135deg,#1f3a33,#26303c);background:linear-gradient(135deg,color-mix(in srgb,var(--green,#0f6e56) 55%,#000),color-mix(in srgb,var(--surface,#1f2937) 55%,#000))}
.nkv-bg i,.nkv-bg video{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.15);filter:blur(28px) brightness(.55) saturate(1.2);background:center/cover no-repeat;pointer-events:none}
.nkv-stage[data-loading="1"] .nkv-bg::after{content:"";position:absolute;inset:0;background:linear-gradient(100deg,transparent 30%,rgba(255,255,255,.14) 50%,transparent 70%);background-size:200% 100%;animation:nkv-sh 1.4s linear infinite}
@keyframes nkv-sh{from{background-position:200% 0}to{background-position:-200% 0}}
.nkv-player{position:absolute;z-index:1;inset:0;margin:auto;height:100%;max-width:100%;aspect-ratio:var(--r);transition:height .2s ease,width .2s ease}
.nkv-stage[data-fill="1"] .nkv-player{width:100%!important;height:100%!important;aspect-ratio:auto}
.nkv-player video,.nkv-player iframe,.nkv-player .nkv-poster{position:absolute;inset:0;width:100%;height:100%;border:0;background:transparent;object-fit:contain}
.nkv-stage[data-fill="1"] .nkv-player video{object-fit:cover}
.nkv-face{position:absolute;inset:0;border:0;padding:0;cursor:pointer;background:center/cover no-repeat;display:flex;align-items:center;justify-content:center}
.nkv-play{width:64px;height:64px;border-radius:50%;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;color:#fff;box-shadow:0 0 0 2px rgba(255,255,255,.7)}
.nkv-play svg{width:26px;height:26px;fill:#fff;margin-left:3px}
.nkv-face:focus-visible,.nkv-btn:focus-visible,.nkv-hint:focus-visible{outline:3px solid #fff;outline-offset:-3px;box-shadow:0 0 0 5px var(--green,#0f6e56)}
.nkv-ctl{position:absolute;z-index:3;top:8px;right:8px;display:flex;gap:6px}
.nkv-bar{display:flex;justify-content:flex-end;gap:6px;margin-top:6px}
.nkv-btn{min-width:44px;min-height:44px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.35);background:rgba(15,20,26,.62);color:#fff;font:600 12.5px/1 inherit;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;backdrop-filter:blur(6px)}
.nkv-bar .nkv-btn{background:var(--surface,#f3f4f6);color:var(--text,#111827);border-color:var(--border,#e5e7eb);backdrop-filter:none}
.nkv-btn[aria-pressed="true"]{background:var(--green,#0f6e56);border-color:var(--green,#0f6e56);color:#fff}
.nkv-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.nkv-hint{position:absolute;z-index:4;left:50%;bottom:14px;transform:translateX(-50%);display:none;min-height:44px;padding:0 16px;border-radius:999px;border:0;background:#fff;color:#111;font:700 13px/1 inherit;cursor:pointer}
.nkv-box.nkv-fs{background:#000;height:100%}
.nkv-box.nkv-fs .nkv-stage{flex:1;aspect-ratio:auto;max-height:none;height:auto;border:0;border-radius:0}
.nkv-box.nkv-fs .nkv-bar{margin:0;padding:6px;background:#000}
.nkv-box.nkv-land{position:fixed;inset:0;z-index:2147483000;background:#000;height:100vh;height:100dvh}
.nkv-box.nkv-land .nkv-stage{flex:1;aspect-ratio:auto;max-height:none;height:auto;border:0;border-radius:0}
.nkv-box.nkv-land .nkv-hint{display:inline-flex}
.nkv-box.nkv-land.nkv-fs .nkv-hint{display:none}
.nkv-err{position:absolute;inset:0;z-index:2;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;color:#e5e7eb;font-size:13px;background:center/contain no-repeat}
.nkv-err strong{font-size:14px;color:#fff}
.nkv-err a,.nkv-open{color:#fff;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:12px 16px;font-weight:600;font-size:12.5px;text-decoration:none;min-height:44px;box-sizing:border-box}
.nkv-thumbs{display:flex;gap:8px;margin:10px 0 0;overflow-x:auto;max-width:100%;padding-bottom:2px}
.nkv-thumb{flex:0 0 auto;width:72px;min-height:44px;aspect-ratio:16/10;border-radius:8px;border:2px solid transparent;background:#1f3a33 center/cover no-repeat;cursor:pointer;position:relative;padding:0;color:#fff;font-size:11px;font-weight:700}
.nkv-thumb[aria-current="true"]{border-color:var(--green,#0f6e56)}
.nkv-thumb:focus-visible{outline:2px solid var(--green,#0f6e56);outline-offset:2px}
.nkv-thumb span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.28);border-radius:6px}
.nkv-badge{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--surface,#f3f4f6);color:var(--text-2,#4b5563);border:1px solid var(--border,#e5e7eb)}
@media (max-width:640px){.nkv-stage{aspect-ratio:4/5;max-height:78vh}.nkv-stage[data-theater="1"]{aspect-ratio:3/4;max-height:85vh}}
@media (prefers-reduced-motion:reduce){.nkv *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}`;
    document.head.appendChild(st);
  }

  /* ── Environment helpers ───────────────────────────────────── */
  const IS_IOS = typeof navigator !== 'undefined' && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  const reducedMotion = () => !!(root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches);
  function lowEnd() {
    const n = root.navigator || {}, c = n.connection || {};
    return reducedMotion() || (n.hardwareConcurrency || 4) < 6 || c.saveData || /cellular|2g|3g/.test((c.type || '') + (c.effectiveType || ''));
  }
  const SVG = {
    play: '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>',
    expand: '<svg viewBox="0 0 24 24"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
    full: '<svg viewBox="0 0 24 24"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>'
  };
  const themeMemo = {};
  /* Thumbnail for the blurred backdrop and the click-to-play face. */
  async function thumbFor(d) {
    if (d.poster) return d.poster;
    if (d.provider === 'youtube' && d.id) return `https://i.ytimg.com/vi/${d.id}/hqdefault.jpg`;
    if (d.provider !== 'vimeo' && d.provider !== 'tiktok') return '';
    const key = 'nkv-th:' + d.original;
    if (themeMemo[key] !== undefined) return themeMemo[key];
    try { const c = root.sessionStorage.getItem(key); if (c !== null) return (themeMemo[key] = c); } catch (e) { /* storage off */ }
    let out = '';
    try {
      const api = d.provider === 'vimeo' ? 'https://vimeo.com/api/oembed.json?url=' : 'https://www.tiktok.com/oembed?url=';
      const r = await fetch(api + encodeURIComponent(d.original));
      if (r.ok) { const j = await r.json(); out = /^https:\/\//.test(j.thumbnail_url || '') ? j.thumbnail_url : ''; d.oembedRatio = j.width && j.height ? j.width / j.height : null; }
    } catch (e) { /* oEmbed is best effort; the theme gradient is used instead */ }
    themeMemo[key] = out;
    try { root.sessionStorage.setItem(key, out); } catch (e) { /* ignore */ }
    return out;
  }

  /* ── Rendering ─────────────────────────────────────────────── */
  function errHtml(d, title) {
    const bg = d.poster ? `style="background-image:url('${esc(d.poster)}')"` : '';
    return `<div class="nkv-err" ${bg}><strong>${esc(title || 'Video unavailable')}</strong>${d.original ? `<a href="${esc(d.original)}" rel="noopener noreferrer">Open original</a>` : ''}</div>`;
  }
  function thumbStyle(v) {
    const d = describe(v);
    const p = d.poster || (d.provider === 'youtube' && d.id ? `https://i.ytimg.com/vi/${d.id}/default.jpg` : '');
    return p ? `style="background-image:url('${esc(p)}')"` : '';
  }
  function stageHtml(v, opts, state) {
    const d = describe(v);
    const ratio = clampRatio(d.ratio);
    const label = esc(opts && opts.label || 'Video walkthrough');
    const poster = d.poster ? `background-image:url('${esc(d.poster)}')` : '';
    const isFile = d.kind === 'file', isEmbed = d.kind === 'embed';
    let inner = '';
    if (isFile) {
      inner = `<video playsinline preload="metadata" controlsList="nodownload" ${d.poster ? `poster="${esc(d.poster)}"` : ''} src="${esc(d.src)}" aria-label="${label}" data-nkv-file="1" data-vid="${esc(v.id)}" ${d.ratio ? '' : 'data-nkv-measure="1"'}></video><button type="button" class="nkv-face" aria-label="Play video" style="${poster};background-color:transparent"><span class="nkv-play">${SVG.play}</span></button>`;
    } else if (isEmbed) {
      inner = `<button type="button" class="nkv-face" aria-label="Play video" data-nkv-embed="1" style="${poster}"><span class="nkv-play">${SVG.play}</span></button>`;
    } else {
      inner = errHtml(d, 'Open this video on its site');
    }
    const btns = `<button type="button" class="nkv-btn" data-act="theater" aria-pressed="${state.theater ? 'true' : 'false'}" aria-label="Expand video" title="Expand">${SVG.expand}<span>Expand</span></button>`
      + `<button type="button" class="nkv-btn" data-act="full" aria-label="Fullscreen" title="Fullscreen">${SVG.full}</button>`
      + (isFile ? `<button type="button" class="nkv-btn" data-act="fill" aria-pressed="false" aria-label="Fill the stage" title="Fill crops the top and bottom">Fill</button>` : '');
    const stage = `<div class="nkv-stage" style="--r:${ratio.toFixed(4)}" data-orient="${orientationOf(ratio)}" data-theater="${state.theater ? 1 : 0}" data-fill="0" data-loading="1"><div class="nkv-bg" aria-hidden="true"><i style="${poster}"></i></div><div class="nkv-player">${inner}</div>${isFile ? `<div class="nkv-ctl">${btns}</div>` : ''}<button type="button" class="nkv-hint">Tap to go fullscreen</button></div>`;
    return `<div class="nkv-box" data-kind="${d.kind}">${stage}${isEmbed ? `<div class="nkv-bar">${btns}</div>` : ''}</div>`;
  }

  function mountInto(el, videos, opts) {
    if (!el) return;
    injectCss();
    opts = opts || {};
    const list = (videos || []).filter((v) => v && v.url);
    if (!list.length) { el.innerHTML = ''; return; }
    const state = { theater: false };
    try { state.theater = root.sessionStorage.getItem('nkv-theater') === '1'; } catch (e) { /* ignore */ }
    let idx = Math.min(opts.index || 0, list.length - 1);
    let cleanup = [];
    const draw = () => {
      cleanup.forEach((f) => f()); cleanup = [];
      const v = list[idx], d = describe(v);
      el.innerHTML = `<div class="nkv">${stageHtml(v, opts, state)}${list.length > 1 ? `<div class="nkv-thumbs" role="tablist" aria-label="Videos">${list.map((x, i) => `<button type="button" class="nkv-thumb" role="tab" data-i="${i}" aria-selected="${i === idx}" aria-current="${i === idx}" aria-label="Video ${i + 1} of ${list.length}" ${thumbStyle(x)}><span>${i + 1}</span></button>`).join('')}</div>` : ''}</div>`;
      el.querySelectorAll('.nkv-thumb').forEach((b) => b.addEventListener('click', () => { idx = Number(b.dataset.i); draw(); }));
      const box = el.querySelector('.nkv-box'), stage = box.querySelector('.nkv-stage');
      const bg = stage.querySelector('.nkv-bg i'), vid = stage.querySelector('video[data-nkv-file]');
      const player = stage.querySelector('.nkv-player');
      const fit = () => {
        const r = Number(stage.style.getPropertyValue('--r')) || 1.7778, sw = stage.clientWidth, sh = stage.clientHeight;
        if (!sw || !sh) return;
        const h = Math.min(sh, sw / r);
        player.style.height = h.toFixed(1) + 'px'; player.style.width = (h * r).toFixed(1) + 'px';
      };
      const setRatio = (r) => { const c = clampRatio(r); stage.style.setProperty('--r', c.toFixed(4)); stage.dataset.orient = orientationOf(c); fit(); };
      fit();
      if (root.ResizeObserver) { const ro = new root.ResizeObserver(fit); ro.observe(stage); cleanup.push(() => ro.disconnect()); } else { root.addEventListener('resize', fit); cleanup.push(() => root.removeEventListener('resize', fit)); }
      const ready = () => { stage.dataset.loading = '0'; };

      /* Backdrop: poster first, then the provider thumbnail, else the theme gradient. */
      if (!d.poster) thumbFor(d).then((u) => {
        if (u && bg.isConnected) bg.style.backgroundImage = `url('${u}')`;
        if (u) { const face = stage.querySelector('.nkv-face[data-nkv-embed]'); if (face) face.style.backgroundImage = `url('${u}')`; }
        if (d.oembedRatio && !d.ratio) setRatio(d.oembedRatio);
        ready();
      }); else ready();

      /* Fullscreen, theater and Fill */
      const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
      const isFs = () => fsEl() === box;
      const canBoxFs = !!(box.requestFullscreen || box.webkitRequestFullscreen);
      const fullBtn = box.querySelector('[data-act="full"]');
      if (!canBoxFs && !(vid && vid.webkitEnterFullscreen)) fullBtn.hidden = true;
      const lockOrientation = async () => {
        try { if (!IS_IOS && screen.orientation && screen.orientation.lock && stage.dataset.orient === 'landscape') await screen.orientation.lock('landscape'); } catch (e) { /* not supported or refused */ }
      };
      const unlockOrientation = () => { try { screen.orientation && screen.orientation.unlock && screen.orientation.unlock(); } catch (e) { /* ignore */ } };
      const enterFs = async () => {
        try {
          if (IS_IOS && vid && vid.webkitEnterFullscreen) { vid.webkitEnterFullscreen(); return true; }
          if (box.requestFullscreen) await box.requestFullscreen(); else if (box.webkitRequestFullscreen) box.webkitRequestFullscreen(); else return false;
          lockOrientation();
          return true;
        } catch (e) { return false; }
      };
      const exitFs = () => { try { (document.exitFullscreen || document.webkitExitFullscreen).call(document); } catch (e) { /* ignore */ } };
      const onFsChange = () => { box.classList.toggle('nkv-fs', isFs()); if (!isFs()) unlockOrientation(); };
      document.addEventListener('fullscreenchange', onFsChange);
      document.addEventListener('webkitfullscreenchange', onFsChange);
      cleanup.push(() => { document.removeEventListener('fullscreenchange', onFsChange); document.removeEventListener('webkitfullscreenchange', onFsChange); if (isFs()) exitFs(); });

      box.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act]'); if (!b) return;
        const a = b.dataset.act;
        if (a === 'theater') {
          state.theater = !state.theater; try { root.sessionStorage.setItem('nkv-theater', state.theater ? '1' : '0'); } catch (x) { /* ignore */ }
          box.querySelectorAll('[data-act="theater"]').forEach((t) => t.setAttribute('aria-pressed', state.theater ? 'true' : 'false'));
          stage.dataset.theater = state.theater ? '1' : '0'; fit();
        } else if (a === 'full') { isFs() ? exitFs() : enterFs(); }
        else if (a === 'fill') { const on = stage.dataset.fill !== '1'; stage.dataset.fill = on ? '1' : '0'; b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
      });
      box.addEventListener('keydown', (e) => { if (e.key === 'Escape' && state.theater && !isFs()) { box.querySelector('[data-act="theater"]').click(); } });
      box.querySelector('.nkv-hint').addEventListener('click', () => enterFs());

      /* Click to play: uploaded files reveal native controls; embeds swap in the provider player. */
      const face = stage.querySelector('.nkv-face');
      if (vid) {
        face.addEventListener('click', () => { vid.controls = true; face.remove(); vid.play().catch(() => {}); });
        vid.addEventListener('play', () => { vid.controls = true; if (face.isConnected) face.remove(); });
        vid.addEventListener('error', () => { stage.querySelector('.nkv-player').innerHTML = errHtml(d, 'Video unavailable'); ready(); });
        vid.addEventListener('loadedmetadata', () => {
          if (vid.dataset.nkvMeasure && vid.videoWidth && vid.videoHeight) {
            setRatio(vid.videoWidth / vid.videoHeight);
            if (opts.canEdit && opts.db && v.id) opts.db.rpc('set_listing_video_ratio', { p_video_id: v.id, p_width: vid.videoWidth, p_height: vid.videoHeight }).then(() => {}, () => {});
          }
          ready();
        }, { once: true });
        /* No stored poster: a muted, blurred second copy of the video fills the side space when the device can afford it. */
        if (!d.poster && !lowEnd() && stage.dataset.orient !== 'landscape') {
          const bv = document.createElement('video');
          bv.muted = true; bv.playsInline = true; bv.preload = 'none'; bv.src = d.src; bv.setAttribute('aria-hidden', 'true'); bv.tabIndex = -1;
          stage.querySelector('.nkv-bg').appendChild(bv);
          vid.addEventListener('play', () => { bv.currentTime = vid.currentTime; bv.play().catch(() => {}); });
          vid.addEventListener('pause', () => bv.pause());
          vid.addEventListener('seeked', () => { bv.currentTime = vid.currentTime; });
          vid.addEventListener('timeupdate', () => { if (Math.abs(bv.currentTime - vid.currentTime) > 0.4) bv.currentTime = vid.currentTime; });
        }
        /* Phone turned sideways while playing: switch to the full-bleed landscape layout. */
        const mq = root.matchMedia ? root.matchMedia('(orientation: landscape)') : null;
        let autoFs = false;
        const sideways = () => !!(mq && mq.matches && root.matchMedia('(pointer: coarse)').matches && root.innerHeight <= 520);
        const applyTurn = async () => {
          const playing = !vid.paused && !vid.ended;
          if (sideways() && playing) {
            box.classList.add('nkv-land');
            if (!isFs() && !IS_IOS && box.requestFullscreen) { autoFs = await enterFs(); }
          } else if (!sideways()) {
            box.classList.remove('nkv-land');
            if (autoFs && isFs()) exitFs();
            autoFs = false;
          }
        };
        if (mq) {
          const h = () => applyTurn();
          (mq.addEventListener ? mq.addEventListener('change', h) : mq.addListener(h));
          cleanup.push(() => (mq.removeEventListener ? mq.removeEventListener('change', h) : mq.removeListener(h)));
          vid.addEventListener('play', h);
          vid.addEventListener('pause', () => { if (!sideways()) box.classList.remove('nkv-land'); });
        }
      } else if (face && face.dataset.nkvEmbed) {
        face.addEventListener('click', () => {
          const sep = d.src.includes('?') ? '&' : '?';
          const src = d.src + (d.provider === 'youtube' ? `${sep}autoplay=1&playsinline=1&rel=0` : '');
          const f = document.createElement('iframe');
          f.src = src; f.title = opts.label || 'Video walkthrough'; f.allowFullscreen = true;
          f.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture');
          f.referrerPolicy = 'strict-origin-when-cross-origin';
          f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox');
          f.addEventListener('load', ready);
          face.replaceWith(f);
          f.focus();
        });
      } else ready();
    };
    draw();
  }

  /* ── Limits and file checks ────────────────────────────────── */
  async function loadLimits(db) {
    const out = { seconds: 60, mb: 50 };
    try {
      const { data } = await db.from('platform_settings').select('key,value').in('key', ['video_max_seconds', 'video_max_mb']);
      (data || []).forEach((r) => { const n = num(r.value); if (n > 0) { if (r.key === 'video_max_seconds') out.seconds = n; else out.mb = n; } });
    } catch (e) { /* defaults */ }
    return out;
  }

  function readMeta(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      v.muted = true; v.preload = 'metadata'; v.playsInline = true;
      const done = (fn, arg) => { clearTimeout(t); fn(arg); };
      const t = setTimeout(() => { URL.revokeObjectURL(url); reject(new Error('timeout')); }, 12000);
      v.onerror = () => { URL.revokeObjectURL(url); done(reject, new Error('unreadable')); };
      v.onloadedmetadata = () => {
        const meta = { duration_seconds: Math.round(v.duration * 100) / 100, width: v.videoWidth, height: v.videoHeight };
        if (!meta.width || !meta.height || !Number.isFinite(v.duration)) { URL.revokeObjectURL(url); return done(reject, new Error('unreadable')); }
        const seekTo = Math.min(1, Math.max(0.1, v.duration / 2));
        v.onseeked = () => {
          let poster = null;
          try {
            const scale = Math.min(1, 1280 / meta.width);
            const c = document.createElement('canvas');
            c.width = Math.round(meta.width * scale); c.height = Math.round(meta.height * scale);
            c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
            c.toBlob((b) => { URL.revokeObjectURL(url); done(resolve, { meta, poster: b }); }, 'image/jpeg', 0.8);
            return;
          } catch (e) { /* poster is optional */ }
          URL.revokeObjectURL(url); done(resolve, { meta, poster });
        };
        try { v.currentTime = seekTo; } catch (e) { URL.revokeObjectURL(url); done(resolve, { meta, poster: null }); }
      };
      v.src = url;
    });
  }

  async function prepareFile(file, limits) {
    limits = limits || { seconds: 60, mb: 50 };
    if (!file) return { error: 'Choose a video file.' };
    const type = file.type || '';
    if (!MIME_EXT[type]) return { error: 'Use an MP4, WebM or MOV video. iPhone videos saved as HEVC may need to be set to "Most Compatible" in Camera settings.' };
    if (file.size > limits.mb * 1048576) return { error: `That file is ${(file.size / 1048576).toFixed(0)} MB. The limit is ${limits.mb} MB.` };
    let r;
    try { r = await readMeta(file); } catch (e) { return { error: 'We could not read that video. If it came from an iPhone, set Camera to "Most Compatible" or try another file.' }; }
    if (r.meta.duration_seconds > limits.seconds + 0.5) return { error: `That video is ${Math.round(r.meta.duration_seconds)} seconds. The limit is ${limits.seconds} seconds.` };
    const ratio = r.meta.width / r.meta.height;
    return { file, type, meta: { ...r.meta, aspect_ratio: Math.round(ratio * 10000) / 10000, orientation: orientationOf(ratio), mime_type: type }, poster: r.poster };
  }

  /* ── Upload ────────────────────────────────────────────────── */
  function uuid() { return (root.crypto && root.crypto.randomUUID) ? root.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`; }
  const publicUrl = (db, path) => `${db.supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

  function xhrUpload(db, token, path, blob, type, onProgress, signal) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open('POST', `${db.supabaseUrl}/storage/v1/object/${BUCKET}/${path}`);
      x.setRequestHeader('Authorization', 'Bearer ' + token);
      x.setRequestHeader('apikey', db.supabaseKey);
      x.setRequestHeader('Content-Type', type);
      x.setRequestHeader('x-upsert', 'false');
      x.setRequestHeader('cache-control', 'max-age=31536000');
      if (x.upload && onProgress) x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
      x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`Upload failed (${x.status})`)));
      x.onerror = () => reject(new Error('Network error during upload'));
      x.onabort = () => reject(new Error('Upload cancelled'));
      if (signal) signal.addEventListener('abort', () => x.abort());
      x.send(blob);
    });
  }

  /* Returns { path, url, posterUrl }. The listing must already exist. */
  async function uploadFile(db, listingId, prepared, onProgress, signal) {
    const { data: { session } } = await db.auth.getSession();
    if (!session) throw new Error('Please sign in again to upload.');
    const id = uuid();
    const path = `${listingId}/${id}.${MIME_EXT[prepared.type]}`;
    await xhrUpload(db, session.access_token, path, prepared.file, prepared.type, onProgress, signal);
    let posterUrl = null;
    if (prepared.poster) {
      try {
        const pp = `${listingId}/${id}.jpg`;
        await xhrUpload(db, session.access_token, pp, prepared.poster, 'image/jpeg', null, signal);
        posterUrl = publicUrl(db, pp);
      } catch (e) { /* the poster is optional */ }
    }
    return { path, url: publicUrl(db, path), posterUrl };
  }

  async function saveUpload(db, listingId, prepared, uploaded) {
    const meta = { ...prepared.meta, poster_url: uploaded.posterUrl };
    const { data, error } = await db.rpc('save_listing_video', { p_listing_id: listingId, p_source: 'upload', p_url: uploaded.url, p_storage_path: uploaded.path, p_meta: meta });
    if (error) {
      await db.storage.from(BUCKET).remove([uploaded.path].concat(uploaded.posterUrl ? [uploaded.posterUrl.split(`/${BUCKET}/`)[1]] : [])).catch(() => {});
      throw error;
    }
    return data;
  }

  async function saveLink(db, listingId, url) {
    const p = parse(url);
    if (p.provider === 'invalid') throw new Error('Paste a link that starts with https://');
    const meta = {};
    if (p.embed) meta.embed_url = p.embed;
    if (p.ratio) { meta.width = Math.round(p.ratio * 10000); meta.height = 10000; meta.orientation = orientationOf(p.ratio); meta.aspect_ratio = Math.round(p.ratio * 10000) / 10000; }
    const { data, error } = await db.rpc('save_listing_video', { p_listing_id: listingId, p_source: 'link', p_url: p.original, p_storage_path: null, p_meta: meta });
    if (error) throw error;
    return data;
  }

  async function remove(db, videoId) {
    const { data, error } = await db.rpc('delete_listing_video', { p_video_id: videoId });
    if (error) throw error;
    const paths = [data && data.storage_path, data && data.poster_path].filter(Boolean);
    if (paths.length) await db.storage.from(BUCKET).remove(paths).catch(() => {});
    return data;
  }

  /* Removes every stored file under <listingId>/ . Call after the listing rows are deleted. */
  async function purgeListingFiles(db, listingIds) {
    for (const id of [].concat(listingIds)) {
      try {
        const { data } = await db.storage.from(BUCKET).list(String(id), { limit: 100 });
        const paths = (data || []).filter((f) => f.name).map((f) => `${id}/${f.name}`);
        if (paths.length) await db.storage.from(BUCKET).remove(paths);
      } catch (e) { /* orphan listing keeps files; admin_list_orphan_videos reports them */ }
    }
  }

  const ERRORS = {
    VIDEO_LIMIT_REACHED: 'You have reached the video limit for this listing on your plan.',
    VIDEO_WALKTHROUGH_BLOCKED: 'Video walkthroughs are turned off for this account. Contact support.',
    VIDEO_TOO_LARGE: 'That file is larger than the allowed size.',
    VIDEO_TOO_LONG: 'That video is longer than the allowed length.',
    VIDEO_BAD_TYPE: 'Use an MP4, WebM or MOV video.',
    VIDEO_URL_MUST_BE_HTTPS: 'Video links must start with https://',
    VIDEO_LISTING_ACCESS_DENIED: 'You cannot change videos on this listing.',
    VIDEO_FILE_MISSING: 'The upload did not finish. Please try again.',
    VIDEO_AUTH_REQUIRED: 'Please sign in again.',
  };
  function friendlyError(e) {
    const m = String((e && (e.message || e.details)) || e || '');
    const k = Object.keys(ERRORS).find((x) => m.includes(x));
    return k ? ERRORS[k] : (m || 'Something went wrong.');
  }

  return { BUCKET, clampRatio, orientationOf, parse, describe, mountInto, loadLimits, prepareFile, uploadFile, saveUpload, saveLink, remove, purgeListingFiles, friendlyError, stageHtml, injectCss, esc };
});
