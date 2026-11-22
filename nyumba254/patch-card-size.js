#!/usr/bin/env node
/*
 * Nyumba254 - one standard listing card size
 *
 * Usage (run inside your website folder, next to index.html and nk-cards.css):
 *   node patch-card-size.js              apply the patch
 *   node patch-card-size.js C:\path\to\site   apply to another folder
 *   node patch-card-size.js --revert     restore the backups
 *
 * What it does
 *   1. Appends one clearly marked CSS block to nk-cards.css (safe to run twice).
 *   2. Bumps the nk-cards.css version string in every top-level .html file so
 *      browsers and Cloudflare stop serving the old cached CSS.
 *   3. Saves a .bak-cardsize copy of every file before touching it.
 *
 * The standard (taken from the Home "Latest listings" card):
 *   - 2 cards per row on phones, same width in Featured / Recently viewed
 *   - 4:3 photo on every card, every page
 *   - same gap everywhere (10px phone, 16px desktop)
 *   - card height follows its content, equal height inside a row
 *   - title always reserves 2 lines, spec row never wraps
 */
'use strict';

const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const REVERT = args.includes('--revert');
const DIR = path.resolve(args.find(a => !a.startsWith('--')) || '.');

const BAK = '.bak-cardsize';
const START = '/* nk-card-size:v1 start */';
const END = '/* nk-card-size:v1 end */';
const CACHE_VER = '3-cardsize';

const log = m => console.log(m);
const fail = m => { console.error('\n[ERROR] ' + m + '\n'); process.exit(1); };

/* ---------- CSS ---------- */

// Compact phone styling that Latest already has (index.html scopes it to #latest-listings).
// Featured and Recently viewed now use the same narrow card, so they get the same rules.
function compactRules(scopes) {
  const rules = [
    ['.badge-featured', 'top:7px;left:7px;font-size:9.5px;padding:3px 8px'],
    ['.badge-new', 'top:7px;left:7px;font-size:9.5px;padding:3px 8px'],
    ['.badge-cat', 'left:7px;bottom:7px;font-size:9.5px;padding:3px 8px'],
    ['.card-body', 'padding:9px 10px 10px'],
    ['.card-area', 'font-size:10px;margin-bottom:2px'],
    ['.card-area::before', 'display:none'],
    ['.card-title', 'font-size:13px'],
    ['.card-sub', 'display:none'],
    ['.card-role', 'flex:0 0 100%;font-size:10.5px;margin-bottom:4px'],
    ['.card-viewing-fee', 'font-size:10.5px;padding:1px 8px;margin-bottom:5px'],
    ['.card-price', 'font-size:14.5px'],
    ['.card-price-overlay', 'left:7px;bottom:6px;font-size:13.5px'],
    ['.card-photo-count', 'right:7px;bottom:6px;font-size:10px;padding:2px 6px'],
    ['.card-meta', 'font-size:10.5px;gap:2px 6px;margin-bottom:4px'],
    ['.card-meta .meta-cat', 'font-size:9.5px;padding:1px 7px'],
    ['.card-meta span:nth-child(n+4)', 'display:none'],
    ['.card-verified-badge', 'display:none']
  ];
  return rules
    .map(([sel, decl]) => scopes.map(sc => `html body ${sc} .listings-grid ${sel}`).join(',\n') + ' { ' + decl + '; }')
    .join('\n');
}

function buildCss() {
  const extra = ['#featured-listings', '#recently-viewed-listings'];
  return [
    START,
    '/* One standard card. Source of truth: Home "Latest listings" card. */',
    ':root { --nk-card-gap: 10px; }',
    '@media (min-width: 769px) { :root { --nk-card-gap: 16px; } }',
    '',
    '/* Same photo ratio everywhere (Home, Browse, Saved, skeletons) */',
    'html body .card-img,',
    'html body .listings-grid .card-img,',
    'html body #listings-grid .card-img,',
    'html body #unavail-grid .card-img,',
    'html body .skeleton-img { aspect-ratio: 4 / 3; }',
    '',
    '/* Height follows content; cards in the same row stay equal */',
    'html body .card { display: flex; flex-direction: column; }',
    'html body .card-img { flex: 0 0 auto; }',
    'html body .card-body { flex: 1 1 auto; min-width: 0; }',
    'html body .card-title { min-height: 2.6em; }',
    '',
    '/* Spec row stays on one line */',
    'html body .card-meta { flex-wrap: nowrap; overflow: hidden; white-space: nowrap; }',
    'html body .card-meta > span { flex: 0 0 auto; }',
    '',
    '/* One gap value for every grid and scroller */',
    'html body .listings-grid,',
    'html body .loading-grid { gap: var(--nk-card-gap); }',
    '',
    '@media (max-width: 768px) {',
    '  /* Featured + Recently viewed: exactly the width of a Latest card (2 per screen) */',
    '  html body #featured-listings .listings-grid .card,',
    '  html body #recently-viewed-listings .listings-grid .card {',
    '    flex: 0 0 calc((100% - var(--nk-card-gap)) / 2);',
    '    max-width: none;',
    '    min-width: 0;',
    '  }',
    compactRules(extra).split('\n').map(l => '  ' + l).join('\n'),
    '}',
    END,
    ''
  ].join('\n');
}

/* ---------- file helpers ---------- */

function backup(file) {
  const bak = file + BAK;
  if (!fs.existsSync(bak)) fs.copyFileSync(file, bak);
}

function patchCss(file) {
  let css = fs.readFileSync(file, 'utf8');
  if (css.includes(START)) {
    // replace the old block so re-running always leaves the latest version
    const a = css.indexOf(START), b = css.indexOf(END);
    if (b > a) css = css.slice(0, a).replace(/\s+$/, '') + '\n\n' + css.slice(b + END.length).replace(/^\s+/, '');
  }
  backup(file);
  fs.writeFileSync(file, css.replace(/\s+$/, '') + '\n\n' + buildCss(), 'utf8');
  return true;
}

function bumpHtml(file) {
  const html = fs.readFileSync(file, 'utf8');
  const re = /(nk-cards\.css\?v=)[^"'\s>]+/g;
  if (!re.test(html)) return false;
  const next = html.replace(re, '$1' + CACHE_VER);
  if (next === html) return 'same';
  backup(file);
  fs.writeFileSync(file, next, 'utf8');
  return true;
}

function restore() {
  const files = fs.readdirSync(DIR).filter(f => f.endsWith(BAK));
  if (!files.length) fail('No ' + BAK + ' backups found in ' + DIR);
  files.forEach(b => {
    const orig = path.join(DIR, b.slice(0, -BAK.length));
    fs.copyFileSync(path.join(DIR, b), orig);
    fs.unlinkSync(path.join(DIR, b));
    log('  restored ' + path.basename(orig));
  });
  log('\nDone. Backups removed. Hard refresh the site (Ctrl+F5).');
}

/* ---------- run ---------- */

if (!fs.existsSync(DIR)) fail('Folder not found: ' + DIR);
log('Folder: ' + DIR);

if (REVERT) { restore(); process.exit(0); }

const cssFile = path.join(DIR, 'nk-cards.css');
if (!fs.existsSync(cssFile)) fail('nk-cards.css not found in ' + DIR + '\nRun this from the folder that contains index.html and nk-cards.css, or pass the folder path.');

patchCss(cssFile);
log('  patched   nk-cards.css');

const htmlFiles = fs.readdirSync(DIR).filter(f => f.endsWith('.html'));
let bumped = 0;
htmlFiles.forEach(f => {
  const r = bumpHtml(path.join(DIR, f));
  if (r === true) { bumped++; log('  cache-bump ' + f); }
});
if (!bumped) log('  (no .html file referenced nk-cards.css?v=..., nothing to bump)');

log('\nDone. Backups saved as *' + BAK + '.');
log('Next: deploy / push to GitHub, then hard refresh (Ctrl+F5 or clear site data on phone).');
log('Undo any time with:  node patch-card-size.js --revert');
