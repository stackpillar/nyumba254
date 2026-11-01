-- Phase 6: video walkthroughs stored in Supabase Storage, one shared set of rules.
-- Additive only. Rollback notes are at the bottom.
begin;

-- ── Bucket ────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-videos', 'listing-videos', true, 104857600,
        array['video/mp4','video/webm','video/quicktime','image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- ── Columns (existing rows are links) ─────────────────────────────────────
alter table public.listing_videos
  add column if not exists source text not null default 'link',
  add column if not exists storage_path text,
  add column if not exists poster_url text,
  add column if not exists width integer,
  add column if not exists height integer,
  add column if not exists duration_seconds numeric,
  add column if not exists aspect_ratio numeric,
  add column if not exists orientation text,
  add column if not exists mime_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists provider text,
  add column if not exists embed_url text,
  add column if not exists status text not null default 'ready',
  add column if not exists created_by uuid;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'listing_videos_source_chk') then
    alter table public.listing_videos add constraint listing_videos_source_chk check (source in ('upload','link'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listing_videos_status_chk') then
    alter table public.listing_videos add constraint listing_videos_status_chk check (status in ('ready','processing','rejected'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'listing_videos_orientation_chk') then
    alter table public.listing_videos add constraint listing_videos_orientation_chk check (orientation is null or orientation in ('landscape','portrait','square'));
  end if;
end $$;

create or replace function public.nk_video_provider(p_url text) returns text
language sql immutable set search_path = public as $$
  select case
    when p_url ~* '^https?://([a-z0-9-]+\.)*(youtube\.com|youtu\.be|youtube-nocookie\.com)/' then 'youtube'
    when p_url ~* '^https?://([a-z0-9-]+\.)*vimeo\.com/' then 'vimeo'
    when p_url ~* '^https?://([a-z0-9-]+\.)*tiktok\.com/' then 'tiktok'
    when p_url ~* '^https?://([a-z0-9-]+\.)*instagram\.com/' then 'instagram'
    when p_url ~* '\.(mp4|webm|mov|m4v)(\?.*)?$' then 'direct'
    else 'direct' end;
$$;

update public.listing_videos
   set provider = public.nk_video_provider(url)
 where provider is null;
update public.listing_videos
   set source = 'upload', provider = 'upload',
       storage_path = substring(url from '/storage/v1/object/public/listing-videos/(.+)$')
 where url ~ '/storage/v1/object/public/listing-videos/' and storage_path is null;

create index if not exists listing_videos_listing_idx on public.listing_videos (listing_id, position);

-- ── Settings ──────────────────────────────────────────────────────────────
insert into public.platform_settings (key, value) values
  ('video_max_seconds', '60'::jsonb),
  ('video_max_mb', '50'::jsonb),
  ('video_requires_review', '0'::jsonb)
on conflict (key) do nothing;

-- ── Helpers (SECURITY DEFINER, fixed search_path, no self-querying policies) ──
create or replace function public.can_manage_listing_video(p_listing_id text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_id uuid; v_seller uuid;
begin
  if auth.uid() is null then return false; end if;
  begin v_id := p_listing_id::uuid; exception when others then return false; end;
  if public.is_admin() then return true; end if;
  select seller_id into v_seller from public.listings where id = v_id;
  return v_seller is not null and v_seller = public.effective_seller_id();
end $$;

create or replace function public.can_upload_listing_video(p_listing_id text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v_seller uuid; v_blocked boolean;
begin
  if not public.can_manage_listing_video(p_listing_id) then return false; end if;
  if public.is_admin() then return true; end if;
  select seller_id into v_seller from public.listings where id = p_listing_id::uuid;
  select coalesce(video_walkthrough_blocked, false) into v_blocked from public.profiles where id = v_seller;
  return not coalesce(v_blocked, false);
end $$;

grant execute on function public.can_manage_listing_video(text) to authenticated;
grant execute on function public.can_upload_listing_video(text) to authenticated;
grant execute on function public.nk_video_provider(text) to anon, authenticated;

-- ── Storage policies ──────────────────────────────────────────────────────
drop policy if exists "listing-videos public read" on storage.objects;
create policy "listing-videos public read" on storage.objects for select
  using (bucket_id = 'listing-videos');
drop policy if exists "listing-videos owner insert" on storage.objects;
create policy "listing-videos owner insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'listing-videos' and public.can_upload_listing_video((storage.foldername(name))[1]));
drop policy if exists "listing-videos owner update" on storage.objects;
create policy "listing-videos owner update" on storage.objects for update to authenticated
  using (bucket_id = 'listing-videos' and public.can_manage_listing_video((storage.foldername(name))[1]))
  with check (bucket_id = 'listing-videos' and public.can_manage_listing_video((storage.foldername(name))[1]));
drop policy if exists "listing-videos owner delete" on storage.objects;
create policy "listing-videos owner delete" on storage.objects for delete to authenticated
  using (bucket_id = 'listing-videos' and public.can_manage_listing_video((storage.foldername(name))[1]));

-- Videos waiting for review are visible only to people who manage the listing.
drop policy if exists "hide non-ready videos" on public.listing_videos;
create policy "hide non-ready videos" on public.listing_videos as restrictive for select
  using (status = 'ready' or public.can_manage_listing_video(listing_id::text));

-- ── RPCs: the single write path ──────────────────────────────────────────
create or replace function public.save_listing_video(
  p_listing_id uuid, p_source text, p_url text, p_storage_path text, p_meta jsonb default '{}'::jsonb)
returns public.listing_videos
language plpgsql security definer set search_path = public, storage as $$
declare
  v_meta jsonb := coalesce(p_meta, '{}'::jsonb);
  v_max_sec numeric := coalesce(public.nk_setting_num('video_max_seconds'), 60);
  v_max_mb numeric := coalesce(public.nk_setting_num('video_max_mb'), 50);
  v_review boolean := coalesce(public.nk_setting_num('video_requires_review'), 0) = 1;
  v_size bigint; v_mime text; v_dur numeric; v_w integer; v_h integer; v_ratio numeric; v_orient text;
  v_provider text; v_pos integer; v_status text := 'ready'; v_url text := p_url; v_poster text; v_row public.listing_videos;
begin
  if auth.uid() is null then raise exception 'VIDEO_AUTH_REQUIRED'; end if;
  if p_source not in ('upload','link') then raise exception 'VIDEO_INVALID_SOURCE'; end if;
  if not public.can_manage_listing_video(p_listing_id::text) then raise exception 'VIDEO_LISTING_ACCESS_DENIED'; end if;
  if not public.is_admin() and not public.can_upload_listing_video(p_listing_id::text) then raise exception 'VIDEO_WALKTHROUGH_BLOCKED'; end if;

  v_dur := nullif(v_meta->>'duration_seconds','')::numeric;
  v_w := nullif(v_meta->>'width','')::integer;
  v_h := nullif(v_meta->>'height','')::integer;
  if v_w is not null and v_h is not null and v_w > 0 and v_h > 0 then
    v_ratio := round(v_w::numeric / v_h, 4);
    v_orient := case when v_ratio > 1.05 then 'landscape' when v_ratio < 0.95 then 'portrait' else 'square' end;
  else
    v_ratio := nullif(v_meta->>'aspect_ratio','')::numeric;
    v_orient := nullif(v_meta->>'orientation','');
    if v_orient is not null and v_orient not in ('landscape','portrait','square') then v_orient := null; end if;
  end if;

  if p_source = 'upload' then
    if p_storage_path is null or p_storage_path !~ ('^' || p_listing_id::text || '/[A-Za-z0-9._-]+$') then raise exception 'VIDEO_BAD_PATH'; end if;
    select (o.metadata->>'size')::bigint, o.metadata->>'mimetype' into v_size, v_mime
      from storage.objects o where o.bucket_id = 'listing-videos' and o.name = p_storage_path;
    if v_size is null then raise exception 'VIDEO_FILE_MISSING'; end if;
    if v_mime not in ('video/mp4','video/webm','video/quicktime') then raise exception 'VIDEO_BAD_TYPE'; end if;
    if v_size > v_max_mb * 1048576 then raise exception 'VIDEO_TOO_LARGE'; end if;
    if v_dur is null or v_dur <= 0 then raise exception 'VIDEO_DURATION_REQUIRED'; end if;
    if v_dur > v_max_sec + 0.5 then raise exception 'VIDEO_TOO_LONG'; end if;
    if p_url is null or p_url !~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/listing-videos/' || p_storage_path || '$') then raise exception 'VIDEO_BAD_URL'; end if;
    v_provider := 'upload';
    if (v_meta->>'poster_url') ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/listing-videos/' || p_listing_id::text || '/[A-Za-z0-9._-]+$') then
      v_poster := v_meta->>'poster_url';
    end if;
  else
    if p_url is null or p_url !~* '^https://[^\s]+$' or length(p_url) > 2048 then raise exception 'VIDEO_URL_MUST_BE_HTTPS'; end if;
    v_provider := public.nk_video_provider(p_url);
  end if;

  if not public.is_admin() and p_source = 'upload' and v_review then v_status := 'processing'; end if;
  select coalesce(max(position), -1) + 1 into v_pos from public.listing_videos where listing_id = p_listing_id;

  insert into public.listing_videos (listing_id, url, position, source, storage_path, poster_url, width, height,
      duration_seconds, aspect_ratio, orientation, mime_type, file_size_bytes, provider, embed_url, status, created_by)
  values (p_listing_id, v_url, v_pos, p_source, case when p_source='upload' then p_storage_path end,
      v_poster, v_w, v_h, v_dur, v_ratio, v_orient, v_mime, v_size, v_provider,
      case when p_source='link' then nullif(left(v_meta->>'embed_url', 2048), '') end, v_status, auth.uid())
  returning * into v_row;
  return v_row;
end $$;

create or replace function public.delete_listing_video(p_video_id bigint)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.listing_videos;
begin
  if auth.uid() is null then raise exception 'VIDEO_AUTH_REQUIRED'; end if;
  select * into v from public.listing_videos where id = p_video_id;
  if not found then raise exception 'VIDEO_NOT_FOUND'; end if;
  if not public.can_manage_listing_video(v.listing_id::text) then raise exception 'VIDEO_LISTING_ACCESS_DENIED'; end if;
  delete from public.listing_videos where id = p_video_id;
  insert into public.admin_logs (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'delete_listing_video', 'listing', v.listing_id::text, left(coalesce(v.source,'') || ' ' || coalesce(v.storage_path, v.url), 300));
  return jsonb_build_object('storage_path', v.storage_path,
    'poster_path', substring(v.poster_url from '/storage/v1/object/public/listing-videos/(.+)$'));
end $$;

-- Owners and admins can set the stored ratio once a direct link has been measured in the browser.
create or replace function public.set_listing_video_ratio(p_video_id bigint, p_width integer, p_height integer)
returns void language plpgsql security definer set search_path = public as $$
declare v public.listing_videos;
begin
  select * into v from public.listing_videos where id = p_video_id;
  if not found or not public.can_manage_listing_video(v.listing_id::text) then return; end if;
  if v.aspect_ratio is not null or coalesce(p_width,0) <= 0 or coalesce(p_height,0) <= 0 then return; end if;
  update public.listing_videos set width = p_width, height = p_height,
    aspect_ratio = round(p_width::numeric / p_height, 4),
    orientation = case when p_width::numeric / p_height > 1.05 then 'landscape' when p_width::numeric / p_height < 0.95 then 'portrait' else 'square' end
  where id = p_video_id;
end $$;

create or replace function public.admin_review_listing_video(p_video_id bigint, p_approve boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  update public.listing_videos set status = case when p_approve then 'ready' else 'rejected' end where id = p_video_id;
  insert into public.admin_logs (admin_id, action, target_type, target_id, details)
  values (auth.uid(), case when p_approve then 'approve_listing_video' else 'reject_listing_video' end, 'video', p_video_id::text, '');
end $$;

create or replace function public.admin_video_storage_stats()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  return jsonb_build_object(
    'uploads', (select count(*) from public.listing_videos where source = 'upload'),
    'links', (select count(*) from public.listing_videos where source = 'link'),
    'bytes', (select coalesce(sum(file_size_bytes), 0) from public.listing_videos where source = 'upload'),
    'pending_review', (select count(*) from public.listing_videos where status = 'processing'));
end $$;

-- Dry-run list of storage files with no matching row, older than 24h.
create or replace function public.admin_list_orphan_videos()
returns table(name text, created_at timestamptz, size bigint)
language plpgsql stable security definer set search_path = public, storage as $$
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  return query
    select o.name, o.created_at, (o.metadata->>'size')::bigint
      from storage.objects o
     where o.bucket_id = 'listing-videos' and o.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.listing_videos v
                        where v.storage_path = o.name or v.poster_url like '%/' || o.name);
end $$;

grant execute on function public.save_listing_video(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.delete_listing_video(bigint) to authenticated;
grant execute on function public.set_listing_video_ratio(bigint, integer, integer) to authenticated;
grant execute on function public.admin_review_listing_video(bigint, boolean) to authenticated;
grant execute on function public.admin_video_storage_stats() to authenticated;
grant execute on function public.admin_list_orphan_videos() to authenticated;
revoke execute on function public.save_listing_video(uuid, text, text, text, jsonb) from anon, public;
revoke execute on function public.delete_listing_video(bigint) from anon, public;
revoke execute on function public.set_listing_video_ratio(bigint, integer, integer) from anon, public;
revoke execute on function public.admin_review_listing_video(bigint, boolean) from anon, public;
revoke execute on function public.admin_video_storage_stats() from anon, public;
revoke execute on function public.admin_list_orphan_videos() from anon, public;

commit;

-- Rollback (manual, keeps data):
--   drop function public.save_listing_video(uuid,text,text,text,jsonb), public.delete_listing_video(bigint),
--     public.set_listing_video_ratio(bigint,integer,integer), public.admin_review_listing_video(bigint,boolean),
--     public.admin_video_storage_stats(), public.admin_list_orphan_videos(), public.can_upload_listing_video(text),
--     public.can_manage_listing_video(text), public.nk_video_provider(text);
--   drop policy "hide non-ready videos" on public.listing_videos;
--   drop policy "listing-videos public read"/"owner insert"/"owner update"/"owner delete" on storage.objects;
--   New columns on listing_videos are left in place (unused by the old code).
