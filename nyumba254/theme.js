/* theme.js — Nyumba254 shared theme controller.
   Loaded in <head> WITHOUT defer so the right theme is set before the first paint (no white flash).
   Uses the same localStorage key as saved.html ("nk_theme"), so every page stays in sync.
   Any element with a data-theme-toggle attribute toggles the whole site. */
(function () {
  'use strict';
  var KEY = 'nk_theme';
  var root = document.documentElement;
  var ICON = 'viewBox="0 0 24 24" aria-hidden="true"';
  var MOON = '<svg ' + ICON + '><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z"/></svg>';
  var SUN = '<svg ' + ICON + '><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>';

  function stored() {
    try { var t = localStorage.getItem(KEY); return (t === 'light' || t === 'dark') ? t : null; } catch (e) { return null; }
  }
  function deviceTheme() {
    return (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  }
  function isDark() { return root.getAttribute('data-theme') === 'dark'; }

  function paintButtons() {
    var dark = isDark();
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      if (b.classList.contains('nk-theme-fab')) b.innerHTML = dark ? SUN : MOON;
    }
  }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0f1512' : '#0F6E56');
    paintButtons();
  }
  function set(t) {
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t);
  }

  // 1. Apply immediately (before first paint). To start everyone on light instead, replace deviceTheme() with 'light'.
  apply(stored() || deviceTheme());

  // 2. Any [data-theme-toggle] element, on any page, flips the theme.
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-theme-toggle]');
    if (t) set(isDark() ? 'light' : 'dark');
  });

  // 3. If a page has no toggle of its own, add a small floating one.
  document.addEventListener('DOMContentLoaded', function () {
    if (!document.querySelector('[data-theme-toggle]') && !document.getElementById('theme-btn')) {
      var fab = document.createElement('button');
      fab.type = 'button';
      fab.className = 'nk-theme-fab';
      fab.setAttribute('data-theme-toggle', '');
      document.body.appendChild(fab);
    }
    paintButtons();
  });

  // 4. Keep other open tabs, back/forward-cache pages and the device setting in sync.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) apply(e.newValue);
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) apply(stored() || deviceTheme()); });
  try {
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () { if (!stored()) apply(deviceTheme()); });
  } catch (e) {}

  window.NKTheme = { get: function () { return isDark() ? 'dark' : 'light'; }, set: set, toggle: function () { set(isDark() ? 'light' : 'dark'); } };
})();
