-- Price-drop history and alerts, consent-based company roster, per-listing Quick Answers.

-- ───────────── Price drops ─────────────
create table if not exists public.listing_price_history (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  old_price numeric not null,
  new_price numeric not null,
  changed_at timestamptz not null default now()
);
create index if not exists listing_price_history_listing_idx
  on public.listing_price_history(listing_id, changed_at desc);
alter table public.listing_price_history enable row level security;
revoke all on public.listing_price_history from public, anon, authenticated;

create or replace function public.record_listing_price_drop()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.price is null or old.price is null or old.price <= 0 or new.price >= old.price then
    return new;
  end if;
  insert into public.listing_price_history(listing_id, old_price, new_price)
  values (new.id, old.price, new.price);

  -- Notify people who saved the listing, at most once per listing per week.
  insert into public.notifications(seller_id, type, title, body, link)
  select s.user_id, 'price_drop', 'Price dropped on a listing you saved',
         left(coalesce(new.title, 'A saved listing'), 80) || ' is now KES ' || to_char(new.price, 'FM999,999,999,990'),
         '/listing?id=' || lpad(new.listing_number::text, 6, '0')
  from public.saved_listings s
  join public.profiles p on p.id = s.user_id
  where s.listing_id = new.id
    and s.user_id is distinct from new.seller_id
    and not exists (
      select 1 from public.notifications n
      where n.seller_id = s.user_id and n.type = 'price_drop'
        and n.link = '/listing?id=' || lpad(new.listing_number::text, 6, '0')
        and n.created_at > now() - interval '7 days'
    );
  return new;
end;
$function$;

drop trigger if exists trg_record_listing_price_drop on public.listings;
create trigger trg_record_listing_price_drop
  after update of price on public.listings
  for each row when (new.price is distinct from old.price)
  execute function public.record_listing_price_drop();

create or replace function public.get_listing_price_drops(p_listing_ids uuid[])
returns table(listing_id uuid, old_price numeric, new_price numeric, changed_at timestamptz)
language sql
stable
security definer
set search_path = public
as $function$
  select distinct on (h.listing_id) h.listing_id, h.old_price, h.new_price, h.changed_at
  from public.listing_price_history h
  join public.listings l on l.id = h.listing_id
  where h.listing_id = any(p_listing_ids[1:50])
    and h.changed_at > now() - interval '30 days'
    and l.status = 'active' and coalesce(l.is_disabled, false) = false
    and l.price = h.new_price
  order by h.listing_id, h.changed_at desc;
$function$;
revoke all on function public.get_listing_price_drops(uuid[]) from public;
grant execute on function public.get_listing_price_drops(uuid[]) to anon, authenticated;

-- ───────────── Company roster with consent ─────────────
alter table public.team_members
  add column if not exists show_on_lister_page boolean not null default false;

create or replace function public.protect_roster_consent()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if tg_op = 'INSERT' then
    new.show_on_lister_page := false;
  elsif new.show_on_lister_page is distinct from old.show_on_lister_page
        and auth.uid() is not null and auth.uid() is distinct from new.member_id then
    new.show_on_lister_page := old.show_on_lister_page;
  end if;
  if tg_op = 'UPDATE' and new.status is distinct from 'active' then
    new.show_on_lister_page := false;
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_protect_roster_consent on public.team_members;
create trigger trg_protect_roster_consent
  before insert or update on public.team_members
  for each row execute function public.protect_roster_consent();

create or replace function public.set_my_roster_visibility(p_show boolean)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  update public.team_members
  set show_on_lister_page = coalesce(p_show, false)
  where member_id = auth.uid() and status = 'active';
end;
$function$;
revoke all on function public.set_my_roster_visibility(boolean) from public, anon;
grant execute on function public.set_my_roster_visibility(boolean) to authenticated;

create or replace function public.get_lister_roster(p_owner_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('name', p.full_name, 'role', p.verified_role) order by p.full_name), '[]'::jsonb)
  from public.team_members t
  join public.profiles p on p.id = t.member_id
  join public.profiles o on o.id = t.owner_id
  where t.owner_id = p_owner_id
    and t.status = 'active'
    and t.show_on_lister_page is true
    and coalesce(btrim(p.full_name), '') <> ''
    and o.lister_page_visibility in ('public', 'unlisted')
    and coalesce(o.is_disabled, false) = false
    and public.is_public_lister(o.id)
    and exists (
      select 1 from public.platform_settings s
      where s.key = 'lister_pages_enabled'
        and lower(trim(both '"' from s.value::text)) in ('true', '1')
    );
$function$;
revoke all on function public.get_lister_roster(uuid) from public;
grant execute on function public.get_lister_roster(uuid) to anon, authenticated;

-- ───────────── Per-listing Quick Answers ─────────────
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
      and (
        listing_id is null or exists (
          select 1 from public.listings l
          where l.id = listing_id and l.status = 'active'
            and coalesce(l.is_disabled, false) = false
            and coalesce(l.recycle_bin, false) = false
        )
      )
      and exists (
        select 1 from public.platform_settings s
        where s.key = 'lister_quick_answers_enabled'
          and lower(trim(both '"' from s.value::text)) in ('true','1')
      )
    )
  );

create or replace function public.delete_lister_quick_answer(p_listing_id uuid, p_question_key text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_lister uuid := public.effective_seller_id();
begin
  if auth.uid() is null then raise exception 'Authentication is required'; end if;
  delete from public.lister_quick_answers
  where lister_id = v_lister
    and question_key = p_question_key
    and listing_id is not distinct from p_listing_id;
end;
$function$;
revoke all on function public.delete_lister_quick_answer(uuid,text) from public, anon;
grant execute on function public.delete_lister_quick_answer(uuid,text) to authenticated;
