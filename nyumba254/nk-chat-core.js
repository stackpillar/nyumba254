/* ════════════════════════════════════════════════════════════
   nk-chat-core.js · Nyumba254 shared chat engine
   ONE source of truth for the floating widget (global-chat-widget.js)
   and the full inbox page (inbox.html). It owns: identity + profile,
   conversations, messages, optimistic sending with retry and an
   offline outbox, realtime, presence, viewing requests, resume links.
   The two interfaces only draw what this file tells them.
   ════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.NKChatCore) return;

  const SB_URL = 'https://vliuuloyfhyxcsuchpss.supabase.co';
  const SB_KEY = 'sb_publishable_oIIcecf3wzKMual5K24Z8Q_zmxVfgsx';
  const EDGE = SB_URL + '/functions/v1';
  const TOKEN_RE = /^[\w-]{16,}$/;                 // a real buyer token; rejects JSON such as nk_buyer_profile
  const ID_RE = /^[\w-]{1,64}$/;
  const AI_MARK = /^🤖\s*\[Automated reply\]\s*/;

  /* ── Supabase client: reuse the page's own client when there is one (no second connection) ── */
  let client = null;
  function getClient() {
    if (client) return client;
    try { if (typeof db !== 'undefined' && db && db.from) client = db; } catch (e) {}
    if (!client && window.db && window.db.from) client = window.db;
    if (!client) client = supabase.createClient(SB_URL, SB_KEY);
    if (!window.db) window.db = client;
    return client;
  }

  /* ── small helpers ── */
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2));
  const clean = t => String(t || '').replace(AI_MARK, '');
  let LANG = 'en';
  const setLang = l => { LANG = l === 'sw' ? 'sw' : 'en'; };
  const LOC = () => (LANG === 'sw' ? 'sw-KE' : 'en-KE');
  const WORDS = () => (LANG === 'sw' ? { today: 'Leo', yest: 'Jana' } : { today: 'Today', yest: 'Yesterday' });
  const sameDay = (a, b) => a.toDateString() === b.toDateString();
  const dayLabel = iso => { const d = new Date(iso), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1); return sameDay(d, t) ? WORDS().today : sameDay(d, y) ? WORDS().yest : d.toLocaleDateString(LOC(), { weekday: 'short', day: 'numeric', month: 'short' }); };
  const timeLabel = iso => new Date(iso).toLocaleTimeString(LOC(), { hour: 'numeric', minute: '2-digit' });
  const whenLabel = iso => { if (!iso) return ''; const d = new Date(iso), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1); return sameDay(d, t) ? timeLabel(iso) : sameDay(d, y) ? WORDS().yest : d.toLocaleDateString(LOC(), { day: 'numeric', month: 'short' }); };
  const initials = n => (String(n || 'Seller').split(/\s+/).filter(Boolean).map(x => x[0]).join('').toUpperCase().slice(0, 2)) || 'S';
  const FREQ = { month: '/mo', night: '/night', week: '/week', term: '/term', semester: '/semester', once: '' };
  const priceLabel = l => (l && Number(l.price) > 0) ? 'KES ' + Number(l.price).toLocaleString('en-KE') + (FREQ[l.price_frequency] || '') : '';
  const localISO = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');   // local date, not UTC
  function normPhone(raw) { let s = String(raw || '').replace(/[^\d+]/g, ''); if (!s) return ''; if (s.startsWith('+')) return s; if (s.startsWith('254')) return '+' + s; if (s.startsWith('0')) return '+254' + s.slice(1); if (/^[71]/.test(s)) return '+254' + s; return s; }
  const okPhone = p => /^\+254\d{9}$/.test(p) || /^\+\d{9,15}$/.test(p);
  const prettyPhone = raw => { const p = normPhone(raw); return /^\+254\d{9}$/.test(p) ? ('0' + p.slice(4)).replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3') : String(raw || ''); };

  /* ── event bus ── */
  const H = {};
  const on = (e, f) => { (H[e] = H[e] || []).push(f); return () => { H[e] = (H[e] || []).filter(x => x !== f); }; };
  const emit = (e, d) => (H[e] || []).slice().forEach(f => { try { f(d); } catch (err) { console.error('NKChatCore handler:', err); } });

  /* ── state ── */
  const S = { convos: [], loading: false, loadError: false, active: null, messages: [], listing: null, listingGone: false, hasMore: false, unreadAtOpen: 0, viewings: {}, presence: 'connecting', viewing: false, polling: false, booked: {}, net: navigator.onLine !== false };
  let inflight = null, started = false, outbox = [];
  const CACHE = 'nk_chat_cache_v1', OB = 'nk_chat_outbox_v1';

  /* ═════ identity: which conversations this browser owns ═════ */
  function scanPairs() {
    const out = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i), m = k && k.match(/^nk_buyer_(?!name_|phone_)(.+)$/);
        if (!m || m[1] === 'profile') continue;
        const t = localStorage.getItem(k);
        if (t && TOKEN_RE.test(t)) out.push({ listingId: m[1], buyerToken: t });
      }
    } catch (e) {}
    return out;
  }
  const tokenSet = () => new Set(scanPairs().map(p => p.buyerToken));

  /* ═════ profile: ONE store, mirrored to the older keys so nothing else breaks ═════ */
  const Profile = {
    get() {
      let p = {}; try { p = JSON.parse(ls.get('nk_buyer_profile') || '{}') || {}; } catch (e) {}
      return { name: p.name || ls.get('nk_profile_name') || '', phone: p.phone || ls.get('nk_profile_phone') || '', email: p.email || ls.get('nk_profile_email') || '', notify: ls.get('nk_profile_notify') !== '0' };
    },
    forListing(id) { const p = Profile.get(); return { name: p.name || ls.get('nk_buyer_name_' + id) || '', phone: p.phone || ls.get('nk_buyer_phone_' + id) || '' }; },
    set(x) {
      const n = Object.assign(Profile.get(), x || {});
      ls.set('nk_buyer_profile', JSON.stringify({ name: n.name, phone: n.phone, email: n.email }));
      ls.set('nk_profile_name', n.name); ls.set('nk_profile_phone', n.phone); ls.set('nk_profile_email', n.email); ls.set('nk_profile_notify', n.notify ? '1' : '0');
      return n;
    }
  };
  async function saveContacts(p) {
    const tokens = [...tokenSet()]; if (!tokens.length) return { ok: true };
    const rows = tokens.map(t => ({ buyer_token: t, full_name: p.name || null, email: p.email || null, phone: p.phone || null, notify_email: p.notify !== false, updated_at: new Date().toISOString() }));
    try { const { error } = await getClient().from('buyer_contacts').upsert(rows, { onConflict: 'buyer_token' }); return { ok: !error, error }; } catch (e) { return { ok: false, error: e }; }
  }

  /* ═════ archived chats: kept on this device only ═════ */
  const Archive = {
    all() { try { const a = JSON.parse(ls.get('nk_chat_archived') || '[]'); return new Set(Array.isArray(a) ? a.map(String) : []); } catch (e) { return new Set(); } },
    has(id) { return Archive.all().has(String(id)); },
    set(id, on) { const s = Archive.all(); if (on) s.add(String(id)); else s.delete(String(id)); ls.set('nk_chat_archived', JSON.stringify([...s])); }
  };

  /* ═════ saved listings (same key saved-listings.js and saved.html use) ═════ */
  const savedIds = () => { try { const a = JSON.parse(ls.get('nk_saved_listings') || '[]'); return Array.isArray(a) ? a.filter(x => ID_RE.test(String(x))) : []; } catch (e) { return []; } };
  const setSaved = ids => ls.set('nk_saved_listings', JSON.stringify(ids));

  /* ═════ resume link: data lives in the URL #fragment, which browsers never send to any server ═════ */
  const b64u = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64u = s => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); };
  function hasResumeData() { return scanPairs().length > 0 || savedIds().length > 0; }
  function buildResumeLink() {
    const pairs = scanPairs(), saved = savedIds();
    if (!pairs.length && !saved.length) return null;
    const payload = { v: 3, c: pairs.map(p => [p.listingId, p.buyerToken]), s: saved, n: Profile.get().name || '' };   // no phone, no email
    return location.origin + '/inbox#nk_resume=' + b64u(JSON.stringify(payload));
  }
  function importResume() {
    let raw = null, legacyQuery = false;
    const hm = location.hash.match(/[#&]nk_resume=([^&]+)/);
    if (hm) raw = hm[1]; else { const q = new URLSearchParams(location.search).get('nk_resume'); if (q) { raw = q; legacyQuery = true; } }
    if (!raw) return 0;
    let n = 0;
    try {
      const txt = legacyQuery ? decodeURIComponent(escape(atob(decodeURIComponent(raw)))) : unb64u(raw);
      let d = null; try { d = JSON.parse(txt); } catch (e) {}
      const put = (lid, tok, name, phone) => { if (ID_RE.test(String(lid)) && TOKEN_RE.test(String(tok))) { ls.set('nk_buyer_' + lid, tok); if (name) ls.set('nk_buyer_name_' + lid, String(name).slice(0, 80)); if (phone) ls.set('nk_buyer_phone_' + lid, String(phone).slice(0, 20)); n++; } };
      if (d && d.v === 3) { (d.c || []).forEach(p => put(p[0], p[1])); if (d.n && !Profile.get().name) Profile.set({ name: String(d.n).slice(0, 80) }); if (Array.isArray(d.s)) setSaved([...new Set([...savedIds(), ...d.s.filter(x => ID_RE.test(String(x)))])]); }
      else if (d && d.v === 2) { (d.c || []).forEach(p => put(p.listingId, p.buyerToken, p.name, p.phone)); if (d.p) Profile.set({ name: d.p.name || '', email: d.p.email || '', phone: d.p.phone || '', notify: d.p.notify !== false }); if (Array.isArray(d.s)) setSaved([...new Set([...savedIds(), ...d.s.filter(x => ID_RE.test(String(x)))])]); }
      else txt.split(',').forEach(pair => { const i = pair.indexOf(':'); if (i > 0) put(pair.slice(0, i), pair.slice(i + 1)); });
    } catch (e) { console.error('Could not import resume link:', e); }
    try { const u = new URL(location.href); u.searchParams.delete('nk_resume'); u.hash = u.hash.replace(/[#&]?nk_resume=[^&]+/, '').replace(/^#?&?$/, ''); history.replaceState(null, '', u.pathname + u.search + (u.hash === '#' ? '' : u.hash)); } catch (e) {}
    return n;
  }

  /* ═════ conversations ═════ */
  const mapConvo = r => ({ listingId: String(r.listing_id), buyerToken: r.buyer_token, title: r.listing_title || ls.get('nk_last_listing_title_' + r.listing_id) || 'Listing', coverUrl: r.cover_url || '', sellerName: r.seller_name || 'Seller', sellerVerified: r.seller_verified === true, lastMessage: clean(r.last_message || ''), lastAt: r.last_message_at || null, unread: r.unread_count || 0 });
  const byRecent = (a, b) => new Date(b.lastAt || 0) - new Date(a.lastAt || 0);
  const convoFor = (lid, tok) => S.convos.find(c => c.listingId === String(lid) && (!tok || c.buyerToken === tok));
  const totalUnread = () => S.convos.reduce((s, c) => s + (c.unread || 0), 0);
  function loadCache() {
    try { const c = JSON.parse(ls.get(CACHE) || 'null'); if (Array.isArray(c)) { const ok = new Set(scanPairs().map(p => p.listingId + '|' + p.buyerToken)); S.convos = c.filter(x => ok.has(x.listingId + '|' + x.buyerToken)); } } catch (e) {}
  }
  const saveCache = () => ls.set(CACHE, JSON.stringify(S.convos.slice(0, 30)));
  function fetchConversations() {
    if (inflight) return inflight;
    inflight = (async () => {
      const pairs = scanPairs();
      if (!pairs.length) { S.convos = []; S.loadError = false; S.loading = false; emit('convos'); return; }
      S.loading = !S.convos.length; if (S.loading) emit('convos');
      let res; try { res = await getClient().rpc('get_buyer_conversations', { p_pairs: pairs.map(p => ({ listing_id: p.listingId, buyer_token: p.buyerToken })) }); } catch (e) { res = { error: e }; }
      S.loading = false;
      if (res.error) { S.loadError = true; emit('convos'); emit('error', { kind: 'load' }); return; }
      S.loadError = false;
      S.convos = (res.data || []).map(mapConvo).sort(byRecent);
      if (S.active && S.viewing) { const c = convoFor(S.active.listingId, S.active.token); if (c) c.unread = 0; }
      saveCache(); emit('convos'); ensureRealtime(); loadViewings();
    })().catch(e => { console.error('fetchConversations:', e); S.loading = false; }).finally(() => { inflight = null; });
    return inflight;
  }

  /* ═════ viewing requests of every chat, in one query ═════ */
  async function loadViewings() {
    const tokens = [...tokenSet()].slice(0, 100); if (!tokens.length) { S.viewings = {}; return; }
    try {
      const { data, error } = await getClient().from('viewing_requests').select('*').in('buyer_token', tokens);
      if (error || !Array.isArray(data)) return;
      const ok = new Set(scanPairs().map(p => p.listingId + '|' + p.buyerToken)), map = {};
      data.forEach(v => { if (ok.has(String(v.listing_id) + '|' + v.buyer_token)) (map[String(v.listing_id)] = map[String(v.listing_id)] || []).push(v); });
      Object.values(map).forEach(a => a.sort((x, y) => String(x.requested_date).localeCompare(String(y.requested_date))));
      S.viewings = map; emit('viewing', {});
    } catch (e) {}
  }
  const viewingRows = id => S.viewings[String(id)] || [];
  const nextViewing = id => { const today = localISO(new Date()); return viewingRows(id).find(v => String(v.requested_date) >= today) || null; };
  const isBooked = id => !!S.booked[id] || viewingRows(id).length > 0;

  /* ═════ realtime: ONE channel filtered to this browser's own tokens ═════ */
  let chan = null, chanKey = '';
  function ensureRealtime() {
    const tokens = [...tokenSet()].slice(0, 100).sort(), key = tokens.join(',');
    if (key === chanKey && chan) return;
    if (chan) { try { getClient().removeChannel(chan); } catch (e) {} chan = null; }
    chanKey = key; if (!tokens.length) return;
    const filter = 'buyer_token=in.(' + tokens.join(',') + ')';
    try {
      chan = getClient().channel('nk-buyer-' + uuid().slice(0, 8))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, p => onInsert(p.new))
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, p => onUpdate(p.new))
        .subscribe();
    } catch (e) { console.error('realtime:', e); }
  }
  function normalize(m) {
    const raw = m.content || m.message || '';
    return { id: m.id || null, localId: null, sender: m.sender, content: clean(raw), created_at: m.created_at, read_at: m.read_at || null, status: 'sent', ai: !!m.is_ai_reply || AI_MARK.test(raw) };
  }
  function onInsert(row) {
    if (!row || !tokenSet().has(row.buyer_token)) return;                      // never show a row that is not ours
    const lid = String(row.listing_id), c = convoFor(lid, row.buyer_token);
    if (!c) { fetchConversations(); return; }
    const msg = normalize(row), isActive = !!S.active && S.active.listingId === lid && S.active.token === row.buyer_token;
    c.lastMessage = msg.content; c.lastAt = row.created_at; S.convos.sort(byRecent);
    if (row.sender === 'seller') {
      if (isActive) {
        if (!S.messages.some(m => m.id && m.id === msg.id)) { S.messages.push(msg); emit('thread', { type: 'append', message: msg, incoming: true }); }
        if (S.viewing) markRead(); else { c.unread++; emit('incoming', { convo: c, message: msg }); }
      } else { c.unread++; emit('incoming', { convo: c, message: msg }); }
    } else if (isActive && !S.messages.some(m => m.id && m.id === msg.id) && !S.messages.some(m => !m.id && m.content === msg.content && m.status === 'sending')) {
      S.messages.push(msg); emit('thread', { type: 'append', message: msg });   // sent from another of the buyer's devices
    }
    saveCache(); emit('convos');
  }
  function onUpdate(row) {
    if (!row || !S.active || String(row.listing_id) !== S.active.listingId) return;
    const m = S.messages.find(x => x.id && x.id === row.id);
    if (m && (row.read_at || null) !== m.read_at) { m.read_at = row.read_at || null; emit('thread', { type: 'update', message: m }); }
  }

  /* ═════ presence: connecting, online, away, typing ═════ */
  let pch = null, ptimer = null, typingT = null, lastTyping = 0;
  const setPresence = st => { S.presence = st; emit('presence', { state: st }); };
  const sellerOnline = () => !!pch && Object.keys(pch.presenceState()).some(k => k.startsWith('seller-'));
  function joinPresence() {
    leavePresence(); if (!S.active) return;
    const { listingId, token } = S.active;
    setPresence('connecting');
    ptimer = setTimeout(() => { if (S.presence === 'connecting') setPresence('away'); }, 6000);
    try {
      pch = getClient().channel('presence-' + listingId, { config: { presence: { key: 'buyer-' + token } } });
      pch.on('presence', { event: 'sync' }, () => { clearTimeout(ptimer); if (S.presence !== 'typing') setPresence(sellerOnline() ? 'online' : 'away'); })
         .on('broadcast', { event: 'typing' }, ({ payload }) => { if (payload && payload.from === 'seller') { setPresence('typing'); clearTimeout(typingT); typingT = setTimeout(() => setPresence(sellerOnline() ? 'online' : 'away'), 2500); } })
         .subscribe(async st => { if (st === 'SUBSCRIBED') { try { await pch.track({ online: true, at: Date.now() }); } catch (e) {} } });
    } catch (e) { setPresence('away'); }
  }
  function leavePresence() { clearTimeout(ptimer); clearTimeout(typingT); if (pch) { try { getClient().removeChannel(pch); } catch (e) {} pch = null; } }
  function typing() { if (!pch || !S.active) return; const n = Date.now(); if (n - lastTyping < 2000) return; lastTyping = n; try { pch.send({ type: 'broadcast', event: 'typing', payload: { from: 'buyer' } }); } catch (e) {} }

  /* ═════ opening a thread ═════ */
  const PAGE = 50;
  const LIST_EXT = 'listing_number,title,price,price_frequency,area,county,category,status,address,latitude,longitude,details,profiles(verification_status),listing_photos(url,is_cover,position)';
  const LIST_BASE = 'listing_number,title,price,price_frequency,area,status';
  const byTime = (a, b) => new Date(a.created_at) - new Date(b.created_at);
  async function fetchMessages(listingId, token, before) {
    let q = getClient().from('messages').select('*').eq('listing_id', listingId).eq('buyer_token', token).order('created_at', { ascending: false }).limit(PAGE + 1);
    if (before) q = q.lt('created_at', before);
    const r = await q; if (r.error) return r;
    const rows = (r.data || []).slice(0, PAGE); return { data: rows.sort(byTime), more: (r.data || []).length > PAGE, error: null };
  }
  async function fetchListing(listingId) {
    let l = await getClient().from('listings').select(LIST_EXT).eq('id', listingId).maybeSingle();
    if (l.error) l = await getClient().from('listings').select(LIST_BASE).eq('id', listingId).maybeSingle();
    return l;
  }
  async function openThread(listingId, tokenHint) {
    listingId = String(listingId);
    let c = convoFor(listingId);
    const token = (c && c.buyerToken) || tokenHint || ls.get('nk_buyer_' + listingId);
    if (!token || !TOKEN_RE.test(token)) return false;
    if (!c) { c = { listingId, buyerToken: token, title: ls.get('nk_last_listing_title_' + listingId) || 'Listing', coverUrl: '', sellerName: 'Seller', sellerVerified: false, lastMessage: '', lastAt: null, unread: 0 }; S.convos.unshift(c); emit('convos'); }
    S.unreadAtOpen = c.unread || 0; S.hasMore = false; S.listingGone = false;
    S.active = { listingId, token }; S.messages = []; S.listing = null;
    emit('thread', { type: 'reset', loading: true });
    joinPresence(); checkBooked(listingId, token);
    let m, l;
    try { [m, l] = await Promise.all([fetchMessages(listingId, token), fetchListing(listingId)]); } catch (e) { m = { error: e }; l = {}; }
    if (!S.active || S.active.listingId !== listingId) return false;                 // the buyer moved to another thread meanwhile
    if (m.error) { emit('thread', { type: 'reset', error: true }); emit('error', { kind: 'thread' }); return false; }
    S.messages = (m.data || []).map(normalize); S.hasMore = !!m.more;
    outbox.filter(x => x.listingId === listingId && x.token === token && !S.messages.includes(x)).forEach(x => S.messages.push(x));
    if (l && l.data) { S.listing = l.data; if (l.data.title && (c.title === 'Listing' || !c.title)) c.title = l.data.title; ls.set('nk_last_listing_title_' + listingId, l.data.title || ''); }
    else if (l && !l.error) S.listingGone = true;                                    // the listing is not visible any more (sold, removed or hidden)
    emit('thread', { type: 'reset' }); emit('convos');
    if (S.viewing) markRead();
    fetchConversations();
    return true;
  }
  async function loadEarlier() {
    if (!S.active || !S.hasMore) return 0;
    const { listingId, token } = S.active, first = S.messages.find(m => m.id && m.created_at); if (!first) return 0;
    const r = await fetchMessages(listingId, token, first.created_at);
    if (!S.active || S.active.listingId !== listingId || r.error) return 0;
    const have = new Set(S.messages.map(m => m.id).filter(Boolean)), add = (r.data || []).map(normalize).filter(m => !have.has(m.id));
    S.messages = add.concat(S.messages); S.hasMore = !!r.more; emit('thread', { type: 'prepend', count: add.length }); return add.length;
  }
  function closeThread() { leavePresence(); S.active = null; S.messages = []; S.listing = null; S.listingGone = false; S.unreadAtOpen = 0; S.hasMore = false; emit('thread', { type: 'closed' }); }
  async function markRead() {
    if (!S.active) return; const { listingId, token } = S.active, c = convoFor(listingId, token);
    if (c && c.unread) { c.unread = 0; emit('convos'); }
    try { await getClient().rpc('mark_thread_read', { p_listing_id: listingId, p_buyer_token: token }); } catch (e) {}
  }
  function setViewing(v) { S.viewing = !!v; if (v && S.active) markRead(); }
  function setPolling(v) { S.polling = !!v; if (v) fetchConversations(); }

  /* ═════ sending: instant on screen, retry on failure, queued while offline ═════ */
  const saveOutbox = () => ls.set(OB, JSON.stringify(outbox.map(m => ({ localId: m.localId, listingId: m.listingId, token: m.token, content: m.content, created_at: m.created_at }))));
  function loadOutbox() {
    try { const ok = new Set(scanPairs().map(p => p.listingId + '|' + p.buyerToken)); outbox = (JSON.parse(ls.get(OB) || '[]') || []).filter(x => ok.has(x.listingId + '|' + x.token)).map(x => Object.assign({ id: null, sender: 'buyer', read_at: null, status: 'queued', ai: false }, x)); } catch (e) { outbox = []; }
  }
  let aiLast = {};
  async function aiTrigger(lid, tok, text) {
    const k = lid + ':' + tok, n = Date.now(); if (aiLast[k] && n - aiLast[k] < 4000) return; aiLast[k] = n;
    try { await fetch(EDGE + '/ai-concierge-reply', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, body: JSON.stringify({ listingId: lid, buyerToken: tok, buyerName: Profile.forListing(lid).name, buyerMessage: text }) }); } catch (e) {}
  }
  function send(text) {
    text = String(text || '').trim(); if (!text || !S.active) return null;
    const lm = { id: null, localId: 'l' + uuid(), sender: 'buyer', content: text, created_at: new Date().toISOString(), read_at: null, ai: false, status: navigator.onLine === false ? 'queued' : 'sending', listingId: S.active.listingId, token: S.active.token };
    S.messages.push(lm); outbox.push(lm); saveOutbox();
    emit('thread', { type: 'append', message: lm, mine: true });
    const c = convoFor(lm.listingId, lm.token); if (c) { c.lastMessage = text; c.lastAt = lm.created_at; S.convos.sort(byRecent); emit('convos'); }
    if (lm.status === 'sending') push(lm);
    return lm;
  }
  async function push(lm) {
    if (lm.status === 'sending' && lm._busy) return; lm._busy = true; lm.status = 'sending';
    if (S.active && S.active.listingId === lm.listingId) emit('thread', { type: 'update', message: lm });
    const p = Profile.forListing(lm.listingId); let res;
    try { res = await getClient().from('messages').insert({ listing_id: lm.listingId, buyer_token: lm.token, buyer_name: p.name, buyer_phone: p.phone || null, sender: 'buyer', content: lm.content }).select().single(); } catch (e) { res = { error: e }; }
    lm._busy = false;
    if (res.error || !res.data) {
      lm.status = navigator.onLine === false ? 'queued' : 'failed';
      if (S.active && S.active.listingId === lm.listingId) emit('thread', { type: 'update', message: lm });
      emit('error', { kind: 'send', offline: navigator.onLine === false }); return;
    }
    outbox = outbox.filter(x => x !== lm); saveOutbox();
    const row = res.data;
    if (S.messages.some(m => m !== lm && m.id && m.id === row.id)) { S.messages = S.messages.filter(m => m !== lm); emit('thread', { type: 'reset' }); }   // realtime got there first
    else { lm.id = row.id; lm.created_at = row.created_at || lm.created_at; lm.status = 'sent'; if (S.active && S.active.listingId === lm.listingId) emit('thread', { type: 'update', message: lm }); }
    aiTrigger(lm.listingId, lm.token, lm.content);
  }
  function retry(localId) { const m = outbox.find(x => x.localId === localId); if (m && (m.status === 'failed' || m.status === 'queued')) push(m); }
  const flush = () => outbox.filter(m => m.status === 'queued' || m.status === 'failed').forEach(push);
  window.addEventListener('online', () => { S.net = true; emit('net', { online: true }); flush(); fetchConversations(); });
  window.addEventListener('offline', () => { S.net = false; emit('net', { online: false }); });

  /* ═════ call or WhatsApp the seller: the same rate-limited reveal the listing page uses ═════ */
  const contactCache = {};
  async function revealContact(listingId, channel) {
    if (contactCache[listingId]) return { phone: contactCache[listingId] };
    if (navigator.onLine === false) return { error: 'offline' };
    let r; try { r = await getClient().rpc('reveal_seller_contact', { p_listing_id: listingId, p_device_id: ls.get('nk_sid') || '', p_channel: channel }); } catch (e) { r = { error: e }; }
    if (r.error) return { error: 'unavailable' }; if (!r.data) return { error: 'limit' };
    contactCache[listingId] = r.data; return { phone: r.data };
  }

  /* ═════ viewing requests ═════ */
  async function checkBooked(listingId, token) {
    token = token || ls.get('nk_buyer_' + listingId); if (!token) return false;
    try { const { count } = await getClient().from('viewing_requests').select('id', { count: 'exact', head: true }).eq('listing_id', listingId).eq('buyer_token', token); S.booked[listingId] = (count || 0) > 0; } catch (e) {}
    emit('viewing', { listingId }); return !!S.booked[listingId];
  }
  async function requestViewing(v) {
    const listingId = String(v.listingId), name = String(v.name || '').trim(), phone = normPhone(v.phone), notes = String(v.notes || '').trim();
    if (!v.date) return { ok: false, field: 'date', error: 'Pick a date' };
    if (v.date < localISO(new Date())) return { ok: false, field: 'date', error: 'Pick today or a later date' };
    if (!v.time) return { ok: false, field: 'time', error: 'Choose a time' };
    if (name.length < 2) return { ok: false, field: 'name', error: 'Enter your name' };
    if (!okPhone(phone)) return { ok: false, field: 'phone', error: 'Enter a valid phone number, e.g. 0712 345 678' };
    if (navigator.onLine === false) return { ok: false, error: "You're offline. Try again when you're back online." };
    let token = v.token || ls.get('nk_buyer_' + listingId); if (!token || !TOKEN_RE.test(token)) { token = uuid(); ls.set('nk_buyer_' + listingId, token); }
    Profile.set({ name, phone });
    const { error: vErr } = await getClient().from('viewing_requests').insert({ id: uuid(), listing_id: listingId, buyer_token: token, buyer_name: name, buyer_phone: phone, requested_date: v.date, requested_time: v.time, notes: notes || null });
    if (vErr) return { ok: false, error: 'Could not send your request. Please try again.' };
    const when = new Date(v.date + 'T00:00:00').toLocaleDateString('en-KE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const summary = (v.reschedule ? '📅 Change of viewing time requested\nNew date: ' : '📅 Viewing requested\nDate: ') + when + '\nTime: ' + v.time + (notes ? '\nNotes: ' + notes : '');
    let warning = null;
    const { error: mErr } = await getClient().from('messages').insert({ listing_id: listingId, buyer_token: token, buyer_name: name, buyer_phone: phone, sender: 'buyer', content: summary });
    if (mErr) warning = 'Your request was saved, but the chat message did not send.';
    fetch(EDGE + '/send-notification-email', { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY }, body: JSON.stringify({ type: 'viewing_request', listingId, buyerName: name, buyerPhone: phone, date: v.date, time: v.time, notes }) }).catch(() => {});
    S.booked[listingId] = true; emit('viewing', { listingId });
    await fetchConversations(); await loadViewings();
    if (S.active && S.active.listingId === listingId) openThread(listingId, token);
    return { ok: true, warning, token };
  }
  async function report(listingId, details) {
    try { const { error } = await getClient().from('reports').insert({ target_type: 'listing', target_id: listingId, reason: 'other', details: details || 'Reported from chat' }); return { ok: !error }; } catch (e) { return { ok: false }; }
  }

  /* ═════ tab title badge: "(2) Page title", kept in step even when the page changes its own title ═════ */
  let badgeN = 0, titleObs = null, applying = false;
  function setTitleBadge(n) {
    badgeN = n; const strip = t => t.replace(/^\(\d+\+?\)\s/, '');
    const apply = () => { applying = true; const base = strip(document.title); document.title = (badgeN > 0 ? '(' + (badgeN > 9 ? '9+' : badgeN) + ') ' : '') + base; applying = false; };
    apply();
    if (!titleObs && window.MutationObserver) { const t = document.querySelector('title'); if (t) { titleObs = new MutationObserver(() => { if (!applying && badgeN > 0 && !/^\(\d+\+?\)\s/.test(document.title)) apply(); }); titleObs.observe(t, { childList: true }); } }
  }

  /* ═════ shared message markup (both interfaces style the same class names with their own prefix) ═════ */
  const ICON = {
    one: '<svg viewBox="0 0 16 11" width="15" height="10"><path d="M3 5.5l3 3 6-6"/></svg>',
    two: '<svg viewBox="0 0 16 11" width="15" height="10"><path d="M1 5.5l3 3 5-6"/><path d="M6 5.5l3 3 5-6"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="12" height="12"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>'
  };
  function tickHtml(m, p) {
    if (m.status === 'failed') return '';
    if (m.status === 'sending' || m.status === 'queued') return '<span class="' + p + '-tick" aria-label="Sending">' + ICON.clock + '</span>';
    return m.read_at ? '<span class="' + p + '-tick read" aria-label="Seen">' + ICON.two + '</span>' : '<span class="' + p + '-tick" aria-label="Sent">' + ICON.one + '</span>';
  }
  const escRe = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  function highlight(text, term) { const e = esc(text); if (!term) return e; return e.replace(new RegExp('(' + escRe(esc(term)) + ')', 'ig'), '<mark>$1</mark>'); }
  const dayHtml = (iso, p) => '<div class="' + p + '-day">' + esc(dayLabel(iso)) + '</div>';
  const SCAM = /(m-?pesa|paybill|pay bill|till (number|no)|buy ?goods|reservation fee|booking fee|send (me |us )?(the )?(money|deposit|cash)|(pay|deposit)[^.!?\n]{0,25}(first|before (viewing|you view|seeing)|upfront|in advance))/i;
  const LBL = { ai: 'Automated reply, written from the listing details', retry: 'Not sent. Tap to retry', queued: 'Waiting for a connection…', scam: 'Be careful: the seller mentioned a payment. Never pay before you have viewed the property, and never send money to a number you found only in chat.' };
  function rowHtml(m, prev, p, peer, term, labels) {
    const T = Object.assign({}, LBL, labels || {});
    const mine = m.sender === 'buyer', gap = prev ? new Date(m.created_at) - new Date(prev.created_at) : Infinity;
    const first = !prev || prev.sender !== m.sender || gap > 300000 || dayLabel(prev.created_at) !== dayLabel(m.created_at), k = m.localId || m.id || '';
    const av = first ? '<div class="' + p + '-av" aria-hidden="true">' + (mine ? 'You' : esc(peer || 'S')) + '</div>' : '<div class="' + p + '-av ' + p + '-avsp" aria-hidden="true"></div>';
    const ai = m.ai ? '<div class="' + p + '-ai">' + esc(T.ai) + '</div>' : '';
    const scam = (!mine && SCAM.test(m.content)) ? '<div class="' + p + '-scam" role="note">' + esc(T.scam) + '</div>' : '';
    const st = m.status === 'failed' ? '<button type="button" class="' + p + '-retry" data-retry="' + esc(k) + '">' + esc(T.retry) + '</button>' : m.status === 'queued' ? '<div class="' + p + '-queued">' + esc(T.queued) + '</div>' : '';
    return '<div class="' + p + '-row' + (mine ? ' mine' : '') + (first ? ' first' : '') + (m.status === 'failed' ? ' failed' : '') + '" data-k="' + esc(k) + '">' + av + '<div class="' + p + '-col"><div class="' + p + '-bubble">' + highlight(m.content, term) + '</div>' + ai + scam + '<div class="' + p + '-time">' + esc(timeLabel(m.created_at)) + (mine ? tickHtml(m, p) : '') + '</div>' + st + '</div></div>';
  }
  const QUICK = ['Is this still available?', "I'd like to book a viewing", 'Is a deposit required?', 'Is the price negotiable?', "What's included in the rent?", 'Can you share more photos?', 'How far is it from town?'];

  /* ═════ start ═════ */
  let pollT = null;
  function init() {
    if (started) return; started = true;
    importResume(); loadCache(); loadOutbox();
    emit('convos');
    fetchConversations().then(() => { if (S.net) flush(); });
    pollT = setInterval(() => { if (S.polling && document.visibilityState === 'visible') fetchConversations(); }, 20000);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') { fetchConversations(); if (S.active && S.viewing) markRead(); } });
  }

  window.NKChatCore = {
    version: '2.0', on, init, getClient, esc, uuid, ls, Profile, saveContacts, savedIds, setSaved, normPhone, okPhone, prettyPhone, priceLabel, localISO, initials, dayLabel, timeLabel, whenLabel,
    setLang, Archive, revealContact, loadEarlier, loadViewings, viewingRows, nextViewing, hasMore: () => S.hasMore, listingGone: () => S.listingGone, unreadAtOpen: () => S.unreadAtOpen,
    convos: () => S.convos, unread: totalUnread, loading: () => S.loading, loadError: () => S.loadError, active: () => S.active, messages: () => S.messages, listing: () => S.listing, presence: () => S.presence, isOnline: () => S.net, booked: isBooked,
    fetchConversations, openThread, closeThread, markRead, setViewing, setPolling, send, retry, typing, requestViewing, checkBooked, report,
    buildResumeLink, hasResumeData, importResume, scanPairs, setTitleBadge,
    ui: { rowHtml, dayHtml, tickHtml, highlight, QUICK, scamTest: t => SCAM.test(t) }
  };
})();