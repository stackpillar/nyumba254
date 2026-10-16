/* Nyumba254 Activity Centre (shared by dashboard, profile and the admin user drawer).
   NKActivity.mount(el, { db, role, buyer, source })
     db     Supabase client
     role   'seller' | 'buyer' (used in the export filename)
     buyer  true limits categories to the buyer set
     source optional { page(params), count(params) } override (admin read-only view; disables export)
   All text from the database is escaped. Time zone is Africa/Nairobi (EAT, +03:00). */
(function () {
  'use strict';

  var CATS = [
    { k: 'account', label: 'Account and sign-in', icon: '🔐' },
    { k: 'role', label: 'Role and verification', icon: '🛡️' },
    { k: 'listings', label: 'Listings', icon: '🏠' },
    { k: 'fees', label: 'Viewing fees and policy', icon: '🏷️' },
    { k: 'enquiries', label: 'Enquiries and messages', icon: '💬' },
    { k: 'viewings', label: 'Viewings', icon: '📅' },
    { k: 'reviews', label: 'Reviews and reports', icon: '⭐' },
    { k: 'payments', label: 'Payments and plans', icon: '💳' },
    { k: 'lister_page', label: 'Lister Page', icon: '🔗' },
    { k: 'rent', label: 'Rent and BNB', icon: '🏢' },
    { k: 'team', label: 'Team', icon: '👥' },
    { k: 'saved', label: 'Saved and searches', icon: '❤️' },
    { k: 'data', label: 'Data and privacy', icon: '📁' }
  ];
  var BUYER_KEYS = ['account', 'role', 'viewings', 'reviews', 'saved', 'enquiries', 'data'];
  var SENSITIVE = ['payments', 'account'];
  var JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
  var JSPDF_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var JSZIP_SRI = 'sha512-XMVd28F1oH/O71fzwBnV7HucLxVwtxf26XV8P4wPk26EDxuGZ91N8bsOttmnomcCD3CS5ZMRL50H0GgOHvegtg==';
  var TZ = 'Africa/Nairobi';

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function catOf(k) { return CATS.filter(function (c) { return c.k === k; })[0] || { k: k, label: k, icon: '•' }; }

  var dayFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, day: '2-digit', month: '2-digit', year: 'numeric' });
  var timeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
  function fmtDay(iso) { return dayFmt.format(new Date(iso)); }
  function fmtTime(iso) { return timeFmt.format(new Date(iso)) + ' EAT'; }
  function isoEat(iso) { return new Date(new Date(iso).getTime() + 3 * 3600 * 1000).toISOString().slice(0, 19) + '+03:00'; }
  function ymd(d) { return new Date(d.getTime() + 3 * 3600 * 1000).toISOString().slice(0, 10).replace(/-/g, ''); }

  /* Spreadsheet formula injection guard: a leading = + - @ tab or CR becomes text. */
  function csvCell(v) {
    var s = v == null ? '' : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  var CSV_HEAD = ['timestamp', 'category', 'action', 'item', 'details', 'status', 'amount_kes', 'reference'];
  function rowToCsv(r) {
    var m = r.meta || {};
    var extra = Object.keys(m).filter(function (k) { return ['status', 'amount_kes', 'reference'].indexOf(k) < 0 && m[k] != null && m[k] !== ''; })
      .map(function (k) { return k + ': ' + m[k]; }).join('; ');
    return [isoEat(r.created_at), r.category, r.action, r.summary, extra, m.status || '',
      m.amount_kes != null ? Number(m.amount_kes) : (m.new_fee != null ? Number(m.new_fee) : ''), m.reference || ''].map(csvCell).join(',');
  }
  function toCsv(rows) { return '\ufeff' + CSV_HEAD.join(',') + '\r\n' + rows.map(rowToCsv).join('\r\n') + '\r\n'; }

  function loadScript(url, test, integrity) {
    if (test()) return Promise.resolve();
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = url; if (integrity) s.integrity = integrity; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.onload = function () { test() ? res() : rej(new Error('Library did not initialise')); };
      s.onerror = function () { rej(new Error('Could not load a required library. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
  }

  function injectStyle() {
    if (document.getElementById('nk-activity-style')) return;
    var s = document.createElement('style'); s.id = 'nk-activity-style';
    s.textContent =
      '.nka{font:14px/1.5 Inter,system-ui,sans-serif;color:var(--text,#1a1a1a)}' +
      '.nka-bar{position:sticky;top:var(--topbar-h,0);z-index:5;background:var(--surface,var(--white,#fff));padding:10px 0;border-bottom:1px solid var(--border,#ddd);margin-bottom:12px}' +
      '.nka-chips,.nka-dates{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}' +
      '.nka-chip{min-height:44px;padding:0 12px;border:1.5px solid var(--border,#ccc);border-radius:999px;background:var(--white,#fff);color:var(--text,#1a1a1a);font:600 12.5px Inter,system-ui,sans-serif;cursor:pointer}' +
      '.nka-chip[aria-pressed="true"]{background:var(--green,#0F6E56);border-color:var(--green,#0F6E56);color:#fff}' +
      '.nka-chip:focus-visible,.nka-btn:focus-visible,.nka input:focus-visible,.nka select:focus-visible{outline:3px solid #BA7517;outline-offset:2px}' +
      '.nka-chip small{opacity:.8;margin-left:4px}' +
      '.nka-row2{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.nka input[type=search],.nka input[type=date],.nka select{min-height:44px;padding:0 10px;border:1.5px solid var(--border,#ccc);border-radius:10px;background:var(--white,#fff);color:var(--text,#1a1a1a);font:13px Inter,system-ui,sans-serif}' +
      '.nka input[type=search]{flex:1;min-width:160px}' +
      '.nka-btn{min-height:44px;padding:0 16px;border-radius:10px;border:1.5px solid var(--green,#0F6E56);background:transparent;color:var(--green,#0F6E56);font:600 13px Inter,system-ui,sans-serif;cursor:pointer}' +
      '.nka-btn.p{background:var(--green,#0F6E56);color:#fff}.nka-btn[disabled]{opacity:.55;cursor:not-allowed}' +
      '.nka-day{font-weight:700;font-size:12.5px;color:var(--text-2,#444);margin:16px 0 6px}' +
      '.nka-item{display:flex;gap:12px;padding:10px 12px;border:1px solid var(--border,#ddd);border-radius:12px;background:var(--white,#fff);margin-bottom:6px;align-items:flex-start}' +
      '.nka-ic{flex:none;width:34px;height:34px;border-radius:50%;background:var(--green-light,#E1F5EE);display:flex;align-items:center;justify-content:center;font-size:16px}' +
      '.nka-main{flex:1;min-width:0}.nka-sum{font-size:13.5px;word-break:break-word}' +
      '.nka-meta{font-size:11.5px;color:var(--text-3,#666);margin-top:2px}' +
      '.nka-tag{display:inline-block;font-size:10.5px;border:1px solid var(--border,#ccc);border-radius:6px;padding:0 5px;margin-left:6px;color:var(--text-3,#666)}' +
      '.nka-empty{padding:36px 12px;text-align:center;color:var(--text-3,#666);font-size:13px}' +
      '.nka-err{padding:12px;border:1px solid #C53030;border-radius:10px;color:#C53030;font-size:13px;margin:8px 0}' +
      '.nka-note{font-size:12px;color:var(--text-3,#666);margin:8px 0}' +
      '.nka-modal{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px}' +
      '.nka-card{background:var(--white,#fff);color:var(--text,#1a1a1a);border-radius:16px;max-width:520px;width:100%;max-height:92vh;overflow:auto;padding:20px}' +
      '.nka-card h3{margin:0 0 10px;font-size:17px}.nka-card label{display:flex;gap:10px;align-items:center;min-height:44px;font-size:13.5px}' +
      '.nka-card input[type=checkbox]{width:20px;height:20px}' +
      '.nka-prog{height:8px;background:var(--border,#ddd);border-radius:6px;overflow:hidden;margin:10px 0}.nka-prog>i{display:block;height:100%;width:0;background:var(--green,#0F6E56);transition:width .2s}' +
      '@media (prefers-reduced-motion:reduce){.nka-prog>i{transition:none}}';
    document.head.appendChild(s);
  }

  function mount(el, opts) {
    injectStyle();
    var o = opts || {};
    var db = o.db;
    var cats = (o.buyer ? CATS.filter(function (c) { return BUYER_KEYS.indexOf(c.k) >= 0; }) : CATS);
    var readOnly = !!o.source;
    var st = { sel: [], preset: 'all', from: null, to: null, q: '', rows: [], cursor: null, done: false, loading: false, counts: {} };

    var source = o.source || {
      page: function (p) {
        return db.rpc('get_my_activity', { p_categories: p.categories, p_from: p.from, p_to: p.to, p_limit: p.limit || 100, p_cursor: p.cursor });
      },
      count: function (p) {
        return db.rpc('count_my_activity', { p_categories: p.categories, p_from: p.from, p_to: p.to });
      }
    };

    el.classList.add('nka');
    el.innerHTML =
      '<div class="nka-bar">' +
      '<div class="nka-chips" role="group" aria-label="Filter by category"></div>' +
      '<div class="nka-dates" role="group" aria-label="Date range"></div>' +
      '<div class="nka-row2"><input type="search" class="nka-q" placeholder="Search this list…" aria-label="Search activity"/>' +
      (readOnly ? '' : '<button type="button" class="nka-btn p nka-dl">Download report</button>') + '</div></div>' +
      '<div class="nka-body" aria-live="polite"></div>' +
      '<div class="nka-more" style="text-align:center;margin:14px 0"></div>' +
      '<p class="nka-note">Dates and times are East Africa Time. Rows marked “earlier record” were rebuilt from older account data. Message text, other people’s contact details, passwords and internal notes are never shown here.</p>';

    var chipsEl = el.querySelector('.nka-chips'), datesEl = el.querySelector('.nka-dates'),
      bodyEl = el.querySelector('.nka-body'), moreEl = el.querySelector('.nka-more');

    var PRESETS = [['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', '12 months'], ['all', 'All time'], ['custom', 'Custom']];

    function range() {
      if (st.preset === 'custom') {
        return { from: st.from ? new Date(st.from + 'T00:00:00+03:00').toISOString() : null, to: st.to ? new Date(st.to + 'T23:59:59+03:00').toISOString() : null };
      }
      if (st.preset === 'all') return { from: null, to: null };
      return { from: new Date(Date.now() - Number(st.preset) * 86400000).toISOString(), to: null };
    }
    function activeCats() { return st.sel.length ? st.sel : cats.map(function (c) { return c.k; }); }

    function drawChips() {
      chipsEl.innerHTML = cats.map(function (c) {
        var n = st.counts[c.k];
        return '<button type="button" class="nka-chip" data-cat="' + esc(c.k) + '" aria-pressed="' + (st.sel.indexOf(c.k) >= 0) + '"><span aria-hidden="true">' + c.icon + '</span> ' + esc(c.label) + (n != null ? '<small>' + n + '</small>' : '') + '</button>';
      }).join('');
      datesEl.innerHTML = PRESETS.map(function (p) {
        return '<button type="button" class="nka-chip" data-preset="' + p[0] + '" aria-pressed="' + (st.preset === p[0]) + '">' + p[1] + '</button>';
      }).join('') + (st.preset === 'custom'
        ? '<label>From <input type="date" class="nka-from" value="' + esc(st.from || '') + '"/></label><label>To <input type="date" class="nka-to" value="' + esc(st.to || '') + '"/></label>' : '');
    }

    function visibleRows() {
      var q = st.q.trim().toLowerCase();
      return q ? st.rows.filter(function (r) { return (r.summary || '').toLowerCase().indexOf(q) >= 0; }) : st.rows;
    }
    function drawRows() {
      var rows = visibleRows();
      if (!rows.length) {
        bodyEl.innerHTML = '<div class="nka-empty">' + (st.loading ? 'Loading…' : st.rows.length ? 'Nothing matches your search.' : 'No activity found for these filters.') + '</div>';
      } else {
        var out = '', day = '';
        rows.forEach(function (r) {
          var d = fmtDay(r.created_at);
          if (d !== day) { day = d; out += '<div class="nka-day">' + esc(d) + '</div>'; }
          var c = catOf(r.category);
          out += '<div class="nka-item"><div class="nka-ic" aria-hidden="true">' + c.icon + '</div><div class="nka-main"><div class="nka-sum">' + esc(r.summary) + '</div><div class="nka-meta">' + esc(c.label) + ' · ' + esc(fmtTime(r.created_at)) + (r.source === 'derived' ? '<span class="nka-tag">earlier record</span>' : '') + '</div></div></div>';
        });
        bodyEl.innerHTML = out;
      }
      moreEl.innerHTML = st.done || !st.rows.length ? '' : '<button type="button" class="nka-btn nka-load"' + (st.loading ? ' disabled' : '') + '>' + (st.loading ? 'Loading…' : 'Load more') + '</button>';
    }

    function load(reset) {
      if (st.loading) return;
      if (reset) { st.rows = []; st.cursor = null; st.done = false; }
      st.loading = true; drawRows();
      var r = range();
      Promise.resolve(source.page({ categories: activeCats(), from: r.from, to: r.to, limit: 100, cursor: st.cursor })).then(function (res) {
        st.loading = false;
        if (res.error) { throw res.error; }
        var data = res.data || [];
        st.rows = st.rows.concat(data);
        st.done = data.length < 100;
        var last = data[data.length - 1];
        st.cursor = last ? { ts: last.created_at, id: last.id } : st.cursor;
        drawRows();
      }).catch(function (e) {
        st.loading = false;
        console.error('[activity] load failed:', e);
        bodyEl.innerHTML = '<div class="nka-err" role="alert">We could not load your activity. ' + esc(e && e.message ? e.message : '') + '</div>';
        moreEl.innerHTML = '<button type="button" class="nka-btn nka-retry">Try again</button>';
      });
    }

    function loadCounts() {
      var r = range();
      Promise.resolve(source.count({ categories: cats.map(function (c) { return c.k; }), from: r.from, to: r.to })).then(function (res) {
        if (res.error) throw res.error;
        st.counts = {}; (res.data || []).forEach(function (x) { st.counts[x.category] = Number(x.n); });
        cats.forEach(function (c) { if (st.counts[c.k] == null) st.counts[c.k] = 0; });
        drawChips();
      }).catch(function (e) { console.info('[activity] counts unavailable', e); });
    }
    function refresh() { drawChips(); load(true); loadCounts(); }

    el.addEventListener('click', function (e) {
      var t = e.target.closest('button'); if (!t || !el.contains(t)) return;
      if (t.dataset.cat) {
        var i = st.sel.indexOf(t.dataset.cat);
        if (i >= 0) st.sel.splice(i, 1); else st.sel.push(t.dataset.cat);
        drawChips(); load(true);
      } else if (t.dataset.preset) {
        st.preset = t.dataset.preset; drawChips();
        if (st.preset !== 'custom') { load(true); loadCounts(); }
      } else if (t.classList.contains('nka-load')) load(false);
      else if (t.classList.contains('nka-retry')) load(true);
      else if (t.classList.contains('nka-dl')) openDownload();
    });
    el.addEventListener('change', function (e) {
      if (e.target.classList.contains('nka-from')) { st.from = e.target.value || null; load(true); loadCounts(); }
      if (e.target.classList.contains('nka-to')) { st.to = e.target.value || null; load(true); loadCounts(); }
    });
    el.querySelector('.nka-q').addEventListener('input', function (e) { st.q = e.target.value; drawRows(); });

    /* ---------- Download ---------- */
    function openDownload() {
      var r0 = range();
      var m = document.createElement('div'); m.className = 'nka-modal';
      m.innerHTML = '<div class="nka-card" role="dialog" aria-modal="true" aria-labelledby="nka-dt">' +
        '<h3 id="nka-dt">Download activity report</h3>' +
        '<p class="nka-note" style="margin-top:0">An activity report is a readable history you can keep or print. It is different from your account backup, which is a copy you can restore.</p>' +
        '<div><button type="button" class="nka-btn" data-all="1">Select all</button> <button type="button" class="nka-btn" data-all="0">Select none</button></div>' +
        cats.map(function (c) { return '<label><input type="checkbox" class="nka-cat" value="' + esc(c.k) + '" checked/> <span aria-hidden="true">' + c.icon + '</span> ' + esc(c.label) + '</label>'; }).join('') +
        '<div class="nka-row2" style="margin-top:8px"><label>From <input type="date" id="nka-f" value="' + esc(r0.from ? r0.from.slice(0, 10) : '') + '"/></label><label>To <input type="date" id="nka-t" value="' + esc(r0.to ? r0.to.slice(0, 10) : '') + '"/></label></div>' +
        '<label style="margin-top:6px">Format <select id="nka-fmt"><option value="zip">ZIP of CSV files (recommended)</option><option value="csv">One combined CSV</option><option value="pdf">PDF summary</option><option value="json">JSON</option></select></label>' +
        '<p class="nka-note" id="nka-est" aria-live="polite">Estimating…</p>' +
        '<div class="nka-prog" hidden><i></i></div><p class="nka-note" id="nka-msg" role="status" aria-live="polite"></p>' +
        '<div id="nka-reauth" hidden><label style="display:block">Confirm your password to include sensitive categories<input type="password" id="nka-pw" autocomplete="current-password" style="width:100%;min-height:44px;margin-top:6px"/></label></div>' +
        '<div class="nka-row2" style="margin-top:10px"><button type="button" class="nka-btn p" id="nka-go">Generate</button><button type="button" class="nka-btn" id="nka-cancel">Close</button></div></div>';
      document.body.appendChild(m);
      var cancelled = false, running = false;
      var $ = function (s) { return m.querySelector(s); };
      function selected() { return [].slice.call(m.querySelectorAll('.nka-cat:checked')).map(function (x) { return x.value; }); }
      function rng() {
        var f = $('#nka-f').value, t = $('#nka-t').value;
        return { from: f ? new Date(f + 'T00:00:00+03:00').toISOString() : null, to: t ? new Date(t + 'T23:59:59+03:00').toISOString() : null };
      }
      function estimate() {
        var s = selected(), r = rng();
        if (!s.length) { $('#nka-est').textContent = 'Choose at least one category.'; $('#nka-go').disabled = true; return; }
        $('#nka-go').disabled = false;
        Promise.resolve(source.count({ categories: s, from: r.from, to: r.to })).then(function (res) {
          if (res.error) throw res.error;
          var n = (res.data || []).reduce(function (a, x) { return a + Number(x.n); }, 0);
          $('#nka-est').textContent = 'About ' + n.toLocaleString('en-KE') + ' rows will be included.';
        }).catch(function () { $('#nka-est').textContent = 'Could not estimate the size, but you can still generate the report.'; });
      }
      function close() { cancelled = true; m.remove(); }
      m.addEventListener('click', function (e) {
        if (e.target === m) { if (!running) close(); return; }
        var b = e.target.closest('button'); if (!b) return;
        if (b.dataset.all) { m.querySelectorAll('.nka-cat').forEach(function (x) { x.checked = b.dataset.all === '1'; }); estimate(); }
        if (b.id === 'nka-cancel') { close(); }
        if (b.id === 'nka-go') { if (running) { cancelled = true; $('#nka-msg').textContent = 'Cancelling…'; } else go(); }
      });
      m.addEventListener('change', estimate);
      m.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !running) close(); });
      estimate(); $('#nka-go').focus();

      function setProg(p, msg) { $('.nka-prog').hidden = false; $('.nka-prog > i').style.width = Math.round(p * 100) + '%'; if (msg) $('#nka-msg').textContent = msg; }

      function fetchAll(s, r) {
        var all = [], cursor = null;
        function step() {
          if (cancelled) return Promise.reject(new Error('Cancelled'));
          return Promise.resolve(source.page({ categories: s, from: r.from, to: r.to, limit: 500, cursor: cursor })).then(function (res) {
            if (res.error) throw res.error;
            var d = res.data || [];
            all = all.concat(d);
            setProg(Math.min(0.85, all.length / 5000), 'Collected ' + all.length.toLocaleString('en-KE') + ' rows…');
            if (d.length < 500 || all.length >= 200000) return all;
            var last = d[d.length - 1]; cursor = { ts: last.created_at, id: last.id };
            return step();
          });
        }
        return step();
      }

      function download(blob, name) {
        var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 10000);
      }

      function build(fmt, rows, s, r, fname) {
        var byCat = {}; rows.forEach(function (x) { (byCat[x.category] = byCat[x.category] || []).push(x); });
        if (fmt === 'csv') { download(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }), fname + '.csv'); return Promise.resolve(); }
        if (fmt === 'json') {
          var clean = rows.map(function (x) { return { timestamp: isoEat(x.created_at), category: x.category, action: x.action, summary: x.summary, details: x.meta || {}, source: x.source }; });
          download(new Blob([JSON.stringify({ generated_at: isoEat(new Date().toISOString()), time_zone: TZ, rows: clean }, null, 2)], { type: 'application/json' }), fname + '.json');
          return Promise.resolve();
        }
        if (fmt === 'pdf') {
          return loadScript(JSPDF_URL, function () { return !!(window.jspdf && window.jspdf.jsPDF); }).then(function () {
            var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' }), y = 50;
            doc.setFontSize(16); doc.text('Nyumba254 activity report', 40, y); y += 20;
            doc.setFontSize(9); doc.text('Generated ' + isoEat(new Date().toISOString()) + ' · East Africa Time', 40, y); y += 22;
            doc.setFontSize(11); doc.text('Summary', 40, y); y += 16; doc.setFontSize(9);
            s.forEach(function (k) { doc.text(catOf(k).label + ': ' + (byCat[k] ? byCat[k].length : 0), 50, y); y += 13; });
            y += 8; doc.setFontSize(11); doc.text('Activity (most recent first, up to 400 rows)', 40, y); y += 16; doc.setFontSize(8);
            rows.slice(0, 400).forEach(function (x) {
              if (y > 800) { doc.addPage(); y = 50; }
              var line = fmtDay(x.created_at) + ' ' + fmtTime(x.created_at) + '  ' + String(x.summary || '');
              doc.splitTextToSize(line, 510).slice(0, 2).forEach(function (t) { doc.text(t, 40, y); y += 11; });
            });
            if (rows.length > 400) { doc.text('Download the ZIP or CSV for the full list (' + rows.length + ' rows).', 40, y + 6); }
            doc.save(fname + '.pdf');
          });
        }
        return loadScript(JSZIP_URL, function () { return !!window.JSZip; }, JSZIP_SRI).then(function () {
          var zip = new window.JSZip(), counts = ['category,rows'];
          s.forEach(function (k) {
            var list = byCat[k] || []; counts.push(csvCell(catOf(k).label) + ',' + list.length);
            if (!list.length) return;
            if (list.length <= 50000) { zip.file(k + '.csv', toCsv(list)); return; }
            var months = {}; list.forEach(function (x) { var mo = isoEat(x.created_at).slice(0, 7); (months[mo] = months[mo] || []).push(x); });
            Object.keys(months).forEach(function (mo) { zip.file(k + '-' + mo + '.csv', toCsv(months[mo])); });
          });
          zip.file('summary.csv', '\ufeff' + counts.join('\r\n') + '\r\n');
          zip.file('README.txt', [
            'Nyumba254 activity report', 'Generated: ' + isoEat(new Date().toISOString()),
            'Time zone: Africa/Nairobi (+03:00)', 'Range: ' + (r.from ? isoEat(r.from) : 'start') + ' to ' + (r.to ? isoEat(r.to) : 'now'),
            '', 'Columns: timestamp, category, action, item, details, status, amount_kes (KES, plain number), reference (M-Pesa references masked to the last 4 characters).',
            'Cells that start with = + - @ are prefixed with a single quote so spreadsheets treat them as text.',
            '', 'Intentionally excluded: message text, other people\'s phone numbers and emails, passwords and tokens, internal admin notes, risk signals, report reviewer identities, IP addresses and uploaded file contents.',
            'Rows marked source=derived were rebuilt from older account records.', '',
            'Backup = a copy you can restore. Activity report = a readable history you can keep or print.'
          ].join('\r\n'));
          return zip.generateAsync({ type: 'blob' }).then(function (b) { download(b, fname + '.zip'); });
        });
      }

      function go() {
        var s = selected(), r = rng(), fmt = $('#nka-fmt').value;
        running = true; cancelled = false; $('#nka-go').textContent = 'Cancel'; $('#nka-cancel').disabled = true;
        setProg(0.02, 'Checking your request…');
        var pw = $('#nka-pw').value;
        var pre = pw ? db.auth.getUser().then(function (u) {
          var email = u.data && u.data.user && u.data.user.email;
          return db.auth.signInWithPassword({ email: email, password: pw });
        }).then(function (res) { if (res.error) throw new Error('That password was not correct.'); }) : Promise.resolve();
        var exportId;
        pre.then(function () {
          return db.rpc('begin_activity_export', { p_categories: s, p_from: r.from, p_to: r.to, p_format: fmt });
        }).then(function (res) {
          if (res.error) throw res.error;
          exportId = res.data && res.data.export_id;
          return fetchAll(s, r);
        }).then(function (rows) {
          setProg(0.92, 'Building your file…');
          var role = o.role || 'user';
          var d1 = r.from ? new Date(r.from) : (rows.length ? new Date(rows[rows.length - 1].created_at) : new Date());
          var d2 = r.to ? new Date(r.to) : new Date();
          return build(fmt, rows, s, r, 'nyumba254-activity-' + role + '-' + ymd(d1) + '-' + ymd(d2)).then(function () {
            if (exportId) db.rpc('finish_activity_export', { p_id: exportId, p_rows: rows.length }).then(function () {}, function () {});
            setProg(1, 'Done. Your file has been downloaded (' + rows.length.toLocaleString('en-KE') + ' rows).');
          });
        }).catch(function (e) {
          var msg = e && e.message ? e.message : 'Something went wrong.';
          if (msg.indexOf('REAUTH_REQUIRED') >= 0) {
            $('#nka-reauth').hidden = false; $('#nka-pw').focus();
            msg = 'For your security, please enter your password to include Payments or Account categories, then press Generate again.';
          }
          $('#nka-msg').textContent = msg;
        }).then(function () {
          running = false; $('#nka-go').textContent = 'Generate'; $('#nka-cancel').disabled = false;
        });
      }
    }

    refresh();
    return { reload: refresh };
  }

  window.NKActivity = { mount: mount, CATS: CATS, csvCell: csvCell };
})();
