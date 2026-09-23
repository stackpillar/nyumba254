#!/usr/bin/env python3
"""
patch2.py — Phase 2 UI/UX improvements for the Nyumba254 admin
dashboard (nk-ctrl-7f3k2x9.html). Run this independently of, or
alongside, patch.py — they touch different regions of the file.

Adds:
  - Sortable "Price" / "Posted" column headers (server-side, accurate
    across pagination) on the All Listings table
  - Dismissible active-filter chips (county / area / category / search)
  - Visual + interaction separation of delete/recycle from safe actions
  - Wires the row-urgent accent onto actual pending/expiring rows
  - A friendlier empty-state message with an icon and next-step hint

Usage:
    python3 patch2.py nk-ctrl-7f3k2x9.html
"""

import re
import sys
import shutil
import datetime
import pathlib

def build_pattern(old: str) -> re.Pattern:
    tokens = old.strip().split()
    pattern = r"\s+".join(re.escape(t) for t in tokens)
    return re.compile(pattern)

PATCHES = [

    ("New CSS: sortable headers, filter chips, recycle/delete separation",
     '.tab-btn .count { display: inline-block; background: var(--surface); color: var(--text-3); font-size: 11px; padding: 1px 6px; border-radius: 8px; margin-left: 5px; }',
     '''.tab-btn .count { display: inline-block; background: var(--surface); color: var(--text-3); font-size: 11px; padding: 1px 6px; border-radius: 8px; margin-left: 5px; }
    .sortable-th { cursor: pointer; user-select: none; }
    .sortable-th:hover { color: var(--text); }
    .sort-arrow { font-size: 9px; margin-left: 2px; display: inline-block; width: 10px; }
    .filter-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--green-light); color: var(--green-dark); font-size: 12px; font-weight: 600; padding: 5px 8px 5px 12px; border-radius: 20px; }
    .filter-chip button { background: none; border: none; color: var(--green-dark); cursor: pointer; font-size: 13px; line-height: 1; padding: 2px; display: flex; }
    .filter-chips-row { display: flex; gap: 8px; flex-wrap: wrap; padding: 12px 22px 0; }
    .action-btn.recycle { background: transparent; color: var(--red); border: 1px solid var(--red-light); }
    .action-btn.recycle:hover { background: var(--red); color: white; }
    .action-btn.delete, .action-btn.recycle { margin-left: 6px; }'''),

    ("Listings table header: make Price / Posted sortable",
     '<thead><tr><th><input type="checkbox" onchange="toggleSelectAllListings(this.checked)"/></th><th>Property</th><th>Location</th><th>Price</th><th>Category</th><th>Status</th><th>Payment</th><th>Posted</th><th>Expires</th><th>Actions</th></tr></thead>',
     '<thead><tr><th><input type="checkbox" onchange="toggleSelectAllListings(this.checked)"/></th><th>Property</th><th>Location</th>'
     '<th class="sortable-th" onclick="setListingsSort(\'price\')" data-tip="Click to sort">Price <span id="sort-arrow-price" class="sort-arrow"></span></th>'
     '<th>Category</th><th>Status</th><th>Payment</th>'
     '<th class="sortable-th" onclick="setListingsSort(\'created_at\')" data-tip="Click to sort">Posted <span id="sort-arrow-created_at" class="sort-arrow"></span></th>'
     '<th>Expires</th><th>Actions</th></tr></thead>'),

    ("Add container for active-filter chips above the listings table",
     '<div id="seller-filter-banner" style="display:none;align-items:center;gap:10px;padding:10px 22px;background:var(--blue-light);border-bottom:1px solid var(--border);font-size:13px;color:var(--blue)">',
     '<div class="filter-chips-row" id="listing-filter-chips" style="display:none"></div>\n        '
     '<div id="seller-filter-banner" style="display:none;align-items:center;gap:10px;padding:10px 22px;background:var(--blue-light);border-bottom:1px solid var(--border);font-size:13px;color:var(--blue)">'),

    ("Add sort/filter-chip JS helper functions",
     "const debouncedLoad      = debounce(loadAllListings, 400); const debouncedLoadUsers = debounce(loadUsers, 400);",
     '''const debouncedLoad      = debounce(loadAllListings, 400);
  const debouncedLoadUsers = debounce(loadUsers, 400);

  function renderListingFilterChips() {
    const wrap = document.getElementById('listing-filter-chips');
    if (!wrap) return;
    const chips = [];
    const county = document.getElementById('filter-county')?.value;
    const area   = document.getElementById('filter-area')?.value;
    const cat    = document.getElementById('filter-cat')?.value;
    const search = document.getElementById('filter-search')?.value.trim();
    if (county) chips.push({label:`County: ${county}`, clear:()=>{document.getElementById('filter-county').value='';onFilterCountyChange();}});
    if (area)   chips.push({label:`Area: ${area}`, clear:()=>{document.getElementById('filter-area').value='';loadAllListings();}});
    if (cat)    chips.push({label:`Category: ${cat}`, clear:()=>{document.getElementById('filter-cat').value='';loadAllListings();}});
    if (search) chips.push({label:`Search: "${search}"`, clear:()=>{document.getElementById('filter-search').value='';loadAllListings();}});
    if (!chips.length) { wrap.style.display='none'; wrap.innerHTML=''; return; }
    wrap.style.display = 'flex';
    wrap.innerHTML = chips.map((c,i)=>`<span class="filter-chip">${esc(c.label)}<button onclick="window.__clearListingChip(${i})" aria-label="Clear filter">\\u2715</button></span>`).join('');
    window.__clearListingChip = (i) => chips[i].clear();
  }

  function setListingsSort(col) {
    if (listingsSortBy === col) {
      listingsSortDir = listingsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      listingsSortBy = col;
      listingsSortDir = col === 'price' ? 'asc' : 'desc';
    }
    loadAllListings();
  }
  function renderSortArrows() {
    ['price','created_at'].forEach(col => {
      const el = document.getElementById('sort-arrow-'+col);
      if (!el) return;
      el.textContent = (listingsSortBy === col) ? (listingsSortDir==='asc' ? '\\u25B2' : '\\u25BC') : '';
    });
  }'''),

    ("Add sort-state variables alongside existing pagination state",
     'let listingsPage = 0, usersPage = 0, paymentsPage = 0, reportsPage = 0, reviewsPage = 0;',
     "let listingsPage = 0, usersPage = 0, paymentsPage = 0, reportsPage = 0, reviewsPage = 0;\n  let listingsSortBy = 'created_at', listingsSortDir = 'desc';"),

    ("Make the listings query use the active sort column/direction",
     "q = q.order('created_at',{ascending:false}).range(listingsPage*PAGE_SIZE, listingsPage*PAGE_SIZE+PAGE_SIZE-1);",
     "q = q.order(listingsSortBy, {ascending: listingsSortDir==='asc'}).range(listingsPage*PAGE_SIZE, listingsPage*PAGE_SIZE+PAGE_SIZE-1);"),

    ("Refresh filter chips + sort arrows whenever listings reload",
     "const {data, count, error} = await q; document.getElementById('listings-count').textContent = `${count||0} listings`;",
     "const {data, count, error} = await q;\n    document.getElementById('listings-count').textContent = `${count||0} listings`;\n    renderListingFilterChips();\n    renderSortArrows();"),

    ("Compute row urgency flag per listing (desktop table)",
     "const locked = listingActionsLocked(l); const menuItems = [",
     "const locked = listingActionsLocked(l);\n      const urgent = l.status==='pending' ? ((Date.now() - new Date(l.created_at).getTime()) > 24*3600*1000) : (listingDaysLeft(l).cls === 'pending');\n      const menuItems = ["),

    ("Apply row-urgent class to the actual <tr> (desktop table)",
     '''return `<tr>
        <td><input type="checkbox" class="listing-select-cb" data-id="${l.id}" onchange="toggleSelectListing('${l.id}',this.checked)" ${selectedListingIds.has(l.id)?'checked':''}/></td>''',
     '''return `<tr class="${urgent?'row-urgent':''}">
        <td><input type="checkbox" class="listing-select-cb" data-id="${l.id}" onchange="toggleSelectListing('${l.id}',this.checked)" ${selectedListingIds.has(l.id)?'checked':''}/></td>'''),

    ("Give recycle its own visual class, separate from ordinary Reject (desktop)",
     "aBtn('recycle','Move to recycle bin','reject',`recycleListing('${l.id}')`)",
     "aBtn('recycle','Move to recycle bin','recycle',`recycleListing('${l.id}')`)"),

    ("Give recycle its own visual class, separate from ordinary Reject (mobile)",
     "aBtn('recycle','Recycle','reject',`recycleListing('${l.id}')`)",
     "aBtn('recycle','Recycle','recycle',`recycleListing('${l.id}')`)"),

    ("Friendlier empty state for All Listings (icon + next-step hint)",
     '''if (error || (!append && !data?.length)) {
      tbody.innerHTML    = `<tr><td colspan="10"><div class="table-loading"><p>No listings found</p></div></td></tr>`;
      mobileEl.innerHTML = `<div class="table-loading"><p>No listings found</p></div>`;
      return;
    }''',
     '''if (error || (!append && !data?.length)) {
      const emptyHtml = `<div class="table-loading" style="padding:48px 20px">
        <svg viewBox="0 0 24 24" width="40" height="40" style="stroke:var(--border);fill:none;stroke-width:1.5;margin:0 auto 12px;display:block"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M8 12h8M8 16h5"/></svg>
        <p style="font-weight:600;color:var(--text-2);margin-bottom:4px">${error?'Something went wrong loading listings':'No listings found'}</p>
        <p style="font-size:12px;color:var(--text-3)">${error?esc(error.message||''):'Try clearing your filters or search term.'}</p>
      </div>`;
      tbody.innerHTML    = `<tr><td colspan="10">${emptyHtml}</td></tr>`;
      mobileEl.innerHTML = emptyHtml;
      return;
    }'''),
]

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 patch2.py <path-to-html-file>")
        sys.exit(1)

    path = pathlib.Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    content = path.read_text(encoding="utf-8")
    original_content = content

    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".bak2-{timestamp}")
    shutil.copy2(path, backup_path)
    print(f"Backup saved: {backup_path}\n")

    applied, skipped = [], []

    for label, old, new in PATCHES:
        pattern = build_pattern(old)
        matches = pattern.findall(content)
        if len(matches) == 0:
            skipped.append((label, "not found (already applied, or file differs from expected)"))
            continue
        if len(matches) > 1:
            skipped.append((label, f"skipped — matched {len(matches)} times, needs a unique anchor"))
            continue
        content = pattern.sub(new.replace("\\", "\\\\"), content, count=1)
        applied.append(label)

    if content == original_content:
        print("No changes were applied — nothing to write.")
        sys.exit(0)

    path.write_text(content, encoding="utf-8")

    print(f"Applied {len(applied)} patch(es):")
    for label in applied:
        print(f"  [x] {label}")

    if skipped:
        print(f"\nSkipped {len(skipped)} patch(es):")
        for label, reason in skipped:
            print(f"  [ ] {label} — {reason}")

    print(f"\nDone. Original file backed up at: {backup_path}")
    print("\nNote: if 'Add sort-state variables' or the order-by patch were")
    print("skipped, sorting won't work even if headers render — check those")
    print("two lines by hand against your file.")

if __name__ == "__main__":
    main()
