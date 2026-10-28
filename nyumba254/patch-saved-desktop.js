const fs = require('fs');
const f = process.argv[2] || 'saved.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const css = `
    /* Saved desktop v1 */
    @media screen and (min-width: 769px) {
      .page-header { padding: 18px 32px; }
      .page-header h1 { font-size: 24px; }
      .main-wrap { padding: 20px 32px 70px; }
      .listings-grid { grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
      .card { border-radius: 12px; }
      .card-img { height: 125px; }
      .skeleton-img { height: 125px; }
      .badge-featured { top: 7px; left: 7px; font-size: 9px; padding: 2px 7px; max-width: calc(100% - 50px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .remove-heart-btn, .add-heart-btn { top: 6px; right: 6px; width: 30px; height: 30px; }
      .remove-heart-btn svg, .add-heart-btn svg { width: 14px; height: 14px; }
      .card-body { padding: 9px 11px 11px; }
      .card-top-row { margin-bottom: 2px; }
      .card-cat-pill { display: none; }
      .card-area { font-size: 10px; }
      .card-title { font-size: 13px; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .card-sub { display: none; }
      .card-price { font-size: 15px; margin-bottom: 4px; }
      .chip-row { gap: 4px; margin-bottom: 6px; }
      .chip { font-size: 10px; padding: 1px 7px; }
      .chip-row .chip:not(.drop):not(.rise):not(.status):not(.folder):not(.viewing) { display: none; }
      .chip-row:not(:has(.drop, .rise, .status, .folder, .viewing)) { display: none; }
      .card-meta { gap: 8px; font-size: 11px; padding-top: 6px; margin-bottom: 6px; }
      .card-note { font-size: 11.5px; padding: 5px 8px; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .card-saved-date { font-size: 10px; margin-bottom: 6px; }
      .card-actions { gap: 4px; margin-bottom: 8px; }
      .card-actions .act-btn { min-height: 28px; font-size: 11px; padding: 3px 8px; }
      .card-actions .act-btn[data-act="call"],
      .card-actions .act-btn[data-act="viewed"] { display: none; }
      .card-view-btn { padding: 6px; font-size: 12px; }
      .card-reorder { gap: 4px; margin-bottom: 6px; }
      .card-reorder .act-btn { min-height: 26px; font-size: 10.5px; padding: 2px 6px; }
      .side-section { margin-top: 32px; padding-top: 22px; }
      .side-header h2 { font-size: 19px; }
      #map { height: 420px; }
    }
`;

if (s.includes('Saved desktop v1')) {
  console.log('Skipped: already applied.');
  process.exit(0);
}
const i = s.lastIndexOf('</style>');
if (i < 0) { console.log('NOTHING WRITTEN: no </style> found in ' + f); process.exit(1); }
s = s.slice(0, i) + css + '  ' + s.slice(i);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: compact desktop cards on saved page.');