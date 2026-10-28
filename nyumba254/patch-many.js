const fs = require('fs');
const f = process.argv[2] || 'index.html';
let raw = fs.readFileSync(f, 'utf8');
const crlf = raw.includes('\r\n');
let s = crlf ? raw.replace(/\r\n/g, '\n') : raw;
const done = [], skipped = [];

// 1. "Show more" button after the Latest list
const hintFrom = '<button type="button" class="scroll-hint left" data-scroll="-1" aria-label="Scroll to previous listings">';
if (s.includes('id="latest-more-btn"')) skipped.push('Show more button (already applied)');
else if (!s.includes(hintFrom)) skipped.push('Show more button (text not found)');
else {
  s = s.replace(hintFrom, () => '<button type="button" class="latest-more-btn" id="latest-more-btn">Show more listings</button>\n    ' + hintFrom);
  done.push('Show more button');
}

// 2. Click handler for it
const scriptFrom = '<script src="/saved-listings.js"></script>';
if (s.includes("latest-more-btn')")) skipped.push('Show more script (already applied)');
else if (!s.includes(scriptFrom)) skipped.push('Show more script (text not found)');
else {
  s = s.replace(scriptFrom, () => `<script>
document.addEventListener('click', function (e) {
  var b = e.target.closest('#latest-more-btn'); if (!b) return;
  var l = document.getElementById('latest-listings');
  var on = l.classList.toggle('show-all-cards');
  b.textContent = on ? 'Show fewer' : 'Show more listings';
});
</script>
` + scriptFrom);
  done.push('Show more script');
}

// 3. Styles
const css = `
    /* Many listings v1 */
    .latest-more-btn { display: none; }
    @media (max-width: 768px) {
      #latest-listings .listings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; overflow: visible; scroll-snap-type: none; margin: 0; padding: 0; -webkit-mask-image: none; mask-image: none; }
      #latest-listings .listings-grid .card { flex: none; max-width: none; min-width: 0; }
      #latest-listings .carousel-dots { display: none; }
      #latest-listings:not(.show-all-cards) .listings-grid .card:nth-child(n+9) { display: none; }
      #latest-listings .card-img { aspect-ratio: 4/3; }
      #latest-listings .badge-featured, #latest-listings .badge-new { top: 7px; left: 7px; font-size: 9.5px; padding: 3px 8px; }
      #latest-listings .badge-cat { left: 7px; bottom: 7px; font-size: 9.5px; padding: 3px 8px; }
      #latest-listings .card-body { padding: 9px 10px 10px; }
      #latest-listings .card-area { font-size: 10px; margin-bottom: 2px; }
      #latest-listings .card-area::before { display: none; }
      #latest-listings .card-title { font-size: 13px; }
      #latest-listings .card-sub { display: none; }
      #latest-listings .card-role { flex: 0 0 100%; font-size: 10.5px; margin-bottom: 4px; }
      #latest-listings .card-viewing-fee { font-size: 10.5px; padding: 1px 8px; margin-bottom: 5px; }
      #latest-listings .card-price { font-size: 14.5px; }
      #latest-listings .skeleton-body { padding: 8px; }
      #latest-listings .loading-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
      #latest-listings .loading-grid .skeleton:nth-child(3) { display: none; }
      #latest-listings:not(:has(.card:nth-child(9))) ~ .latest-more-btn { display: none; }
      .latest-more-btn { display: block; width: 100%; margin-top: 14px; min-height: 44px; font-size: 14px; font-weight: 600; color: var(--green-dark); background: #fff; border: 1.5px solid var(--green); border-radius: 22px; }
      #latest-section .area-pills { margin-bottom: 10px !important; }
    }
    @media (max-width: 560px) {
      .sb-main { flex-direction: row; }
      .search-btn { width: auto; min-height: 44px; padding: 0 16px; font-size: 14px; }
    }
`;
if (s.includes('Many listings v1')) skipped.push('Styles (already applied)');
else {
  const i = s.lastIndexOf('</style>');
  if (i < 0) { console.log('NOTHING WRITTEN: no </style> found.'); process.exit(1); }
  s = s.slice(0, i) + css + '  ' + s.slice(i);
  done.push('Styles');
}

fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Applied: ' + (done.length ? done.join('; ') : 'nothing'));
if (skipped.length) console.log('Skipped: ' + skipped.join('; '));