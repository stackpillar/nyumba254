-- Optional viewing fees for agents and companies. This migration is local
-- only until it is explicitly applied to the linked Supabase project.
begin;

alter table public.profiles
  add column if not exists default_viewing_fee integer;

create table if not exists public.listing_viewing_fees (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  viewing_fee integer not null default 0
    check (viewing_fee between 0 and 5000),
  updated_at timestamptz not null default now()
);
alter table public.listing_viewing_fees enable row level security;
revoke all on public.listing_viewing_fees from public, anon, authenticated;
create index if not exists listing_viewing_fees_positive_idx
  on public.listing_viewing_fees (viewing_fee)
  where viewing_fee > 0;

alter table public.viewing_requests
  add column if not exists viewing_fee_snapshot integer,
  add column if not exists viewing_fee_acknowledged boolean not null default false;

do $$
begin
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
declare
  v_seller_id uuid;
begin
  if tg_table_name = 'listing_viewing_fees' then
    select l.seller_id into v_seller_id
    from public.listings l
    where l.id = new.listing_id;
    if not found then raise exception 'Listing not found'; end if;
    if new.viewing_fee > 0 and not public.can_set_viewing_fee(v_seller_id) then
      raise exception 'Only agent and company accounts can set a viewing fee';
    end if;
    new.updated_at := now();
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

create or replace function public.clear_default_viewing_fee_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.account_type is distinct from old.account_type
     and new.account_type not in ('agent', 'company') then
    new.default_viewing_fee := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists clear_default_viewing_fee_on_role_change on public.profiles;
create trigger clear_default_viewing_fee_on_role_change
  before update of account_type on public.profiles
  for each row execute function public.clear_default_viewing_fee_on_role_change();

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
  if tg_table_name = 'listing_viewing_fees' then
    v_id := new.listing_id;
    v_new := new.viewing_fee;
    if tg_op = 'UPDATE' then v_old := old.viewing_fee; else v_old := 0; end if;
  else
    v_id := new.id;
    v_new := new.default_viewing_fee;
    if tg_op = 'UPDATE' then v_old := old.default_viewing_fee; else v_old := null; end if;
  end if;

  if v_old is distinct from v_new then
    insert into public.viewing_fee_history (object_type, object_id, changed_by, old_fee, new_fee)
    values (
      case when tg_table_name = 'listing_viewing_fees' then 'listing' else 'profile' end,
      v_id,
      auth.uid(),
      v_old,
      v_new
    );
  end if;
  return new;
end;
$function$;

drop trigger if exists record_listing_viewing_fee_change on public.listing_viewing_fees;
create trigger record_listing_viewing_fee_change
  after insert or update of viewing_fee on public.listing_viewing_fees
  for each row execute function public.record_viewing_fee_change();

drop trigger if exists record_profile_default_viewing_fee_change on public.profiles;
create trigger record_profile_default_viewing_fee_change
  after insert or update of default_viewing_fee on public.profiles
  for each row execute function public.record_viewing_fee_change();

create or replace function public.get_my_listing_viewing_fees(p_listing_ids uuid[])
returns table (listing_id uuid, viewing_fee integer)
language sql
stable
security definer
set search_path = public
as $function$
  select l.id, coalesce(f.viewing_fee, 0)::integer
  from public.listings l
  left join public.listing_viewing_fees f on f.listing_id = l.id
  where l.id = any(coalesce(p_listing_ids, array[]::uuid[]))
    and (l.seller_id = public.effective_seller_id() or public.is_admin());
$function$;
revoke all on function public.get_my_listing_viewing_fees(uuid[]) from public, anon;
grant execute on function public.get_my_listing_viewing_fees(uuid[]) to authenticated;

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
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if p_viewing_fee is null or p_viewing_fee < 0 or p_viewing_fee > 5000 then
    raise exception 'Viewing fee must be a whole number between KES 0 and KES 5,000';
  end if;
  if coalesce(cardinality(p_listing_ids), 0) = 0 then return 0; end if;
  if p_viewing_fee > 0 and not public.can_set_viewing_fee(v_seller_id) and not public.is_admin() then
    raise exception 'Only agent and company accounts can set a viewing fee';
  end if;

  select count(distinct id)::integer into v_expected
  from unnest(p_listing_ids) as requested(id);
  if public.is_admin() then
    select count(*)::integer into v_found
    from public.listings l where l.id = any(p_listing_ids);
    if v_found <> v_expected then raise exception 'One or more listings could not be found'; end if;
    insert into public.listing_viewing_fees (listing_id, viewing_fee)
    select l.id, p_viewing_fee
    from public.listings l
    where l.id = any(p_listing_ids)
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
revoke all on function public.set_listing_viewing_fees(uuid[], integer) from public, anon;
grant execute on function public.set_listing_viewing_fees(uuid[], integer) to authenticated;

create or replace function public.get_public_viewing_fees(p_listing_ids uuid[])
returns table (listing_id uuid, viewing_fee integer)
language sql
stable
security definer
set search_path = public
as $function$
  select l.id,
         case when p.account_type in ('agent', 'company')
              then coalesce(f.viewing_fee, 0)
              else 0
         end::integer
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.listing_viewing_fees f on f.listing_id = l.id
  where l.id = any(coalesce(p_listing_ids, array[]::uuid[]))
    and l.status in ('active', 'occupied')
    and coalesce(l.is_disabled, false) = false
    and coalesce(l.recycle_bin, false) = false
    and p.is_disabled is not true;
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
  if tg_op = 'UPDATE' then
    if new.listing_id is distinct from old.listing_id then
      raise exception 'A viewing request cannot be moved to another listing';
    end if;
    new.viewing_fee_snapshot := old.viewing_fee_snapshot;
    new.viewing_fee_acknowledged := old.viewing_fee_acknowledged;
    return new;
  end if;

  select case when p.account_type in ('agent', 'company')
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
  if v_fee > 0 and new.viewing_fee_acknowledged is not true then
    raise exception 'Acknowledge the viewing fee before requesting a viewing';
  end if;

  new.viewing_fee_snapshot := v_fee;
  return new;
end;
$function$;

drop trigger if exists snapshot_viewing_request_fee on public.viewing_requests;
create trigger snapshot_viewing_request_fee
  before insert or update on public.viewing_requests
  for each row execute function public.snapshot_viewing_request_fee();

-- Rollback (destructive to newly added fee data; review before running):
-- drop trigger if exists snapshot_viewing_request_fee on public.viewing_requests;
-- drop function if exists public.snapshot_viewing_request_fee();
-- drop function if exists public.get_public_viewing_fees(uuid[]);
-- drop trigger if exists record_profile_default_viewing_fee_change on public.profiles;
-- drop trigger if exists record_listing_viewing_fee_change on public.listing_viewing_fees;
-- drop function if exists public.record_viewing_fee_change();
-- drop function if exists public.set_listing_viewing_fees(uuid[], integer);
-- drop function if exists public.get_my_listing_viewing_fees(uuid[]);
-- drop index if exists public.listing_viewing_fees_positive_idx;
-- drop table if exists public.listing_viewing_fees;
-- drop policy if exists viewing_fee_history_admin_read on public.viewing_fee_history;
-- drop table if exists public.viewing_fee_history;
-- drop trigger if exists protect_profile_default_viewing_fee on public.profiles;
-- drop trigger if exists clear_default_viewing_fee_on_role_change on public.profiles;
-- drop function if exists public.clear_default_viewing_fee_on_role_change();
-- drop function if exists public.protect_viewing_fee_fields();
-- drop function if exists public.can_set_viewing_fee(uuid);
-- alter table public.viewing_requests drop column if exists viewing_fee_acknowledged;
-- alter table public.viewing_requests drop column if exists viewing_fee_snapshot;
-- alter table public.viewing_requests drop constraint if exists viewing_requests_fee_snapshot_range;
-- alter table public.profiles drop constraint if exists profiles_default_viewing_fee_range;
-- alter table public.profiles drop column if exists default_viewing_fee;

commit;
