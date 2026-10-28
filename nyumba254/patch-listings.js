const fs = require('fs');
const f = process.argv[2] || 'listings.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const css = `
    /* Many listings v1 */
    @media (max-width: 768px) {
      .nk-breadcrumb { display: none; }
      .page-header h1 { margin-bottom: 6px; }
      .hs-pill { margin: 2px 0 10px; min-height: 42px; }
      .main { padding: 10px 12px 20px; }
      .cat-tabs { margin-bottom: 10px; }
      .listings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .card { border-radius: 14px; }
      .card-img { aspect-ratio: 4/3; }
      .badge-featured, .badge-new, .badge-occ, .badge-avail { font-size: 9.5px; padding: 3px 8px; }
      .card-badges { top: 7px; left: 7px; gap: 4px; }
      .badge-cat { left: 7px; bottom: 7px; font-size: 9.5px; padding: 3px 8px; }
      .card-img .nk-heart-overlay { top: 6px; right: 6px; }
      .card-carousel-arrow, .card-photo-counter { display: none; }
      .card-body { padding: 8px 10px 10px; }
      .card-area { font-size: 10px; margin-bottom: 2px; }
      .card-area::before { display: none; }
      .card-title { font-size: 13px; }
      .card-sub { display: none; }
      .card-price { font-size: 14.5px; margin-bottom: 4px; }
      .card-trust { margin-bottom: 6px; gap: 3px 4px; font-size: 10.5px; }
      .card-viewing-fee { font-size: 10.5px; padding: 1px 7px; }
      .card-specs-chips, .card-amenities, .card-meta, .card-roomtypes, .nk-compare-check { display: none; }
      .card-foot { padding-top: 2px; }
      .card-inquire-btn, .card-wa-btn { min-height: 38px; font-size: 12px; padding: 0 6px; }
      .card-inquire-btn svg, .card-wa-btn svg { width: 14px; height: 14px; }
      .card-msg-btn { display: none; }
      .skeleton-body { padding: 8px; }
      #listings-grid .skeleton:nth-child(3) { display: none; }
      .nk-inline-notify { padding: 10px 12px; font-size: 12.5px; }
    }
`;

if (s.includes('Many listings v1')) {
  console.log('Skipped: already applied.');
  process.exit(0);
}
const i = s.lastIndexOf('</style>');
if (i < 0) { console.log('NOTHING WRITTEN: no </style> found in ' + f); process.exit(1); }
s = s.slice(0, i) + css + '  ' + s.slice(i);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: 2-column mobile grid, lighter cards, shorter header.');