/* Nyumba254 pricing: the single client-side source for plan prices, listing fees and
   plan features. Amounts always come from platform_settings (via get_my_pricing /
   get_public_pricing). Nothing here hard-codes a price. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NKPricing = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const ROLE_ORDER = ['owner', 'caretaker', 'agent', 'company'];
  const ROLE_LABEL = { owner: 'Owner', caretaker: 'Caretaker', agent: 'Agent', company: 'Company', buyer: 'Buyer' };
  const state = { cfg: {}, mine: null, byRole: {}, warned: {} };

  function warnFallback(what) {
    if (state.warned[what]) return;
    state.warned[what] = true;
    try { console.warn('[nk-pricing] using fallback for ' + what + ' (setting missing or unreachable)'); } catch (e) { /* ignore */ }
  }

  const num = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  /* Raw platform_settings map: { key: value }. */
  async function loadSettings(db) {
    const { data, error } = await db.from('platform_settings').select('key,value');
    if (error) { warnFallback('platform_settings'); return state.cfg; }
    const cfg = {};
    (data || []).forEach((r) => { cfg[r.key] = r.value; });
    state.cfg = cfg;
    return cfg;
  }

  /* Pricing for the signed-in user. Resolves the pricing role server-side. */
  async function loadPricing(db) {
    const { data, error } = await db.rpc('get_my_pricing');
    if (error || !data) { warnFallback('get_my_pricing'); return null; }
    state.mine = data;
    return data;
  }

  async function loadPublicPricing(db, role) {
    if (state.byRole[role]) return state.byRole[role];
    const { data, error } = await db.rpc('get_public_pricing', { p_role: role });
    if (error || !data) { warnFallback('get_public_pricing:' + role); return null; }
    state.byRole[role] = data;
    return data;
  }

  /* Highest Elite monthly price wins; ties resolve by role order. */
  function resolvePricingRole(roles, priceOf) {
    const held = (roles || []).filter((r) => ROLE_ORDER.includes(r));
    if (!held.length) return null;
    const price = (r) => (typeof priceOf === 'function' ? num(priceOf(r)) : null) || 0;
    return held.slice().sort((a, b) => (price(b) - price(a)) || (ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b)))[0];
  }

  function planPrice(pricing, tier, period) {
    const p = pricing && pricing.plans && pricing.plans[tier];
    return p ? num(p[period]) : null;
  }

  /* Saving of paying yearly instead of 12 monthly payments, as a whole percent. Computed, never typed. */
  function yearlySavingPct(monthly, yearly) {
    const m = num(monthly), y = num(yearly);
    if (!m || !y || m <= 0) return 0;
    return Math.max(0, Math.round(100 * (1 - y / (m * 12))));
  }

  /* Standard or Featured listing fee: clamp(price * pct, min, max) + perUnit * units, scaled by role multiplier. */
  function listingFee(cfg, o) {
    cfg = cfg || {};
    const tier = o.plan === 'featured' ? 'featured' : 'standard';
    const kind = o.type === 'rent' ? 'rent' : 'sale';
    const price = Math.max(0, num(o.price) || 0);
    const units = Math.max(0, Math.floor(num(o.units) || 0));
    const pct = num(cfg[kind + '_' + tier + '_pct']);
    const min = num(cfg[tier + '_min_fee']);
    const max = num(cfg[tier + '_max_fee']);
    const per = num(cfg[tier + '_fee_per_unit']);
    if (pct === null || min === null || max === null) warnFallback('listing fee ' + kind + '/' + tier);
    const raw = price * (pct || 0) / 100;
    const clamped = Math.max(min || 0, Math.min(max === null || max === 0 ? Infinity : max, raw));
    const base = clamped + (per || 0) * units;
    const mult = num(o.multiplier) !== null ? num(o.multiplier) : (num(cfg['listing_fee_multiplier_' + o.role]) ?? 1);
    return Math.round(base * mult);
  }

  /* Credit toward a Featured upgrade: the Standard fee when covered by a plan or actually paid; none on trial. */
  function featuredCredit(cfg, o) {
    if (o.trial) return 0;
    if (o.covered) return listingFee(cfg, Object.assign({}, o, { plan: 'standard' }));
    return Math.max(0, num(o.paidStandardFee) || 0);
  }

  /* Featured is always an upgrade: Fee(featured) minus credit, never below the configured minimum. */
  function featuredCharge(cfg, o) {
    const credit = featuredCredit(cfg, o);
    const full = listingFee(cfg, Object.assign({}, o, { plan: 'featured' }));
    const floor = num((cfg || {}).featured_upgrade_min_fee) || 0;
    return { credit, full, charge: Math.max(floor, full - credit) };
  }

  function seats(pricing, tier) {
    return pricing && pricing.seats ? (num(pricing.seats[tier || 'elite']) || 0) : 0;
  }

  /* Plan feature lists. Allowances come from settings; prices never appear here. */
  const NK_PLAN_FEATURES = {
    premium: [
      () => 'Standard listing fees covered while you are subscribed',
      () => 'Featured listings at a discounted upgrade price',
      () => 'Priority placement in your Lister Page',
      () => 'Viewing terms builder',
    ],
    elite: [
      () => 'Everything in Premium',
      (c) => (num(c.elite_ai_listing_uses_monthly) ? num(c.elite_ai_listing_uses_monthly) + ' AI listing writer uses a month' : null),
      (c) => (num(c.elite_valuation_uses_monthly) ? num(c.elite_valuation_uses_monthly) + ' valuation checks a month' : null),
      (c, p) => (seats(p, 'elite') ? seats(p, 'elite') + ' team seat' + (seats(p, 'elite') === 1 ? '' : 's') : null),
      (c, p) => (p && p.bnb && p.bnb.allowed ? 'Holiday rental (BNB) listings included' : null),
    ],
  };

  function featureSet(tier, cfg, pricing) {
    return (NK_PLAN_FEATURES[tier] || []).map((f) => f(cfg || {}, pricing || null)).filter(Boolean);
  }

  const money = (n) => (n === null || n === undefined ? '-' : 'KES ' + Math.round(n).toLocaleString('en-KE'));

  /* "Owner + Agent" style label, and the public label from role plus purpose. */
  function rolesLabel(roles) {
    return (roles || []).map((r) => ROLE_LABEL[r] || r).join(' + ') || ROLE_LABEL.buyer;
  }
  function publicRoleLabel(role, purpose) {
    const rent = purpose === 'rent' || purpose === 'airbnb';
    if (role === 'owner') return rent ? 'Landlord' : 'Direct from owner';
    if (role === 'caretaker') return 'Caretaker';
    if (role === 'agent') return 'Agent';
    if (role === 'company') return 'Company';
    return ROLE_LABEL[role] || '';
  }
  const canPostAirbnb = (role) => role === 'owner' || role === 'company';

  return {
    ROLE_ORDER, ROLE_LABEL, NK_PLAN_FEATURES, state,
    loadSettings, loadPricing, loadPublicPricing, resolvePricingRole, planPrice, yearlySavingPct,
    listingFee, featuredCredit, featuredCharge, featureSet, seats, money, rolesLabel, publicRoleLabel, canPostAirbnb,
  };
});
