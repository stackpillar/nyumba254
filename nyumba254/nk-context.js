/* Nyumba254 context detector.
 * Decides whether this page is running inside the Android app shell (legacy
 * Chrome-powered app) or on the normal website, and exposes it as:
 *   window.NK_CTX            'app' | 'web'
 *   <html data-nk-ctx="...">
 * Elements marked .nk-web-only are hidden in the app; .nk-app-only are hidden on the web.
 *
 * The decision is kept in sessionStorage only. localStorage and cookies are shared
 * with the browser on Android, so storing it there would make the website think it
 * is the app (and the reverse).
 */
(function () {
  'use strict';
  var KEY = 'nk_ctx';
  function get() { try { return sessionStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { sessionStorage.setItem(KEY, v); } catch (e) { /* storage blocked */ } }
  var ctx = get();
  if (!ctx) {
    var fromUrl = /[?&]source=app(&|$)/.test(location.search);
    var fromRef = (document.referrer || '').indexOf('android-app://') === 0;
    ctx = (fromUrl || fromRef) ? 'app' : 'web';
    set(ctx);
  } else if (ctx === 'web' && /[?&]source=app(&|$)/.test(location.search)) {
    ctx = 'app'; set(ctx);
  }
  window.NK_CTX = ctx;
  var root = document.documentElement;
  root.setAttribute('data-nk-ctx', ctx);
  var st = document.createElement('style');
  st.textContent = '[data-nk-ctx="app"] .nk-web-only,[data-nk-ctx="web"] .nk-app-only{display:none!important}';
  (document.head || root).appendChild(st);
  if (ctx === 'app' && 'serviceWorker' in navigator) {
    var tell = function () {
      if (navigator.serviceWorker.controller) navigator.serviceWorker.controller.postMessage({ type: 'nk-ctx', ctx: 'app' });
    };
    tell();
    navigator.serviceWorker.addEventListener('controllerchange', tell);
    navigator.serviceWorker.ready.then(tell);
  }
})();
