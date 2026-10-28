const fs = require('fs');
const f = process.argv[2] || 'index.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;
const done = [], skipped = [];

function swap(from, to, label) {
  if (s.includes(to)) { skipped.push(label + ' (already applied)'); return; }
  if (!s.includes(from)) { skipped.push(label + ' (text not found, run patch-many.js first)'); return; }
  s = s.replace(from, () => to); done.push(label);
}

// 1. Button becomes a real link
swap(
  '<button type="button" class="latest-more-btn" id="latest-more-btn">Show more listings</button>',
  '<a href="/listings" class="latest-more-btn" id="latest-more-btn">View all listings →</a>',
  'Button turned into a link');

// 2. On click, copy the "See all" link so the county/area filter carries over
swap(
  "  var l = document.getElementById('latest-listings');\n  var on = l.classList.toggle('show-all-cards');\n  b.textContent = on ? 'Show fewer' : 'Show more listings';",
  "  var a = document.getElementById('latest-see-all'); if (a) b.href = a.href;",
  'Link carries the county and area');

// 3. Styles (works on phones and desktop)
const css = `
    /* More link v1 */
    a.latest-more-btn { align-items: center; justify-content: center; text-align: center; text-decoration: none; }
    @media (max-width: 768px) { a.latest-more-btn { display: flex; } }
    @media (min-width: 769px) {
      a.latest-more-btn { display: inline-flex; margin-top: 20px; min-height: 44px; padding: 0 26px; font-size: 14px; font-weight: 600; color: var(--green-dark); background: #fff; border: 1.5px solid var(--green); border-radius: 22px; }
      a.latest-more-btn:hover { background: var(--green-light); }
    }
`;
if (s.includes('More link v1')) skipped.push('Styles (already applied)');
else {
  const i = s.lastIndexOf('</style>');
  if (i < 0) { console.log('NOTHING WRITTEN: no </style> found.'); process.exit(1); }
  s = s.slice(0, i) + css + '  ' + s.slice(i);
  done.push('Styles');
}

fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: ' + (done.length ? done.join('; ') : 'nothing'));
if (skipped.length) console.log('Skipped: ' + skipped.join('; '));