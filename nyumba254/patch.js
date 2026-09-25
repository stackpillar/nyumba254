/* ============================================================
   Nyumba254 patch.js — additive features, non-destructive.
   Does NOT rely on internal page state (it's IIFE-scoped and
   inaccessible). Fetches its own data via the global `db` client
   from nk-shared.js.
   ============================================================ */
(function () {
  'use strict';

  const onReady = fn => document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', fn)
    : fn();

  const esc = s => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  function getListingNumberFromUrl() {
    const id = new URLSearchParams(location.search).get('id');
    if (!id || !/^\d+$/.test(id)) return null;
    return parseInt(id, 10);
  }

  // Waits for the global `db` client (from nk-shared.js) to exist,
  // then fetches the listing itself. Independent of the page's own
  // internal fetch/render cycle entirely.
  function waitForDb(cb, tries) {
    tries = tries || 0;
    if (typeof window.db !== 'undefined') { cb(window.db); return; }
    if (tries > 40) return; // ~10s, give up quietly
    setTimeout(() => waitForDb(cb, tries + 1), 250);
  }

  let cachedListing = null, cachedListingPromise = null;
  function fetchListingOnce() {
    if (cachedListingPromise) return cachedListingPromise;
    cachedListingPromise = new Promise(resolve => {
      const num = getListingNumberFromUrl();
      if (!num) { resolve(null); return; }
      waitForDb(async db => {
        try {
          const { data, error } = await db.from('listings')
            .select('*, listing_photos(*)')
            .eq('listing_number', num)
            .single();
          if (error || !data) { resolve(null); return; }
          cachedListing = data;
          resolve(data);
        } catch (e) { resolve(null); }
      });
    });
    return cachedListingPromise;
  }

  /* ---------- Feature 1: Move-in cost calculator (listing.html) ---------- */
  async function initMoveInCalculator() {
    if (!document.getElementById('side')) return; // not listing.html
    const L = await fetchListingOnce();
    if (!L || L.status === 'occupied') return;

    const insert = () => {
      if (document.getElementById('nk-movein-calc')) return;
      const priceEl = document.querySelector('.s-price');
      const scard = priceEl && priceEl.closest('.scard');
      if (!scard) { setTimeout(insert, 400); return; }

      const price = Number(L.price) || 0;
      if (!price) return;
      const isRent = (L.price_frequency || 'month') === 'month';
      if (!isRent) return;
      const depositMonths = Number((L.details || {}).deposit_months);
      const deposit = isNaN(depositMonths) ? 1 : depositMonths;
      const total = price + (price * deposit);

      const box = document.createElement('div');
      box.id = 'nk-movein-calc';
      box.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:12px 14px;margin-top:14px;font-size:13px';
      box.innerHTML = `
        <button type="button" id="nk-mic-toggle" style="width:100%;display:flex;justify-content:space-between;align-items:center;background:none;border:none;cursor:pointer;font-size:13px;font-weight:700;color:var(--green-dark)">
          <span>💰 Estimated move-in cost</span><span id="nk-mic-chevron">▾</span>
        </button>
        <div id="nk-mic-body" style="margin-top:10px">
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span>First month rent</span><span>KES ${price.toLocaleString('en-KE')}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0"><span>Deposit (${deposit} month${deposit===1?'':'s'})</span><span>KES ${(price*deposit).toLocaleString('en-KE')}</span></div>
          <div style="display:flex;justify-content:space-between;padding:8px 0;margin-top:4px;border-top:1px dashed var(--border);font-weight:800;color:var(--green-dark)"><span>Estimated total</span><span>KES ${total.toLocaleString('en-KE')}</span></div>
          <div style="font-size:11px;color:var(--text-3);margin-top:6px">No agent commission on Nyumba254 — this estimate already reflects that. Confirm exact deposit terms with the seller.</div>
        </div>`;
      scard.insertBefore(box, scard.querySelector('.cbtns, .phone-panel, #enq') || null);
      document.getElementById('nk-mic-toggle').addEventListener('click', () => {
        const body = document.getElementById('nk-mic-body');
        const open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        document.getElementById('nk-mic-chevron').textContent = open ? '▸' : '▾';
      });
    };
    insert();
  }

  /* ---------- Feature 2: WhatsApp group-share text (listing.html share modal) ---------- */
  function patchShareModal() {
    const grid = document.getElementById('share-grid');
    if (!grid) return;
    const obs = new MutationObserver(async () => {
      if (grid.querySelector('[data-nk-group-share]')) return;
      if (!grid.children.length) return;
      const L = await fetchListingOnce();
      if (!L) return;
      const url = location.origin + '/listing?id=' + String(L.listing_number).padStart(6, '0');
      const price = Number(L.price || 0).toLocaleString('en-KE');
      const groupText = `🏠 *${L.title}*\n📍 ${L.area || ''}${L.county ? ', ' + L.county : ''}\n💰 KES ${price}${L.price_frequency === 'month' ? '/month' : ''}\n\nSee full details & photos:\n${url}\n\n(via Nyumba254 — no agent fees)`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('data-nk-group-share', '1');
      btn.innerHTML = '<span>👥</span>Copy for group chat';
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(groupText).then(() => {
          btn.innerHTML = '<span>✓</span>Copied!';
          setTimeout(() => { btn.innerHTML = '<span>👥</span>Copy for group chat'; }, 2000);
        });
      });
      grid.appendChild(btn);
    });
    obs.observe(grid, { childList: true });
  }

  /* ---------- Feature 3: Negotiable / first-month-discount badge ---------- */
  async function addNegotiableBadge() {
    const pillsEl = document.querySelector('.pills');
    if (!pillsEl) return;
    const L = await fetchListingOnce();
    if (!L) return;
    if (L.first_month_discount && !pillsEl.querySelector('[data-nk-discount]')) {
      const p = document.createElement('span');
      p.className = 'pill plain';
      p.setAttribute('data-nk-discount', '1');
      p.textContent = '🎉 First month discount';
      pillsEl.appendChild(p);
    }
    if (L.price_negotiable && !pillsEl.querySelector('[data-nk-negotiable]')) {
      const p = document.createElement('span');
      p.className = 'pill plain';
      p.setAttribute('data-nk-negotiable', '1');
      p.textContent = '💬 Negotiable';
      pillsEl.appendChild(p);
    }
  }

  /* ---------- Feature 4: Commute-distance line (listing.html) ---------- */
  async function addCommuteNote() {
    const mapSection = document.getElementById('sec-loc');
    if (!mapSection || document.getElementById('nk-commute')) return;
    const L = await fetchListingOnce();
    if (!L) return;
    const box = document.createElement('div');
    box.id = 'nk-commute';
    box.style.cssText = 'margin-top:12px;padding:10px 12px;background:var(--surface);border-radius:8px;font-size:12.5px;color:var(--text-2)';
    box.innerHTML = `
      <label for="nk-commute-input" style="font-weight:700;display:block;margin-bottom:6px">📍 Check distance to a place you know</label>
      <div style="display:flex;gap:6px">
        <input id="nk-commute-input" type="text" placeholder="e.g. Kondele, CBD, my campus" style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:6px;font-size:12.5px"/>
        <button type="button" id="nk-commute-btn" style="padding:7px 12px;background:var(--green);color:#fff;border:none;border-radius:6px;font-size:12.5px;font-weight:700;cursor:pointer">Check</button>
      </div>
      <div id="nk-commute-result" style="margin-top:8px"></div>`;
    mapSection.appendChild(box);
    document.getElementById('nk-commute-btn').addEventListener('click', async () => {
      const q = document.getElementById('nk-commute-input').value.trim();
      const resultEl = document.getElementById('nk-commute-result');
      if (!q) return;
      resultEl.textContent = 'Checking…';
      try {
        const la = parseFloat(L.latitude), ln = parseFloat(L.longitude);
        if (!isFinite(la) || !isFinite(ln)) { resultEl.textContent = 'Exact location not pinned for this listing yet.'; return; }
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ke&q=${encodeURIComponent(q + ', Kenya')}`);
        const data = await r.json();
        if (!data || !data[0]) { resultEl.textContent = 'Could not find that place — try a more specific name.'; return; }
        const dLat = parseFloat(data[0].lat), dLon = parseFloat(data[0].lon);
        const R = 6371, toRad = x => x * Math.PI / 180;
        const dLatR = toRad(dLat - la), dLonR = toRad(dLon - ln);
        const a = Math.sin(dLatR/2)**2 + Math.cos(toRad(la)) * Math.cos(toRad(dLat)) * Math.sin(dLonR/2)**2;
        const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        resultEl.innerHTML = `<strong>${dist.toFixed(1)} km</strong> straight-line distance to ${esc(q)}. Actual travel time will vary by traffic and route.`;
      } catch (e) {
        resultEl.textContent = 'Could not check distance right now.';
      }
    });
  }

  onReady(() => {
    try { initMoveInCalculator(); } catch (e) { console.warn('nk-movein patch failed', e); }
    try { patchShareModal(); } catch (e) { console.warn('nk-share patch failed', e); }
    try { addNegotiableBadge(); } catch (e) { console.warn('nk-badge patch failed', e); }
    try { addCommuteNote(); } catch (e) { console.warn('nk-commute patch failed', e); }
  });
})();