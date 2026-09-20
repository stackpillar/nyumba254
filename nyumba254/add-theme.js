#!/usr/bin/env node
/*
  add-theme.js — wires the shared theme (theme.css + theme.js) into every page of the site.

    node add-theme.js                     dry run: lists what WOULD change, writes nothing
    node add-theme.js --apply             inserts the two tags before </head> in each page
    node add-theme.js --remove --apply    takes them back out again
    node add-theme.js --audit             lists hard-coded light backgrounds / dark text per page

  Safe to run twice: pages that already have the tags are left alone.
  Run it from the project root (same folder as index.html), then delete it if you don't want it deployed.
*/
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const APPLY = process.argv.includes('--apply');
const REMOVE = process.argv.includes('--remove');
const AUDIT = process.argv.includes('--audit');

// Files that must NOT get the shared theme. Edit freely.
const SKIP = [
  /\s/,                 // names with spaces = email templates and notes ("magic link email", "Google Auth.txt")
  /^saved(\.html)?$/i,  // already has its own theme on the same nk_theme key
  /^nk-ctrl-/i,         // hidden admin panel
  /^admin/i,            // admin pages
  /^tiktok/i,           // TikTok verification files
  /^_/,                 // _headers, _redirects, _worker.js
  /^theme\.(css|js)$/i
];
const SKIP_DIRS = new Set(['.git', 'node_modules', '.wrangler', '.vscode']);
const PAGE_EXT = new Set(['', '.html', '.htm']);   // many of your pages have no extension
const TAGS = ['<link rel="stylesheet" href="/theme.css"/>', '<script src="/theme.js"></script>'];

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(path.join(dir, e.name), out); }
    else if (PAGE_EXT.has(path.extname(e.name).toLowerCase())) out.push(path.join(dir, e.name));
  }
  return out;
}

/* ── audit: which rules hard-code a light background or dark text (these ignore the theme variables) ── */
function audit(src) {
  const css = [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n').replace(/\/\*[\s\S]*?\*\//g, '');
  const light = /#f[0-9a-f]{2}\b|#f[0-9a-f]{5}\b|\bwhite\b|rgba?\(\s*255\s*,\s*255\s*,\s*255/i;
  const dark = /#[0-3][0-9a-f]{2}\b|#[0-3][0-9a-f]{5}\b|\bblack\b/i;
  const found = [];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    if (!sel || sel.startsWith('@') || /data-theme|^:root|^(from|to|\d+%)/.test(sel)) continue;
    const flags = [];
    for (const d of m[2].matchAll(/(?:^|;)\s*(background(?:-color)?|color)\s*:\s*([^;]+)/gi)) {
      const prop = d[1].toLowerCase(), val = d[2].trim();
      if (/var\(/.test(val)) continue;
      if (prop !== 'color' && light.test(val)) flags.push('background ' + val);
      if (prop === 'color' && dark.test(val)) flags.push('text ' + val);
    }
    if (flags.length) found.push('    ' + sel + '   ←  ' + flags.join(', '));
  }
  return found;
}

const files = walk(ROOT, []);
const excluded = [];
let changed = 0;

console.log((APPLY ? '' : '[DRY RUN] ') + (AUDIT ? 'Auditing' : REMOVE ? 'Removing theme from' : 'Adding theme to') + ' pages in ' + ROOT + '\n');

for (const f of files) {
  const name = path.basename(f), rel = path.relative(ROOT, f);
  if (SKIP.some(r => r.test(name))) { excluded.push(rel); continue; }
  let src;
  try { src = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
  if (!/<\/head>/i.test(src) || !/<body/i.test(src)) continue;      // not a full HTML page

  if (AUDIT) {
    const hits = audit(src);
    console.log(rel + (hits.length ? '\n' + hits.join('\n') : '  (nothing hard-coded)'));
    continue;
  }

  const has = /\/theme\.js/.test(src);

  if (REMOVE) {
    if (!has) continue;
    const out = src
      .replace(/[ \t]*<link rel="stylesheet" href="\/theme\.css"\s*\/?>\r?\n?/g, '')
      .replace(/[ \t]*<script src="\/theme\.js"><\/script>\r?\n?/g, '');
    console.log('  removed   ' + rel);
    if (APPLY) fs.writeFileSync(f, out);
    changed++;
    continue;
  }

  if (has) { console.log('  already   ' + rel); continue; }
  const nl = src.includes('\r\n') ? '\r\n' : '\n';                   // keep Windows line endings
  const out = src.replace(/<\/head>/i, m => '  ' + TAGS.join(nl + '  ') + nl + m);
  console.log('  ' + (APPLY ? 'updated   ' : 'would add ') + rel);
  if (APPLY) fs.writeFileSync(f, out);
  changed++;
}

if (!AUDIT) {
  console.log('\n' + (APPLY ? 'Changed ' : 'Would change ') + changed + ' page(s).' + (APPLY ? '' : '  Run again with --apply to write the changes.'));
  if (excluded.length) console.log('Excluded on purpose: ' + excluded.join(', '));
}
