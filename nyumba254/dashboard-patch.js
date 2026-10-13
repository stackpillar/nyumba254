/* ═══════════════════════════════════════════════════════════════
   Nyumba254 dashboard — patch.js  (Steps 1–4)
   Loaded by <script src="/patch.js"></script> AFTER the main script,
   so every dashboard global (threads, db, showPage…) already exists.

   1. Mobile bottom tab bar + one stacking rule for floating elements
   2. One Inbox (Messages + Enquiries merged, filter chips, lead chips)
   3. Overview "Today" panel + 7/30/90-day chart toggle
   4. Lead stages + viewing scheduler (needs nyumba254-inbox-leads.sql)

   Rollback: delete a section (or this whole file) — nothing else depends on it.
═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__nyPatchLoaded) return;
  // Dashboard only: do nothing on any other page that happens to load this file
  if (!document.getElementById('page-overview') || !document.getElementById('app-shell')) return;
  window.__nyPatchLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => (typeof escHtml === 'function' ? escHtml(s) : String(s == null ? '' : s));
  const escA = (s) => (typeof escAttr === 'function' ? escAttr(s) : String(s == null ? '' : s));
  const safe = (fn) => { try { return fn(); } catch (e) { console.error('[patch.js]', e); } };
  const HOUR = 3600e3, DAY = 864e5;

  /* ─────────────────────────────────────────────
     CSS
  ───────────────────────────────────────────── */
  const css = document.createElement('style');
  css.id = 'ny-patch-css';
  css.textContent = `
  :root{--nyb-h:0px}

  /* ── Step 1: bottom tab bar ── */
  .nyb-bar{display:none}
  @media(max-width:900px){
    :root{--nyb-h:calc(60px + env(safe-area-inset-bottom))}
    .nyb-bar{display:flex;position:fixed;left:0;right:0;bottom:0;height:var(--nyb-h);padding-bottom:env(safe-area-inset-bottom);background:var(--white);border-top:1px solid var(--border);z-index:95;box-shadow:0 -4px 16px rgba(0,0,0,.06)}
    body.nyb-chat .nyb-bar{display:none}
    .nyb-tab{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;color:var(--text-3);font-size:10.5px;font-weight:600;position:relative;min-width:0;background:none;border:none}
    .nyb-tab svg{width:21px;height:21px;stroke:currentColor;fill:none;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
    .nyb-tab.active{color:var(--green)}
    .nyb-tab.active::before{content:'';position:absolute;top:0;left:30%;right:30%;height:3px;border-radius:0 0 3px 3px;background:var(--green)}
    .nyb-tab:focus-visible{outline:2px solid var(--green);outline-offset:-4px;border-radius:10px}
    .nyb-badge{position:absolute;top:5px;left:calc(50% + 6px);min-width:16px;height:16px;padding:0 4px;border-radius:9px;background:var(--red);color:#fff;font-size:9.5px;font-weight:800;display:none;align-items:center;justify-content:center}
    .nyb-badge.show{display:flex}

    /* sidebar drawer sits above the bar */
    .sidebar{bottom:0}
    .page{padding-bottom:calc(var(--nyb-h) + 28px)}
    #page-messages{padding-bottom:0}
    .messages-layout{height:calc(100dvh - var(--topbar-h) - var(--nyb-h))}
    body.nyb-chat .messages-layout{height:calc(100dvh - var(--topbar-h))}

    /* ONE stacking rule for everything that floats at the bottom:
       tab bar (lowest) → support button → bulk bar → undo toast / offline banner */
    #overview-quickdock{display:none !important}
    .scw-fab{bottom:calc(var(--nyb-h) + 14px) !important}
    #listings-bulk-bar{bottom:calc(var(--nyb-h) + 10px) !important}
    .lc-undo{bottom:calc(var(--nyb-h) + 12px) !important}
    body:has(#listings-bulk-bar.open) .lc-undo{bottom:calc(var(--nyb-h) + 76px) !important}
    body:has(#listings-bulk-bar.open) .scw-fab{display:none !important}
    .lc-offline{bottom:var(--nyb-h) !important}
    #tour-offer{bottom:calc(var(--nyb-h) + 12px) !important}
    .toast{bottom:calc(var(--nyb-h) + 12px)}
    .scw-panel{bottom:calc(var(--nyb-h) + 8px)}
  }

  /* ── Step 2: inbox ── */
  .ny-chips{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px 0;align-items:center}
  .ny-chip{font-size:11.5px;font-weight:700;padding:5px 11px;border-radius:20px;border:1.5px solid var(--border);background:var(--white);color:var(--text-2);cursor:pointer;white-space:nowrap}
  .ny-chip:hover{border-color:var(--green);color:var(--green)}
  .ny-chip.active{background:var(--green);border-color:var(--green);color:#fff}
  .ny-chip b{opacity:.75;margin-left:3px}
  .ny-stage-filter{margin-left:auto;font-size:11.5px;font-weight:600;padding:5px 8px;border:1.5px solid var(--border);border-radius:20px;background:var(--white);color:var(--text-2);max-width:130px}
  .ny-meta-row{display:flex;align-items:center;gap:6px;margin-top:5px;flex-wrap:wrap}
  .ny-lead{font-size:10px;font-weight:800;letter-spacing:.02em;padding:2px 8px;border-radius:20px;white-space:nowrap}
  .ny-lead-new{background:#DBEAFE;color:#1e40af}
  .ny-lead-replied{background:var(--green-light);color:var(--green-dark)}
  .ny-lead-viewing{background:#EDE9FE;color:#5b21b6}
  .ny-lead-negotiating{background:var(--amber-light);color:var(--amber)}
  .ny-lead-closed{background:#d1fae5;color:#065f46}
  .ny-lead-lost{background:var(--surface);color:var(--text-3);border:1px solid var(--border)}
  .ny-wait{font-size:10.5px;font-weight:700;color:var(--red)}
  .ny-stage{font-size:12px;font-weight:700;padding:6px 8px;border:1.5px solid var(--border);border-radius:var(--radius);background:var(--white);color:var(--text);max-width:150px}
  .ny-stage:focus{border-color:var(--green);outline:none}
  @media(max-width:480px){.ny-stage{max-width:110px;font-size:11px}}

  /* ── Step 3: today panel ── */
  #ny-today{margin-bottom:20px;padding:20px 22px;border-left:4px solid var(--green)}
  .ny-today-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:4px}
  .ny-today-head h2{font-size:17px;font-weight:700}
  .ny-today-sub{font-size:12.5px;color:var(--text-3);margin-bottom:14px}
  .ny-today-row{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--border)}
  .ny-today-row:first-of-type{border-top:none}
  .ny-today-ico{width:34px;height:34px;border-radius:10px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
  .ny-today-row.urgent .ny-today-ico{background:var(--red-light)}
  .ny-today-txt{flex:1;min-width:0;font-size:13.5px;font-weight:600;color:var(--text);line-height:1.4}
  .ny-today-txt span{display:block;font-size:12px;font-weight:500;color:var(--text-3)}
  .ny-today-more{background:none;border:none;color:var(--green);font-weight:700;font-size:12.5px;padding:8px 0 0;cursor:pointer}
  .ny-viewings{margin-top:14px;padding-top:14px;border-top:1px dashed var(--border)}
  .ny-viewings h3{font-size:13px;font-weight:700;margin-bottom:8px}
  .ny-view-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 0;font-size:12.5px}
  .ny-view-when{font-weight:700;min-width:130px;color:var(--green-dark)}
  .ny-view-who{flex:1;min-width:140px}
  .ny-view-who span{display:block;font-size:11.5px;color:var(--text-3)}
  .ny-more-toggle{display:flex;align-items:center;gap:6px;background:none;border:1.5px dashed var(--border);border-radius:var(--radius);padding:9px 14px;font-size:12.5px;font-weight:700;color:var(--text-2);cursor:pointer;margin:0 0 20px;width:100%;justify-content:center}
  .ny-more-toggle:hover{border-color:var(--green);color:var(--green)}
  #ny-more{display:none}
  #ny-more.open{display:block}
  .ny-seg{display:inline-flex;gap:2px;padding:3px;background:var(--surface);border:1px solid var(--border);border-radius:20px}
  .ny-seg button{font-size:11.5px;font-weight:700;padding:4px 11px;border-radius:16px;color:var(--text-2)}
  .ny-seg button.active{background:var(--green);color:#fff}
  #ny-chart-delta{font-size:12px;color:var(--text-3);margin-top:10px}
  #overview-chart-card .chart-label{font-size:9px;overflow:hidden;white-space:nowrap}
  `;
  document.head.appendChild(css);

  /* ═════════════════════════════════════════════
     STEP 1 — BOTTOM TAB BAR
  ═════════════════════════════════════════════ */
  const ICON = {
    home: '<path d="M3 11l9-8 9 8v10a1 1 0 01-1 1h-5v-7H9v7H4a1 1 0 01-1-1z"/>',
    list: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    inbox: '<path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>',
    money: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/>',
    more: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  };
  const TABS = [
    { id: 'home', label: 'Home', icon: ICON.home, go: () => showPage('overview') },
    { id: 'listings', label: 'Listings', icon: ICON.list, go: () => showPage('listings') },
    { id: 'inbox', label: 'Inbox', icon: ICON.inbox, go: () => showAllMessages() },
    { id: 'money', label: 'Money', icon: ICON.money, go: () => showPage('payments') },
    { id: 'more', label: 'More', icon: ICON.more, go: () => toggleSidebar() },
  ];
  const PAGE_TO_TAB = {
    overview: 'home', listings: 'listings',
    messages: 'inbox', enquiries: 'inbox', reviews: 'inbox',
    payments: 'money', 'rent-ledger': 'money', 'demand-heatmap': 'money',
  };

  function buildTabBar() {
    if ($('nyb-bar')) return;
    const nav = document.createElement('nav');
    nav.className = 'nyb-bar';
    nav.id = 'nyb-bar';
    nav.setAttribute('aria-label', 'Main navigation');
    nav.innerHTML = TABS.map((t) =>
      `<button type="button" class="nyb-tab" data-tab="${t.id}" aria-label="${t.label}">
         <svg viewBox="0 0 24 24" aria-hidden="true">${t.icon}</svg><span>${t.label}</span>
         ${t.id === 'inbox' ? '<span class="nyb-badge" id="nyb-badge-inbox"></span>' : ''}
       </button>`).join('');
    nav.addEventListener('click', (e) => {
      const b = e.target.closest('.nyb-tab');
      if (!b) return;
      const tab = TABS.find((t) => t.id === b.dataset.tab);
      if (tab) tab.go();
    });
    document.body.appendChild(nav);
  }

  function syncTabBar(pageName) {
    const page = pageName || (document.querySelector('.page.active') || {}).id?.replace('page-', '') || 'overview';
    const active = PAGE_TO_TAB[page] || 'more';
    document.querySelectorAll('.nyb-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === active));
    // hide the bar while a chat is open on mobile so the reply box isn't covered
    const chat = page === 'messages' && $('messages-layout')?.classList.contains('mobile-chat-active');
    document.body.classList.toggle('nyb-chat', !!chat);
    const unread = (window.threads || threads || []).reduce((s, t) => s + (t.unread_count || 0), 0);
    const bd = $('nyb-badge-inbox');
    if (bd) { bd.textContent = unread > 99 ? '99+' : unread; bd.classList.toggle('show', unread > 0); }
  }

  /* ═════════════════════════════════════════════
     STEP 4 (data) — lead stages + viewings
     Declared early because the inbox render uses it.
  ═════════════════════════════════════════════ */
  const STAGES = [
    ['new', 'New'], ['replied', 'Replied'], ['viewing', 'Viewing booked'],
    ['negotiating', 'Negotiating'], ['closed', 'Closed'], ['lost', 'Lost'],
  ];
  const stageLabel = (s) => (STAGES.find((x) => x[0] === s) || [s, s])[1];
  const leads = new Map();        // thread key → buyer_leads row
  let viewings = [];              // upcoming scheduled viewings
  let leadsReady = false, sqlWarned = false;

  const needsReply = (t) => {
    const last = t.messages[t.messages.length - 1];
    return !!last && last.sender === 'buyer' && !['closed', 'lost'].includes(leadOf(t));
  };
  function leadOf(t) {
    const row = leads.get(t.key);
    if (row) return row.status;
    return t.messages.some((m) => m.sender === 'seller') ? 'replied' : 'new';
  }
  function waitingMs(t) {
    const last = t.messages[t.messages.length - 1];
    return last ? Date.now() - new Date(last.created_at).getTime() : 0;
  }
  function fmtDur(ms) {
    const m = Math.round(ms / 60000);
    if (m < 60) return m + 'm';
    if (m < 1440) return Math.round(m / 60) + 'h';
    return Math.round(m / 1440) + 'd';
  }
  function warnSql(err) {
    console.error('[patch.js] lead/viewing table error:', err);
    if (sqlWarned) return;
    sqlWarned = true;
    showToast('Lead stages need the SQL setup — run nyumba254-inbox-leads.sql in Supabase.', 'error');
  }

  async function loadLeads() {
    const { data, error } = await db.from('buyer_leads').select('*').eq('seller_id', effectiveSellerId);
    if (error) { warnSql(error); return; }
    leads.clear();
    (data || []).forEach((r) => leads.set(r.buyer_key, r));
    leadsReady = true;
  }
  async function loadViewings() {
    const since = new Date(Date.now() - 2 * HOUR).toISOString();
    const { data, error } = await db.from('viewings').select('*')
      .eq('seller_id', effectiveSellerId).eq('status', 'scheduled')
      .gte('starts_at', since).order('starts_at', { ascending: true }).limit(20);
    if (error) { warnSql(error); return; }
    viewings = data || [];
  }

  async function saveLead(t, status) {
    const prev = leads.get(t.key);
    const row = {
      seller_id: effectiveSellerId, listing_id: String(t.listing_id), buyer_key: t.key,
      buyer_name: t.buyer_name || null, buyer_phone: t.buyer_phone || null, status,
    };
    leads.set(t.key, { ...(prev || {}), ...row });
    renderThreadList(); renderToday();
    const { error } = await db.from('buyer_leads').upsert(row, { onConflict: 'seller_id,buyer_key' });
    if (error) {
      if (prev) leads.set(t.key, prev); else leads.delete(t.key);
      renderThreadList(); renderToday();
      warnSql(error);
      showToast('Could not save stage: ' + error.message, 'error');
      return false;
    }
    return true;
  }

  /* ═════════════════════════════════════════════
     STEP 2 — ONE INBOX
  ═════════════════════════════════════════════ */
  const inbox = { filter: 'all', stage: '' };

  function setupInboxChrome() {
    pageTitles.messages = 'Inbox';
    // sidebar: Messages → Inbox, hide the now-redundant Enquiries link
    const nav = $('nav-messages');
    if (nav) nav.childNodes.forEach((n) => { if (n.nodeType === 3 && n.textContent.trim() === 'Messages') n.textContent = 'Inbox'; });
    const enq = $('nav-enquiries'); if (enq) enq.style.display = 'none';
    const head = document.querySelector('#thread-list .thread-list-head h3');
    if (head) head.textContent = 'Inbox';
    const sub = document.querySelector('#thread-list .thread-list-head h3 + div');
    if (sub) sub.textContent = 'Every buyer conversation, with lead stages';
    const old = $('page-enquiries'); if (old) old.style.display = 'none';

    // chips row above the search box
    if (!$('ny-chips')) {
      const row = document.createElement('div');
      row.id = 'ny-chips'; row.className = 'ny-chips';
      const search = document.querySelector('#thread-list .thread-search');
      if (search) search.parentNode.insertBefore(row, search);
      row.addEventListener('click', (e) => {
        const c = e.target.closest('.ny-chip'); if (!c) return;
        inbox.filter = c.dataset.f; renderThreadList();
      });
      row.addEventListener('change', (e) => {
        if (e.target.id === 'ny-stage-filter') { inbox.stage = e.target.value; renderThreadList(); }
      });
    }
    // Demand Insights locked screen still had a dead "Upgrade" link
    const dead = document.querySelector('#demand-locked a[href="/plans"]');
    if (dead) {
      dead.outerHTML = '<button class="btn btn-primary" style="background:#7c3aed" onclick="joinEliteWaitlist()">Notify me when Elite opens</button>';
    }
  }

  function renderChips(list) {
    const row = $('ny-chips'); if (!row) return;
    const counts = {
      all: list.length,
      unread: list.filter((t) => (t.unread_count || 0) > 0).length,
      reply: list.filter(needsReply).length,
    };
    const chips = [['all', 'All'], ['unread', 'Unread'], ['reply', 'Needs reply']];
    row.innerHTML = chips.map(([id, label]) =>
      `<button type="button" class="ny-chip ${inbox.filter === id ? 'active' : ''}" data-f="${id}">${label}<b>${counts[id]}</b></button>`).join('') +
      `<select class="ny-stage-filter" id="ny-stage-filter" aria-label="Filter by lead stage">
         <option value="">Any stage</option>
         ${STAGES.map(([v, l]) => `<option value="${v}" ${inbox.stage === v ? 'selected' : ''}>${l}</option>`).join('')}
       </select>`;
  }

  // Full replacement of renderThreadList: same markup/behaviour as the original,
  // plus filters, lead chip and a "waiting" nudge.
  function renderThreadListNew() {
    const q = ($('thread-search-input')?.value || '').toLowerCase();
    let list = threads;
    if (threadListingFilter) list = list.filter((t) => t.listing_id === threadListingFilter);

    const chipWrap = $('thread-filter-chip');
    if (chipWrap) {
      if (threadListingFilter) {
        const l = allListings.find((x) => x.id === threadListingFilter);
        chipWrap.style.display = 'block';
        chipWrap.innerHTML = `<span style="display:inline-flex;align-items:center;gap:6px;font-size:11px;background:var(--green-light);color:var(--green-dark);padding:4px 10px;border-radius:20px">Filtered: ${esc(l?.title || 'listing')}<span style="cursor:pointer;font-weight:700" onclick="showAllMessages()">×</span></span>`;
      } else { chipWrap.style.display = 'none'; chipWrap.innerHTML = ''; }
    }

    renderChips(list);
    if (q) list = list.filter((t) => t.buyer_name.toLowerCase().includes(q) || t.listing_title.toLowerCase().includes(q) || t.messages.some((m) => (m.content || m.message || '').toLowerCase().includes(q)));
    if (inbox.filter === 'unread') list = list.filter((t) => (t.unread_count || 0) > 0);
    else if (inbox.filter === 'reply') list = list.filter(needsReply);
    if (inbox.stage) list = list.filter((t) => leadOf(t) === inbox.stage);

    const cnt = $('msg-thread-count');
    if (cnt) cnt.textContent = `${list.length} conversation${list.length !== 1 ? 's' : ''}`;
    const el = $('thread-items'); if (!el) return;

    if (!list.length) {
      const filtered = q || threadListingFilter || inbox.filter !== 'all' || inbox.stage;
      el.innerHTML = `<div style="padding:40px 20px;text-align:center;color:var(--text-3);font-size:13px">${filtered ? 'Nothing matches these filters.' : 'No messages yet. When buyers contact you, conversations appear here.'}</div>`;
      return;
    }
    el.innerHTML = list.map((t) => {
      const lm = t.messages[t.messages.length - 1];
      const prev = lm ? (lm.sender === 'seller' ? 'You: ' : '') + (lm.content || lm.message || '') : '';
      const ini = t.buyer_name.split(' ').map((n) => n[0]).slice(0, 2).join('').toUpperCase() || '?';
      const isA = activeThread && activeThread.key === t.key;
      const isU = (t.unread_count || 0) > 0;
      const stage = leadOf(t);
      const wait = needsReply(t) && waitingMs(t) > HOUR ? `<span class="ny-wait">Waiting ${fmtDur(waitingMs(t))}</span>` : '';
      return `<div class="thread-item${isA ? ' active' : ''}${isU ? ' unread' : ''}" onclick="openThread('${escA(t.key)}')" role="button" tabindex="0" aria-label="Conversation with ${escA(t.buyer_name)}" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();this.click()}">
        <div class="thread-avatar">${ini}</div>
        <div class="thread-meta">
          <div class="thread-name">${esc(t.buyer_name)}</div>
          <div class="thread-listing-ref">${esc(t.listing_title)}${t.listing_area ? ' · ' + esc(t.listing_area) : ''}</div>
          <div class="thread-preview">${esc(prev)}</div>
          <div class="ny-meta-row"><span class="ny-lead ny-lead-${stage}">${stageLabel(stage)}</span>${wait}</div>
        </div>
        <div class="thread-time">${timeAgo(t.last_at)}</div>
      </div>`;
    }).join('');
  }

  window.nyOpenInbox = function (filter) {
    inbox.filter = filter || 'all'; inbox.stage = '';
    showAllMessages();
  };

  /* ═════════════════════════════════════════════
     STEP 4 (UI) — stage picker + viewing scheduler
  ═════════════════════════════════════════════ */
  function decorateChatHeader(t) {
    const box = document.querySelector('#chat-header .chat-header-actions');
    if (!box || $('ny-stage-sel')) return;
    box.insertAdjacentHTML('afterbegin',
      `<select class="ny-stage" id="ny-stage-sel" aria-label="Lead stage">${STAGES.map(([v, l]) => `<option value="${v}" ${leadOf(t) === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
       <button type="button" class="btn btn-outline btn-sm" id="ny-sched-btn">📅 Viewing</button>`);
    $('ny-stage-sel').onchange = (e) => { const th = activeThread; if (th) saveLead(th, e.target.value); };
    $('ny-sched-btn').onclick = openViewingModal;
  }

  function buildViewingModal() {
    if ($('modal-ny-viewing')) return;
    const m = document.createElement('div');
    m.className = 'modal-overlay'; m.id = 'modal-ny-viewing';
    m.innerHTML = `<div class="modal" style="max-width:440px">
      <div class="modal-head"><h3>Schedule a viewing</h3><div class="modal-close" role="button" tabindex="0" aria-label="Close" onclick="closeModal('modal-ny-viewing')">✕</div></div>
      <div class="modal-body">
        <p id="ny-v-who" style="font-size:13px;color:var(--text-2);margin-bottom:14px;line-height:1.6"></p>
        <div id="ny-v-quick" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px"></div>
        <div class="form-grid">
          <div class="form-group"><label for="ny-v-date">Date</label><input type="date" id="ny-v-date"/></div>
          <div class="form-group"><label for="ny-v-time">Time</label><input type="time" id="ny-v-time" value="10:00"/></div>
        </div>
        <div class="form-group"><label for="ny-v-note">Note for yourself (optional)</label><input type="text" id="ny-v-note" placeholder="e.g. Meet at the gate"/></div>
        <label style="display:flex;gap:8px;align-items:center;font-size:12.5px;color:var(--text-2);cursor:pointer;text-transform:none;letter-spacing:0"><input type="checkbox" id="ny-v-send" checked/> Send a confirmation message in this chat</label>
      </div>
      <div class="modal-foot"><button class="btn btn-outline" onclick="closeModal('modal-ny-viewing')">Cancel</button><button class="btn btn-primary" id="ny-v-save">Save viewing</button></div>
    </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) closeModal('modal-ny-viewing'); });
    $('ny-v-save').onclick = confirmViewing;
  }

  const pad2 = (n) => String(n).padStart(2, '0');
  const dKey = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

  function openViewingModal() {
    const t = activeThread; if (!t) return;
    buildViewingModal();
    $('ny-v-who').innerHTML = `Viewing for <strong>${esc(t.buyer_name)}</strong> — ${esc(t.listing_title)}`;
    const today = new Date(), tom = new Date(Date.now() + DAY), sat = new Date();
    sat.setDate(sat.getDate() + ((6 - sat.getDay() + 7) % 7 || 7));
    const slots = [['Tomorrow 10:00', tom, '10:00'], ['Tomorrow 15:00', tom, '15:00'], ['Saturday 11:00', sat, '11:00']];
    $('ny-v-quick').innerHTML = slots.map(([l], i) => `<button type="button" class="ny-chip" data-i="${i}">${l}</button>`).join('');
    $('ny-v-quick').onclick = (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const s = slots[Number(b.dataset.i)];
      $('ny-v-date').value = dKey(s[1]); $('ny-v-time').value = s[2];
    };
    $('ny-v-date').min = dKey(today);
    $('ny-v-date').value = dKey(tom);
    $('ny-v-time').value = '10:00';
    $('ny-v-note').value = '';
    openModal('modal-ny-viewing');
  }

  function fmtWhen(iso) {
    return new Date(iso).toLocaleString('en-KE', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
  }

  async function confirmViewing() {
    const t = activeThread; if (!t) return;
    const date = $('ny-v-date').value, time = $('ny-v-time').value;
    if (!date || !time) { showToast('Pick a date and time', 'error'); return; }
    const start = new Date(`${date}T${time}`);
    if (isNaN(start) || start.getTime() < Date.now() - 60000) { showToast('Choose a time in the future', 'error'); return; }
    const btn = $('ny-v-save'); btn.disabled = true; btn.textContent = 'Saving…';
    const row = {
      seller_id: effectiveSellerId, listing_id: String(t.listing_id), listing_title: t.listing_title,
      buyer_key: t.key, buyer_name: t.buyer_name, buyer_phone: t.buyer_phone || null,
      starts_at: start.toISOString(), status: 'scheduled', note: $('ny-v-note').value.trim() || null,
    };
    const { data, error } = await db.from('viewings').insert(row).select().single();
    btn.disabled = false; btn.textContent = 'Save viewing';
    if (error) { warnSql(error); showToast('Could not save viewing: ' + error.message, 'error'); return; }
    viewings.push(data);
    viewings.sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at));
    closeModal('modal-ny-viewing');

    if ($('ny-v-send').checked) await postViewingMessage(t, start);
    await saveLead(t, 'viewing');
    const sel = $('ny-stage-sel'); if (sel) sel.value = 'viewing';
    renderToday();
    showToast('Viewing scheduled ✓', 'success');
  }

  async function postViewingMessage(t, start) {
    const text = `Your viewing of "${t.listing_title}" is confirmed for ${fmtWhen(start.toISOString())}. I'll share the exact location shortly before we meet — reply here if you need to reschedule.`;
    const { data, error } = await db.from('messages').insert({
      listing_id: t.listing_id, buyer_token: t.buyer_token || null, buyer_name: t.buyer_name,
      buyer_phone: t.buyer_phone || null, sender: 'seller', content: text,
    }).select().single();
    if (error) { showToast('Viewing saved, but the chat message failed to send', 'error'); return; }
    allMessages.push(data);
    buildThreads();
    activeThread = threads.find((x) => x.key === t.key) || activeThread;
    renderChatMessages(activeThread); renderThreadList();
    safe(() => notifyBuyerIfOffline(activeThread.buyer_token, activeThread.listing_title, text));
    setTimeout(() => { const mc = $('chat-messages'); if (mc) mc.scrollTop = mc.scrollHeight; }, 30);
  }

  async function setViewingStatus(id, status) {
    const { error } = await db.from('viewings').update({ status }).eq('id', id);
    if (error) { showToast('Could not update: ' + error.message, 'error'); return; }
    viewings = viewings.filter((v) => v.id !== id);
    renderToday();
    showToast(status === 'completed' ? 'Marked as done ✓' : 'Viewing cancelled', 'success');
  }
  window.nyViewingDone = (id) => setViewingStatus(id, 'completed');
  window.nyViewingCancel = async (id) => {
    if (!await lcConfirm({ title: 'Cancel this viewing?', message: 'It will be removed from your upcoming list. Let the buyer know in chat.', confirmLabel: 'Cancel viewing', danger: true })) return;
    setViewingStatus(id, 'cancelled');
  };
  window.nyViewingOpenChat = (key) => { const t = threads.find((x) => x.key === key); if (t) openConversationFromThread(key); };
  function gcalUrl(v) {
    const s = new Date(v.starts_at), e = new Date(s.getTime() + 45 * 60000);
    const f = (d) => d.toISOString().replace(/[-:]|\.\d{3}/g, '');
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE'
      + `&text=${encodeURIComponent('Viewing: ' + (v.listing_title || 'Property'))}`
      + `&dates=${f(s)}/${f(e)}`
      + `&details=${encodeURIComponent('Buyer: ' + (v.buyer_name || '') + (v.buyer_phone ? ' · ' + v.buyer_phone : '') + (v.note ? '\n' + v.note : ''))}`;
  }

  /* ═════════════════════════════════════════════
     STEP 3 — TODAY PANEL + CHART RANGE
  ═════════════════════════════════════════════ */
  function buildTodayShell() {
    const page = $('page-overview'); if (!page || $('ny-today')) return;
    const today = document.createElement('div');
    today.className = 'card'; today.id = 'ny-today';
    const statGrid = page.querySelector('.stat-grid');
    page.insertBefore(today, page.querySelector('#getting-started-card') || statGrid);

    // Move the five stacked banners behind one "More" toggle
    const wrap = document.createElement('div'); wrap.id = 'ny-more';
    ['getting-started-card', 'storefront-banner-card', 'action-center-card', 'week-momentum-card', 'smart-insight-card']
      .forEach((id) => { const el = $(id); if (el) wrap.appendChild(el); });
    const toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'ny-more-toggle'; toggle.id = 'ny-more-toggle';
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'More insights ▾';
    toggle.onclick = () => {
      const open = wrap.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? 'Fewer insights ▴' : 'More insights ▾';
    };
    statGrid.insertAdjacentElement('afterend', toggle);
    toggle.insertAdjacentElement('afterend', wrap);

    // Unread card → inbox filtered to unread
    const unreadCard = page.querySelector('.stat-card.amber');
    if (unreadCard) unreadCard.onclick = () => nyOpenInbox('unread');
  }

  function renderToday() {
    const host = $('ny-today'); if (!host) return;
    safe(() => lcBuildStats());
    const items = [];

    const unpaid = allListings.filter((l) => lcIsUnpaid(l) && l.payment_status !== 'pending_verification');
    if (unpaid.length) items.push({ urgent: true, ico: '💳', text: `${unpaid.length} approved listing${unpaid.length !== 1 ? 's' : ''} waiting on payment`, sub: 'Pay to make them live', cta: 'Pay now', go: () => { showPage('listings'); filterListings('unpaid'); } });

    const waiting = threads.filter(needsReply);
    if (waiting.length) {
      const oldest = Math.max(...waiting.map(waitingMs));
      items.push({ urgent: oldest > 4 * HOUR, ico: '💬', text: `${waiting.length} buyer${waiting.length !== 1 ? 's' : ''} waiting for your reply`, sub: `Longest wait: ${fmtDur(oldest)}`, cta: 'Reply', go: () => nyOpenInbox('reply') });
    }

    const todayKey = dKey(new Date());
    const todays = viewings.filter((v) => dKey(new Date(v.starts_at)) === todayKey);
    if (todays.length) items.push({ urgent: false, ico: '📅', text: `${todays.length} viewing${todays.length !== 1 ? 's' : ''} today`, sub: todays.map((v) => new Date(v.starts_at).toLocaleTimeString('en-KE', { hour: 'numeric', minute: '2-digit' })).join(' · '), cta: 'See below', go: () => $('ny-viewings')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) });

    const stale = allListings.filter((l) => lcMatchesFilter(l, 'view:stale')).length;
    if (stale) items.push({ urgent: false, ico: '🕸️', text: `${stale} listing${stale !== 1 ? 's are' : ' is'} going stale`, sub: 'No recent buyer interest', cta: 'Review', go: () => { showPage('listings'); filterListings('view:stale'); } });

    const reviews = allReviews.filter((r) => !r.response_text).length;
    if (reviews) items.push({ urgent: false, ico: '⭐', text: `${reviews} review${reviews !== 1 ? 's' : ''} awaiting your response`, sub: 'Replies build trust', cta: 'Respond', go: () => showPage('reviews') });

    if (!allListings.length) items.unshift({ urgent: false, ico: '🏠', text: 'Post your first listing', sub: 'Takes about 3 minutes', cta: 'Start', go: () => { window.location.href = '/post-listing'; } });

    const h = new Date().getHours();
    const greet = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    const first = ((typeof currentProfile !== 'undefined' && currentProfile?.full_name) || '').split(' ')[0];
    const summary = waiting.length
      ? `${waiting.length} buyer${waiting.length !== 1 ? 's are' : ' is'} waiting — longest for ${fmtDur(Math.max(...waiting.map(waitingMs)))}.`
      : items.length ? 'Here is what needs you today.' : "You're all caught up — nothing needs you right now.";

    const expanded = host.dataset.expanded === '1';
    const shown = expanded ? items : items.slice(0, 3);
    const upcoming = viewings.slice(0, 5);

    host.innerHTML = `
      <div class="ny-today-head"><h2>${greet}${first ? ', ' + esc(first) : ''}</h2></div>
      <div class="ny-today-sub">${esc(summary)}</div>
      ${shown.map((it, i) => `<div class="ny-today-row ${it.urgent ? 'urgent' : ''}">
          <div class="ny-today-ico" aria-hidden="true">${it.ico}</div>
          <div class="ny-today-txt">${esc(it.text)}<span>${esc(it.sub)}</span></div>
          <button type="button" class="btn ${i === 0 ? 'btn-primary' : 'btn-outline'} btn-sm" data-i="${i}">${esc(it.cta)}</button>
        </div>`).join('')}
      ${items.length > 3 ? `<button type="button" class="ny-today-more" id="ny-today-more">${expanded ? 'Show less' : `Show ${items.length - 3} more`}</button>` : ''}
      ${upcoming.length ? `<div class="ny-viewings" id="ny-viewings"><h3>Upcoming viewings</h3>
        ${upcoming.map((v) => `<div class="ny-view-row">
            <div class="ny-view-when">${esc(fmtWhen(v.starts_at))}</div>
            <div class="ny-view-who">${esc(v.buyer_name || 'Buyer')}<span>${esc(v.listing_title || '')}${v.note ? ' · ' + esc(v.note) : ''}</span></div>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <button type="button" class="btn btn-outline btn-sm" onclick="nyViewingOpenChat('${escA(v.buyer_key)}')">Chat</button>
              <a class="btn btn-outline btn-sm" href="${escA(gcalUrl(v))}" target="_blank" rel="noopener">Add to calendar</a>
              <button type="button" class="btn btn-outline btn-sm" onclick="nyViewingDone('${escA(v.id)}')">Done</button>
              <button type="button" class="btn btn-outline btn-sm" style="color:var(--red);border-color:var(--red)" onclick="nyViewingCancel('${escA(v.id)}')">Cancel</button>
            </div>
          </div>`).join('')}</div>` : ''}`;

    host.querySelectorAll('.ny-today-row .btn').forEach((b) => { b.onclick = () => shown[Number(b.dataset.i)].go(); });
    const more = $('ny-today-more');
    if (more) more.onclick = () => { host.dataset.expanded = expanded ? '0' : '1'; renderToday(); };

    // brand-new sellers: keep the Getting Started card visible
    const wrap = $('ny-more'), tg = $('ny-more-toggle');
    if (wrap && !allListings.length && !wrap.dataset.auto) { wrap.dataset.auto = '1'; wrap.classList.add('open'); if (tg) tg.textContent = 'Fewer insights ▴'; }
  }

  /* ── chart range: 7 / 30 / 90 days, with comparison to the previous period ── */
  let range = [7, 30, 90].includes(Number(localStorage.getItem('ny_ov_range'))) ? Number(localStorage.getItem('ny_ov_range')) : 7;

  function buildRangeToggle() {
    const head = document.querySelector('#overview-chart-card .section-head');
    if (!head || $('ny-seg')) return;
    head.innerHTML = '<h2 id="ny-chart-title">Messages</h2><div class="ny-seg" id="ny-seg" role="group" aria-label="Chart range"></div>';
    $('ny-seg').innerHTML = [7, 30, 90].map((d) => `<button type="button" data-d="${d}">${d}d</button>`).join('');
    $('ny-seg').onclick = (e) => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      range = Number(b.dataset.d);
      try { localStorage.setItem('ny_ov_range', String(range)); } catch (x) { /* ignore */ }
      renderChart();
    };
    const lbl = $('chart-labels');
    if (lbl && !$('ny-chart-delta')) lbl.insertAdjacentHTML('afterend', '<div id="ny-chart-delta"></div>');
  }

  function renderChartNew() {
    const bars = $('chart-bars'), labels = $('chart-labels');
    if (!bars || !labels) return;
    buildRangeToggle();
    const ev = allEnquiries.map((e) => +new Date(e.created_at))
      .concat(allMessages.filter((m) => m.sender === 'buyer').map((m) => +new Date(m.created_at)));
    const bucket = range === 90 ? 7 : 1, n = Math.ceil(range / bucket);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const endMs = +end;
    const counts = [], labs = [], tips = [];
    for (let i = n - 1; i >= 0; i--) {
      const bEnd = endMs - i * bucket * DAY, bStart = bEnd - bucket * DAY;
      const c = ev.filter((t) => t > bStart && t <= bEnd).length;
      const d = new Date(bEnd);
      counts.push(c);
      tips.push(d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }));
      const showLabel = range === 7 || (n - 1 - i) % 5 === 0 || i === 0;
      labs.push(range === 7 ? d.toLocaleDateString('en-KE', { weekday: 'short' }) : (showLabel ? d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short' }) : ''));
    }
    const max = Math.max(...counts, 1);
    bars.innerHTML = counts.map((c, i) => `<div class="chart-bar" style="height:${Math.round((c / max) * 68) + 8}px"><div class="bar-tip">${tips[i]}: ${c}</div></div>`).join('');
    labels.innerHTML = labs.map((l) => `<div class="chart-label">${l}</div>`).join('');

    const title = $('ny-chart-title'); if (title) title.textContent = `Messages · last ${range} days`;
    document.querySelectorAll('#ny-seg [data-d]').forEach((b) => b.classList.toggle('active', Number(b.dataset.d) === range));
    const total = counts.reduce((a, b) => a + b, 0);
    const prev = ev.filter((t) => t > endMs - 2 * range * DAY && t <= endMs - range * DAY).length;
    const dl = $('ny-chart-delta');
    if (dl) {
      const pct = prev > 0 ? Math.round(((total - prev) / prev) * 100) : (total > 0 ? 100 : 0);
      dl.innerHTML = `<strong style="color:var(--text)">${total}</strong> in the last ${range} days` +
        (prev || total ? ` · <span style="font-weight:700;color:${pct >= 0 ? '#065f46' : 'var(--red)'}">${pct >= 0 ? '▲' : '▼'} ${Math.abs(pct)}%</span> vs the ${range} days before` : '');
    }
  }

  /* ═════════════════════════════════════════════
     WIRING — wrap existing functions (originals stay intact)
  ═════════════════════════════════════════════ */
  const _showPage = window.showPage;
  window.showPage = function (name) {
    if (name === 'enquiries') { inbox.filter = 'unread'; inbox.stage = ''; return window.showAllMessages(); }
    const r = _showPage.apply(this, arguments);
    syncTabBar(name);
    return r;
  };
  const _showThreadListMobile = window.showThreadListMobile;
  window.showThreadListMobile = function () { const r = _showThreadListMobile.apply(this, arguments); syncTabBar(); return r; };
  const _showChatMobile = window.showChatMobile;
  window.showChatMobile = function () { const r = _showChatMobile.apply(this, arguments); syncTabBar(); return r; };

  window.renderThreadList = renderThreadListNew;

  const _renderChatPane = window.renderChatPane;
  window.renderChatPane = function (t) { const r = _renderChatPane.apply(this, arguments); safe(() => decorateChatHeader(t)); return r; };

  const _renderOverview = window.renderOverview;
  window.renderOverview = function () { const r = _renderOverview.apply(this, arguments); safe(renderToday); return r; };

  window.renderChart = renderChartNew;

  const _updateNavBadges = window.updateNavBadges;
  window.updateNavBadges = function () { const r = _updateNavBadges.apply(this, arguments); safe(() => syncTabBar()); return r; };

  /* ── boot: wait until the dashboard has finished loading ── */
  buildTabBar();
  safe(setupInboxChrome);
  safe(buildTodayShell);
  safe(buildRangeToggle);
  safe(() => syncTabBar());

  let tries = 0;
  const boot = setInterval(async () => {
    tries++;
    const ready = typeof effectiveSellerId !== 'undefined' && effectiveSellerId && $('app-shell')?.style.display === 'flex';
    if (!ready) { if (tries > 150) clearInterval(boot); return; }
    clearInterval(boot);
    await Promise.all([loadLeads(), loadViewings()]);
    safe(renderToday);
    safe(renderChart);
    if ($('page-messages')?.classList.contains('active')) renderThreadList();
    safe(() => syncTabBar());
  }, 400);

  // new inbound messages should keep chips/tab badge fresh
  window.addEventListener('focus', () => safe(() => { if (leadsReady) loadViewings().then(renderToday); }));
})();
