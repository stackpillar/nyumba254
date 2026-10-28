const fs = require('fs');
const f = process.argv[2] || 'listings';
let s = fs.readFileSync(f, 'utf8');
if (s.includes('Compact cards v3')) { console.log('Already applied, nothing changed.'); process.exit(0); }
const crlf = s.includes('\r\n');
if (crlf) s = s.replace(/\r\n/g, '\n');
const css = `
    /* Compact cards v3 */
    .card-img{aspect-ratio:16/10}
    .skeleton-img{aspect-ratio:16/10}
    .card-body{padding:10px 12px 12px}
    .card-area{margin-bottom:2px}
    .card-sub{margin-bottom:4px}
    .card-price{margin-bottom:4px}
    .card-trust{margin-bottom:6px;gap:3px 6px}
    .card-viewing-fee{padding:1px 8px}
    .card-specs-chips{margin-bottom:6px}
    .card-amenities{border-top:0;padding-top:0;margin-bottom:8px}
    .card-foot{padding-top:0}
    @media (min-width:769px){
      .nk-compare-check,.card-inquire-btn,.card-wa-btn,.card-msg-btn{min-height:36px}
    }
`;
const i = s.indexOf('</style>');
if (i < 0) { console.log('NOTHING WRITTEN: no </style> found.'); process.exit(1); }
fs.writeFileSync(f + '.bak2', crlf ? s.replace(/\n/g, '\r\n') : s);
s = s.slice(0, i) + css + '  ' + s.slice(i);
fs.writeFileSync(f, crlf ? s.replace(/\n/g, '\r\n') : s);
console.log('Updated ' + f + ' (backup: ' + f + '.bak2)');