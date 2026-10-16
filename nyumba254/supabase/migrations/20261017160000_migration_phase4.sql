begin;

create schema if not exists migration_rollback;
revoke all on schema migration_rollback from public, anon, authenticated;

create table if not exists migration_rollback.function_definitions (
  migration_id text not null,
  function_signature text not null,
  definition text not null,
  primary key (migration_id, function_signature)
);
revoke all on migration_rollback.function_definitions from public, anon, authenticated;

create table if not exists migration_rollback.platform_settings (
  migration_id text not null,
  setting_key text not null,
  previous_value jsonb,
  existed boolean not null,
  primary key (migration_id, setting_key)
);
revoke all on migration_rollback.platform_settings from public, anon, authenticated;

do $$
declare
  v_definition text;
begin
  if to_regprocedure('public.enforce_listing_limit()') is not null then
    select pg_get_functiondef(to_regprocedure('public.enforce_listing_limit()'))
      into v_definition;
    insert into migration_rollback.function_definitions(migration_id, function_signature, definition)
    values ('20261017160000', 'public.enforce_listing_limit()', v_definition)
    on conflict (migration_id, function_signature) do nothing;
  end if;
end;
$$;

insert into migration_rollback.platform_settings(migration_id, setting_key, previous_value, existed)
select '20261017160000', s.key, s.value, true
from public.platform_settings s
where s.key in (
  'new_plans_enabled',
  'sale_pack_enabled',
  'agent_plans_enabled',
  'boost_enabled',
  'stk_billing_enabled',
  'currency_toggle_enabled',
  'title_check_enabled',
  'virtual_viewing_enabled',
  'lead_inbox_enabled'
)
on conflict (migration_id, setting_key) do nothing;

insert into migration_rollback.platform_settings(migration_id, setting_key, previous_value, existed)
select '20261017160000', k.key, null, false
from unnest(array[
  'new_plans_enabled',
  'sale_pack_enabled',
  'agent_plans_enabled',
  'boost_enabled',
  'stk_billing_enabled',
  'currency_toggle_enabled',
  'title_check_enabled',
  'virtual_viewing_enabled',
  'lead_inbox_enabled'
]) as k(key)
where not exists (
  select 1
  from migration_rollback.platform_settings b
  where b.migration_id = '20261017160000'
    and b.setting_key = k.key
)
on conflict (migration_id, setting_key) do nothing;

insert into public.platform_settings(key, value)
values
  ('new_plans_enabled', 'false'::jsonb),
  ('sale_pack_enabled', 'false'::jsonb),
  ('agent_plans_enabled', 'false'::jsonb),
  ('boost_enabled', 'false'::jsonb),
  ('stk_billing_enabled', 'false'::jsonb),
  ('currency_toggle_enabled', 'false'::jsonb),
  ('title_check_enabled', 'false'::jsonb),
  ('virtual_viewing_enabled', 'false'::jsonb),
  ('lead_inbox_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create table if not exists public.risk_signals (
  id uuid primary key default gen_random_uuid(),
  subject_type text not null check (subject_type in ('profile', 'listing', 'payment')),
  subject_id text not null,
  signal_code text not null,
  severity text not null check (severity in ('low', 'medium', 'high', 'critical')),
  source text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'confirmed')),
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);

create index if not exists risk_signals_status_created_at_idx
  on public.risk_signals(status, created_at desc);

alter table public.risk_signals enable row level security;
revoke all on public.risk_signals from public, anon, authenticated;
grant select on public.risk_signals to authenticated;
grant all on public.risk_signals to service_role;
drop policy if exists risk_signals_admin_read on public.risk_signals;
create policy risk_signals_admin_read
  on public.risk_signals
  for select
  to authenticated
  using (public.is_admin());

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
    select count(*) into v_count
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

create or replace function public.enforce_listing_video_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_seller_id uuid;
  v_subscription_tier text;
  v_subscription_expires_at timestamptz;
  v_video_blocked boolean;
  v_is_disabled boolean;
  v_limit integer;
  v_count integer;
begin
  if tg_op = 'UPDATE' and new.listing_id is not distinct from old.listing_id then
    return new;
  end if;

  if new.listing_id is null then
    raise exception 'VIDEO_LISTING_REQUIRED';
  end if;

  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'VIDEO_AUTH_REQUIRED';
  end if;

  select l.seller_id
    into v_seller_id
  from public.listings l
  where l.id = new.listing_id;
  if not found or v_seller_id is null then
    raise exception 'VIDEO_LISTING_NOT_FOUND';
  end if;

  if auth.uid() is not null and not public.is_admin()
     and v_seller_id is distinct from public.effective_seller_id() then
    raise exception 'VIDEO_LISTING_ACCESS_DENIED';
  end if;

  if auth.uid() is not null and public.is_admin() then
    return new;
  end if;

  select p.subscription_tier,
         p.subscription_expires_at,
         p.video_walkthrough_blocked,
         p.is_disabled
    into v_subscription_tier,
         v_subscription_expires_at,
         v_video_blocked,
         v_is_disabled
  from public.profiles p
  where p.id = v_seller_id
  for update;
  if not found or v_is_disabled then
    raise exception 'VIDEO_ACCOUNT_UNAVAILABLE';
  end if;
  if v_video_blocked then
    raise exception 'VIDEO_WALKTHROUGH_BLOCKED';
  end if;

  v_limit := case
    when v_subscription_tier = 'yearly'
      and (v_subscription_expires_at is null or v_subscription_expires_at > now())
      then 5
    else 1
  end;

  select count(*) into v_count
  from public.listing_videos v
  where v.listing_id = new.listing_id
    and v.id is distinct from new.id;
  if v_count >= v_limit then
    raise exception 'VIDEO_LIMIT_REACHED';
  end if;
  return new;
end;
$function$;

revoke all on function public.enforce_listing_video_limit() from public, anon, authenticated;
drop trigger if exists enforce_listing_video_limit on public.listing_videos;
create trigger enforce_listing_video_limit
  before insert or update of listing_id on public.listing_videos
  for each row execute function public.enforce_listing_video_limit();

comment on table public.risk_signals is
  'Restricted, append-oriented signal store for future risk review. New feature flags remain off until their workflows are implemented and validated.';

commit;
