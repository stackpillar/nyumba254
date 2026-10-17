-- Success-based viewing fee (engagements) and lister viewing terms.
-- Idempotent.

-- ───────────── Engagements ─────────────
create table if not exists public.viewing_engagements (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_token text,
  buyer_phone text,
  buyer_name text,
  fee_snapshot integer not null default 0 check (fee_snapshot >= 0 and fee_snapshot <= 5000),
  first_listing_id uuid,
  first_request_id uuid,
  status text not null default 'open'
    check (status in ('open','secured_pending','secured','disputed','closed')),
  secured_listing_id uuid,
  secured_at timestamptz,
  confirm_deadline timestamptz,
  confirmed_at timestamptz,
  dispute_report_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists viewing_engagements_seller_idx on public.viewing_engagements (seller_id, status);
create index if not exists viewing_engagements_token_idx on public.viewing_engagements (seller_id, buyer_token);
alter table public.viewing_engagements enable row level security;
drop policy if exists viewing_engagements_lister_read on public.viewing_engagements;
create policy viewing_engagements_lister_read on public.viewing_engagements
  for select to authenticated
  using (seller_id = auth.uid() or seller_id = public.effective_seller_id() or public.is_admin());

alter table public.viewing_requests add column if not exists engagement_id uuid references public.viewing_engagements(id) on delete set null;
alter table public.viewing_requests add column if not exists fee_charged integer not null default 0;

create or replace function public.snapshot_viewing_request_fee()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_fee integer;
  v_seller uuid;
  v_eng uuid;
  v_phone text := right(regexp_replace(coalesce(new.buyer_phone, ''), '\D', '', 'g'), 9);
begin
  if tg_op = 'UPDATE' then
    if new.listing_id is distinct from old.listing_id then
      raise exception 'A viewing request cannot be moved to another listing';
    end if;
    new.viewing_fee_snapshot := old.viewing_fee_snapshot;
    new.fee_at_request := old.fee_at_request;
    new.viewing_fee_acknowledged := old.viewing_fee_acknowledged;
    new.fee_charged := old.fee_charged;
    new.engagement_id := old.engagement_id;
    return new;
  end if;

  select l.seller_id,
         case when public.viewing_fee_lister_can_charge(l.seller_id)
              then coalesce(f.viewing_fee, 0) else 0 end
    into v_seller, v_fee
  from public.listings l
  join public.profiles p on p.id = l.seller_id
  left join public.listing_viewing_fees f on f.listing_id = l.id
  where l.id = new.listing_id and l.status = 'active'
    and coalesce(l.is_disabled, false) = false
    and coalesce(l.recycle_bin, false) = false
    and p.is_disabled is not true;
  if not found then
    raise exception 'This listing is not available for viewing requests';
  end if;

  select e.id into v_eng
  from public.viewing_engagements e
  where e.seller_id = v_seller and e.status = 'open'
    and ((nullif(new.buyer_token, '') is not null and e.buyer_token = new.buyer_token)
         or (length(v_phone) = 9 and e.buyer_phone = v_phone))
  order by e.created_at desc limit 1;

  if v_eng is not null then
    new.engagement_id := v_eng;
    new.viewing_fee_snapshot := 0;
    new.fee_at_request := 0;
    new.fee_charged := 0;
    return new;
  end if;

  if new.fee_at_request is not null and new.viewing_fee_acknowledged is true
     and new.fee_at_request is distinct from v_fee then
    raise exception 'The viewing fee changed. Refresh the listing and confirm the current fee.';
  end if;
  if v_fee > 0 and new.viewing_fee_acknowledged is not true then
    raise exception 'Acknowledge the viewing fee before requesting a viewing';
  end if;

  insert into public.viewing_engagements
    (seller_id, buyer_token, buyer_phone, buyer_name, fee_snapshot, first_listing_id, first_request_id)
  values (v_seller, nullif(new.buyer_token, ''), nullif(v_phone, ''), new.buyer_name, v_fee, new.listing_id, new.id)
  returning id into v_eng;

  new.engagement_id := v_eng;
  new.viewing_fee_snapshot := v_fee;
  new.fee_at_request := v_fee;
  new.fee_charged := v_fee;
  return new;
end;
$$;

-- Lazy finalisation: an unanswered "secured" claim is confirmed after the window.
create or replace function public.nk_finalize_engagements(p_seller uuid default null)
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.viewing_engagements
  set status = 'secured', confirmed_at = now()
  where status = 'secured_pending' and confirm_deadline < now()
    and (p_seller is null or seller_id = p_seller);
  get diagnostics n = row_count;
  return n;
end;
$$;

create or replace function public.get_lister_engagements()
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_seller uuid := public.effective_seller_id();
begin
  if auth.uid() is null or v_seller is null then raise exception 'Authentication is required'; end if;
  perform public.nk_finalize_engagements(v_seller);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', e.id, 'status', e.status, 'buyer_name', e.buyer_name, 'buyer_phone', e.buyer_phone,
      'fee', e.fee_snapshot, 'created_at', e.created_at, 'secured_at', e.secured_at,
      'confirm_deadline', e.confirm_deadline, 'secured_listing_id', e.secured_listing_id,
      'requests', (select coalesce(jsonb_agg(jsonb_build_object(
          'id', r.id, 'listing_id', r.listing_id, 'title', l.title, 'date', r.requested_date,
          'time', r.requested_time, 'status', r.status) order by r.created_at), '[]'::jsonb)
        from public.viewing_requests r join public.listings l on l.id = r.listing_id
        where r.engagement_id = e.id)
    ) order by e.created_at desc)
    from public.viewing_engagements e where e.seller_id = v_seller), '[]'::jsonb);
end;
$$;

create or replace function public.mark_engagement_secured(p_engagement uuid, p_listing uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_seller uuid := public.effective_seller_id();
  e public.viewing_engagements%rowtype;
  v_days integer := coalesce(public.nk_setting_num('viewing_secure_confirm_days'), 7)::integer;
begin
  if auth.uid() is null or v_seller is null then raise exception 'Authentication is required'; end if;
  select * into e from public.viewing_engagements where id = p_engagement and seller_id = v_seller for update;
  if not found then raise exception 'Engagement not found'; end if;
  if e.status <> 'open' then raise exception 'This client is already marked as secured'; end if;
  if not exists (select 1 from public.listings where id = p_listing and seller_id = v_seller) then
    raise exception 'Choose one of your listings';
  end if;
  update public.viewing_engagements
  set status = 'secured_pending', secured_listing_id = p_listing, secured_at = now(),
      confirm_deadline = now() + make_interval(days => v_days)
  where id = p_engagement;
  return 'secured_pending';
end;
$$;

-- Client confirms or disputes (anonymous clients are identified by their buyer token).
create or replace function public.respond_engagement_secured(
  p_engagement uuid, p_buyer_token text, p_confirm boolean, p_note text default null, p_advance boolean default false)
returns text language plpgsql security definer set search_path = public as $$
declare e public.viewing_engagements%rowtype; v_report uuid;
begin
  select * into e from public.viewing_engagements where id = p_engagement for update;
  if not found or e.buyer_token is null or e.buyer_token is distinct from p_buyer_token then
    raise exception 'Engagement not found';
  end if;
  if e.status <> 'secured_pending' then raise exception 'Nothing to confirm for this viewing'; end if;
  if p_confirm then
    update public.viewing_engagements set status = 'secured', confirmed_at = now() where id = e.id;
    return 'secured';
  end if;
  insert into public.reports (reporter_name, target_type, target_id, reason, details, status)
  values (coalesce(e.buyer_name, 'Client'), 'seller', e.seller_id,
          case when p_advance then 'viewing_fee_advance_payment' else 'viewing_fee_dispute' end,
          left(coalesce(nullif(btrim(p_note), ''), 'Client disputed the secured claim'), 1000), 'open')
  returning id into v_report;
  update public.viewing_engagements set status = 'disputed', dispute_report_id = v_report where id = e.id;
  return 'disputed';
end;
$$;
grant execute on function public.get_lister_engagements() to authenticated;
grant execute on function public.mark_engagement_secured(uuid, uuid) to authenticated;
grant execute on function public.respond_engagement_secured(uuid, text, boolean, text, boolean) to anon, authenticated;

-- Policy v2 requires agents and companies with a fee to re-accept.
insert into public.platform_settings (key, value) values ('viewing_fee_policy_version', '"v2"')
on conflict (key) do update set value = '"v2"', updated_at = now()
where public.platform_settings.value = '"v1"'::jsonb;

-- ───────────── Lister terms ─────────────
create table if not exists public.lister_terms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade,
  version integer not null default 1,
  short_text text,
  is_active boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now()
);
create unique index if not exists lister_terms_active_idx
  on public.lister_terms (owner_id, coalesce(listing_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where is_active;

create table if not exists public.lister_terms_fields (
  id uuid primary key default gen_random_uuid(),
  terms_id uuid not null references public.lister_terms(id) on delete cascade,
  position integer not null default 0,
  label text not null check (length(label) between 2 and 80),
  field_type text not null check (field_type in
    ('short_text','long_text','phone','email','date','select','checkbox')),
  required boolean not null default false,
  options jsonb
);

create table if not exists public.viewing_terms_responses (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.viewing_requests(id) on delete cascade,
  listing_id uuid not null,
  seller_id uuid not null,
  terms_id uuid,
  terms_version integer,
  answers jsonb not null default '{}',
  typed_name text not null,
  accepted_at timestamptz not null default now(),
  client_user_id uuid,
  buyer_token text,
  purge_after timestamptz not null
);
create index if not exists viewing_terms_responses_seller_idx on public.viewing_terms_responses (seller_id);
create index if not exists viewing_terms_responses_purge_idx on public.viewing_terms_responses (purge_after);

alter table public.lister_terms enable row level security;
alter table public.lister_terms_fields enable row level security;
alter table public.viewing_terms_responses enable row level security;

drop policy if exists lister_terms_owner on public.lister_terms;
create policy lister_terms_owner on public.lister_terms for select to authenticated
  using (owner_id = auth.uid() or owner_id = public.effective_seller_id() or public.is_admin());
drop policy if exists lister_terms_fields_owner on public.lister_terms_fields;
create policy lister_terms_fields_owner on public.lister_terms_fields for select to authenticated
  using (exists (select 1 from public.lister_terms t where t.id = terms_id
    and (t.owner_id = auth.uid() or t.owner_id = public.effective_seller_id() or public.is_admin())));
drop policy if exists viewing_terms_responses_read on public.viewing_terms_responses;
create policy viewing_terms_responses_read on public.viewing_terms_responses for select to authenticated
  using (client_user_id = auth.uid() or seller_id = auth.uid() or seller_id = public.effective_seller_id());

create or replace function public.nk_terms_label_blocked(p_label text)
returns boolean language sql immutable as $$
  select coalesce(p_label, '') ~* '(m-?pesa|paybill|till number|\mpin\M|password|passcode|\motp\M|\mcvv\M|card number|account number|bank|national id|\mid (number|no)|passport|upload|attach|deposit|send money|payment)';
$$;

create or replace function public.save_lister_terms(p_listing uuid, p_short_text text, p_fields jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid := public.effective_seller_id();
  p public.profiles%rowtype;
  v_roles text;
  v_prev public.lister_terms%rowtype;
  v_id uuid;
  f jsonb; i integer := 0;
  v_premium boolean;
begin
  if auth.uid() is null or v_owner is null then raise exception 'Authentication is required'; end if;
  select * into p from public.profiles where id = v_owner;
  select coalesce(value #>> '{}', 'agent,company') into v_roles
  from public.platform_settings where key = 'lister_terms_enabled_roles';
  if not (p.account_roles && string_to_array(coalesce(v_roles, 'agent,company'), ',')) then
    raise exception 'Viewing terms are not enabled for your account type';
  end if;
  if p_listing is not null and not exists
     (select 1 from public.listings where id = p_listing and seller_id = v_owner) then
    raise exception 'Choose one of your listings';
  end if;
  if length(coalesce(p_short_text, '')) > 600 then raise exception 'Keep the terms line under 600 characters'; end if;
  if public.nk_terms_label_blocked(p_short_text) then
    raise exception 'Terms must not ask for payments, PINs, passwords or ID documents';
  end if;
  v_premium := p.subscription_tier is not null and p.subscription_tier <> 'none'
               and (p.subscription_expires_at is null or p.subscription_expires_at > now());
  if jsonb_array_length(coalesce(p_fields, '[]'::jsonb)) > 0 and not v_premium then
    raise exception 'PREMIUM_REQUIRED: custom terms fields need a Premium or Elite plan';
  end if;
  if jsonb_array_length(coalesce(p_fields, '[]'::jsonb)) > 12 then
    raise exception 'Use at most 12 fields';
  end if;
  for f in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    if public.nk_terms_label_blocked(f->>'label') then
      raise exception 'Field "%" is not allowed: do not ask for payments, PINs, passwords or ID documents', f->>'label';
    end if;
    if public.nk_terms_label_blocked(f->>'options') then
      raise exception 'Field options must not mention payments or credentials';
    end if;
  end loop;

  select * into v_prev from public.lister_terms
  where owner_id = v_owner and listing_id is not distinct from p_listing and is_active for update;
  if found then update public.lister_terms set is_active = false where id = v_prev.id; end if;

  insert into public.lister_terms (owner_id, listing_id, version, short_text, created_by)
  values (v_owner, p_listing, coalesce(v_prev.version, 0) + 1, nullif(btrim(p_short_text), ''), auth.uid())
  returning id into v_id;

  for f in select * from jsonb_array_elements(coalesce(p_fields, '[]'::jsonb)) loop
    i := i + 1;
    insert into public.lister_terms_fields (terms_id, position, label, field_type, required, options)
    values (v_id, i, btrim(f->>'label'), f->>'field_type', coalesce((f->>'required')::boolean, false),
            case when f->>'field_type' = 'select' then f->'options' end);
  end loop;
  return v_id;
end;
$$;

create or replace function public.delete_lister_terms(p_listing uuid)
returns void language sql security definer set search_path = public as $$
  update public.lister_terms set is_active = false
  where owner_id = public.effective_seller_id() and listing_id is not distinct from p_listing and is_active;
$$;

create or replace function public.get_listing_terms(p_listing uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare t public.lister_terms%rowtype; v_seller uuid;
begin
  select seller_id into v_seller from public.listings
  where id = p_listing and status = 'active' and coalesce(is_disabled, false) = false;
  if v_seller is null then return null; end if;
  select * into t from public.lister_terms
  where owner_id = v_seller and is_active and (listing_id = p_listing or listing_id is null)
  order by (listing_id is not null) desc limit 1;
  if not found then return null; end if;
  return jsonb_build_object('id', t.id, 'version', t.version, 'short_text', t.short_text,
    'fields', coalesce((select jsonb_agg(jsonb_build_object('id', f.id, 'label', f.label,
        'type', f.field_type, 'required', f.required, 'options', f.options) order by f.position)
      from public.lister_terms_fields f where f.terms_id = t.id), '[]'::jsonb));
end;
$$;

create or replace function public.submit_viewing_terms(
  p_request uuid, p_buyer_token text, p_answers jsonb, p_accepted boolean, p_typed_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  r public.viewing_requests%rowtype;
  t jsonb; f jsonb; v_seller uuid; v_id uuid; v_days integer; a text;
begin
  select * into r from public.viewing_requests where id = p_request;
  if not found or r.buyer_token is null or r.buyer_token is distinct from p_buyer_token then
    raise exception 'Viewing request not found';
  end if;
  if exists (select 1 from public.viewing_terms_responses where request_id = p_request) then
    raise exception 'Terms were already confirmed for this request';
  end if;
  t := public.get_listing_terms(r.listing_id);
  if t is null then return null; end if;
  if p_accepted is not true then raise exception 'Tick the box to confirm you have read the terms'; end if;
  if length(btrim(coalesce(p_typed_name, ''))) < 3 then raise exception 'Type your full name to confirm'; end if;
  for f in select * from jsonb_array_elements(t->'fields') loop
    a := p_answers ->> (f->>'id');
    if (f->>'required')::boolean and nullif(btrim(coalesce(a, '')), '') is null then
      raise exception 'Please answer: %', f->>'label';
    end if;
    if a is not null and length(a) > 1000 then raise exception 'Answer too long: %', f->>'label'; end if;
  end loop;
  select seller_id into v_seller from public.listings where id = r.listing_id;
  v_days := coalesce(public.nk_setting_num('terms_response_retention_days'), 180)::integer;
  insert into public.viewing_terms_responses
    (request_id, listing_id, seller_id, terms_id, terms_version, answers, typed_name,
     client_user_id, buyer_token, purge_after)
  values (p_request, r.listing_id, v_seller, (t->>'id')::uuid, (t->>'version')::integer,
          coalesce(p_answers, '{}'::jsonb), left(btrim(p_typed_name), 120),
          auth.uid(), p_buyer_token, now() + make_interval(days => v_days))
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.admin_get_terms_response(p_id uuid, p_reason text)
returns public.viewing_terms_responses language plpgsql security definer set search_path = public as $$
declare r public.viewing_terms_responses%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then raise exception 'Administrator access is required'; end if;
  if length(btrim(coalesce(p_reason, ''))) < 10 then raise exception 'Give a reason of at least 10 characters'; end if;
  select * into r from public.viewing_terms_responses where id = p_id;
  if not found then raise exception 'Response not found'; end if;
  insert into public.admin_logs (admin_id, admin_name, action, target_type, target_id, details)
  values (auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), 'Admin'),
          'view_terms_response', 'viewing_terms_response', p_id::text, left(btrim(p_reason), 500));
  return r;
end;
$$;

create or replace function public.purge_viewing_terms_responses()
returns integer language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  delete from public.viewing_terms_responses where purge_after < now();
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.save_lister_terms(uuid, text, jsonb) to authenticated;
grant execute on function public.delete_lister_terms(uuid) to authenticated;
grant execute on function public.get_listing_terms(uuid) to anon, authenticated;
grant execute on function public.submit_viewing_terms(uuid, text, jsonb, boolean, text) to anon, authenticated;
grant execute on function public.admin_get_terms_response(uuid, text) to authenticated;
revoke execute on function public.purge_viewing_terms_responses() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('purge-viewing-terms-responses', '17 3 * * *',
      'select public.purge_viewing_terms_responses()');
  end if;
exception when others then
  raise notice 'cron schedule skipped: %', sqlerrm;
end $$;
