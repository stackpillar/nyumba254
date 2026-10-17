-- Follow-ups: reply speed, report history, more activity triggers, own-message text, media events,
-- company team permissions. Idempotent.
-- Rollback: drop triggers listed below, drop functions get_company_activity, count_company_activity,
--   my_company_activity_access, get_lister_reply_speed, stamp_first_reply, reports_set_reporter and the
--   activity_trg_* functions added here; drop columns enquiries.first_reply_at, reports.reporter_id,
--   team_members.can_view_activity, team_members.can_edit_social_links; delete setting activity_cutover_v2.
begin;

-- 1. Reply speed ------------------------------------------------------------------------------
alter table public.enquiries add column if not exists first_reply_at timestamptz;

create or replace function public.stamp_first_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.sender = 'seller' and coalesce(new.is_ai_reply, false) = false and new.sent_by_admin_id is null then
    update public.enquiries e set first_reply_at = new.created_at
     where e.first_reply_at is null
       and e.listing_id = new.listing_id
       and ((new.buyer_id is not null and e.buyer_id = new.buyer_id)
         or (new.buyer_token is not null and e.buyer_token::text = new.buyer_token::text));
  end if;
  return null;
exception when others then
  return null;
end;
$function$;
drop trigger if exists messages_stamp_first_reply on public.messages;
create trigger messages_stamp_first_reply after insert on public.messages
  for each row execute function public.stamp_first_reply();

update public.enquiries e set first_reply_at = (
  select min(m.created_at) from public.messages m
   where m.sender = 'seller' and coalesce(m.is_ai_reply, false) = false and m.sent_by_admin_id is null
     and m.listing_id = e.listing_id and m.created_at >= e.created_at
     and ((m.buyer_id is not null and m.buyer_id = e.buyer_id)
       or (m.buyer_token is not null and m.buyer_token::text = e.buyer_token::text)))
 where e.first_reply_at is null;

-- Minutes to first reply for a seller's recent enquiries. No personal data is returned.
create or replace function public.get_lister_reply_speed(p_seller uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(m), '[]'::jsonb) from (
    select round(extract(epoch from (e.first_reply_at - e.created_at)) / 60.0)::int as m
      from public.enquiries e join public.listings l on l.id = e.listing_id
     where l.seller_id = p_seller and e.first_reply_at is not null
       and e.first_reply_at > e.created_at and e.first_reply_at < e.created_at + interval '7 days'
     order by e.created_at desc limit 20) t;
$function$;
revoke all on function public.get_lister_reply_speed(uuid) from public;
grant execute on function public.get_lister_reply_speed(uuid) to anon, authenticated;

-- 2. Report history ---------------------------------------------------------------------------
alter table public.reports add column if not exists reporter_id uuid;
create index if not exists reports_reporter_idx on public.reports (reporter_id) where reporter_id is not null;

-- The reporter id is always the signed-in caller (null when anonymous); clients cannot set it.
create or replace function public.reports_set_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.reporter_id := auth.uid();
  return new;
end;
$function$;
drop trigger if exists reports_set_reporter on public.reports;
create trigger reports_set_reporter before insert on public.reports
  for each row execute function public.reports_set_reporter();

create or replace function public.activity_trg_reports()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.reporter_id is not null then
    perform public.nk_log_activity(new.reporter_id, new.reporter_id, 'reviews', 'report_filed', 'report', new.id::text,
      'You filed a report about a ' || coalesce(new.target_type, 'listing') || ': ' || replace(coalesce(new.reason, 'other'), '_', ' '),
      jsonb_build_object('target_type', new.target_type, 'reason', new.reason));
  end if;
  return null;
end;
$function$;
drop trigger if exists activity_reports on public.reports;
create trigger activity_reports after insert on public.reports
  for each row execute function public.activity_trg_reports();

-- 3. Team permissions + activity triggers -----------------------------------------------------
alter table public.team_members add column if not exists can_view_activity boolean not null default false;
alter table public.team_members add column if not exists can_edit_social_links boolean not null default true;

insert into public.platform_settings (key, value) values ('activity_cutover_v2', to_jsonb(now()::text))
on conflict (key) do nothing;

create or replace function public.activity_trg_company()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  perform public.nk_log_activity(new.profile_id, auth.uid(), 'account',
    case when tg_op = 'INSERT' then 'company_profile_created' else 'company_profile_updated' end,
    'company_profile', new.profile_id::text,
    case when tg_op = 'INSERT' then 'Company profile created' else 'Company profile updated' end, '{}'::jsonb);
  return null;
end;
$function$;
drop trigger if exists activity_company on public.company_profiles;
create trigger activity_company after insert or update of company_name, company_type, registration_number, website, logo_url, description
  on public.company_profiles for each row execute function public.activity_trg_company();

create or replace function public.activity_trg_team()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    perform public.nk_log_activity(new.owner_id, auth.uid(), 'team', 'member_invited', 'team_member', new.id::text, 'A team member was invited', '{}'::jsonb);
  elsif tg_op = 'DELETE' then
    perform public.nk_log_activity(old.owner_id, auth.uid(), 'team', 'member_removed', 'team_member', old.id::text, 'A team member was removed', '{}'::jsonb);
  else
    if new.status is distinct from old.status and new.status = 'active' then
      perform public.nk_log_activity(new.owner_id, auth.uid(), 'team', 'member_joined', 'team_member', new.id::text, 'A team member joined', '{}'::jsonb);
    end if;
    if new.can_view_activity is distinct from old.can_view_activity or new.can_edit_social_links is distinct from old.can_edit_social_links then
      perform public.nk_log_activity(new.owner_id, auth.uid(), 'team', 'member_permissions_changed', 'team_member', new.id::text,
        'Team member permissions changed',
        jsonb_build_object('can_view_activity', new.can_view_activity, 'can_edit_social_links', new.can_edit_social_links));
    end if;
  end if;
  return null;
end;
$function$;
drop trigger if exists activity_team on public.team_members;
create trigger activity_team after insert or delete or update of status, can_view_activity, can_edit_social_links
  on public.team_members for each row execute function public.activity_trg_team();

create or replace function public.activity_trg_reviews()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.target_seller_id is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.nk_log_activity(new.target_seller_id, auth.uid(), 'reviews', 'review_received', 'review', new.id::text,
      'Review received: ' || coalesce(new.rating::text, '—') || ' stars', jsonb_build_object('status', new.status));
  elsif new.response_text is distinct from old.response_text and new.response_text is not null then
    perform public.nk_log_activity(new.target_seller_id, auth.uid(), 'reviews', 'review_responded', 'review', new.id::text,
      'You responded to a review', '{}'::jsonb);
  end if;
  return null;
end;
$function$;
drop trigger if exists activity_reviews on public.reviews;
create trigger activity_reviews after insert or update of response_text on public.reviews
  for each row execute function public.activity_trg_reviews();

create or replace function public.activity_trg_viewings()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare v_seller uuid; v_title text;
begin
  select seller_id, title into v_seller, v_title from public.listings where id = new.listing_id;
  if v_seller is null then return null; end if;
  if tg_op = 'INSERT' then
    perform public.nk_log_activity(v_seller, auth.uid(), 'viewings', 'viewing_requested', 'listing', new.listing_id::text,
      'Viewing requested for "' || coalesce(v_title, 'a listing') || '" (' || coalesce(new.status, 'pending') || ')',
      jsonb_build_object('fee_at_request', new.fee_at_request, 'fee_acknowledged', new.viewing_fee_acknowledged, 'status', new.status));
  elsif new.status is distinct from old.status then
    perform public.nk_log_activity(v_seller, auth.uid(), 'viewings', 'viewing_' || coalesce(new.status, 'updated'), 'listing', new.listing_id::text,
      'Viewing for "' || coalesce(v_title, 'a listing') || '" changed to ' || coalesce(new.status, '—'),
      jsonb_build_object('status', new.status));
  end if;
  return null;
end;
$function$;
drop trigger if exists activity_viewings on public.viewing_requests;
create trigger activity_viewings after insert or update of status on public.viewing_requests
  for each row execute function public.activity_trg_viewings();

-- 4. Password and email changes: only the fact of the change is recorded, never a value.
create or replace function public.activity_trg_auth()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $function$
begin
  begin
    if new.encrypted_password is distinct from old.encrypted_password then
      perform public.nk_log_activity(new.id, new.id, 'account', 'password_changed', 'user', new.id::text, 'Password changed', '{}'::jsonb);
    end if;
    if new.email is distinct from old.email then
      perform public.nk_log_activity(new.id, new.id, 'account', 'email_changed', 'user', new.id::text, 'Email address changed', '{}'::jsonb);
    end if;
  exception when others then
    null;
  end;
  return null;
end;
$function$;
revoke all on function public.activity_trg_auth() from public, anon, authenticated;
do $do$
begin
  drop trigger if exists activity_auth_users on auth.users;
  create trigger activity_auth_users after update of encrypted_password, email on auth.users
    for each row execute function public.activity_trg_auth();
exception when others then
  raise notice 'Could not create auth.users trigger: %', sqlerrm;
end;
$do$;

-- 5. Photo and video events (bursts within 10 minutes are merged into one row).
create or replace function public.activity_trg_media()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_listing uuid := case when tg_op = 'DELETE' then old.listing_id else new.listing_id end;
  v_seller uuid; v_title text; v_kind text; v_action text; v_n integer; v_id uuid;
begin
  select seller_id, title into v_seller, v_title from public.listings where id = v_listing;
  if v_seller is null then return null; end if;
  v_kind := case when tg_table_name = 'listing_videos' then 'video' else 'photo' end;
  v_action := v_kind || case when tg_op = 'DELETE' then '_removed' else '_added' end;
  select e.id, coalesce((e.meta->>'count')::int, 1) into v_id, v_n from public.account_activity_events e
   where e.user_id = v_seller and e.action = v_action and e.entity_id = v_listing::text
     and e.created_at > now() - interval '10 minutes' order by e.created_at desc limit 1;
  if v_id is not null then
    update public.account_activity_events set
      meta = jsonb_build_object('count', v_n + 1),
      summary = left((v_n + 1)::text || ' ' || v_kind || 's ' || case when tg_op = 'DELETE' then 'removed from' else 'added to' end || ' "' || coalesce(v_title, 'Untitled') || '"', 300)
     where id = v_id;
  else
    perform public.nk_log_activity(v_seller, auth.uid(), 'listings', v_action, 'listing', v_listing::text,
      initcap(v_kind) || case when tg_op = 'DELETE' then ' removed from "' else ' added to "' end || coalesce(v_title, 'Untitled') || '"',
      jsonb_build_object('count', 1));
  end if;
  return null;
exception when others then
  return null;
end;
$function$;
drop trigger if exists activity_photos on public.listing_photos;
create trigger activity_photos after insert or delete on public.listing_photos
  for each row execute function public.activity_trg_media();
drop trigger if exists activity_videos on public.listing_videos;
create trigger activity_videos after insert or delete on public.listing_videos
  for each row execute function public.activity_trg_media();

-- 6. Reader: legacy rows now stop at the v2 cutover; own message text added (never exposed to admins or company viewers).
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
  v_cutover2 timestamptz := coalesce((select (value #>> '{}')::timestamptz from public.platform_settings where key = 'activity_cutover_v2'), now());
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
    from public.viewing_requests vr join public.listings l on l.id = vr.listing_id
    where l.seller_id = p_user and vr.created_at < v_cutover2
    union all
    select 'd:enr:' || e.id, e.created_at, 'enquiries', 'enquiry_received', 'listing', e.listing_id::text,
           'Enquiry received on "' || coalesce(l.title, 'a listing') || '"', '{}'::jsonb, 'derived'
    from public.enquiries e join public.listings l on l.id = e.listing_id where l.seller_id = p_user
    union all
    select 'd:ens:' || e.id, e.created_at, 'enquiries', 'enquiry_sent', 'listing', e.listing_id::text,
           'Enquiry sent about "' || coalesce(l.title, 'a listing') || '"',
           case when e.message is null then '{}'::jsonb else jsonb_build_object('message_text', left(e.message, 1000)) end, 'derived'
    from public.enquiries e join public.listings l on l.id = e.listing_id where e.buyer_id = p_user
    union all
    select 'd:msg:' || m.id, m.created_at, 'enquiries', 'message_sent', 'listing', m.listing_id::text,
           'Message sent about "' || coalesce(l.title, 'a listing') || '"',
           jsonb_build_object('message_text', left(m.content, 1000)), 'record'
    from public.messages m join public.listings l on l.id = m.listing_id
    where m.content is not null
      and ((m.sender = 'buyer' and m.buyer_id = p_user)
        or (m.sender = 'seller' and l.seller_id = p_user and coalesce(m.is_ai_reply, false) = false and m.sent_by_admin_id is null))
    union all
    select 'd:rv:' || rv.id, rv.created_at, 'reviews', 'review_received', 'review', rv.id::text,
           'Review received: ' || coalesce(rv.rating::text, '—') || ' stars', jsonb_build_object('status', rv.status), 'derived'
    from public.reviews rv where rv.target_seller_id = p_user and rv.created_at < v_cutover2
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
    from public.team_members t where t.owner_id = p_user and coalesce(t.joined_at, t.invited_at) < v_cutover2
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

-- Admins never see message text.
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
  return query select r.id, r.created_at, r.category, r.action, r.entity_type, r.entity_id, r.summary, r.meta - 'message_text', r.source
    from public.activity_rows(p_user, p_categories, p_from, p_to, p_limit, p_cursor, false) r;
end;
$function$;
revoke all on function public.admin_get_user_activity(uuid,text,text[],timestamptz,timestamptz,integer,jsonb) from public, anon;
grant execute on function public.admin_get_user_activity(uuid,text,text[],timestamptz,timestamptz,integer,jsonb) to authenticated;

-- 7. Company activity for team members the owner has allowed. Payments, account, role, data and message text are excluded.
create or replace function public.my_company_activity_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (select 1 from public.team_members
                  where member_id = auth.uid() and status = 'active' and can_view_activity);
$function$;
revoke all on function public.my_company_activity_access() from public, anon;
grant execute on function public.my_company_activity_access() to authenticated;

create or replace function public.get_company_activity(
  p_categories text[] default null, p_from timestamptz default null, p_to timestamptz default null,
  p_limit integer default 100, p_cursor jsonb default null)
returns table (id text, created_at timestamptz, category text, action text, entity_type text,
               entity_id text, summary text, meta jsonb, source text)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_owner uuid;
  v_allowed text[] := array['listings','fees','enquiries','viewings','reviews','lister_page','team','rent','saved'];
  v_cats text[];
begin
  select owner_id into v_owner from public.team_members
   where member_id = auth.uid() and status = 'active' and can_view_activity limit 1;
  if v_owner is null then raise exception 'You do not have access to company activity.'; end if;
  select coalesce(array_agg(c), array[]::text[]) into v_cats from unnest(v_allowed) c
   where p_categories is null or cardinality(p_categories) = 0 or c = any(p_categories);
  if cardinality(v_cats) = 0 then return; end if;
  return query select r.id, r.created_at, r.category, r.action, r.entity_type, r.entity_id, r.summary, r.meta - 'message_text', r.source
    from public.activity_rows(v_owner, v_cats, p_from, p_to, p_limit, p_cursor, false) r;
end;
$function$;
revoke all on function public.get_company_activity(text[],timestamptz,timestamptz,integer,jsonb) from public, anon;
grant execute on function public.get_company_activity(text[],timestamptz,timestamptz,integer,jsonb) to authenticated;

create or replace function public.count_company_activity(
  p_categories text[] default null, p_from timestamptz default null, p_to timestamptz default null)
returns table (category text, n bigint)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_owner uuid;
  v_allowed text[] := array['listings','fees','enquiries','viewings','reviews','lister_page','team','rent','saved'];
  v_cats text[];
begin
  select owner_id into v_owner from public.team_members
   where member_id = auth.uid() and status = 'active' and can_view_activity limit 1;
  if v_owner is null then raise exception 'You do not have access to company activity.'; end if;
  select coalesce(array_agg(c), array[]::text[]) into v_cats from unnest(v_allowed) c
   where p_categories is null or cardinality(p_categories) = 0 or c = any(p_categories);
  if cardinality(v_cats) = 0 then return; end if;
  return query select r.category, count(*) from public.activity_rows(v_owner, v_cats, p_from, p_to, 500, null, true) r group by r.category;
end;
$function$;
revoke all on function public.count_company_activity(text[],timestamptz,timestamptz) from public, anon;
grant execute on function public.count_company_activity(text[],timestamptz,timestamptz) to authenticated;

-- 8. Social links: the owner decides whether team members may edit the company links.
create or replace function public.my_social_edit_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when not exists (select 1 from public.team_members where member_id = auth.uid() and status = 'active') then true
    else exists (select 1 from public.team_members where member_id = auth.uid() and status = 'active' and can_edit_social_links)
  end;
$function$;
revoke all on function public.my_social_edit_access() from public, anon;
grant execute on function public.my_social_edit_access() to authenticated;

create or replace function public.set_lister_social_links(links jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_type text;
  v_item jsonb;
  v_platform text;
  v_input text;
  v_vis boolean;
  v_ord integer := 0;
  v_handle text;
  v_url text;
  v_keep text[] := '{}';
  v_blocked text[] := array['nyumba254','nyumba.254','nyumba_254','admin','support','official','verified'];
  v_b text;
begin
  if v_uid is null then raise exception 'Please sign in.'; end if;
  if links is null or jsonb_typeof(links) <> 'array' then raise exception 'Invalid request.'; end if;
  if jsonb_array_length(links) > 8 then raise exception 'You can add up to 8 social links.'; end if;
  v_owner := public.effective_seller_id();
  if v_owner <> v_uid and not public.my_social_edit_access() then
    raise exception 'The account owner has not allowed team members to edit social links.';
  end if;
  select account_type into v_type from public.profiles where id = v_owner;
  if v_type is null or v_type = 'buyer' then raise exception 'Social links are only available to listers.'; end if;

  for v_item in select * from jsonb_array_elements(links) loop
    v_platform := lower(btrim(coalesce(v_item->>'platform', '')));
    v_input := coalesce(nullif(btrim(v_item->>'url'), ''), nullif(btrim(v_item->>'handle'), ''));
    v_vis := coalesce((v_item->>'is_visible')::boolean, true);
    if v_platform = any (v_keep) then raise exception 'Each platform can only be added once.'; end if;
    select p.handle, p.url into v_handle, v_url from public.nk_parse_social_link(v_platform, v_input) p;
    if not public.is_admin() then
      foreach v_b in array v_blocked loop
        if position(v_b in lower(v_handle || ' ' || v_url)) > 0 and v_platform <> 'website' then
          raise exception '%: handles that look like Nyumba254 staff or verification are not allowed.', initcap(replace(v_platform,'_',' '));
        end if;
      end loop;
      if v_platform = 'website' then
        foreach v_b in array v_blocked loop
          if position(v_b in lower(v_handle)) > 0 then
            raise exception 'Website: addresses that look like Nyumba254 staff or verification are not allowed.';
          end if;
        end loop;
      end if;
    end if;
    insert into public.lister_social_links(user_id, platform, handle, url, display_order, is_visible)
    values (v_owner, v_platform, v_handle, v_url, v_ord, v_vis)
    on conflict (user_id, platform) do update
      set handle = excluded.handle, url = excluded.url, display_order = excluded.display_order,
          is_visible = excluded.is_visible, updated_at = now();
    v_keep := v_keep || v_platform;
    v_ord := v_ord + 1;
  end loop;

  delete from public.lister_social_links where user_id = v_owner and not (platform = any (v_keep));

  perform public.nk_log_activity(v_owner, v_uid, 'lister_page', 'social_links_updated', 'lister_social_links', v_owner::text,
    'Updated social links (' || coalesce(array_length(v_keep, 1), 0) || ' saved)', jsonb_build_object('platforms', to_jsonb(v_keep)));

  return public.get_my_social_links();
end;
$function$;

commit;
