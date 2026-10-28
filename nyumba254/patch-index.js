const fs = require('fs');
const f = process.argv[2] || 'index.html';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('Compact cards index v1')) { console.log('Already applied, nothing changed.'); process.exit(0); }
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const css = `
    /* Compact cards index v1 */
    .listings-grid, .loading-grid { grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 16px; }
    .card { border-radius: 14px; }
    .card-img, .listings-grid .card-img, .skeleton-img { aspect-ratio: 16/10; }
    .badge-featured, .badge-new { top: 10px; left: 10px; padding: 4px 10px; }
    .badge-cat { left: 10px; bottom: 10px; }
    .card-body { padding: 11px 13px 12px; display: flex; flex-wrap: wrap; align-items: center; column-gap: 8px; line-height: 1.3; }
    .card-area, .card-title, .card-sub, .card-price { flex: 0 0 100%; min-width: 0; }
    .card-area { margin-bottom: 3px; }
    .card-title { font-size: 14.5px; line-height: 1.3; margin-bottom: 2px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; overflow-wrap: anywhere; }
    .card-sub { font-size: 12px; margin-bottom: 6px; }
    .card-role { flex: 1 1 0; min-width: 0; font-size: 12px; line-height: 1.3; color: var(--text-2); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 6px; }
    .card-viewing-fee { flex: 0 0 auto; font-size: 11.5px; font-weight: 700; line-height: 1.3; padding: 2px 9px; border-radius: 20px; background: var(--surface); border: 1px solid var(--border); color: var(--text-2); white-space: nowrap; margin-bottom: 6px; }
    .card-price { font-size: 17px; line-height: 1.25; }
    .skeleton { border-radius: 14px; }
    .skeleton-body { padding: 12px; }
    @media (max-width: 768px) {
      .listings-grid .card { flex: 0 0 74%; max-width: 290px; }
    }
`;
const i = s.lastIndexOf('</style>');
if (i < 0) { console.log('NOTHING WRITTEN: no </style> found.'); process.exit(1); }
fs.writeFileSync(f + '.bak', crlf ? s.replace(/\n/g, '\r\n') : s);
s = s.slice(0, i) + css + '  ' + s.slice(i);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Updated ' + f + ' (backup: ' + f + '.bak)');