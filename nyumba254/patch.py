#!/usr/bin/env python3
"""
patch.py — applies all 18 "All listings" UX fixes to Nyumba254's admin.html.

WHY IT WORKS THIS WAY
----------------------
This is a single 2,700+ line HTML/CSS/JS file with no build step and no test
suite. The only safe way to change it by script is: find an exact, unique
anchor string, replace it, and refuse to touch anything if an anchor can't
be found or is ambiguous. That's what this script does — every patch is
applied with an assertion, never a best-effort/fuzzy match.

USAGE
-----
    python3 patch.py --check admin.html
        Reports which of the 18 fixes' anchors are found in your file,
        without writing anything. Run this first.

    python3 patch.py admin.html -o admin.patched.html
        Applies every fix and writes the result. Aborts with no output
        file written if ANY anchor is missing or appears more than once
        (so a partial/corrupt file is never produced).

    python3 patch.py admin.html --allow-partial -o admin.patched.html
        Applies whichever fixes DO match and skips the rest with a
        warning, instead of aborting. Use this if you've since edited
        admin.html and only some fixes still apply cleanly.

If your admin.html has drifted from the version this was written against
(different whitespace, since-edited functions, etc.), some anchors may not
match. --check will tell you exactly which ones by name, so you can hand-
apply just those or paste the affected function back to me to re-diff.

WHAT EACH FIX DOES (see PATCHES below for the code)
----------------------------------------------------
 1. Tab counts (Pending/Active/Featured/Trial/etc.) now respect the active
    county/area/category/date-range/seller filters, instead of always
    showing platform-wide numbers.
 2. Listings view state (tab, filters, sort) is written to the URL hash and
    restored on load/back — the view is now bookmarkable and shareable.
 3. Search now also matches seller name, seller phone, and listing number
    (previously title/area only).
 4. The desktop action column is trimmed to 3-4 primary buttons; every
    other action (extend, feature, video, social, recycle, delete, etc.)
    moves into the existing "Actions ▾" dropdown, which is now actually
    visible on desktop too (it already existed in the markup but its CSS
    permanently hid it).
 5. Listings load 50 rows per page instead of 200.
 6. Table header row is sticky while scrolling vertically.
 7. Status, Category, and Payment columns become sortable, alongside the
    existing Price/Posted.
 8. "Extend expiry" gets its own small modal with a numeric day input and
    day presets, instead of hijacking the generic reason-textarea modal.
 9. Bulk bar gains "Feature selected" and "Extend expiry…" alongside the
    existing Approve/Reject/Recycle.
10. The county/area/category/search controls get a visible "active" state
    (highlighted border) whenever a filter chip for them is showing.
11. A Posted-date range filter (From/To) is added next to the other
    listing filters, matching the pattern already used on Payments.
12. "Feature listing" is now one modal with a "was this paid?" checkbox,
    instead of two separate flows (free-feature vs. process-upgrade) an
    admin has to remember to pick correctly.
13. Listing thumbnails are clickable and open a larger preview.
14. A "copy live link" action is added per listing.
15. The "unavailable" tooltip on locked actions now states the specific
    reason (rejected / deactivated / occupied / paused) instead of listing
    all four possibilities every time.
16. A live selected-count badge sits next to the header checkbox, visible
    even without opening the bulk bar.
17. A "Columns ▾" control lets you hide Location/Category/Payment columns,
    persisted in localStorage.
18. Urgent rows get a small "⚠ Urgent" badge, and a "Urgent only" checkbox
    filters the current page's rows to just those (client-side, since
    urgency is computed from trial/expiry logic, not a DB column).

A NOTE OF HONESTY ABOUT #1/#3/#18
----------------------------------
#1 and #3 add `profiles!inner(...)` / OR-across-joined-table filtering and
date-range filtering at the Supabase/PostgREST query level — this is
correct per PostgREST's documented behavior for embedded-resource filters,
but I have no live Supabase instance to run it against, so please smoke-
test search-by-seller-name and the date filter once after patching.
#18's "Urgent only" filter is applied client-side to whatever page of rows
was already fetched (urgency isn't a stored column), so on the "Load more"
model it filters what's loaded, not the full matching set server-side —
noted in the code comment there too.
"""

import argparse
import sys

# Each patch: (id, description, old, new)
# `old` must appear EXACTLY ONCE in the input file for the patch to apply.
PATCHES = []


def p(id_, desc, old, new):
    PATCHES.append({"id": id_, "desc": desc, "old": old, "new": new})


# ─────────────────────────────────────────────────────────────────────────
# REGION A — CSS additions (fixes #4, #6, #10, #16, #17, #18)
# ─────────────────────────────────────────────────────────────────────────
p(
    "css-additions",
    "Add CSS for: always-visible action dropdown (#4), sticky thead (#6), "
    "active-filter highlighting (#10), selected-count badge (#16), columns "
    "menu (#17), urgent badge (#18).",
    old="""    .action-menu-wrap { position: relative; display: none; }""",
    new="""    /* PATCH #4: the "Actions \u25be" dropdown already existed in the markup for
       every listings row, but this rule hid it unconditionally — it never
       rendered even though JS (toggleActionMenu) was fully wired up. Making
       it an always-available overflow menu (not just a mobile fallback) is
       what lets the desktop action column be trimmed to a few primary
       buttons instead of a wall of a dozen icons. */
    .action-menu-wrap { position: relative; display: inline-flex; }
    /* PATCH #6: table header stays visible while the page scrolls past it.
       top:60px matches .topbar's fixed height so the header doesn't hide
       underneath it. */
    .table-wrap table thead th { position: sticky; top: 60px; z-index: 6; }
    .table-wrap table thead th:last-child { top: 60px; z-index: 8; }
    /* PATCH #10: visual sync between the filter dropdowns/search box and
       the removable filter chips above the table — an active filter's
       control is now visibly highlighted, not just represented by a chip. */
    .filter-select.filter-active, .filter-search.filter-active {
      border-color: var(--green); background: var(--green-light);
    }
    /* PATCH #16: persistent selected-count badge next to the header
       checkbox, visible even when scrolled away from the bulk bar. */
    #listings-select-count-badge {
      display: none; margin-left: 4px; font-size: 10px; font-weight: 700;
      background: var(--green); color: #fff; padding: 1px 5px;
      border-radius: 8px; vertical-align: middle;
    }
    /* PATCH #17: column visibility toggle ("Columns \u25be" menu) */
    #columns-menu {
      display: none; position: absolute; right: 0; top: 36px;
      background: var(--white); border: 1px solid var(--border);
      border-radius: 8px; box-shadow: 0 8px 24px rgba(0,0,0,.15);
      padding: 10px 14px; z-index: 50; min-width: 170px;
    }
    #columns-menu label { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 4px 0; cursor: pointer; color: var(--text-2); }
    #view-listings.hide-col-location .table-wrap table th:nth-child(3),
    #view-listings.hide-col-location .table-wrap table td:nth-child(3) { display: none; }
    #view-listings.hide-col-category .table-wrap table th:nth-child(5),
    #view-listings.hide-col-category .table-wrap table td:nth-child(5) { display: none; }
    #view-listings.hide-col-payment .table-wrap table th:nth-child(7),
    #view-listings.hide-col-payment .table-wrap table td:nth-child(7) { display: none; }
    /* PATCH #18: urgent-row badge */
    .badge.urgent-flag { background: var(--red-light); color: var(--red); margin-left: 6px; }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION B — new HTML modals (fixes #8, #12, #13), inserted before the
# existing "LISTING DETAIL MODAL" comment so they live alongside the rest.
# ─────────────────────────────────────────────────────────────────────────
p(
    "new-modals",
    "Insert Extend-expiry modal (#8), Feature-listing modal (#12), and "
    "Image lightbox modal (#13).",
    old="""<!-- LISTING DETAIL MODAL -->""",
    new="""<!-- PATCH #8: dedicated extend-expiry modal (numeric days + presets),
     replacing the old flow that repurposed the generic reason-textarea
     confirm modal for a number input. -->
<div class="modal-overlay" id="extend-date-modal" onclick="handleOverlayClick(event,'extend-date-modal')">
  <div class="modal" style="max-width:400px" role="dialog" aria-modal="true" aria-labelledby="extend-date-title">
    <div class="modal-header"><h3 id="extend-date-title">Extend expiry date</h3><button class="modal-close" onclick="closeExtendDateModal()" aria-label="Close">\u00d7</button></div>
    <div class="modal-body">
      <div class="field"><label>Listing</label><div class="val" id="extend-date-listing-title">\u2014</div></div>
      <div class="field"><label>Extend by (days)</label>
        <input type="number" id="extend-date-days" min="1" value="14"/>
        <div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">
          <button type="button" class="action-btn view" onclick="document.getElementById('extend-date-days').value=7">7d</button>
          <button type="button" class="action-btn view" onclick="document.getElementById('extend-date-days').value=14">14d</button>
          <button type="button" class="action-btn view" onclick="document.getElementById('extend-date-days').value=30">30d</button>
          <button type="button" class="action-btn view" onclick="document.getElementById('extend-date-days').value=60">60d</button>
          <button type="button" class="action-btn view" onclick="document.getElementById('extend-date-days').value=90">90d</button>
        </div>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-modal cancel" onclick="closeExtendDateModal()">Cancel</button>
      <button class="btn-modal approve" id="btn-confirm-extend-date" onclick="confirmExtendDate()">Extend</button>
    </div>
  </div>
</div>

<!-- PATCH #12: one Feature-listing modal replacing the two separate flows
     (silent free-comp vs. "process upgrade") an admin previously had to
     choose between correctly every time. -->
<div class="modal-overlay" id="feature-listing-modal" onclick="handleOverlayClick(event,'feature-listing-modal')">
  <div class="modal" style="max-width:420px" role="dialog" aria-modal="true" aria-labelledby="feature-listing-title">
    <div class="modal-header"><h3 id="feature-listing-title">Feature this listing</h3><button class="modal-close" onclick="closeFeatureListingModal()" aria-label="Close">\u00d7</button></div>
    <div class="modal-body">
      <div class="field"><label>Listing</label><div class="val" id="feature-listing-name">\u2014</div></div>
      <div class="field check-field"><input type="checkbox" id="feature-was-paid" onchange="toggleFeaturePaidAmount()"/><label for="feature-was-paid">The seller paid for this upgrade</label></div>
      <div class="field" id="feature-amount-wrap" style="display:none"><label>Amount received (KES)</label><input type="number" id="feature-amount"/></div>
      <div class="confirm-warning" id="feature-free-note">This will feature the listing without recording a payment (admin comp). Check the box above if the seller actually paid, so it shows up in Payments/Revenue.</div>
    </div>
    <div class="modal-footer">
      <button class="btn-modal cancel" onclick="closeFeatureListingModal()">Cancel</button>
      <button class="btn-modal approve" onclick="confirmFeatureListing()">Feature listing</button>
    </div>
  </div>
</div>

<!-- PATCH #13: image lightbox for listing thumbnails -->
<div class="modal-overlay" id="image-lightbox-modal" onclick="handleOverlayClick(event,'image-lightbox-modal')">
  <div class="modal" style="max-width:720px;background:transparent;box-shadow:none" role="dialog" aria-modal="true" aria-label="Photo preview">
    <img id="image-lightbox-img" src="" alt="" style="width:100%;border-radius:10px;display:block"/>
    <div style="text-align:center;margin-top:10px"><button class="btn-modal cancel" onclick="closeImageLightbox()">Close</button></div>
  </div>
</div>

<!-- LISTING DETAIL MODAL -->""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION C — filters-row HTML (fix #11: date range) + search placeholder (#3)
# ─────────────────────────────────────────────────────────────────────────
p(
    "filters-row-html",
    "Add Posted date-range filter (#11) and widen the search placeholder "
    "to mention seller/listing-number (#3), and add an Urgent-only "
    "checkbox (#18).",
    old="""          <select class="filter-select" id="filter-cat" onchange="loadAllListings()" aria-label="Filter by category">
            <option value="">All categories</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="boarding">Boarding House</option>
            <option value="airbnb">Airbnb / Holiday Rental</option>
            <option value="commercial">Shops & Offices</option>
          </select>
          <input class="filter-search" id="filter-search" type="text" placeholder="Search title or area…" oninput="debouncedLoad()" aria-label="Search listings by title or area"/>
        </div>""",
    new="""          <select class="filter-select" id="filter-cat" onchange="loadAllListings()" aria-label="Filter by category">
            <option value="">All categories</option>
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="boarding">Boarding House</option>
            <option value="airbnb">Airbnb / Holiday Rental</option>
            <option value="commercial">Shops & Offices</option>
          </select>
          <label style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px">Posted from <input class="filter-select" type="date" id="filter-date-from" onchange="loadAllListings()"/></label>
          <label style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:4px">to <input class="filter-select" type="date" id="filter-date-to" onchange="loadAllListings()"/></label>
          <button class="action-btn view" onclick="document.getElementById('filter-date-from').value='';document.getElementById('filter-date-to').value='';loadAllListings()">Clear dates</button>
          <input class="filter-search" id="filter-search" type="text" placeholder="Search title, area, seller, or listing #…" oninput="debouncedLoad()" aria-label="Search listings by title, area, seller, or listing number"/>
          <label style="font-size:12px;color:var(--text-3);display:flex;align-items:center;gap:6px"><input type="checkbox" id="filter-urgent-only" onchange="loadAllListings()"/> Urgent only</label>
        </div>""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION D — table header row (fix #7: sortable Status/Category/Payment)
# ─────────────────────────────────────────────────────────────────────────
p(
    "thead-sortable-columns",
    "Make Category, Status, Payment columns sortable (#7); add a live "
    "selected-count badge next to the header checkbox (#16).",
    old="""<thead><tr><th><input type="checkbox" onchange="toggleSelectAllListings(this.checked)"/></th><th>Property</th><th>Location</th><th class="sortable-th" onclick="setListingsSort('price')" data-tip="Click to sort">Price <span id="sort-arrow-price" class="sort-arrow"></span></th><th>Category</th><th>Status</th><th>Payment</th><th class="sortable-th" onclick="setListingsSort('created_at')" data-tip="Click to sort">Posted <span id="sort-arrow-created_at" class="sort-arrow"></span></th><th>Expires</th><th>Actions</th></tr></thead>""",
    new="""<thead><tr><th><input type="checkbox" onchange="toggleSelectAllListings(this.checked)"/><span id="listings-select-count-badge"></span></th><th>Property</th><th>Location</th><th class="sortable-th" onclick="setListingsSort('price')" data-tip="Click to sort">Price <span id="sort-arrow-price" class="sort-arrow"></span></th><th class="sortable-th" onclick="setListingsSort('category')" data-tip="Click to sort">Category <span id="sort-arrow-category" class="sort-arrow"></span></th><th class="sortable-th" onclick="setListingsSort('status')" data-tip="Click to sort">Status <span id="sort-arrow-status" class="sort-arrow"></span></th><th class="sortable-th" onclick="setListingsSort('payment_status')" data-tip="Click to sort">Payment <span id="sort-arrow-payment_status" class="sort-arrow"></span></th><th class="sortable-th" onclick="setListingsSort('created_at')" data-tip="Click to sort">Posted <span id="sort-arrow-created_at" class="sort-arrow"></span></th><th>Expires</th><th>Actions</th></tr></thead>""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION E — card-header: add "Columns" control next to Export CSV (#17)
# ─────────────────────────────────────────────────────────────────────────
p(
    "card-header-columns-btn",
    "Add the 'Columns \u25be' visibility toggle next to Export CSV (#17).",
    old="""            <span style="font-size:12px;color:var(--text-3)" id="listings-count"></span>
            <div class="action-btns"><button class="action-btn view" onclick="exportListingsCSV()">Export CSV</button></div>
          </div>
        </div>
        <div class="tab-bar">""",
    new="""            <span style="font-size:12px;color:var(--text-3)" id="listings-count"></span>
            <div class="action-btns">
              <div style="position:relative;display:inline-block">
                <button class="action-btn view" onclick="toggleColumnsMenu()">Columns \u25be</button>
                <div id="columns-menu">
                  <label><input type="checkbox" id="col-toggle-location" checked onchange="applyColumnVisibility()"/> Location</label>
                  <label><input type="checkbox" id="col-toggle-category" checked onchange="applyColumnVisibility()"/> Category</label>
                  <label><input type="checkbox" id="col-toggle-payment" checked onchange="applyColumnVisibility()"/> Payment</label>
                </div>
              </div>
              <button class="action-btn view" onclick="exportListingsCSV()">Export CSV</button>
            </div>
          </div>
        </div>
        <div class="tab-bar">""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION F — bulk bar: add Feature / Extend (#9)
# ─────────────────────────────────────────────────────────────────────────
p(
    "bulk-bar-buttons",
    "Add 'Feature selected' and 'Extend expiry\u2026' to the bulk action bar (#9).",
    old="""        <div class="bulk-bar" id="bulk-bar">
          <span class="bulk-count" id="bulk-count"></span>
          <button class="action-btn approve" onclick="bulkApprove()">Approve selected</button>
          <button class="action-btn reject"  onclick="bulkReject()">Reject selected</button>
          <button class="action-btn view"    onclick="bulkRecycle()">Move to recycle bin</button>
        </div>""",
    new="""        <div class="bulk-bar" id="bulk-bar">
          <span class="bulk-count" id="bulk-count"></span>
          <button class="action-btn approve" onclick="bulkApprove()">Approve selected</button>
          <button class="action-btn reject"  onclick="bulkReject()">Reject selected</button>
          <button class="action-btn feature" onclick="bulkFeature()">Feature selected</button>
          <button class="action-btn view"    onclick="bulkExtendPrompt()">Extend expiry\u2026</button>
          <button class="action-btn view"    onclick="bulkRecycle()">Move to recycle bin</button>
        </div>""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION G — JS: ICONS map gets a 'copylink' icon (#14)
# ─────────────────────────────────────────────────────────────────────────
p(
    "icons-copylink",
    "Add a clipboard/copy-link icon to the ICONS map (#14).",
    old="""    tiktok:   '<path d="M9 12a4 4 0 104 4V4c1 2 3 3 5 3"/>',
  };""",
    new="""    tiktok:   '<path d="M9 12a4 4 0 104 4V4c1 2 3 3 5 3"/>',
    copylink: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
  };""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION H — helper JS block: locked-reason (#15), page size (#5), URL
# state (#2), localStorage helpers + column visibility (#17), lightbox
# (#13), copy-link (#14). Inserted right after listingActionsLocked/tip.
# ─────────────────────────────────────────────────────────────────────────
p(
    "locked-reason-and-helpers",
    "Add lockedReasonFor() with a specific per-row reason (#15), and a "
    "block of new helper functions for URL state (#2), page size (#5), "
    "column visibility (#17), lightbox (#13), and copy-link (#14).",
    old="""  function listingActionsLocked(l) { return l.status === 'rejected' || l.status === 'paused' || l.status === 'occupied' || !!l.is_disabled; }
  const LOCKED_ACTION_TIP = 'Unavailable — listing is rejected, deactivated, paused, or occupied/sold';""",
    new="""  function listingActionsLocked(l) { return l.status === 'rejected' || l.status === 'paused' || l.status === 'occupied' || !!l.is_disabled; }
  const LOCKED_ACTION_TIP = 'Unavailable — listing is rejected, deactivated, paused, or occupied/sold';
  // PATCH #15: state the SPECIFIC reason an action is locked, instead of
  // listing every possible reason on every row regardless of which applies.
  function lockedReasonFor(l) {
    if (!l) return LOCKED_ACTION_TIP;
    if (l.status === 'rejected') return 'Unavailable — this listing was rejected';
    if (l.status === 'occupied') return 'Unavailable — this listing is marked occupied/sold';
    if (l.status === 'paused')   return 'Unavailable — this listing is paused';
    if (l.is_disabled)           return 'Unavailable — this listing is deactivated';
    return LOCKED_ACTION_TIP;
  }

  // PATCH #5: listings load a lighter 50 rows per page instead of 200 —
  // every row renders a photo, several badges, and up to a dozen buttons,
  // so 200 at once was heavy, especially on mobile.
  const LISTINGS_PAGE_SIZE = 50;

  // PATCH #2: listings view state (tab/filters/sort) lives in the URL hash
  // so the page is bookmarkable/shareable and survives a refresh.
  function syncListingsUrlState() {
    if (currentView !== 'listings') return;
    const params = new URLSearchParams();
    params.set('tab', currentTab);
    const county = document.getElementById('filter-county')?.value; if (county) params.set('county', county);
    const area   = document.getElementById('filter-area')?.value;   if (area)   params.set('area', area);
    const cat    = document.getElementById('filter-cat')?.value;    if (cat)    params.set('cat', cat);
    const search = document.getElementById('filter-search')?.value.trim(); if (search) params.set('q', search);
    const dFrom  = document.getElementById('filter-date-from')?.value; if (dFrom) params.set('from', dFrom);
    const dTo    = document.getElementById('filter-date-to')?.value;   if (dTo)   params.set('to', dTo);
    if (listingsSortBy  !== 'created_at') params.set('sort', listingsSortBy);
    if (listingsSortDir !== 'desc')       params.set('dir', listingsSortDir);
    try { history.replaceState(null, '', location.pathname + location.search + '#listings?' + params.toString()); } catch (e) {}
  }
  function restoreListingsUrlStateIfPresent() {
    const m = location.hash.match(/^#listings\\?(.*)$/);
    if (!m) return false;
    const params = new URLSearchParams(m[1]);
    if (params.get('tab')) {
      currentTab = params.get('tab');
      document.querySelectorAll('#view-listings .tab-bar .tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById('tab-' + currentTab)?.classList.add('active');
    }
    if (params.get('county')) { const el = document.getElementById('filter-county'); if (el) { el.value = params.get('county'); onCountyChangeForRestore(); } }
    if (params.get('area'))   { const el = document.getElementById('filter-area');   if (el) el.value = params.get('area'); }
    if (params.get('cat'))    { const el = document.getElementById('filter-cat');    if (el) el.value = params.get('cat'); }
    if (params.get('q'))      { const el = document.getElementById('filter-search'); if (el) el.value = params.get('q'); }
    if (params.get('from'))   { const el = document.getElementById('filter-date-from'); if (el) el.value = params.get('from'); }
    if (params.get('to'))     { const el = document.getElementById('filter-date-to');   if (el) el.value = params.get('to'); }
    if (params.get('sort'))   listingsSortBy  = params.get('sort');
    if (params.get('dir'))    listingsSortDir = params.get('dir');
    return true;
  }
  // onFilterCountyChange() (defined elsewhere) also triggers a load, which
  // we don't want mid-restore (loadAllListings runs once right after this
  // whole restore completes) — so restoring the area dropdown's option
  // list happens without an extra network round trip.
  function onCountyChangeForRestore() {
    const county = document.getElementById('filter-county').value;
    const areaSel = document.getElementById('filter-area');
    const areas = NK_AREAS_BY_COUNTY[county];
    if (areas && areas.length) {
      areaSel.innerHTML = '<option value="">All areas</option>' + areas.map(a => `<option value="${esc(a)}">${esc(a)}</option>`).join('');
      areaSel.disabled = false;
    } else {
      areaSel.innerHTML = county ? `<option value="">All of ${esc(county)} (areas coming soon)</option>` : '<option value="">All areas</option>';
      areaSel.disabled = !!county && !areas;
    }
  }

  // Small localStorage JSON helpers (used by PATCH #17)
  function ls_setJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function ls_getJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v || d; } catch (e) { return d; } }

  // PATCH #17: per-admin column visibility for the listings table
  function toggleColumnsMenu() {
    const m = document.getElementById('columns-menu');
    if (m) m.style.display = (m.style.display === 'block') ? 'none' : 'block';
  }
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#columns-menu') && e.target.getAttribute('onclick') !== 'toggleColumnsMenu()') {
      const m = document.getElementById('columns-menu');
      if (m) m.style.display = 'none';
    }
  });
  function applyColumnVisibility() {
    const showLocation = document.getElementById('col-toggle-location')?.checked !== false;
    const showCategory = document.getElementById('col-toggle-category')?.checked !== false;
    const showPayment  = document.getElementById('col-toggle-payment')?.checked  !== false;
    const el = document.getElementById('view-listings');
    if (!el) return;
    el.classList.toggle('hide-col-location', !showLocation);
    el.classList.toggle('hide-col-category', !showCategory);
    el.classList.toggle('hide-col-payment', !showPayment);
    ls_setJSON('nk_admin_listing_cols', { location: showLocation, category: showCategory, payment: showPayment });
  }
  function restoreColumnVisibility() {
    const saved = ls_getJSON('nk_admin_listing_cols', { location: true, category: true, payment: true });
    const locEl = document.getElementById('col-toggle-location');
    const catEl = document.getElementById('col-toggle-category');
    const payEl = document.getElementById('col-toggle-payment');
    if (locEl) locEl.checked = saved.location !== false;
    if (catEl) catEl.checked = saved.category !== false;
    if (payEl) payEl.checked = saved.payment  !== false;
    applyColumnVisibility();
  }

  // PATCH #13: click a listing thumbnail to see it larger
  function openImageLightbox(url) {
    if (!url) return;
    const img = document.getElementById('image-lightbox-img');
    img.src = url;
    document.getElementById('image-lightbox-modal').classList.add('open');
  }
  function closeImageLightbox() {
    document.getElementById('image-lightbox-modal').classList.remove('open');
    document.getElementById('image-lightbox-img').src = '';
  }

  // PATCH #14: copy a listing's live public URL
  async function copyListingLink(id) {
    const l = _listings[id];
    if (!l || !l.listing_number) { toast('No live link yet \u2014 this listing has no listing number', 'error'); return; }
    const url = `${location.origin}/listing?id=${String(l.listing_number).padStart(6,'0')}`;
    try {
      await navigator.clipboard.writeText(url);
      toast('Live link copied \u2713', 'success');
    } catch (e) {
      toast('Could not copy automatically \u2014 link: ' + url, 'error');
    }
  }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION I — renderListingFilterChips: sync active state onto the controls
# themselves (#10)
# ─────────────────────────────────────────────────────────────────────────
p(
    "filter-chips-active-sync",
    "Highlight the filter dropdowns/search box when their chip is active (#10).",
    old="""    if (!chips.length) { wrap.style.display='none'; wrap.innerHTML=''; return; }
    wrap.style.display = 'flex';
    wrap.innerHTML = chips.map((c,i)=>`<span class="filter-chip">${esc(c.label)}<button onclick="window.__clearListingChip(${i})" aria-label="Clear filter">\\u2715</button></span>`).join('');
    window.__clearListingChip = (i) => chips[i].clear();
  }""",
    new="""    // PATCH #10: keep the dropdowns/search box visibly in sync with the
    // chips row, instead of the chips being the only place showing state.
    document.getElementById('filter-county')?.classList.toggle('filter-active', !!county);
    document.getElementById('filter-area')?.classList.toggle('filter-active', !!area);
    document.getElementById('filter-cat')?.classList.toggle('filter-active', !!cat);
    document.getElementById('filter-search')?.classList.toggle('filter-active', !!search);
    if (!chips.length) { wrap.style.display='none'; wrap.innerHTML=''; return; }
    wrap.style.display = 'flex';
    wrap.innerHTML = chips.map((c,i)=>`<span class="filter-chip">${esc(c.label)}<button onclick="window.__clearListingChip(${i})" aria-label="Clear filter">\\u2715</button></span>`).join('');
    window.__clearListingChip = (i) => chips[i].clear();
  }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION J — loadTabCounts (#1)
# ─────────────────────────────────────────────────────────────────────────
p(
    "tab-counts-respect-filters",
    "Tab counts (#1) now apply the same county/area/category/date-range/"
    "seller filters as the table, instead of always being platform-wide.",
    old="""  async function loadTabCounts() {
    const [
      {count:pend}, {count:actv}, {count:feat}, {count:tot}, {count:trial}, {count:multi}, {count:inactive}
    ] = await Promise.all([
      db.from('listings').select('*',{count:'exact',head:true}).eq('status','pending').eq('recycle_bin',false),
      db.from('listings').select('*',{count:'exact',head:true}).eq('status','active').eq('is_disabled',false).eq('recycle_bin',false),
      db.from('listings').select('*',{count:'exact',head:true}).eq('is_featured',true).eq('status','active').eq('is_disabled',false).eq('recycle_bin',false),
      db.from('listings').select('*',{count:'exact',head:true}).eq('recycle_bin',false),
      db.from('listings').select('*',{count:'exact',head:true}).eq('payment_status','trial').eq('recycle_bin',false),
      db.from('listings').select('*, listing_units!inner(id)',{count:'exact',head:true}).eq('recycle_bin',false),
      db.from('listings').select('*',{count:'exact',head:true}).eq('is_disabled',true).eq('recycle_bin',false),
    ]);""",
    new="""  // PATCH #1: tab counts respect the currently active filters, so e.g.
  // switching the county filter updates "Pending (n)" etc. to match what
  // clicking that tab would actually show, instead of a platform-wide count.
  function applyListingCountFilters(q) {
    const county = document.getElementById('filter-county')?.value;
    const area   = document.getElementById('filter-area')?.value;
    const cat    = document.getElementById('filter-cat')?.value;
    const search = document.getElementById('filter-search')?.value.trim();
    const dFrom  = document.getElementById('filter-date-from')?.value;
    const dTo    = document.getElementById('filter-date-to')?.value;
    if (typeof filterSellerId !== 'undefined' && filterSellerId) q = q.eq('seller_id', filterSellerId);
    if (county) q = q.eq('county', county);
    if (area)   q = q.eq('area', area);
    if (cat)    q = q.eq('category', cat);
    if (search) q = q.or(`title.ilike.%${search}%,area.ilike.%${search}%`);
    if (dFrom)  q = q.gte('created_at', dFrom + 'T00:00:00');
    if (dTo)    q = q.lte('created_at', dTo + 'T23:59:59');
    return q;
  }
  async function loadTabCounts() {
    const countBase = () => applyListingCountFilters(db.from('listings').select('*',{count:'exact',head:true}).eq('recycle_bin',false));
    const [
      {count:pend}, {count:actv}, {count:feat}, {count:tot}, {count:trial}, {count:multi}, {count:inactive}
    ] = await Promise.all([
      countBase().eq('status','pending'),
      countBase().eq('status','active').eq('is_disabled',false),
      countBase().eq('is_featured',true).eq('status','active').eq('is_disabled',false),
      countBase(),
      countBase().eq('payment_status','trial'),
      applyListingCountFilters(db.from('listings').select('*, listing_units!inner(id)',{count:'exact',head:true}).eq('recycle_bin',false)),
      countBase().eq('is_disabled',true),
    ]);""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION K — loadAllListings: select() join (#3), search widening (#3),
# date range (#11), page size (#5), URL sync (#2), urgent-only filter (#18)
# ─────────────────────────────────────────────────────────────────────────
p(
    "load-all-listings-select-join",
    "Widen the seller join to !inner when searching, so seller name/phone "
    "can be matched (#3), in loadAllListings().",
    old="""    const listingsSelect = currentTab==='multiunit'
      ? '*, profiles(full_name, email, subscription_tier, subscription_expires_at), listing_photos(*), listing_units!inner(*), social_posts(*)'
      : '*, profiles(full_name, email, subscription_tier, subscription_expires_at), listing_photos(*), listing_units(*), social_posts(*)';
    let q = db.from('listings').select(listingsSelect,{count:'exact'}).eq('recycle_bin',false);""",
    new="""    // PATCH #3: when there's a search term, join profiles with !inner so the
    // OR filter below can also match on seller name/phone (a listing always
    // has a seller_id, so this doesn't drop any rows that would otherwise
    // match on title/area alone).
    const _searchTerm0 = document.getElementById('filter-search').value.trim();
    const _profilesJoin0 = _searchTerm0
      ? 'profiles!inner(full_name, email, phone, subscription_tier, subscription_expires_at)'
      : 'profiles(full_name, email, subscription_tier, subscription_expires_at)';
    const listingsSelect = currentTab==='multiunit'
      ? `*, ${_profilesJoin0}, listing_photos(*), listing_units!inner(*), social_posts(*)`
      : `*, ${_profilesJoin0}, listing_photos(*), listing_units(*), social_posts(*)`;
    let q = db.from('listings').select(listingsSelect,{count:'exact'}).eq('recycle_bin',false);""",
)

p(
    "load-all-listings-search-and-dates",
    "Widen the search OR clause to seller name/phone/listing number (#3), "
    "add the Posted date-range filter (#11), and switch to LISTINGS_PAGE_SIZE (#5).",
    old="""    if (search) q = q.or(`title.ilike.%${search}%,area.ilike.%${search}%`);
    q = q.order(listingsSortBy, {ascending: listingsSortDir==='asc'}).range(listingsPage*PAGE_SIZE, listingsPage*PAGE_SIZE+PAGE_SIZE-1);

    const {data, count, error} = await q;
    document.getElementById('listings-count').textContent = `${count||0} listings`;""",
    new="""    if (search) {
      // PATCH #3: search now also matches seller name, seller phone, and
      // (if the search term is numeric) the human-facing listing number.
      const orParts = [
        `title.ilike.%${search}%`,
        `area.ilike.%${search}%`,
        `profiles.full_name.ilike.%${search}%`,
        `profiles.phone.ilike.%${search}%`,
      ];
      if (/^\\d+$/.test(search)) orParts.push(`listing_number.eq.${parseInt(search, 10)}`);
      q = q.or(orParts.join(','));
    }
    // PATCH #11: Posted date-range filter, matching the pattern already
    // used on the Payments/Analytics/Activity-log views.
    const _dateFrom0 = document.getElementById('filter-date-from')?.value;
    const _dateTo0   = document.getElementById('filter-date-to')?.value;
    if (_dateFrom0) q = q.gte('created_at', _dateFrom0 + 'T00:00:00');
    if (_dateTo0)   q = q.lte('created_at', _dateTo0 + 'T23:59:59');
    q = q.order(listingsSortBy, {ascending: listingsSortDir==='asc'}).range(listingsPage*LISTINGS_PAGE_SIZE, listingsPage*LISTINGS_PAGE_SIZE+LISTINGS_PAGE_SIZE-1);

    const {data: _rawData, count, error} = await q;
    // PATCH #18: "Urgent only" filters the fetched page client-side, since
    // urgency (pending >24h, or expiring soon) is computed from
    // trial/expiry logic, not a stored column. This filters what's on the
    // current page, not the full matching set across all pages.
    const _urgentOnly = document.getElementById('filter-urgent-only')?.checked;
    const data = (_urgentOnly && _rawData) ? _rawData.filter(l => {
      const isPendingUrgent = l.status === 'pending' && ((Date.now() - new Date(l.created_at).getTime()) > 24*3600*1000);
      const isExpiryUrgent  = listingDaysLeft(l).cls === 'pending';
      return isPendingUrgent || isExpiryUrgent;
    }) : _rawData;
    document.getElementById('listings-count').textContent = `${count||0} listings`;""",
)

p(
    "load-all-listings-loadmore-pagesize",
    "Use LISTINGS_PAGE_SIZE for the Load-more visibility check (#5), and "
    "persist filter state to the URL after a successful load (#2).",
    old="""    loadMoreWrap.style.display = (data.length === PAGE_SIZE) ? 'block' : 'none';
    renderBulkBar();
  }
  function loadMoreListings() { listingsPage++; loadAllListings(true); }""",
    new="""    loadMoreWrap.style.display = (data.length === LISTINGS_PAGE_SIZE) ? 'block' : 'none';
    renderBulkBar();
    syncListingsUrlState(); // PATCH #2
  }
  function loadMoreListings() { listingsPage++; loadAllListings(true); }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION L — fetchAllMatchingListings: mirror the select/search/date changes
# ─────────────────────────────────────────────────────────────────────────
p(
    "fetch-all-matching-select-join",
    "Mirror the !inner seller join for search in fetchAllMatchingListings() (#3).",
    old="""    const listingsSelect = currentTab==='multiunit'
      ? '*, profiles(full_name, email, subscription_tier, subscription_expires_at), listing_photos(*), listing_units!inner(*), social_posts(*)'
      : '*, profiles(full_name, email, subscription_tier, subscription_expires_at), listing_photos(*), listing_units(*), social_posts(*)';
    let q = db.from('listings').select(listingsSelect).eq('recycle_bin',false);""",
    new="""    const _searchTerm1 = document.getElementById('filter-search').value.trim();
    const _profilesJoin1 = _searchTerm1
      ? 'profiles!inner(full_name, email, phone, subscription_tier, subscription_expires_at)'
      : 'profiles(full_name, email, subscription_tier, subscription_expires_at)';
    const listingsSelect = currentTab==='multiunit'
      ? `*, ${_profilesJoin1}, listing_photos(*), listing_units!inner(*), social_posts(*)`
      : `*, ${_profilesJoin1}, listing_photos(*), listing_units(*), social_posts(*)`;
    let q = db.from('listings').select(listingsSelect).eq('recycle_bin',false);""",
)

p(
    "fetch-all-matching-search-and-dates",
    "Mirror the widened search OR clause and Posted date-range filter in "
    "fetchAllMatchingListings() (#3, #11).",
    old="""    if (search) q = q.or(`title.ilike.%${search}%,area.ilike.%${search}%`);
    q = q.order('created_at',{ascending:false}).limit(SELECT_ALL_MAX);""",
    new="""    if (search) {
      const orParts = [
        `title.ilike.%${search}%`,
        `area.ilike.%${search}%`,
        `profiles.full_name.ilike.%${search}%`,
        `profiles.phone.ilike.%${search}%`,
      ];
      if (/^\\d+$/.test(search)) orParts.push(`listing_number.eq.${parseInt(search, 10)}`);
      q = q.or(orParts.join(','));
    }
    const _dateFrom1 = document.getElementById('filter-date-from')?.value;
    const _dateTo1   = document.getElementById('filter-date-to')?.value;
    if (_dateFrom1) q = q.gte('created_at', _dateFrom1 + 'T00:00:00');
    if (_dateTo1)   q = q.lte('created_at', _dateTo1 + 'T23:59:59');
    q = q.order('created_at',{ascending:false}).limit(SELECT_ALL_MAX);""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION M — exportListingsCSV: apply the date range too (#11)
# ─────────────────────────────────────────────────────────────────────────
p(
    "export-csv-date-range",
    "Apply the Posted date-range filter to CSV export too (#11).",
    old="""    if (filterSellerId) q = q.eq('seller_id', filterSellerId);
    if (county) q = q.eq('county',county);
    if (area)   q = q.eq('area',area);
    if (cat)    q = q.eq('category',cat);
    if (search) q = q.or(`title.ilike.%${search}%,area.ilike.%${search}%`);
    const {data} = await q;""",
    new="""    if (filterSellerId) q = q.eq('seller_id', filterSellerId);
    if (county) q = q.eq('county',county);
    if (area)   q = q.eq('area',area);
    if (cat)    q = q.eq('category',cat);
    if (search) q = q.or(`title.ilike.%${search}%,area.ilike.%${search}%`);
    const _csvDateFrom = document.getElementById('filter-date-from')?.value;
    const _csvDateTo   = document.getElementById('filter-date-to')?.value;
    if (_csvDateFrom) q = q.gte('created_at', _csvDateFrom + 'T00:00:00');
    if (_csvDateTo)   q = q.lte('created_at', _csvDateTo + 'T23:59:59');
    const {data} = await q;""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION N — setListingsSort: extend sortable columns (#7) + sync URL (#2)
# ─────────────────────────────────────────────────────────────────────────
p(
    "set-listings-sort",
    "Sync URL state after changing sort (#2); renderSortArrows now also "
    "covers Category/Status/Payment (#7).",
    old="""  function setListingsSort(col) {
    if (listingsSortBy === col) {
      listingsSortDir = listingsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      listingsSortBy = col;
      listingsSortDir = col === 'price' ? 'asc' : 'desc';
    }
    loadAllListings();
  }
  function renderSortArrows() {
    ['price','created_at'].forEach(col => {""",
    new="""  function setListingsSort(col) {
    if (listingsSortBy === col) {
      listingsSortDir = listingsSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      listingsSortBy = col;
      listingsSortDir = col === 'price' ? 'asc' : 'desc';
    }
    loadAllListings();
  }
  function renderSortArrows() {
    ['price','created_at','category','status','payment_status'].forEach(col => {""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION O — onFilterCountyChange / setTab: sync URL state (#2)
# ─────────────────────────────────────────────────────────────────────────
p(
    "on-county-change-url-sync",
    "Sync URL state when the county/area filter changes (#2).",
    old="""      areaSel.disabled = !!county && !areas;
    }
    loadAllListings();
  }""",
    new="""      areaSel.disabled = !!county && !areas;
    }
    loadAllListings();
  } // note: loadAllListings() itself calls syncListingsUrlState() (PATCH #2) via the load-more/success path""",
)

p(
    "set-tab-url-sync",
    "Sync URL state when switching tabs (#2).",
    old="""  function setTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tab-'+tab); if(btn) btn.classList.add('active');
    if(currentView==='listings') loadAllListings(); else showView('listings');
  }""",
    new="""  function setTab(tab) {
    currentTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('tab-'+tab); if(btn) btn.classList.add('active');
    if(currentView==='listings') { loadAllListings(); syncListingsUrlState(); } else showView('listings');
  }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION P — showView('listings') hook: restore URL state (#2) + column
# visibility (#17)
# ─────────────────────────────────────────────────────────────────────────
p(
    "show-view-listings-hook",
    "On entering the Listings view, restore URL state (#2) and saved "
    "column visibility (#17) before loading.",
    old="""    if(v==='listings')     { loadAllListings(); loadTabCounts(); }""",
    new="""    if(v==='listings')     { restoreListingsUrlStateIfPresent(); restoreColumnVisibility(); loadAllListings(); loadTabCounts(); }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION Q — extendListingDate / doExtendListing: modal-based flow (#8),
# plus bulk extend (#9)
# ─────────────────────────────────────────────────────────────────────────
p(
    "extend-listing-date-modal-flow",
    "Replace the reason-textarea-as-number-input flow with a dedicated "
    "modal (#8), and add bulk-extend support (#9).",
    old="""  function extendListingDate(id) {
    const l = _listings[id]; if (!l) return;
    openConfirm({
      title:'Extend expiry date',
      message:`Extend "${l.title}" by how many days?`,
      requireReason:true, reasonLabel:'Number of days',
      confirmText:'Extend', confirmClass:'approve',
      onConfirm:(daysStr)=>{
        const days = parseInt(daysStr, 10);
        if (!days || days <= 0) { toast('Enter a valid number of days','error'); return; }
        doExtendListing(id, days);
      }
    });
  }""",
    new="""  // PATCH #8: dedicated modal with a real number input + day presets,
  // instead of parseInt-ing whatever's typed into the generic reason box.
  let extendingListingId = null;
  function extendListingDate(id) {
    const l = _listings[id]; if (!l) return;
    extendingListingId = id;
    document.getElementById('extend-date-listing-title').textContent = l.title || id;
    document.getElementById('extend-date-days').value = 14;
    document.getElementById('extend-date-modal').classList.add('open');
    focusModalField('extend-date-modal', '#extend-date-days');
  }
  function closeExtendDateModal() { document.getElementById('extend-date-modal').classList.remove('open'); extendingListingId = null; }
  async function confirmExtendDate() {
    const days = parseInt(document.getElementById('extend-date-days').value, 10);
    if (!days || days <= 0) { toast('Enter a valid number of days','error'); return; }
    closeExtendDateModal();
    // PATCH #9: bulk-extend reuses this same modal, flagged via '__bulk__'.
    if (extendingListingId === '__bulk__') {
      let ids = [...selectedListingIds];
      if (selectAllAcrossPagesActive) {
        toast('Loading all matching listings\u2026', '');
        const rows = await fetchAllMatchingListings();
        if (!rows) return;
        ids = rows.map(r => r.id);
      }
      if (!ids.length) return;
      for (const bid of ids) await doExtendListing(bid, days);
      logAction('bulk_extend', 'listing', 'multiple', `${ids.length} listing(s) +${days}d`);
      toast(`${ids.length} listing(s) extended`, 'success');
      selectedListingIds.clear();
      clearSelectAllAcrossPages();
      loadAllListings();
      return;
    }
    const id = extendingListingId; if (!id) return;
    await doExtendListing(id, days);
  }
  // PATCH #9: bulk "Extend expiry\u2026" opens the same modal in bulk mode.
  function bulkExtendPrompt() {
    const ids = [...selectedListingIds];
    if (!ids.length && !selectAllAcrossPagesActive) return;
    extendingListingId = '__bulk__';
    document.getElementById('extend-date-listing-title').textContent = selectAllAcrossPagesActive
      ? `${Math.min(selectAllAcrossPagesTotal, SELECT_ALL_MAX)} listing(s) (all matching filters)`
      : `${ids.length} listing(s)`;
    document.getElementById('extend-date-days').value = 14;
    document.getElementById('extend-date-modal').classList.add('open');
    focusModalField('extend-date-modal', '#extend-date-days');
  }
  // PATCH #9: bulk "Feature selected"
  async function bulkFeature() {
    let ids = [...selectedListingIds];
    if (selectAllAcrossPagesActive) {
      toast('Loading all matching listings\u2026', '');
      const rows = await fetchAllMatchingListings();
      if (!rows) return;
      ids = rows.map(r => r.id);
    }
    if (!ids.length) return;
    openConfirm({
      title: `Feature ${ids.length} listing(s) for free?`,
      message: `These listings will be marked featured without recording a payment (admin comp). Use per-listing "Feature" if any of them were actually paid for.`,
      confirmText: `Feature ${ids.length} listing(s)`, confirmClass: 'approve',
      onConfirm: async () => {
        const until = new Date(Date.now() + SETTINGS.featured_duration_days*24*60*60*1000).toISOString();
        for (const id of ids) await db.from('listings').update({ is_featured: true, featured_until: until }).eq('id', id);
        logAction('bulk_feature', 'listing', 'multiple', `${ids.length} listing(s)`);
        toast(`${ids.length} listing(s) featured`, 'success');
        selectedListingIds.clear();
        clearSelectAllAcrossPages();
        loadAllListings();
        loadOverview();
      }
    });
  }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION R — featureListing: single modal with "was this paid?" (#12)
# ─────────────────────────────────────────────────────────────────────────
p(
    "feature-listing-modal-flow",
    "Merge the free-feature and paid-upgrade paths into one modal with a "
    "'was this paid?' checkbox (#12).",
    old="""  function featureListing(id) {
    const l = _listings[id]; if(!l) return;
    openConfirm({
      title:'Feature this listing for free?',
      message:`"${l.title}" will be featured without recording a payment. If the seller paid for this, use "Process upgrade" instead so it shows up in Payments/Revenue.`,
      confirmText:'Feature for free', confirmClass:'approve',
      onConfirm:()=>doFeatureListingFree(id)
    });
  }""",
    new="""  // PATCH #12: one modal, one decision point ("was this paid?"), instead
  // of two separate entry points (silent free-comp vs. the "Process
  // upgrade" flow) an admin had to remember to choose between correctly.
  let featuringListingId = null;
  function featureListing(id) {
    const l = _listings[id]; if (!l) return;
    featuringListingId = id;
    document.getElementById('feature-listing-name').textContent = l.title || id;
    document.getElementById('feature-was-paid').checked = false;
    document.getElementById('feature-amount').value = calcUpgradeAmount(l, 'featured');
    toggleFeaturePaidAmount();
    document.getElementById('feature-listing-modal').classList.add('open');
  }
  function toggleFeaturePaidAmount() {
    const paid = document.getElementById('feature-was-paid').checked;
    document.getElementById('feature-amount-wrap').style.display = paid ? 'block' : 'none';
    document.getElementById('feature-free-note').style.display = paid ? 'none' : 'block';
  }
  function closeFeatureListingModal() { document.getElementById('feature-listing-modal').classList.remove('open'); featuringListingId = null; }
  async function confirmFeatureListing() {
    const id = featuringListingId; if (!id) return;
    const paid = document.getElementById('feature-was-paid').checked;
    const amount = parseFloat(document.getElementById('feature-amount').value) || 0;
    closeFeatureListingModal();
    if (!paid) { doFeatureListingFree(id); return; }
    const until = new Date(Date.now() + SETTINGS.featured_duration_days*24*60*60*1000).toISOString();
    const { error } = await db.from('listings').update({ is_featured: true, featured_until: until, payment_status: 'paid' }).eq('id', id);
    if (error) { toast('Error featuring listing', 'error'); return; }
    await db.from('payments').insert({ listing_id: id, amount, method: 'manual', reference: 'Admin-processed feature upgrade', type: 'featured_upgrade', status: 'confirmed' });
    logAction('feature_listing', 'listing', id, 'Featured with a recorded payment');
    const l = _listings[id];
    if (l) { l.is_featured = true; l.featured_until = until; l.payment_status = 'paid'; }
    toast('Listing featured \u2713 (payment recorded)', 'success');
    loadOverview();
    if (currentView === 'listings') loadAllListings();
    if (currentView === 'payments') loadPayments();
  }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION S — desktop action-btns for the main listings row: trim to
# primary actions, add copy-link, add locked-reason, keep full list in the
# already-existing (now visible) dropdown menu (#4, #14, #15)
# ─────────────────────────────────────────────────────────────────────────
p(
    "desktop-row-actions-trim",
    "Trim the desktop action-btns row to primary actions + add Copy Link "
    "(#4, #14); everything else was already in menuItems for the dropdown, "
    "which PATCH's CSS change now actually shows.",
    old="""          <div class="action-btns">
            ${l.status==='pending'?(aBtn('approve','Approve listing','approve',`approveListing('${l.id}')`)+aBtn('reject','Reject listing','reject',`rejectListing('${l.id}')`)):''}
            ${isTrial?aBtn('upgrade','Process upgrade','upgrade',`openUpgradeModal('${l.id}')`):''}
            ${aBtn('extend','Extend expiry date','view',`extendListingDate('${l.id}')`, locked, LOCKED_ACTION_TIP)}
            ${!l.is_featured?aBtn('feature','Feature listing','feature',`featureListing('${l.id}')`, locked, LOCKED_ACTION_TIP):''}
            ${l.is_featured?aBtn('unfeature','Unfeature listing','view',`unfeatureListing('${l.id}')`, locked, LOCKED_ACTION_TIP):''}
            ${aBtn('view','View details','view',`openListingModal('${l.id}')`)}
            ${aBtn('edit','Edit listing','view',`openEditListingModal('${l.id}')`)}
            ${aBtn('video','Manage video walkthrough','view',`openAdminVideoModal('${l.id}')`, locked, LOCKED_ACTION_TIP)}
            ${l.is_disabled
              ? aBtn('activate','Activate listing','approve',`activateListing('${l.id}')`)
              : aBtn('deactivate','Deactivate listing','reject',`deactivateListing('${l.id}')`)}
            ${(l.status==='active' && !l.is_disabled) ? aBtn('deactivate','Mark occupied/sold','reject',`markListingOccupied('${l.id}')`) : ''}
            ${(l.status==='occupied' && !l.is_disabled) ? aBtn('activate','Mark available again','approve',`unmarkListingOccupied('${l.id}')`) : ''}
            ${renderSocialButtons(l, locked)}
            ${aBtn('recycle','Move to recycle bin','recycle',`recycleListing('${l.id}')`)}
            ${aBtn('delete','Delete permanently','delete',`deleteListingPermanently('${l.id}')`)}
          </div>
          ${mobileMenu(l.id, menuItems)}
        </td>
      </tr>`;
    }).join('');""",
    new="""          <div class="action-btns">
            ${l.status==='pending'?(aBtn('approve','Approve listing','approve',`approveListing('${l.id}')`)+aBtn('reject','Reject listing','reject',`rejectListing('${l.id}')`)):''}
            ${aBtn('view','View details','view',`openListingModal('${l.id}')`)}
            ${aBtn('edit','Edit listing','view',`openEditListingModal('${l.id}')`)}
            ${aBtn('copylink','Copy live link','view',`copyListingLink('${l.id}')`)}
            ${l.status!=='pending' ? (l.is_disabled
              ? aBtn('activate','Activate listing','approve',`activateListing('${l.id}')`)
              : aBtn('deactivate','Deactivate listing','reject',`deactivateListing('${l.id}')`)) : ''}
          </div>
          ${mobileMenu(l.id, menuItems)}
        </td>
      </tr>`;
    }).join('');""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION T — mobile card actions: same trim, plus the dropdown menu now
# also appears on mobile cards (#4), thumbnail lightbox (#13)
# ─────────────────────────────────────────────────────────────────────────
p(
    "mobile-card-actions-trim",
    "Trim mobile card action buttons to primary actions and append the "
    "full dropdown menu for everything else (#4), matching the desktop row.",
    old="""        <div class="mobile-card-actions">
          ${l.status==='pending'?(aBtn('approve','Approve','approve',`approveListing('${l.id}')`)+aBtn('reject','Reject','reject',`rejectListing('${l.id}')`)):''}
          ${isTrial?aBtn('upgrade','Upgrade','upgrade',`openUpgradeModal('${l.id}')`):''}
          ${aBtn('extend','Extend','view',`extendListingDate('${l.id}')`, locked, LOCKED_ACTION_TIP)}
          ${!l.is_featured?aBtn('feature','Feature','feature',`featureListing('${l.id}')`, locked, LOCKED_ACTION_TIP):''}
          ${l.is_featured?aBtn('unfeature','Unfeature','view',`unfeatureListing('${l.id}')`, locked, LOCKED_ACTION_TIP):''}
          ${renderSocialButtons(l, locked)}
          ${aBtn('view','View','view',`openListingModal('${l.id}')`)}
          ${aBtn('edit','Edit','view',`openEditListingModal('${l.id}')`)}
          ${aBtn('video','Video','view',`openAdminVideoModal('${l.id}')`, locked, LOCKED_ACTION_TIP)}
          ${l.is_disabled
            ? aBtn('activate','Activate','approve',`activateListing('${l.id}')`)
            : aBtn('deactivate','Deactivate','reject',`deactivateListing('${l.id}')`)}
          ${(l.status==='active' && !l.is_disabled) ? aBtn('deactivate','Occupied','reject',`markListingOccupied('${l.id}')`) : ''}
          ${(l.status==='occupied' && !l.is_disabled) ? aBtn('activate','Available','approve',`unmarkListingOccupied('${l.id}')`) : ''}
          ${aBtn('recycle','Recycle','recycle',`recycleListing('${l.id}')`)}
          ${aBtn('delete','Delete','delete',`deleteListingPermanently('${l.id}')`)}
        </div>
      </div>`;
    }).join('');

    if (append) { tbody.innerHTML += rowsHtml; mobileEl.innerHTML += mobileHtml; }""",
    new="""        <div class="mobile-card-actions">
          ${l.status==='pending'?(aBtn('approve','Approve','approve',`approveListing('${l.id}')`)+aBtn('reject','Reject','reject',`rejectListing('${l.id}')`)):''}
          ${aBtn('view','View','view',`openListingModal('${l.id}')`)}
          ${aBtn('edit','Edit','view',`openEditListingModal('${l.id}')`)}
          ${aBtn('copylink','Copy link','view',`copyListingLink('${l.id}')`)}
          ${mobileMenu(l.id, menuItems)}
        </div>
      </div>`;
    }).join('');

    if (append) { tbody.innerHTML += rowsHtml; mobileEl.innerHTML += mobileHtml; }""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION U — thumbnail lightbox click + urgent badge, in the desktop row
# building code (right where `urgent` is computed and `thumb` is built)
# ─────────────────────────────────────────────────────────────────────────
p(
    "desktop-thumb-lightbox-and-urgent-badge",
    "Make the thumbnail clickable to open a lightbox (#13), and show a "
    "small 'Urgent' badge on urgent rows (#18), in the desktop row builder.",
    old="""    const rowsHtml = data.map(l => {
      const cover = (l.listing_photos||[]).find(p=>p.is_cover)||(l.listing_photos||[])[0];
      const thumb = cover ? `<img src="${esc(cover.url)}" alt=""/>` : `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      const payClass = l.payment_status==='paid'?'paid':l.payment_status==='trial'?'trial':l.payment_status==='submitted'?'pending':'unpaid';
      const isTrial = l.payment_status==='trial';
      const locked = listingActionsLocked(l);
      const urgent = l.status==='pending' ? ((Date.now() - new Date(l.created_at).getTime()) > 24*3600*1000) : (listingDaysLeft(l).cls === 'pending');""",
    new="""    const rowsHtml = data.map(l => {
      const cover = (l.listing_photos||[]).find(p=>p.is_cover)||(l.listing_photos||[])[0];
      const thumb = cover ? `<img src="${esc(cover.url)}" alt=""/>` : `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      const payClass = l.payment_status==='paid'?'paid':l.payment_status==='trial'?'trial':l.payment_status==='submitted'?'pending':'unpaid';
      const isTrial = l.payment_status==='trial';
      const locked = listingActionsLocked(l);
      const urgent = l.status==='pending' ? ((Date.now() - new Date(l.created_at).getTime()) > 24*3600*1000) : (listingDaysLeft(l).cls === 'pending');
      // PATCH #13: thumbnail becomes clickable when a real photo exists.
      const thumbClickAttr = cover ? ` style="cursor:pointer" onclick="openImageLightbox('${esc(cover.url)}')"` : '';
      // PATCH #18: small inline urgency badge.
      const urgentBadgeHtml = urgent ? '<span class="badge urgent-flag">\u26a0 Urgent</span>' : '';""",
)

p(
    "desktop-thumb-html-and-title-badge",
    "Apply the thumbnail-click attribute and urgent badge in the actual "
    "row markup (#13, #18).",
    old="""      return `<tr class="${urgent?'row-urgent':''}">
        <td><input type="checkbox" class="listing-select-cb" data-id="${l.id}" onchange="toggleSelectListing('${l.id}',this.checked)" ${selectedListingIds.has(l.id)?'checked':''}/></td>
        <td><div class="listing-thumb">
          <div class="thumb-img">${thumb}</div>
          <div class="listing-info"><div class="listing-title">${esc(l.title)}</div><div class="listing-meta">${esc(l.profiles?.full_name||'—')} ${multiUnitBadge(l)} ${l.status==='active'&&!l.is_disabled?socialBadges(l):''}</div></div>
        </div></td>""",
    new="""      return `<tr class="${urgent?'row-urgent':''}">
        <td><input type="checkbox" class="listing-select-cb" data-id="${l.id}" onchange="toggleSelectListing('${l.id}',this.checked)" ${selectedListingIds.has(l.id)?'checked':''}/></td>
        <td><div class="listing-thumb">
          <div class="thumb-img"${thumbClickAttr}>${thumb}</div>
          <div class="listing-info"><div class="listing-title">${esc(l.title)}${urgentBadgeHtml}</div><div class="listing-meta">${esc(l.profiles?.full_name||'—')} ${multiUnitBadge(l)} ${l.status==='active'&&!l.is_disabled?socialBadges(l):''}</div></div>
        </div></td>""",
)

p(
    "mobile-card-thumb-lightbox",
    "Make the mobile card thumbnail clickable too (#13), and compute "
    "thumbClickAttr for the mobile-card builder (it has its own `cover`/`thumb`).",
    old="""    const mobileHtml = data.map(l => {
      const cover = (l.listing_photos||[]).find(p=>p.is_cover)||(l.listing_photos||[])[0];
      const thumb = cover ? `<img src="${esc(cover.url)}" alt=""/>` : `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      const payClass = l.payment_status==='paid'?'paid':l.payment_status==='trial'?'trial':l.payment_status==='submitted'?'pending':'unpaid';
      const isTrial = l.payment_status==='trial';
      const locked = listingActionsLocked(l);
      return `<div class="mobile-card">
        <div class="mobile-card-header">
          <div class="thumb-img" style="width:52px;height:42px">${thumb}</div>""",
    new="""    const mobileHtml = data.map(l => {
      const cover = (l.listing_photos||[]).find(p=>p.is_cover)||(l.listing_photos||[])[0];
      const thumb = cover ? `<img src="${esc(cover.url)}" alt=""/>` : `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>`;
      const payClass = l.payment_status==='paid'?'paid':l.payment_status==='trial'?'trial':l.payment_status==='submitted'?'pending':'unpaid';
      const isTrial = l.payment_status==='trial';
      const locked = listingActionsLocked(l);
      const _mThumbClickAttr = cover ? ` style="width:52px;height:42px;cursor:pointer" onclick="openImageLightbox('${esc(cover.url)}')"` : ' style="width:52px;height:42px"';
      return `<div class="mobile-card">
        <div class="mobile-card-header">
          <div class="thumb-img"${_mThumbClickAttr}>${thumb}</div>""",
)

# ─────────────────────────────────────────────────────────────────────────
# REGION V — locked-reason tooltips: swap LOCKED_ACTION_TIP for
# lockedReasonFor(l) inside renderSocialButtons (#15)
# ─────────────────────────────────────────────────────────────────────────
p(
    "render-social-buttons-locked-reason",
    "renderSocialButtons() now shows the specific lock reason instead of "
    "the generic multi-reason tooltip (#15).",
    old="""  function renderSocialButtons(l, locked=false){
    const fb=socialPostedInfo(l,'facebook'), ig=socialPostedInfo(l,'instagram'), tt=socialPostedInfo(l,'tiktok');
    return aBtn('facebook', fb?'Posted to Facebook — post again':'Post to Facebook','view',`postToSocial('${l.id}','facebook')`, locked, LOCKED_ACTION_TIP)
         + aBtn('instagram', ig?'Posted to Instagram — post again':'Post to Instagram','view',`postToSocial('${l.id}','instagram')`, locked, LOCKED_ACTION_TIP)
         + aBtn('tiktok', tt?'Posted to TikTok (private until audit) — post again':'Post to TikTok (private until audit)','view',`postToSocial('${l.id}','tiktok')`, locked, LOCKED_ACTION_TIP);
  }""",
    new="""  function renderSocialButtons(l, locked=false){
    const fb=socialPostedInfo(l,'facebook'), ig=socialPostedInfo(l,'instagram'), tt=socialPostedInfo(l,'tiktok');
    const _tip = lockedReasonFor(l); // PATCH #15
    return aBtn('facebook', fb?'Posted to Facebook — post again':'Post to Facebook','view',`postToSocial('${l.id}','facebook')`, locked, _tip)
         + aBtn('instagram', ig?'Posted to Instagram — post again':'Post to Instagram','view',`postToSocial('${l.id}','instagram')`, locked, _tip)
         + aBtn('tiktok', tt?'Posted to TikTok (private until audit) — post again':'Post to TikTok (private until audit)','view',`postToSocial('${l.id}','tiktok')`, locked, _tip);
  }""",
)


def apply_patches(text, allow_partial=False):
    applied, skipped, failed = [], [], []
    for patch in PATCHES:
        n = text.count(patch["old"])
        if n == 1:
            text = text.replace(patch["old"], patch["new"], 1)
            applied.append(patch["id"])
        elif n == 0:
            (skipped if allow_partial else failed).append((patch["id"], "anchor not found"))
        else:
            (skipped if allow_partial else failed).append((patch["id"], f"anchor found {n} times (ambiguous)"))
    return text, applied, skipped, failed


def check(text):
    print(f"{'ID':<38} {'STATUS':<10} DESCRIPTION")
    print("-" * 100)
    ok = True
    for patch in PATCHES:
        n = text.count(patch["old"])
        if n == 1:
            status = "OK"
        elif n == 0:
            status = "MISSING"
            ok = False
        else:
            status = f"AMBIG x{n}"
            ok = False
        print(f"{patch['id']:<38} {status:<10} {patch['desc'][:70]}")
    print("-" * 100)
    print("All anchors found and unambiguous — safe to apply." if ok
          else "Some anchors did not match cleanly — see MISSING/AMBIG rows above.\n"
               "Run with --allow-partial to apply only the ones that matched.")
    return ok


def main():
    ap = argparse.ArgumentParser(description="Apply the 18 'All listings' UX fixes to admin.html")
    ap.add_argument("input", help="path to your admin.html")
    ap.add_argument("-o", "--output", default=None, help="output path (default: <input>.patched.html)")
    ap.add_argument("--check", action="store_true", help="report anchor status only; write nothing")
    ap.add_argument("--allow-partial", action="store_true",
                     help="apply whichever fixes match and skip the rest, instead of aborting")
    args = ap.parse_args()

    with open(args.input, "r", encoding="utf-8") as f:
        text = f.read()

    if args.check:
        ok = check(text)
        sys.exit(0 if ok else 1)

    new_text, applied, skipped, failed = apply_patches(text, allow_partial=args.allow_partial)

    if failed and not args.allow_partial:
        print(f"ABORTED — {len(failed)} of {len(PATCHES)} fixes could not be applied safely. "
              f"No file was written.\n")
        for pid, reason in failed:
            print(f"  \u2717 {pid}: {reason}")
        print("\nRun with --check for the full report, or --allow-partial to apply "
              "only the fixes that match your file as-is.")
        sys.exit(1)

    out_path = args.output or (args.input.rsplit(".", 1)[0] + ".patched.html")
    with open(out_path, "w", encoding="utf-8") as f:
        f.write(new_text)

    print(f"Applied {len(applied)}/{len(PATCHES)} fixes \u2192 {out_path}")
    if skipped:
        print(f"\nSkipped {len(skipped)} (use --check for details):")
        for pid, reason in skipped:
            print(f"  \u26a0 {pid}: {reason}")


if __name__ == "__main__":
    main()
