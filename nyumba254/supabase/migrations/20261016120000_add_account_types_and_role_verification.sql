-- Marketplace account types are separate from profiles.role, which remains
-- the platform/admin authorization field.
begin;

create schema if not exists extensions;
create extension if not exists pg_trgm with schema extensions;

alter table public.profiles
  add column if not exists account_type text,
  add column if not exists account_type_set_at timestamptz,
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists verified_role text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_account_type_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_account_type_allowed
      check (account_type is null or account_type in ('buyer', 'owner', 'caretaker', 'agent', 'company'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_verified_role_allowed'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_verified_role_allowed
      check (verified_role is null or verified_role in ('buyer', 'owner', 'caretaker', 'agent', 'company'));
  end if;
end;
$$;

-- This one-time cutoff preserves listing access for existing seller accounts
-- while requiring newer accounts to choose a marketplace account type first.
create table if not exists public.account_type_migration_state (
  singleton boolean primary key default true check (singleton),
  legacy_cutoff timestamptz not null
);
insert into public.account_type_migration_state (singleton, legacy_cutoff)
values (true, transaction_timestamp())
on conflict (singleton) do nothing;
revoke all on public.account_type_migration_state from public, anon, authenticated;

create table if not exists public.role_history (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  previous_account_type text,
  new_account_type text not null
    check (new_account_type in ('buyer', 'owner', 'caretaker', 'agent', 'company')),
  changed_at timestamptz not null default now()
);
create index if not exists role_history_profile_changed_idx
  on public.role_history (profile_id, changed_at desc);
alter table public.role_history enable row level security;

drop policy if exists role_history_read_own_or_admin on public.role_history;
create policy role_history_read_own_or_admin on public.role_history
  for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());

create table if not exists public.company_profiles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  company_name text not null check (length(btrim(company_name)) between 2 and 160),
  company_type text not null
    check (company_type in ('agency', 'developer', 'property_manager')),
  registration_number text,
  logo_url text,
  description text,
  website text,
  duplicate_review_required boolean not null default false,
  duplicate_match_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_profiles_logo_url_http'
      and conrelid = 'public.company_profiles'::regclass
  ) then
    alter table public.company_profiles
      add constraint company_profiles_logo_url_http
      check (logo_url is null or logo_url ~* '^https?://');
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'company_profiles_website_http'
      and conrelid = 'public.company_profiles'::regclass
  ) then
    alter table public.company_profiles
      add constraint company_profiles_website_http
      check (website is null or website ~* '^https?://');
  end if;
end;
$$;
alter table public.company_profiles enable row level security;
grant select, insert, update on public.company_profiles to authenticated;
grant select on public.role_history to authenticated;

drop policy if exists company_profiles_owner_or_admin on public.company_profiles;
create policy company_profiles_owner_or_admin on public.company_profiles
  for all to authenticated
  using (profile_id = auth.uid() or public.is_admin())
  with check (profile_id = auth.uid() or public.is_admin());

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
       or new.verified_role is not null then
      raise exception 'Account setup must use the account setup flow';
    end if;
    return new;
  end if;

  if (new.account_type is distinct from old.account_type
      or new.account_type_set_at is distinct from old.account_type_set_at
      or new.onboarding_completed is distinct from old.onboarding_completed)
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

drop trigger if exists protect_account_type_fields on public.profiles;
create trigger protect_account_type_fields
  before insert or update on public.profiles
  for each row execute function public.protect_account_type_fields();

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
      end
  where p.id = v_user_id;

  return query
  select p.account_type, p.onboarding_completed, p.account_type_set_at
  from public.profiles p
  where p.id = v_user_id;
end;
$function$;

create or replace function public.admin_approve_account_role(p_profile_id uuid, p_approved boolean)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_account_type text;
  v_disabled boolean;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_approved is null then
    raise exception 'An approval decision is required';
  end if;
  select p.account_type, p.is_disabled
    into v_account_type, v_disabled
  from public.profiles p
  where p.id = p_profile_id
  for update;
  if not found then
    raise exception 'Profile not found';
  end if;
  if p_approved and (v_account_type is null or v_disabled) then
    raise exception 'Only an enabled account with a selected account type can be role-verified';
  end if;

  perform set_config('nyumba254.role_verification_rpc', '1', true);
  update public.profiles
  set verified_role = case when p_approved then v_account_type else null end
  where id = p_profile_id;
  return case when p_approved then v_account_type else null end;
end;
$function$;

create or replace function public.save_company_profile(
  p_company_name text,
  p_company_type text,
  p_registration_number text default null,
  p_logo_url text default null,
  p_description text default null,
  p_website text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.account_type = 'company'
      and p.is_disabled is not true
  ) then
    raise exception 'Select the company account type before editing company details';
  end if;

  insert into public.company_profiles (
    profile_id, company_name, company_type, registration_number,
    logo_url, description, website, updated_at
  )
  values (
    auth.uid(), btrim(p_company_name), p_company_type, nullif(btrim(p_registration_number), ''),
    nullif(btrim(p_logo_url), ''), nullif(btrim(p_description), ''),
    nullif(btrim(p_website), ''), now()
  )
  on conflict (profile_id) do update set
    company_name = excluded.company_name,
    company_type = excluded.company_type,
    registration_number = excluded.registration_number,
    logo_url = excluded.logo_url,
    description = excluded.description,
    website = excluded.website,
    updated_at = now();
end;
$function$;

create or replace function public.flag_company_name_duplicates()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_normalized text;
  v_match_profile_id uuid;
  v_match_verified boolean;
  v_similarity real;
begin
  if tg_op = 'UPDATE' and new.company_name is not distinct from old.company_name then
    if new.duplicate_review_required is distinct from old.duplicate_review_required
       and not public.is_admin() then
      raise exception 'Only an administrator can change duplicate-review status';
    end if;
    return new;
  end if;

  v_normalized := lower(regexp_replace(btrim(new.company_name), '[^[:alnum:]]+', '', 'g'));
  if length(v_normalized) < 2 then
    raise exception 'Company name must contain at least two letters or numbers';
  end if;

  perform pg_advisory_xact_lock(2510, 254);
  select c.profile_id, (p.verified_role = 'company'), similarity(
    lower(regexp_replace(btrim(c.company_name), '[^[:alnum:]]+', '', 'g')),
    v_normalized
  )
  into v_match_profile_id, v_match_verified, v_similarity
  from public.company_profiles c
  join public.profiles p on p.id = c.profile_id
  where c.profile_id <> new.profile_id
    and p.is_disabled is not true
    and similarity(
      lower(regexp_replace(btrim(c.company_name), '[^[:alnum:]]+', '', 'g')),
      v_normalized
    ) >= 0.72
  order by 3 desc
  limit 1;

  if v_match_profile_id is not null and v_match_verified then
    new.duplicate_review_required := true;
    new.duplicate_match_profile_id := v_match_profile_id;
  elsif v_match_profile_id is not null and v_similarity >= 0.72 then
    raise exception 'A similar company name is already registered';
  else
    new.duplicate_review_required := false;
    new.duplicate_match_profile_id := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists company_profiles_duplicate_name on public.company_profiles;
create trigger company_profiles_duplicate_name
  before insert or update on public.company_profiles
  for each row execute function public.flag_company_name_duplicates();

create or replace function public.admin_review_company_duplicate(p_profile_id uuid, p_clear_flag boolean)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_clear_flag is null then
    raise exception 'A duplicate-review decision is required';
  end if;
  update public.company_profiles
  set duplicate_review_required = not p_clear_flag,
      duplicate_match_profile_id = case when p_clear_flag then null else duplicate_match_profile_id end,
      updated_at = now()
  where profile_id = p_profile_id;
  if not found then
    raise exception 'Company profile not found';
  end if;
end;
$function$;

create or replace function public.can_create_listing(p_profile_id uuid)
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
      and p.is_disabled is not true
      and (
        p.account_type in ('owner', 'caretaker', 'agent', 'company')
        or (
          p.account_type is null
          and p.role = 'seller'
          and p.created_at < (
            select s.legacy_cutoff
            from public.account_type_migration_state s
            where s.singleton
          )
        )
      )
  );
$function$;

alter table public.listings
  add column if not exists listed_by_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'listings_listed_by_type_allowed'
      and conrelid = 'public.listings'::regclass
  ) then
    alter table public.listings
      add constraint listings_listed_by_type_allowed
      check (listed_by_type is null or listed_by_type in ('buyer', 'owner', 'caretaker', 'agent', 'company', 'seller'));
  end if;
end;
$$;

create or replace function public.set_listing_account_type_snapshot()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_owner_id uuid;
begin
  if tg_op = 'INSERT' then
    v_owner_id := public.effective_seller_id();
    if auth.uid() is not null
       and not public.is_admin()
       and new.seller_id is distinct from v_owner_id then
      raise exception 'Listings must be created for the signed-in account or its active team owner';
    end if;
    if new.status in ('active', 'occupied') then
      if new.seller_id is not null and not public.can_create_listing(new.seller_id) then
        raise exception 'ACCOUNT_TYPE_CANNOT_LIST';
      end if;
      select coalesce(p.account_type, case
        when p.created_at < (
          select s.legacy_cutoff
          from public.account_type_migration_state s
          where s.singleton
        ) then 'seller'
      end)
      into new.listed_by_type
      from public.profiles p
      where p.id = new.seller_id;
    else
      new.listed_by_type := null;
    end if;
  else
    if new.seller_id is distinct from old.seller_id then
      raise exception 'The listing owner cannot be changed';
    end if;
    if new.listed_by_type is distinct from old.listed_by_type
       and (old.listed_by_type is not null
            or (new.status is distinct from 'active' and new.status is distinct from 'occupied')
            or old.status in ('active', 'occupied')) then
      raise exception 'The listing account-type snapshot cannot be changed';
    end if;
    if new.status in ('active', 'occupied')
       and old.status is distinct from 'active'
       and old.status is distinct from 'occupied' then
      if new.seller_id is not null and not public.can_create_listing(new.seller_id) then
        raise exception 'ACCOUNT_TYPE_CANNOT_LIST';
      end if;
      if old.listed_by_type is null then
        select coalesce(p.account_type, case
          when p.created_at < (
            select s.legacy_cutoff
            from public.account_type_migration_state s
            where s.singleton
          ) then 'seller'
        end)
        into new.listed_by_type
        from public.profiles p
        where p.id = new.seller_id;
      end if;
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists set_listing_account_type_snapshot on public.listings;
create trigger set_listing_account_type_snapshot
  before insert or update of status, seller_id, listed_by_type on public.listings
  for each row execute function public.set_listing_account_type_snapshot();

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
    select count(*) into v_count
    from public.listings l
    where l.seller_id = new.seller_id
      and l.status = 'active'
      and l.recycle_bin is not true
      and l.id is distinct from new.id;
    if v_count >= 2 then
      raise exception 'LISTING_LIMIT_REACHED';
    end if;
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_enforce_listing_limit on public.listings;
create trigger trg_enforce_listing_limit
  before insert or update of status, seller_id, recycle_bin on public.listings
  for each row execute function public.enforce_listing_limit();

drop policy if exists sellers_only_insert_listings on public.listings;
create policy sellers_only_insert_listings on public.listings
  for insert to authenticated
  with check (
    seller_id = public.effective_seller_id()
    and public.can_create_listing(public.effective_seller_id())
  );

-- The previous ALL policy also granted INSERT to every caller for whom
-- effective_seller_id() returned their own id. Keep team read/write/delete
-- access while routing inserts through the account-type capability check.
drop policy if exists "team members access listings" on public.listings;
drop policy if exists "team members read listings" on public.listings;
drop policy if exists "team members update listings" on public.listings;
drop policy if exists "team members delete listings" on public.listings;
create policy "team members read listings" on public.listings
  for select to authenticated
  using (seller_id = public.effective_seller_id());
create policy "team members update listings" on public.listings
  for update to authenticated
  using (seller_id = public.effective_seller_id())
  with check (seller_id = public.effective_seller_id());
create policy "team members delete listings" on public.listings
  for delete to authenticated
  using (seller_id = public.effective_seller_id());

create or replace function public.get_public_account_profile(p_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  bio text,
  created_at timestamptz,
  identity_verified boolean,
  account_type text,
  verified_role text,
  company_name text,
  company_type text,
  company_logo_url text,
  company_description text,
  company_website text
)
language sql
stable
security definer
set search_path = public
as $function$
  select p.id, p.full_name, p.bio, p.created_at,
         (p.verification_status = 'verified'),
         p.account_type,
         case when p.account_type = 'company' and c.duplicate_review_required
              then null else p.verified_role end,
         case when p.account_type = 'company' then c.company_name end,
         case when p.account_type = 'company' then c.company_type end,
         case when p.account_type = 'company'
                    and p.verified_role = 'company'
                    and c.duplicate_review_required is not true
              then c.logo_url end,
         case when p.account_type = 'company' then c.description end,
         case when p.account_type = 'company' then c.website end
  from public.profiles p
  left join public.company_profiles c on c.profile_id = p.id
  where p.id = p_profile_id
    and p.is_disabled is not true;
$function$;

create or replace view public.public_account_profiles
with (security_barrier = true)
as
  select p.id,
         p.full_name,
         p.created_at,
         (p.verification_status = 'verified') as identity_verified,
         p.account_type,
         case when p.account_type = 'company' and c.duplicate_review_required
              then null else p.verified_role end,
         case when p.account_type = 'company' then c.company_name end as company_name,
         case when p.account_type = 'company' then c.company_type end as company_type,
         case when p.account_type = 'company'
                    and p.verified_role = 'company'
                    and c.duplicate_review_required is not true
              then c.logo_url end as company_logo_url,
         case when p.account_type = 'company' then c.description end as company_description,
         case when p.account_type = 'company' then c.website end as company_website
  from public.profiles p
  left join public.company_profiles c on c.profile_id = p.id
  where p.is_disabled is not true;
grant select on public.public_account_profiles to anon, authenticated;

revoke all on function public.set_account_type(text) from public, anon;
revoke all on function public.admin_approve_account_role(uuid, boolean) from public, anon;
revoke all on function public.save_company_profile(text, text, text, text, text, text) from public, anon;
revoke all on function public.admin_review_company_duplicate(uuid, boolean) from public, anon;
revoke all on function public.get_public_account_profile(uuid) from public;
grant execute on function public.set_account_type(text) to authenticated;
grant execute on function public.admin_approve_account_role(uuid, boolean) to authenticated;
grant execute on function public.save_company_profile(text, text, text, text, text, text) to authenticated;
grant execute on function public.admin_review_company_duplicate(uuid, boolean) to authenticated;
grant execute on function public.get_public_account_profile(uuid) to anon, authenticated;
revoke all on function public.can_create_listing(uuid) from public, anon, authenticated;
grant execute on function public.can_create_listing(uuid) to authenticated;

commit;

-- Rollback (run manually only if rolling back this migration):
-- begin;
-- drop policy if exists sellers_only_insert_listings on public.listings;
-- drop function if exists public.get_public_account_profile(uuid);
-- drop view if exists public.public_account_profiles;
-- drop function if exists public.admin_review_company_duplicate(uuid, boolean);
-- drop function if exists public.flag_company_name_duplicates();
-- drop function if exists public.save_company_profile(text, text, text, text, text, text);
-- drop function if exists public.admin_approve_account_role(uuid, boolean);
-- drop function if exists public.set_account_type(text);
-- drop function if exists public.can_create_listing(uuid);
-- drop trigger if exists company_profiles_duplicate_name on public.company_profiles;
-- drop trigger if exists set_listing_account_type_snapshot on public.listings;
-- drop trigger if exists protect_account_type_fields on public.profiles;
-- drop function if exists public.set_listing_account_type_snapshot();
-- drop function if exists public.protect_account_type_fields();
-- drop policy if exists "team members read listings" on public.listings;
-- drop policy if exists "team members update listings" on public.listings;
-- drop policy if exists "team members delete listings" on public.listings;
-- create policy "team members access listings" on public.listings
--   for all to public
--   using (seller_id = public.effective_seller_id())
--   with check (seller_id = public.effective_seller_id());
-- create policy sellers_only_insert_listings on public.listings
--   for insert to public
--   with check (
--     auth.uid() = seller_id and exists (
--       select 1 from public.profiles p
--       where p.id = auth.uid() and p.role = 'seller' and p.is_disabled = false
--     )
--   );
-- drop trigger if exists trg_enforce_listing_limit on public.listings;
-- create or replace function public.enforce_listing_limit()
-- returns trigger language plpgsql security definer as $function$
-- declare v_status text; v_count int;
-- begin
--   select verification_status into v_status from profiles where id = new.seller_id;
--   if coalesce(v_status, 'unverified') <> 'verified' then
--     select count(*) into v_count from listings
--       where seller_id = new.seller_id and recycle_bin = false;
--     if v_count >= 2 then raise exception 'LISTING_LIMIT_REACHED'; end if;
--   end if;
--   return new;
-- end;
-- $function$;
-- create trigger trg_enforce_listing_limit before insert on public.listings
--   for each row execute function public.enforce_listing_limit();
-- drop table if exists public.company_profiles;
-- drop policy if exists role_history_read_own_or_admin on public.role_history;
-- drop table if exists public.role_history;
-- drop table if exists public.account_type_migration_state;
-- alter table public.listings drop constraint if exists listings_listed_by_type_allowed;
-- alter table public.listings drop column if exists listed_by_type;
-- alter table public.profiles drop constraint if exists profiles_account_type_allowed;
-- alter table public.profiles drop constraint if exists profiles_verified_role_allowed;
-- alter table public.profiles drop column if exists account_type,
--   drop column if exists account_type_set_at,
--   drop column if exists onboarding_completed,
--   drop column if exists verified_role;
-- commit;
