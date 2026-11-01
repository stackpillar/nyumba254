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
      if (m) return { provider: 'youtube', id: m[1], embed: `https://www.youtube-nocookie.com/embed/${m[1]}`, ratio: 16 / 9, original: u.href };
    }
    if (/(^|\.)youtube(-nocookie)?\.com$/.test(h)) {
      if ((m = path.match(/^\/shorts\/([\w-]{6,15})/))) return { provider: 'youtube', id: m[1], embed: `https://www.youtube-nocookie.com/embed/${m[1]}`, ratio: 9 / 16, short: true, original: u.href };
      if ((m = path.match(/^\/(?:embed|live|v)\/([\w-]{6,15})/))) return { provider: 'youtube', id: m[1], embed: `https://www.youtube-nocookie.com/embed/${m[1]}`, ratio: 16 / 9, original: u.href };
      const v = u.searchParams.get('v');
      if (v && /^[\w-]{6,15}$/.test(v)) return { provider: 'youtube', id: v, embed: `https://www.youtube-nocookie.com/embed/${v}`, ratio: 16 / 9, original: u.href };
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
    if (p.embed) return { kind: 'embed', src: v.embed_url && /^https:\/\//.test(v.embed_url) ? v.embed_url : p.embed, poster: v.poster_url || '', ratio: num(v.aspect_ratio) || p.ratio, original: p.original, provider: p.provider };
    return { kind: 'link', src: '', poster: v.poster_url || '', ratio: num(v.aspect_ratio) || p.ratio, original: p.original || url, provider: p.provider };
  }

  /* ── Styles ────────────────────────────────────────────────── */
  function injectCss() {
    if (typeof document === 'undefined' || document.getElementById('nkv-css')) return;
    const st = document.createElement('style');
    st.id = 'nkv-css';
    st.textContent = `
.nkv{width:100%;margin:0 auto}
.nkv-frame{--r:1.7778;position:relative;width:100%;max-width:min(100%,calc(70vh * var(--r)));aspect-ratio:var(--r);margin:0 auto;background:#0b0f14;border:1px solid var(--border,#e5e7eb);border-radius:var(--radius-lg,14px);overflow:hidden}
.nkv-frame video,.nkv-frame iframe,.nkv-frame .nkv-poster{position:absolute;inset:0;width:100%;height:100%;border:0;background:#0b0f14}
.nkv-frame video,.nkv-frame .nkv-poster{object-fit:contain}
.nkv-err{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:16px;text-align:center;color:#e5e7eb;font-size:13px;background:#0b0f14 center/contain no-repeat}
.nkv-err strong{font-size:14px;color:#fff}
.nkv-err a,.nkv-open{color:#fff;background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:7px 14px;font-weight:600;font-size:12.5px;text-decoration:none}
.nkv-thumbs{display:flex;gap:8px;margin:10px auto 0;overflow-x:auto;max-width:100%;padding-bottom:2px}
.nkv-thumb{flex:0 0 auto;width:72px;aspect-ratio:16/10;border-radius:8px;border:2px solid transparent;background:#0b0f14 center/cover no-repeat;cursor:pointer;position:relative;padding:0;color:#fff;font-size:11px;font-weight:700}
.nkv-thumb[aria-current="true"]{border-color:var(--green,#0f6e56)}
.nkv-thumb:focus-visible{outline:2px solid var(--green,#0f6e56);outline-offset:2px}
.nkv-thumb span{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.28);border-radius:6px}
.nkv-badge{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:999px;background:var(--surface,#f3f4f6);color:var(--text-2,#4b5563);border:1px solid var(--border,#e5e7eb)}
@media (prefers-reduced-motion:reduce){.nkv *{scroll-behavior:auto!important;transition:none!important}}`;
    document.head.appendChild(st);
  }

  /* ── Rendering ─────────────────────────────────────────────── */
  function frameHtml(v, opts) {
    const d = describe(v);
    const ratio = clampRatio(d.ratio);
    const label = esc(opts && opts.label || 'Video walkthrough');
    let inner;
    if (d.kind === 'file') {
      inner = `<video controls playsinline preload="metadata" controlsList="nodownload" ${d.poster ? `poster="${esc(d.poster)}"` : ''} src="${esc(d.src)}" aria-label="${label}" data-nkv-file="1" data-vid="${esc(v.id)}" ${d.ratio ? '' : 'data-nkv-measure="1"'}></video>`;
    } else if (d.kind === 'embed') {
      inner = `<iframe src="${esc(d.src)}" title="${label}" loading="lazy" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"></iframe>`;
    } else {
      inner = errHtml(d, 'Open this video on its site');
    }
    return `<div class="nkv-frame" style="--r:${ratio.toFixed(4)}" data-orient="${orientationOf(ratio)}">${inner}</div>`;
  }
  function errHtml(d, title) {
    const bg = d.poster ? `style="background-image:url('${esc(d.poster)}');background-color:#0b0f14"` : '';
    return `<div class="nkv-err" ${bg}><strong>${esc(title || 'Video unavailable')}</strong>${d.original ? `<a href="${esc(d.original)}" rel="noopener noreferrer">Open original</a>` : ''}</div>`;
  }
  function thumbStyle(v) {
    const p = v.poster_url;
    return p ? `style="background-image:url('${esc(p)}')"` : '';
  }

  function mountInto(el, videos, opts) {
    if (!el) return;
    injectCss();
    opts = opts || {};
    const list = (videos || []).filter((v) => v && v.url);
    if (!list.length) { el.innerHTML = ''; return; }
    let idx = Math.min(opts.index || 0, list.length - 1);
    const draw = () => {
      const v = list[idx];
      el.innerHTML = `<div class="nkv">${frameHtml(v, opts)}${list.length > 1 ? `<div class="nkv-thumbs" role="tablist" aria-label="Videos">${list.map((x, i) => `<button type="button" class="nkv-thumb" role="tab" data-i="${i}" aria-current="${i === idx}" aria-label="Video ${i + 1} of ${list.length}" ${thumbStyle(x)}><span>${i + 1}</span></button>`).join('')}</div>` : ''}</div>`;
      el.querySelectorAll('.nkv-thumb').forEach((b) => b.addEventListener('click', () => { idx = Number(b.dataset.i); draw(); }));
      el.querySelectorAll('video[data-nkv-file]').forEach((vid) => {
        const frame = vid.closest('.nkv-frame');
        vid.addEventListener('error', () => { frame.innerHTML = errHtml(describe(v), 'Video unavailable'); });
        if (vid.dataset.nkvMeasure) {
          vid.addEventListener('loadedmetadata', () => {
            if (!vid.videoWidth || !vid.videoHeight) return;
            frame.style.setProperty('--r', clampRatio(vid.videoWidth / vid.videoHeight).toFixed(4));
            if (opts.canEdit && opts.db && v.id) opts.db.rpc('set_listing_video_ratio', { p_video_id: v.id, p_width: vid.videoWidth, p_height: vid.videoHeight }).then(() => {}, () => {});
          }, { once: true });
        }
      });
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
    if (p.ratio) { meta.width = Math.round(p.ratio * 1000); meta.height = 1000; }
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

  return { BUCKET, clampRatio, orientationOf, parse, describe, mountInto, loadLimits, prepareFile, uploadFile, saveUpload, saveLink, remove, purgeListingFiles, friendlyError, frameHtml, injectCss, esc };
});
