/* theme.js v2 — Nyumba254 shared theme controller.
   Loaded in <head> WITHOUT defer so the right theme is set before the first paint (no white flash).
   Uses the same localStorage key as saved.html ("nk_theme"), so every page stays in sync.
   Any element with a data-theme-toggle attribute toggles the whole site.

   v2 adds a VISIBILITY GUARD: in dark mode it measures the real contrast of every piece of text
   (and small icon) against the background it actually sits on. Anything below the readable threshold is
   recoloured, so a component missed by theme.css can never end up invisible. Turning the theme back to
   light restores every original colour. To switch the guard off, put
   <script>window.NK_THEME_AUTOFIX = false</script> before theme.js. */
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
  // Light is ALWAYS the default. The device / system theme is deliberately ignored:
  // a visitor only sees dark after pressing a toggle, and that choice is remembered.
  var DEFAULT_THEME = 'light';
  function isDark() { return root.getAttribute('data-theme') === 'dark'; }

  /* ═════════ Visibility guard ═════════ */
  var AUTOFIX = window.NK_THEME_AUTOFIX !== false;
  var XHTML = 'http://www.w3.org/1999/xhtml';
  var SKIP = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, HEAD: 1, META: 1, LINK: 1, TITLE: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1, IMG: 1, VIDEO: 1, CANVAS: 1, IFRAME: 1 };
  var LIGHT = [236, 239, 236], DARK = [26, 26, 24], ACC = [95, 211, 174], ACC2 = [143, 230, 200], BRAND = [15, 110, 86], BRAND_D = [8, 80, 65];
  var PAGE_BG = [15, 21, 18, 1];

  function parse(s) {
    var m = s && s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    var p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    if (p.length < 3 || isNaN(p[0] + p[1] + p[2])) return null;
    return [p[0], p[1], p[2], p.length > 3 && !isNaN(p[3]) ? p[3] : 1];
  }
  function chan(v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  function lum(c) { return 0.2126 * chan(c[0]) + 0.7152 * chan(c[1]) + 0.0722 * chan(c[2]); }
  function ratio(a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  function rgb(c) { return 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')'; }

  /* The colour actually behind an element: nearest (almost) opaque ancestor background.
     `false` = a gradient or photo is behind it, so the colour is unknown and the element is left alone. */
  function bgOf(el, cache) {
    if (cache.has(el)) return cache.get(el);
    var cs = getComputedStyle(el), col = parse(cs.backgroundColor), res;
    if (cs.backgroundImage !== 'none') res = false;
    else if (col && col[3] >= 0.85) res = col;
    else if (el.parentElement) res = bgOf(el.parentElement, cache);
    else res = PAGE_BG;
    cache.set(el, res);
    return res;
  }
  function hasText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    return false;
  }
  /* Pick a readable replacement, keeping the brand green when the original was green. */
  function pick(bg, fg) {
    var green = fg[1] > fg[0] + 15 && fg[1] >= fg[2];
    var lightBg = lum(bg) > 0.4;
    var opts = lightBg ? (green ? [BRAND, BRAND_D, DARK, LIGHT] : [DARK, LIGHT]) : (green ? [ACC, ACC2, LIGHT, DARK] : [LIGHT, DARK]);
    for (var i = 0; i < opts.length; i++) if (ratio(opts[i], bg) >= 4.5) return opts[i];
    return ratio(LIGHT, bg) >= ratio(DARK, bg) ? LIGHT : DARK;
  }
  function fixText(el, cache) {
    var cs = getComputedStyle(el);
    if (cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text') return;
    var fg = parse(cs.color), bg = bgOf(el, cache);
    if (!fg || !bg || fg[3] < 0.5 || ratio(fg, bg) >= 4) return;
    el.setAttribute('data-nk-c', el.style.getPropertyValue('color'));
    el.style.setProperty('color', rgb(pick(bg, fg)), 'important');
  }
  function fixSvg(el, cache) {
    if (el.getBoundingClientRect().width >= 40) return;              // big illustrations are decorative
    var cs = getComputedStyle(el), st = cs.stroke;
    if (!st || st === 'none') return;
    var c = parse(st), bg = bgOf(el, cache);
    if (!c || !bg || ratio(c, bg) >= 3) return;
    el.setAttribute('data-nk-s', el.style.getPropertyValue('stroke'));
    el.style.setProperty('stroke', rgb(pick(bg, c)), 'important');
  }
  function restoreAll() {
    var list = document.querySelectorAll('[data-nk-c],[data-nk-s]');
    for (var i = 0; i < list.length; i++) {
      var el = list[i], c = el.getAttribute('data-nk-c'), s = el.getAttribute('data-nk-s');
      if (c !== null) { if (c) el.style.setProperty('color', c); else el.style.removeProperty('color'); el.removeAttribute('data-nk-c'); }
      if (s !== null) { if (s) el.style.setProperty('stroke', s); else el.style.removeProperty('stroke'); el.removeAttribute('data-nk-s'); }
    }
  }
  function scan() {
    if (!AUTOFIX || !document.body || !isDark()) return;
    restoreAll();                                                    // re-measure natural colours, then re-apply
    var cache = new Map(), all = document.body.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (el.namespaceURI !== XHTML) { if (el.tagName === 'svg') fixSvg(el, cache); continue; }
      if (SKIP[el.tagName] || !hasText(el)) continue;
      fixText(el, cache);
    }
  }
  var scanTimer = null;
  function scheduleScan(delay) { clearTimeout(scanTimer); scanTimer = setTimeout(scan, delay == null ? 250 : delay); }

  /* ═════════ Theme state ═════════ */
  function paintButtons() {
    var dark = isDark();
    var btns = document.querySelectorAll('[data-theme-toggle]');
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      b.setAttribute('aria-pressed', String(dark));
      b.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
      b.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
      if (b.classList.contains('nk-theme-fab') || b.classList.contains('nk-theme-navbtn')) b.innerHTML = dark ? SUN : MOON;
    }
  }
  function apply(t) {
    root.setAttribute('data-theme', t);
    var m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', t === 'dark' ? '#0f1512' : '#0F6E56');
    paintButtons();
    if (t === 'dark') scheduleScan(0); else { clearTimeout(scanTimer); restoreAll(); }
  }
  function set(t) {
    try { localStorage.setItem(KEY, t); } catch (e) {}
    apply(t);
  }

  // 1. Apply immediately (before first paint): the saved choice, otherwise light.
  apply(stored() || DEFAULT_THEME);

  // 2. Any [data-theme-toggle] element, on any page, flips the theme.
  document.addEventListener('click', function (e) {
    var t = e.target && e.target.closest && e.target.closest('[data-theme-toggle]');
    if (t) set(isDark() ? 'light' : 'dark');
  });

  // 3. Insert a toggle if the page has none of its own.
  // Sits in the navbar, before the hamburger button, but is only ever VISIBLE at mobile
  // widths (see the media query in theme.css) — that's the version that worked well. On
  // desktop it stays hidden everywhere; the choice made on a phone is remembered site-wide
  // via localStorage, so desktop pages don't need their own visible switch.
  function insertToggle() {
    if (document.querySelector('[data-theme-toggle]') || document.getElementById('theme-btn')) return;
    var nav = document.querySelector('nav#main-nav') || document.querySelector('nav');
    var btn = document.createElement('button');
    btn.type = 'button'; btn.setAttribute('data-theme-toggle', '');
    if (nav) {
      btn.className = 'nk-theme-navbtn';
      var hamburger = nav.querySelector('.mobile-menu-btn');
      if (hamburger) nav.insertBefore(btn, hamburger); else nav.appendChild(btn);
    } else {
      btn.className = 'nk-theme-fab';
      document.body.appendChild(btn);
    }
  }
  document.addEventListener('DOMContentLoaded', function () {
    insertToggle();
    paintButtons();
    if (AUTOFIX && window.MutationObserver) {
      // re-check after content renders (listing cards, modals, chat) or a class flips; waits until activity settles
      new MutationObserver(function () { if (isDark()) scheduleScan(); })
        .observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    scheduleScan(0);
    setTimeout(function () { scheduleScan(0); }, 1500);
  });
  window.addEventListener('load', function () { scheduleScan(0); });

  // 4. Keep other open tabs and back/forward-cache pages in sync.
  window.addEventListener('storage', function (e) {
    if (e.key === KEY && (e.newValue === 'light' || e.newValue === 'dark')) apply(e.newValue);
  });
  window.addEventListener('pageshow', function (e) { if (e.persisted) apply(stored() || DEFAULT_THEME); });

  window.NKTheme = {
    get: function () { return isDark() ? 'dark' : 'light'; },
    set: set,
    toggle: function () { set(isDark() ? 'light' : 'dark'); },
    rescan: function () { scheduleScan(0); }
  };
})();