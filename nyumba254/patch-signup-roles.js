#!/usr/bin/env node
/*
 * Nyumba254 - SIGN-UP ROLE STEPS (login page)
 *
 *   node patch-signup-roles.js              apply (run in the folder that has your login file)
 *   node patch-signup-roles.js myfile       apply to a differently named file
 *   node patch-signup-roles.js --revert     undo
 *
 * What it does (NO database change, NO new tables)
 *   Create account now runs in steps inside the same card:
 *     Step 1  name, email, password, consent  (button: Continue)
 *     Step 2  "How will you use Nyumba254?"  - tap-to-select cards with icons
 *             Tenant/Buyer, Property owner, Caretaker, Agent, Company
 *     Step 3  (everyone except Tenant/Buyer) a few details for that role
 *             Company: company name, type, registration no. (optional), phone
 *             Agent: agency name (optional), phone
 *             Owner: phone      Caretaker: property looked after (optional), phone
 *   Tenant/Buyer skips step 3 and the account is created straight away.
 *   The choice is sent with sign-up as account metadata:
 *     account_type, phone, company_name, company_type, company_registration,
 *     agency_name, managed_property
 *   Google sign-in is untouched: those users choose later in the dashboard.
 *
 * Safe: nothing is written unless every edit matches exactly once and the page script compiles.
 * Backup: <file>.bak-signuprole
 */
'use strict';
const fs = require('fs'), vm = require('vm');
const args = process.argv.slice(2);
const REVERT = args.includes('--revert');
const given = args.find(a => !a.startsWith('--'));
const MARK = 'NK-SIGNUPROLE', BAK = '.bak-signuprole';
const die = m => { console.error('\n[ERROR] ' + m + '\n'); process.exit(1); };
const isFile = f => fs.existsSync(f) && fs.statSync(f).isFile();
const FILE = given || ['login', 'login.html', 'signin', 'signin.html'].find(isFile);
if (!FILE || !isFile(FILE)) die('Could not find the login file. Run this in its folder, or pass the file name:  node patch-signup-roles.js <file>');

if (REVERT) {
  if (!isFile(FILE + BAK)) die('No backup (' + FILE + BAK + ') found, nothing to undo.');
  fs.copyFileSync(FILE + BAK, FILE); fs.unlinkSync(FILE + BAK);
  console.log('Restored ' + FILE + ' from backup.'); process.exit(0);
}

let raw = fs.readFileSync(FILE, 'utf8');
if (raw.includes(MARK)) {
  /* an earlier run of this patch is in the file: start again from its backup so the new version replaces it */
  if (!isFile(FILE + BAK)) die(FILE + ' already has this patch but ' + FILE + BAK + ' is missing, so it cannot be replaced safely. Send me the file.');
  const orig = fs.readFileSync(FILE + BAK, 'utf8');
  if (orig.includes(MARK)) die(FILE + BAK + ' is itself patched. Restore your original login file first.');
  raw = orig;
  console.log('Earlier version found: replacing it with this one (from ' + FILE + BAK + ').');
}
if (!raw.includes('id="panel-register"') || !raw.includes('async function doRegister()')) die(FILE + ' does not look like the login page (no register panel / doRegister).');
const crlf = /\r\n/.test(raw);
let out = raw.replace(/\r\n/g, '\n');
const log = [];
function many(label, find, rep, n) {
  const c = out.split(find).length - 1;
  if (c !== n) { log.push({ label, ok: false, why: c ? 'found ' + c + 'x, expected ' + n : 'NOT FOUND' }); return; }
  out = out.split(find).join(rep); log.push({ label, ok: true });
}
const once = (label, find, rep) => many(label, find, rep, 1);

/* ------------------------------------------------------------------ CSS */
const CSS = String.raw`
    /* ${'NK-SIGNUPROLE'} : multi-step sign-up */
    .reg-steps{display:none;align-items:center;gap:12px;margin-bottom:16px}
    .reg-steps.show{display:flex}
    .reg-steps-label{font-size:12px;font-weight:600;color:var(--text-3);white-space:nowrap}
    .reg-dots{flex:1;display:flex;gap:6px}
    .reg-dot{flex:1;height:4px;border-radius:2px;background:var(--border);transition:background .25s}
    .reg-dot.done{background:var(--green-mid)}
    .reg-dot.now{background:var(--green)}
    .reg-pane{display:none}
    .reg-pane.show{display:block;animation:regIn .28s ease both}
    @keyframes regIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
    .rc-grid{display:grid;gap:10px}
    .rc{position:relative;display:flex;align-items:center;gap:14px;padding:14px 16px;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);cursor:pointer;transition:border-color .15s,background .15s,box-shadow .15s,transform .15s}
    .rc:hover{border-color:var(--green-mid);transform:translateY(-1px)}
    .rc input{position:absolute;opacity:0;pointer-events:none}
    .rc:focus-within{outline:2px solid var(--green-mid);outline-offset:2px}
    .rc-ic{width:44px;height:44px;border-radius:12px;background:var(--green-light);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s}
    .rc-ic svg{width:22px;height:22px;stroke:var(--green);fill:none;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
    .rc-tx{flex:1;min-width:0}
    .rc-tx strong{display:block;font-size:14.5px;font-weight:600;color:var(--text)}
    .rc-tx>span{display:block;font-size:12.5px;color:var(--text-3);line-height:1.45;margin-top:1px}
    .rc-tick{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
    .rc-tick svg{width:12px;height:12px;stroke:#fff;fill:none;stroke-width:3;opacity:0}
    .rc.sel{border-color:var(--green);background:var(--green-light);box-shadow:0 0 0 3px rgba(15,110,86,.08)}
    .rc.sel .rc-ic{background:var(--green)}
    .rc.sel .rc-ic svg{stroke:#fff}
    .rc.sel .rc-tick{background:var(--green);border-color:var(--green)}
    .rc.sel .rc-tick svg{opacity:1}
    .reg-actions{display:flex;gap:10px;margin-top:18px}
    .reg-actions .btn-submit{flex:1;width:auto}
    .btn-back{flex:0 0 auto;padding:13px 18px;background:var(--white);color:var(--text-2);border:1.5px solid var(--border);border-radius:var(--radius);font-size:14px;font-weight:600;transition:background .15s,border-color .15s}
    .btn-back:hover{background:var(--surface);border-color:#c9c7bf}
    .input-wrap select{width:100%;padding:11px 14px 11px 40px;border:1.5px solid var(--border);border-radius:var(--radius);font-family:inherit;font-size:14px;color:var(--text);background:var(--white);outline:none;appearance:none;-webkit-appearance:none;transition:border-color .15s,box-shadow .15s}
    .input-wrap select:focus{border-color:var(--green);box-shadow:0 0 0 3px rgba(15,110,86,0.08)}
    .reg-hint{font-size:12px;color:var(--text-3);margin-top:5px;line-height:1.5}
    @media (prefers-reduced-motion:reduce){.reg-pane.show{animation:none}.rc{transition:none}}
`;

/* ----------------------------------------------------------------- HTML */
const ICON = {
  buyer: '<circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  owner: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  caretaker: '<path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>',
  agent: '<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  company: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01"/>'
};
const card = (v, t, d) => '            <label class="rc"><input type="radio" name="reg-role" value="' + v + '"/><span class="rc-ic"><svg viewBox="0 0 24 24">' + ICON[v] + '</svg></span><span class="rc-tx"><strong>' + t + '</strong><span>' + d + '</span></span><span class="rc-tick"><svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg></span></label>\n';
const USER_SVG = '<svg class="icon" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';
const BLDG_SVG = '<svg class="icon" viewBox="0 0 24 24"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/></svg>';
const PHONE_SVG = '<svg class="icon" viewBox="0 0 24 24"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/></svg>';
const field = (forRoles, label, opt, id, type, ph, extra, err) =>
  '          <div class="form-group" data-for="' + forRoles + '">\n' +
  '            <label class="field-label" for="' + id + '">' + label + (opt ? ' <span class="opt">optional</span>' : '') + '</label>\n' +
  '            <div class="input-wrap">' + (type === 'tel' ? PHONE_SVG : type === 'co' ? BLDG_SVG : USER_SVG) +
  '<input type="' + (type === 'tel' ? 'tel' : 'text') + '" id="' + id + '" placeholder="' + ph + '" maxlength="' + (type === 'tel' ? '16' : '160') + '" ' + extra + '/></div>\n' +
  (err ? '            <div class="field-error" id="err-' + id + '" aria-live="polite">' + err + '</div>\n' : '') +
  '          </div>\n';

const PANES =
  '<!-- ' + MARK + ' -->\n' +
  '        <div class="reg-pane" id="reg-step-role">\n' +
  '          <div class="rc-grid" id="reg-role-grid" role="radiogroup" aria-label="Account type">\n' +
  card('buyer', 'Tenant / Buyer', 'Browse, save, and contact property listers') +
  card('owner', 'Property owner', 'List rental or sale property') +
  card('caretaker', 'Caretaker', 'Manage property on an owner\'s behalf') +
  card('agent', 'Agent', 'Connect people with properties') +
  card('company', 'Company', 'Represent an agency, developer, or property manager') +
  '          </div>\n' +
  '          <div class="field-error" id="err-reg-role" aria-live="polite" style="margin-top:10px">Please pick one to continue</div>\n' +
  '          <p class="reg-hint" style="margin-top:12px">You can change this later in your account settings.</p>\n' +
  '          <div class="reg-actions">\n' +
  '            <button type="button" class="btn-back" onclick="regGo(1)">Back</button>\n' +
  '            <button type="button" class="btn-submit" id="btn-reg-next" onclick="regRoleNext()"><div class="spinner"></div><span class="btn-text">Next &rarr;</span></button>\n' +
  '          </div>\n' +
  '        </div>\n' +
  '        <form class="reg-pane" id="reg-step-details" novalidate onsubmit="event.preventDefault(); regDetailsNext(); return false;">\n' +
  field('company', 'Company name', false, 'reg-company-name', 'co', 'e.g. Lakeview Realty Ltd', 'autocomplete="organization"', 'Please enter your company name') +
  '          <div class="form-group" data-for="company">\n' +
  '            <label class="field-label" for="reg-company-type">Company type</label>\n' +
  '            <div class="input-wrap">' + BLDG_SVG + '<select id="reg-company-type"><option value="agency">Agency</option><option value="developer">Developer</option><option value="property_manager">Property manager</option></select></div>\n' +
  '          </div>\n' +
  field('company', 'Registration number', true, 'reg-company-reg', 'co', 'Business registration no.', '') +
  field('agent', 'Agency or business name', true, 'reg-agency', 'co', 'e.g. Lakeview Realty', 'autocomplete="organization"') +
  field('caretaker', 'Property you look after', true, 'reg-managed', 'co', 'Building name or area', '') +
  field('owner,caretaker,agent,company', 'Phone number', false, 'reg-phone', 'tel', '07XX XXX XXX', 'autocomplete="tel" inputmode="tel" oninput="formatPhone(this)"', 'Enter a valid Kenyan phone number') +
  '          <p class="reg-hint" style="margin-top:-6px">Used so buyers and tenants can reach you. You can hide it from buyers in Settings.</p>\n' +
  '          <div class="reg-actions">\n' +
  '            <button type="button" class="btn-back" onclick="regGo(2)">Back</button>\n' +
  '            <button type="submit" class="btn-submit" id="btn-reg-final"><div class="spinner"></div><span class="btn-text">Create account</span></button>\n' +
  '          </div>\n' +
  '        </form>\n\n        ';

/* ------------------------------------------------------------------- JS */
const JS = String.raw`/*NK-SIGNUPROLE*/
  // ── Multi-step sign-up: step 1 details -> step 2 role -> step 3 role details ──
  const regState = { step: 1, role: '', phone: '' };
  const REG_DETAIL_ROLES = ['company', 'agent', 'caretaker', 'owner'];  /* roles that get a step 3 */
  const REG_COPY = {
    1: { t: 'Create your account', s: 'Free to join. Start listing in under 10 minutes.' },
    2: { t: 'How will you use Nyumba254?', s: 'Pick the option that fits you best. You can change it later in account settings.' },
    company:   { t: 'Tell us about your company', s: 'These details appear on your public profile while Company is your account type.' },
    agent:     { t: 'A few details about you', s: 'Help people recognise and reach you.' },
    owner:     { t: 'A few details about you', s: 'So interested tenants and buyers can reach you.' },
    caretaker: { t: 'A few details about you', s: 'So interested tenants and buyers can reach you.' }
  };
  function regTotal() { return regState.role && REG_DETAIL_ROLES.indexOf(regState.role) < 0 ? 2 : 3; }
  function regRenderSteps() {
    const el = document.getElementById('reg-steps'); if (!el) return;
    let h = '<span class="reg-steps-label">Step ' + regState.step + ' of ' + regTotal() + '</span><span class="reg-dots">';
    for (let i = 1; i <= regTotal(); i++) h += '<i class="reg-dot' + (i < regState.step ? ' done' : i === regState.step ? ' now' : '') + '"></i>';
    el.innerHTML = h + '</span>'; el.classList.add('show');
  }
  function regHideAll() {
    ['reg-step-role', 'reg-step-details'].forEach(id => document.getElementById(id)?.classList.remove('show'));
    document.getElementById('reg-steps')?.classList.remove('show');
  }
  function regConfigureDetails() {
    const r = regState.role;
    document.querySelectorAll('#reg-step-details [data-for]').forEach(g => {
      g.style.display = g.getAttribute('data-for').split(',').indexOf(r) > -1 ? '' : 'none';
    });
  }
  function regGo(n) {
    regState.step = n;
    clearAllErrors();
    const form = document.getElementById('register-form');
    form.style.display = n === 1 ? '' : 'none';
    document.getElementById('reg-step-role').classList.toggle('show', n === 2);
    document.getElementById('reg-step-details').classList.toggle('show', n === 3);
    const g = document.getElementById('google-slot-register'); if (g) g.style.display = n === 1 ? '' : 'none';
    if (n === 3) regConfigureDetails();
    const c = n === 3 ? (REG_COPY[regState.role] || REG_COPY[2]) : REG_COPY[n];
    document.getElementById('register-title').textContent = c.t;
    const sub = document.getElementById('register-sub'); if (sub) sub.textContent = c.s;
    regRenderSteps();
    document.getElementById('register-title').focus({ preventScroll: true });
  }
  function regStep1Next() {
    clearAllErrors(); clearConsentError();
    const first = document.getElementById('reg-firstname').value.trim();
    const last = document.getElementById('reg-lastname').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pw = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;
    const consent = document.getElementById('reg-consent').checked;
    let ok = true;
    if (!first) { fieldError('reg-firstname', 'err-firstname', true); ok = false; }
    if (!last) { fieldError('reg-lastname', 'err-lastname', true); ok = false; }
    if (!isEmail(email)) { fieldError('reg-email', 'err-reg-email', true); ok = false; }
    if (pw.length < 8) { fieldError('reg-password', 'err-reg-pw', true); ok = false; }
    if (confirm !== pw) { fieldError('reg-confirm', 'err-reg-confirm', true); ok = false; }
    if (!consent) {
      document.getElementById('consent-box').classList.add('error');
      document.getElementById('err-consent').classList.add('show');
      ok = false;
    }
    if (!ok) return;
    regGo(2);
  }
  function regSyncCards() {
    document.querySelectorAll('#reg-role-grid .rc').forEach(c => c.classList.toggle('sel', !!c.querySelector('input').checked));
    const t = document.querySelector('#btn-reg-next .btn-text');
    if (t) t.innerHTML = REG_DETAIL_ROLES.indexOf(regState.role) < 0 && regState.role ? 'Create account' : 'Next &rarr;';
  }
  document.getElementById('reg-role-grid').addEventListener('change', function (e) {
    if (!e.target || e.target.name !== 'reg-role') return;
    regState.role = e.target.value;
    document.getElementById('err-reg-role').classList.remove('show');
    regSyncCards(); regRenderSteps();
  });
  function regRoleNext() {
    if (!regState.role) { document.getElementById('err-reg-role').classList.add('show'); return; }
    if (REG_DETAIL_ROLES.indexOf(regState.role) < 0) { doRegister(); return; }
    regGo(3);
  }
  function regDetailsNext() {
    clearAllErrors();
    let ok = true;
    if (regState.role === 'company' && document.getElementById('reg-company-name').value.trim().length < 2) { fieldError('reg-company-name', 'err-reg-company-name', true); ok = false; }
    if (!okPhone(document.getElementById('reg-phone').value)) { fieldError('reg-phone', 'err-reg-phone', true); ok = false; }
    if (!ok) return;
    doRegister();
  }
  function regMetaExtra() {
    const r = regState.role, m = { account_type: r };
    const g = id => { const e = document.getElementById(id); return e ? e.value.trim() : ''; };
    if (REG_DETAIL_ROLES.indexOf(r) > -1) {
      const ph = nkNormalizePhone(g('reg-phone'));
      if (/^\+254\d{9}$/.test(ph)) { m.phone = ph; regState.phone = ph; }
    }
    if (r === 'company') {
      m.company_name = g('reg-company-name'); m.company_type = g('reg-company-type') || 'agency';
      if (g('reg-company-reg')) m.company_registration = g('reg-company-reg');
    }
    if (r === 'agent' && g('reg-agency')) m.agency_name = g('reg-agency');
    if (r === 'caretaker' && g('reg-managed')) m.managed_property = g('reg-managed');
    return m;
  }
  function regBusy(on) {
    ['btn-register', 'btn-reg-next', 'btn-reg-final'].forEach(id => { if (document.getElementById(id)) setLoading(id, on); });
    document.querySelectorAll('#reg-step-role .btn-back, #reg-step-details .btn-back').forEach(b => { b.disabled = on; });
  }

  `;

/* --------------------------------------------------------------- edits */
once('styles', '</style>', CSS + '  </style>');
once('step indicator above the title',
  '<h1 class="auth-title" id="register-title" tabindex="-1">Create your account</h1>',
  '<div class="reg-steps" id="reg-steps" aria-live="polite"></div>\n        <h1 class="auth-title" id="register-title" tabindex="-1">Create your account</h1>');
once('give the subtitle an id', '<p class="auth-sub">Free to join. Start listing in under 10 minutes.</p>', '<p class="auth-sub" id="register-sub">Free to join. Start listing in under 10 minutes.</p>');
once('remove old "choose after verifying" note',
  '<p class="role-choice-note">After you verify your email, choose one account type to personalize Nyumba254. You can change it later in account settings.</p>', '');
once('step 1 submit goes to the role step',
  '<form id="register-form" novalidate onsubmit="event.preventDefault(); doRegister(); return false;">',
  '<form id="register-form" novalidate onsubmit="event.preventDefault(); regStep1Next(); return false;">');
once('step 1 button text', '<span class="btn-text">Create account — it\'s free</span>', '<span class="btn-text">Continue &rarr;</span>');
once('role + details steps', '<!-- Register success -->', PANES + '<!-- Register success -->');
once('success text', 'Check your email to verify your address. Once verified, sign in and choose the account type that best describes how you use Nyumba254.', 'Check your email to verify your address, then sign in to get started.');
once('step logic', 'async function doRegister() {', JS + 'async function doRegister() {');
once('require a role before signing up', 'if (needNet("You\'re offline. Connect to the internet to create your account.")) return;',
  'if (!regState.role) { regGo(2); return; }\n    if (needNet("You\'re offline. Connect to the internet to create your account.")) return;');
once('send the role with sign-up', 'data: { full_name: `${first} ${last}` },', 'data: Object.assign({ full_name: `${first} ${last}` }, regMetaExtra()),');
many('spinner on the active button (start)', "setLoading('btn-register', true);", 'regBusy(true);', 1);
many('spinner on the active button (end)', "setLoading('btn-register', false);", 'regBusy(false);', 2);
once('hide the steps on success', "document.getElementById('register-form').style.display = 'none';", "document.getElementById('register-form').style.display = 'none'; regHideAll();");
once('save phone in profile', 'id: data.user.id,', 'id: data.user.id,\n          ...(regState.phone ? { phone: regState.phone } : {}),');
once('admin notification phone', "sellerPhone: '',", "sellerPhone: regState.phone || '',");

let bad = false;
console.log('File: ' + FILE);
log.forEach(l => { console.log('  [' + (l.ok ? 'ok' : 'FAIL') + '] ' + l.label + (l.ok ? '' : ' -> ' + l.why)); if (!l.ok) bad = true; });
if (bad) die('Some edits did not match, so NOTHING was changed. Send me the exact [FAIL] lines above.');
const scripts = [...out.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(s => s.includes(MARK));
if (!scripts.length) die('Internal error: patched script not found.');
scripts.forEach(s => { try { new vm.Script(s); } catch (e) { die('Patched page script has a syntax error (' + e.message + '), so NOTHING was changed.'); } });
if (!isFile(FILE + BAK)) fs.copyFileSync(FILE, FILE + BAK);
fs.writeFileSync(FILE, crlf ? out.replace(/\n/g, '\r\n') : out, 'utf8');
console.log('\nDone. Backup: ' + FILE + BAK);
console.log('Next: push to GitHub and hard refresh. Undo any time with:  node patch-signup-roles.js --revert');
