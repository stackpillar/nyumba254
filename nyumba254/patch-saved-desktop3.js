const fs = require('fs');
const f = process.argv[2] || 'saved.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const css = `
    /* Saved desktop v3 (full width, 4+ per row, slightly tighter cards) */
    @media screen and (min-width: 769px) {
      .page-header { padding: 18px 32px; }
      .page-header h1 { font-size: 24px; }
      .page-header-inner, .main-wrap { max-width: none; }
      .sync-banner { max-width: none; margin: 14px 32px 0; padding: 10px 16px; }
      .main-wrap { padding: 20px 32px 70px; }
      .listings-grid { grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 16px; }
      .card { border-radius: 14px; }
      .card-img, .skeleton-img { height: auto; aspect-ratio: 16/10; }
      .badge-featured { top: 9px; left: 9px; font-size: 9.5px; padding: 3px 9px; max-width: calc(100% - 60px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .remove-heart-btn, .add-heart-btn { top: 9px; right: 9px; width: 32px; height: 32px; }
      .card-body { padding: 10px 12px 11px; }
      .card-top-row { margin-bottom: 2px; }
      .card-area { font-size: 10.5px; }
      .card-cat-pill { font-size: 9.5px; padding: 1px 7px; }
      .card-title { font-size: 14px; line-height: 1.3; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
      .card-sub { font-size: 11.5px; margin-bottom: 4px; }
      .card-price { font-size: 16px; margin-bottom: 5px; }
      .chip-row { gap: 4px; margin-bottom: 5px; }
      .chip { font-size: 10px; padding: 1px 7px; }
      .card-meta { gap: 9px; font-size: 11px; padding-top: 6px; margin-bottom: 6px; }
      .card-note { font-size: 11.5px; padding: 5px 8px; margin-bottom: 6px; }
      .card-saved-date { font-size: 10.5px; margin-bottom: 6px; }
      .card-actions { gap: 4px; margin-bottom: 7px; }
      .act-btn { min-height: 28px; font-size: 11px; padding: 3px 8px; }
      .card-view-btn { padding: 7px; font-size: 12.5px; }
      .card-reorder { gap: 4px; margin-bottom: 6px; }
      .skeleton-body { padding: 12px; }
      .side-section { margin-top: 36px; padding-top: 24px; }
    }
`;

// remove the earlier desktop blocks if they were applied
s = s.replace(/\n\s*\/\* Saved desktop v1 \*\/[\s\S]*?\n    \}\n/, '\n');
s = s.replace(/\n\s*\/\* Saved desktop v2[^*]*\*\/[\s\S]*?\n    \}\n/, '\n');

if (s.includes('Saved desktop v3')) {
  console.log('Skipped: already applied.');
  process.exit(0);
}
const i = s.lastIndexOf('</style>');
if (i < 0) { console.log('NOTHING WRITTEN: no </style> found in ' + f); process.exit(1); }
s = s.slice(0, i) + css + '  ' + s.slice(i);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: saved desktop full width, 4+ per row, tighter cards (older desktop blocks removed).');