-- Same problem as 20261019130000: ALL-command admin policies on listing child tables read
-- profiles directly, which anonymous visitors cannot do, so embedded photo/unit/video reads failed.

alter policy "admins manage all listing photos" on public.listing_photos
  using (public.is_admin()) with check (public.is_admin());

alter policy "admins manage all listing videos" on public.listing_videos
  using (public.is_admin()) with check (public.is_admin());

alter policy listing_units_admin_all on public.listing_units
  using (public.is_admin()) with check (public.is_admin());
