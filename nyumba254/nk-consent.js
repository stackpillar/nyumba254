/* Cookie and ads consent. Nothing for analytics or ads loads until the visitor accepts.
   Public pages only: never shown on dashboard, post-listing, login or admin pages.
   Policy text is a draft and needs legal review (Kenya Data Protection Act 2019). */
(function () {
  var KEY = 'nk_consent_v1';
  var PRIVATE = /^\/(dashboard|post-listing|login|nk-ctrl-7f3k2x9|admin|inbox|profile|kyc|reset|accept-invite|verify-email)/i;
  if (PRIVATE.test(location.pathname)) { window.nkConsent = { get: function () { return null; }, allowed: function () { return false; }, open: function () {}, onChange: function () {} }; return; }

  var listeners = [];
  function read() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
  }
  function write(v) {
    try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) { /* storage unavailable: choice lasts for this page only */ }
    window.nkConsent._mem = v;
    listeners.forEach(function (fn) { try { fn(v); } catch (e) { console.error(e); } });
  }
  window.nkConsent = {
    _mem: null,
    get: function () { return read() || this._mem; },
    allowed: function (kind) { var v = this.get(); return !!(v && v[kind]); },
    onChange: function (fn) { listeners.push(fn); var v = this.get(); if (v) fn(v); },
    open: function () { show(true); }
  };

  function el(tag, attrs, html) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (html) n.innerHTML = html;
    return n;
  }

  function injectStyle() {
    if (document.getElementById('nk-consent-style')) return;
    var s = el('style', { id: 'nk-consent-style' });
    s.textContent =
      '#nk-consent{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:9990;max-width:560px;margin:0 auto;background:var(--white,#fff);color:var(--text,#1a1a1a);border:1px solid var(--border,#ddd);border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.2);padding:16px 18px;font:14px/1.5 Inter,system-ui,sans-serif}' +
      '#nk-consent h2{font-size:15px;margin:0 0 6px}#nk-consent p{margin:0 0 10px;font-size:13px;color:var(--text-2,#444)}' +
      '#nk-consent .nkc-row{display:flex;gap:8px;flex-wrap:wrap}#nk-consent button{min-height:44px;padding:0 16px;border-radius:10px;font:600 13px Inter,system-ui,sans-serif;cursor:pointer;border:1.5px solid var(--green,#0F6E56);background:transparent;color:var(--green,#0F6E56)}' +
      '#nk-consent button.nkc-primary{background:var(--green,#0F6E56);color:#fff}#nk-consent button:focus-visible{outline:3px solid #BA7517;outline-offset:2px}' +
      '#nk-consent label{display:flex;gap:10px;align-items:flex-start;margin:8px 0;font-size:13px;min-height:44px}#nk-consent input{width:20px;height:20px;margin-top:2px;flex:none}' +
      '#nk-consent .nkc-note{font-size:11.5px;color:var(--text-3,#666)}';
    document.head.appendChild(s);
  }

  function close() { var n = document.getElementById('nk-consent'); if (n) n.remove(); }

  function show(manage) {
    injectStyle(); close();
    var cur = read() || {};
    var box = el('div', { id: 'nk-consent', role: 'dialog', 'aria-labelledby': 'nkc-title', 'aria-live': 'polite' });
    if (!manage) {
      box.innerHTML =
        '<h2 id="nkc-title">Cookies and ads</h2>' +
        '<p>We use essential storage to keep you signed in and remember your settings. With your permission we would also use analytics and show ads. Nothing optional loads until you choose.</p>' +
        '<div class="nkc-row"><button type="button" class="nkc-primary" data-c="accept">Accept</button><button type="button" data-c="reject">Reject</button><button type="button" data-c="manage">Manage</button></div>' +
        '<p class="nkc-note" style="margin-top:8px">Draft policy, needs legal review (Kenya Data Protection Act 2019). See our <a href="/privacy">privacy policy</a>.</p>';
    } else {
      box.innerHTML =
        '<h2 id="nkc-title">Manage cookie choices</h2>' +
        '<label><input type="checkbox" checked disabled/><span><b>Essential</b><br>Sign-in, security and saved preferences. Always on.</span></label>' +
        '<label><input type="checkbox" id="nkc-an"' + (cur.analytics ? ' checked' : '') + '/><span><b>Analytics</b><br>Helps us see which pages are used so we can improve them.</span></label>' +
        '<label><input type="checkbox" id="nkc-ads"' + (cur.ads ? ' checked' : '') + '/><span><b>Ads</b><br>Lets us show ads on public pages. Never shown in your dashboard.</span></label>' +
        '<div class="nkc-row"><button type="button" class="nkc-primary" data-c="save">Save choices</button><button type="button" data-c="reject">Reject all</button></div>' +
        '<p class="nkc-note" style="margin-top:8px">Draft policy, needs legal review (Kenya Data Protection Act 2019).</p>';
    }
    box.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-c]'); if (!b) return;
      var c = b.getAttribute('data-c');
      if (c === 'manage') { show(true); return; }
      var v = { analytics: false, ads: false, at: new Date().toISOString() };
      if (c === 'accept') { v.analytics = true; v.ads = true; }
      if (c === 'save') { v.analytics = !!document.getElementById('nkc-an').checked; v.ads = !!document.getElementById('nkc-ads').checked; }
      write(v); close();
    });
    document.body.appendChild(box);
    var first = box.querySelector('button'); if (first && manage) first.focus();
  }

  function init() {
    if (!read()) show(false);
    document.addEventListener('click', function (e) {
      var a = e.target.closest('[data-nk-cookie-settings]');
      if (a) { e.preventDefault(); show(true); }
    });
  }
  if (document.body) init(); else document.addEventListener('DOMContentLoaded', init);
})();
