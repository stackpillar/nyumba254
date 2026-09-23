#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
apply_patch.py — Listings-section fixes for the Nyumba254 admin dashboard.

Applies 9 targeted patches (see PATCHES below) to your admin dashboard HTML
file. Each patch only applies if its exact original code block is found
EXACTLY ONCE in your file — if it's missing or appears more than once
(meaning your file has diverged from the version this was written against),
that patch is skipped and reported, nothing else is touched.

A timestamped backup of your original file is always written first.

USAGE:
    python3 apply_patch.py path/to/your/admin-dashboard.html

    # Preview what would change without writing anything:
    python3 apply_patch.py path/to/your/admin-dashboard.html --dry-run
"""

import sys
import shutil
import datetime
import argparse

PATCHES = [
    # ── 1. Clear stale bulk-selection whenever the listings table reloads
    #      fresh (tab switch, filter change) — prevents bulk actions from
    #      silently firing against listings the admin can no longer see. ──
    (
        "1. Clear bulk selection on fresh listings load",
        """    if (!append) {
      listingsPage = 0;
      const skelRow   = `<tr class="skeleton-row"><td colspan="10"><div class="skel"></div></td></tr>`;
      tbody.innerHTML  = skelRow.repeat(4);
      mobileEl.innerHTML = '';
      loadMoreWrap.style.display = 'none';
    } else {""",
        """    if (!append) {
      listingsPage = 0;
      selectedListingIds.clear();
      renderBulkBar();
      const skelRow   = `<tr class="skeleton-row"><td colspan="10"><div class="skel"></div></td></tr>`;
      tbody.innerHTML  = skelRow.repeat(4);
      mobileEl.innerHTML = '';
      loadMoreWrap.style.display = 'none';
    } else {""",
    ),

    # ── 2. Bulk Approve must not bypass payment/plan-coverage checks.
    #      Reuses the exact same doApprove() logic as single-item approve,
    #      and now asks for confirmation like Reject/Recycle already do. ──
    (
        "2. Bulk Approve: enforce payment/coverage checks + confirm",
        """  async function bulkApprove() {
    const ids=[...selectedListingIds];
    for(const id of ids) await db.from('listings').update({status:'active'}).eq('id',id);
    logAction('bulk_approve','listing','multiple',`${ids.length} listing(s)`);
    toast(`${ids.length} listing(s) approved`,'success');
    selectedListingIds.clear(); loadAllListings(); loadOverview();
  }""",
        """  function bulkApprove() {
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
  }""",
    ),

    # ── 3. Bulk Reject must notify sellers (single-item reject already
    #      does) and should record a reason, same as the single-item flow. ──
    (
        "3. Bulk Reject: notify sellers + require a reason",
        """  function bulkReject() {
    const ids=[...selectedListingIds];
    if(!ids.length) return;
    openConfirm({
      title:`Reject ${ids.length} selected listing(s)?`,
      message:`These listings will be marked rejected and hidden from buyers.`,
      confirmText:`Reject ${ids.length} listing(s)`, confirmClass:'reject',
      onConfirm: async () => {
        for(const id of ids) await db.from('listings').update({status:'rejected'}).eq('id',id);
        logAction('bulk_reject','listing','multiple',`${ids.length} listing(s)`);
        toast(`${ids.length} listing(s) rejected`,'');
        selectedListingIds.clear(); loadAllListings(); loadOverview();
      }
    });
  }""",
        """  function bulkReject() {
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
  }""",
    ),

    # ── 4. Bulk Recycle must notify sellers too, for the same reason. ──
    (
        "4. Bulk Recycle: notify sellers",
        """  function bulkRecycle() {
    const ids=[...selectedListingIds];
    if(!ids.length) return;
    openConfirm({
      title:`Move ${ids.length} listing(s) to recycle bin?`,
      message:`These listings will be hidden for ${SETTINGS.recycle_bin_days} days then permanently deleted.`,
      confirmText:`Move ${ids.length} listing(s)`, confirmClass:'reject',
      onConfirm: async () => {
        const purge=new Date(Date.now()+SETTINGS.recycle_bin_days*24*60*60*1000).toISOString();
        for(const id of ids) await db.from('listings').update({is_disabled:true,recycle_bin:true,disabled_reason:'Bulk action by admin',disabled_at:new Date().toISOString(),purge_at:purge}).eq('id',id);
        logAction('bulk_recycle','listing','multiple',`${ids.length} listing(s)`);
        toast(`${ids.length} listing(s) moved to recycle bin`,'success');
        selectedListingIds.clear(); loadAllListings(); loadOverview();
      }
    });
  }""",
        """  function bulkRecycle() {
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
              listingId: id, listingTitle: l.title, reason: 'Bulk action by admin',
              sellerName: l.profiles.full_name, sellerEmail: l.profiles.email,
            });
          }
        }
        logAction('bulk_recycle','listing','multiple',`${ids.length} listing(s)`);
        toast(`${ids.length} listing(s) moved to recycle bin`,'success');
        selectedListingIds.clear(); renderBulkBar(); loadAllListings(); loadOverview();
      }
    });
  }""",
    ),

    # ── 5. Extending a listing's expiry never told the seller. Every other
    #      lifecycle action (approve/reject/deactivate/recycle/restore)
    #      does — this brings extend in line. ──
    (
        "5. Notify seller when their listing's expiry is extended",
        """    const newExpiry = new Date(Math.max(base.getTime(), Date.now()) + days * 86400000).toISOString();
    const { data, error } = await db.from('listings').update({ expiry_override: newExpiry }).eq('id', id).select();
    if (error) { toast('Error extending: '+error.message,'error'); return; }
    if (!data?.length) { toast('Blocked by RLS — check Supabase policy','error'); return; }
    logAction('extend_listing_date','listing',id,`+${days} day(s) → ${newExpiry}`);
    l.expiry_override = newExpiry;
    toast(`Listing extended by ${days} day(s) ✓`,'success');
    if (currentView==='listings') loadAllListings();
    loadOverview();
  }""",
        """    const newExpiry = new Date(Math.max(base.getTime(), Date.now()) + days * 86400000).toISOString();
    const { data, error } = await db.from('listings').update({ expiry_override: newExpiry }).eq('id', id).select();
    if (error) { toast('Error extending: '+error.message,'error'); return; }
    if (!data?.length) { toast('Blocked by RLS — check Supabase policy','error'); return; }
    logAction('extend_listing_date','listing',id,`+${days} day(s) → ${newExpiry}`);
    l.expiry_override = newExpiry;
    if (l.profiles?.email) {
      notifySeller('listing_extended', { listingId: id, listingTitle: l.title, days, newExpiry, sellerName: l.profiles.full_name, sellerEmail: l.profiles.email });
    }
    if (l.seller_id) notifyInApp(l.seller_id, 'listing_approved', 'Listing extended', `"${l.title}"'s expiry was extended by ${days} day(s).`, '/dashboard.html');
    toast(`Listing extended by ${days} day(s) ✓`,'success');
    if (currentView==='listings') loadAllListings();
    loadOverview();
  }""",
    ),

    # ── 6. Replace the native prompt() for extending expiry with the
    #      existing styled confirm modal (matches dark theme, mobile-safe,
    #      consistent with every other admin action). ──
    (
        "6. Replace native prompt() in Extend expiry with styled modal",
        """  function extendListingDate(id) {
    const l = _listings[id]; if (!l) return;
    const input = prompt(`Extend "${l.title}" by how many days?`, '30');
    if (input === null) return;
    const days = parseInt(input, 10);
    if (!days || days <= 0) { toast('Enter a valid number of days','error'); return; }
    doExtendListing(id, days);
  }""",
        """  function extendListingDate(id) {
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
    ),

    # ── 7. Replace the native confirm() in "Empty expired items" the
    #      same way. ──
    (
        "7. Replace native confirm() in Empty expired items with styled modal",
        """  async function purgeExpired() {
    if(!confirm('Delete all recycle bin items past their 30-day limit?')) return;
    const {data}=await db.from('listings').select('id, listing_photos(*)').eq('recycle_bin',true).lt('purge_at',new Date().toISOString());
    if(!data?.length){toast('Nothing to purge','');return;}
    for(const row of data) await deleteListingCascade(row.id, row);
    logAction('purge_expired','listing','bulk',`${data.length} listing(s)`);
    toast(`${data.length} purged`,'success'); loadRecycleBin();
  }""",
        """  function purgeExpired() {
    openConfirm({
      title:'Empty expired items?',
      message:'Delete all recycle bin items past their 30-day limit? This cannot be undone.',
      warningText:'⚠ Irreversible.',
      confirmText:'Delete expired items', confirmClass:'reject',
      onConfirm: async () => {
        const {data}=await db.from('listings').select('id, listing_photos(*)').eq('recycle_bin',true).lt('purge_at',new Date().toISOString());
        if(!data?.length){toast('Nothing to purge','');return;}
        for(const row of data) await deleteListingCascade(row.id, row);
        logAction('purge_expired','listing','bulk',`${data.length} listing(s)`);
        toast(`${data.length} purged`,'success'); loadRecycleBin();
      }
    });
  }""",
    ),

    # ── 8. Featuring a listing was a silent, unlogged free upgrade with no
    #      payment record — indistinguishable in the data from a paid
    #      upgrade. Now requires an explicit confirm that makes clear no
    #      payment is being recorded, and logs that fact. ──
    (
        "8. Feature listing: confirm + clearly log as unpaid comp",
        """  async function featureListing(id) {
    const until=new Date(Date.now()+SETTINGS.featured_duration_days*24*60*60*1000).toISOString();
    const {error}=await db.from('listings').update({is_featured:true,featured_until:until}).eq('id',id);
    if(error){toast('Error featuring listing','error');return;}
    logAction('feature_listing','listing',id,'');
    toast('Listing featured ✓','success');
    const l=_listings[id]; if(l){ l.is_featured=true; l.featured_until=until; }
    loadOverview(); if(currentView==='listings') loadAllListings();
  }""",
        """  function featureListing(id) {
    const l = _listings[id]; if(!l) return;
    openConfirm({
      title:'Feature this listing for free?',
      message:`"${l.title}" will be featured without recording a payment. If the seller paid for this, use "Process upgrade" instead so it shows up in Payments/Revenue.`,
      confirmText:'Feature for free', confirmClass:'approve',
      onConfirm:()=>doFeatureListingFree(id)
    });
  }
  async function doFeatureListingFree(id) {
    const until=new Date(Date.now()+SETTINGS.featured_duration_days*24*60*60*1000).toISOString();
    const {error}=await db.from('listings').update({is_featured:true,featured_until:until}).eq('id',id);
    if(error){toast('Error featuring listing','error');return;}
    logAction('feature_listing','listing',id,'Featured without a recorded payment (admin comp)');
    const l=_listings[id];
    if(l){
      l.is_featured=true; l.featured_until=until;
      if (l.seller_id) notifyInApp(l.seller_id, 'listing_approved', 'Listing featured', `"${l.title}" is now featured.`, '/dashboard.html');
    }
    toast('Listing featured ✓ (no payment recorded)','success');
    loadOverview(); if(currentView==='listings') loadAllListings();
  }""",
    ),

    # ── 9. Overview's per-category counts ran as 5 sequential round-trips;
    #      they're independent, so run them in parallel. ──
    (
        "9. Parallelize category counts on the dashboard overview",
        """    for (const cat of ['apartment','house','boarding','airbnb','commercial']) {
      const {count} = await db.from('listings').select('*',{count:'exact',head:true}).eq('category',cat).eq('status','active').eq('recycle_bin',false);
      const el = document.getElementById('cat-'+cat);
      if (el) el.textContent = count||0;
    }""",
        """    await Promise.all(['apartment','house','boarding','airbnb','commercial'].map(async (cat) => {
      const {count} = await db.from('listings').select('*',{count:'exact',head:true}).eq('category',cat).eq('status','active').eq('recycle_bin',false);
      const el = document.getElementById('cat-'+cat);
      if (el) el.textContent = count||0;
    }));""",
    ),

    # ── 10. CSV export ignored every filter on screen (tab, county, area,
    #       category, search, seller filter) — always exported ALL
    #       listings. Now scoped to match what's actually being viewed,
    #       and includes seller name/email/phone since a listings export
    #       with no seller contact is of limited use for follow-up. ──
    (
        "10. Export CSV: respect current filters + include seller info",
        """  async function exportListingsCSV() {
    const {data} = await db.from('listings').select('id,listing_number,title,county,area,category,price,price_min,price_max,status,payment_status,is_featured,created_at');
    // Put the human-facing listing_number first, keep the UUID (id) further
    // right for anyone who specifically needs it — e.g. to cross-reference
    // with a Supabase table editor.
    const rows = (data||[]).map(({ id, listing_number, ...rest }) => ({
      listing_number: listing_number != null ? String(listing_number).padStart(6,'0') : '',
      ...rest,
      id,
    }));
    exportCSV(rows, `nyumba254-listings-${Date.now()}.csv`);
  }""",
        """  async function exportListingsCSV() {
    let q = db.from('listings').select('id,listing_number,title,county,area,category,price,price_min,price_max,status,payment_status,is_featured,created_at,profiles(full_name,email,phone)');
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
    const {data} = await q;
    // Put the human-facing listing_number first, keep the UUID (id) further
    // right for anyone who specifically needs it — e.g. to cross-reference
    // with a Supabase table editor.
    const rows = (data||[]).map(({ id, listing_number, profiles, ...rest }) => ({
      listing_number: listing_number != null ? String(listing_number).padStart(6,'0') : '',
      ...rest,
      seller_name: profiles?.full_name || '',
      seller_email: profiles?.email || '',
      seller_phone: profiles?.phone || '',
      id,
    }));
    if (!rows.length) { toast('No listings match the current filters','error'); return; }
    exportCSV(rows, `nyumba254-listings-${Date.now()}.csv`);
  }""",
    ),

    # ── 11. Add a "View live" link to the listing detail modal so an admin
    #       can see the listing exactly as a buyer would, without leaving
    #       the admin panel to construct the URL by hand. ──
    (
        "11. Add 'View live' link to the listing detail modal",
        """    document.getElementById('modal-footer').innerHTML = `
      ${l.status==='pending'?`<button class="btn-modal approve" onclick="approveListing('${l.id}');closeModal()">Approve</button><button class="btn-modal reject" onclick="rejectListing('${l.id}');closeModal()">Reject</button>`:''}""",
        """    document.getElementById('modal-footer').innerHTML = `
      ${l.listing_number?`<button class="btn-modal cancel" onclick="window.open('/listing?id=${String(l.listing_number).padStart(6,'0')}','_blank','noopener,noreferrer')">View live ↗</button>`:''}
      ${l.status==='pending'?`<button class="btn-modal approve" onclick="approveListing('${l.id}');closeModal()">Approve</button><button class="btn-modal reject" onclick="rejectListing('${l.id}');closeModal()">Reject</button>`:''}""",
    ),
]


def main():
    parser = argparse.ArgumentParser(description="Apply Listings-section fixes to the admin dashboard HTML.")
    parser.add_argument("file", help="Path to your admin dashboard HTML file")
    parser.add_argument("--dry-run", action="store_true", help="Report what would change without writing anything")
    args = parser.parse_args()

    try:
        with open(args.file, "r", encoding="utf-8") as f:
            content = f.read()
    except OSError as e:
        print(f"❌ Could not read {args.file}: {e}")
        sys.exit(1)

    applied, skipped_missing, skipped_ambiguous = [], [], []
    new_content = content

    for name, old, new in PATCHES:
        count = new_content.count(old)
        if count == 0:
            skipped_missing.append(name)
        elif count > 1:
            skipped_ambiguous.append(name)
        else:
            new_content = new_content.replace(old, new, 1)
            applied.append(name)

    print(f"\n{'DRY RUN — no files will be changed' if args.dry_run else 'Applying patches'}\n" + "-" * 60)
    for name in applied:
        print(f"  ✅ {name}")
    for name in skipped_missing:
        print(f"  ⏭️  SKIPPED (pattern not found — file may already differ): {name}")
    for name in skipped_ambiguous:
        print(f"  ⚠️  SKIPPED (pattern found more than once — needs manual review): {name}")
    print("-" * 60)
    print(f"{len(applied)}/{len(PATCHES)} patches applied.\n")

    if args.dry_run:
        print("Dry run only — no files written.")
        return

    if not applied:
        print("Nothing to write — no patches matched your file.")
        return

    timestamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup_path = f"{args.file}.bak-{timestamp}"
    shutil.copy2(args.file, backup_path)
    print(f"Backup saved to: {backup_path}")

    with open(args.file, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Patched file written to: {args.file}")


if __name__ == "__main__":
    main()
