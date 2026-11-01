-- Realtime for listing_videos so owners and admins see changes without refreshing.
-- Public viewers do not subscribe (their page loads fresh data on open).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listing_videos'
  ) then
    alter publication supabase_realtime add table public.listing_videos;
  end if;
end $$;

alter table public.listing_videos replica identity full;

-- Rollback:
--   alter publication supabase_realtime drop table public.listing_videos;
--   alter table public.listing_videos replica identity default;
