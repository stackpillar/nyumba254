/*!
 * Nyumba254 — Quick Help widget ("Nia")
 * ────────────────────────────────────────────────────────────────
 * ONE FILE. Drop this on every page with a single tag, right before
 * </body>:
 *
 *   <script src="/js/nk-quick-help-widget.js" defer></script>
 *
 * (Path above assumes you host it at /js/ — put it wherever your other
 * shared JS lives and adjust the src accordingly.)
 *
 * The script injects its own <style>, its own markup, loads the
 * Supabase JS SDK and the Inter/Playfair fonts automatically if the
 * page hasn't already loaded them, and is safe to include even if a
 * page's own <script> block also creates a Supabase client called
 * `db` — the widget will reuse that client instead of opening a
 * second connection.
 *
 * Config you may want to touch is in NK_QH_CONFIG below (Gemini key,
 * model). Everything else works out of the box.
 * ────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  // Guard against the script being included twice on the same page.
  if (window.__NK_QH_LOADED__) return;
  window.__NK_QH_LOADED__ = true;

  // ═══════════════════════════════════════════════════════════════
  // 0. CONFIG
  // ═══════════════════════════════════════════════════════════════
  const NK_QH_CONFIG = {
    GEMINI_PROXY_URL: 'https://vliuuloyfhyxcsuchpss.supabase.co/functions/v1/gemini-proxy',
  };

  const NK_QH_SUPABASE_URL = 'https://vliuuloyfhyxcsuchpss.supabase.co';
  const NK_QH_SUPABASE_KEY = 'sb_publishable_oIIcecf3wzKMual5K24Z8Q_zmxVfgsx';

  // A conversation (bot or live) that's been idle this long is treated as
  // ended: reopening the widget shows the topic menu again instead of
  // resuming the old thread or the message box.
  const NK_QH_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  const ESCALATION_KEYWORDS = [
    'refund', 'scam', 'scammed', 'fraud', 'not working', "isn't working",
    'lawyer', 'legal', 'police', 'urgent', 'emergency', 'complaint',
    'sue', 'stolen', 'hacked', 'unsafe', 'threat',
  ];

  const NK_QH_SYSTEM_PROMPT = `You are Nia, the friendly Quick Help assistant on Nyumba254, a Kenyan property listing website (no agents, no commission).

Facts you know:
- Nyumba254 lets buyers/renters browse apartments, student housing, luxury properties, and shops/offices for free, and contact sellers directly via WhatsApp — no agents, no middlemen.
- Sellers post listings directly and pay a one-time flat fee (Standard or Featured plan) via M-Pesa STK Push. There is 0% commission on any sale or rental — the fee is only for the listing itself.
- Featured listings get more photos, top placement in search, a badge, and homepage visibility.
- Fully live in Kisumu, Nairobi, and Mombasa; expanding county by county across all of Kenya's 47 counties. Sellers can list anywhere even before an area is "fully live."
- Listing takes under 10 minutes: create a free account, fill in details, upload photos, choose a plan, pay via M-Pesa.
- Payments are M-Pesa only right now. Nyumba254 never sees or stores M-Pesa PINs.
- Buyers pay nothing, ever.
- Sellers can edit, pause, or remove any of their listings anytime from their dashboard once signed in — no need to contact the team for routine changes.
- Basic safety tips for buyers: never send money before viewing a property in person, deal directly through the contact details on the listing itself, and report anything that feels off (price too good to be true, pressure to pay upfront) via the in-app "Report a listing" option.
- For exact current prices, tell the user to check the Pricing page, since fees can change.

Rules:
- Answer in 2-4 short sentences, warm and plain, never robotic-sounding filler.
- If you don't know something, or it involves a payment dispute, account problem, personal data, or anything you're not confident about, say so honestly and suggest talking to the team — don't guess.
- Never invent prices, phone numbers, or policies not listed above.
- You are not able to take actions (can't post listings, process payments, or look up a specific user's account) — only answer questions and hand off to a human for anything account-specific.`;

  // ═══════════════════════════════════════════════════════════════
  // 1. ASSET LOADING — fonts + Supabase SDK, only if not already present
  // ═══════════════════════════════════════════════════════════════
  function nkQhEnsureStylesheet(id, href) {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function nkQhEnsureFonts() {
    if (!document.getElementById('nk-qh-font-preconnect')) {
      const pre = document.createElement('link');
      pre.id = 'nk-qh-font-preconnect';
      pre.rel = 'preconnect';
      pre.href = 'https://fonts.googleapis.com';
      document.head.appendChild(pre);
    }
    nkQhEnsureStylesheet(
      'nk-qh-fonts',
      'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap'
    );
  }

  function nkQhLoadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve();
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', reject);
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => { s.dataset.loaded = 'true'; resolve(); };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  // Resolves once window.supabase (the SDK, not a page's client instance
  // named `db`) is available, loading it from CDN if needed.
  function nkQhEnsureSupabaseSdk() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      return Promise.resolve();
    }
    return nkQhLoadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
  }

  // ═══════════════════════════════════════════════════════════════
  // 2. STYLES
  // ═══════════════════════════════════════════════════════════════
  const NK_QH_CSS = `
:root{
  --qh-green:#0F6E56; --qh-green-dark:#085041; --qh-green-mid:#1D9E75; --qh-green-light:#E1F5EE;
  --qh-gold:#BA7517; --qh-gold-light:#FAEEDA; --qh-red:#C53030; --qh-red-light:#FFF5F5;
  --qh-text:#1a1a18; --qh-text-2:#4a4a46; --qh-text-3:#888780;
  --qh-border:#e0ded8; --qh-surface:#f7f6f2; --qh-white:#fff;
}
#nk-qh-root, #nk-qh-root *{box-sizing:border-box;font-family:'Inter',sans-serif;}

#nk-qh-launcher{
  position:fixed;bottom:24px;right:24px;z-index:2000;
  width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;
  background:var(--qh-green);box-shadow:0 6px 20px rgba(15,110,86,0.4);
  display:flex;align-items:center;justify-content:center;
  transition:transform .2s,background .2s;
}
#nk-qh-launcher:hover{background:var(--qh-green-dark);transform:scale(1.06);}
#nk-qh-launcher svg{width:26px;height:26px;stroke:#fff;fill:none;stroke-width:2;stroke-linecap:round;}
#nk-qh-launcher .nk-qh-pulse{
  position:absolute;inset:0;border-radius:50%;border:2px solid var(--qh-green-mid);
  animation:nkQhPulse 2.4s ease-out infinite;
}
@keyframes nkQhPulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}
#nk-qh-launcher .nk-qh-dot{
  position:absolute;top:-2px;right:-2px;width:14px;height:14px;border-radius:50%;
  background:var(--qh-gold);border:2px solid #fff;
}

#nk-qh-panel{
  position:fixed;bottom:92px;right:24px;z-index:2000;
  width:372px;height:min(640px,80vh);max-height:min(640px,80vh);
  background:var(--qh-white);border-radius:18px;overflow:hidden;
  box-shadow:0 20px 60px rgba(0,0,0,0.22);
  display:none;flex-direction:column;
  animation:nkQhUp .22s ease;
}
#nk-qh-panel.open{display:flex;}
@keyframes nkQhUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}

.nk-qh-head{
  background:linear-gradient(135deg,var(--qh-green-dark),var(--qh-green));
  padding:16px 14px 16px 18px;display:flex;align-items:center;gap:12px;flex-shrink:0;color:#fff;position:relative;
}
.nk-qh-avatar{
  width:40px;height:40px;border-radius:12px;background:rgba(255,255,255,0.15);
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
}
.nk-qh-avatar svg{width:20px;height:20px;stroke:#fff;fill:none;stroke-width:2;}
.nk-qh-head-text{flex:1;min-width:0;}
.nk-qh-head-title{font-size:15px;font-weight:700;display:flex;align-items:center;gap:6px;}
.nk-qh-head-status{font-size:11.5px;color:rgba(255,255,255,0.75);display:flex;align-items:center;gap:5px;margin-top:1px;}
.nk-qh-head-status .dot{width:6px;height:6px;border-radius:50%;background:#5DE2B4;flex-shrink:0;}
.nk-qh-head-status .dot.live{background:#FFD166;animation:nkQhLiveBlink 1.3s ease-in-out infinite;}
@keyframes nkQhLiveBlink{0%,100%{opacity:1}50%{opacity:.3}}
.nk-qh-head-actions{display:flex;align-items:center;gap:4px;flex-shrink:0;}
.nk-qh-head-btn{background:rgba(255,255,255,0.12);border:none;width:28px;height:28px;border-radius:8px;color:#fff;font-size:15px;cursor:pointer;flex-shrink:0;transition:background .15s;display:flex;align-items:center;justify-content:center;}
.nk-qh-head-btn:hover{background:rgba(255,255,255,0.24);}
.nk-qh-head-btn svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2;}

.nk-qh-body{flex:1;overflow-y:auto;padding:16px 14px;display:flex;flex-direction:column;gap:10px;background:var(--qh-surface);scroll-behavior:smooth;}
.nk-qh-body::-webkit-scrollbar{width:4px;}
.nk-qh-body::-webkit-scrollbar-thumb{background:var(--qh-border);border-radius:2px;}

.nk-qh-greet{background:#fff;border:1px solid var(--qh-border);border-radius:14px 14px 14px 3px;padding:13px 15px;font-size:13.5px;line-height:1.6;color:var(--qh-text-2);max-width:92%;}
.nk-qh-greet strong{display:block;color:var(--qh-text);font-size:14px;margin-bottom:3px;}

.nk-qh-section-label{font-size:10.5px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--qh-text-3);margin:4px 2px 0;}

.nk-qh-row{display:flex;flex-direction:column;}
.nk-qh-row.user{align-items:flex-end;}
.nk-qh-row.bot{align-items:flex-start;}
.nk-qh-bubble{max-width:86%;padding:10px 14px;font-size:13.5px;line-height:1.55;word-break:break-word;}
.nk-qh-bubble.user{background:var(--qh-green);color:#fff;border-radius:14px 14px 3px 14px;}
.nk-qh-bubble.bot{background:#fff;border:1px solid var(--qh-border);color:var(--qh-text);border-radius:14px 14px 14px 3px;}
.nk-qh-time{font-size:10px;color:var(--qh-text-3);margin-top:3px;padding:0 3px;}

.nk-qh-chips{display:flex;flex-wrap:wrap;gap:7px;margin-top:2px;max-width:96%;}
.nk-qh-chip{
  font-size:12.5px;font-weight:500;padding:7px 13px;border-radius:20px;
  border:1.5px solid var(--qh-green);color:var(--qh-green);background:#fff;
  cursor:pointer;transition:all .15s;
}
.nk-qh-chip:hover{background:var(--qh-green);color:#fff;}
.nk-qh-chip.gold{border-color:var(--qh-gold);color:var(--qh-gold);}
.nk-qh-chip.gold:hover{background:var(--qh-gold);color:#fff;}
.nk-qh-chip.red{border-color:var(--qh-red);color:var(--qh-red);}
.nk-qh-chip.red:hover{background:var(--qh-red);color:#fff;}

.nk-qh-escalate{
  align-self:flex-start;display:flex;align-items:flex-start;gap:8px;
  background:var(--qh-gold-light);border:1px solid #F0CE8F;color:#7A4E0A;
  border-radius:12px;padding:10px 13px;font-size:12.5px;line-height:1.5;max-width:92%;
}
.nk-qh-escalate svg{width:14px;height:14px;stroke:#BA7517;fill:none;stroke-width:2;flex-shrink:0;margin-top:1px;}
.nk-qh-escalate-btn{
  margin-top:8px;display:inline-flex;align-items:center;gap:6px;
  background:#0F6E56;color:#fff;font-size:12px;font-weight:600;
  padding:7px 12px;border-radius:8px;border:none;cursor:pointer;
}
.nk-qh-escalate-btn:hover{background:#085041;}

.nk-qh-invite-card{
  align-self:flex-start;background:#fff;border:1px solid var(--qh-border);border-radius:14px 14px 14px 3px;
  padding:12px 14px;max-width:92%;
}
.nk-qh-invite-card p{font-size:13px;color:var(--qh-text-2);margin-bottom:9px;line-height:1.5;}
.nk-qh-invite-actions{display:flex;gap:7px;flex-wrap:wrap;}
.nk-qh-invite-btn{
  display:inline-flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;
  padding:8px 12px;border-radius:8px;border:none;cursor:pointer;text-decoration:none;
}
.nk-qh-invite-btn.wa{background:#25D366;color:#fff;}
.nk-qh-invite-btn.wa:hover{background:#128C3E;}
.nk-qh-invite-btn.copy{background:var(--qh-surface);color:var(--qh-text-2);border:1.5px solid var(--qh-border);}
.nk-qh-invite-btn.copy:hover{border-color:var(--qh-green);color:var(--qh-green);}

.nk-qh-resolved-banner{
  align-self:center;background:var(--qh-surface);border:1px solid var(--qh-border);
  border-radius:20px;padding:6px 14px;font-size:11.5px;color:var(--qh-text-3);
}

.nk-qh-history-list{display:flex;flex-direction:column;gap:2px;margin:-16px -14px 0;}
.nk-qh-history-item{
  padding:14px 18px;border-bottom:1px solid var(--qh-border);cursor:pointer;
  transition:background .15s;background:#fff;
}
.nk-qh-history-item:hover{background:var(--qh-surface);}
.nk-qh-history-top{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:4px;}
.nk-qh-history-title{font-size:13.5px;font-weight:600;color:var(--qh-text);}
.nk-qh-history-date{font-size:11px;color:var(--qh-text-3);flex-shrink:0;}
.nk-qh-history-preview{
  font-size:12.5px;color:var(--qh-text-2);line-height:1.5;
  overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;
}
.nk-qh-history-badge{
  display:inline-block;margin-top:8px;font-size:11px;font-weight:500;
  color:var(--qh-text-3);background:var(--qh-surface);border:1px solid var(--qh-border);
  border-radius:20px;padding:3px 10px;
}
.nk-qh-history-newbtn{
  display:block;width:100%;margin-top:auto;padding:13px;border-radius:24px;
  background:var(--qh-text);color:#fff;font-size:14px;font-weight:600;
  transition:background .15s;flex-shrink:0;
}
.nk-qh-history-newbtn:hover{background:var(--qh-green-dark);}

.nk-qh-typing{display:none;align-items:flex-start;}
.nk-qh-typing.show{display:flex;}
.nk-qh-typing-bub{background:#fff;border:1px solid var(--qh-border);border-radius:14px 14px 14px 3px;padding:11px 15px;display:flex;gap:4px;}
.nk-qh-typing-bub span{width:6px;height:6px;border-radius:50%;background:var(--qh-text-3);animation:nkQhDot 1.2s infinite;}
.nk-qh-typing-bub span:nth-child(2){animation-delay:.18s;}
.nk-qh-typing-bub span:nth-child(3){animation-delay:.36s;}
@keyframes nkQhDot{0%,80%,100%{transform:scale(.7);opacity:.4}40%{transform:scale(1);opacity:1}}

.nk-qh-inputbar{padding:10px 12px;border-top:1px solid var(--qh-border);background:#fff;display:flex;gap:8px;align-items:flex-end;flex-shrink:0;}
#nk-qh-input{
  flex:1;border:1.5px solid var(--qh-border);border-radius:20px;padding:9px 14px;
  font-size:13.5px;font-family:inherit;color:var(--qh-text);background:var(--qh-surface);
  outline:none;resize:none;max-height:90px;line-height:1.5;transition:border-color .15s,background .15s;
}
#nk-qh-input:focus{border-color:var(--qh-green);background:#fff;}
#nk-qh-send{
  width:36px;height:36px;border-radius:50%;flex-shrink:0;border:none;cursor:pointer;
  background:var(--qh-green);display:flex;align-items:center;justify-content:center;transition:background .15s;
}
#nk-qh-send:hover:not(:disabled){background:var(--qh-green-dark);}
#nk-qh-send:disabled{opacity:.45;cursor:not-allowed;}
#nk-qh-send svg{width:15px;height:15px;stroke:#fff;fill:none;stroke-width:2.5;}

.nk-qh-foot-note{text-align:center;font-size:10.5px;color:var(--qh-text-3);padding:6px 0 2px;background:#fff;}

@media (max-width:420px){
  #nk-qh-panel{width:calc(100vw - 20px);right:10px;bottom:84px;height:78vh;max-height:78vh;}
}
`;

  // ═══════════════════════════════════════════════════════════════
  // 3. MARKUP
  // ═══════════════════════════════════════════════════════════════
  const NK_QH_HTML = `
<button id="nk-qh-launcher" aria-label="Open Quick Help">
  <span class="nk-qh-pulse"></span>
  <span class="nk-qh-dot" id="nk-qh-dot" style="display:none"></span>
  <svg id="nk-qh-icon-open" viewBox="0 0 24 24"><path d="M8 10h8M8 14h5M21 12c0 4.97-4.03 9-9 9-1.4 0-2.72-.32-3.9-.88L3 21l1.02-3.9A8.96 8.96 0 013 12c0-4.97 4.03-9 9-9s9 4.03 9 9z"/></svg>
  <svg id="nk-qh-icon-close" viewBox="0 0 24 24" style="display:none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
</button>

<div id="nk-qh-panel">
  <div class="nk-qh-head">
    <div class="nk-qh-avatar">
      <svg viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
    </div>
    <div class="nk-qh-head-text">
      <div class="nk-qh-head-title">Quick Help <span style="font-weight:400;opacity:.7">· Nia</span></div>
      <div class="nk-qh-head-status"><span class="dot" id="nk-qh-status-dot"></span><span id="nk-qh-status-text">Nyumba254's assistant — online</span></div>
    </div>
    <div class="nk-qh-head-actions">
      <button class="nk-qh-head-btn" id="nk-qh-menu-btn" aria-label="Back to conversations" title="Back to conversations">
        <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
      </button>
      <button class="nk-qh-head-btn" id="nk-qh-close-btn" aria-label="Close">✕</button>
    </div>
  </div>

  <div class="nk-qh-body" id="nk-qh-body"></div>

  <div class="nk-qh-typing" id="nk-qh-typing" style="padding:0 14px 8px;">
    <div class="nk-qh-typing-bub"><span></span><span></span><span></span></div>
  </div>

  <div class="nk-qh-inputbar">
    <textarea id="nk-qh-input" rows="1" placeholder="Type your question…"></textarea>
    <button id="nk-qh-send" disabled aria-label="Send">
      <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
    </button>
  </div>
  <div class="nk-qh-foot-note" id="nk-qh-foot-note">Nia is an assistant, not a person — she'll bring in the team if needed</div>
</div>
`;

  function nkQhInjectMarkup() {
    if (document.getElementById('nk-qh-styles')) return; // already injected

    const style = document.createElement('style');
    style.id = 'nk-qh-styles';
    style.textContent = NK_QH_CSS;
    document.head.appendChild(style);

    const root = document.createElement('div');
    root.id = 'nk-qh-root';
    root.innerHTML = NK_QH_HTML;
    document.body.appendChild(root);
  }

  // ═══════════════════════════════════════════════════════════════
  // 4. WIDGET LOGIC
  // ═══════════════════════════════════════════════════════════════
  function nkQhInit() {
    let open = false;
    let started = false;
    let mode = 'bot';              // 'bot' | 'report' | 'live'
    let conversationHistory = [];  // [{role:'user'|'model', text}]

    // ── 24-hour idle expiry ─────────────────────────────────────
    function getLastActiveAt() {
      try { return parseInt(localStorage.getItem('nk_qh_last_active_at'), 10) || null; } catch (e) { return null; }
    }
    function touchLastActive() {
      try { localStorage.setItem('nk_qh_last_active_at', String(Date.now())); } catch (e) { /* private mode etc. */ }
    }

    function nkQhBuildMenu() {
      const sections = [
        {
          label: 'Browsing & listings',
          chips: [
            { label: '🏠 Browse listings', type: 'nav', href: 'listings.html' },
            { label: '📋 List my property', type: 'nav', href: 'post-listing.html' },
            { label: '💰 Pricing & plans', type: 'ask', q: 'What does it cost to list?' },
            { label: '⭐ Standard vs Featured?', type: 'ask', q: "What's the difference between a Standard and Featured listing?" },
            { label: '📍 Areas we cover', type: 'ask', q: 'What areas do you cover?' },
            { label: '🗂️ Edit or remove my listing', type: 'ask', q: "Can I edit or remove my listing after it's posted?" },
            { label: 'ℹ️ How it works', type: 'nav', href: 'how-it-works.html' },
          ],
        },
        {
          label: 'My account',
          chips: [
            { label: '❤️ My saved listings', type: 'nav', href: 'saved.html' },
            { label: '👤 Seller login / dashboard', type: 'nav', href: 'login.html' },
            { label: '🆓 Do buyers pay anything?', type: 'ask', q: 'Do buyers ever have to pay to use Nyumba254?' },
            { label: '💬 Track a reply to my enquiry', type: 'ask', q: 'How do I check replies to my enquiry?' },
            { label: '📲 M-Pesa payment issue', type: 'ask', q: 'My M-Pesa payment is not reflecting' },
          ],
        },
        {
          label: 'Trust & safety',
          chips: [
            { label: '🛡️ Is a listing trustworthy?', type: 'ask', q: 'How do I know if a listing is trustworthy and not fake?' },
            { label: '🚩 Report a listing', type: 'report', reason: 'fake_listing' },
            { label: '⚠️ Report a scam', type: 'report', reason: 'scam_attempt' },
            { label: '📝 Listing details are wrong', type: 'report', reason: 'wrong_info' },
            { label: '🐞 Report a bug on the site', type: 'report', reason: 'other' },
          ],
        },
        {
          label: 'Something else',
          chips: [
            { label: '📨 Invite a friend', type: 'invite' },
            { label: '📖 FAQ', type: 'nav', href: 'faq.html' },
            { label: '✉️ Contact us', type: 'nav', href: 'contact.html' },
            { label: '📄 Terms & Privacy', type: 'nav', href: 'terms.html' },
            { label: '🙋 Talk to a real person', type: 'escalate' },
          ],
        },
      ];

      // Contextual chip: if the page has a global `listing` object loaded
      // (listing.html), offer a shortcut that pre-fills the question.
      try {
        if (typeof window.listing !== 'undefined' && window.listing && window.listing.title) {
          sections[0].chips.unshift({
            label: '❓ Ask about this listing',
            type: 'ask',
            q: `I have a question about the listing "${window.listing.title}".`,
          });
        }
      } catch (e) { /* listing not defined on this page — fine */ }

      return sections;
    }

    // ── UI plumbing ────────────────────────────────────────────
    const body = document.getElementById('nk-qh-body');
    const typing = document.getElementById('nk-qh-typing');
    const input = document.getElementById('nk-qh-input');
    const sendBtn = document.getElementById('nk-qh-send');
    const statusText = document.getElementById('nk-qh-status-text');
    const statusDot = document.getElementById('nk-qh-status-dot');
    const footNote = document.getElementById('nk-qh-foot-note');
    const inputBar = document.querySelector('.nk-qh-inputbar');
    const launcher = document.getElementById('nk-qh-launcher');
    const panel = document.getElementById('nk-qh-panel');
    const iconOpen = document.getElementById('nk-qh-icon-open');
    const iconClose = document.getElementById('nk-qh-icon-close');
    const dot = document.getElementById('nk-qh-dot');

    function scrollBottom() { body.scrollTop = body.scrollHeight; }
    function timeNow() { return new Date().toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }); }

    function renderMenuBlock(intro) {
      const wrap = document.createElement('div');
      wrap.style.display = 'flex';
      wrap.style.flexDirection = 'column';
      wrap.style.gap = '8px';

      if (intro) {
        const greetEl = document.createElement('div');
        greetEl.className = 'nk-qh-greet';
        greetEl.innerHTML = intro;
        wrap.appendChild(greetEl);
      }

      nkQhBuildMenu().forEach(section => {
        const label = document.createElement('div');
        label.className = 'nk-qh-section-label';
        label.textContent = section.label;
        wrap.appendChild(label);

        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'nk-qh-chips';
        section.chips.forEach(chip => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'nk-qh-chip' + (chip.type === 'report' ? ' red' : chip.type === 'escalate' ? ' gold' : '');
          btn.textContent = chip.label;
          btn.onclick = () => handleChip(chip);
          chipsWrap.appendChild(btn);
        });
        wrap.appendChild(chipsWrap);
      });

      return wrap;
    }

    function renderStart() {
      inputBar.style.display = 'flex';
      footNote.style.display = 'block';
      body.innerHTML = '';
      body.appendChild(renderMenuBlock(
        `<strong>Hi, I'm Nia 👋</strong>Nyumba254's quick-help assistant. Pick a topic below, or just type your question — and I'll bring in the team if it's something only they can handle.`
      ));
    }

    function showMenu() {
      body.appendChild(renderMenuBlock('<strong>Here\'s what I can help with 👇</strong>'));
      scrollBottom();
    }

    function addUserBubble(text) {
      const row = document.createElement('div');
      row.className = 'nk-qh-row user';
      row.innerHTML = `<div class="nk-qh-bubble user"></div><div class="nk-qh-time">${timeNow()}</div>`;
      row.querySelector('.nk-qh-bubble').textContent = text;
      body.appendChild(row);
      scrollBottom();
    }

    function addBotBubble(text, chips, escalate) {
      const row = document.createElement('div');
      row.className = 'nk-qh-row bot';
      const bubble = document.createElement('div');
      bubble.className = 'nk-qh-bubble bot';
      bubble.textContent = text;
      row.appendChild(bubble);
      const t = document.createElement('div');
      t.className = 'nk-qh-time';
      t.textContent = timeNow();
      row.appendChild(t);

      if (chips && chips.length) {
        const chipsWrap = document.createElement('div');
        chipsWrap.className = 'nk-qh-chips';
        chips.forEach(label => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'nk-qh-chip';
          btn.textContent = label;
          btn.onclick = () => handleChip(
            label === 'Talk to a real person' ? { type: 'escalate' } :
            label === 'Choose a different topic' ? { type: 'menu' } :
            label === 'Report a listing' ? { type: 'report', reason: 'fake_listing', label } :
            label === 'Seller login / dashboard' ? { type: 'nav', href: 'login.html', label } :
            { type: 'ask', q: label }
          );
          chipsWrap.appendChild(btn);
        });
        row.appendChild(chipsWrap);
      }
      body.appendChild(row);
      if (escalate) addEscalateCard();
      scrollBottom();
    }

    function addEscalateCard() {
      const card = document.createElement('div');
      card.className = 'nk-qh-escalate';
      card.innerHTML = `
        <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div>
          This one needs a human touch.
          <br><button type="button" class="nk-qh-escalate-btn" id="nk-qh-escalate-cta">Talk to the team</button>
        </div>`;
      body.appendChild(card);
      card.querySelector('#nk-qh-escalate-cta').onclick = startLiveChat;
      scrollBottom();
    }

    function addInviteCard() {
      const origin = window.location.origin + window.location.pathname.replace(/[^/]*$/, 'index.html');
      const shareText = `🏠 Check out Nyumba254 — find or list apartments, shops, and offices across Kenya. No agents, no commission: ${origin}`;
      const waHref = `https://wa.me/?text=${encodeURIComponent(shareText)}`;

      const card = document.createElement('div');
      card.className = 'nk-qh-invite-card';
      card.innerHTML = `
        <p>Know someone hunting for a place, or with a property to list? Share Nyumba254 with them 👇</p>
        <div class="nk-qh-invite-actions">
          <a class="nk-qh-invite-btn wa" href="${waHref}" target="_blank" rel="noopener">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M17.5 14.4c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51-.17-.01-.37-.01-.57-.01-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.21 3.07.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.7.62.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2.01-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35"/></svg>
            Share on WhatsApp
          </a>
          <button type="button" class="nk-qh-invite-btn copy" id="nk-qh-copy-invite">Copy link</button>
        </div>`;
      body.appendChild(card);
      card.querySelector('#nk-qh-copy-invite').onclick = (e) => copyInviteLink(e.currentTarget, origin);
      scrollBottom();
    }

    function copyInviteLink(btn, rawLink) {
      // Force plain text no matter what's passed in — strips any HTML tags
      // and decodes entities so nothing but a bare URL ever hits the clipboard.
      const tmp = document.createElement('div');
      tmp.innerHTML = rawLink;
      const link = (tmp.textContent || tmp.innerText || rawLink).trim();
      const done = (ok) => {
        const orig = btn.textContent;
        btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
        setTimeout(() => { btn.textContent = orig; }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).then(() => done(true)).catch(() => done(false));
      } else {
        // Fallback for browsers/contexts without the async clipboard API
        try {
          const ta = document.createElement('textarea');
          ta.value = link;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done(true);
        } catch (e) { done(false); }
      }
    }

    function showTyping() { typing.classList.add('show'); scrollBottom(); }
    function hideTyping() { typing.classList.remove('show'); }

    // ── Chip dispatch ──────────────────────────────────────────
    function handleChip(chip) {
      if (chip.type === 'nav') {
        addUserBubble(chip.label);
        showTyping();
        setTimeout(() => {
          hideTyping();
          addBotBubble(`Opening ${chip.label.replace(/^\W+\s*/, '')}…`, null, false);
          setTimeout(() => { window.location.href = chip.href; }, 450);
        }, 350);
        return;
      }
      if (chip.type === 'invite') {
        addUserBubble(chip.label);
        showTyping();
        setTimeout(() => { hideTyping(); addInviteCard(); }, 350);
        return;
      }
      if (chip.type === 'report') {
        addUserBubble(chip.label);
        startReportFlow(chip.reason);
        return;
      }
      if (chip.type === 'escalate') {
        addUserBubble(chip.label || 'Talk to a real person');
        startLiveChat();
        return;
      }
      if (chip.type === 'menu') {
        addUserBubble(chip.label || 'Choose a different topic');
        if (mode === 'live' && !humanJoined) {
          // Only waiting on a human, nobody's actually joined yet —
          // safe to hand back to the bot if they ask something else.
          mode = 'bot';
          statusDot.classList.remove('live');
          statusText.textContent = "Nyumba254's assistant — online";
          footNote.textContent = "Nia is an assistant, not a person — she'll bring in the team if needed";
          input.placeholder = 'Type your question…';
        }
        showMenu();
        return;
      }
      // type === 'ask'
      addUserBubble(chip.label && chip.label !== chip.q ? chip.label : chip.q);
      touchLastActive();
      sendConversationMessage(chip.q);
    }

    // ═══════════════════════════════════════════════════════════
    // BOT Q&A (fallback rules + optional Gemini)
    // ═══════════════════════════════════════════════════════════
    function fallbackAnswer(raw) {
      const q = raw.toLowerCase();
      if (q.includes('list') && (q.includes('how') || q.includes('property') || q.includes('apartment'))) {
        return { text: "Listing takes under 10 minutes: tap \"List your apartment\", fill in the details, add photos, then pay the listing fee via M-Pesa. It goes live within minutes of payment.", chips: ['What does it cost to list?', 'What areas do you cover?', 'Talk to a real person'] };
      }
      if (q.includes('cost') || q.includes('price') || q.includes('fee') || q.includes('pricing')) {
        return { text: "There are two plans: a Standard listing and a Featured listing (which gets top placement and a badge). Both are one-time fees paid via M-Pesa — no monthly charges and 0% commission when your property sells or rents. Check the Pricing page for exact current rates.", chips: ['How do I list my property?', 'Talk to a real person'] };
      }
      if (q.includes('standard') && q.includes('featured')) {
        return { text: "A Featured listing gets more photo slots, top placement in search results, a Featured badge, and space on the homepage. Standard still gets you fully listed and searchable, just without those extra visibility perks — both are one-time M-Pesa fees, check the Pricing page for current rates.", chips: ['What does it cost to list?', 'Talk to a real person'] };
      }
      if (q.includes('edit') || q.includes('remove') || q.includes('pause') || q.includes('delete')) {
        return { text: "Yes — once you're signed in, your seller dashboard lets you edit, pause, or remove any of your listings anytime. No need to contact the team for routine changes.", chips: ['Seller login / dashboard', 'Talk to a real person'] };
      }
      if (q.includes('buyer') && q.includes('pay')) {
        return { text: "Never. Browsing, searching, and contacting sellers is completely free for buyers — the only fee on the platform is the one-time listing fee sellers pay to post." };
      }
      if (q.includes('trustworthy') || q.includes('fake') || q.includes('legit')) {
        return { text: "Good instinct to check. Never send money before viewing the property in person, and deal directly through the contact details on the listing itself. If a price feels too good to be true, or a seller's pushing you to pay upfront, that's worth reporting.", chips: ['Report a listing', 'Talk to a real person'] };
      }
      if (q.includes('area') || q.includes('county') || q.includes('cover') || q.includes('where')) {
        return { text: "We're fully live in Kisumu, Nairobi, and Mombasa, and expanding county by county across all of Kenya. If your county isn't fully live yet, you can still be the first to list there.", chips: ['How do I list my property?', 'Talk to a real person'] };
      }
      if (q.includes('mpesa') || q.includes('m-pesa') || q.includes('payment') || q.includes('pay')) {
        return { text: "Payments go through M-Pesa STK Push — you'll get a prompt straight to your phone. We never see or store your M-Pesa PIN. If a payment isn't reflecting after a few minutes, I can connect you with the team.", chips: ['Talk to a real person'] };
      }
      if (q.includes('commission') || q.includes('agent')) {
        return { text: "Zero commission, always. You pay a flat one-time listing fee — whatever you agree with a buyer or tenant is entirely yours." };
      }
      if (q.includes('contact') && q.includes('seller')) {
        return { text: "Open any listing and tap \"Contact seller\" to call or WhatsApp them directly — no middlemen involved." };
      }
      if (q.includes('enquiry') || q.includes('reply') || q.includes('conversation')) {
        return { text: "If you messaged a seller, reopen the listing you enquired about — your conversation continues there (or in the chat bubble on that page). If you're signed in, it follows your account across devices too." };
      }
      if (q.includes('question about the listing')) {
        return { text: "Happy to help — could you paste the listing title, number, or link? If it's something only the team or seller can answer, I'll connect you.", chips: ['Talk to a real person'] };
      }
      return {
        text: "I want to make sure you get the right answer — I can try again if you rephrase, or I can bring in someone from the team.",
        chips: ['Talk to a real person'],
        lowConfidence: true,
      };
    }

    function needsEscalation(text) {
      const q = text.toLowerCase();
      return ESCALATION_KEYWORDS.some(k => q.includes(k));
    }

    async function getAnswer(raw) {
      if (needsEscalation(raw)) {
        return { text: "This sounds like something the team should look at directly rather than me guessing.", escalate: true };
      }
      if (!NK_QH_CONFIG.GEMINI_PROXY_URL) {
        return fallbackAnswer(raw);
      }
      try {
        const contents = conversationHistory.map(turn => ({ role: turn.role, parts: [{ text: turn.text }] }));
        contents.push({ role: 'user', parts: [{ text: raw }] });

        const res = await fetch(NK_QH_CONFIG.GEMINI_PROXY_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: NK_QH_SYSTEM_PROMPT }] },
            contents,
            generationConfig: { temperature: 0.4, maxOutputTokens: 400, thinkingConfig: { thinkingBudget: 0 } },
          }),
        });
        if (!res.ok) {
          const errBody = await res.text().catch(() => '(no body)');
          throw new Error('Gemini request failed: ' + res.status + ' — ' + errBody);
        }
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        if (!text) throw new Error('Empty response from Gemini');
        const unsure = /not (sure|certain)|don'?t know|can'?t help with that|talk to (the )?team|contact (the )?team/i.test(text);
        return { text, chips: unsure ? ['Talk to a real person'] : undefined, escalate: false };
      } catch (err) {
        console.error('Nia (Gemini) error:', err);
        return fallbackAnswer(raw);
      }
    }

    async function respond(question) {
      showTyping();
      conversationHistory.push({ role: 'user', text: question });
      if (conversationHistory.length > 12) conversationHistory = conversationHistory.slice(-12);

      const r = await getAnswer(question);
      hideTyping();

      if (r.escalate) {
        addBotBubble(r.text, null, false);
        addEscalateCard();
      } else {
        addBotBubble(r.text, r.chips, false);
      }
      conversationHistory.push({ role: 'model', text: r.text });
      persistMessage('bot', r.text);
      if (currentConv) updateConversationPreview(currentConv.session_key, { preview: r.text.slice(0, 80) });
    }

    // ═══════════════════════════════════════════════════════════
    // REPORT FLOW — writes into the `reports` table
    // ═══════════════════════════════════════════════════════════
    const REPORT_REASON_COPY = {
      fake_listing: { targetType: 'listing', prompt: "Got it — this is about a listing that looks fake. Paste the listing title, number, or link, plus anything else useful, and I'll pass it straight to the team." },
      scam_attempt: { targetType: 'listing', prompt: "Understood — a seller asking for money upfront or acting suspiciously is serious. Please describe what happened, and the listing title/number/link if you have it." },
      wrong_info: { targetType: 'listing', prompt: "Thanks for flagging that. Which listing, and what's incorrect about it?" },
      other: { targetType: 'system', prompt: "Sure — describe the bug or issue you ran into (what you were doing, and what went wrong)." },
    };
    let reportState = null;

    function startReportFlow(reason) {
      mode = 'report';
      reportState = { reason, targetType: REPORT_REASON_COPY[reason]?.targetType || 'system' };
      addBotBubble(REPORT_REASON_COPY[reason]?.prompt || "Please describe the issue.", null, false);
      footNote.textContent = 'Reporting a problem — your message goes straight to the Nyumba254 team';
    }

    async function submitReport(details) {
      showTyping();
      try {
        const dbClient = await getClient();
        const { error } = await dbClient.from('reports').insert({
          target_type: reportState.targetType,
          target_id: null,
          reason: reportState.reason,
          details: `[via Quick Help widget, ${window.location.pathname}] ${details}`,
        });
        hideTyping();
        if (error) {
          addBotBubble("That didn't go through — could you try again, or use the Contact us page instead?", null, false);
        } else {
          addBotBubble("Thank you — that's been sent to our team and they review every report. Anything else I can help with?", null, false);
        }
      } catch (e) {
        hideTyping();
        addBotBubble("That didn't go through — could you try again, or use the Contact us page instead?", null, false);
      }
      mode = 'bot';
      reportState = null;
      footNote.textContent = "Nia is an assistant, not a person — she'll bring in the team if needed";
    }

    // ═══════════════════════════════════════════════════════════
    // LIVE CHAT — chat_sessions / chat_messages (same tables the
    // admin dashboard's Chat Center reads under "Visitors")
    // ═══════════════════════════════════════════════════════════
    let _client = null;
    async function getClient() {
      if (_client) return _client;
      // Reuse an existing client already on the page (many Nyumba254
      // pages declare `const db = supabase.createClient(...)` at top level).
      if (typeof window.db !== 'undefined' && window.db && window.db.from) {
        _client = window.db;
        return _client;
      }
      await nkQhEnsureSupabaseSdk();
      _client = window.supabase.createClient(NK_QH_SUPABASE_URL, NK_QH_SUPABASE_KEY);
      return _client;
    }

    let liveSessionId = null;    // == currentConv.id while a conversation is open
    let liveChannel = null;
    let liveMessageIds = new Set();
    let currentConv = null;      // { id, session_key, started_at, preview, is_resolved }
    let humanJoined = false;     // true once an admin has actually sent a message in this conversation

    // ── Local conversation history (list of past chat_sessions this browser started) ──
    const NK_QH_HISTORY_KEY = 'nk_qh_conversations';
    function loadConversationHistory() {
      try { return JSON.parse(localStorage.getItem(NK_QH_HISTORY_KEY) || '[]'); } catch (e) { return []; }
    }
    function saveConversationToHistory(conv) {
      let list = loadConversationHistory().filter(c => c.session_key !== conv.session_key);
      list.unshift(conv);
      list = list.slice(0, 25);
      try { localStorage.setItem(NK_QH_HISTORY_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    }
    function updateConversationPreview(sessionKey, patch) {
      if (!sessionKey) return;
      const list = loadConversationHistory();
      const idx = list.findIndex(c => c.session_key === sessionKey);
      if (idx === -1) return;
      list[idx] = { ...list[idx], ...patch };
      try { localStorage.setItem(NK_QH_HISTORY_KEY, JSON.stringify(list)); } catch (e) { /* noop */ }
    }

    // Local message cache — a fallback copy of every message kept in this
    // browser, keyed by session. Guarantees the conversation survives a
    // refresh even if a remote insert silently fails (e.g. an RLS policy
    // blocking non-visitor senders), independent of the database.
    const NK_QH_MSG_CACHE_PREFIX = 'nk_qh_msgs_';
    function loadCachedMessages(sessionKey) {
      try { return JSON.parse(localStorage.getItem(NK_QH_MSG_CACHE_PREFIX + sessionKey) || '[]'); } catch (e) { return []; }
    }
    function appendCachedMessage(sessionKey, msg) {
      if (!sessionKey) return;
      const list = loadCachedMessages(sessionKey);
      list.push(msg);
      try { localStorage.setItem(NK_QH_MSG_CACHE_PREFIX + sessionKey, JSON.stringify(list.slice(-150))); } catch (e) { /* noop */ }
    }

    // Creates a chat_sessions row the first time this conversation needs one
    // (first question asked, or "Talk to a real person" clicked) and reuses
    // it for everything else in the same visit.
    async function ensureConversation(topicLabel) {
      if (currentConv) return currentConv;
      const dbClient = await getClient();
      const sessionKey = 'nk_qh_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
      const { data, error } = await dbClient.from('chat_sessions').insert({
        session_key: sessionKey,
        page: window.location.pathname,
        topic: (topicLabel || 'Quick Help').slice(0, 80),
        status: 'open',
        is_resolved: false,
      }).select().single();
      if (error) throw error;
      currentConv = { id: data.id, session_key: sessionKey, started_at: Date.now(), preview: topicLabel || 'Quick Help conversation', is_resolved: false };
      liveSessionId = data.id;
      liveMessageIds = new Set();
      saveConversationToHistory(currentConv);
      subscribeLive(dbClient);
      return currentConv;
    }

    // Saves one message into the persisted thread. Safe to call even before
    // a conversation exists — it's a no-op until ensureConversation() has run.
    async function persistMessage(sender, text) {
      if (!currentConv) return;
      appendCachedMessage(currentConv.session_key, {
        id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        sender, body: text, created_at: new Date().toISOString(),
      });
      try {
        const dbClient = await getClient();
        const { error: insertErr } = await dbClient.from('chat_messages').insert({ session_id: currentConv.id, sender, body: text });
        if (insertErr) { console.error('Nia: message insert was rejected (check RLS policy on chat_messages for sender="' + sender + '")', insertErr); return; }
        const { error: updateErr } = await dbClient.from('chat_sessions').update({ last_msg_at: new Date().toISOString() }).eq('id', currentConv.id);
        if (updateErr) console.error('Nia: chat_sessions update failed', updateErr);
      } catch (e) { console.warn('Nia: could not save message', e); }
    }

    async function startLiveChat() {
      if (mode === 'live') {
        addBotBubble("You're already connected with our team below — just type your message.", null, false);
        return;
      }
      showTyping();
      try {
        await ensureConversation('Talk to a human');
      } catch (err) {
        console.error('startLiveChat error:', err);
        hideTyping();
        addBotBubble("I couldn't open live chat right now — please try again in a moment, or use the Contact us page.", null, false);
        return;
      }
      mode = 'live';
      hideTyping();
      statusDot.classList.add('live');
      statusText.textContent = 'Live chat with our team';
      footNote.textContent = "You're chatting with the Nyumba254 team — replies may take a few minutes";
      input.placeholder = 'Type a message to our team…';
      const welcomeText = "You're connected. Our team usually replies within a few minutes during working hours — go ahead and type your message.";
      addBotBubble(welcomeText, ['Choose a different topic'], false);
      persistMessage('bot', welcomeText);
    }

    async function fetchConversationMessages(dbClient) {
      const { data, error } = await dbClient.from('chat_messages').select('*').eq('session_id', liveSessionId).order('created_at', { ascending: true });
      if (error) console.error('Nia: could not load conversation history', error);
      const remote = data || [];
      const cached = currentConv ? loadCachedMessages(currentConv.session_key) : [];
      const remoteKeys = new Set(remote.map(m => m.sender + '|' + m.body));
      const localOnly = cached.filter(m => !remoteKeys.has(m.sender + '|' + m.body));
      return remote.concat(localOnly).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    }

    function appendLiveBubble(m) {
      const isUser = m.sender === 'visitor';
      const row = document.createElement('div');
      row.className = 'nk-qh-row ' + (isUser ? 'user' : 'bot');
      const time = m.created_at ? new Date(m.created_at).toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' }) : timeNow();
      const label = m.sender === 'admin' ? 'Nyumba254 team · ' : (m.sender === 'bot' ? 'Nia · ' : '');
      row.innerHTML = `<div class="nk-qh-bubble ${isUser ? 'user' : 'bot'}"></div><div class="nk-qh-time">${label}${time}</div>`;
      row.querySelector('.nk-qh-bubble').textContent = m.body;
      body.appendChild(row);
      scrollBottom();
    }

    function subscribeLive(dbClient) {
      if (liveChannel) dbClient.removeChannel ? dbClient.removeChannel(liveChannel) : liveChannel.unsubscribe();
      liveChannel = dbClient
        .channel('nk-qh-live-' + liveSessionId)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${liveSessionId}` }, (payload) => {
          const m = payload.new;
          if (liveMessageIds.has(m.id)) return;
          liveMessageIds.add(m.id);
          // Bot and visitor messages are already rendered locally the
          // moment they're sent — only admin replies need to be rendered
          // here, since those arrive from someone else's browser/dashboard.
          if (m.sender === 'admin') {
            appendLiveBubble(m);
            humanJoined = true;
            showLauncherDot();
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${liveSessionId}` }, (payload) => {
          if (payload.new.is_resolved) {
            const banner = document.createElement('div');
            banner.className = 'nk-qh-resolved-banner';
            banner.textContent = '✓ This conversation has been marked resolved by our team.';
            body.appendChild(banner);
            scrollBottom();
            if (currentConv) updateConversationPreview(currentConv.session_key, { is_resolved: true });
          }
        })
        .subscribe();
    }

    function showLauncherDot() {
      if (!open) dot.style.display = 'block';
    }

    // Single entry point for every user-typed/asked message, whether the bot
    // answers it or a human will. Creates the conversation on first use,
    // saves the visitor's message, then either lets the bot respond or —
    // once in live mode — just leaves it for the team to see and reply to.
    async function sendConversationMessage(text) {
      try {
        await ensureConversation(text.slice(0, 60));
      } catch (err) {
        console.error('ensureConversation failed', err);
        addBotBubble("That didn't send — please check your connection and try again.", null, false);
        return;
      }
      persistMessage('visitor', text);
      updateConversationPreview(currentConv.session_key, { preview: text.slice(0, 80) });

      if (mode === 'ended') {
        mode = 'live';
        statusDot.classList.add('live');
        statusText.textContent = 'Live chat with our team';
        footNote.textContent = "You're chatting with the Nyumba254 team — replies may take a few minutes";
        try {
          const dbClient = await getClient();
          await dbClient.from('chat_sessions').update({ is_resolved: false }).eq('id', currentConv.id);
        } catch (e) { /* noop */ }
        updateConversationPreview(currentConv.session_key, { is_resolved: false });
      }

      if (mode === 'live') {
        try {
          const dbClient = await getClient();
          const { data: sess } = await dbClient.from('chat_sessions').select('unread_admin').eq('id', currentConv.id).single();
          await dbClient.from('chat_sessions').update({ unread_admin: (sess?.unread_admin || 0) + 1 }).eq('id', currentConv.id);
        } catch (e) { /* noop */ }
        return; // human will reply — no bot auto-answer while live
      }

      respond(text);
    }

    // ── Input bar / send dispatch ─────────────────────────────
    let nkQhSending = false;
    async function send() {
      const text = input.value.trim();
      if (!text || nkQhSending) return;
      nkQhSending = true;
      input.value = '';
      resize(input);
      sendBtn.disabled = true;
      touchLastActive();

      addUserBubble(text);

      try {
        if (mode === 'report') { await submitReport(text); return; }
        await sendConversationMessage(text);
      } finally {
        nkQhSending = false;
      }
    }

    function resize(el) {
      el.style.height = 'auto';
      el.style.height = Math.min(el.scrollHeight, 90) + 'px';
      sendBtn.disabled = !el.value.trim();
    }

    // Resets in-memory state only — does NOT decide what to show next.
    // Callers pick the right screen afterwards (topic menu for a manual
    // "New conversation", history list for an automatic 24h expiry).
    function endSession() {
      if (liveChannel) {
        try { liveChannel.unsubscribe && liveChannel.unsubscribe(); } catch (e) { /* noop */ }
        liveChannel = null;
      }
      if (currentConv) {
        updateConversationPreview(currentConv.session_key, { is_resolved: true });
        const closingId = currentConv.id;
        getClient().then(dbClient => dbClient.from('chat_sessions').update({ is_resolved: true }).eq('id', closingId)).catch(() => {});
      }
      mode = 'bot';
      conversationHistory = [];
      reportState = null;
      currentConv = null;
      liveSessionId = null;
      liveMessageIds = new Set();
      statusDot.classList.remove('live');
      statusText.textContent = "Nyumba254's assistant — online";
      footNote.textContent = "Nia is an assistant, not a person — she'll bring in the team if needed";
      input.placeholder = 'Type your question…';
      body.innerHTML = '';
      humanJoined = false;
      touchLastActive();
    }

    // Manual "＋ New conversation" button — per your screenshot, this always
    // jumps straight to the topic menu (list of helps), same as a first-ever
    // visit. The old conversation stays in history, marked Ended.
    function startNewConversation() {
      endSession();
      renderStart();
    }

    // The screen you land on when you open the widget with no conversation
    // in progress — a scrollable list of past conversations (Started ..,
    // Ended tag if closed) with a "New conversation" button at the bottom,
    // matching the Zendesk-style pattern in your screenshot.
    function renderHistoryScreen() {
      const list = loadConversationHistory();
      if (!list.length) { renderStart(); return; }

      inputBar.style.display = 'none';
      footNote.style.display = 'none';
      body.innerHTML = '';
      const listWrap = document.createElement('div');
      listWrap.className = 'nk-qh-history-list';

      list.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'nk-qh-history-item';
        const dt = new Date(conv.started_at);
        const dateLabel = dt.toLocaleDateString('en-KE', { day: '2-digit', month: 'short' });
        const timeLabel = dt.toLocaleTimeString('en-KE', { hour: '2-digit', minute: '2-digit' });
        item.innerHTML = `
          <div class="nk-qh-history-top">
            <span class="nk-qh-history-title">Started ${dateLabel} at ${timeLabel}</span>
            <span class="nk-qh-history-date">${dateLabel}</span>
          </div>
          <div class="nk-qh-history-preview"></div>
          ${conv.is_resolved ? '<span class="nk-qh-history-badge">Ended</span>' : ''}
        `;
        item.querySelector('.nk-qh-history-preview').textContent = conv.preview || 'Quick Help conversation';
        item.onclick = () => openConversation(conv);
        listWrap.appendChild(item);
      });

      body.appendChild(listWrap);

      const newBtn = document.createElement('button');
      newBtn.type = 'button';
      newBtn.className = 'nk-qh-history-newbtn';
      newBtn.textContent = 'New conversation';
      newBtn.onclick = startNewConversation;
      body.appendChild(newBtn);

      scrollBottom();
    }

    // Reopens a past conversation from the history list, loading its full
    // message thread. Sending a new message into an Ended one reopens it.
    async function openConversation(conv) {
      currentConv = conv;
      liveSessionId = conv.id;
      inputBar.style.display = 'flex';
      footNote.style.display = 'block';
      body.innerHTML = '';
      liveMessageIds = new Set();

      const dbClient = await getClient();
      const msgs = await fetchConversationMessages(dbClient);
      humanJoined = msgs.some(m => m.sender === 'admin');
      mode = conv.is_resolved ? 'ended' : (humanJoined ? 'live' : 'bot');

      if (!humanJoined) {
        body.appendChild(renderMenuBlock(null));
      }

      msgs.forEach(m => {
        if (liveMessageIds.has(m.id)) return;
        liveMessageIds.add(m.id);
        appendLiveBubble(m);
      });

      if (!conv.is_resolved) {
        subscribeLive(dbClient);
        if (humanJoined) {
          statusDot.classList.add('live');
          statusText.textContent = 'Live chat with our team';
          footNote.textContent = "You're chatting with the Nyumba254 team — replies may take a few minutes";
        } else {
          statusDot.classList.remove('live');
          statusText.textContent = "Nyumba254's assistant — online";
          footNote.textContent = "Nia is an assistant, not a person — she'll bring in the team if needed";
        }
        input.placeholder = 'Type a message…';
      } else {
        statusDot.classList.remove('live');
        statusText.textContent = "Nyumba254's assistant — online";
        footNote.textContent = 'This conversation has ended — send a message to reopen it, or start a new one.';
        input.placeholder = 'Type to reopen this conversation…';
      }
      touchLastActive();
      scrollBottom();
    }

    function toggle() {
      open = !open;
      panel.classList.toggle('open', open);
      iconOpen.style.display = open ? 'none' : 'block';
      iconClose.style.display = open ? 'block' : 'none';
      if (open) dot.style.display = 'none';
      if (open) {
        const lastActive = getLastActiveAt();
        const idleExpired = started && lastActive && (Date.now() - lastActive > NK_QH_SESSION_TTL_MS);
        if (idleExpired) {
          // Idle over 24h — the old thread is marked Ended in history; land
          // on the history/menu screen instead of resuming it.
          endSession();
          renderHistoryScreen();
        } else if (!started) {
          started = true;
          renderHistoryScreen();
        }
        touchLastActive();
      }
      if (open) { scrollBottom(); input.focus(); }
    }

    // ── wire up events ─────────────────────────────────────────
    launcher.addEventListener('click', toggle);
    document.getElementById('nk-qh-close-btn').addEventListener('click', toggle);
    document.getElementById('nk-qh-menu-btn').addEventListener('click', renderHistoryScreen);
    sendBtn.addEventListener('click', send);
    input.addEventListener('input', () => resize(input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    });

    // Small public API in case a page wants to open the widget
    // programmatically, e.g. a "Need help?" link elsewhere on the page.
    window.NyumbaQuickHelp = {
      open: () => { if (!open) toggle(); },
      close: () => { if (open) toggle(); },
      askAI: (q) => { if (!open) toggle(); addUserBubble(q); respond(q); },
      startLiveChat: () => { if (!open) toggle(); startLiveChat(); },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 5. BOOTSTRAP
  // ═══════════════════════════════════════════════════════════════
  function boot() {
    nkQhEnsureFonts();
    nkQhInjectMarkup();
    nkQhInit();
    // Warm the Supabase SDK in the background so live chat / reports
    // open instantly on first click, without blocking widget render.
    nkQhEnsureSupabaseSdk().catch(err => console.warn('Nia: Supabase SDK failed to preload', err));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();