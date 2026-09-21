/* ════════════════════════════════════════════════════
   NYUMBA254 · "DOORBELL" FLOATING CHAT WIDGET 🔔  (v2)
   One compact widget on every page, listing all of a buyer's
   conversations. The full inbox (inbox.html) has more room and
   more tools; both run on the same engine, nk-chat-core.js.
   Include on every page, exactly as before:
     <script src="global-chat-widget.js"></script>
   (it loads nk-chat-core.js from the same folder by itself)
════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.__nkGcw) return; window.__nkGcw = true;

  /* Calls that arrive before the engine has loaded (for example from listing.html) wait in a queue. */
  const queue = []; let api = null;
  const later = fn => (...a) => { api ? fn(...a) : queue.push(() => fn(...a)); };
  window.NKGlobalChat = window.NKGlobalChat || {};
  Object.assign(window.NKGlobalChat, {
    refresh: later(() => api.refresh()), open: later((id, t) => api.open(id, t)), registerAndOpen: later((id, t) => api.open(id, t)),
    openBookViewing: later(id => api.openViewing(id)), openSaved: () => { location.href = '/inbox?tab=saved'; },
    getResumeLink: () => (window.NKChatCore ? window.NKChatCore.buildResumeLink() : null)
  });

  const me = document.currentScript, base = me && me.src ? new URL('.', me.src).href : '/';
  function loadCore(cb) {
    if (window.NKChatCore) return cb();
    const s = document.createElement('script'); s.src = base + 'nk-chat-core.js'; s.onload = cb;
    s.onerror = () => console.error('Nyumba254 chat: nk-chat-core.js could not be loaded from ' + base);
    document.head.appendChild(s);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => loadCore(start)); else loadCore(start);

  function start() {
    const DOCK = 'right';   // 'right' or 'left': which edge the full-height chat panel slides in from on computers
    const core = window.NKChatCore, esc = core.esc, $ = id => document.getElementById(id), qsa = (s, r) => [...(r || document).querySelectorAll(s)];
    const wide = () => matchMedia('(max-width:600px)').matches, touch = () => matchMedia('(pointer:coarse)').matches;

    const CSS = `
    #gcw-btn,#gcw-panel,.gcw-ov{--g:var(--green,#0F6E56);--gd:var(--green-dark,#085041);--gl:var(--green-light,#E1F5EE);--bg:var(--surface,#f7f6f2);--cd:var(--white,#fff);--bd:var(--border,#e0ded8);--tx:var(--text,#1a1a18);--t2:var(--text-2,#4a4a46);--t3:var(--text-3,#6b6a63);--rd:var(--danger,#C53030);font-family:'Inter',system-ui,sans-serif}
    #gcw-btn,#gcw-panel{--fab:calc(var(--nk-tabbar-h,0px) + var(--nk-stack,0px) + 20px + env(safe-area-inset-bottom,0px))}
    #gcw-btn{position:fixed;right:20px;bottom:var(--fab);z-index:1500;height:52px;padding:0 20px 0 16px;border:0;border-radius:30px;background:var(--g);color:#fff;display:none;align-items:center;gap:9px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .15s,background .15s;font-size:14px;font-weight:600}
    #gcw-btn:hover{background:var(--gd);transform:translateY(-2px)}
    #gcw-btn svg{flex-shrink:0;stroke:#fff;fill:none;stroke-width:2}
    #gcw-badge{position:absolute;top:-5px;right:-5px;min-width:21px;height:21px;padding:0 5px;background:var(--rd);color:#fff;font-size:11px;font-weight:700;border-radius:20px;display:none;align-items:center;justify-content:center;border:2px solid var(--cd)}
    @keyframes gcw-pop{from{transform:scale(.8)}to{transform:scale(1)}}
    #gcw-panel{position:fixed;top:0;bottom:0;right:0;z-index:1600;width:min(460px,100vw);height:100vh;height:100dvh;background:var(--cd);color:var(--tx);border-left:1px solid var(--bd);box-shadow:-10px 0 36px rgba(0,0,0,.2);display:none;flex-direction:column;overflow:hidden}
    #gcw-panel.dock-left{right:auto;left:0;border-left:0;border-right:1px solid var(--bd);box-shadow:10px 0 36px rgba(0,0,0,.2)}
    #gcw-panel.open{display:flex;animation:gcw-in .2s ease}
    #gcw-panel.dock-left.open{animation-name:gcw-in-l}
    @keyframes gcw-in{from{transform:translateX(28px);opacity:0}to{transform:none;opacity:1}}
    @keyframes gcw-in-l{from{transform:translateX(-28px);opacity:0}to{transform:none;opacity:1}}
    @keyframes gcw-up{from{transform:translateY(24px);opacity:0}to{transform:none;opacity:1}}
    html.gcw-lock,html.gcw-lock body{overflow:hidden}
    #gcw-panel.open{display:flex}
    #gcw-panel:focus{outline:none}
    #gcw-head,#gcw-thead{background:var(--g);color:#fff;padding:8px 8px 8px 16px;display:flex;align-items:center;gap:6px;flex-shrink:0;position:relative;min-height:56px}
    #gcw-thead{padding-left:6px}
    .gcw-ib{background:none;border:0;color:#fff;cursor:pointer;min-width:44px;height:44px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;opacity:.92;flex-shrink:0}
    .gcw-ib:hover{background:rgba(255,255,255,.16);opacity:1}
    .gcw-ib svg{width:20px;height:20px;stroke:currentColor;fill:none;stroke-width:2}
    .gcw-pill{background:rgba(255,255,255,.16);border:0;color:#fff;cursor:pointer;height:36px;padding:0 12px;border-radius:20px;display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;font-family:inherit;flex-shrink:0}
    .gcw-pill:hover{background:rgba(255,255,255,.28)}
    .gcw-pill svg{width:14px;height:14px;stroke:currentColor;fill:none;stroke-width:2}
    #gcw-title-wrap{flex:1;min-width:0}
    #gcw-title{font-size:15px;font-weight:700;line-height:1.3}
    #gcw-subtitle{font-size:12px;opacity:.85;line-height:1.3}
    #gcw-net{display:none;background:#FFF7E6;color:#7a4f00;font-size:12.5px;padding:7px 14px;border-bottom:1px solid #F3D9A0;flex-shrink:0}
    #gcw-net.show{display:block}
    #gcw-list{flex:1;min-height:0;overflow-y:auto;background:var(--bg);overscroll-behavior:contain}
    .gcw-convo{display:flex;align-items:center;gap:11px;width:100%;text-align:left;padding:12px 14px;border:0;border-bottom:1px solid var(--bd);background:transparent;color:inherit;cursor:pointer;font-family:inherit;min-height:68px}
    .gcw-convo:hover{background:var(--cd)}
    .gcw-thumb{width:46px;height:46px;border-radius:9px;background:var(--bd);flex-shrink:0;overflow:hidden;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;color:var(--gd)}
    .gcw-thumb img{width:100%;height:100%;object-fit:cover}
    .gcw-cb{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
    .gcw-ct{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:5px}
    .gcw-ct svg{flex-shrink:0;width:13px;height:13px;color:var(--g)}
    .gcw-cl{font-size:13px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gcw-cm{display:flex;flex-direction:column;align-items:flex-end;gap:5px;flex-shrink:0}
    .gcw-cw{font-size:11.5px;color:var(--t3)}
    .gcw-cbadge{background:var(--rd);color:#fff;font-size:11px;font-weight:700;border-radius:10px;min-width:20px;height:20px;display:flex;align-items:center;justify-content:center;padding:0 5px}
    .gcw-state{padding:36px 22px;text-align:center;color:var(--t3);font-size:14px;line-height:1.55}
    .gcw-state button{margin-top:12px}
    .gcw-btn{background:var(--g);color:#fff;border:0;border-radius:10px;min-height:44px;padding:0 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit}
    .gcw-btn:hover{background:var(--gd)}.gcw-btn:disabled{opacity:.6;cursor:not-allowed}
    .gcw-btn.ghost{background:var(--bg);color:var(--t2)}.gcw-btn.ghost:hover{background:var(--bd)}
    .gcw-sk{height:46px;margin:14px;border-radius:9px;background:linear-gradient(90deg,var(--bd) 25%,var(--bg) 50%,var(--bd) 75%);background-size:200% 100%;animation:gcw-sh 1.3s infinite}
    @keyframes gcw-sh{to{background-position:-200% 0}}
    #gcw-thread{display:none;flex-direction:column;flex:1;min-height:0}
    #gcw-thread.open{display:flex}
    #gcw-tname{display:flex;align-items:center;gap:5px;font-size:14.5px;font-weight:600;min-width:0}
    #gcw-tname span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    #gcw-tname svg{flex-shrink:0;color:#7CE0C0;width:14px;height:14px}
    #gcw-presence{display:flex;align-items:center;gap:6px;font-size:12px;color:rgba(255,255,255,.85)}
    #gcw-dot{width:7px;height:7px;border-radius:50%;background:#b8b8b0;flex-shrink:0}
    #gcw-dot.online{background:#2ecc71}#gcw-dot.typing{background:#F0B429}
    #gcw-tinfo{flex:1;min-width:0}
    .gcw-lcard{display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--gl);border-bottom:1px solid var(--bd);flex-shrink:0;text-decoration:none;color:inherit;min-height:56px}
    a.gcw-lcard:hover{background:var(--cd)}
    .gcw-lcard .gcw-thumb{width:40px;height:40px;border-radius:8px}
    .gcw-lc-t{flex:1;min-width:0;display:flex;flex-direction:column}
    .gcw-lc-t b{font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .gcw-lc-t span{font-size:12px;color:var(--gd);font-weight:600}
    .gcw-lc-go{font-size:12px;color:var(--gd);font-weight:700;white-space:nowrap}
    #gcw-safety{display:none;align-items:flex-start;gap:8px;padding:8px 12px;background:#FFF7E6;border-bottom:1px solid #F3D9A0;font-size:12.5px;color:#7a4f00;line-height:1.45;flex-shrink:0}
    #gcw-safety.show{display:flex}
    #gcw-safety p{flex:1}
    #gcw-safety button{background:none;border:0;color:inherit;font-weight:700;cursor:pointer;font-family:inherit;font-size:12.5px;text-decoration:underline;min-height:32px;padding:0 4px}
    #gcw-msgs-wrap{position:relative;flex:1;min-height:0;display:flex;flex-direction:column}
    #gcw-messages{flex:1;min-height:0;overflow-y:auto;padding:14px 12px;background:var(--bg);display:flex;flex-direction:column;gap:2px;overscroll-behavior:contain}
    #gcw-newpill{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);display:none;background:var(--g);color:#fff;border:0;border-radius:20px;padding:0 16px;min-height:36px;font-size:12.5px;font-weight:600;box-shadow:0 4px 14px rgba(0,0,0,.25);cursor:pointer;font-family:inherit}
    #gcw-newpill.show{display:block}
    .gcw-empty-thread{margin:auto;text-align:center;color:var(--t3);font-size:13.5px;line-height:1.6;padding:20px 24px}
    .gcw-empty-thread b{display:block;color:var(--tx);font-size:15px;margin-bottom:4px}
    .gcw-day{text-align:center;font-size:11.5px;color:var(--t3);padding:10px 0 6px;font-weight:600}
    .gcw-row{display:flex;gap:6px;align-items:flex-end;width:100%;margin-top:2px}
    .gcw-row.first{margin-top:8px}
    .gcw-row.mine{flex-direction:row-reverse}
    .gcw-av{width:26px;height:26px;border-radius:50%;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;background:var(--gl);color:var(--gd)}
    .gcw-row.mine .gcw-av{background:var(--g);color:#fff}
    .gcw-av.gcw-avsp{visibility:hidden}
    .gcw-col{max-width:80%;display:flex;flex-direction:column;min-width:0}
    .gcw-row.mine .gcw-col{align-items:flex-end}
    .gcw-bubble{width:fit-content;max-width:100%;padding:8px 12px;border-radius:14px;font-size:14px;line-height:1.5;background:var(--cd);border:1px solid var(--bd);border-bottom-left-radius:4px;overflow-wrap:anywhere;white-space:pre-wrap}
    .gcw-row.mine .gcw-bubble{background:var(--g);color:#fff;border:0;border-bottom-left-radius:14px;border-bottom-right-radius:4px}
    .gcw-row.failed .gcw-bubble{background:var(--rd);opacity:.9}
    .gcw-bubble mark{background:#FFE58A;color:inherit}
    .gcw-time{font-size:11px;color:var(--t3);margin-top:2px;display:inline-flex;align-items:center;gap:3px}
    .gcw-tick svg{stroke:#9a9a94;fill:none;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;vertical-align:-1px}
    .gcw-tick.read svg{stroke:#34B7F1}
    .gcw-ai{font-size:11px;color:var(--t3);margin-top:3px;font-style:italic}
    .gcw-scam{font-size:12px;line-height:1.45;color:#7a4f00;background:#FFF7E6;border:1px solid #F3D9A0;border-radius:10px;padding:7px 10px;margin-top:4px}
    .gcw-retry{background:none;border:0;color:var(--rd);font-size:12px;font-weight:700;cursor:pointer;padding:6px 0;min-height:32px;font-family:inherit;text-decoration:underline}
    .gcw-queued{font-size:11.5px;color:#7a4f00;margin-top:2px}
    #gcw-quick{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding:8px 12px;background:var(--cd);border-top:1px solid var(--bd);flex-shrink:0;mask-image:linear-gradient(to right,#000 92%,transparent);-webkit-mask-image:linear-gradient(to right,#000 92%,transparent)}
    #gcw-quick::-webkit-scrollbar{display:none}
    #gcw-quick:empty{display:none}
    .gcw-chip{flex-shrink:0;background:var(--gl);color:var(--gd);border:1px solid rgba(15,110,86,.25);border-radius:18px;padding:0 13px;min-height:36px;font-size:12.5px;font-weight:600;white-space:nowrap;cursor:pointer;font-family:inherit}
    .gcw-chip:hover{background:#c9ecdd}
    #gcw-inrow{display:flex;align-items:flex-end;gap:8px;padding:10px 12px;background:var(--cd);border-top:1px solid var(--bd);flex-shrink:0}
    #gcw-input{flex:1;resize:none;border:1.5px solid var(--bd);border-radius:12px;padding:10px 13px;font-size:16px;outline:none;min-height:44px;max-height:110px;line-height:1.4;background:var(--bg);color:var(--tx);font-family:inherit}
    #gcw-input:focus{border-color:var(--g);background:var(--cd)}
    #gcw-send{width:44px;height:44px;border-radius:50%;background:var(--g);color:#fff;display:flex;align-items:center;justify-content:center;border:0;cursor:pointer;flex-shrink:0}
    #gcw-send svg{width:17px;height:17px;stroke:#fff;fill:none;stroke-width:2}
    #gcw-send:disabled{opacity:.5;cursor:not-allowed}
    #gcw-hint{display:none;position:absolute;top:calc(100% + 6px);right:52px;background:#1a1a18;color:#fff;font-size:12px;line-height:1.4;padding:9px 11px;border-radius:9px;width:190px;box-shadow:0 6px 18px rgba(0,0,0,.25);z-index:5}
    #gcw-hint.show{display:block}
    #gcw-hint::after{content:'';position:absolute;bottom:100%;right:52px;border:5px solid transparent;border-bottom-color:#1a1a18}
    .gcw-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2300;align-items:center;justify-content:center;padding:14px;overscroll-behavior:contain}
    .gcw-ov.open{display:flex}
    .gcw-modal{background:var(--cd);color:var(--tx);border-radius:16px;max-width:430px;width:100%;max-height:92vh;max-height:92dvh;overflow-y:auto;padding:22px 20px;box-shadow:0 8px 32px rgba(0,0,0,.2)}
    .gcw-modal h3{font-size:18px;font-weight:700;margin-bottom:4px}
    .gcw-sub{font-size:13px;color:var(--t3);margin-bottom:16px;line-height:1.5}
    .gcw-f{margin-bottom:13px}
    .gcw-f label{display:block;font-size:12.5px;font-weight:600;color:var(--t2);margin-bottom:5px}
    .gcw-f input,.gcw-f textarea,.gcw-f select{width:100%;min-height:46px;padding:10px 13px;border:1.5px solid var(--bd);border-radius:10px;font-size:16px;color:var(--tx);background:var(--bg);outline:none;font-family:inherit}
    .gcw-f textarea{min-height:64px;resize:vertical}
    .gcw-f input:focus,.gcw-f textarea:focus,.gcw-f select:focus{border-color:var(--g);background:var(--cd)}
    .gcw-f [aria-invalid="true"]{border-color:var(--rd)}
    .gcw-err{color:var(--rd);font-size:12.5px;margin-top:4px}.gcw-err:empty{display:none}
    .gcw-banner{background:#FFF5F5;color:var(--rd);border:1px solid #f0caca;border-radius:10px;padding:9px 12px;font-size:13px;margin-bottom:12px}.gcw-banner:empty{display:none}
    .gcw-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .gcw-acts{display:flex;gap:10px;justify-content:flex-end;margin-top:8px}
    .gcw-linkrow{display:flex;gap:8px;margin-bottom:12px}
    #gcw-rlink{flex:1;min-width:0;padding:10px 12px;border:1.5px solid var(--bd);border-radius:10px;font-size:13px;color:var(--t2);background:var(--bg)}
    .gcw-warn{font-size:12.5px;color:#7a4f00;background:#FFF7E6;border:1px solid #F3D9A0;border-radius:10px;padding:9px 12px;margin-bottom:14px;line-height:1.5}
    @media(max-width:600px){
      #gcw-btn{right:14px}
      #gcw-panel,#gcw-panel.dock-left{left:0;right:0;width:100%;border:0;box-shadow:none}
      #gcw-panel.open,#gcw-panel.dock-left.open{animation-name:gcw-up}
      #gcw-head,#gcw-thead{padding-top:calc(8px + env(safe-area-inset-top,0px))}
      #gcw-inrow{padding-bottom:calc(10px + env(safe-area-inset-bottom,0px))}
      .gcw-col{max-width:84%}
    }
    @media(max-width:400px){#gcw-btn-label,.gcw-pill span{display:none}#gcw-btn{padding:0;width:52px;justify-content:center}.gcw-pill{width:44px;height:44px;padding:0;justify-content:center;border-radius:50%}#gcw-hint{right:0;width:170px}#gcw-hint::after{right:14px}}
    @media(prefers-reduced-motion:reduce){#gcw-btn,.gcw-sk,#gcw-panel.open{transition:none;animation:none}}`;

    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const I = {
      chat: '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>',
      x: '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
      back: '<svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>',
      cal: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      out: '<svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
      phone: '<svg viewBox="0 0 24 24"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>',
      send: '<svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
      ver: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 2.4 3.3-.5.5 3.3L21 9.5 18.4 12 21 14.5l-2.8 2.3-.5 3.3-3.3-.5L12 22l-2.4-2.4-3.3.5-.5-3.3L3 14.5 5.6 12 3 9.5l2.8-2.3.5-3.3 3.3.5z"/></svg>'
    };

    document.body.insertAdjacentHTML('beforeend', `
    <button type="button" id="gcw-btn" aria-label="Open your chats with sellers" aria-haspopup="dialog" aria-expanded="false">${I.chat}<span id="gcw-btn-label">Chats</span><span id="gcw-badge" aria-hidden="true"></span></button>
    <div id="gcw-panel" role="dialog" aria-label="Your chats with sellers" tabindex="-1">
      <div id="gcw-head">
        <div id="gcw-title-wrap"><div id="gcw-title">🔔 Doorbell</div><div id="gcw-subtitle">Your conversations with sellers</div></div>
        <button type="button" class="gcw-pill" id="gcw-full" aria-label="Open the full chat in a new tab">${I.out}<span>Full chat</span></button>
        <span style="position:relative;display:inline-flex"><button type="button" class="gcw-pill" id="gcw-sync" aria-label="Continue on another device">${I.phone}<span>Sync</span></button><div id="gcw-hint" role="status">Tap Sync to open these chats on another phone or computer</div></span>
        <button type="button" class="gcw-ib" id="gcw-close" aria-label="Close chats">${I.x}</button>
      </div>
      <div id="gcw-net" role="status">You're offline. Messages will send when you're back online.</div>
      <div id="gcw-list" aria-live="polite"></div>
      <div id="gcw-thread">
        <div id="gcw-thead">
          <button type="button" class="gcw-ib" id="gcw-back" aria-label="Back to all chats">${I.back}</button>
          <div id="gcw-tinfo"><div id="gcw-tname"></div><div id="gcw-presence"><span id="gcw-dot"></span><span id="gcw-ptxt">Connecting…</span></div></div>
          <button type="button" class="gcw-ib" id="gcw-book" aria-label="Book a viewing" title="Book a viewing">${I.cal}</button>
          <button type="button" class="gcw-ib" id="gcw-close2" aria-label="Close chats">${I.x}</button>
        </div>
        <div id="gcw-lcard"></div>
        <div id="gcw-safety" role="note"><p id="gcw-safety-t">Never pay before viewing the property. Nyumba254 never asks buyers for money.</p><button type="button" id="gcw-report" data-a="ask">Report</button><button type="button" id="gcw-safety-x" aria-label="Dismiss safety note">✕</button></div>
        <div id="gcw-msgs-wrap"><div id="gcw-messages" role="log" aria-live="polite" aria-label="Messages"></div><button type="button" id="gcw-newpill">New message ↓</button></div>
        <div id="gcw-quick"></div>
        <div id="gcw-inrow"><textarea id="gcw-input" placeholder="Type a message…" rows="1" aria-label="Message"></textarea><button type="button" id="gcw-send" aria-label="Send message">${I.send}</button></div>
      </div>
    </div>
    <div class="gcw-ov" id="gcw-vov"><div class="gcw-modal" role="dialog" aria-modal="true" aria-labelledby="gcw-vt">
      <h3 id="gcw-vt">Book a viewing</h3><p class="gcw-sub">Request a time to see this property. The seller confirms in your chat.</p>
      <div class="gcw-banner" id="gcw-verr" role="alert"></div>
      <div class="gcw-two"><div class="gcw-f"><label for="gcw-vdate">Date</label><input type="date" id="gcw-vdate"/><div class="gcw-err" id="gcw-vdate-e"></div></div>
      <div class="gcw-f"><label for="gcw-vtime">Time</label><select id="gcw-vtime"><option value="">Select time</option><option>Morning (8am–11am)</option><option>Midday (11am–2pm)</option><option>Afternoon (2pm–5pm)</option><option>Evening (5pm–7pm)</option></select><div class="gcw-err" id="gcw-vtime-e"></div></div></div>
      <div class="gcw-f"><label for="gcw-vname">Full name</label><input type="text" id="gcw-vname" autocomplete="name"/><div class="gcw-err" id="gcw-vname-e"></div></div>
      <div class="gcw-f"><label for="gcw-vphone">Phone</label><input type="tel" id="gcw-vphone" inputmode="tel" autocomplete="tel" placeholder="07XX XXX XXX"/><div class="gcw-err" id="gcw-vphone-e"></div></div>
      <div class="gcw-f"><label for="gcw-vnotes">Notes (optional)</label><textarea id="gcw-vnotes" rows="2" placeholder="Anything the seller should know"></textarea></div>
      <div class="gcw-acts"><button type="button" class="gcw-btn ghost" id="gcw-vcancel">Cancel</button><button type="button" class="gcw-btn" id="gcw-vsend">Request viewing</button></div>
    </div></div>
    <div class="gcw-ov" id="gcw-rov"><div class="gcw-modal" role="dialog" aria-modal="true" aria-labelledby="gcw-rt">
      <h3 id="gcw-rt">Continue on another device</h3>
      <p class="gcw-sub">This link opens all your Nyumba254 chats on any phone or computer.</p>
      <div class="gcw-warn">Anyone who has this link can read your chats. Send it only to yourself and never post it publicly.</div>
      <div class="gcw-linkrow"><input type="text" id="gcw-rlink" readonly placeholder="Send a message first to get your link" aria-label="Your link"/><button type="button" class="gcw-btn" id="gcw-rcopy">Copy</button></div>
      <div class="gcw-acts"><button type="button" class="gcw-btn ghost" id="gcw-rclose">Done</button></div>
    </div></div>`);

    let panelOpen = false, threadOpen = false, lastFocus = null, viewingFor = null;
    const panel = $('gcw-panel'), btn = $('gcw-btn'); panel.classList.toggle('dock-left', DOCK === 'left');
    const vis = () => panelOpen && threadOpen && !document.hidden;
    const sync = () => core.setViewing(vis());
    const atBottom = () => { const b = $('gcw-messages'); return b.scrollHeight - b.scrollTop - b.clientHeight < 90; };
    const toBottom = () => { const b = $('gcw-messages'); b.scrollTop = b.scrollHeight; $('gcw-newpill').classList.remove('show'); };
    const activeConvo = () => { const a = core.active(); return a ? core.convos().find(c => c.listingId === a.listingId) : null; };

    /* ── FAB + badge ── */
    function renderBadge() {
      const n = core.unread(), b = $('gcw-badge'), has = core.convos().length > 0;
      btn.style.display = (has && !panelOpen) ? 'flex' : 'none';
      if (n > 0 && !panelOpen) { b.textContent = n > 9 ? '9+' : n; b.style.display = 'flex'; } else b.style.display = 'none';
      btn.setAttribute('aria-label', n > 0 && !panelOpen ? `Open your chats, ${n} unread` : 'Open your chats with sellers');
      core.setTitleBadge(n);
    }

    /* ── conversation list ── */
    function renderList() {
      const list = $('gcw-list'), cs = core.convos();
      if (!cs.length && core.loading()) { list.innerHTML = '<div class="gcw-sk"></div><div class="gcw-sk"></div><div class="gcw-sk"></div>'; return; }
      if (!cs.length && core.loadError()) { list.innerHTML = '<div class="gcw-state">We could not load your chats.<br><button type="button" class="gcw-btn" data-a="reload">Try again</button></div>'; return; }
      if (!cs.length) { list.innerHTML = '<div class="gcw-state">No conversations yet. When you message a seller, the chat appears here.</div>'; return; }
      list.innerHTML = cs.map(c => `<button type="button" class="gcw-convo" data-l="${esc(c.listingId)}"><span class="gcw-thumb">${c.coverUrl ? `<img src="${esc(c.coverUrl)}" alt="" loading="lazy"/>` : esc(core.initials(c.sellerName))}</span><span class="gcw-cb"><span class="gcw-ct"><span style="overflow:hidden;text-overflow:ellipsis">${esc(c.title)}</span>${c.sellerVerified ? I.ver : ''}</span><span class="gcw-cl">${esc(c.lastMessage || 'No messages yet')}</span></span><span class="gcw-cm"><span class="gcw-cw">${esc(core.whenLabel(c.lastAt))}</span>${c.unread ? `<span class="gcw-cbadge">${c.unread > 9 ? '9+' : c.unread}</span>` : ''}</span></button>`).join('');
    }

    /* ── thread ── */
    function renderHead() {
      const c = activeConvo(); if (!c) return;
      $('gcw-tname').innerHTML = `<span>${esc(c.sellerName)}</span>${c.sellerVerified ? I.ver : ''}`;
      const l = core.listing(), price = core.priceLabel(l), num = l && l.listing_number != null ? String(l.listing_number).padStart(6, '0') : null;
      const inner = `<span class="gcw-thumb">${c.coverUrl ? `<img src="${esc(c.coverUrl)}" alt=""/>` : esc(core.initials(c.title))}</span><span class="gcw-lc-t"><b>${esc((l && l.title) || c.title)}</b><span>${esc(price || (l && l.area) || '')}</span></span>${num ? '<span class="gcw-lc-go">View →</span>' : ''}`;
      $('gcw-lcard').innerHTML = num ? `<a class="gcw-lcard" href="/listing?id=${num}">${inner}</a>` : `<div class="gcw-lcard">${inner}</div>`;
    }
    function renderPresence() {
      const s = core.presence(), t = { connecting: 'Connecting…', online: 'Online now', away: 'Away', typing: 'Typing…' }[s] || 'Away';
      $('gcw-ptxt').textContent = t; $('gcw-dot').className = s === 'online' ? 'online' : s === 'typing' ? 'typing' : '';
    }
    function renderQuick() {
      const box = $('gcw-quick'), ms = core.messages(), mine = ms.filter(m => m.sender === 'buyer').length;
      if (!core.active() || mine >= 2) { box.innerHTML = ''; return; }
      const booked = core.booked(core.active().listingId), chips = core.ui.QUICK.map(t => (booked && /book a viewing/i.test(t)) ? 'Can we reschedule the viewing?' : t);
      box.innerHTML = chips.map(t => `<button type="button" class="gcw-chip" data-q="${esc(t)}">${esc(t)}</button>`).join('');
    }
    function renderMessages(state) {
      const box = $('gcw-messages'), ms = core.messages(), c = activeConvo(), peer = core.initials(c && c.sellerName);
      if (state && state.loading) { box.innerHTML = '<div class="gcw-empty-thread">Loading messages…</div>'; return; }
      if (state && state.error) { box.innerHTML = '<div class="gcw-empty-thread"><b>Could not load this chat</b><button type="button" class="gcw-btn" data-a="reopen">Try again</button></div>'; return; }
      if (!ms.length) { box.innerHTML = '<div class="gcw-empty-thread"><b>Say hello 👋</b>Ask if it is still available, about the deposit, or when you can view it.</div>'; renderQuick(); return; }
      let html = '', prev = null;
      ms.forEach(m => { if (!prev || core.dayLabel(prev.created_at) !== core.dayLabel(m.created_at)) html += core.ui.dayHtml(m.created_at, 'gcw'); html += core.ui.rowHtml(m, prev, 'gcw', peer); prev = m; });
      box.innerHTML = html; toBottom(); renderQuick();
    }
    function appendMessage(m, incoming) {
      const box = $('gcw-messages'), ms = core.messages(), i = ms.indexOf(m), prev = i > 0 ? ms[i - 1] : null, c = activeConvo();
      const wasBottom = atBottom(); if (box.querySelector('.gcw-empty-thread')) box.innerHTML = '';
      let html = ''; if (!prev || core.dayLabel(prev.created_at) !== core.dayLabel(m.created_at)) html += core.ui.dayHtml(m.created_at, 'gcw');
      html += core.ui.rowHtml(m, prev, 'gcw', core.initials(c && c.sellerName)); box.insertAdjacentHTML('beforeend', html);
      if (m.sender === 'buyer' || wasBottom) toBottom(); else if (incoming) $('gcw-newpill').classList.add('show');
      renderQuick();
    }
    function updateMessage(m) {
      const ms = core.messages(), i = ms.indexOf(m), prev = i > 0 ? ms[i - 1] : null, c = activeConvo(), k = m.localId || m.id;
      const el = qsa('#gcw-messages .gcw-row').find(r => r.dataset.k === String(k)); if (!el) return;
      const t = document.createElement('div'); t.innerHTML = core.ui.rowHtml(m, prev, 'gcw', core.initials(c && c.sellerName)); el.replaceWith(t.firstElementChild);
    }
    function showThread() {
      threadOpen = true; $('gcw-thread').classList.add('open'); $('gcw-list').style.display = 'none';
      $('gcw-title-wrap').parentElement.style.display = 'none';
      $('gcw-safety').classList.toggle('show', !core.ls.get('nk_chat_safety_seen'));
      $('gcw-safety-t').textContent = 'Never pay before viewing the property. Nyumba254 never asks buyers for money.'; $('gcw-report').style.display = '';
      renderHead(); renderPresence(); sync();
    }
    function hideThread() {
      threadOpen = false; $('gcw-thread').classList.remove('open'); $('gcw-list').style.display = ''; $('gcw-head').style.display = '';
      core.closeThread(); sync(); renderList();
    }
    async function openConvo(id, token) {
      if (!panelOpen) setPanel(true);
      const opening = core.openThread(id, token);      // the thread pane opens at once and fills in as messages arrive
      if (core.active()) showThread();
      await opening;
    }

    /* ── panel ── */
    function setPanel(open) {
      if (open === panelOpen) return; panelOpen = open;
      panel.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); core.setPolling(open);
      panel.setAttribute('aria-modal', open && wide() ? 'true' : 'false'); lockPage(); renderBadge(); fit();
      if (open) {
        lastFocus = document.activeElement; renderList(); panel.focus({ preventScroll: true });
        const h = $('gcw-hint'); if (core.convos().length && core.hasResumeData() && !core.ls.get('nk_resume_hint_seen')) h.classList.add('show');
      } else { $('gcw-hint').classList.remove('show'); core.ls.set('nk_resume_hint_seen', '1'); if (lastFocus && lastFocus.focus && document.contains(lastFocus) && lastFocus.offsetParent !== null) lastFocus.focus(); else btn.focus(); }
      sync();
    }
    /* on a phone the panel covers the whole page, so the page behind must not scroll */
    const lockPage = () => document.documentElement.classList.toggle('gcw-lock', panelOpen && wide());
    matchMedia('(max-width:600px)').addEventListener('change', () => { lockPage(); fit(); panel.setAttribute('aria-modal', panelOpen && wide() ? 'true' : 'false'); });
    /* keep the header on screen when the phone keyboard opens */
    function fit() {
      if (!panelOpen || !wide() || !window.visualViewport) { panel.style.height = ''; panel.style.top = ''; panel.style.bottom = ''; return; }
      const vv = window.visualViewport; panel.style.height = vv.height + 'px'; panel.style.top = vv.offsetTop + 'px'; panel.style.bottom = 'auto';
    }
    if (window.visualViewport) { visualViewport.addEventListener('resize', fit); visualViewport.addEventListener('scroll', fit); }

    /* ── viewing modal ── */
    const setErr = (id, m) => { const e = $(id + '-e'), i = $(id); if (e) e.textContent = m || ''; if (i) i.setAttribute('aria-invalid', m ? 'true' : 'false'); };
    function openViewing(listingId) {
      viewingFor = String(listingId || (core.active() && core.active().listingId) || ''); if (!viewingFor) return;
      const p = core.Profile.forListing(viewingFor), t = new Date();
      ['gcw-vdate', 'gcw-vtime', 'gcw-vname', 'gcw-vphone'].forEach(i => setErr(i, '')); $('gcw-verr').textContent = '';
      $('gcw-vdate').min = core.localISO(t); t.setDate(t.getDate() + 1); $('gcw-vdate').value = core.localISO(t); $('gcw-vtime').value = '';
      $('gcw-vname').value = p.name; $('gcw-vphone').value = p.phone; $('gcw-vnotes').value = '';
      $('gcw-vov').classList.add('open'); if (!touch()) setTimeout(() => $('gcw-vdate').focus(), 50);
    }
    const closeViewing = () => $('gcw-vov').classList.remove('open');
    async function sendViewing() {
      ['gcw-vdate', 'gcw-vtime', 'gcw-vname', 'gcw-vphone'].forEach(i => setErr(i, '')); $('gcw-verr').textContent = '';
      const b = $('gcw-vsend'); b.disabled = true; b.textContent = 'Sending…';
      const r = await core.requestViewing({ listingId: viewingFor, date: $('gcw-vdate').value, time: $('gcw-vtime').value, name: $('gcw-vname').value, phone: $('gcw-vphone').value, notes: $('gcw-vnotes').value });
      b.disabled = false; b.textContent = 'Request viewing';
      if (!r.ok) { if (r.field) { setErr('gcw-v' + r.field, r.error); const f = $('gcw-v' + r.field); if (f) f.focus(); } else $('gcw-verr').textContent = r.error; return; }
      closeViewing(); if (r.warning) alert(r.warning);
      if (!threadOpen) await openConvo(viewingFor, r.token);
    }

    /* ── resume link ── */
    function openResume() { $('gcw-rlink').value = core.buildResumeLink() || ''; $('gcw-rov').classList.add('open'); }

    /* ── send ── */
    function sendText(t) { const m = core.send(t); if (m && !touch()) $('gcw-input').focus(); return m; }
    function sendInput() { const i = $('gcw-input'), v = i.value; if (!v.trim()) return; i.value = ''; i.style.height = 'auto'; sendText(v); }

    /* ═════ wire it up ═════ */
    btn.addEventListener('click', () => setPanel(!panelOpen));
    $('gcw-close').addEventListener('click', () => setPanel(false)); $('gcw-close2').addEventListener('click', () => setPanel(false));
    $('gcw-back').addEventListener('click', hideThread);
    $('gcw-full').addEventListener('click', () => { const a = core.active(); location.href = a ? '/inbox?open=' + encodeURIComponent(a.listingId) : '/inbox'; });
    $('gcw-sync').addEventListener('click', () => { $('gcw-hint').classList.remove('show'); core.ls.set('nk_resume_hint_seen', '1'); openResume(); });
    $('gcw-book').addEventListener('click', () => openViewing());
    $('gcw-send').addEventListener('click', sendInput);
    $('gcw-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendInput(); } });
    $('gcw-input').addEventListener('input', function () { this.style.height = 'auto'; this.style.height = Math.min(this.scrollHeight, 110) + 'px'; core.typing(); });
    $('gcw-newpill').addEventListener('click', toBottom);
    $('gcw-messages').addEventListener('scroll', () => { if (atBottom()) $('gcw-newpill').classList.remove('show'); }, { passive: true });
    $('gcw-list').addEventListener('click', e => { const c = e.target.closest('.gcw-convo'); if (c) return openConvo(c.dataset.l); if (e.target.closest('[data-a="reload"]')) core.fetchConversations(); });
    $('gcw-messages').addEventListener('click', e => { const r = e.target.closest('[data-retry]'); if (r) core.retry(r.dataset.retry); const o = e.target.closest('[data-a="reopen"]'); if (o) { const a = core.active(); if (a) core.openThread(a.listingId, a.token); } });
    $('gcw-quick').addEventListener('click', e => { const c = e.target.closest('.gcw-chip'); if (!c) return; const t = c.dataset.q; if (/book a viewing/i.test(t)) return openViewing(); sendText(t); });
    $('gcw-safety-x').addEventListener('click', () => { core.ls.set('nk_chat_safety_seen', '1'); $('gcw-safety').classList.remove('show'); });
    $('gcw-report').addEventListener('click', async function () {
      const a = core.active(); if (!a) return;
      if (this.dataset.a === 'ask') { $('gcw-safety-t').textContent = 'Send a report about this seller to Nyumba254?'; this.textContent = 'Yes, report'; this.dataset.a = 'go'; return; }
      this.disabled = true; const r = await core.report(a.listingId, 'Reported from the chat widget'); this.disabled = false; this.dataset.a = 'ask'; this.textContent = 'Report';
      $('gcw-safety-t').textContent = r.ok ? "Thank you. We've received your report." : 'The report could not be sent. Please try again.';
    });
    $('gcw-vcancel').addEventListener('click', closeViewing); $('gcw-vsend').addEventListener('click', sendViewing);
    $('gcw-vov').addEventListener('click', e => { if (e.target.id === 'gcw-vov') closeViewing(); });
    $('gcw-rclose').addEventListener('click', () => $('gcw-rov').classList.remove('open'));
    $('gcw-rov').addEventListener('click', e => { if (e.target.id === 'gcw-rov') $('gcw-rov').classList.remove('open'); });
    $('gcw-rcopy').addEventListener('click', () => { const i = $('gcw-rlink'); if (!i.value) return; (navigator.clipboard ? navigator.clipboard.writeText(i.value) : Promise.reject()).then(() => { const b = $('gcw-rcopy'), o = b.textContent; b.textContent = 'Copied'; setTimeout(() => { b.textContent = o; }, 1800); }, () => { i.select(); }); });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if ($('gcw-vov').classList.contains('open')) return closeViewing();
      if ($('gcw-rov').classList.contains('open')) return $('gcw-rov').classList.remove('open');
      if (panelOpen) setPanel(false);
    });
    document.addEventListener('visibilitychange', sync);

    core.on('convos', () => { renderBadge(); if (panelOpen && !threadOpen) renderList(); if (threadOpen) renderHead(); });
    core.on('thread', ev => {
      if (ev.type === 'reset') renderMessages(ev); else if (ev.type === 'append') appendMessage(ev.message, ev.incoming); else if (ev.type === 'update') updateMessage(ev.message);
      if (ev.type === 'reset') renderHead();
    });
    core.on('presence', renderPresence);
    core.on('viewing', renderQuick);
    core.on('incoming', () => { btn.style.animation = 'none'; requestAnimationFrame(() => { btn.style.animation = 'gcw-pop .3s ease'; }); });
    core.on('net', ev => $('gcw-net').classList.toggle('show', !ev.online));
    if (!core.isOnline()) $('gcw-net').classList.add('show');

    api = { refresh: () => core.fetchConversations(), open: (id, t) => openConvo(id, t), openViewing: id => { if (!panelOpen) setPanel(true); openViewing(id); } };
    core.init(); renderBadge();
    while (queue.length) queue.shift()();
  }
})();