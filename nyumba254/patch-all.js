const fs = require('fs');
const f = process.argv[2] || 'index.html';
let s = fs.readFileSync(f, 'utf8');
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const done = [];

// 1. Move Recently viewed above Featured
const a = s.indexOf('<section class="section nk-recently-viewed"');
const b = s.indexOf('<section class="section section-alt" id="featured-section"');
if (a > b && b > 0) {
  const e = s.indexOf('</section>', a) + '</section>'.length;
  let start = s.lastIndexOf('<!--', a);
  if (start < 0 || !s.slice(start, a).includes('RECENTLY VIEWED')) start = a;
  const block = s.slice(start, e);
  s = s.slice(0, start) + s.slice(e);
  let fstart = s.lastIndexOf('<!--', s.indexOf('<section class="section section-alt" id="featured-section"'));
  if (fstart < 0 || !s.slice(fstart, s.indexOf('id="featured-section"')).includes('FEATURED')) fstart = s.indexOf('<section class="section section-alt" id="featured-section"');
  s = s.slice(0, fstart) + block.trimEnd() + '\n\n' + s.slice(fstart);
  done.push('Recently viewed moved above Featured');
}

// 2. Compact cards (all screens)
const cards = `
    /* Compact cards index v1 */
    #recently-viewed-section { padding-top: 20px; padding-bottom: 4px; }
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

// 3. Compact counties (mobile only)
const counties = `
    /* Compact counties mobile v1 */
    @media (max-width: 768px) {
      #areas.section { padding-top: 24px; padding-bottom: 20px; }
      .areas { grid-template-rows: repeat(3, auto); grid-auto-columns: max-content; gap: 8px; padding-bottom: 4px; }
      .area-card { display: flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 999px; white-space: nowrap; text-align: left; }
      .area-card-name { font-size: 13px; margin: 0; }
      .area-card-count { font-size: 11.5px; }
      .area-card.zero-listings .area-card-count, .area-card.coming-soon .area-card-count { display: none; }
      .quicklinks { margin-top: 12px; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
      .quicklinks::-webkit-scrollbar { display: none; }
      .quicklink, .quicklinks-label { flex-shrink: 0; white-space: nowrap; }
    }
`;

let css = '';
if (!s.includes('Compact cards index v1')) { css += cards; done.push('Compact cards'); }
if (!s.includes('Compact counties mobile v1')) { css += counties; done.push('Compact counties (mobile)'); }
if (css) {
  const i = s.lastIndexOf('</style>');
  if (i < 0) { console.log('NOTHING WRITTEN: no </style> found.'); process.exit(1); }
  s = s.slice(0, i) + css + '  ' + s.slice(i);
}
if (!done.length) { console.log('Everything was already applied, nothing changed.'); process.exit(0); }
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Updated ' + f + ': ' + done.join(', '));