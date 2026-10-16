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
  v_signature text;
  v_definition text;
begin
  foreach v_signature in array array[
    'public.protect_viewing_fee_fields()',
    'public.protect_account_type_fields()',
    'public.set_account_type(text)',
    'public.set_listing_viewing_fees(uuid[],integer)',
    'public.get_public_viewing_fees(uuid[])',
    'public.snapshot_viewing_request_fee()'
  ] loop
    select pg_get_functiondef(to_regprocedure(v_signature))
      into v_definition
      where to_regprocedure(v_signature) is not null;
    if v_definition is not null then
      insert into migration_rollback.function_definitions(migration_id,function_signature,definition)
      values ('20261017130000',v_signature,v_definition)
      on conflict (migration_id,function_signature) do nothing;
    end if;
    v_definition := null;
  end loop;
end;
$$;

insert into migration_rollback.platform_settings(migration_id, setting_key, previous_value, existed)
select '20261017130000', s.key, s.value, true
from public.platform_settings s
where s.key in ('viewing_fee_max', 'viewing_fee_requires_identity', 'viewing_fee_policy_version')
on conflict (migration_id, setting_key) do nothing;
insert into migration_rollback.platform_settings(migration_id, setting_key, previous_value, existed)
select '20261017130000', k.key, null, false
from unnest(array['viewing_fee_max', 'viewing_fee_requires_identity', 'viewing_fee_policy_version']) as k(key)
where not exists (
  select 1 from migration_rollback.platform_settings b
  where b.migration_id = '20261017130000' and b.setting_key = k.key
)
on conflict (migration_id, setting_key) do nothing;

alter table public.profiles
  add column if not exists account_type_first_set_at timestamptz,
  add column if not exists account_type_correction_used boolean not null default false,
  add column if not exists account_type_cooldown_until timestamptz,
  add column if not exists viewing_fee_policy_version text,
  add column if not exists viewing_fee_policy_accepted_at timestamptz,
  add column if not exists viewing_fee_blocked boolean not null default false,
  add column if not exists viewing_fee_block_reason text;

alter table public.viewing_requests
  add column if not exists fee_at_request integer;

update public.profiles
set account_type_first_set_at = coalesce(account_type_set_at, created_at),
    account_type_correction_used = true,
    account_type_cooldown_until = case
      when account_type_set_at > now() - interval '7 days'
        then account_type_set_at + interval '7 days'
      else null
    end
where account_type is not null
  and account_type_first_set_at is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'viewing_requests_fee_at_request_range'
      and conrelid = 'public.viewing_requests'::regclass
  ) then
    alter table public.viewing_requests
      add constraint viewing_requests_fee_at_request_range
      check (fee_at_request is null or fee_at_request between 0 and 5000);
  end if;
end;
$$;

insert into public.platform_settings (key, value)
values
  ('viewing_fee_max', '5000'::jsonb),
  ('viewing_fee_requires_identity', '1'::jsonb),
  ('viewing_fee_policy_version', '"v1"'::jsonb)
on conflict (key) do nothing;

create table if not exists public.viewing_fee_feedback (
  id bigint generated always as identity primary key,
  viewing_request_id uuid not null references public.viewing_requests(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  was_as_listed boolean not null,
  details text,
  created_at timestamptz not null default now(),
  unique (viewing_request_id)
);
alter table public.viewing_fee_feedback enable row level security;
revoke all on public.viewing_fee_feedback from public, anon, authenticated;

alter table public.reports
  add column if not exists fee_report_valid boolean not null default false;

create or replace function public.protect_viewing_fee_report_validity()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.fee_report_valid := false;
  elsif new.fee_report_valid is distinct from old.fee_report_valid then
    raise exception 'Only an administrator can validate a viewing fee report';
  end if;
  return new;
end;
$function$;

drop trigger if exists protect_viewing_fee_report_validity on public.reports;
create trigger protect_viewing_fee_report_validity
  before insert or update on public.reports
  for each row execute function public.protect_viewing_fee_report_validity();

create or replace function public.apply_viewing_fee_report_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_seller_id uuid;
  v_prior_valid_reports integer;
  v_already_blocked boolean;
  v_admin_name text;
begin
  if auth.uid() is not null and not public.is_admin() then
    return new;
  end if;
  if new.status <> 'resolved'
     or new.reason not in (
       'viewing_fee_dispute',
       'viewing_fee_free_listing',
       'viewing_fee_not_refunded',
       'viewing_fee_advance_payment'
     )
     or new.fee_report_valid is not true
     or (
       old.status = 'resolved'
       and old.fee_report_valid is true
     ) then
    return new;
  end if;

  if new.target_type = 'seller' then
    v_seller_id := new.target_id;
  elsif new.target_type = 'listing' then
    select l.seller_id into v_seller_id
    from public.listings l where l.id = new.target_id;
  end if;
  if v_seller_id is null then
    raise exception 'A valid viewing fee report must identify a lister';
  end if;

  select count(*)::integer into v_prior_valid_reports
  from public.reports r
  where r.id <> new.id
    and r.reason in (
      'viewing_fee_dispute',
      'viewing_fee_free_listing',
      'viewing_fee_not_refunded',
      'viewing_fee_advance_payment'
    )
    and r.status = 'resolved'
    and r.fee_report_valid is true
    and r.created_at >= now() - interval '90 days'
    and (
      (r.target_type = 'seller' and r.target_id = v_seller_id)
      or (
        r.target_type = 'listing'
        and exists (
          select 1 from public.listings l
          where l.id = r.target_id and l.seller_id = v_seller_id
        )
      )
    );

  if v_prior_valid_reports < 1 then
    return new;
  end if;

  select viewing_fee_blocked into v_already_blocked
  from public.profiles where id = v_seller_id for update;
  if not found then
    raise exception 'Lister profile not found';
  end if;
  if v_already_blocked then
    return new;
  end if;

  select full_name into v_admin_name from public.profiles where id = auth.uid();
  perform set_config('nyumba254.viewing_fee_admin_rpc', '1', true);
  update public.profiles
  set viewing_fee_blocked = true,
      viewing_fee_block_reason = 'Two valid viewing fee reports within 90 days'
  where id = v_seller_id;

  insert into public.admin_logs (admin_id, admin_name, action, target_type, target_id, details)
  values (auth.uid(), coalesce(v_admin_name, 'Admin'),
    'freeze_viewing_fee_privilege', 'profile', v_seller_id::text,
    'Automatic freeze after two valid viewing fee reports within 90 days');

  insert into public.notifications (seller_id, type, title, description, link)
  values (v_seller_id, 'viewing_fee_policy', 'Viewing fee privilege paused',
    'Your viewing-fee privilege was paused after two valid reports within 90 days. Contact support if you believe this is incorrect.',
    '/dashboard?view=settings');
  return new;
end;
$function$;

drop trigger if exists apply_viewing_fee_report_escalation on public.reports;
create trigger apply_viewing_fee_report_escalation
  after update of status, fee_report_valid on public.reports
  for each row execute function public.apply_viewing_fee_report_escalation();

create or replace function public.get_seller_viewing_requests()
returns table (
  request_id uuid,
  listing_id uuid,
  listing_title text,
  buyer_name text,
  buyer_phone text,
  requested_date date,
  requested_time text,
  notes text,
  request_status text,
  created_at timestamptz,
  fee_at_request integer,
  fee_acknowledged boolean
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  return query
  select vr.id, vr.listing_id, l.title, vr.buyer_name, vr.buyer_phone,
         vr.requested_date, vr.requested_time, vr.notes, vr.status, vr.created_at,
         coalesce(vr.fee_at_request, vr.viewing_fee_snapshot),
         vr.viewing_fee_acknowledged
  from public.viewing_requests vr
  join public.listings l on l.id = vr.listing_id
  where l.seller_id = public.effective_seller_id()
  order by vr.created_at desc
  limit 100;
end;
$function$;
revoke all on function public.get_seller_viewing_requests() from public, anon;
grant execute on function public.get_seller_viewing_requests() to authenticated;

create or replace function public.update_viewing_request_status(
  p_request_id uuid,
  p_status text
)
returns table (
  buyer_name text,
  buyer_email text,
  listing_title text,
  request_status text,
  requested_date date,
  requested_time text,
  fee_at_request integer
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_listing_id uuid;
  v_seller_id uuid;
  v_title text;
  v_old_status text;
  v_buyer_token text;
  v_buyer_name text;
  v_buyer_email text;
  v_requested_date date;
  v_requested_time text;
  v_fee integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if p_request_id is null or p_status not in ('confirmed', 'done', 'cancelled') then
    raise exception 'Choose a valid viewing request status';
  end if;

  select vr.listing_id, l.seller_id, l.title, vr.status, vr.buyer_token,
         vr.buyer_name, vr.requested_date, vr.requested_time,
         coalesce(vr.fee_at_request, vr.viewing_fee_snapshot)
    into v_listing_id, v_seller_id, v_title, v_old_status, v_buyer_token,
         v_buyer_name, v_requested_date, v_requested_time, v_fee
  from public.viewing_requests vr
  join public.listings l on l.id = vr.listing_id
  where vr.id = p_request_id
  for update of vr;
  if not found then
    raise exception 'Viewing request not found';
  end if;
  if v_seller_id is distinct from public.effective_seller_id() then
    raise exception 'You can only update requests for your own listings';
  end if;
  if not (
    (v_old_status = 'pending' and p_status in ('confirmed', 'cancelled'))
    or (v_old_status = 'confirmed' and p_status in ('done', 'cancelled'))
  ) then
    raise exception 'This viewing request can no longer be changed';
  end if;

  update public.viewing_requests
  set status = p_status
  where id = p_request_id;

  select bc.email into v_buyer_email
  from public.buyer_contacts bc
  where bc.buyer_token = v_buyer_token
    and bc.notify_email is true
  limit 1;

  return query
  select v_buyer_name, v_buyer_email, v_title, p_status,
         v_requested_date, v_requested_time, v_fee;
end;
$function$;
revoke all on function public.update_viewing_request_status(uuid, text) from public, anon;
grant execute on function public.update_viewing_request_status(uuid, text) to authenticated;

create or replace function public.current_viewing_fee_policy_version()
returns text
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(
    (select trim(both '"' from value::text)
     from public.platform_settings
     where key = 'viewing_fee_policy_version'),
    'v1'
  );
$function$;
revoke all on function public.current_viewing_fee_policy_version() from public, anon;
grant execute on function public.current_viewing_fee_policy_version() to authenticated;

create or replace function public.viewing_fee_lister_can_charge(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1
    from public.profiles p
    where p.id = p_profile_id
      and p.account_type in ('agent', 'company')
      and p.viewing_fee_blocked is not true
      and p.is_disabled is not true
      and p.viewing_fee_policy_version = public.current_viewing_fee_policy_version()
      and p.viewing_fee_policy_accepted_at is not null
      and (
        not coalesce((
          select (s.value #>> '{}')::boolean
          from public.platform_settings s
          where s.key = 'viewing_fee_requires_identity'
        ), true)
        or p.verification_status = 'verified'
      )
  );
$function$;
revoke all on function public.viewing_fee_lister_can_charge(uuid) from public, anon, authenticated;

create or replace function public.accept_viewing_fee_policy(p_policy_version text)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_lister_id uuid := public.effective_seller_id();
  v_current_version text := public.current_viewing_fee_policy_version();
  v_accepted_at timestamptz := now();
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if v_lister_id is null then
    raise exception 'A lister account is required to accept the viewing fee policy';
  end if;
  if p_policy_version is distinct from v_current_version then
    raise exception 'The viewing fee policy has changed. Review and accept the current version.';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = v_lister_id
      and p.account_type in ('agent', 'company')
      and p.is_disabled is not true
  ) then
    raise exception 'Only Agent and Company accounts can accept the viewing fee policy';
  end if;

  perform set_config('nyumba254.viewing_fee_policy_rpc', '1', true);
  update public.profiles
  set viewing_fee_policy_version = v_current_version,
      viewing_fee_policy_accepted_at = v_accepted_at
  where id = v_lister_id;
  return v_accepted_at;
end;
$function$;
revoke all on function public.accept_viewing_fee_policy(text) from public, anon;
grant execute on function public.accept_viewing_fee_policy(text) to authenticated;

create or replace function public.protect_viewing_fee_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_id_verified boolean;
  v_requires_identity boolean;
  v_policy_version text;
  v_max integer;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;

  if tg_table_name = 'listing_viewing_fees' then
    if new.listing_id is distinct from old.listing_id then
      raise exception 'A listing viewing fee cannot be moved to another listing';
    end if;
    return new;
  end if;

  if new.viewing_fee_policy_version is distinct from old.viewing_fee_policy_version
     or new.viewing_fee_policy_accepted_at is distinct from old.viewing_fee_policy_accepted_at then
    if coalesce(current_setting('nyumba254.viewing_fee_policy_rpc', true), '') <> '1' then
      raise exception 'Accept the viewing fee policy through the policy acceptance flow';
    end if;
  end if;

  if new.viewing_fee_blocked is distinct from old.viewing_fee_blocked
     or new.viewing_fee_block_reason is distinct from old.viewing_fee_block_reason then
    raise exception 'Viewing fee restrictions can only be changed by an administrator';
  end if;

  if new.default_viewing_fee is not null and new.default_viewing_fee > 0 then
    select least(coalesce((s.value #>> '{}')::integer, 5000), 5000)
      into v_max
    from public.platform_settings s
    where s.key = 'viewing_fee_max';
    v_max := coalesce(v_max, 5000);
    if new.default_viewing_fee > v_max then
      raise exception 'Default viewing fee cannot exceed KES %', v_max;
    end if;
    select (p.verification_status = 'verified')
      into v_id_verified
    from public.profiles p where p.id = new.id;
    select coalesce((s.value #>> '{}')::boolean, true)
      into v_requires_identity
    from public.platform_settings s where s.key = 'viewing_fee_requires_identity';
    v_policy_version := public.current_viewing_fee_policy_version();
    if new.account_type is null or new.account_type not in ('agent', 'company') then
      raise exception 'Only Agent and Company accounts can set a viewing fee';
    end if;
    if new.viewing_fee_blocked is true then
      raise exception 'Your viewing fee privilege is currently paused';
    end if;
    if v_requires_identity and not coalesce(v_id_verified, false) then
      raise exception 'Verify your identity before setting a viewing fee';
    end if;
    if new.viewing_fee_policy_version is distinct from v_policy_version
       or new.viewing_fee_policy_accepted_at is null then
      raise exception 'Review and accept the current viewing fee policy first';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists protect_profile_default_viewing_fee on public.profiles;
create trigger protect_profile_default_viewing_fee
  before insert or update on public.profiles
  for each row execute function public.protect_viewing_fee_fields();

create or replace function public.protect_account_type_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
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
     and coalesce(current_setting('nyumba254.role_verification_rpc', true), '') <> '1' then
    raise exception 'Role verification can only be changed by an administrator';
  end if;

  return new;
end;
$function$;

create or replace function public.set_account_type(p_account_type text)
returns table (account_type text, onboarding_completed boolean, account_type_set_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current_type text;
  v_set_at timestamptz;
  v_first_set_at timestamptz;
  v_correction_used boolean;
  v_cooldown_until timestamptz;
  v_platform_role text;
  v_disabled boolean;
  v_correction boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_account_type is null
     or p_account_type not in ('buyer', 'owner', 'caretaker', 'agent', 'company') then
    raise exception 'Choose a supported account type';
  end if;

  select p.account_type, p.account_type_set_at, p.account_type_first_set_at,
         p.account_type_correction_used, p.account_type_cooldown_until, p.role, p.is_disabled
    into v_current_type, v_set_at, v_first_set_at, v_correction_used,
         v_cooldown_until, v_platform_role, v_disabled
  from public.profiles p
  where p.id = v_user_id
  for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  if v_disabled then
    raise exception 'Disabled accounts cannot change account type';
  end if;

  if v_current_type is distinct from p_account_type
     and v_platform_role is distinct from 'admin' then
    if v_cooldown_until is not null and v_cooldown_until > now() then
      raise exception 'Account type can be changed again after %',
        to_char(v_cooldown_until at time zone 'Africa/Nairobi', 'DD/MM/YYYY');
    end if;
    v_correction := v_first_set_at is not null
      and not coalesce(v_correction_used, false)
      and now() <= v_first_set_at + interval '24 hours'
      and v_cooldown_until is null;
  end if;

  if v_current_type is distinct from p_account_type then
    insert into public.role_history (profile_id, previous_account_type, new_account_type)
    values (v_user_id, v_current_type, p_account_type);
  end if;

  perform set_config('nyumba254.account_type_rpc', '1', true);
  update public.profiles p
  set account_type = p_account_type,
      account_type_first_set_at = coalesce(p.account_type_first_set_at, now()),
      account_type_correction_used = case
        when v_correction then true
        else p.account_type_correction_used
      end,
      account_type_cooldown_until = case
        when p.account_type is distinct from p_account_type
          and p.account_type_first_set_at is not null
          and not v_correction
          then now() + interval '7 days'
        when p.account_type is distinct from p_account_type
          and p.account_type_first_set_at is null
          then null
        when v_correction
          then now() + interval '7 days'
        else p.account_type_cooldown_until
      end,
      account_type_set_at = case
        when p.account_type is distinct from p_account_type then now()
        else coalesce(p.account_type_set_at, now())
      end,
      onboarding_completed = true,
      verified_role = case
        when p.verified_role = p_account_type then p.verified_role
        else null
      end
  where p.id = v_user_id;

  if v_current_type in ('agent', 'company')
     and p_account_type not in ('agent', 'company') then
    delete from public.listing_viewing_fees f
    using public.listings l
    where f.listing_id = l.id
      and l.seller_id = v_user_id;
  end if;

  return query
  select p.account_type, p.onboarding_completed, p.account_type_set_at
  from public.profiles p
  where p.id = v_user_id;
end;
$function$;

create or replace function public.change_account_type(p_account_type text)
returns table (account_type text, onboarding_completed boolean, account_type_set_at timestamptz)
language sql
security definer
set search_path = public
as $function$
  select * from public.set_account_type(p_account_type);
$function$;
revoke all on function public.set_account_type(text) from public, anon;
grant execute on function public.set_account_type(text) to authenticated;
revoke all on function public.change_account_type(text) from public, anon;
grant execute on function public.change_account_type(text) to authenticated;

create or replace function public.guard_listing_viewing_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_seller_id uuid;
  v_max integer;
  v_requires_identity boolean;
  v_changes integer;
begin
  if tg_op = 'UPDATE' and new.viewing_fee is not distinct from old.viewing_fee then
    new.updated_at := now();
    return new;
  end if;

  select l.seller_id into v_seller_id
  from public.listings l where l.id = new.listing_id;
  if not found then raise exception 'Listing not found'; end if;

  select coalesce((s.value #>> '{}')::integer, 5000) into v_max
  from public.platform_settings s where s.key = 'viewing_fee_max';
  v_max := coalesce(v_max, 5000);
  if new.viewing_fee < 0 or new.viewing_fee > v_max or new.viewing_fee > 5000 then
    raise exception 'Viewing fee must be between KES 0 and KES %', least(v_max, 5000);
  end if;

  if new.viewing_fee > 0 and not public.is_admin() then
    if not public.viewing_fee_lister_can_charge(public.effective_seller_id()) then
      select coalesce((s.value #>> '{}')::boolean, true)
        into v_requires_identity
      from public.platform_settings s where s.key = 'viewing_fee_requires_identity';
      if coalesce(v_requires_identity, true) then
        raise exception 'Verify your identity and accept the current viewing fee policy before charging a fee';
      end if;
      raise exception 'Choose Agent or Company and accept the current viewing fee policy before charging a fee';
    end if;
    if v_seller_id is distinct from public.effective_seller_id() then
      raise exception 'You can only update viewing fees for your own listings';
    end if;
  end if;

  if not public.is_admin() then
    select count(*)::integer into v_changes
    from public.viewing_fee_history h
    where h.object_type = 'listing'
      and h.object_id = new.listing_id
      and h.changed_at > now() - interval '24 hours';
    if v_changes >= 3 then
      raise exception 'Viewing fees can be changed at most 3 times per listing in 24 hours';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$function$;

drop trigger if exists guard_listing_viewing_fee on public.listing_viewing_fees;
create trigger guard_listing_viewing_fee
  before insert or update on public.listing_viewing_fees
  for each row execute function public.guard_listing_viewing_fee();

create or replace function public.set_listing_viewing_fees(p_listing_ids uuid[], p_viewing_fee integer)
returns integer
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_seller_id uuid := public.effective_seller_id();
  v_expected integer;
  v_found integer;
  v_max integer;
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  select coalesce((s.value #>> '{}')::integer, 5000) into v_max
  from public.platform_settings s where s.key = 'viewing_fee_max';
  v_max := least(coalesce(v_max, 5000), 5000);
  if p_viewing_fee is null or p_viewing_fee < 0 or p_viewing_fee > v_max then
    raise exception 'Viewing fee must be a whole number between KES 0 and KES %', v_max;
  end if;
  if coalesce(cardinality(p_listing_ids), 0) = 0 then return 0; end if;
  if p_viewing_fee > 0
     and not public.viewing_fee_lister_can_charge(v_seller_id)
     and not public.is_admin() then
    raise exception 'Verify your identity and accept the current viewing fee policy before charging a fee';
  end if;

  select count(distinct id)::integer into v_expected
  from unnest(p_listing_ids) as requested(id);
  if public.is_admin() then
    select count(*)::integer into v_found
    from public.listings l where l.id = any(p_listing_ids);
    if v_found <> v_expected then raise exception 'One or more listings could not be found'; end if;
    insert into public.listing_viewing_fees (listing_id, viewing_fee)
    select l.id, p_viewing_fee
    from public.listings l where l.id = any(p_listing_ids)
    on conflict (listing_id) do update
      set viewing_fee = excluded.viewing_fee, updated_at = now();
  else
    select count(*)::integer into v_found
    from public.listings l
    where l.id = any(p_listing_ids) and l.seller_id = v_seller_id;
    if v_found <> v_expected then raise exception 'You can only update your own listings'; end if;
    insert into public.listing_viewing_fees (listing_id, viewing_fee)
    select l.id, p_viewing_fee
    from public.listings l
    where l.id = any(p_listing_ids) and l.seller_id = v_seller_id
    on conflict (listing_id) do update
      set viewing_fee = excluded.viewing_fee, updated_at = now();
  end if;
  return v_found;
end;
$function$;

create or replace function public.get_public_viewing_fees(p_listing_ids uuid[])
returns table (listing_id uuid, viewing_fee integer)
language sql
stable
security definer
set search_path = public
as $function$
  select l.id,
         case when public.is_admin()
                   then coalesce(f.viewing_fee, 0)
              when public.viewing_fee_lister_can_charge(l.seller_id)
              then coalesce(f.viewing_fee, 0)
              else 0
         end::integer
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.listing_viewing_fees f on f.listing_id = l.id
  where l.id = any(coalesce(p_listing_ids, array[]::uuid[]))
    and (
      public.is_admin()
      or (
        l.status in ('active', 'occupied')
        and coalesce(l.is_disabled, false) = false
        and coalesce(l.recycle_bin, false) = false
        and p.is_disabled is not true
      )
    );
$function$;

create or replace function public.search_public_listing_ids(
  p_category text,
  p_frequency text,
  p_county text,
  p_areas text[],
  p_min_price numeric,
  p_max_price numeric,
  p_bedrooms text,
  p_furnished text,
  p_amenities text[],
  p_search text,
  p_include_occupied boolean,
  p_lister_filter text,
  p_viewing_fee_filter text,
  p_sort text,
  p_map_ids uuid[],
  p_offset integer,
  p_limit integer
)
returns table (listing_id uuid, total_count bigint)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if coalesce(p_lister_filter, '') not in ('', 'verified_owner', 'other_listers') then
    raise exception 'Unsupported lister filter';
  end if;
  if coalesce(p_viewing_fee_filter, '') not in ('', 'free', '500', '1000', '2000') then
    raise exception 'Unsupported viewing fee filter';
  end if;

  return query
  with candidates as (
    select l.id,
           l.price,
           l.created_at,
           l.is_featured,
           l.status,
           l.details,
           l.amenities,
           l.title,
           l.description,
           l.area,
           l.address,
           l.county,
           l.listed_by_type,
           p.account_type,
           p.verified_role,
           case when public.viewing_fee_lister_can_charge(l.seller_id)
                then coalesce(f.viewing_fee, 0)
                else 0
           end::integer as viewing_fee
    from public.listings l
    join public.profiles p on p.id = l.seller_id
    left join public.listing_viewing_fees f on f.listing_id = l.id
    where l.status = any(case when coalesce(p_include_occupied, false)
                              then array['active','occupied']::text[]
                              else array['active']::text[] end)
      and coalesce(l.is_disabled, false) = false
      and coalesce(l.recycle_bin, false) = false
      and p.is_disabled is not true
      and (nullif(p_category, '') is null or l.category = p_category)
      and (nullif(p_frequency, '') is null or l.price_frequency = p_frequency)
      and (nullif(p_county, '') is null or l.county = p_county)
      and (coalesce(cardinality(p_areas), 0) = 0 or l.area = any(p_areas))
      and (p_min_price is null or l.price >= p_min_price)
      and (p_max_price is null or l.price <= p_max_price)
      and (coalesce(p_bedrooms, '') = ''
        or (p_bedrooms = '4' and l.details->>'bedrooms' = any(
          array['4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20']
        ))
        or (p_bedrooms <> '4' and l.details->>'bedrooms' = p_bedrooms))
      and (coalesce(p_furnished, '') = ''
        or l.details->>'furnished' = case p_furnished when 'true' then 'yes' when 'false' then 'no' else p_furnished end)
      and (coalesce(cardinality(p_amenities), 0) = 0
        or to_jsonb(l.amenities) @> to_jsonb(p_amenities))
      and (coalesce(trim(p_search), '') = ''
        or not exists (
          select 1
          from unnest(regexp_split_to_array(lower(trim(p_search)), E'\\s+')) as words(word)
          where length(words.word) >= 2
            and concat_ws(' ', l.title, l.description, l.area, l.address, l.county)
              not ilike '%' || words.word || '%'
        ))
      and (coalesce(p_lister_filter, '') = ''
        or (p_lister_filter = 'verified_owner'
            and l.listed_by_type in ('owner','landlord')
            and p.account_type = 'owner'
            and p.verified_role = 'owner')
        or (p_lister_filter = 'other_listers'
            and l.listed_by_type in ('agent','caretaker','company')))
      and (coalesce(p_viewing_fee_filter, '') = ''
        or (p_viewing_fee_filter = 'free'
            and case when public.viewing_fee_lister_can_charge(l.seller_id)
                 then coalesce(f.viewing_fee,0) else 0 end = 0)
        or (p_viewing_fee_filter ~ '^[0-9]+$'
            and case when public.viewing_fee_lister_can_charge(l.seller_id)
                 then coalesce(f.viewing_fee,0) else 0 end <= p_viewing_fee_filter::integer))
      and (coalesce(cardinality(p_map_ids), 0) = 0 or l.id = any(p_map_ids))
  ),
  counted as (
    select candidates.*,
           count(*) over () as total_count,
           row_number() over (
             order by
               case when coalesce(p_include_occupied,false) then (candidates.status = 'occupied')::integer else 0 end asc,
               case when p_sort = 'price_asc' then candidates.price end asc nulls last,
               case when p_sort = 'price_desc' then candidates.price end desc nulls last,
               case when p_sort = 'fee_asc' then candidates.viewing_fee end asc nulls last,
               case when p_sort = 'featured' and candidates.is_featured is true then 1
                    when p_sort = 'featured' then 0 end desc nulls last,
               candidates.created_at desc,
               candidates.id asc
           ) as row_number
    from candidates
  ),
  page as (
    select counted.id, counted.total_count, counted.row_number
    from counted
    where counted.row_number > greatest(coalesce(p_offset,0),0)
      and counted.row_number <= greatest(coalesce(p_offset,0),0) + least(greatest(coalesce(p_limit,12),1),300)
  ),
  totals as (
    select count(*)::bigint as total_count from candidates
  )
  select page.id, totals.total_count
  from totals left join page on true
  order by page.row_number nulls last;
end;
$function$;
revoke all on function public.search_public_listing_ids(text, text, text, text[], numeric, numeric, text, text, text[], text, boolean, text, text, text, uuid[], integer, integer) from public;
grant execute on function public.search_public_listing_ids(text, text, text, text[], numeric, numeric, text, text, text[], text, boolean, text, text, text, uuid[], integer, integer) to anon, authenticated;

create or replace function public.snapshot_viewing_request_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_fee integer;
  v_repeat boolean := false;
begin
  if tg_op = 'UPDATE' then
    if new.listing_id is distinct from old.listing_id then
      raise exception 'A viewing request cannot be moved to another listing';
    end if;
    new.viewing_fee_snapshot := old.viewing_fee_snapshot;
    new.fee_at_request := old.fee_at_request;
    new.viewing_fee_acknowledged := old.viewing_fee_acknowledged;
    return new;
  end if;

  select case when public.viewing_fee_lister_can_charge(l.seller_id)
              then coalesce(f.viewing_fee, 0)
              else 0
         end
    into v_fee
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.listing_viewing_fees f on f.listing_id = l.id
  where l.id = new.listing_id
    and l.status = 'active'
    and coalesce(l.is_disabled, false) = false
    and coalesce(l.recycle_bin, false) = false
    and p.is_disabled is not true;
  if not found then
    raise exception 'This listing is not available for viewing requests';
  end if;

  if nullif(new.buyer_token, '') is not null then
    select exists (
      select 1 from public.viewing_requests vr
      where vr.listing_id = new.listing_id
        and vr.buyer_token = new.buyer_token
        and vr.created_at >= now() - interval '14 days'
    ) into v_repeat;
  end if;
  if v_repeat then v_fee := 0; end if;
  if new.fee_at_request is not null
     and new.viewing_fee_acknowledged is true
     and new.fee_at_request is distinct from v_fee then
    raise exception 'The viewing fee changed. Refresh the listing and confirm the current fee.';
  end if;
  if v_fee > 0 and new.viewing_fee_acknowledged is not true then
    raise exception 'Acknowledge the viewing fee before requesting a viewing';
  end if;

  new.viewing_fee_snapshot := v_fee;
  new.fee_at_request := v_fee;
  return new;
end;
$function$;

create or replace function public.admin_set_viewing_fee_privilege(
  p_profile_id uuid,
  p_blocked boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_admin_name text;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_profile_id is null or p_blocked is null or length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Choose a lister, an action, and provide a reason of at least five characters';
  end if;
  select full_name into v_admin_name from public.profiles where id = auth.uid();
  perform set_config('nyumba254.viewing_fee_admin_rpc', '1', true);
  update public.profiles
  set viewing_fee_blocked = p_blocked,
      viewing_fee_block_reason = case when p_blocked then btrim(p_reason) else null end
  where id = p_profile_id;
  if not found then raise exception 'Lister profile not found'; end if;

  insert into public.admin_logs (admin_id, admin_name, action, target_type, target_id, details)
  values (auth.uid(), coalesce(v_admin_name, 'Admin'),
    case when p_blocked then 'freeze_viewing_fee_privilege' else 'unfreeze_viewing_fee_privilege' end,
    'profile', p_profile_id::text, btrim(p_reason));

  insert into public.notifications (seller_id, type, title, description, link)
  values (p_profile_id, 'viewing_fee_policy',
    case when p_blocked then 'Viewing fee privilege paused' else 'Viewing fee privilege restored' end,
    case when p_blocked then 'Your viewing-fee privilege was paused. Reason: ' || btrim(p_reason)
         else 'Your viewing-fee privilege was restored. Reason: ' || btrim(p_reason) end,
    '/dashboard?view=settings');
end;
$function$;
revoke all on function public.admin_set_viewing_fee_privilege(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_viewing_fee_privilege(uuid, boolean, text) to authenticated;

create or replace function public.admin_set_listing_viewing_fee(
  p_listing_id uuid,
  p_viewing_fee integer,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_seller_id uuid;
  v_admin_name text;
  v_max integer;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_listing_id is null or p_viewing_fee is null or length(btrim(coalesce(p_reason, ''))) < 5 then
    raise exception 'Choose a listing, fee, and provide a reason of at least five characters';
  end if;
  select coalesce((s.value #>> '{}')::integer, 5000) into v_max
  from public.platform_settings s where s.key = 'viewing_fee_max';
  v_max := least(coalesce(v_max, 5000), 5000);
  if p_viewing_fee < 0 or p_viewing_fee > v_max then
    raise exception 'Viewing fee must be between KES 0 and KES %', v_max;
  end if;
  select l.seller_id
    into v_seller_id
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.id = p_listing_id;
  if not found then raise exception 'Listing not found'; end if;
  if p_viewing_fee > 0 and not public.viewing_fee_lister_can_charge(v_seller_id) then
    raise exception 'The lister must be an eligible, identity-verified Agent or Company with the current policy accepted and fee privilege enabled';
  end if;
  select full_name into v_admin_name from public.profiles where id = auth.uid();

  insert into public.listing_viewing_fees (listing_id, viewing_fee)
  values (p_listing_id, p_viewing_fee)
  on conflict (listing_id) do update
    set viewing_fee = excluded.viewing_fee, updated_at = now();

  insert into public.admin_logs (admin_id, admin_name, action, target_type, target_id, details)
  values (auth.uid(), coalesce(v_admin_name, 'Admin'), 'admin_set_listing_viewing_fee',
    'listing', p_listing_id::text,
    'Set viewing fee to KES ' || p_viewing_fee::text || '. Reason: ' || btrim(p_reason));

  insert into public.notifications (seller_id, type, title, description, link)
  values (v_seller_id, 'viewing_fee_policy', 'Viewing fee updated by Nyumba254',
    'An administrator updated this listing’s viewing fee. Reason: ' || btrim(p_reason),
    '/dashboard?view=listings');
end;
$function$;
revoke all on function public.admin_set_listing_viewing_fee(uuid, integer, text) from public, anon;
grant execute on function public.admin_set_listing_viewing_fee(uuid, integer, text) to authenticated;

create or replace function public.submit_viewing_fee_feedback(
  p_viewing_request_id uuid,
  p_buyer_token text,
  p_was_as_listed boolean,
  p_details text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_request public.viewing_requests%rowtype;
begin
  if p_viewing_request_id is null or nullif(btrim(p_buyer_token), '') is null or p_was_as_listed is null then
    raise exception 'Viewing feedback is incomplete';
  end if;
  select * into v_request
  from public.viewing_requests vr
  where vr.id = p_viewing_request_id
    and vr.buyer_token = p_buyer_token
    and vr.status = 'done'
  for update;
  if not found then
    raise exception 'Completed viewing request not found';
  end if;

  insert into public.viewing_fee_feedback (viewing_request_id, listing_id, was_as_listed, details)
  values (v_request.id, v_request.listing_id, p_was_as_listed, left(nullif(btrim(p_details), ''), 1000))
  on conflict (viewing_request_id) do nothing;

  if not p_was_as_listed then
    insert into public.reports (reporter_name, reporter_contact, target_type, target_id, reason, details, status)
    values (v_request.buyer_name, v_request.buyer_phone, 'listing', v_request.listing_id,
      'viewing_fee_dispute',
      'Buyer reported that the fee did not match the listing. ' || left(coalesce(btrim(p_details), ''), 900),
      'pending');
  end if;
end;
$function$;
revoke all on function public.submit_viewing_fee_feedback(uuid, text, boolean, text) from public;
grant execute on function public.submit_viewing_fee_feedback(uuid, text, boolean, text) to anon, authenticated;

create or replace function public.get_completed_viewing_fee_feedback(
  p_listing_id uuid,
  p_buyer_token text
)
returns table (viewing_request_id uuid, fee_at_request integer)
language sql
stable
security definer
set search_path = public
as $function$
  select vr.id, coalesce(vr.fee_at_request, vr.viewing_fee_snapshot)
  from public.viewing_requests vr
  where p_listing_id is not null
    and nullif(btrim(p_buyer_token), '') is not null
    and vr.listing_id = p_listing_id
    and vr.buyer_token = p_buyer_token
    and vr.status = 'done'
    and not exists (
      select 1 from public.viewing_fee_feedback f
      where f.viewing_request_id = vr.id
    )
  order by vr.created_at desc
  limit 10;
$function$;
revoke all on function public.get_completed_viewing_fee_feedback(uuid, text) from public;
grant execute on function public.get_completed_viewing_fee_feedback(uuid, text) to anon, authenticated;

-- Rollback (destructive to role and fee-policy data; copy and run only after review):
-- begin;
-- drop trigger if exists guard_listing_viewing_fee on public.listing_viewing_fees;
-- drop trigger if exists protect_profile_default_viewing_fee on public.profiles;
-- drop trigger if exists apply_viewing_fee_report_escalation on public.reports;
-- drop trigger if exists protect_viewing_fee_report_validity on public.reports;
-- do $rollback$
-- declare v_definition text;
-- begin
--   for v_definition in
--     select definition
--     from migration_rollback.function_definitions
--     where migration_id = '20261017130000'
--     order by case function_signature
--       when 'public.protect_viewing_fee_fields()' then 1
--       when 'public.protect_account_type_fields()' then 2
--       when 'public.set_account_type(text)' then 3
--       when 'public.set_listing_viewing_fees(uuid[],integer)' then 4
--       when 'public.get_public_viewing_fees(uuid[])' then 5
--       else 6
--     end
--   loop execute v_definition; end loop;
-- end;
-- $rollback$;
-- drop function if exists public.submit_viewing_fee_feedback(uuid, text, boolean, text);
-- drop function if exists public.get_completed_viewing_fee_feedback(uuid, text);
-- drop function if exists public.update_viewing_request_status(uuid, text);
-- drop function if exists public.get_seller_viewing_requests();
-- drop function if exists public.search_public_listing_ids(text, text, text, text[], numeric, numeric, text, text, text[], text, boolean, text, text, text, uuid[], integer, integer);
-- drop function if exists public.admin_set_viewing_fee_privilege(uuid, boolean, text);
-- drop function if exists public.admin_set_listing_viewing_fee(uuid, integer, text);
-- drop function if exists public.change_account_type(text);
-- drop function if exists public.current_viewing_fee_policy_version();
-- drop function if exists public.viewing_fee_lister_can_charge(uuid);
-- drop function if exists public.accept_viewing_fee_policy(text);
-- drop function if exists public.guard_listing_viewing_fee();
-- drop function if exists public.apply_viewing_fee_report_escalation();
-- drop function if exists public.protect_viewing_fee_report_validity();
-- drop table if exists public.viewing_fee_feedback;
-- alter table public.reports drop column if exists fee_report_valid;
-- alter table public.viewing_requests drop constraint if exists viewing_requests_fee_at_request_range;
-- alter table public.viewing_requests drop column if exists fee_at_request;
-- alter table public.profiles drop column if exists account_type_first_set_at;
-- alter table public.profiles drop column if exists account_type_correction_used;
-- alter table public.profiles drop column if exists account_type_cooldown_until;
-- alter table public.profiles drop column if exists viewing_fee_policy_version;
-- alter table public.profiles drop column if exists viewing_fee_policy_accepted_at;
-- alter table public.profiles drop column if exists viewing_fee_blocked;
-- alter table public.profiles drop column if exists viewing_fee_block_reason;
-- delete from public.platform_settings s using migration_rollback.platform_settings b
-- where b.migration_id = '20261017130000' and b.existed = false and s.key = b.setting_key;
-- update public.platform_settings s set value = b.previous_value
-- from migration_rollback.platform_settings b
-- where b.migration_id = '20261017130000' and b.existed = true and s.key = b.setting_key;
-- drop table if exists migration_rollback.platform_settings;
-- drop table if exists migration_rollback.function_definitions;
-- drop schema if exists migration_rollback;
-- commit;

commit;
