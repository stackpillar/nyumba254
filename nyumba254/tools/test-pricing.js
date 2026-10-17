// Run: node tools/test-pricing.js
const assert = require('assert');
const P = require('../nk-pricing.js');

const cfg = {
  sale_standard_pct: 1, rent_standard_pct: 2, standard_min_fee: 200, standard_max_fee: 5000, standard_fee_per_unit: 50,
  sale_featured_pct: 2, rent_featured_pct: 3, featured_min_fee: 400, featured_max_fee: 3000, featured_fee_per_unit: 150,
  featured_upgrade_min_fee: 300,
  listing_fee_multiplier_owner: 1, listing_fee_multiplier_caretaker: 0.7,
  listing_fee_multiplier_agent: 1.5, listing_fee_multiplier_company: 2,
};

// min / max clamp
assert.strictEqual(P.listingFee(cfg, { price: 1000, type: 'rent', role: 'owner' }), 200);
assert.strictEqual(P.listingFee(cfg, { price: 1e9, type: 'sale', role: 'owner' }), 5000);
// percentage inside the clamp
assert.strictEqual(P.listingFee(cfg, { price: 100000, type: 'rent', role: 'owner' }), 2000);
// per-unit
assert.strictEqual(P.listingFee(cfg, { price: 100000, type: 'rent', role: 'owner', units: 4 }), 2200);
// multiplier rounding
assert.strictEqual(P.listingFee(cfg, { price: 100000, type: 'rent', role: 'caretaker' }), 1400);
assert.strictEqual(P.listingFee(cfg, { price: 100001, type: 'rent', role: 'agent' }), Math.round(2000.02 * 1.5));
assert.strictEqual(P.listingFee(cfg, { price: 100000, type: 'rent', role: 'company' }), 4000);
// featured upgrade: credit and floor
const f = P.featuredCharge(cfg, { price: 100000, type: 'rent', role: 'owner', covered: true });
assert.deepStrictEqual([f.full, f.credit, f.charge], [3000, 2000, 1000]);
assert.strictEqual(P.featuredCharge(cfg, { price: 1000, type: 'rent', role: 'owner', trial: true }).credit, 0);
assert.strictEqual(P.featuredCharge(cfg, { price: 1000, type: 'rent', role: 'owner', covered: true }).charge, 300);
// yearly saving is computed
assert.strictEqual(P.yearlySavingPct(499, 4990), 17);
assert.strictEqual(P.yearlySavingPct(0, 4990), 0);
// role resolution: highest Elite monthly wins, ties by role order
const elite = { owner: 1199, caretaker: 699, agent: 2499, company: 6999 };
const pr = (r) => elite[r];
assert.strictEqual(P.resolvePricingRole(['owner', 'agent'], pr), 'agent');
assert.strictEqual(P.resolvePricingRole(['caretaker', 'company'], pr), 'company');
assert.strictEqual(P.resolvePricingRole(['owner', 'caretaker'], pr), 'owner');
assert.strictEqual(P.resolvePricingRole(['caretaker', 'owner'], () => 100), 'owner');
assert.strictEqual(P.resolvePricingRole([], pr), null);
// Airbnb and labels
assert.ok(P.canPostAirbnb('owner') && P.canPostAirbnb('company') && !P.canPostAirbnb('agent') && !P.canPostAirbnb('caretaker'));
assert.strictEqual(P.publicRoleLabel('owner', 'rent'), 'Landlord');
assert.strictEqual(P.publicRoleLabel('owner', 'sale'), 'Direct from owner');
console.log('nk-pricing: all tests passed');
