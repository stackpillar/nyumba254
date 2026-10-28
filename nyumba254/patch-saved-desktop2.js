const fs = require('fs');
const f = process.argv[2] || 'saved.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;

const css = `
    /* Saved desktop v2 (matches index card sizes) */
    @media screen and (min-width: 769px) {
      .page-header { padding: 20px 32px; }
      .page-header h1 { font-size: 26px; }
      .main-wrap { padding: 22px 32px 70px; }
      .listings-grid { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
      .card { border-radius: 14px; }
      .card-img, .skeleton-img { height: auto; aspect-ratio: 16/10; }
      .badge-featured { top: 10px; left: 10px; font-size: 10px; padding: 4px 10px; max-width: calc(100% - 60px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .remove-heart-btn, .add-heart-btn { top: 10px; right: 10px; width: 34px; height: 34px; }
      .card-body { padding: 11px 13px 12px; }
      .card-top-row { margin-bottom: 3px; }
      .card-title { font-size: 14.5px; line-height: 1.3; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
      .card-sub { font-size: 12px; margin-bottom: 6px; }
      .card-price { font-size: 17px; margin-bottom: 6px; }
      .chip-row { margin-bottom: 6px; }
      .card-meta { padding-top: 8px; margin-bottom: 8px; }
      .card-saved-date { margin-bottom: 8px; }
      .card-actions { margin-bottom: 8px; }
      .act-btn { min-height: 30px; padding: 4px 9px; }
      .card-view-btn { padding: 8px; }
      .skeleton-body { padding: 12px; }
    }
`;

// remove the older, too-small desktop block if it was applied
s = s.replace(/\n\s*\/\* Saved desktop v1 \*\/[\s\S]*?\n    \}\n/, '\n');

if (s.includes('Saved desktop v2')) {
  console.log('Skipped: already applied.');
  process.exit(0);
}
const i = s.lastIndexOf('</style>');
if (i < 0) { console.log('NOTHING WRITTEN: no </style> found in ' + f); process.exit(1); }
s = s.slice(0, i) + css + '  ' + s.slice(i);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: saved desktop cards now match index sizes (old compact block removed).');