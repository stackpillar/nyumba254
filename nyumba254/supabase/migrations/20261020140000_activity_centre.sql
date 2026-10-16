-- Part A: Account Activity Centre. Idempotent.
-- Rollback (in order): drop triggers activity_* on listings/payments/profiles; drop functions
--   get_my_activity, count_my_activity, admin_get_user_activity, log_activity, begin_activity_export,
--   finish_activity_export, purge_activity_events, nk_log_activity, activity_rows;
--   drop tables export_requests, account_activity_events; delete platform_settings keys
--   activity_retention_months, activity_cutover.
begin;

create table if not exists public.account_activity_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  actor_id uuid,
  category text not null check (category in (
    'account','role','listings','fees','enquiries','viewings','reviews','payments',
    'lister_page','rent','team','data','saved')),
  action text not null,
  entity_type text,
  entity_id text,
  summary text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists account_activity_user_time_idx
  on public.account_activity_events (user_id, created_at desc, id);
create index if not exists account_activity_user_cat_idx
  on public.account_activity_events (user_id, category, created_at desc);
alter table public.account_activity_events enable row level security;
revoke all on public.account_activity_events from public, anon, authenticated;
grant select on public.account_activity_events to authenticated;
drop policy if exists activity_owner_select on public.account_activity_events;
create policy activity_owner_select on public.account_activity_events
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

create table if not exists public.export_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  categories text[] not null default '{}',
  from_ts timestamptz,
  to_ts timestamptz,
  format text not null default 'zip',
  row_count integer,
  created_at timestamptz not null default now()
);
create index if not exists export_requests_user_time_idx on public.export_requests (user_id, created_at desc);
alter table public.export_requests enable row level security;
revoke all on public.export_requests from public, anon, authenticated;
grant select on public.export_requests to authenticated;
drop policy if exists export_requests_owner_select on public.export_requests;
create policy export_requests_owner_select on public.export_requests
  for select to authenticated using (user_id = auth.uid() or public.is_admin());

insert into public.platform_settings (key, value) values
  ('activity_retention_months', '24'::jsonb),
  ('activity_cutover', to_jsonb(now()::text))
on conflict (key) do nothing;

-- Internal writer. Not callable by clients.
create or replace function public.nk_log_activity(
  p_user uuid, p_actor uuid, p_category text, p_action text,
  p_entity_type text, p_entity_id text, p_summary text, p_meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if p_user is null then return; end if;
  insert into public.account_activity_events(user_id, actor_id, category, action, entity_type, entity_id, summary, meta)
  values (p_user, p_actor, p_category, p_action, p_entity_type, p_entity_id, left(p_summary, 300), coalesce(p_meta, '{}'::jsonb));
exception when others then
  null; -- activity logging must never block the underlying change
end;
$function$;
revoke all on function public.nk_log_activity(uuid,uuid,text,text,text,text,text,jsonb) from public, anon, authenticated;

-- Triggers: small, SECURITY DEFINER, and failure-proof.
create or replace function public.activity_trg_listings()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.nk_log_activity(new.seller_id, auth.uid(), 'listings', 'created', 'listing', new.id::text,
      'Listing created: ' || coalesce(new.title, 'Untitled'), jsonb_build_object('listing_number', new.listing_number));
  elsif new.status is distinct from old.status then
    perform public.nk_log_activity(new.seller_id, auth.uid(), 'listings', 'status_' || coalesce(new.status, 'unknown'), 'listing', new.id::text,
      'Listing "' || coalesce(new.title, 'Untitled') || '" changed from ' || coalesce(old.status, '—') || ' to ' || coalesce(new.status, '—'),
      jsonb_build_object('listing_number', new.listing_number));
  elsif coalesce(new.recycle_bin, false) and not coalesce(old.recycle_bin, false) then
    perform public.nk_log_activity(new.seller_id, auth.uid(), 'listings', 'deleted', 'listing', new.id::text,
      'Listing moved to the recycle bin: ' || coalesce(new.title, 'Untitled'), jsonb_build_object('listing_number', new.listing_number));
  end if;
  return null;
end;
$function$;
drop trigger if exists activity_listings on public.listings;
create trigger activity_listings after insert or update of status, recycle_bin on public.listings
  for each row execute function public.activity_trg_listings();

create or replace function public.activity_trg_payments()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare v_ref text := coalesce(new.mpesa_receipt, new.mpesa_ref, new.reference);
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    perform public.nk_log_activity(new.seller_id, auth.uid(), 'payments', 'payment_' || coalesce(new.status, 'recorded'), 'payment', new.id::text,
      'Payment ' || coalesce(new.status, 'recorded') || ': KES ' || coalesce(new.amount, 0)::text,
      jsonb_build_object('amount_kes', new.amount, 'status', new.status, 'type', new.type,
        'reference', case when v_ref is null then null else '••••' || right(v_ref, 4) end));
  end if;
  return null;
end;
$function$;
drop trigger if exists activity_payments on public.payments;
create trigger activity_payments after insert or update of status on public.payments
  for each row execute function public.activity_trg_payments();

create or replace function public.activity_trg_profiles()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.phone is distinct from old.phone then
    perform public.nk_log_activity(new.id, auth.uid(), 'account', 'phone_changed', 'profile', new.id::text, 'Phone number changed', '{}'::jsonb);
  end if;
  if new.lister_page_visibility is distinct from old.lister_page_visibility then
    perform public.nk_log_activity(new.id, auth.uid(), 'lister_page', 'visibility_changed', 'profile', new.id::text,
      'Lister Page visibility changed to ' || new.lister_page_visibility, '{}'::jsonb);
  end if;
  if new.handle is distinct from old.handle then
    perform public.nk_log_activity(new.id, auth.uid(), 'lister_page', 'handle_changed', 'profile', new.id::text,
      'Lister Page handle changed', jsonb_build_object('new_handle', new.handle));
  end if;
  return null;
end;
$function$;
drop trigger if exists activity_profiles on public.profiles;
create trigger activity_profiles after update of phone, lister_page_visibility, handle on public.profiles
  for each row execute function public.activity_trg_profiles();

-- Client-reported events: allow-listed only.
create or replace function public.log_activity(
  p_category text, p_action text, p_entity_type text default null, p_entity_id text default null,
  p_summary text default null, p_meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Authentication is required'; end if;
  if not ((p_category = 'account' and p_action = 'sign_in')
       or (p_category = 'data' and p_action in ('backup_downloaded','export_generated'))) then
    raise exception 'That activity type cannot be logged from the browser.';
  end if;
  if p_action = 'sign_in' and exists (
    select 1 from public.account_activity_events
    where user_id = v_uid and action = 'sign_in' and created_at > now() - interval '30 minutes') then
    return;
  end if;
  perform public.nk_log_activity(v_uid, v_uid, p_category, p_action, null, null,
    case p_action when 'sign_in' then 'Signed in' when 'backup_downloaded' then 'Account backup downloaded' else 'Activity report generated' end,
    jsonb_build_object('device', left(coalesce(p_meta->>'device', ''), 60)));
end;
$function$;
revoke all on function public.log_activity(text,text,text,text,text,jsonb) from public, anon;
grant execute on function public.log_activity(text,text,text,text,text,jsonb) to authenticated;

-- Shared reader: events plus rows derived from legacy tables (derived rows are marked source='derived').
create or replace function public.activity_rows(
  p_user uuid, p_categories text[], p_from timestamptz, p_to timestamptz,
  p_limit integer, p_cursor jsonb, p_count_only boolean)
returns table (id text, created_at timestamptz, category text, action text, entity_type text,
               entity_id text, summary text, meta jsonb, source text)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_cutover timestamptz := coalesce((select (value #>> '{}')::timestamptz from public.platform_settings where key = 'activity_cutover'), now());
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 500);
  v_cur_ts timestamptz := nullif(p_cursor->>'ts', '')::timestamptz;
  v_cur_id text := p_cursor->>'id';
  v_cats text[] := coalesce(p_categories, array[]::text[]);
begin
  return query
  with src as (
    select e.id::text as id, e.created_at, e.category, e.action, e.entity_type, e.entity_id, e.summary, e.meta, 'event'::text as source
    from public.account_activity_events e where e.user_id = p_user
    union all
    select 'd:l:' || l.id, l.created_at, 'listings', 'created', 'listing', l.id::text,
           'Listing created: ' || coalesce(l.title, 'Untitled'), jsonb_build_object('listing_number', l.listing_number), 'derived'
    from public.listings l where l.seller_id = p_user and l.created_at < v_cutover
    union all
    select 'd:p:' || p.id, p.created_at, 'payments', 'payment_' || coalesce(p.status, 'recorded'), 'payment', p.id::text,
           'Payment ' || coalesce(p.status, 'recorded') || ': KES ' || coalesce(p.amount, 0)::text,
           jsonb_build_object('amount_kes', p.amount, 'status', p.status,
             'reference', case when coalesce(p.mpesa_receipt, p.mpesa_ref, p.reference) is null then null
                               else '••••' || right(coalesce(p.mpesa_receipt, p.mpesa_ref, p.reference), 4) end), 'derived'
    from public.payments p where p.seller_id = p_user and p.created_at < v_cutover
    union all
    select 'd:rh:' || r.id, r.changed_at, 'role', 'role_changed', 'profile', p_user::text,
           'Account type changed from ' || coalesce(r.previous_account_type, '—') || ' to ' || coalesce(r.new_account_type, '—'), '{}'::jsonb, 'derived'
    from public.role_history r where r.profile_id = p_user
    union all
    select 'd:atr:' || a.id, a.submitted_at, 'role', 'role_change_requested', 'profile', p_user::text,
           'Account type change requested: ' || coalesce(a.requested_account_type, '—') || ' (' || coalesce(a.status, 'pending') || ')', '{}'::jsonb, 'derived'
    from public.account_type_change_requests a where a.profile_id = p_user
    union all
    select 'd:val:' || v.id, v.created_at, 'role', 'verification_' || coalesce(v.action, 'update'), 'profile', p_user::text,
           'Verification: ' || replace(coalesce(v.action, 'update'), '_', ' '), '{}'::jsonb, 'derived'
    from public.verification_activity_log v where v.seller_id = p_user
    union all
    select 'd:vfh:' || h.id, h.changed_at, 'fees', 'fee_changed', h.object_type, h.object_id::text,
           'Viewing fee changed from KES ' || coalesce(h.old_fee::text, '—') || ' to KES ' || coalesce(h.new_fee::text, '—'),
           jsonb_build_object('old_fee', h.old_fee, 'new_fee', h.new_fee), 'derived'
    from public.viewing_fee_history h
    where h.object_id::text = p_user::text
       or h.object_id::text in (select l.id::text from public.listings l where l.seller_id = p_user)
    union all
    select 'd:vr:' || vr.id, vr.created_at, 'viewings', 'viewing_requested', 'listing', vr.listing_id::text,
           'Viewing requested for "' || coalesce(l.title, 'a listing') || '" (' || coalesce(vr.status, 'pending') || ')',
           jsonb_build_object('fee_at_request', vr.fee_at_request, 'fee_acknowledged', vr.viewing_fee_acknowledged, 'status', vr.status), 'derived'
    from public.viewing_requests vr join public.listings l on l.id = vr.listing_id where l.seller_id = p_user
    union all
    select 'd:enr:' || e.id, e.created_at, 'enquiries', 'enquiry_received', 'listing', e.listing_id::text,
           'Enquiry received on "' || coalesce(l.title, 'a listing') || '"', '{}'::jsonb, 'derived'
    from public.enquiries e join public.listings l on l.id = e.listing_id where l.seller_id = p_user
    union all
    select 'd:ens:' || e.id, e.created_at, 'enquiries', 'enquiry_sent', 'listing', e.listing_id::text,
           'Enquiry sent about "' || coalesce(l.title, 'a listing') || '"', '{}'::jsonb, 'derived'
    from public.enquiries e join public.listings l on l.id = e.listing_id where e.buyer_id = p_user
    union all
    select 'd:rv:' || rv.id, rv.created_at, 'reviews', 'review_received', 'review', rv.id::text,
           'Review received: ' || coalesce(rv.rating::text, '—') || ' stars', jsonb_build_object('status', rv.status), 'derived'
    from public.reviews rv where rv.target_seller_id = p_user
    union all
    select 'd:sl:' || s.id, s.created_at, 'saved', 'listing_saved', 'listing', s.listing_id::text,
           'Saved listing "' || coalesce(l.title, 'a listing') || '"', '{}'::jsonb, 'derived'
    from public.saved_listings s left join public.listings l on l.id = s.listing_id where s.user_id = p_user
    union all
    select 'd:ss:' || s.id, s.created_at, 'saved', 'search_saved', 'saved_search', s.id::text,
           'Saved search: ' || concat_ws(', ', s.category, s.area, s.county), '{}'::jsonb, 'derived'
    from public.saved_searches s where s.buyer_id = p_user
    union all
    select 'd:tm:' || t.id, coalesce(t.joined_at, t.invited_at), 'team',
           case when t.joined_at is not null then 'member_joined' else 'member_invited' end, 'team_member', t.id::text,
           case when t.joined_at is not null then 'A team member joined' else 'A team member was invited' end, '{}'::jsonb, 'derived'
    from public.team_members t where t.owner_id = p_user
    union all
    select 'd:lh:' || h.id, h.replaced_at, 'lister_page', 'handle_changed', 'profile', p_user::text,
           'Lister Page handle changed', '{}'::jsonb, 'derived'
    from public.lister_handle_history h where h.profile_id = p_user and h.replaced_at < v_cutover
  )
  select s.id, s.created_at, s.category, s.action, s.entity_type, s.entity_id, s.summary, s.meta, s.source
  from src s
  where s.created_at is not null
    and (cardinality(v_cats) = 0 or s.category = any(v_cats))
    and (p_from is null or s.created_at >= p_from)
    and (p_to is null or s.created_at <= p_to)
    and (v_cur_ts is null or (s.created_at, s.id) < (v_cur_ts, coalesce(v_cur_id, '')))
  order by s.created_at desc, s.id desc
  limit case when p_count_only then 100000 else v_limit end;
end;
$function$;
revoke all on function public.activity_rows(uuid,text[],timestamptz,timestamptz,integer,jsonb,boolean) from public, anon, authenticated;

create or replace function public.get_my_activity(
  p_categories text[] default null, p_from timestamptz default null, p_to timestamptz default null,
  p_limit integer default 100, p_cursor jsonb default null)
returns table (id text, created_at timestamptz, category text, action text, entity_type text,
               entity_id text, summary text, meta jsonb, source text)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  return query select * from public.activity_rows(auth.uid(), p_categories, p_from, p_to, p_limit, p_cursor, false);
end;
$function$;
revoke all on function public.get_my_activity(text[],timestamptz,timestamptz,integer,jsonb) from public, anon;
grant execute on function public.get_my_activity(text[],timestamptz,timestamptz,integer,jsonb) to authenticated;

create or replace function public.count_my_activity(
  p_categories text[] default null, p_from timestamptz default null, p_to timestamptz default null)
returns table (category text, n bigint)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  return query select r.category, count(*) from public.activity_rows(auth.uid(), p_categories, p_from, p_to, 500, null, true) r group by r.category;
end;
$function$;
revoke all on function public.count_my_activity(text[],timestamptz,timestamptz) from public, anon;
grant execute on function public.count_my_activity(text[],timestamptz,timestamptz) to authenticated;

-- Admin read: reason required, first page logged in admin_logs.
create or replace function public.admin_get_user_activity(
  p_user uuid, p_reason text, p_categories text[] default null, p_from timestamptz default null,
  p_to timestamptz default null, p_limit integer default 100, p_cursor jsonb default null)
returns table (id text, created_at timestamptz, category text, action text, entity_type text,
               entity_id text, summary text, meta jsonb, source text)
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not public.is_admin() then raise exception 'Not authorised'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A reason is required to view a user''s activity.'; end if;
  if p_cursor is null then
    insert into public.admin_logs(admin_id, admin_name, action, target_type, target_id, details)
    values (auth.uid(), null, 'view_user_activity', 'profile', p_user::text, left(btrim(p_reason), 500));
  end if;
  return query select * from public.activity_rows(p_user, p_categories, p_from, p_to, p_limit, p_cursor, false);
end;
$function$;
revoke all on function public.admin_get_user_activity(uuid,text,text[],timestamptz,timestamptz,integer,jsonb) from public, anon;
grant execute on function public.admin_get_user_activity(uuid,text,text[],timestamptz,timestamptz,integer,jsonb) to authenticated;

-- Export gate: 5 per hour; sensitive categories need a sign-in within 15 minutes.
create or replace function public.begin_activity_export(
  p_categories text[], p_from timestamptz, p_to timestamptz, p_format text default 'zip')
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $function$
declare
  v_uid uuid := auth.uid();
  v_last timestamptz;
  v_id uuid;
begin
  if v_uid is null then raise exception 'Authentication is required'; end if;
  if p_format not in ('zip','csv','pdf','json') then raise exception 'Unsupported format'; end if;
  if (select count(*) from public.export_requests where user_id = v_uid and created_at > now() - interval '1 hour') >= 5 then
    raise exception 'You can generate up to 5 reports per hour. Please try again later.';
  end if;
  if coalesce(p_categories, array[]::text[]) && array['payments','account'] then
    select last_sign_in_at into v_last from auth.users where id = v_uid;
    if v_last is null or v_last < now() - interval '15 minutes' then
      raise exception 'REAUTH_REQUIRED';
    end if;
  end if;
  insert into public.export_requests(user_id, categories, from_ts, to_ts, format)
  values (v_uid, coalesce(p_categories, '{}'), p_from, p_to, p_format) returning id into v_id;
  perform public.nk_log_activity(v_uid, v_uid, 'data', 'export_generated', 'export', v_id::text, 'Activity report generated (' || p_format || ')',
    jsonb_build_object('categories', coalesce(p_categories, '{}')));
  return jsonb_build_object('export_id', v_id);
end;
$function$;
revoke all on function public.begin_activity_export(text[],timestamptz,timestamptz,text) from public, anon;
grant execute on function public.begin_activity_export(text[],timestamptz,timestamptz,text) to authenticated;

create or replace function public.finish_activity_export(p_id uuid, p_rows integer)
returns void
language sql
security definer
set search_path = public
as $function$
  update public.export_requests set row_count = greatest(coalesce(p_rows, 0), 0) where id = p_id and user_id = auth.uid();
$function$;
revoke all on function public.finish_activity_export(uuid,integer) from public, anon;
grant execute on function public.finish_activity_export(uuid,integer) to authenticated;

create or replace function public.purge_activity_events()
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_months integer := coalesce((select nullif(value #>> '{}', '')::integer from public.platform_settings where key = 'activity_retention_months'), 24);
  v_n integer;
begin
  delete from public.account_activity_events where created_at < now() - make_interval(months => greatest(v_months, 1));
  get diagnostics v_n = row_count;
  delete from public.export_requests where created_at < now() - interval '24 months';
  return v_n;
end;
$function$;
revoke all on function public.purge_activity_events() from public, anon, authenticated;
grant execute on function public.purge_activity_events() to service_role;

commit;
