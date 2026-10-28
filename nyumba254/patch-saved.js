const fs = require('fs');
const f = process.argv[2] || 'saved.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const css = `
    /* Saved mobile v1 */
    @media screen and (max-width: 768px) {
      .page-header { padding: 12px 16px; }
      .page-header h1 { font-size: 22px; margin-bottom: 0; }
      .page-header p { display: none; }
      .sync-banner { margin: 10px 12px 0; padding: 10px 12px; gap: 8px; }
      .sync-banner-text { font-size: 12px; }
      .sync-banner .btn-outline { min-height: 34px; padding: 6px 10px; font-size: 12px; }
      .main-wrap { padding: 12px 12px 60px; }
      .summary-strip { flex-wrap: nowrap; overflow-x: auto; gap: 8px; margin-bottom: 12px; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
      .sum-chip { flex-shrink: 0; min-width: 96px; padding: 8px 10px; }
      .sum-chip strong { font-size: 13.5px; }
      .filter-row { margin-bottom: 10px; }
      .toolbar { margin-bottom: 12px; gap: 6px; }
      .listings-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      .card { border-radius: 14px; }
      .card-img { height: auto; aspect-ratio: 4/3; }
      .badge-featured { top: 7px; left: 7px; font-size: 9px; padding: 3px 7px; max-width: calc(100% - 50px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .badge-unavailable { font-size: 11px; padding: 8px; }
      .remove-heart-btn, .add-heart-btn { top: 6px; right: 6px; width: 30px; height: 30px; }
      .remove-heart-btn svg, .add-heart-btn svg { width: 14px; height: 14px; }
      .photo-nav, .photo-count { display: none; }
      .sel-box { left: 6px; bottom: 6px; width: 28px; height: 28px; }
      .card-body { padding: 8px 10px 10px; }
      .card-top-row { margin-bottom: 2px; }
      .card-cat-pill { display: none; }
      .card-area { font-size: 10px; }
      .card-title { font-size: 13px; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .card-sub, .card-meta, .card-saved-date { display: none; }
      .card-price { font-size: 14.5px; margin-bottom: 4px; }
      .chip-row { gap: 4px; margin-bottom: 6px; }
      .chip { font-size: 10px; padding: 1px 7px; }
      .chip-row .chip:not(.drop):not(.rise):not(.status):not(.folder):not(.viewing) { display: none; }
      .chip-row:not(:has(.drop, .rise, .status, .folder, .viewing)) { display: none; }
      .card-note { font-size: 11.5px; padding: 5px 8px; margin-bottom: 6px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      .card-actions { gap: 4px; margin-bottom: 0; }
      .card-actions .act-btn { flex: 1 1 0; min-height: 34px; font-size: 11px; padding: 4px 6px; }
      .card-actions .act-btn[data-act="share"],
      .card-actions .act-btn[data-act="call"],
      .card-actions .act-btn[data-act="viewed"] { display: none; }
      .card-view-btn { display: none; }
      .card-reorder { gap: 4px; margin-bottom: 6px; }
      .card-reorder .act-btn { flex: 1; min-height: 30px; font-size: 10.5px; padding: 3px 4px; }
      .side-section { margin-top: 28px; padding-top: 20px; }
      .side-header h2 { font-size: 18px; }
      .skeleton-img { height: auto; aspect-ratio: 4/3; }
      .skeleton-body { padding: 8px 10px; }
      #listings-grid .skeleton:nth-child(3) { display: none; }
    }
`;

if (s.includes('Saved mobile v1')) {
  console.log('Skipped: already applied.');
  process.exit(0);
}
const i = s.lastIndexOf('</style>');
if (i < 0) { console.log('NOTHING WRITTEN: no </style> found in ' + f); process.exit(1); }
s = s.slice(0, i) + css + '  ' + s.slice(i);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: 2-column mobile grid, lighter cards, shorter header on saved page.');