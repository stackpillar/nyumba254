-- Anonymous visitors cannot read profiles.role or profiles.is_disabled, so three listings
-- policies that read them directly made every anonymous listing query fail with
-- "permission denied for table profiles". Use the existing security-definer helpers instead.

alter policy listings_admin_all on public.listings
  using (public.is_admin())
  with check (public.is_admin());

alter policy listings_public_read on public.listings
  using (
    recycle_bin = false
    and is_disabled = false
    and status = any (array['active'::text, 'occupied'::text])
    and not public.is_seller_suspended(seller_id)
  );

alter policy restrict_disabled_listings_public on public.listings
  using (
    is_disabled = false
    or seller_id = auth.uid()
    or public.is_admin()
  );
