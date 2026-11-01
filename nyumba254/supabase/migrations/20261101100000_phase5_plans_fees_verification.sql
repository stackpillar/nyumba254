-- Phase 5: three plans, flat listing prices with a mode switch, plan unlock matrix,
-- working verification master switch. Additive and idempotent. See the rollback section at the end.
begin;

-- ───────────── 1. Boolean parsing (one helper, used everywhere) ─────────────
create or replace function public.nk_truthy(p jsonb)
returns boolean language sql immutable set search_path = public as $$
  select case jsonb_typeof(p)
    when 'boolean' then (p #>> '{}')::boolean
    when 'number'  then (p #>> '{}')::numeric <> 0
    when 'string'  then lower(btrim(p #>> '{}')) in ('1','true','t','yes','on')
    else false end
$$;

create or replace function public.nk_setting_bool(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select public.nk_truthy(s.value) from public.platform_settings s where s.key = p_key), false)
$$;

-- ───────────── 2. Verification policy ─────────────
-- Master OFF: nothing requires identity, except accounts an admin explicitly forced.
create or replace function public.requires_identity(p_feature text, p_profile uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v_key text; v_master boolean; v_forced boolean := false;
begin
  v_key := case p_feature
    when 'general' then null
    when 'viewing_fee' then 'viewing_fee_requires_identity'
    when 'allowance_over_10' then 'allowance_over_10_requires_identity'
    when 'boost' then 'boost_requires_identity'
    else 'unknown' end;
  if v_key = 'unknown' then raise exception 'Unknown identity-gated feature'; end if;
  v_master := public.nk_setting_bool('enforce_verification_general');
  if p_profile is not null then
    select coalesce(p.verification_enforced, false) into v_forced from public.profiles p where p.id = p_profile;
  end if;
  if not (v_master or coalesce(v_forced, false)) then return false; end if;
  if v_key is null then return true; end if;
  return public.nk_setting_bool(v_key);
end;
$$;

create or replace function public.requires_identity(p_feature text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.requires_identity(p_feature, auth.uid())
$$;

create or replace function public.get_effective_verification_policy()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_master boolean; v_forced boolean := false; v_status text; v_limit integer;
begin
  v_master := public.nk_setting_bool('enforce_verification_general');
  select coalesce(verification_enforced, false), coalesce(verification_status, 'unverified')
    into v_forced, v_status from public.profiles where id = auth.uid();
  v_limit := coalesce(public.nk_setting_num('unverified_listing_limit'), 2)::integer;
  return jsonb_build_object(
    'master', v_master,
    'forced', coalesce(v_forced, false),
    'required', (v_master or coalesce(v_forced, false)),
    'verified', v_status = 'verified',
    'listing_limit', case when (v_master or coalesce(v_forced, false)) and v_status <> 'verified' then v_limit else null end,
    'viewing_fee_requires_identity', public.requires_identity('viewing_fee', auth.uid()),
    'allowance_over_10_requires_identity', public.requires_identity('allowance_over_10', auth.uid()),
    'boost_requires_identity', public.requires_identity('boost', auth.uid()));
end;
$$;
grant execute on function public.get_effective_verification_policy() to anon, authenticated;

create or replace function public.enforce_listing_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_status text; v_disabled boolean; v_count integer; v_limit_text text; v_limit integer;
begin
  if new.status is distinct from 'active' or new.recycle_bin is true then return new; end if;
  select p.verification_status, p.is_disabled into v_status, v_disabled
  from public.profiles p where p.id = new.seller_id for update;
  if not found or v_disabled then raise exception 'LISTING_ACCOUNT_UNAVAILABLE'; end if;
  if coalesce(v_status, 'unverified') <> 'verified'
     and public.requires_identity('general', new.seller_id) then
    select s.value #>> '{}' into v_limit_text from public.platform_settings s where s.key = 'unverified_listing_limit';
    if not found or v_limit_text !~ '^[0-9]+$' then raise exception 'LISTING_LIMIT_CONFIGURATION_INVALID'; end if;
    v_limit := v_limit_text::integer;
    if public.requires_identity('allowance_over_10', new.seller_id) and v_limit > 10 then v_limit := 10; end if;
    select count(*)::integer into v_count from public.listings l
    where l.seller_id = new.seller_id and l.status = 'active' and l.recycle_bin is not true
      and l.id is distinct from new.id;
    if v_count >= v_limit then raise exception 'LISTING_LIMIT_REACHED'; end if;
  end if;
  return new;
end;
$$;

-- ───────────── 3. Flat listing prices ─────────────
insert into public.platform_settings (key, value) values
  ('listing_fee_mode', '"single"'::jsonb),
  ('listing_fee_single', '1000'::jsonb),
  ('listing_fee_apartment', '1000'::jsonb),
  ('listing_fee_house', '1000'::jsonb),
  ('listing_fee_boarding', '1000'::jsonb),
  ('listing_fee_airbnb', '1000'::jsonb),
  ('listing_fee_commercial', '1000'::jsonb),
  ('featured_fee_single', '500'::jsonb),
  ('featured_fee_apartment', '500'::jsonb),
  ('featured_fee_house', '500'::jsonb),
  ('featured_fee_boarding', '500'::jsonb),
  ('featured_fee_airbnb', '500'::jsonb),
  ('featured_fee_commercial', '500'::jsonb),
  ('featured_discount_premium', '25'::jsonb),
  ('featured_discount_elite', '50'::jsonb),
  ('elite_fair_use_cap', '200'::jsonb)
on conflict (key) do nothing;

-- Fee settings must be integers from 0 to 500,000; the mode must be single or per_category.
create or replace function public.validate_fee_settings()
returns trigger language plpgsql set search_path = public as $$
declare v text := new.value #>> '{}';
begin
  if new.key = 'listing_fee_mode' then
    if v not in ('single', 'per_category') then raise exception 'INVALID_FEE_MODE'; end if;
  elsif new.key ~ '^(listing_fee|featured_fee)_(single|apartment|house|boarding|airbnb|commercial)$' then
    if v is null or v = '' then
      if new.key !~ '_single$' then return new; end if;
      raise exception 'INVALID_FEE_VALUE';
    end if;
    if v !~ '^[0-9]+$' or v::numeric > 500000 then raise exception 'INVALID_FEE_VALUE'; end if;
  elsif new.key ~ '^featured_discount_(premium|elite)$' then
    if v !~ '^[0-9]+$' or v::integer > 100 then raise exception 'INVALID_DISCOUNT'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists a_validate_fee_settings on public.platform_settings;
create trigger a_validate_fee_settings before insert or update on public.platform_settings
  for each row execute function public.validate_fee_settings();

-- The only place a listing price is computed. Sale and rent share the category price.
create or replace function public.calc_listing_fee(p_category text, p_featured boolean default false)
returns integer language plpgsql stable security definer set search_path = public as $$
declare
  v_pre text := case when p_featured then 'featured_fee_' else 'listing_fee_' end;
  v_mode text; v_single numeric; v_cat numeric;
begin
  select s.value #>> '{}' into v_mode from public.platform_settings s where s.key = 'listing_fee_mode';
  v_single := coalesce(public.nk_setting_num(v_pre || 'single'), 0);
  if coalesce(v_mode, 'single') = 'per_category' and p_category in ('apartment','house','boarding','airbnb','commercial') then
    v_cat := public.nk_setting_num(v_pre || p_category);
    return greatest(0, round(coalesce(v_cat, v_single)))::integer;
  end if;
  return greatest(0, round(v_single))::integer;
end;
$$;
grant execute on function public.calc_listing_fee(text, boolean) to anon, authenticated;

-- ───────────── 4. Plan unlock matrix ─────────────
create table if not exists public.plan_unlocks (
  feature_key text primary key,
  label text not null,
  kind text not null check (kind in ('bool','number','text')),
  free_value jsonb not null default 'false'::jsonb,
  premium_value jsonb not null default 'false'::jsonb,
  elite_value jsonb not null default 'false'::jsonb,
  sort integer not null default 100,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table public.plan_unlocks enable row level security;
drop policy if exists plan_unlocks_read on public.plan_unlocks;
create policy plan_unlocks_read on public.plan_unlocks for select to anon, authenticated using (true);
drop policy if exists plan_unlocks_admin_write on public.plan_unlocks;
create policy plan_unlocks_admin_write on public.plan_unlocks for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

insert into public.plan_unlocks (feature_key, label, kind, free_value, premium_value, elite_value, sort) values
  ('listing_cover_cap',   'Active listings with fees covered', 'number', '0', '10', '200', 10),
  ('video_slots',         'Video walkthroughs per listing',    'number', '1', '5', '5', 20),
  ('managed_chat',        'Managed chat',                      'bool', 'false', 'true', 'true', 30),
  ('pro_badge',           'Pro lister badge',                  'bool', 'false', 'true', 'true', 31),
  ('scheduled_publishing','Scheduled publishing',              'bool', 'false', 'true', 'true', 32),
  ('printable_brochure',  'Printable brochure',                'bool', 'false', 'true', 'true', 33),
  ('sms_enquiry_alerts',  'SMS enquiry alerts',                'bool', 'false', 'true', 'true', 34),
  ('search_match_alerts', 'Buyer search-match alerts',         'bool', 'false', 'true', 'true', 35),
  ('local_price_insights','Local price insights',              'bool', 'false', 'true', 'true', 36),
  ('priority_support',    'Priority support',                  'bool', 'false', 'true', 'true', 37),
  ('lister_page_pro',     'Lister Page Pro (pinned listings, 12-month analytics, accent and banner, lead inbox)', 'bool', 'false', 'true', 'true', 38),
  ('ai_listing_assistant','AI Listing Assistant',              'bool', 'false', 'false', 'true', 50),
  ('instant_valuation',   'Instant Valuation',                 'bool', 'false', 'false', 'true', 51),
  ('rent_tenant_ledger',  'Rent & Tenant Ledger',              'bool', 'false', 'false', 'true', 52),
  ('bnb_ledger_tools',    'Holiday-rental ledger and bookings','bool', 'false', 'false', 'true', 53),
  ('demand_insights',     'Demand Insights',                   'bool', 'false', 'false', 'true', 54),
  ('weekly_demand_digest','Weekly demand digest',              'bool', 'false', 'false', 'true', 55),
  ('ai_chat_concierge',   '24/7 AI chat concierge',            'bool', 'false', 'false', 'true', 56),
  ('team_seats',          'Team seats on the Lister Page',     'bool', 'false', 'false', 'true', 57),
  ('relationship_manager','Relationship manager',              'bool', 'false', 'false', 'true', 58)
on conflict (feature_key) do nothing;

create or replace function public.nk_plan_of(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p.subscription_tier is null or p.subscription_tier = 'none' then 'free'
    when p.subscription_expires_at is not null and p.subscription_expires_at <= now() then 'free'
    when p.subscription_plan = 'elite' then 'elite'
    else 'premium' end
  from public.profiles p where p.id = p_user
$$;

create or replace function public.nk_plan_unlock(p_plan text, p_key text)
returns jsonb language sql stable security definer set search_path = public as $$
  select case p_plan when 'elite' then elite_value when 'premium' then premium_value else free_value end
  from public.plan_unlocks where feature_key = p_key and active
$$;

-- Effective unlocks for the caller (or a given user when called as admin). Team members use their owner's plan.
create or replace function public.get_entitlements(p_user uuid default null)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_user uuid := coalesce(p_user, auth.uid()); v_owner uuid; v_plan text;
begin
  if v_user is null then v_plan := 'free';
  else
    if p_user is not null and p_user is distinct from auth.uid() and not public.is_admin() then
      raise exception 'FORBIDDEN';
    end if;
    select t.owner_id into v_owner from public.team_members t
      where t.member_id = v_user and t.status = 'active' limit 1;
    v_plan := public.nk_plan_of(coalesce(v_owner, v_user));
  end if;
  return jsonb_build_object('plan', v_plan,
    'unlocks', coalesce((select jsonb_object_agg(u.feature_key,
        case v_plan when 'elite' then u.elite_value when 'premium' then u.premium_value else u.free_value end)
      from public.plan_unlocks u where u.active), '{}'::jsonb));
end;
$$;
grant execute on function public.get_entitlements(uuid) to authenticated;

-- Public matrix for /plans (no user data).
create or replace function public.get_public_plan_matrix()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('key', feature_key, 'label', label, 'kind', kind,
    'free', free_value, 'premium', premium_value, 'elite', elite_value) order by sort), '[]'::jsonb)
  from public.plan_unlocks where active
$$;
grant execute on function public.get_public_plan_matrix() to anon, authenticated;

-- Atomic, audited matrix save for admins.
create or replace function public.admin_save_plan_unlocks(p_rows jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    update public.plan_unlocks set
      free_value = coalesce(r->'free', free_value),
      premium_value = coalesce(r->'premium', premium_value),
      elite_value = coalesce(r->'elite', elite_value),
      updated_at = now()
    where feature_key = r->>'key';
  end loop;
  insert into public.admin_logs (admin_id, action, details)
  values (auth.uid(), 'plan_unlocks_saved', jsonb_build_object('rows', p_rows));
end;
$$;
grant execute on function public.admin_save_plan_unlocks(jsonb) to authenticated;

-- Coverage now follows the matrix: every category, Premium and Elite caps from plan_unlocks. No BNB plan branch.
create or replace function public.listing_coverage(p_seller uuid, p_category text, p_exclude uuid default null)
returns text language plpgsql stable security definer set search_path = public as $$
declare v_plan text; v_cap integer; v_n integer; p public.profiles%rowtype;
begin
  select * into p from public.profiles where id = p_seller;
  if not found then return null; end if;
  v_plan := public.nk_plan_of(p_seller);
  if v_plan = 'free' then return null; end if;
  v_cap := coalesce((public.nk_plan_unlock(v_plan, 'listing_cover_cap') #>> '{}')::integer, 0);
  if v_plan = 'elite' then v_cap := least(v_cap, coalesce(public.nk_setting_num('elite_fair_use_cap'), 200)::integer); end if;
  if v_cap <= 0 then return null; end if;
  select count(*) into v_n from public.listings
  where seller_id = p_seller and covered_by_plan and status = 'active' and (p_exclude is null or id <> p_exclude);
  if v_n >= v_cap then return null; end if;
  return v_plan;
end;
$$;

create or replace function public.enforce_listing_video_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_seller uuid; v_blocked boolean; v_disabled boolean; v_limit integer; v_count integer;
begin
  if tg_op = 'UPDATE' and new.listing_id is not distinct from old.listing_id then return new; end if;
  if new.listing_id is null then raise exception 'VIDEO_LISTING_REQUIRED'; end if;
  if auth.uid() is null and coalesce(auth.role(), '') <> 'service_role' then raise exception 'VIDEO_AUTH_REQUIRED'; end if;
  select l.seller_id into v_seller from public.listings l where l.id = new.listing_id;
  if not found or v_seller is null then raise exception 'VIDEO_LISTING_NOT_FOUND'; end if;
  if auth.uid() is not null and not public.is_admin() and v_seller is distinct from public.effective_seller_id() then
    raise exception 'VIDEO_LISTING_ACCESS_DENIED';
  end if;
  if auth.uid() is not null and public.is_admin() then return new; end if;
  select p.video_walkthrough_blocked, p.is_disabled into v_blocked, v_disabled
  from public.profiles p where p.id = v_seller for update;
  if not found or v_disabled then raise exception 'VIDEO_ACCOUNT_UNAVAILABLE'; end if;
  if v_blocked then raise exception 'VIDEO_WALKTHROUGH_BLOCKED'; end if;
  v_limit := coalesce((public.nk_plan_unlock(public.nk_plan_of(v_seller), 'video_slots') #>> '{}')::integer, 1);
  select count(*) into v_count from public.listing_videos v
  where v.listing_id = new.listing_id and v.id is distinct from new.id;
  if v_count >= v_limit then raise exception 'VIDEO_LIMIT_REACHED'; end if;
  return new;
end;
$$;

-- ───────────── 5. BNB plans retired ─────────────
-- Non-admin BNB plan purchases are refused; legacy payment rows stay readable.
create or replace function public.block_bnb_plan_purchase()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'bnb_subscription' and auth.uid() is not null and not public.is_admin() then
    raise exception 'BNB_PLANS_RETIRED';
  end if;
  return new;
end;
$$;
drop trigger if exists a0_block_bnb_plan_purchase on public.payments;
create trigger a0_block_bnb_plan_purchase before insert on public.payments
  for each row execute function public.block_bnb_plan_purchase();

update public.listings set status = 'approved_unpaid' where status = 'approved_unpaid_bnb';

-- Active BNB subscribers keep their capacity as Premium until their old expiry.
update public.profiles
set subscription_tier = 'monthly', subscription_plan = 'premium', has_rental_capacity = true,
    subscription_started_at = coalesce(subscription_started_at, now()),
    subscription_expires_at = bnb_expires_at
where has_bnb_capacity and bnb_expires_at > now()
  and (subscription_tier is null or subscription_tier = 'none'
       or subscription_expires_at is null or subscription_expires_at < bnb_expires_at);

commit;

-- ROLLBACK (manual, run only if needed; nothing above deletes data):
-- drop trigger if exists a0_block_bnb_plan_purchase on public.payments;
-- drop trigger if exists a_validate_fee_settings on public.platform_settings;
-- then re-apply the previous definitions of enforce_listing_limit, requires_identity(text),
-- listing_coverage and enforce_listing_video_limit from migrations 20261022100000 and earlier.
