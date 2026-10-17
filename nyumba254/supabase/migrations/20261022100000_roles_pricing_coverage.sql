-- Multi-role accounts, role-based pricing, plan coverage, Airbnb role rule.
-- Idempotent: safe to run more than once.

-- ───────────── 1. Roles ─────────────
alter table public.profiles add column if not exists account_roles text[] not null default '{}';
alter table public.profiles add column if not exists primary_role text;
alter table public.role_history add column if not exists roles_before text[];
alter table public.role_history add column if not exists roles_after text[];

create or replace function public.nk_valid_roles(p_roles text[])
returns boolean language sql immutable as $$
  select p_roles is not null
    and coalesce(cardinality(p_roles), 0) <= 2
    and p_roles <@ array['owner','caretaker','agent','company']::text[]
    and (select count(distinct r) from unnest(p_roles) r) = coalesce(cardinality(p_roles), 0)
    and not (p_roles @> array['agent','company']::text[]);
$$;

alter table public.profiles drop constraint if exists profiles_account_roles_valid;
alter table public.profiles add constraint profiles_account_roles_valid
  check (public.nk_valid_roles(account_roles)) not valid;

create or replace function public.profiles_sync_roles()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_rpc boolean := coalesce(current_setting('nyumba254.account_type_rpc', true), '') = '1';
  v_single text[] := array['owner','caretaker','agent','company'];
begin
  if tg_op = 'INSERT' then
    if coalesce(cardinality(new.account_roles), 0) > 0
       and auth.uid() is not null and not public.is_admin() and not v_rpc then
      raise exception 'Account roles must use the account setup flow';
    end if;
    if coalesce(cardinality(new.account_roles), 0) = 0 and new.account_type = any (v_single) then
      new.account_roles := array[new.account_type];
    end if;
  elsif new.account_roles is distinct from old.account_roles then
    if auth.uid() is not null and not public.is_admin() and not v_rpc then
      raise exception 'Account roles must use the account setup flow';
    end if;
  elsif new.account_type is distinct from old.account_type then
    new.account_roles := case when new.account_type = any (v_single)
                              then array[new.account_type] else '{}'::text[] end;
    new.primary_role := null;
  end if;

  if not public.nk_valid_roles(new.account_roles) then
    raise exception 'Choose up to two roles; Agent and Company cannot be combined';
  end if;

  if cardinality(new.account_roles) > 0 then
    if new.primary_role is null or not (new.primary_role = any (new.account_roles)) then
      new.primary_role := new.account_roles[1];
    end if;
    new.account_type := new.primary_role;
  else
    new.primary_role := null;
    if tg_op = 'UPDATE' and new.account_roles is distinct from old.account_roles
       and old.account_type is not null then
      new.account_type := 'buyer';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists a_profiles_sync_roles on public.profiles;
create trigger a_profiles_sync_roles
  before insert or update on public.profiles
  for each row execute function public.profiles_sync_roles();

-- Backfill (runs with auth.uid() null, so the guard passes).
update public.profiles
set account_roles = array[account_type]
where account_type in ('owner','caretaker','agent','company')
  and coalesce(cardinality(account_roles), 0) = 0;
update public.profiles set primary_role = account_roles[1]
where cardinality(account_roles) > 0 and primary_role is null;

create or replace function public.clear_default_viewing_fee_on_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.account_roles is distinct from old.account_roles
      or new.account_type is distinct from old.account_type)
     and not (new.account_roles && array['agent','company']::text[]) then
    new.default_viewing_fee := null;
  end if;
  return new;
end;
$$;

create or replace function public.set_account_roles(p_roles text[])
returns table(account_roles text[], primary_role text, account_type text, onboarding_completed boolean)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_roles text[];
  p public.profiles%rowtype;
  v_changed boolean;
  v_correction boolean := false;
  v_primary text;
begin
  if v_uid is null then raise exception 'Authentication is required'; end if;
  select coalesce(array_agg(r order by ord), '{}') into v_roles
  from (select r, min(ord) ord
        from unnest(coalesce(p_roles, '{}')) with ordinality t(r, ord)
        where r is not null and r <> 'buyer' group by r) x;
  if not public.nk_valid_roles(v_roles) then
    raise exception 'Choose up to two roles; Agent and Company cannot be combined';
  end if;

  select * into p from public.profiles where id = v_uid for update;
  if not found then raise exception 'Profile not found'; end if;
  if p.is_disabled then raise exception 'Disabled accounts cannot change account type'; end if;

  v_changed := not (v_roles <@ p.account_roles and p.account_roles <@ v_roles)
               or (cardinality(v_roles) = 0 and p.account_type is distinct from 'buyer');
  if v_changed and p.role is distinct from 'admin' then
    if p.account_type_cooldown_until is not null and p.account_type_cooldown_until > now() then
      raise exception 'Account type can be changed again after %',
        to_char(p.account_type_cooldown_until at time zone 'Africa/Nairobi', 'DD/MM/YYYY');
    end if;
    v_correction := p.account_type_first_set_at is not null
      and not coalesce(p.account_type_correction_used, false)
      and now() <= p.account_type_first_set_at + interval '24 hours'
      and p.account_type_cooldown_until is null;
  end if;

  v_primary := case when p.primary_role = any (v_roles) then p.primary_role else v_roles[1] end;

  if v_changed then
    insert into public.role_history
      (profile_id, previous_account_type, new_account_type, roles_before, roles_after)
    values (v_uid, p.account_type, coalesce(v_primary, 'buyer'), p.account_roles, v_roles);
  end if;

  perform set_config('nyumba254.account_type_rpc', '1', true);
  update public.profiles q
  set account_roles = v_roles,
      primary_role = v_primary,
      account_type = coalesce(v_primary, 'buyer'),
      account_type_first_set_at = coalesce(q.account_type_first_set_at, now()),
      account_type_correction_used = case when v_correction then true else q.account_type_correction_used end,
      account_type_cooldown_until = case
        when v_changed and q.account_type_first_set_at is not null then now() + interval '7 days'
        when v_changed then null
        else q.account_type_cooldown_until end,
      account_type_set_at = case when v_changed then now() else coalesce(q.account_type_set_at, now()) end,
      onboarding_completed = true,
      verified_role = case when q.verified_role = any (v_roles) then q.verified_role else null end
  where q.id = v_uid;

  if p.account_roles && array['agent','company']::text[]
     and not (v_roles && array['agent','company']::text[]) then
    insert into public.viewing_fee_history (object_type, object_id, changed_by, old_fee, new_fee)
    select 'listing', f.listing_id, v_uid, f.viewing_fee, 0
    from public.listing_viewing_fees f join public.listings l on l.id = f.listing_id
    where l.seller_id = v_uid and f.viewing_fee > 0;
    delete from public.listing_viewing_fees f using public.listings l
    where f.listing_id = l.id and l.seller_id = v_uid;
  end if;

  return query
  select q.account_roles, q.primary_role, q.account_type, q.onboarding_completed
  from public.profiles q where q.id = v_uid;
end;
$$;
grant execute on function public.set_account_roles(text[]) to authenticated;

create or replace function public.can_set_viewing_fee(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p
    where p.id = p_profile_id and p.is_disabled is not true
      and p.account_roles && array['agent','company']::text[]);
$$;

create or replace function public.viewing_fee_lister_can_charge(p_profile_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id
      and p.account_roles && array['agent','company']::text[]
      and p.viewing_fee_blocked is not true
      and p.is_disabled is not true
      and p.viewing_fee_policy_version = public.current_viewing_fee_policy_version()
      and p.viewing_fee_policy_accepted_at is not null
      and (not coalesce((select (s.value #>> '{}')::boolean from public.platform_settings s
                         where s.key = 'viewing_fee_requires_identity'), true)
           or p.verification_status = 'verified'));
$$;

-- Role a listing is posted as: the chosen role when the poster holds it, else primary.
create or replace function public.listing_poster_role(p_profile uuid, p_post_as text)
returns text language sql stable security definer set search_path = public as $$
  select coalesce(
    case when p_post_as is not null and p_post_as = any (p.account_roles) then p_post_as end,
    p.primary_role,
    p.account_type,
    case when p.created_at < (select s.legacy_cutoff from public.account_type_migration_state s
                              where s.singleton) then 'seller' end)
  from public.profiles p where p.id = p_profile;
$$;

alter table public.listings add column if not exists post_as_role text;
alter table public.listings drop constraint if exists listings_post_as_role_check;
alter table public.listings add constraint listings_post_as_role_check
  check (post_as_role is null or post_as_role in ('owner','caretaker','agent','company'));

create or replace function public.set_listing_account_type_snapshot()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_owner_id uuid;
  v_role text;
begin
  if tg_op = 'INSERT' then
    v_owner_id := public.effective_seller_id();
    if auth.uid() is not null and not public.is_admin()
       and new.seller_id is distinct from v_owner_id then
      raise exception 'Listings must be created for the signed-in account or its active team owner';
    end if;
    if new.seller_id is not null then
      v_role := public.listing_poster_role(new.seller_id, new.post_as_role);
      if new.category = 'airbnb' and v_role is not null and v_role not in ('owner','company','seller') then
        raise exception 'AIRBNB_ROLE_NOT_ALLOWED';
      end if;
    end if;
    if new.status in ('active', 'occupied') then
      if new.seller_id is not null and not public.can_create_listing(new.seller_id) then
        raise exception 'ACCOUNT_TYPE_CANNOT_LIST';
      end if;
      new.listed_by_type := v_role;
    else
      new.listed_by_type := null;
    end if;
  else
    if new.seller_id is distinct from old.seller_id then
      raise exception 'The listing owner cannot be changed';
    end if;
    if new.post_as_role is distinct from old.post_as_role
       and old.listed_by_type is not null then
      raise exception 'The listing account-type snapshot cannot be changed';
    end if;
    if new.listed_by_type is distinct from old.listed_by_type
       and (old.listed_by_type is not null
            or (new.status is distinct from 'active' and new.status is distinct from 'occupied')
            or old.status in ('active', 'occupied')) then
      raise exception 'The listing account-type snapshot cannot be changed';
    end if;
    if new.status in ('active', 'occupied')
       and old.status is distinct from 'active' and old.status is distinct from 'occupied' then
      if new.seller_id is not null and not public.can_create_listing(new.seller_id) then
        raise exception 'ACCOUNT_TYPE_CANNOT_LIST';
      end if;
      if old.listed_by_type is null then
        v_role := public.listing_poster_role(new.seller_id, new.post_as_role);
        if new.category = 'airbnb' and v_role is not null and v_role not in ('owner','company','seller') then
          raise exception 'AIRBNB_ROLE_NOT_ALLOWED';
        end if;
        new.listed_by_type := v_role;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Existing mismatched Airbnb listings keep running; flag them for review.
insert into public.risk_signals (subject_type, subject_id, signal_code, severity, source, details, status, dedupe_key)
select 'listing', l.id::text, 'airbnb_role_mismatch', 'low', 'migration_20261022',
       jsonb_build_object('listed_by_type', l.listed_by_type), 'open', 'airbnb_role_mismatch:' || l.id
from public.listings l
where l.category = 'airbnb' and coalesce(l.listed_by_type, '') in ('agent','caretaker')
on conflict do nothing;

-- ───────────── 2. Pricing settings ─────────────
insert into public.platform_settings (key, value) values
  ('premium_owner_monthly_price', '499'), ('premium_owner_yearly_price', '4990'),
  ('elite_owner_monthly_price', '1199'), ('elite_owner_yearly_price', '11990'),
  ('premium_caretaker_monthly_price', '299'), ('premium_caretaker_yearly_price', '2990'),
  ('elite_caretaker_monthly_price', '699'), ('elite_caretaker_yearly_price', '6990'),
  ('premium_agent_monthly_price', '999'), ('premium_agent_yearly_price', '9990'),
  ('elite_agent_monthly_price', '2499'), ('elite_agent_yearly_price', '24990'),
  ('premium_company_monthly_price', '2999'), ('premium_company_yearly_price', '29990'),
  ('elite_company_monthly_price', '6999'), ('elite_company_yearly_price', '69990'),
  ('bnb_basic_owner_price', '700'), ('bnb_bundle_owner_price', '2000'),
  ('bnb_basic_company_price', '1000'), ('bnb_bundle_company_price', '3000'),
  ('listing_fee_multiplier_owner', '1'), ('listing_fee_multiplier_caretaker', '0.7'),
  ('listing_fee_multiplier_agent', '1.5'), ('listing_fee_multiplier_company', '2'),
  ('team_seats_elite_company', '5'), ('team_seats_elite_agent', '3'),
  ('team_seats_elite_owner', '1'), ('team_seats_elite_caretaker', '0'),
  ('paid_plans_open', '0'), ('featured_upgrade_min_fee', '300'),
  ('premium_active_listing_cap', '0'),
  ('viewing_secure_confirm_days', '7'),
  ('terms_response_retention_days', '180'),
  ('lister_terms_enabled_roles', '"agent,company"')
on conflict (key) do nothing;

create table if not exists public.pricing_change_log (
  id uuid primary key default gen_random_uuid(),
  changed_by uuid references auth.users(id) on delete set null,
  changed_at timestamptz not null default now(),
  changes jsonb not null default '[]',
  note text,
  notify_batch_id uuid,
  audience jsonb,
  notified_count integer default 0,
  failed_count integer default 0
);
alter table public.pricing_change_log enable row level security;
drop policy if exists pricing_change_log_admin on public.pricing_change_log;
create policy pricing_change_log_admin on public.pricing_change_log
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.nk_setting_num(p_key text)
returns numeric language sql stable security definer set search_path = public as $$
  select case when jsonb_typeof(value) in ('number','string')
              and (value #>> '{}') ~ '^-?[0-9]+(\.[0-9]+)?$'
              then (value #>> '{}')::numeric end
  from public.platform_settings where key = p_key;
$$;

create or replace function public.plan_price(p_role text, p_tier text, p_period text)
returns integer language sql stable security definer set search_path = public as $$
  select round(coalesce(
    public.nk_setting_num(p_tier || '_' || p_role || '_' || p_period || '_price'),
    public.nk_setting_num(p_tier || '_' || p_period || '_price')))::integer;
$$;

create or replace function public.resolve_pricing_role(p_roles text[])
returns text language sql stable security definer set search_path = public as $$
  select r from unnest(coalesce(p_roles, '{}')) with ordinality t(r, ord)
  order by coalesce(public.plan_price(r, 'elite', 'monthly'), 0) desc, ord asc
  limit 1;
$$;

create or replace function public.nk_pricing_json(p_role text, p_roles text[])
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v jsonb;
  t text; per text;
  plans jsonb := '{}';
  m int; y int;
begin
  if p_role is null then
    p_role := null;
  end if;
  foreach t in array array['premium','elite'] loop
    m := public.plan_price(p_role, t, 'monthly');
    y := public.plan_price(p_role, t, 'yearly');
    plans := plans || jsonb_build_object(t, jsonb_build_object(
      'monthly', m, 'yearly', y,
      'yearly_saving_pct', case when m > 0 and y is not null then round(100.0 * (1 - y::numeric / (m * 12))) end));
  end loop;
  v := jsonb_build_object(
    'role', p_role,
    'roles', to_jsonb(coalesce(p_roles, '{}')),
    'plans', plans,
    'bnb', jsonb_build_object(
      'allowed', p_roles && array['owner','company']::text[] or p_role in ('owner','company'),
      'basic', coalesce(public.nk_setting_num('bnb_basic_' || p_role || '_price'), case when p_role in ('owner','company') then public.nk_setting_num('bnb_basic_price') end),
      'bundle', coalesce(public.nk_setting_num('bnb_bundle_' || p_role || '_price'), case when p_role in ('owner','company') then public.nk_setting_num('bnb_bundle_price') end)),
    'listing_fee_multiplier', coalesce(public.nk_setting_num('listing_fee_multiplier_' || p_role), 1),
    'seats', jsonb_build_object('elite', coalesce(public.nk_setting_num('team_seats_elite_' || p_role), 0)),
    'paid_plans_open', coalesce(public.nk_setting_num('paid_plans_open'), 0) = 1,
    'featured_upgrade_min_fee', coalesce(public.nk_setting_num('featured_upgrade_min_fee'), 300));
  return v;
end;
$$;

create or replace function public.get_my_pricing()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare p public.profiles%rowtype; v_role text;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found or cardinality(p.account_roles) = 0 then
    return public.nk_pricing_json(null, '{}') || jsonb_build_object('needs_setup', true);
  end if;
  v_role := public.resolve_pricing_role(p.account_roles);
  return public.nk_pricing_json(v_role, p.account_roles) || jsonb_build_object('needs_setup', false);
end;
$$;

create or replace function public.get_public_pricing(p_role text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if p_role is null or p_role not in ('owner','caretaker','agent','company') then
    raise exception 'Choose a supported role';
  end if;
  return public.nk_pricing_json(p_role, array[p_role]);
end;
$$;
grant execute on function public.get_my_pricing() to authenticated;
grant execute on function public.get_public_pricing(text) to anon, authenticated;

-- ───────────── 3. Payments validation ─────────────
alter table public.payments add column if not exists billing_period text;
alter table public.payments add column if not exists pricing_role text;
alter table public.payments add column if not exists expected_amount integer;
alter table public.payments add column if not exists price_snapshot jsonb;

create or replace function public.validate_subscription_payment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_roles text[];
  v_tier text;
  v_expected integer;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.type in ('premium_subscription', 'elite_subscription') then
    v_tier := replace(new.type, '_subscription', '');
    if coalesce(public.nk_setting_num('paid_plans_open'), 0) <> 1 then
      raise exception 'PAID_PLANS_CLOSED';
    end if;
    select account_roles into v_roles from public.profiles where id = new.seller_id;
    if coalesce(cardinality(v_roles), 0) = 0 then raise exception 'PROFILE_SETUP_REQUIRED'; end if;
    new.pricing_role := coalesce(new.pricing_role, public.resolve_pricing_role(v_roles));
    if not (new.pricing_role = any (v_roles)) then raise exception 'PRICING_ROLE_NOT_HELD'; end if;
    if new.billing_period is null or new.billing_period not in ('monthly', 'yearly') then
      raise exception 'BILLING_PERIOD_REQUIRED';
    end if;
    v_expected := public.plan_price(new.pricing_role, v_tier, new.billing_period);
    if v_expected is null or new.amount is distinct from v_expected then
      raise exception 'PRICE_MISMATCH: expected %', v_expected;
    end if;
    new.expected_amount := v_expected;
    new.price_snapshot := coalesce(new.price_snapshot, '{}'::jsonb) || jsonb_build_object(
      'role', new.pricing_role, 'tier', v_tier, 'period', new.billing_period,
      'price', v_expected, 'at', now());
  elsif new.type = 'bnb_subscription' then
    select account_roles into v_roles from public.profiles where id = new.seller_id;
    if not (coalesce(v_roles, '{}') && array['owner','company']::text[]) then
      raise exception 'AIRBNB_ROLE_NOT_ALLOWED';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists a_validate_subscription_payment on public.payments;
create trigger a_validate_subscription_payment
  before insert on public.payments
  for each row execute function public.validate_subscription_payment();

-- ───────────── 4. Plan coverage ─────────────
alter table public.listings add column if not exists covered_by_plan boolean not null default false;
alter table public.listings add column if not exists coverage_plan_key text;
alter table public.listings add column if not exists covered_at timestamptz;

create or replace function public.listing_coverage(p_seller uuid, p_category text, p_exclude uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare
  p public.profiles%rowtype;
  v_live boolean; v_cap integer; v_n integer; v_tier text;
begin
  select * into p from public.profiles where id = p_seller;
  if not found then return null; end if;
  v_live := p.subscription_tier is not null and p.subscription_tier <> 'none'
            and (p.subscription_expires_at is null or p.subscription_expires_at > now());
  if p_category = 'airbnb' then
    if p.has_bnb_capacity and p.bnb_expires_at > now() then return 'bnb';
    elsif v_live and p.subscription_plan = 'elite' then return 'elite';
    end if;
    return null;
  end if;
  if not (v_live and p.has_rental_capacity) then return null; end if;
  v_tier := coalesce(p.subscription_plan, 'premium');
  v_cap := coalesce(public.nk_setting_num('premium_active_listing_cap'), 0)::integer;
  if v_tier = 'premium' and v_cap > 0 then
    select count(*) into v_n from public.listings
    where seller_id = p_seller and covered_by_plan and status = 'active'
      and (p_exclude is null or id <> p_exclude);
    if v_n >= v_cap then return null; end if;
  end if;
  return v_tier;
end;
$$;

create or replace function public.set_listing_coverage()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_key text;
begin
  if tg_op = 'UPDATE' and new.covered_by_plan and new.status in ('active','scheduled','approved_unpaid','approved_unpaid_bnb')
     and old.status = new.status and old.seller_id = new.seller_id then
    return new;
  end if;
  if new.seller_id is null or new.status in ('rejected','draft','sold','occupied') then
    return new;
  end if;
  v_key := public.listing_coverage(new.seller_id, new.category, new.id);
  if v_key is not null then
    new.covered_by_plan := true;
    new.coverage_plan_key := v_key;
    new.covered_at := coalesce(new.covered_at, now());
  elsif tg_op = 'UPDATE' and new.status in ('approved_unpaid','approved_unpaid_bnb') then
    new.covered_by_plan := false; new.coverage_plan_key := null;
  end if;
  return new;
end;
$$;
drop trigger if exists b_set_listing_coverage on public.listings;
create trigger b_set_listing_coverage
  before insert or update of status on public.listings
  for each row execute function public.set_listing_coverage();

-- Backfill live coverage for listings of currently subscribed sellers.
update public.listings l
set covered_by_plan = true, coverage_plan_key = c.k, covered_at = now()
from (select l2.id, public.listing_coverage(l2.seller_id, l2.category) k
      from public.listings l2
      where l2.status in ('active','approved_unpaid','approved_unpaid_bnb','scheduled')
        and l2.seller_id is not null) c
where l.id = c.id and c.k is not null and l.covered_by_plan = false;
