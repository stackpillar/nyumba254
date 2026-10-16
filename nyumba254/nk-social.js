/* Nyumba254 social links: shared renderer (storefront + dashboard preview) and dashboard editor.
   Links are self-declared and shown only on Lister Pages. The server is the authority on validation. */
(function () {
  'use strict';
  var I = function (p) { return '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + p + '</svg>'; };
  var P = [
    { k: 'instagram', label: 'Instagram', ph: '@yourname', hosts: ['instagram.com', 'www.instagram.com'], re: /^\/([A-Za-z0-9._]{1,30})\/?$/, fmt: function (h) { h = h.toLowerCase(); return { handle: '@' + h, url: 'https://www.instagram.com/' + h + '/' }; }, icon: I('<rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/>') },
    { k: 'facebook', label: 'Facebook', ph: 'yourpage or facebook.com/share/…', hosts: ['facebook.com', 'www.facebook.com', 'm.facebook.com'], re: /^\/([A-Za-z0-9.]{5,50})\/?$/, share: /^\/share\/([A-Za-z0-9_-]{4,60})\/?$/, fmt: function (h) { h = h.toLowerCase(); return { handle: h, url: 'https://www.facebook.com/' + h }; }, icon: I('<path d="M14 8h3V4h-3a4 4 0 0 0-4 4v3H7v4h3v6h4v-6h3l1-4h-4V8z"/>') },
    { k: 'tiktok', label: 'TikTok', ph: '@yourname', hosts: ['tiktok.com', 'www.tiktok.com'], re: /^\/@([A-Za-z0-9._]{2,24})\/?$/, fmt: function (h) { h = h.toLowerCase(); return { handle: '@' + h, url: 'https://www.tiktok.com/@' + h }; }, icon: I('<path d="M14 3v11.5a3.5 3.5 0 1 1-3.5-3.5"/><path d="M14 3c.4 2.6 2 4.2 5 4.5"/>') },
    { k: 'x', label: 'X', ph: '@yourname', hosts: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com', 'mobile.twitter.com'], re: /^\/([A-Za-z0-9_]{1,15})\/?$/, fmt: function (h) { h = h.toLowerCase(); return { handle: '@' + h, url: 'https://x.com/' + h }; }, icon: I('<path d="M4 4l16 16M20 4L4 20"/>') },
    { k: 'youtube', label: 'YouTube', ph: '@yourchannel', hosts: ['youtube.com', 'www.youtube.com', 'm.youtube.com'], re: /^\/@([A-Za-z0-9._-]{3,30})\/?$/, fmt: function (h) { return { handle: '@' + h, url: 'https://www.youtube.com/@' + h }; }, icon: I('<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10 9.5v5l4.5-2.5z"/>') },
    { k: 'linkedin', label: 'LinkedIn', ph: 'linkedin.com/in/yourname', hosts: ['linkedin.com', 'www.linkedin.com', 'ke.linkedin.com'], re: /^\/(in|company)\/([A-Za-z0-9-]{3,100})\/?$/, two: true, icon: I('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 11v5M8 8v.01M12 16v-5M12 13a2.5 2.5 0 0 1 5 0v3"/>') },
    { k: 'telegram', label: 'Telegram', ph: '@yourname', hosts: ['t.me', 'telegram.me', 'www.t.me'], re: /^\/([A-Za-z0-9_]{5,32})\/?$/, fmt: function (h) { h = h.toLowerCase(); return { handle: '@' + h, url: 'https://t.me/' + h }; }, icon: I('<path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l7-5"/>') },
    { k: 'snapchat', label: 'Snapchat', ph: '@yourname', hosts: ['snapchat.com', 'www.snapchat.com'], re: /^\/add\/([A-Za-z0-9._-]{3,15})\/?$/, fmt: function (h) { h = h.toLowerCase(); return { handle: '@' + h, url: 'https://www.snapchat.com/add/' + h }; }, icon: I('<path d="M12 3c-3 0-5 2-5 5v3l-3 2 3 1c0 2-1 3-2 4 3 0 4 1 7 3 3-2 4-3 7-3-1-1-2-2-2-4l3-1-3-2V8c0-3-2-5-5-5z"/>') },
    { k: 'threads', label: 'Threads', ph: '@yourname', hosts: ['threads.net', 'www.threads.net', 'threads.com', 'www.threads.com'], re: /^\/@([A-Za-z0-9._]{1,30})\/?$/, fmt: function (h) { h = h.toLowerCase(); return { handle: '@' + h, url: 'https://www.threads.net/@' + h }; }, icon: I('<path d="M17 9a5 5 0 1 0-1 7c1-1.5 1-4-2-4.5-3-.5-5 1-4.5 3 .5 1.700 3.500 2 5 .5"/><path d="M8 8c1-1.500 5-2 7 1"/>') },
    { k: 'whatsapp_channel', label: 'WhatsApp Channel', ph: 'whatsapp.com/channel/…', hosts: ['whatsapp.com', 'www.whatsapp.com'], re: /^\/channel\/([A-Za-z0-9]{10,40})\/?$/, fmt: function (h) { return { handle: 'channel/' + h, url: 'https://www.whatsapp.com/channel/' + h }; }, icon: I('<path d="M4 20l1.200-4A8 8 0 1 1 8.200 19z"/><path d="M9 9c0 3 3 6 6 6"/>') },
    { k: 'website', label: 'Website', ph: 'https://yourwebsite.co.ke', icon: I('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>') }
  ];
  var BY = {}; P.forEach(function (p) { BY[p.k] = p; });

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeHttps(u) { return typeof u === 'string' && /^https:\/\//i.test(u); }

  var CSS = '.nks-row{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}' +
    '.nks-link{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 14px;border:1px solid var(--border,#d7dbe0);border-radius:999px;color:var(--text,inherit);background:var(--surface,transparent);text-decoration:none;font-size:13px;font-weight:600}' +
    '.nks-link:hover{border-color:var(--green,#1a7a4a)}' +
    '.nks-link:focus-visible,.nks-ed button:focus-visible,.nks-ed input:focus-visible{outline:3px solid var(--green,#1a7a4a);outline-offset:2px}' +
    '.nks-note{font-size:12px;color:var(--text-3,#667);margin:6px 0 0;line-height:1.5}' +
    '.nks-ed-row{display:grid;grid-template-columns:150px 1fr auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid var(--border,#e3e6ea)}' +
    '.nks-ed-lab{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600}' +
    '.nks-ed-ctl{display:flex;gap:6px;align-items:center;flex-wrap:wrap}' +
    '.nks-ed button{min-height:44px;min-width:44px;padding:0 10px;border:1px solid var(--border,#d7dbe0);border-radius:8px;background:var(--surface,transparent);color:inherit;cursor:pointer;font-size:13px}' +
    '.nks-ed button[disabled]{opacity:.45;cursor:not-allowed}' +
    '.nks-ed input[type=text]{min-height:44px;width:100%;box-sizing:border-box}' +
    '.nks-ed label.nks-vis{display:flex;align-items:center;gap:6px;font-size:12px;min-height:44px}' +
    '.nks-err{grid-column:1/-1;font-size:12px;color:var(--red,#b3261e)}' +
    '.nks-hint{grid-column:1/-1;font-size:12px;color:var(--text-3,#667)}' +
    '@media(max-width:640px){.nks-ed-row{grid-template-columns:1fr}}';
  function css() {
    if (document.getElementById('nks-css')) return;
    var s = document.createElement('style'); s.id = 'nks-css'; s.textContent = CSS; document.head.appendChild(s);
  }

  function renderRow(links, o) {
    o = o || {};
    var out = [];
    (links || []).forEach(function (l) {
      var p = BY[l && l.platform]; if (!p || !safeHttps(l.url)) return;
      var shown = l.handle || p.label;
      out.push('<a class="nks-link" href="' + esc(l.url) + '" target="_blank" rel="noopener noreferrer nofollow ugc" data-nks-platform="' + esc(l.platform) + '" aria-label="' + esc(p.label + ': ' + shown + ' (opens in a new tab)') + '" title="' + esc(p.label + ': ' + shown) + '">' + p.icon + '<span>' + esc(p.label) + '</span></a>');
    });
    if (!out.length) return '';
    return '<div class="nks-row" role="list" aria-label="Social links">' + out.map(function (x) { return x.replace('<a ', '<a role="listitem" '); }).join('') + '</div>';
  }

  // Client-side helper only; the server re-validates everything.
  function extract(platform, raw) {
    var p = BY[platform], v = String(raw || '').trim();
    if (!p || !v) return null;
    if (platform === 'website') {
      if (!/^https?:\/\//i.test(v) && !/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
      try { var w = new URL(v); if (w.protocol !== 'https:') return null; return { handle: w.hostname, url: w.href }; } catch (e) { return null; }
    }
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v) && /^(www\.)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}\//i.test(v)) v = 'https://' + v;
    if (/^https?:\/\//i.test(v)) {
      var u; try { u = new URL(v); } catch (e) { return null; }
      if (p.hosts.indexOf(u.hostname.toLowerCase()) < 0) return null;
      var m;
      if (p.share && (m = u.pathname.match(p.share))) return { handle: 'share/' + m[1], url: 'https://www.facebook.com/share/' + m[1] + '/' };
      m = u.pathname.match(p.re); if (!m) return null;
      if (p.two) { var h2 = m[1].toLowerCase() + '/' + m[2].toLowerCase(); return { handle: h2, url: 'https://www.linkedin.com/' + h2 }; }
      return p.fmt(m[1]);
    }
    v = v.replace(/^@/, '');
    if (p.two) { var m2 = v.match(/^(in|company)\/([A-Za-z0-9-]{3,100})$/i); if (!m2) return null; var h3 = m2[1].toLowerCase() + '/' + m2[2].toLowerCase(); return { handle: h3, url: 'https://www.linkedin.com/' + h3 }; }
    var mm = ('/' + (p.k === 'tiktok' || p.k === 'threads' || p.k === 'youtube' ? '@' : p.k === 'snapchat' ? 'add/' : p.k === 'whatsapp_channel' ? 'channel/' : '') + v).match(p.re);
    return mm ? p.fmt(mm[1]) : null;
  }

  function mountEditor(host, o) {
    css();
    var db = o.db, items = [], saving = false, totals = {};
    host.classList.add('nks-ed');
    function byKey(k) { for (var i = 0; i < items.length; i++) if (items[i].platform === k) return items[i]; return null; }
    function filled() { return items.filter(function (x) { return x.value.trim(); }); }
    function previewLinks() {
      return filled().filter(function (x) { return x.is_visible && !x.hidden; }).map(function (x) {
        var e = extract(x.platform, x.value); return e ? { platform: x.platform, handle: e.handle, url: e.url } : null;
      }).filter(Boolean);
    }
    function draw() {
      var n = filled().length;
      var rows = items.map(function (it, i) {
        var p = BY[it.platform], has = !!it.value.trim(), ex = has ? extract(it.platform, it.value) : null;
        var disabledAdd = !has && n >= 8;
        return '<div class="nks-ed-row" data-p="' + it.platform + '">' +
          '<div class="nks-ed-lab">' + p.icon + '<span>' + esc(p.label) + '</span></div>' +
          '<input type="text" inputmode="url" autocomplete="off" spellcheck="false" maxlength="2048" aria-label="' + esc(p.label + ' handle or link') + '" placeholder="' + esc(p.ph) + '" value="' + esc(it.value) + '"' + (disabledAdd ? ' disabled' : '') + '/>' +
          '<div class="nks-ed-ctl">' +
          '<label class="nks-vis"><input type="checkbox" data-vis ' + (it.is_visible ? 'checked' : '') + (has ? '' : ' disabled') + '/> Show</label>' +
          '<button type="button" data-up aria-label="Move ' + esc(p.label) + ' up"' + (i === 0 ? ' disabled' : '') + '>↑</button>' +
          '<button type="button" data-down aria-label="Move ' + esc(p.label) + ' down"' + (i === items.length - 1 ? ' disabled' : '') + '>↓</button>' +
          '<button type="button" data-test' + (ex ? '' : ' disabled') + '>Test link</button></div>' +
          (it.hidden ? '<div class="nks-err">Hidden by Nyumba254 review' + (it.hidden_reason ? ': ' + esc(it.hidden_reason) : '') + '. It is not shown on your page.</div>' : '') +
          (it.error ? '<div class="nks-err" role="alert">' + esc(it.error) + '</div>' : '') +
          (has && ex ? '<div class="nks-hint">Will link to ' + esc(ex.url) + (totals[it.platform] ? ' · ' + totals[it.platform] + ' clicks this month' : '') + '</div>' : '') +
          (has && !ex && !it.error ? '<div class="nks-hint">Check this handle or link. The server will confirm when you save.</div>' : '') +
          '</div>';
      }).join('');
      var pv = renderRow(previewLinks());
      host.innerHTML = '<p class="nks-note" style="margin:0 0 8px">These links appear only on your Lister Page. They are self-declared. Nyumba254 does not verify social accounts.</p>' + rows +
        '<div style="margin-top:14px"><div style="font-size:13px;font-weight:600">How it looks on your page</div>' + (pv || '<p class="nks-note">Add a link to see the preview.</p>') + '</div>' +
        '<button type="button" class="btn btn-outline btn-sm" data-save style="margin-top:8px"' + (saving ? ' disabled' : '') + '>' + (saving ? 'Saving…' : 'Save social links') + '</button>' +
        '<div class="nks-note" data-status aria-live="polite"></div>';
    }
    function status(t, bad) { var s = host.querySelector('[data-status]'); if (s) { s.textContent = t; s.style.color = bad ? 'var(--red,#b3261e)' : ''; } }
    host.addEventListener('input', function (e) {
      var row = e.target.closest('.nks-ed-row'); if (!row || e.target.type !== 'text') return;
      var it = byKey(row.dataset.p); it.value = e.target.value; it.error = '';
    });
    host.addEventListener('change', function (e) {
      var row = e.target.closest('.nks-ed-row'); if (!row) return;
      var it = byKey(row.dataset.p);
      if (e.target.type === 'text') { var ex = extract(it.platform, e.target.value); if (ex && /[\/:]/.test(e.target.value)) it.value = ex.handle; }
      if (e.target.matches('[data-vis]')) it.is_visible = e.target.checked;
      draw();
    });
    host.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      var row = b.closest('.nks-ed-row'), i;
      if (b.matches('[data-save]')) return save();
      if (!row) return;
      i = items.indexOf(byKey(row.dataset.p));
      if (b.matches('[data-up]') && i > 0) { var t = items[i]; items[i] = items[i - 1]; items[i - 1] = t; draw(); host.querySelector('[data-p="' + t.platform + '"] [data-up]') && host.querySelector('[data-p="' + t.platform + '"] [data-up]').focus(); }
      if (b.matches('[data-down]') && i < items.length - 1) { var t2 = items[i]; items[i] = items[i + 1]; items[i + 1] = t2; draw(); var nb = host.querySelector('[data-p="' + t2.platform + '"] [data-down]'); if (nb) nb.focus(); }
      if (b.matches('[data-test]')) { var ex = extract(items[i].platform, items[i].value); if (ex) window.open(ex.url, '_blank', 'noopener,noreferrer'); }
    });
    function save() {
      if (saving) return;
      var list = filled().map(function (x) { return { platform: x.platform, handle: x.value.trim(), is_visible: x.is_visible }; });
      items.forEach(function (x) { x.error = ''; });
      saving = true; draw();
      db.rpc('set_lister_social_links', { links: list }).then(function (r) {
        saving = false;
        if (r.error) {
          var msg = r.error.message || 'Could not save social links.';
          var hit = items.filter(function (x) { return msg.toLowerCase().indexOf(BY[x.platform].label.toLowerCase()) === 0; })[0];
          if (hit) hit.error = msg;
          draw(); status(hit ? '' : msg, true);
          if (o.toast) o.toast(msg, 'error');
          return;
        }
        load(r.data); draw(); status('Social links saved.');
        if (o.toast) o.toast('Social links saved.', 'success');
      }, function () { saving = false; draw(); status('Could not save social links. Try again.', true); });
    }
    function load(saved) {
      var order = [], map = {};
      (saved || []).forEach(function (l) { order.push(l.platform); map[l.platform] = l; });
      P.forEach(function (p) { if (order.indexOf(p.k) < 0) order.push(p.k); });
      items = order.map(function (k) { var l = map[k]; return { platform: k, value: l ? l.handle : '', is_visible: l ? l.is_visible !== false : true, hidden: l ? !!l.hidden_by_admin : false, hidden_reason: l ? l.hidden_reason : '', error: '' }; });
    }
    return db.rpc('get_my_social_links').then(function (r) {
      if (r.error) { host.hidden = true; return false; }
      load(r.data); draw();
      db.rpc('get_my_social_click_totals').then(function (c) { if (!c.error) { (c.data || []).forEach(function (x) { totals[x.platform] = x.clicks; }); draw(); } }, function () {});
      return true;
    }, function () { host.hidden = true; return false; });
  }

  window.NKSocial = { platforms: P, renderRow: renderRow, extract: extract, mountEditor: mountEditor, css: css };
})();
