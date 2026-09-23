#!/usr/bin/env python3
"""
patch3.py — Phase 3 for the Nyumba254 admin dashboard
(nk-ctrl-7f3k2x9.html). Independent of patch.py / patch2.py — can be
run before, after, or without them.

Adds:
  B) Raises PAGE_SIZE from 50 to 200 (fewer "Load more" clicks
     everywhere: listings, users, payments, reports, reviews)
  A) True "select all across pages" for listing bulk actions
     (approve / reject / recycle). Only offered once every currently
     loaded row is already checked AND more rows exist beyond that.
     Capped at SELECT_ALL_MAX (1000) listings per action as a safety
     limit, fetches full listing rows (not just IDs) so the existing
     per-listing approve/reject/recycle logic — payment checks,
     seller notifications, activity log — runs exactly as it does
     today, just over a larger set. Every confirm dialog explicitly
     warns with the real count when acting across pages.

  Also fixes a pre-existing bug in bulkRecycle() where the seller
  notification email referenced an undefined `title` variable
  instead of `l.title`.

Usage:
    python3 patch3.py nk-ctrl-7f3k2x9.html
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

    ("(B) Raise PAGE_SIZE from 50 to 200",
     "const PAGE_SIZE = 50;",
     "const PAGE_SIZE = 200;"),

    ("(A) Add select-all-across-pages state + safety cap",
     "let selectedListingIds = new Set();",
     '''let selectedListingIds = new Set();
  let selectAllAcrossPagesActive = false;
  let selectAllAcrossPagesTotal = 0;
  const SELECT_ALL_MAX = 1000; // hard cap — a single bulk action can never touch more than this'''),

    ("(A) Add helper to fetch every listing matching current filters (not just the loaded page)",
     "function loadMoreListings() { listingsPage++; loadAllListings(true); }",
     '''function loadMoreListings() { listingsPage++; loadAllListings(true); }

  async function fetchAllMatchingListings() {
    const listingsSelect = currentTab==='multiunit'
      ? '*, profiles(full_name, email, subscription_tier, subscription_expires_at), listing_photos(*), listing_units!inner(*), social_posts(*)'
      : '*, profiles(full_name, email, subscription_tier, subscription_expires_at), listing_photos(*), listing_units(*), social_posts(*)';
    let q = db.from('listings').select(listingsSelect).eq('recycle_bin',false);
    if (currentTab==='pending')       q = q.eq('status','pending');
    else if (currentTab==='active')   q = q.eq('status','active').eq('is_disabled',false);
    else if (currentTab==='featured') q = q.eq('is_featured',true).eq('status','active').eq('is_disabled',false);
    else if (currentTab==='trial')    q = q.eq('payment_status','trial');
    else if (currentTab==='inactive') q = q.eq('is_disabled',true);
    const county = document.getElementById('filter-county').value;
    const area   = document.getElementById('filter-area').value;
    const cat    = document.getElementById('filter-cat').value;
    const search = document.getElementById('filter-search').value.trim();
    if (filterSellerId) q = q.eq('seller_id', filterSellerId);
    if (county) q = q.eq('county',county);
    if (area)   q = q.eq('area',area);
    if (cat)    q = q.eq('category',cat);
    if (search) q = q.or(`title.ilike.%${search}%,area.ilike.%${search}%`);
    q = q.order('created_at',{ascending:false}).limit(SELECT_ALL_MAX);
    const { data, error } = await q;
    if (error) { toast('Could not load full matching set: '+error.message,'error'); return null; }
    (data||[]).forEach(l => { _listings[l.id] = l; });
    return data || [];
  }'''),

    ("(A) Reset select-all-across-pages whenever filters/tab change",
     '''if (!append) {
      listingsPage = 0;
      selectedListingIds.clear();
      renderBulkBar();''',
     '''if (!append) {
      listingsPage = 0;
      selectedListingIds.clear();
      selectAllAcrossPagesActive = false;
      selectAllAcrossPagesTotal = 0;
      renderBulkBar();'''),

    ("(A) Bulk bar: show 'Select all N' banner once a full page is checked",
     '''function renderBulkBar() {
    const bar = document.getElementById('bulk-bar');
    if (!selectedListingIds.size) { bar.classList.remove('show'); return; }
    bar.classList.add('show');
    document.getElementById('bulk-count').textContent = selectedListingIds.size + ' selected';
  }''',
     '''function renderBulkBar() {
    const bar = document.getElementById('bulk-bar');
    if (!selectedListingIds.size && !selectAllAcrossPagesActive) { bar.classList.remove('show'); return; }
    bar.classList.add('show');
    const totalCount = parseInt((document.getElementById('listings-count')?.textContent||'').replace(/\\D/g,''),10) || 0;
    const loadedCount = document.querySelectorAll('.listing-select-cb').length;
    let countLabel = selectedListingIds.size + ' selected';
    let selectAllHtml = '';
    if (selectAllAcrossPagesActive) {
      countLabel = `${Math.min(selectAllAcrossPagesTotal, SELECT_ALL_MAX)} selected (all matching filters)`;
      selectAllHtml = ` <button class="action-btn view" onclick="clearSelectAllAcrossPages()">Clear</button>`;
    } else if (loadedCount && selectedListingIds.size === loadedCount && totalCount > loadedCount) {
      const cappedTotal = Math.min(totalCount, SELECT_ALL_MAX);
      selectAllHtml = ` <button class="action-btn view" onclick="activateSelectAllAcrossPages(${totalCount})">Select all ${cappedTotal}${totalCount>SELECT_ALL_MAX?` (max ${SELECT_ALL_MAX} per action)`:''}</button>`;
    }
    document.getElementById('bulk-count').innerHTML = countLabel + selectAllHtml;
  }
  function activateSelectAllAcrossPages(total) {
    selectAllAcrossPagesActive = true;
    selectAllAcrossPagesTotal = total;
    renderBulkBar();
  }
  function clearSelectAllAcrossPages() {
    selectAllAcrossPagesActive = false;
    selectAllAcrossPagesTotal = 0;
    renderBulkBar();
  }'''),

    ("(A) bulkApprove: operate on the full matching set when select-all is active",
     '''function bulkApprove() {
    const ids=[...selectedListingIds];
    if(!ids.length) return;
    openConfirm({
      title:`Approve ${ids.length} selected listing(s)?`,
      message:`Each listing goes through the same checks as approving one at a time — payment/plan coverage is verified individually, and sellers are notified.`,
      confirmText:`Approve ${ids.length} listing(s)`, confirmClass:'approve',
      onConfirm: async () => {
        for(const id of ids) {
          const l = _listings[id];
          await doApprove(id, l?.title || '');
        }
        logAction('bulk_approve','listing','multiple',`${ids.length} listing(s)`);
        toast(`${ids.length} listing(s) processed`,'success');
        selectedListingIds.clear(); renderBulkBar(); loadAllListings(); loadOverview();
      }
    });
  }''',
     '''async function bulkApprove() {
    let ids = [...selectedListingIds];
    if (selectAllAcrossPagesActive) {
      toast('Loading all matching listings…','');
      const rows = await fetchAllMatchingListings();
      if (!rows) return;
      ids = rows.map(r=>r.id);
    }
    if(!ids.length) return;
    openConfirm({
      title:`Approve ${ids.length} listing(s)?`,
      message: selectAllAcrossPagesActive
        ? `This affects ALL ${ids.length} listings matching your current filters — not just what's visible on screen. Each still goes through the same per-listing payment/plan check, and sellers are notified.`
        : `Each listing goes through the same checks as approving one at a time — payment/plan coverage is verified individually, and sellers are notified.`,
      warningText: selectAllAcrossPagesActive ? `⚠ Acting on all ${ids.length} matching listings, including ones not currently visible.` : '',
      confirmText:`Approve ${ids.length} listing(s)`, confirmClass:'approve',
      onConfirm: async () => {
        for(const id of ids) {
          const l = _listings[id];
          await doApprove(id, l?.title || '');
        }
        logAction('bulk_approve','listing','multiple',`${ids.length} listing(s)${selectAllAcrossPagesActive?' (select-all-across-pages)':''}`);
        toast(`${ids.length} listing(s) processed`,'success');
        selectedListingIds.clear(); clearSelectAllAcrossPages(); loadAllListings(); loadOverview();
      }
    });
  }'''),

    ("(A) bulkReject: operate on the full matching set when select-all is active",
     '''function bulkReject() {
    const ids=[...selectedListingIds];
    if(!ids.length) return;
    openConfirm({
      title:`Reject ${ids.length} selected listing(s)?`,
      message:`These listings will be marked rejected and hidden from buyers.`,
      requireReason:true, reasonLabel:'Reason for rejection (shown to sellers)',
      confirmText:`Reject ${ids.length} listing(s)`, confirmClass:'reject',
      onConfirm: async (reason) => {
        for(const id of ids) {
          await db.from('listings').update({status:'rejected',disabled_reason:reason}).eq('id',id);
          const l = _listings[id];
          if (l?.profiles?.email) {
            notifySeller('listing_rejected', {
              listingId: id, listingTitle: l.title, reason,
              sellerName: l.profiles.full_name, sellerEmail: l.profiles.email,
            });
          }
          if (l?.seller_id) notifyInApp(l.seller_id, 'listing_rejected', 'Listing rejected', `"${l.title}" was rejected${reason?': '+reason:''}.`, '/dashboard.html');
        }
        logAction('bulk_reject','listing','multiple',`${ids.length} listing(s)`);
        toast(`${ids.length} listing(s) rejected`,'');
        selectedListingIds.clear(); renderBulkBar(); loadAllListings(); loadOverview();
      }
    });
  }''',
     '''async function bulkReject() {
    let ids = [...selectedListingIds];
    if (selectAllAcrossPagesActive) {
      toast('Loading all matching listings…','');
      const rows = await fetchAllMatchingListings();
      if (!rows) return;
      ids = rows.map(r=>r.id);
    }
    if(!ids.length) return;
    openConfirm({
      title:`Reject ${ids.length} listing(s)?`,
      message: selectAllAcrossPagesActive
        ? `This affects ALL ${ids.length} listings matching your current filters — not just what's visible on screen. They'll be marked rejected and hidden from buyers.`
        : `These listings will be marked rejected and hidden from buyers.`,
      warningText: selectAllAcrossPagesActive ? `⚠ Acting on all ${ids.length} matching listings, including ones not currently visible.` : '',
      requireReason:true, reasonLabel:'Reason for rejection (shown to sellers)',
      confirmText:`Reject ${ids.length} listing(s)`, confirmClass:'reject',
      onConfirm: async (reason) => {
        for(const id of ids) {
          await db.from('listings').update({status:'rejected',disabled_reason:reason}).eq('id',id);
          const l = _listings[id];
          if (l?.profiles?.email) {
            notifySeller('listing_rejected', {
              listingId: id, listingTitle: l.title, reason,
              sellerName: l.profiles.full_name, sellerEmail: l.profiles.email,
            });
          }
          if (l?.seller_id) notifyInApp(l.seller_id, 'listing_rejected', 'Listing rejected', `"${l.title}" was rejected${reason?': '+reason:''}.`, '/dashboard.html');
        }
        logAction('bulk_reject','listing','multiple',`${ids.length} listing(s)${selectAllAcrossPagesActive?' (select-all-across-pages)':''}`);
        toast(`${ids.length} listing(s) rejected`,'');
        selectedListingIds.clear(); clearSelectAllAcrossPages(); loadAllListings(); loadOverview();
      }
    });
  }'''),

    ("(A) bulkRecycle: operate on the full matching set when select-all is active (also fixes an undefined `title` bug in the seller email)",
     '''function bulkRecycle() {
    const ids=[...selectedListingIds];
    if(!ids.length) return;
    openConfirm({
      title:`Move ${ids.length} listing(s) to recycle bin?`,
      message:`These listings will be hidden for ${SETTINGS.recycle_bin_days} days then permanently deleted.`,
      confirmText:`Move ${ids.length} listing(s)`, confirmClass:'reject',
      onConfirm: async () => {
        const purge=new Date(Date.now()+SETTINGS.recycle_bin_days*24*60*60*1000).toISOString();
        for(const id of ids) {
          await db.from('listings').update({is_disabled:true,recycle_bin:true,disabled_reason:'Bulk action by admin',disabled_at:new Date().toISOString(),purge_at:purge}).eq('id',id);
          const l = _listings[id];
          if (l?.profiles?.email) {
            notifySeller('listing_recycled', {
              listingId: id, listingTitle: title, reason: 'Bulk action by admin',
              sellerName: l.profiles.full_name, sellerEmail: l.profiles.email,
            });
          }
        }
        logAction('bulk_recycle','listing','multiple',`${ids.length} listing(s)`);
        toast(`${ids.length} listing(s) moved to recycle bin`,'success');
        selectedListingIds.clear(); renderBulkBar(); loadAllListings(); loadOverview();
      }
    });
  }''',
     '''async function bulkRecycle() {
    let ids = [...selectedListingIds];
    if (selectAllAcrossPagesActive) {
      toast('Loading all matching listings…','');
      const rows = await fetchAllMatchingListings();
      if (!rows) return;
      ids = rows.map(r=>r.id);
    }
    if(!ids.length) return;
    openConfirm({
      title:`Move ${ids.length} listing(s) to recycle bin?`,
      message: (selectAllAcrossPagesActive
        ? `This affects ALL ${ids.length} listings matching your current filters — not just what's visible on screen. `
        : ``) + `These listings will be hidden for ${SETTINGS.recycle_bin_days} days then permanently deleted.`,
      warningText: selectAllAcrossPagesActive ? `⚠ Acting on all ${ids.length} matching listings, including ones not currently visible.` : '',
      confirmText:`Move ${ids.length} listing(s)`, confirmClass:'reject',
      onConfirm: async () => {
        const purge=new Date(Date.now()+SETTINGS.recycle_bin_days*24*60*60*1000).toISOString();
        for(const id of ids) {
          await db.from('listings').update({is_disabled:true,recycle_bin:true,disabled_reason:'Bulk action by admin',disabled_at:new Date().toISOString(),purge_at:purge}).eq('id',id);
          const l = _listings[id];
          if (l?.profiles?.email) {
            notifySeller('listing_recycled', {
              listingId: id, listingTitle: l.title, reason: 'Bulk action by admin',
              sellerName: l.profiles.full_name, sellerEmail: l.profiles.email,
            });
          }
        }
        logAction('bulk_recycle','listing','multiple',`${ids.length} listing(s)${selectAllAcrossPagesActive?' (select-all-across-pages)':''}`);
        toast(`${ids.length} listing(s) moved to recycle bin`,'success');
        selectedListingIds.clear(); clearSelectAllAcrossPages(); loadAllListings(); loadOverview();
      }
    });
  }'''),
]

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 patch3.py <path-to-html-file>")
        sys.exit(1)

    path = pathlib.Path(sys.argv[1])
    if not path.exists():
        print(f"File not found: {path}")
        sys.exit(1)

    content = path.read_text(encoding="utf-8")
    original_content = content

    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = path.with_suffix(path.suffix + f".bak3-{timestamp}")
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
    print("\nImportant: select-all-across-pages only appears once every")
    print("currently loaded row is checked AND more rows exist beyond that.")
    print("If any of the (A) patches were skipped, test bulk approve/reject/")
    print("recycle carefully before relying on it in production.")

if __name__ == "__main__":
    main()
