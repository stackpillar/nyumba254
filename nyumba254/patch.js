/* patch.js: makes post-listing obey the admin "listing payment" setting.
 * Load AFTER the main inline script on post-listing.html:
 *   <script src="/patch.js"></script>
 *
 * When payment is OFF it:
 *   - hides the fee estimate box, the plan/payment banner and the "pay from your dashboard" line
 *   - replaces the "first listing is free for N days" kicker with neutral text
 *   - stops sending payment_status 'trial'/'unpaid' and trial_expires_at with the new listing
 * When payment is ON, nothing changes.
 */
(function () {
  'use strict';

  /* ---- CONFIG: set these to match your admin setting ---- */
  // Key in the platform_settings table. The first key found is used.
  var SETTING_KEYS = ['listing_payment_enabled', 'payments_enabled', 'enable_listing_payment', 'listing_payments_enabled', 'require_listing_payment'];
  // payment_status stored on new listings while payment is off.
  // Must be a value your listings.payment_status column accepts (change if you use e.g. 'free' or 'paid').
  var OFF_PAYMENT_STATUS = 'not_required';
  var NEUTRAL_KICKER = 'Getting started takes just a few minutes';

  var OFF_VALUES = ['0', 'false', 'off', 'no', 'disabled', 'null', ''];
  var off = false;      // true = payment turned off
  var known = false;    // true once the setting has been read

  /* ---- CSS: hide payment UI immediately, reveal only if payment turns out to be ON ---- */
  var st = document.createElement('style');
  st.textContent =
    'body:not(.pay-on) #fee-box,body:not(.pay-on) #plan-banner{display:none!important}' +
    'body:not(.pay-on) #s-pay.pay-text{display:none!important}';
  document.head.appendChild(st);

  var PAY_RE = /listing fee|free for|no cost|dashboard to pay|pay the listing|bnb plan|billed|charged|payment|pay for this one/i;

  function $(id) { return document.getElementById(id); }

  function sanitize() {
    if (!known || !off) return;
    var k = $('page-kicker');
    if (k && PAY_RE.test(k.textContent) && k.textContent !== NEUTRAL_KICKER) k.textContent = NEUTRAL_KICKER;
    var p = $('s-pay');
    if (p) p.classList.toggle('pay-text', PAY_RE.test(p.textContent)); // keeps the guest "didn't get the email" hint
    var b = $('plan-banner'); if (b) b.hidden = true;
    var f = $('fee-box'); if (f && f.innerHTML) f.innerHTML = '';
  }

  function watch(id) {
    var el = $(id);
    if (!el) return;
    new MutationObserver(sanitize).observe(el, { childList: true, characterData: true, subtree: true, attributes: true });
  }

  /* ---- Read the admin setting ---- */
  var ready = (async function () {
    try {
      var res = await db.from('platform_settings').select('key,value').in('key', SETTING_KEYS);
      var rows = (res && res.data) || [];
      var row = null;
      for (var i = 0; i < SETTING_KEYS.length && !row; i++) {
        row = rows.find(function (r) { return r.key === SETTING_KEYS[i]; });
      }
      if (row) {
        off = OFF_VALUES.indexOf(String(row.value).trim().toLowerCase()) !== -1;
      } else {
        console.warn('[patch.js] No payment setting found in platform_settings. Check SETTING_KEYS. Leaving payment UI as is.');
      }
    } catch (e) {
      console.warn('[patch.js] Could not read payment setting', e);
    }
    known = true;
    document.body.classList.toggle('pay-on', !off);
    sanitize();
  })();

  ['page-kicker', 'plan-banner', 'fee-box', 's-pay'].forEach(watch);

  /* ---- Payload: signed-in sellers (direct insert into listings) ---- */
  function cleanRow(row) {
    if (!off || !row || typeof row !== 'object' || Array.isArray(row)) return row;
    var c = Object.assign({}, row);
    if ('payment_status' in c) c.payment_status = OFF_PAYMENT_STATUS;
    if ('trial_expires_at' in c) c.trial_expires_at = null;
    return c;
  }
  if (window.db && typeof db.from === 'function') {
    var origFrom = db.from.bind(db);
    db.from = function (table) {
      var q = origFrom(table);
      if (table === 'listings' && q && typeof q.insert === 'function') {
        var origInsert = q.insert.bind(q);
        q.insert = function (row) {
          var rest = Array.prototype.slice.call(arguments, 1);
          return origInsert.apply(null, [cleanRow(row)].concat(rest));
        };
      }
      return q;
    };
  }

  /* ---- Payload: guests (FormData sent to guest-listing-submit) ---- */
  var origFetch = window.fetch.bind(window);
  window.fetch = async function (input, init) {
    try {
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      if (url.indexOf('/guest-listing-submit') !== -1 && init && init.body instanceof FormData && init.body.has('payload')) {
        await ready;
        if (off) {
          var obj = JSON.parse(init.body.get('payload'));
          init.body.set('payload', JSON.stringify(cleanRow(obj)));
        }
      }
    } catch (e) { console.warn('[patch.js] payload patch skipped', e); }
    return origFetch(input, init);
  };
})();
