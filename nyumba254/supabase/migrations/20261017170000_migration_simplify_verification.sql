begin;

create schema if not exists migration_rollback;
revoke all on schema migration_rollback from public, anon, authenticated;
create table if not exists migration_rollback.verified_role_backup_20261016 (
  profile_id uuid primary key,
  verified_role text,
  captured_at timestamptz not null default now()
);
revoke all on migration_rollback.verified_role_backup_20261016 from public, anon, authenticated;
insert into migration_rollback.verified_role_backup_20261016 (profile_id, verified_role)
select id, verified_role
from public.profiles
on conflict (profile_id) do nothing;

create table if not exists migration_rollback.function_definitions (
  migration_id text not null,
  function_signature text not null,
  definition text not null,
  primary key (migration_id, function_signature)
);
revoke all on migration_rollback.function_definitions from public, anon, authenticated;
create table if not exists migration_rollback.migration_markers (
  migration_id text primary key,
  applied_at timestamptz not null default now()
);
revoke all on migration_rollback.migration_markers from public, anon, authenticated;
create table if not exists migration_rollback.role_verification_status_backup (
  submission_id uuid primary key,
  status text not null,
  admin_note text,
  reviewed_at timestamptz,
  reviewed_by uuid
);
revoke all on migration_rollback.role_verification_status_backup from public, anon, authenticated;
do $$
declare
  v_signature text;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.protect_account_type_fields()',
    'public.set_account_type(text)',
    'public.enforce_listing_limit()'
  ] loop
    select pg_get_functiondef(to_regprocedure(v_signature))
      into v_definition
      where to_regprocedure(v_signature) is not null;
    if v_definition is not null then
      insert into migration_rollback.function_definitions(migration_id,function_signature,definition)
      values ('20261017170000',v_signature,v_definition)
      on conflict (migration_id,function_signature) do nothing;
    end if;
    v_definition := null;
  end loop;
end;
$$;

insert into migration_rollback.platform_settings(migration_id, setting_key, previous_value, existed)
select '20261017170000', s.key, s.value, true
from public.platform_settings s
where s.key in (
  'viewing_fee_requires_identity',
  'allowance_over_10_requires_identity',
  'boost_requires_identity',
  'owner_listing_risk_threshold'
)
on conflict (migration_id, setting_key) do nothing;
insert into migration_rollback.platform_settings(migration_id, setting_key, previous_value, existed)
select '20261017170000', k.key, null, false
from unnest(array[
  'viewing_fee_requires_identity',
  'allowance_over_10_requires_identity',
  'boost_requires_identity',
  'owner_listing_risk_threshold'
]) as k(key)
where not exists (
  select 1 from migration_rollback.platform_settings b
  where b.migration_id = '20261017170000' and b.setting_key = k.key
)
on conflict (migration_id, setting_key) do nothing;

alter table public.profiles
  add column if not exists role_badge_revoked boolean not null default false;
alter table public.role_history
  add column if not exists changed_by uuid references public.profiles(id) on delete set null,
  add column if not exists changed_by_name text;

create or replace function public.capture_role_history_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.changed_by is null then
    new.changed_by := auth.uid();
  end if;
  if new.changed_by_name is null and new.changed_by is not null then
    select p.full_name into new.changed_by_name
    from public.profiles p
    where p.id = new.changed_by;
  end if;
  return new;
end;
$function$;
drop trigger if exists capture_role_history_actor on public.role_history;
create trigger capture_role_history_actor
  before insert on public.role_history
  for each row execute function public.capture_role_history_actor();

create or replace function public.protect_account_type_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.account_type is not null
       or new.account_type_set_at is not null
       or new.onboarding_completed
       or new.verified_role is not null
       or new.account_type_first_set_at is not null
       or new.account_type_correction_used
       or new.account_type_cooldown_until is not null then
      raise exception 'Account setup must use the account setup flow';
    end if;
    return new;
  end if;

  if (new.account_type is distinct from old.account_type
      or new.account_type_set_at is distinct from old.account_type_set_at
      or new.onboarding_completed is distinct from old.onboarding_completed
      or new.account_type_first_set_at is distinct from old.account_type_first_set_at
      or new.account_type_correction_used is distinct from old.account_type_correction_used
      or new.account_type_cooldown_until is distinct from old.account_type_cooldown_until)
     and coalesce(current_setting('nyumba254.account_type_rpc', true), '') <> '1' then
    raise exception 'Account type changes must use the account setup flow';
  end if;

  if new.verified_role is distinct from old.verified_role
     and coalesce(current_setting('nyumba254.role_verification_rpc', true), '') <> '1'
     and coalesce(current_setting('nyumba254.account_type_rpc', true), '') <> '1' then
    raise exception 'Role status is derived from identity verification and the selected role';
  end if;
  return new;
end;
$function$;

create or replace function public.protect_role_badge_revocation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is not null
     and not public.is_admin()
     and new.role_badge_revoked is distinct from old.role_badge_revoked
     and coalesce(current_setting('nyumba254.role_badge_admin_rpc', true), '') <> '1' then
    raise exception 'Only an administrator can change role-badge visibility';
  end if;
  return new;
end;
$function$;
drop trigger if exists protect_role_badge_revocation on public.profiles;
create trigger protect_role_badge_revocation
  before update of role_badge_revoked on public.profiles
  for each row execute function public.protect_role_badge_revocation();

create or replace function public.sync_verified_role_from_identity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.verified_role := case
    when new.verification_status = 'verified'
      and new.account_type is not null
      and new.role_badge_revoked is not true
      then new.account_type
    else null
  end;
  return new;
end;
$function$;
drop trigger if exists sync_verified_role_from_identity on public.profiles;
create trigger sync_verified_role_from_identity
  before insert or update of account_type, verification_status, role_badge_revoked, verified_role
  on public.profiles
  for each row execute function public.sync_verified_role_from_identity();
update public.profiles
set verification_status = verification_status
where verified_role is distinct from case
  when verification_status = 'verified'
    and account_type is not null
    and role_badge_revoked is not true
    then account_type
  else null
end;

create or replace function public.requires_identity(p_feature text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_key text;
  v_value text;
begin
  v_key := case p_feature
    when 'general' then 'enforce_verification_general'
    when 'viewing_fee' then 'viewing_fee_requires_identity'
    when 'allowance_over_10' then 'allowance_over_10_requires_identity'
    when 'boost' then 'boost_requires_identity'
    else null
  end;
  if v_key is null then
    raise exception 'Unknown identity-gated feature';
  end if;
  select s.value #>> '{}' into v_value
  from public.platform_settings s
  where s.key = v_key;
  return coalesce(v_value::boolean, false);
end;
$function$;
revoke all on function public.requires_identity(text) from public, anon;
grant execute on function public.requires_identity(text) to authenticated;

insert into public.platform_settings (key, value)
values
  ('allowance_over_10_requires_identity', 'false'::jsonb),
  ('boost_requires_identity', 'false'::jsonb),
  ('owner_listing_risk_threshold', '5'::jsonb)
on conflict (key) do nothing;
do $$
begin
  if not exists (
    select 1 from migration_rollback.migration_markers
    where migration_id = '20261017170000'
  ) then
    insert into public.platform_settings (key, value)
    values ('viewing_fee_requires_identity', 'false'::jsonb)
    on conflict (key) do update
      set value = excluded.value, updated_at = now();
    insert into migration_rollback.migration_markers (migration_id)
    values ('20261017170000');
  end if;
end;
$$;

create or replace function public.enforce_listing_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_status text;
  v_disabled boolean;
  v_count integer;
  v_limit_text text;
  v_limit integer;
begin
  if new.status is distinct from 'active' or new.recycle_bin is true then
    return new;
  end if;

  select p.verification_status, p.is_disabled
    into v_status, v_disabled
  from public.profiles p
  where p.id = new.seller_id
  for update;
  if not found or v_disabled then
    raise exception 'LISTING_ACCOUNT_UNAVAILABLE';
  end if;

  if coalesce(v_status, 'unverified') <> 'verified' then
    select s.value #>> '{}'
      into v_limit_text
    from public.platform_settings s
    where s.key = 'unverified_listing_limit';
    if not found or v_limit_text !~ '^[0-9]+$' then
      raise exception 'LISTING_LIMIT_CONFIGURATION_INVALID';
    end if;
    v_limit := v_limit_text::integer;
    if public.requires_identity('allowance_over_10') and v_limit > 10 then
      v_limit := 10;
    end if;

    select count(*)::integer into v_count
    from public.listings l
    where l.seller_id = new.seller_id
      and l.status = 'active'
      and l.recycle_bin is not true
      and l.id is distinct from new.id;
    if v_count >= v_limit then
      raise exception 'LISTING_LIMIT_REACHED';
    end if;
  end if;
  return new;
end;
$function$;

create or replace function public.admin_set_role_badge_revoked(
  p_profile_id uuid,
  p_revoked boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_profile_id is null or p_revoked is null then
    raise exception 'Choose an account and badge action';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Enter a reason of at least 5 characters';
  end if;
  select full_name into v_name
  from public.profiles
  where id = p_profile_id and account_type is not null
  for update;
  if not found then
    raise exception 'Account with a selected role not found';
  end if;

  perform set_config('nyumba254.role_badge_admin_rpc', '1', true);
  update public.profiles
  set role_badge_revoked = p_revoked
  where id = p_profile_id;

  insert into public.admin_logs (admin_id, admin_name, action, target_type, target_id, details)
  select auth.uid(), coalesce(a.full_name, 'Admin'),
         case when p_revoked then 'revoke_role_badge' else 'restore_role_badge' end,
         'profile', p_profile_id::text, btrim(p_reason)
  from public.profiles a
  where a.id = auth.uid();

  insert into public.notifications (seller_id, type, title, description, link)
  values (
    p_profile_id,
    'profile',
    case when p_revoked then 'Role badge paused' else 'Role badge restored' end,
    case when p_revoked
      then 'An administrator paused the public role badge on your account. Your identity verification status has not changed.'
      else 'An administrator restored the public role badge for your selected account role.'
    end,
    '/dashboard.html#settings'
  );
end;
$function$;
revoke all on function public.admin_set_role_badge_revoked(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_role_badge_revoked(uuid, boolean, text) to authenticated;

create or replace function public.flag_owner_listing_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_owner_id uuid;
  v_role text;
  v_threshold integer;
  v_count integer;
begin
  if new.status is distinct from 'active'
     or new.recycle_bin is true
     or new.seller_id is null then
    return new;
  end if;
  v_owner_id := new.seller_id;

  select p.account_type into v_role
  from public.profiles p
  where p.id = v_owner_id;
  if v_role is distinct from 'owner' then
    return new;
  end if;
  select coalesce((s.value #>> '{}')::integer, 5) into v_threshold
  from public.platform_settings s
  where s.key = 'owner_listing_risk_threshold';
  v_threshold := coalesce(v_threshold, 5);
  if v_threshold < 1 then
    raise exception 'Owner listing risk threshold must be a positive integer';
  end if;
  select count(*)::integer into v_count
  from public.listings l
  where l.seller_id = v_owner_id
    and l.status = 'active'
    and l.recycle_bin is not true
    and l.is_disabled is not true;
  if v_count >= v_threshold then
    insert into public.risk_signals (
      subject_type, subject_id, signal_code, severity, source, details, dedupe_key
    )
    values (
      'profile',
      v_owner_id::text,
      'owner_listing_count_threshold',
      'low',
      'listing_count_trigger',
      jsonb_build_object('active_listing_count', v_count, 'threshold', v_threshold),
      'owner_listing_count:' || v_owner_id::text || ':' || v_threshold::text
    )
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end;
$function$;
drop trigger if exists flag_owner_listing_count on public.listings;
create trigger flag_owner_listing_count
  after insert or update of status, seller_id, recycle_bin, is_disabled
  on public.listings
  for each row execute function public.flag_owner_listing_count();
insert into public.risk_signals (
  subject_type, subject_id, signal_code, severity, source, details, dedupe_key
)
select
  'profile',
  p.id::text,
  'owner_listing_count_threshold',
  'low',
  'migration_backfill',
  jsonb_build_object('active_listing_count', counts.active_count, 'threshold', coalesce((s.value #>> '{}')::integer, 5)),
  'owner_listing_count:' || p.id::text || ':' || coalesce((s.value #>> '{}')::integer, 5)::text
from public.profiles p
cross join lateral (
  select count(*)::integer as active_count
  from public.listings l
  where l.seller_id = p.id
    and l.status = 'active'
    and l.recycle_bin is not true
    and l.is_disabled is not true
) counts
left join public.platform_settings s on s.key = 'owner_listing_risk_threshold'
where p.account_type = 'owner'
  and counts.active_count >= coalesce((s.value #>> '{}')::integer, 5)
on conflict (dedupe_key) do nothing;

insert into migration_rollback.role_verification_status_backup (
  submission_id, status, admin_note, reviewed_at, reviewed_by
)
select id, status, admin_note, reviewed_at, reviewed_by
from public.role_verification_submissions
where status = 'pending'
on conflict (submission_id) do nothing;
update public.role_verification_submissions
set status = 'rejected',
    admin_note = 'This separate role-evidence workflow has been retired. Identity verification is reviewed in KYC; account roles remain self-declared.',
    reviewed_at = now(),
    reviewed_by = null
where status = 'pending';

do $$
declare
  v_function record;
begin
  for v_function in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'submit_role_verification',
        'admin_review_role_verification',
        'admin_approve_account_role'
      )
  loop
    execute format(
      'revoke all on function %s from public, anon, authenticated',
      v_function.signature
    );
  end loop;
end;
$$;

commit;

-- Rollback (run manually only if this migration must be reverted):
-- begin;
-- drop trigger if exists flag_owner_listing_count on public.listings;
-- drop function if exists public.flag_owner_listing_count();
-- drop trigger if exists sync_verified_role_from_identity on public.profiles;
-- drop function if exists public.sync_verified_role_from_identity();
-- drop trigger if exists protect_role_badge_revocation on public.profiles;
-- drop function if exists public.protect_role_badge_revocation();
-- drop function if exists capture_role_history_actor on public.role_history;
-- drop function if exists public.capture_role_history_actor();
-- drop function if exists public.admin_set_role_badge_revoked(uuid, boolean, text);
-- drop function if exists public.requires_identity(text);
-- do $$
-- declare v_definition text;
-- begin
--   for v_definition in
--     select definition from migration_rollback.function_definitions
--     where migration_id = '20261017170000'
--   loop
--     execute v_definition;
--   end loop;
-- end;
-- $$;
-- update public.profiles p
-- set verified_role = b.verified_role
-- from migration_rollback.verified_role_backup_20261016 b
-- where b.profile_id = p.id;
-- update public.role_verification_submissions s
-- set status = b.status, admin_note = b.admin_note, reviewed_at = b.reviewed_at, reviewed_by = b.reviewed_by
-- from migration_rollback.role_verification_status_backup b
-- where b.submission_id = s.id;
-- delete from public.risk_signals
-- where signal_code = 'owner_listing_count_threshold'
--   and source in ('listing_count_trigger', 'migration_backfill');
-- alter table public.role_history drop column if exists changed_by_name, drop column if exists changed_by;
-- alter table public.profiles drop column if exists role_badge_revoked;
-- update public.platform_settings s set value = b.previous_value
-- from migration_rollback.platform_settings b
-- where b.migration_id = '20261017170000' and b.setting_key = s.key and b.existed;
-- delete from public.platform_settings s using migration_rollback.platform_settings b
-- where b.migration_id = '20261017170000' and b.setting_key = s.key and not b.existed;
-- delete from migration_rollback.migration_markers where migration_id = '20261017170000';
-- commit;
