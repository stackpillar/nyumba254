/* Nyumba254 - "Install the app" pop-up
 *
 * Drop-in script. Add before </body>:
 *   <script src="/install-app-prompt.js" defer></script>
 *
 * Shows a bottom-sheet pop-up once to Android visitors who are using the
 * website in a browser. It never shows:
 *   - inside the installed Nyumba254 app,
 *   - on iPhones or desktops,
 *   - inside Facebook/Instagram/TikTok in-app browsers (they block APK downloads),
 *   - for 7 days after "Not now", or 30 days after "Install app".
 *
 * The same script also adds a permanent "Get the app" button:
 *   - automatically at the end of the page's <footer>, or
 *   - wherever you put  <div data-nk-app-link></div>  (takes priority).
 * The button uses the same rules (Android browsers only, never inside the app),
 * but ignores the "Not now" snooze.
 *
 * Testing on any device: open the page with ?showappprompt=1
 * Later, when the Play Store version is live, change APP_URL below.
 */
(function () {
  'use strict';

  /* ---------- settings ---------- */
  var APP_URL = '/nyumba254.apk';        // swap for the Play Store link when it is live
  var APP_FILE_NAME = 'nyumba254.apk';   // set to '' if APP_URL is a Play Store link
  var SHOW_AFTER_MS = 4000;
  var SNOOZE_NOT_NOW_DAYS = 7;
  var SNOOZE_INSTALL_DAYS = 30;
  var STORE_KEY = 'nk_app_prompt_until';
  var SESSION_KEY = 'nk_in_app';
  var ICON_URL = '/icons/icon-192.png';
  /* -------------------------------- */

  var forced = /[?&]showappprompt=1(&|$)/.test(location.search);

  function safeGet(store, key) {
    try { return store.getItem(key); } catch (e) { return null; }
  }
  function safeSet(store, key, val) {
    try { store.setItem(key, val); } catch (e) { /* storage blocked: ignore */ }
  }

  /* Are we running inside the installed app (Trusted Web Activity / PWA)? */
  function isInsideApp() {
    if (safeGet(window.sessionStorage, SESSION_KEY) === '1') return true;
    var inApp = false;
    try {
      inApp = (window.matchMedia && (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches
      )) ||
      window.navigator.standalone === true ||
      (document.referrer || '').indexOf('android-app://') === 0 ||
      /[?&]source=(pwa|shortcut)(&|$)/.test(location.search);
    } catch (e) { inApp = false; }
    if (inApp) safeSet(window.sessionStorage, SESSION_KEY, '1');
    return inApp;
  }

  function shouldShow(ignoreSnooze) {
    if (forced) return true;
    var ua = navigator.userAgent || '';
    if (!/Android/i.test(ua)) return false;
    if (/FBAN|FBAV|FB_IAB|Instagram|TikTok|musical_ly|Snapchat|Twitter|Line\/|; wv\)/i.test(ua)) return false;
    if (isInsideApp()) return false;
    if (ignoreSnooze) return true;
    var until = parseInt(safeGet(window.localStorage, STORE_KEY) || '0', 10);
    if (until && Date.now() < until) return false;
    return true;
  }

  function snooze(days) {
    if (forced) return;
    safeSet(window.localStorage, STORE_KEY, String(Date.now() + days * 86400000));
  }

  var CSS = [
    '.nk-ap-backdrop{position:fixed;inset:0;z-index:2147483000;display:flex;align-items:flex-end;justify-content:center;',
    'background:rgba(2,20,16,.6);opacity:0;transition:opacity .25s ease;font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}',
    '.nk-ap-backdrop.nk-ap-in{opacity:1}',
    '.nk-ap-card{box-sizing:border-box;width:100%;max-width:440px;background:#085041;color:#fff;',
    'border-radius:20px 20px 0 0;padding:22px 20px calc(20px + env(safe-area-inset-bottom,0px));',
    'box-shadow:0 -10px 40px rgba(0,0,0,.35);transform:translateY(40px);transition:transform .25s ease}',
    '.nk-ap-backdrop.nk-ap-in .nk-ap-card{transform:none}',
    '@media (min-width:600px){.nk-ap-backdrop{align-items:center}.nk-ap-card{border-radius:20px;padding-bottom:22px}}',
    '.nk-ap-head{display:flex;gap:14px;align-items:center;margin:0 0 14px}',
    '.nk-ap-icon{width:56px;height:56px;flex:none;border-radius:14px;background:#0F6E56;object-fit:cover}',
    '.nk-ap-title{margin:0 0 2px;font-size:1.15rem;line-height:1.25;font-weight:700;',
    'font-family:"Playfair Display",Georgia,"Times New Roman",serif}',
    '.nk-ap-sub{margin:0;font-size:.9rem;line-height:1.45;color:#cfe9e0}',
    '.nk-ap-actions{display:flex;gap:10px;margin-top:16px}',
    '.nk-ap-btn{flex:1;box-sizing:border-box;min-height:46px;padding:12px 16px;border-radius:12px;border:0;',
    'font:inherit;font-weight:600;font-size:1rem;text-align:center;text-decoration:none;cursor:pointer;',
    'display:inline-flex;align-items:center;justify-content:center}',
    '.nk-ap-primary{background:#6FE0B8;color:#04211a}',
    '.nk-ap-secondary{background:transparent;color:#fff;border:1px solid rgba(255,255,255,.35)}',
    '.nk-ap-card:focus{outline:none}.nk-ap-btn:focus-visible{outline:3px solid #fff;outline-offset:2px}',
    '.nk-ap-note{margin:12px 0 0;font-size:.78rem;line-height:1.4;color:#9cc4b6}',
    '@media (prefers-reduced-motion:reduce){.nk-ap-backdrop,.nk-ap-card{transition:none}}'
  ].join('');

  var LINK_CSS = [
    '.nk-ap-link-wrap{grid-column:1/-1;display:flex;justify-content:center;margin:18px 0 6px;padding:0 12px}',
    '.nk-ap-link{box-sizing:border-box;display:inline-flex;align-items:center;gap:12px;max-width:100%;min-height:52px;',
    'padding:8px 18px 8px 10px;border-radius:14px;background:#0F6E56;color:#fff;text-decoration:none;',
    'border:1px solid rgba(255,255,255,.28);font-family:Inter,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;text-align:left}',
    '.nk-ap-link:hover{background:#1D9E75}',
    '.nk-ap-link:focus-visible{outline:3px solid #6FE0B8;outline-offset:2px}',
    '.nk-ap-link img{width:36px;height:36px;border-radius:9px;flex:none;background:#085041;object-fit:cover}',
    '.nk-ap-link b{display:block;font-size:.95rem;line-height:1.2;font-weight:700}',
    '.nk-ap-link small{display:block;font-size:.75rem;line-height:1.3;color:#cfe9e0}'
  ].join('');

  function build() {
    if (document.getElementById('nk-app-prompt')) return;

    var style = document.createElement('style');
    style.id = 'nk-app-prompt-css';
    style.textContent = CSS;
    document.head.appendChild(style);

    var wrap = document.createElement('div');
    wrap.id = 'nk-app-prompt';
    wrap.className = 'nk-ap-backdrop';
    wrap.innerHTML =
      '<div class="nk-ap-card" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="nk-ap-title" aria-describedby="nk-ap-sub">' +
        '<div class="nk-ap-head">' +
          '<img class="nk-ap-icon" src="' + ICON_URL + '" alt="" width="56" height="56">' +
          '<div>' +
            '<h2 class="nk-ap-title" id="nk-ap-title">Get the Nyumba254 app</h2>' +
            '<p class="nk-ap-sub" id="nk-ap-sub">Open listings, saved homes and messages faster from your home screen. Free, about 3 MB.</p>' +
          '</div>' +
        '</div>' +
        '<div class="nk-ap-actions">' +
          '<button type="button" class="nk-ap-btn nk-ap-secondary" data-nk-ap="later">Not now</button>' +
          '<a class="nk-ap-btn nk-ap-primary" data-nk-ap="install" href="' + APP_URL + '"' +
            (APP_FILE_NAME ? ' download="' + APP_FILE_NAME + '"' : '') + '>Install app</a>' +
        '</div>' +
        '<p class="nk-ap-note">If your phone asks, tap <strong>Download anyway</strong>, then <strong>Install anyway</strong>. This is normal for apps installed outside the Play Store.</p>' +
      '</div>';
    document.body.appendChild(wrap);

    var previousFocus = document.activeElement;
    var card = wrap.querySelector('.nk-ap-card');
    var installBtn = wrap.querySelector('[data-nk-ap="install"]');
    var laterBtn = wrap.querySelector('[data-nk-ap="later"]');

    function close(days) {
      snooze(days);
      document.removeEventListener('keydown', onKey, true);
      wrap.classList.remove('nk-ap-in');
      setTimeout(function () {
        if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
        if (style.parentNode) style.parentNode.removeChild(style);
        if (previousFocus && previousFocus.focus) { try { previousFocus.focus(); } catch (e) {} }
      }, 260);
    }

    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); close(SNOOZE_NOT_NOW_DAYS); return; }
      if (e.key === 'Tab') {
        var first = laterBtn, last = installBtn;
        if (e.shiftKey && (document.activeElement === first || document.activeElement === card)) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }

    laterBtn.addEventListener('click', function () { close(SNOOZE_NOT_NOW_DAYS); });
    installBtn.addEventListener('click', function () { close(SNOOZE_INSTALL_DAYS); });
    wrap.addEventListener('click', function (e) { if (e.target === wrap) close(SNOOZE_NOT_NOW_DAYS); });
    document.addEventListener('keydown', onKey, true);

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        wrap.classList.add('nk-ap-in');
        card.focus({ preventScroll: true });
      });
    });
  }

  function buildFooterLink() {
    if (document.getElementById('nk-app-link')) return;
    var slot = document.querySelector('[data-nk-app-link]');
    var host = slot || document.querySelector('footer');
    if (!host) return;

    var st = document.createElement('style');
    st.id = 'nk-app-link-css';
    st.textContent = LINK_CSS;
    document.head.appendChild(st);

    var wrap = document.createElement('div');
    wrap.id = 'nk-app-link';
    wrap.className = 'nk-ap-link-wrap';
    wrap.innerHTML =
      '<a class="nk-ap-link" href="' + APP_URL + '"' +
        (APP_FILE_NAME ? ' download="' + APP_FILE_NAME + '"' : '') + '>' +
        '<img src="' + ICON_URL + '" alt="" width="36" height="36">' +
        '<span><b>Get the Nyumba254 app</b><small>Android &middot; free &middot; about 3 MB</small></span>' +
      '</a>';
    host.appendChild(wrap);
  }

  function startFooterLink() {
    if (!shouldShow(true)) return;
    buildFooterLink();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startFooterLink);
  else startFooterLink();

  function start() {
    if (!shouldShow()) return;
    setTimeout(function () {
      if (shouldShow()) build();
    }, forced ? 300 : SHOW_AFTER_MS);
  }

  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start);
})();