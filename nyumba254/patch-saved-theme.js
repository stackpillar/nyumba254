const fs = require('fs');
const f = process.argv[2] || 'saved.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;
const done = [], skipped = [];

function swap(from, to, label) {
  if (s.includes(to)) { skipped.push(label + ' (already applied)'); return; }
  if (!s.includes(from)) { skipped.push(label + ' (text not found)'); return; }
  s = s.replace(from, () => to); done.push(label);
}

// 1. First paint: default to light instead of following the device
swap(
  "t = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';",
  "t = 'light';",
  'Default theme before first paint is light');

// 2. Page init fallback
swap(
  "applyTheme(document.documentElement.getAttribute('data-theme') || 'dark');",
  "applyTheme(document.documentElement.getAttribute('data-theme') || 'light');",
  'Init fallback is light');

fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: ' + (done.length ? done.join('; ') : 'nothing'));
if (skipped.length) console.log('Skipped: ' + skipped.join('; '));