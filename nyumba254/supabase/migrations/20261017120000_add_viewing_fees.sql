-- Optional viewing fees for agents and companies. This migration is local
-- only until it is explicitly applied to the linked Supabase project.
begin;

alter table public.listings
  add column if not exists viewing_fee integer;

alter table public.profiles
  add column if not exists default_viewing_fee integer;

alter table public.viewing_requests
  add column if not exists viewing_fee_snapshot integer,
  add column if not exists viewing_fee_acknowledged boolean not null default false;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_viewing_fee_range'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_viewing_fee_range
      check (viewing_fee is null or viewing_fee between 0 and 5000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_default_viewing_fee_range'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_default_viewing_fee_range
      check (default_viewing_fee is null or default_viewing_fee between 0 and 5000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'viewing_requests_fee_snapshot_range'
      and conrelid = 'public.viewing_requests'::regclass
  ) then
    alter table public.viewing_requests
      add constraint viewing_requests_fee_snapshot_range
      check (viewing_fee_snapshot is null or viewing_fee_snapshot between 0 and 5000);
  end if;
end;
$$;

create or replace function public.can_set_viewing_fee(p_profile_id uuid)
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
      and p.is_disabled is not true
  );
$function$;
revoke all on function public.can_set_viewing_fee(uuid) from public, anon, authenticated;

create or replace function public.protect_viewing_fee_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_table_name = 'listings' then
    if new.viewing_fee is not null
       and new.viewing_fee > 0
       and not public.can_set_viewing_fee(new.seller_id) then
      raise exception 'Only agent and company accounts can set a viewing fee';
    end if;
    return new;
  end if;

  if new.default_viewing_fee is not null
     and new.default_viewing_fee > 0
     and not public.can_set_viewing_fee(new.id) then
    raise exception 'Only agent and company accounts can set a default viewing fee';
  end if;
  return new;
end;
$function$;

drop trigger if exists protect_listing_viewing_fee on public.listings;
create trigger protect_listing_viewing_fee
  before insert or update of seller_id, viewing_fee on public.listings
  for each row execute function public.protect_viewing_fee_fields();

drop trigger if exists protect_profile_default_viewing_fee on public.profiles;
create trigger protect_profile_default_viewing_fee
  before insert or update of id, account_type, default_viewing_fee on public.profiles
  for each row execute function public.protect_viewing_fee_fields();

create table if not exists public.viewing_fee_history (
  id bigint generated always as identity primary key,
  object_type text not null check (object_type in ('listing', 'profile')),
  object_id uuid not null,
  changed_by uuid references public.profiles(id) on delete set null,
  old_fee integer,
  new_fee integer,
  changed_at timestamptz not null default now(),
  check (old_fee is null or old_fee between 0 and 5000),
  check (new_fee is null or new_fee between 0 and 5000)
);
create index if not exists viewing_fee_history_changed_at_idx
  on public.viewing_fee_history (changed_at desc);
alter table public.viewing_fee_history enable row level security;
revoke all on public.viewing_fee_history from public, anon, authenticated;
grant select on public.viewing_fee_history to authenticated;
drop policy if exists viewing_fee_history_admin_read on public.viewing_fee_history;
create policy viewing_fee_history_admin_read on public.viewing_fee_history
  for select to authenticated using (public.is_admin());

create or replace function public.record_viewing_fee_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_old integer;
  v_new integer;
  v_id uuid;
begin
  if tg_table_name = 'listings' then
    v_id := new.id;
    v_new := new.viewing_fee;
    if tg_op = 'UPDATE' then v_old := old.viewing_fee; end if;
  else
    v_id := new.id;
    v_new := new.default_viewing_fee;
    if tg_op = 'UPDATE' then v_old := old.default_viewing_fee; end if;
  end if;

  if v_old is distinct from v_new then
    insert into public.viewing_fee_history (object_type, object_id, changed_by, old_fee, new_fee)
    values (
      case when tg_table_name = 'listings' then 'listing' else 'profile' end,
      v_id,
      auth.uid(),
      v_old,
      v_new
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists record_listing_viewing_fee_change on public.listings;
create trigger record_listing_viewing_fee_change
  after insert or update of viewing_fee on public.listings
  for each row execute function public.record_viewing_fee_change();

drop trigger if exists record_profile_default_viewing_fee_change on public.profiles;
create trigger record_profile_default_viewing_fee_change
  after insert or update of default_viewing_fee on public.profiles
  for each row execute function public.record_viewing_fee_change();

create or replace function public.get_public_viewing_fees(p_listing_ids uuid[])
returns table (listing_id uuid, viewing_fee integer)
language sql
stable
security definer
set search_path = public
as $function$
  select l.id,
         case when p.account_type in ('agent', 'company')
              then coalesce(l.viewing_fee, 0)
              else 0
         end::integer
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.id = any(coalesce(p_listing_ids, array[]::uuid[]))
    and l.status in ('active', 'occupied')
    and coalesce(l.is_disabled, false) = false
    and coalesce(l.recycle_bin, false) = false;
$function$;
revoke all on function public.get_public_viewing_fees(uuid[]) from public;
grant execute on function public.get_public_viewing_fees(uuid[]) to anon, authenticated;

create or replace function public.snapshot_viewing_request_fee()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_fee integer;
begin
  select case when p.account_type in ('agent', 'company')
              then coalesce(l.viewing_fee, 0)
              else 0
         end
    into v_fee
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  where l.id = new.listing_id
    and l.status = 'active'
    and coalesce(l.is_disabled, false) = false
    and coalesce(l.recycle_bin, false) = false;

  if not found then
    raise exception 'This listing is not available for viewing requests';
  end if;
  if v_fee > 0 and new.viewing_fee_acknowledged is not true then
    raise exception 'Acknowledge the viewing fee before requesting a viewing';
  end if;

  new.viewing_fee_snapshot := v_fee;
  return new;
end;
$function$;

drop trigger if exists snapshot_viewing_request_fee on public.viewing_requests;
create trigger snapshot_viewing_request_fee
  before insert on public.viewing_requests
  for each row execute function public.snapshot_viewing_request_fee();

-- Keep the existing account-type rules and role history, while clearing only
-- the account default when the current role no longer qualifies. Listing fees
-- remain stored and are hidden publicly by get_public_viewing_fees().
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
  v_platform_role text;
  v_disabled boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_account_type is null
     or p_account_type not in ('buyer', 'owner', 'caretaker', 'agent', 'company') then
    raise exception 'Choose a supported account type';
  end if;

  select p.account_type, p.account_type_set_at, p.role, p.is_disabled
    into v_current_type, v_set_at, v_platform_role, v_disabled
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
     and v_platform_role is distinct from 'admin'
     and v_set_at is not null
     and v_set_at > now() - interval '7 days' then
    raise exception 'Account type can be changed once every 7 days';
  end if;

  if v_current_type is distinct from p_account_type then
    insert into public.role_history (profile_id, previous_account_type, new_account_type)
    values (v_user_id, v_current_type, p_account_type);
  end if;

  perform set_config('nyumba254.account_type_rpc', '1', true);
  update public.profiles p
  set account_type = p_account_type,
      account_type_set_at = case
        when p.account_type is distinct from p_account_type then now()
        else coalesce(p.account_type_set_at, now())
      end,
      onboarding_completed = true,
      verified_role = case
        when p.verified_role = p_account_type then p.verified_role
        else null
      end,
      default_viewing_fee = case
        when p_account_type in ('agent', 'company') then p.default_viewing_fee
        else null
      end
  where p.id = v_user_id;

  return query
  select p.account_type, p.onboarding_completed, p.account_type_set_at
  from public.profiles p
  where p.id = v_user_id;
end;
$function$;

-- Rollback (destructive to newly added fee data; review before running):
-- drop trigger if exists snapshot_viewing_request_fee on public.viewing_requests;
-- drop function if exists public.snapshot_viewing_request_fee();
-- drop function if exists public.get_public_viewing_fees(uuid[]);
-- drop trigger if exists record_profile_default_viewing_fee_change on public.profiles;
-- drop trigger if exists record_listing_viewing_fee_change on public.listings;
-- drop function if exists public.record_viewing_fee_change();
-- drop policy if exists viewing_fee_history_admin_read on public.viewing_fee_history;
-- drop table if exists public.viewing_fee_history;
-- drop trigger if exists protect_profile_default_viewing_fee on public.profiles;
-- drop trigger if exists protect_listing_viewing_fee on public.listings;
-- drop function if exists public.protect_viewing_fee_fields();
-- drop function if exists public.can_set_viewing_fee(uuid);
-- alter table public.viewing_requests drop column if exists viewing_fee_acknowledged;
-- alter table public.viewing_requests drop column if exists viewing_fee_snapshot;
-- alter table public.profiles drop column if exists default_viewing_fee;
-- alter table public.listings drop column if exists viewing_fee;

commit;
