begin;

alter table public.profiles
  add column if not exists handle text,
  add column if not exists handle_changed_at timestamptz,
  add column if not exists lister_page_visibility text not null default 'public'
    check (lister_page_visibility in ('public', 'unlisted', 'hidden')),
  add column if not exists viewing_auto_confirm boolean not null default false,
  add column if not exists viewing_min_notice_hours smallint not null default 12
    check (viewing_min_notice_hours between 0 and 720),
  add column if not exists viewing_max_days_ahead smallint not null default 30
    check (viewing_max_days_ahead between 1 and 180);

create unique index if not exists profiles_handle_lower_unique
  on public.profiles (lower(handle))
  where handle is not null;

insert into public.platform_settings (key, value)
values
  ('lister_pages_enabled', 'false'::jsonb),
  ('lister_availability_enabled', 'false'::jsonb),
  ('lister_quick_answers_enabled', 'false'::jsonb),
  ('lister_source_tracking_enabled', 'false'::jsonb)
on conflict (key) do nothing;

create table if not exists public.lister_handle_history (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  handle text not null,
  replaced_at timestamptz not null default now(),
  replaced_by text
);
create unique index if not exists lister_handle_history_lower_unique
  on public.lister_handle_history (lower(handle));
create index if not exists lister_handle_history_profile_idx
  on public.lister_handle_history (profile_id, replaced_at desc);
alter table public.lister_handle_history enable row level security;
revoke all on public.lister_handle_history from public, anon, authenticated;
grant select on public.lister_handle_history to authenticated;
drop policy if exists lister_handle_history_owner_read on public.lister_handle_history;
create policy lister_handle_history_owner_read on public.lister_handle_history
  for select to authenticated using (profile_id = auth.uid() or public.is_admin());

create or replace function public.protect_lister_handle()
returns trigger
language plpgsql
set search_path = public
as $function$
begin
  if (new.handle is distinct from old.handle
      or new.handle_changed_at is distinct from old.handle_changed_at)
     and current_user not in ('postgres', 'service_role') then
    raise exception 'Update your Lister Page handle using the handle settings.';
  end if;
  return new;
end;
$function$;
drop trigger if exists protect_lister_handle on public.profiles;
create trigger protect_lister_handle
  before update of handle, handle_changed_at on public.profiles
  for each row execute function public.protect_lister_handle();

create or replace function public.lister_handle_edit_distance(p_left text, p_right text)
returns integer
language plpgsql
immutable
strict
set search_path = public
as $function$
declare
  v_previous integer[];
  v_current integer[];
  v_i integer;
  v_j integer;
  v_cost integer;
begin
  v_previous := array_fill(0, array[length(p_right) + 1], array[0]);
  for v_j in 0..length(p_right) loop v_previous[v_j] := v_j; end loop;
  for v_i in 1..length(p_left) loop
    v_current := array_fill(0, array[length(p_right) + 1], array[0]);
    v_current[0] := v_i;
    for v_j in 1..length(p_right) loop
      v_cost := case when substr(p_left,v_i,1)=substr(p_right,v_j,1) then 0 else 1 end;
      v_current[v_j] := least(
        v_current[v_j-1] + 1,
        v_previous[v_j] + 1,
        v_previous[v_j-1] + v_cost
      );
    end loop;
    v_previous := v_current;
  end loop;
  return v_previous[length(p_right)];
end;
$function$;
revoke all on function public.lister_handle_edit_distance(text,text) from public;

do $backfill$
declare
  v_profile record;
  v_candidate text;
  v_normalized text;
begin
  for v_profile in
    select id, storefront_slug
    from public.profiles
    where handle is null
      and subscription_plan = 'elite'
      and coalesce(subscription_tier, 'none') <> 'none'
      and (subscription_expires_at is null or subscription_expires_at > now())
      and storefront_slug ~* '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$'
      and lower(storefront_slug) !~ '(nyumba254|official)'
      and lower(storefront_slug) not in (
        'admin','administrator','api','about','account','auth','contact','dashboard',
        'faq','help','how-it-works','inbox','listings','login','logout','plans',
        'post-listing','privacy','profile','register','reset-password','robots',
        'search','settings','sign-in','sitemap','support','terms','u','storefront'
      )
    order by id
  loop
    v_candidate := lower(v_profile.storefront_slug);
    v_normalized := translate(regexp_replace(v_candidate, '[^a-z0-9]', '', 'g'),'013457','oieast');
    if not exists (select 1 from public.profiles where lower(handle) = v_candidate)
       and not exists (select 1 from public.lister_handle_history where lower(handle) = v_candidate)
       and not exists (
         select 1 from public.company_profiles c
         join public.profiles p on p.id = c.profile_id
         where p.verified_role = 'company' and p.account_type = 'company'
           and p.id <> v_profile.id
           and length(regexp_replace(lower(c.company_name), '[^a-z0-9]', '', 'g')) >= 4
           and public.lister_handle_edit_distance(
             translate(regexp_replace(lower(c.company_name), '[^a-z0-9]', '', 'g'),'013457','oieast'),
             v_normalized
           ) <= 1
       ) then
      update public.profiles set handle = v_candidate
      where id = v_profile.id and handle is null;
    end if;
  end loop;
end;
$backfill$;

create or replace function public.set_lister_handle(p_handle text)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_profile public.profiles%rowtype;
  v_handle text := lower(btrim(coalesce(p_handle, '')));
  v_normalized text;
  v_company_match boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required';
  end if;
  if not exists (
    select 1 from public.platform_settings
    where key = 'lister_pages_enabled'
      and lower(trim(both '"' from value::text)) in ('true','1')
  ) then
    raise exception 'Lister Pages are not available yet.';
  end if;
  if v_handle !~ '^[a-z0-9][a-z0-9._-]{1,28}[a-z0-9]$' then
    raise exception 'Use 3–30 lowercase letters, numbers, dots, underscores or hyphens; start and end with a letter or number.';
  end if;
  if v_handle ~ '(nyumba254|official)' then
    raise exception 'That handle is reserved.';
  end if;
  if v_handle = any(array[
    'admin','administrator','api','about','account','auth','contact','dashboard',
    'faq','help','how-it-works','inbox','listings','login','logout','plans',
    'post-listing','privacy','profile','register','reset-password','robots',
    'search','settings','sign-in','sitemap','support','terms','u','storefront'
  ]) then
    raise exception 'That handle is reserved.';
  end if;

  select * into v_profile from public.profiles
  where id = public.effective_seller_id()
  for update;
  if not found then
    raise exception 'Lister profile not found.';
  end if;

  if v_profile.handle is not null and v_profile.handle <> v_handle
     and v_profile.handle_changed_at > now() - interval '30 days' then
    raise exception 'You can change your handle once every 30 days.';
  end if;

  v_normalized := translate(regexp_replace(v_handle, '[^a-z0-9]', '', 'g'),'013457','oieast');
  select exists (
    select 1
    from public.company_profiles c
    join public.profiles p on p.id = c.profile_id
    where p.verified_role = 'company'
      and p.account_type = 'company'
      and length(translate(regexp_replace(lower(c.company_name), '[^a-z0-9]', '', 'g'),'013457','oieast')) >= 4
      and public.lister_handle_edit_distance(
        translate(regexp_replace(lower(c.company_name), '[^a-z0-9]', '', 'g'),'013457','oieast'),
        v_normalized
      ) <= 1
      and p.id <> v_profile.id
  ) into v_company_match;
  if v_company_match then
    raise exception 'That handle matches a verified company name and cannot be used.';
  end if;

  if exists (
    select 1 from public.profiles
    where lower(handle) = v_handle and id <> v_profile.id
  ) or exists (
    select 1 from public.lister_handle_history
    where lower(handle) = v_handle and profile_id <> v_profile.id
  ) then
    raise exception 'That handle is already in use.';
  end if;

  if v_profile.handle is distinct from v_handle then
    if v_profile.handle is not null then
      insert into public.lister_handle_history(profile_id, handle, replaced_by)
      values (v_profile.id, v_profile.handle, v_handle);
    end if;
    update public.profiles
       set handle = v_handle,
           handle_changed_at = now()
     where id = v_profile.id;
  end if;
  return v_handle;
end;
$function$;
revoke all on function public.set_lister_handle(text) from public, anon;
grant execute on function public.set_lister_handle(text) to authenticated;

create or replace function public.get_public_lister_page(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_profile public.profiles%rowtype;
  v_listing_count integer;
  v_company public.company_profiles%rowtype;
begin
  if not exists (
    select 1 from public.platform_settings
    where key = 'lister_pages_enabled'
      and lower(trim(both '"' from value::text)) in ('true','1')
  ) then
    return null;
  end if;

  select p.* into v_profile
  from public.profiles p
  where lower(p.handle) = lower(btrim(p_handle))
     or exists (
       select 1 from public.lister_handle_history h
       where lower(h.handle) = lower(btrim(p_handle)) and h.profile_id = p.id
     )
  order by (lower(p.handle) = lower(btrim(p_handle))) desc
  limit 1;
  if not found or v_profile.is_disabled is true or not public.is_public_lister(v_profile.id) then
    return null;
  end if;

  if lower(coalesce(v_profile.handle, '')) <> lower(btrim(p_handle)) then
    return jsonb_build_object('redirect_to', v_profile.handle);
  end if;
  if v_profile.lister_page_visibility = 'hidden' then
    return null;
  end if;

  select count(*) into v_listing_count
  from public.listings l
  where l.seller_id = v_profile.id and l.status = 'active'
    and coalesce(l.is_disabled, false) = false;

  select * into v_company from public.company_profiles c
  where c.profile_id = v_profile.id;

  return jsonb_build_object(
    'id', v_profile.id,
    'handle', v_profile.handle,
    'visibility', v_profile.lister_page_visibility,
    'full_name', v_profile.full_name,
    'bio', v_profile.bio,
    'profile_location', v_profile.profile_location,
    'public_phone', case when v_profile.public_phone_visible
      and v_profile.hide_buyer_contact is not true then v_profile.phone end,
    'created_at', v_profile.created_at,
    'identity_verified', v_profile.verification_status = 'verified',
    'account_type', v_profile.account_type,
    'verified_role', case
      when v_profile.role_badge_revoked is true then null
      else v_profile.verified_role
    end,
    'company_name', case when v_profile.account_type = 'company' then v_company.company_name end,
    'company_logo_url', case when v_profile.account_type = 'company'
      and v_profile.verified_role = 'company' then v_company.logo_url end,
    'company_description', case when v_profile.account_type = 'company' then v_company.description end,
    'company_website', case when v_profile.account_type = 'company' then v_company.website end,
    'listing_count', v_listing_count
  );
end;
$function$;
revoke all on function public.get_public_lister_page(text) from public;
grant execute on function public.get_public_lister_page(text) to anon, authenticated;

create or replace function public.get_lister_page_handle_by_slug(p_slug text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare v_handle text;
begin
  select p.handle into v_handle
  from public.profiles p
  where p.storefront_slug = p_slug
    and p.handle is not null
    and p.lister_page_visibility in ('public','unlisted')
    and p.is_disabled is not true
    and public.is_public_lister(p.id)
    and exists (
      select 1 from public.listings l
      where l.seller_id=p.id and l.status='active'
        and coalesce(l.is_disabled,false)=false
    )
  limit 1;
  if v_handle is null then return null; end if;
  if public.get_public_lister_page(v_handle) is null then return null; end if;
  return v_handle;
end;
$function$;
revoke all on function public.get_lister_page_handle_by_slug(text) from public;
grant execute on function public.get_lister_page_handle_by_slug(text) to anon, authenticated;

create table if not exists public.lister_availability (
  id uuid primary key default gen_random_uuid(),
  lister_id uuid not null references public.profiles(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null,
  slot_minutes smallint not null default 30 check (slot_minutes between 15 and 240),
  buffer_minutes smallint not null default 0 check (buffer_minutes between 0 and 120),
  timezone text not null default 'Africa/Nairobi',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_time > start_time),
  unique (lister_id, weekday)
);
alter table public.lister_availability enable row level security;
revoke all on public.lister_availability from public, anon, authenticated;
grant select, insert, update, delete on public.lister_availability to authenticated;
drop policy if exists lister_availability_owner_access on public.lister_availability;
create policy lister_availability_owner_access on public.lister_availability
  for all to authenticated using (lister_id = public.effective_seller_id())
  with check (lister_id = public.effective_seller_id());

create table if not exists public.availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  lister_id uuid not null references public.profiles(id) on delete cascade,
  exception_date date not null,
  closed boolean not null default true,
  note text check (length(coalesce(note, '')) <= 200),
  created_at timestamptz not null default now(),
  unique (lister_id, exception_date)
);
alter table public.availability_exceptions enable row level security;
revoke all on public.availability_exceptions from public, anon, authenticated;
grant select, insert, update, delete on public.availability_exceptions to authenticated;
drop policy if exists availability_exceptions_owner_access on public.availability_exceptions;
create policy availability_exceptions_owner_access on public.availability_exceptions
  for all to authenticated using (lister_id = public.effective_seller_id())
  with check (lister_id = public.effective_seller_id());

create table if not exists public.lister_viewing_slots (
  id uuid primary key default gen_random_uuid(),
  viewing_request_id uuid references public.viewing_requests(id) on delete set null,
  lister_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  slot_start timestamptz not null,
  buyer_timezone text not null default 'Africa/Nairobi',
  buyer_note text check (length(coalesce(buyer_note, '')) <= 1000),
  source text check (source in ('instagram','facebook','whatsapp','tiktok','x','telegram','qr','direct')),
  status text not null default 'pending' check (status in ('pending','confirmed','declined','expired','completed')),
  hold_expires_at timestamptz not null default (now() + interval '24 hours'),
  created_at timestamptz not null default now(),
  unique (lister_id, slot_start)
);
alter table public.lister_viewing_slots enable row level security;
revoke all on public.lister_viewing_slots from public, anon, authenticated;
grant select on public.lister_viewing_slots to authenticated;
drop policy if exists lister_viewing_slots_owner_read on public.lister_viewing_slots;
create policy lister_viewing_slots_owner_read on public.lister_viewing_slots
  for select to authenticated using (lister_id = public.effective_seller_id());

create or replace function public.sync_lister_slot_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status is distinct from old.status then
    update public.lister_viewing_slots s
    set status = case new.status
      when 'confirmed' then 'confirmed'
      when 'done' then 'completed'
      when 'cancelled' then 'declined'
      else s.status
    end,
    hold_expires_at = case when new.status in ('confirmed','done','cancelled')
      then now() else s.hold_expires_at end
    where s.viewing_request_id = new.id;
  end if;
  return new;
end;
$function$;
drop trigger if exists sync_lister_slot_status on public.viewing_requests;
create trigger sync_lister_slot_status
  after update of status on public.viewing_requests
  for each row execute function public.sync_lister_slot_status();

create or replace function public.get_lister_open_slots(
  p_handle text,
  p_from timestamptz,
  p_to timestamptz
)
returns table (slot_start timestamptz, timezone text)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if not exists (
    select 1 from public.platform_settings
    where key = 'lister_availability_enabled'
      and lower(trim(both '"' from value::text)) in ('true','1')
  ) then return; end if;
  if p_from is null or p_to is null or p_to <= p_from
     or p_to > p_from + interval '30 days' then
    raise exception 'Choose a valid viewing date range of up to 30 days.';
  end if;

  return query
  with days as (
    select av.lister_id, av.weekday, av.start_time, av.end_time,
           av.slot_minutes, av.timezone, d.local_day::date as local_day
    from public.lister_availability av
    cross join lateral generate_series(
      (p_from at time zone av.timezone)::date,
      (p_to at time zone av.timezone)::date,
      interval '1 day'
    ) as d(local_day)
    where extract(dow from d.local_day)::integer = av.weekday
      and av.lister_id = (
        select p.id from public.profiles p
        where lower(p.handle) = lower(btrim(p_handle))
          and p.lister_page_visibility in ('public','unlisted')
          and p.is_disabled is not true
      )
      and not exists (
        select 1 from public.availability_exceptions ex
        where ex.lister_id = av.lister_id
          and ex.exception_date = d.local_day::date
          and ex.closed
      )
  ), candidates as (
    select days.lister_id, days.timezone,
      slot.value as starts_at
    from days
    cross join lateral generate_series(
      (days.local_day + days.start_time) at time zone days.timezone,
      ((days.local_day + days.end_time) at time zone days.timezone)
        - make_interval(mins => days.slot_minutes),
      make_interval(mins => days.slot_minutes)
    ) as slot(value)
  )
  select c.starts_at, c.timezone
  from candidates c
  join public.profiles p on p.id = c.lister_id
  where c.starts_at between p_from and p_to
    and c.starts_at >= now() + make_interval(hours => p.viewing_min_notice_hours)
    and c.starts_at <= now() + make_interval(days => p.viewing_max_days_ahead)
    and not exists (
      select 1 from public.lister_viewing_slots s
      where s.lister_id = c.lister_id and s.slot_start = c.starts_at
        and (s.status = 'confirmed'
          or (s.status = 'pending' and s.hold_expires_at > now()))
    )
  order by c.starts_at;
end;
$function$;
revoke all on function public.get_lister_open_slots(text,timestamptz,timestamptz) from public;
grant execute on function public.get_lister_open_slots(text,timestamptz,timestamptz) to anon, authenticated;

create or replace function public.request_lister_viewing_slot(
  p_listing_id uuid,
  p_slot_start timestamptz,
  p_buyer_name text,
  p_buyer_phone text,
  p_buyer_timezone text default 'Africa/Nairobi',
  p_note text default null,
  p_fee_acknowledged boolean default false,
  p_source text default 'direct'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_lister uuid;
  v_handle text;
  v_timezone text;
  v_fee integer := 0;
  v_slot_id uuid;
  v_request_id uuid;
  v_slot_time text;
begin
  if not exists (
    select 1 from public.platform_settings
    where key = 'lister_availability_enabled'
      and lower(trim(both '"' from value::text)) in ('true','1')
  ) then raise exception 'Viewing availability is not available yet.'; end if;
  if p_slot_start is null or length(btrim(coalesce(p_buyer_name,''))) not between 2 and 120
     or length(regexp_replace(coalesce(p_buyer_phone,''), '[^0-9]', '', 'g')) not between 9 and 15
     or length(coalesce(p_note,'')) > 1000 then
    raise exception 'Enter a valid name, phone number and optional note.';
  end if;
  if p_source not in ('instagram','facebook','whatsapp','tiktok','x','telegram','qr','direct') then
    raise exception 'Unsupported source.';
  end if;
  select l.seller_id, p.handle, av.timezone into v_lister, v_handle, v_timezone
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  join public.lister_availability av on av.lister_id = p.id
    and av.weekday = extract(dow from p_slot_start at time zone av.timezone)::integer
  where l.id = p_listing_id and l.status = 'active'
    and coalesce(l.is_disabled,false) = false
    and coalesce(l.recycle_bin,false) = false
    and p.lister_page_visibility in ('public','unlisted')
    and p.is_disabled is not true
  limit 1;
  if v_lister is null then raise exception 'This listing is not accepting scheduled viewing requests.'; end if;
  if not exists (
    select 1 from public.get_lister_open_slots(v_handle,p_slot_start - interval '1 second',p_slot_start + interval '1 second') s
    where s.slot_start = p_slot_start
  ) then raise exception 'That viewing slot is no longer available.'; end if;
  select f.viewing_fee into v_fee
  from public.get_public_viewing_fees(array[p_listing_id]) f;
  if coalesce(v_fee,0) > 0 and p_fee_acknowledged is not true then
    raise exception 'Acknowledge the viewing fee shown on the listing before requesting this slot.';
  end if;

  update public.lister_viewing_slots
  set status = 'expired'
  where lister_id = v_lister and status = 'pending' and hold_expires_at <= now();
  v_slot_time := to_char(p_slot_start at time zone v_timezone, 'HH24:MI');
  insert into public.lister_viewing_slots(
    lister_id, listing_id, slot_start, buyer_timezone, buyer_note, source, status, hold_expires_at
  ) values (
    v_lister,p_listing_id,p_slot_start,coalesce(nullif(p_buyer_timezone,''),'Africa/Nairobi'),
    nullif(btrim(p_note),''),p_source,
    case when (select viewing_auto_confirm from public.profiles where id=v_lister) then 'confirmed' else 'pending' end,
    case when (select viewing_auto_confirm from public.profiles where id=v_lister) then now() else now()+interval '24 hours' end
  ) returning id into v_slot_id;

  insert into public.viewing_requests(
    listing_id,buyer_token,buyer_name,buyer_phone,requested_date,requested_time,notes,
    status,viewing_fee_acknowledged
  ) values (
    p_listing_id,gen_random_uuid()::text,btrim(p_buyer_name),btrim(p_buyer_phone),
    (p_slot_start at time zone v_timezone)::date,v_slot_time,nullif(btrim(p_note),''),
    case when (select viewing_auto_confirm from public.profiles where id=v_lister) then 'confirmed' else 'pending' end,
    coalesce(p_fee_acknowledged,false)
  ) returning id into v_request_id;
  update public.lister_viewing_slots set viewing_request_id=v_request_id where id=v_slot_id;
  return v_slot_id;
exception when unique_violation then
  raise exception 'That viewing slot has just been booked. Please choose another time.';
end;
$function$;
revoke all on function public.request_lister_viewing_slot(uuid,timestamptz,text,text,text,text,boolean,text) from public;
grant execute on function public.request_lister_viewing_slot(uuid,timestamptz,text,text,text,text,boolean,text) to anon, authenticated;

create table if not exists public.lister_quick_answers (
  id uuid primary key default gen_random_uuid(),
  lister_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  question_key text not null check (question_key in (
    'water','electricity','security','parking','deposit','lease_length','pets',
    'internet','distance','title_status','payment_arrangements','viewing_days'
  )),
  answer text not null check (length(btrim(answer)) between 1 and 500),
  updated_at timestamptz not null default now()
);
create unique index if not exists lister_quick_answers_profile_key
  on public.lister_quick_answers(lister_id, question_key) where listing_id is null;
create unique index if not exists lister_quick_answers_listing_key
  on public.lister_quick_answers(listing_id, question_key) where listing_id is not null;
alter table public.lister_quick_answers enable row level security;
revoke all on public.lister_quick_answers from public, anon, authenticated;
grant select on public.lister_quick_answers to anon, authenticated;
drop policy if exists lister_quick_answers_public_or_owner_read on public.lister_quick_answers;
create policy lister_quick_answers_public_or_owner_read on public.lister_quick_answers
  for select to anon, authenticated using (
    lister_id = public.effective_seller_id() or (
      public.is_public_lister(lister_id)
      and exists (
        select 1 from public.profiles p
        where p.id = lister_id
          and p.lister_page_visibility in ('public','unlisted')
      )
      and exists (
        select 1 from public.platform_settings s
        where s.key = 'lister_quick_answers_enabled'
          and lower(trim(both '"' from s.value::text)) in ('true','1')
      )
    )
  );

create or replace function public.save_lister_quick_answer(
  p_listing_id uuid,
  p_question_key text,
  p_answer text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_lister uuid := public.effective_seller_id();
  v_id uuid;
  v_answer text := btrim(coalesce(p_answer, ''));
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  if not exists (
    select 1 from public.platform_settings
    where key = 'lister_quick_answers_enabled'
      and lower(trim(both '"' from value::text)) in ('true','1')
  ) then raise exception 'Quick Answers are not available yet'; end if;
  if p_question_key not in (
    'water','electricity','security','parking','deposit','lease_length','pets',
    'internet','distance','title_status','payment_arrangements','viewing_days'
  ) or length(v_answer) not between 1 and 500 then
    raise exception 'Choose a supported question and enter an answer under 500 characters.';
  end if;
  if v_answer ~* '(^|[^0-9])(\+?254|0)[17][0-9][ -]?[0-9]{3}[ -]?[0-9]{3,4}([^0-9]|$)'
     or v_answer ~* '(send|pay|transfer|deposit|mpesa|m-pesa).{0,24}(money|cash|payment|fee|deposit)'
     or v_answer ~* '(money|cash|payment|fee|deposit).{0,24}(send|pay|transfer|mpesa|m-pesa)' then
    raise exception 'Do not include phone numbers or requests for payment in Quick Answers.';
  end if;
  if p_listing_id is not null and not exists (
    select 1 from public.listings l where l.id = p_listing_id and l.seller_id = v_lister
  ) then raise exception 'You can only add answers to your own listings.'; end if;
  if p_listing_id is not null and not exists (
    select 1 from public.lister_quick_answers
    where lister_id = v_lister and listing_id = p_listing_id
      and question_key = p_question_key
  ) and (
    select count(*) from public.lister_quick_answers
    where lister_id = v_lister and listing_id = p_listing_id
  ) >= 10 then
    raise exception 'You can add up to 10 Quick Answers per listing.';
  end if;

  if p_listing_id is null then
    select id into v_id from public.lister_quick_answers
    where lister_id = v_lister and listing_id is null and question_key = p_question_key;
    if v_id is null then
      insert into public.lister_quick_answers(lister_id, question_key, answer)
      values (v_lister, p_question_key, v_answer) returning id into v_id;
    else
      update public.lister_quick_answers set answer = v_answer, updated_at = now() where id = v_id;
    end if;
  else
    select id into v_id from public.lister_quick_answers
    where listing_id = p_listing_id and question_key = p_question_key;
    if v_id is null then
      insert into public.lister_quick_answers(lister_id, listing_id, question_key, answer)
      values (v_lister, p_listing_id, p_question_key, v_answer) returning id into v_id;
    else
      update public.lister_quick_answers set answer = v_answer, updated_at = now() where id = v_id;
    end if;
  end if;
  return v_id;
end;
$function$;
revoke all on function public.save_lister_quick_answer(uuid,text,text) from public, anon;
grant execute on function public.save_lister_quick_answer(uuid,text,text) to authenticated;

create table if not exists public.lister_page_events (
  id uuid primary key default gen_random_uuid(),
  lister_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  event text not null check (event in ('page_view','listing_view','share_click','contact_click','enquiry','viewing_request')),
  source text not null check (source in ('instagram','facebook','whatsapp','tiktok','x','telegram','qr','direct')),
  session_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists lister_page_events_lister_date_idx
  on public.lister_page_events(lister_id, created_at desc);
alter table public.lister_page_events enable row level security;
revoke all on public.lister_page_events from public, anon, authenticated;
grant select on public.lister_page_events to authenticated;
drop policy if exists lister_page_events_owner_read on public.lister_page_events;
create policy lister_page_events_owner_read on public.lister_page_events
  for select to authenticated using (lister_id = public.effective_seller_id());

create or replace function public.record_lister_page_event(
  p_handle text,
  p_event text,
  p_source text,
  p_listing_id uuid default null,
  p_session_id uuid default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare v_lister uuid;
begin
  if not exists (
    select 1 from public.platform_settings
    where key = 'lister_source_tracking_enabled'
      and lower(trim(both '"' from value::text)) in ('true','1')
  ) then return false; end if;
  if p_session_id is null then
    raise exception 'A session identifier is required for source tracking';
  end if;
  if p_event not in ('page_view','listing_view','share_click','contact_click','enquiry','viewing_request')
     or p_source not in ('instagram','facebook','whatsapp','tiktok','x','telegram','qr','direct') then
    raise exception 'Unsupported event or source';
  end if;
  select id into v_lister from public.profiles
  where lower(handle) = lower(btrim(p_handle))
    and lister_page_visibility in ('public','unlisted')
    and is_disabled is not true;
  if v_lister is null or not public.is_public_lister(v_lister) then return false; end if;
  if p_listing_id is not null and not exists (
    select 1 from public.listings where id = p_listing_id and seller_id = v_lister and status = 'active'
  ) then raise exception 'Listing does not belong to this lister'; end if;
  if p_session_id is not null and exists (
    select 1 from public.lister_page_events
    where session_id = p_session_id and lister_id = v_lister and event = p_event
      and created_at > now() - interval '10 seconds'
  ) then return false; end if;
  insert into public.lister_page_events(lister_id, listing_id, event, source, session_id)
  values (v_lister, p_listing_id, p_event, p_source, p_session_id);
  return true;
end;
$function$;
revoke all on function public.record_lister_page_event(text,text,text,uuid,uuid) from public;
grant execute on function public.record_lister_page_event(text,text,text,uuid,uuid) to anon, authenticated;

create table if not exists public.lister_stats (
  lister_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  source text not null check (source in ('instagram','facebook','whatsapp','tiktok','x','telegram','qr','direct')),
  views integer not null default 0,
  enquiries integer not null default 0,
  viewings integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (lister_id, day, source)
);
alter table public.lister_stats enable row level security;
revoke all on public.lister_stats from public, anon, authenticated;
grant select on public.lister_stats to authenticated;
drop policy if exists lister_stats_owner_read on public.lister_stats;
create policy lister_stats_owner_read on public.lister_stats
  for select to authenticated using (lister_id = public.effective_seller_id());

create or replace function public.aggregate_lister_page_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  insert into public.lister_stats(lister_id, day, source, views, enquiries, viewings)
  values (
    new.lister_id,
    (new.created_at at time zone 'Africa/Nairobi')::date,
    new.source,
    case when new.event in ('page_view','listing_view') then 1 else 0 end,
    case when new.event = 'enquiry' then 1 else 0 end,
    case when new.event = 'viewing_request' then 1 else 0 end
  )
  on conflict (lister_id, day, source) do update
    set views = lister_stats.views + excluded.views,
        enquiries = lister_stats.enquiries + excluded.enquiries,
        viewings = lister_stats.viewings + excluded.viewings,
        updated_at = now();
  return new;
end;
$function$;
revoke all on function public.aggregate_lister_page_event() from public, anon, authenticated;
drop trigger if exists aggregate_lister_page_event on public.lister_page_events;
create trigger aggregate_lister_page_event
  after insert on public.lister_page_events
  for each row execute function public.aggregate_lister_page_event();

commit;
