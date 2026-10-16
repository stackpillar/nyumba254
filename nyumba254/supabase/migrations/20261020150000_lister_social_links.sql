-- Social links for Lister Pages (storefront only).
-- Rollback: drop functions set_lister_social_links, get_my_social_links, get_lister_social_links,
--   record_social_click, get_my_social_click_totals, admin_set_social_link_hidden, nk_parse_social_link;
--   drop tables lister_social_click_seen, lister_social_clicks, social_link_moderation, lister_social_links;
--   drop function nk_social_links_limit().
begin;

create table if not exists public.lister_social_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('instagram','facebook','tiktok','x','youtube','linkedin','telegram','snapchat','threads','whatsapp_channel','website')),
  handle text not null check (char_length(handle) between 1 and 2048),
  url text not null check (char_length(url) <= 2048 and url ~ '^https://'),
  display_order integer not null default 0,
  is_visible boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, platform)
);
alter table public.lister_social_links enable row level security;
drop policy if exists lister_social_links_owner_select on public.lister_social_links;
create policy lister_social_links_owner_select on public.lister_social_links
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
revoke all on public.lister_social_links from anon, authenticated;
grant select on public.lister_social_links to authenticated;

create or replace function public.nk_social_links_limit()
returns trigger language plpgsql as $function$
begin
  if (select count(*) from public.lister_social_links where user_id = new.user_id and id <> new.id) >= 8 then
    raise exception 'You can add up to 8 social links.';
  end if;
  return new;
end;
$function$;
drop trigger if exists lister_social_links_limit on public.lister_social_links;
create trigger lister_social_links_limit before insert on public.lister_social_links
  for each row execute function public.nk_social_links_limit();

create table if not exists public.social_link_moderation (
  id uuid primary key default gen_random_uuid(),
  link_id uuid not null references public.lister_social_links(id) on delete cascade,
  hidden_by uuid references public.profiles(id) on delete set null,
  reason text not null,
  created_at timestamptz not null default now(),
  released_at timestamptz
);
create index if not exists social_link_moderation_link_idx on public.social_link_moderation(link_id) where released_at is null;
alter table public.social_link_moderation enable row level security;
drop policy if exists social_link_moderation_admin on public.social_link_moderation;
create policy social_link_moderation_admin on public.social_link_moderation
  for select to authenticated using (public.is_admin());
revoke all on public.social_link_moderation from anon, authenticated;
grant select on public.social_link_moderation to authenticated;

create table if not exists public.lister_social_clicks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null,
  day date not null,
  clicks integer not null default 0,
  primary key (user_id, platform, day)
);
alter table public.lister_social_clicks enable row level security;
revoke all on public.lister_social_clicks from anon, authenticated;

-- Throttle only: hash of a random visitor token + day. No IP, no user agent.
create table if not exists public.lister_social_click_seen (
  visitor_hash text primary key,
  day date not null
);
alter table public.lister_social_click_seen enable row level security;
revoke all on public.lister_social_click_seen from anon, authenticated;

-- Normalises one platform/input pair to (handle, url). Raises a readable error when invalid.
create or replace function public.nk_parse_social_link(p_platform text, p_input text)
returns table (handle text, url text)
language plpgsql
immutable
as $function$
declare
  v text := btrim(coalesce(p_input, ''));
  v_host text;
  v_path text;
  v_m text[];
  v_h text;
  v_label text := initcap(replace(p_platform, '_', ' '));
begin
  if v = '' then raise exception '% needs a handle or link.', v_label; end if;
  if char_length(v) > 2048 then raise exception '% link is too long.', v_label; end if;
  if v ~ '[\s<>"''`\\]' then raise exception '% contains characters that are not allowed.', v_label; end if;

  if p_platform = 'website' then
    if v !~* '^https?://' then
      if v ~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' then raise exception 'Website must start with https://'; end if;
      v := 'https://' || v;
    end if;
    if v !~* '^https://' then raise exception 'Website must use https://'; end if;
    v_m := regexp_match(v, '^https://([^/?#]*)([/?#].*)?$', 'i');
    if v_m is null then raise exception 'Website link is not valid.'; end if;
    v_host := lower(v_m[1]);
    if position('@' in v_host) > 0 then raise exception 'Website links cannot contain a username or password.'; end if;
    if position(':' in v_host) > 0 then raise exception 'Website links cannot use a custom port.'; end if;
    if v_host !~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$' then raise exception 'Website must be a public domain name.'; end if;
    if v_host ~ '\.(local|internal|localhost|test|invalid|lan|home|corp)$' then raise exception 'Website must be a public domain name.'; end if;
    if v_host in ('bit.ly','tinyurl.com','t.co','goo.gl','ow.ly','is.gd','buff.ly','cutt.ly','rebrand.ly','lnkd.in','rb.gy','shorturl.at','tiny.cc','t.ly','linktr.ee','wa.me','fb.me') then
      raise exception 'Link shorteners are not allowed. Use the full website address.';
    end if;
    handle := v_host;
    url := 'https://' || v_host || coalesce(v_m[2], '');
    return next;
    return;
  end if;

  -- Social platforms: a bare handle or a pasted URL.
  if v ~* '^[a-z][a-z0-9+.-]*:' then
    if v !~* '^https?://' then raise exception '% link must be a normal https:// address.', v_label; end if;
    v_m := regexp_match(v, '^https?://([^/?#]*)([/?#].*)?$', 'i');
    if v_m is null then raise exception '% link is not valid.', v_label; end if;
    v_host := lower(v_m[1]);
    if position('@' in v_host) > 0 or position(':' in v_host) > 0 then raise exception '% link is not valid.', v_label; end if;
    v_path := regexp_replace(coalesce(v_m[2], ''), '[?#].*$', '');
    v_path := regexp_replace(v_path, '/+$', '');
  else
    v_host := null;
    v_path := null;
    v := regexp_replace(v, '^@', '');
  end if;

  if p_platform = 'instagram' then
    if v_host is not null then
      if v_host not in ('instagram.com','www.instagram.com') then raise exception 'Instagram links must be on instagram.com.'; end if;
      v_m := regexp_match(v_path, '^/([A-Za-z0-9._]{1,30})$');
      if v_m is null then raise exception 'Paste your Instagram profile link, for example instagram.com/yourname.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    v_h := lower(v_h);
    if v_h !~ '^[a-z0-9._]{1,30}$' then raise exception 'Instagram handles use letters, numbers, dots and underscores (up to 30).'; end if;
    handle := '@' || v_h; url := 'https://www.instagram.com/' || v_h || '/';

  elsif p_platform = 'facebook' then
    if v_host is not null then
      if v_host not in ('facebook.com','www.facebook.com','m.facebook.com') then raise exception 'Facebook links must be on facebook.com.'; end if;
      v_m := regexp_match(v_path, '^/share/([A-Za-z0-9_-]{4,60})$');
      if v_m is not null then
        handle := 'share/' || v_m[1]; url := 'https://www.facebook.com/share/' || v_m[1] || '/'; return next; return;
      end if;
      v_m := regexp_match(v_path, '^/([A-Za-z0-9.]{5,50})$');
      if v_m is null then raise exception 'Paste your Facebook page link, for example facebook.com/yourpage.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    v_h := lower(v_h);
    if v_h !~ '^[a-z0-9.]{5,50}$' then raise exception 'Facebook page names use letters, numbers and dots (5 to 50).'; end if;
    handle := v_h; url := 'https://www.facebook.com/' || v_h;

  elsif p_platform = 'tiktok' then
    if v_host is not null then
      if v_host not in ('tiktok.com','www.tiktok.com') then raise exception 'TikTok links must be on tiktok.com.'; end if;
      v_m := regexp_match(v_path, '^/@([A-Za-z0-9._]{2,24})$');
      if v_m is null then raise exception 'Paste your TikTok profile link, for example tiktok.com/@yourname.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    v_h := lower(v_h);
    if v_h !~ '^[a-z0-9._]{2,24}$' then raise exception 'TikTok handles use letters, numbers, dots and underscores (2 to 24).'; end if;
    handle := '@' || v_h; url := 'https://www.tiktok.com/@' || v_h;

  elsif p_platform = 'x' then
    if v_host is not null then
      if v_host not in ('x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com') then raise exception 'X links must be on x.com.'; end if;
      v_m := regexp_match(v_path, '^/([A-Za-z0-9_]{1,15})$');
      if v_m is null then raise exception 'Paste your X profile link, for example x.com/yourname.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    v_h := lower(v_h);
    if v_h !~ '^[a-z0-9_]{1,15}$' then raise exception 'X handles use letters, numbers and underscores (up to 15).'; end if;
    handle := '@' || v_h; url := 'https://x.com/' || v_h;

  elsif p_platform = 'youtube' then
    if v_host is not null then
      if v_host not in ('youtube.com','www.youtube.com','m.youtube.com') then raise exception 'YouTube links must be on youtube.com.'; end if;
      v_m := regexp_match(v_path, '^/@([A-Za-z0-9._-]{3,30})$');
      if v_m is null then raise exception 'Paste your YouTube channel link, for example youtube.com/@yourchannel.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    if v_h !~ '^[A-Za-z0-9._-]{3,30}$' then raise exception 'YouTube handles use letters, numbers, dots, dashes and underscores (3 to 30).'; end if;
    handle := '@' || v_h; url := 'https://www.youtube.com/@' || v_h;

  elsif p_platform = 'linkedin' then
    if v_host is not null then
      if v_host not in ('linkedin.com','www.linkedin.com','ke.linkedin.com') then raise exception 'LinkedIn links must be on linkedin.com.'; end if;
      v_m := regexp_match(v_path, '^/(in|company)/([A-Za-z0-9-]{3,100})$');
    else
      v_m := regexp_match(v, '^(in|company)/([A-Za-z0-9-]{3,100})$');
    end if;
    if v_m is null then raise exception 'Paste your LinkedIn link, for example linkedin.com/in/yourname or linkedin.com/company/yourcompany.'; end if;
    handle := lower(v_m[1]) || '/' || lower(v_m[2]); url := 'https://www.linkedin.com/' || handle;

  elsif p_platform = 'telegram' then
    if v_host is not null then
      if v_host not in ('t.me','telegram.me','www.t.me') then raise exception 'Telegram links must be on t.me.'; end if;
      v_m := regexp_match(v_path, '^/([A-Za-z0-9_]{5,32})$');
      if v_m is null then raise exception 'Paste your Telegram link, for example t.me/yourname.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    v_h := lower(v_h);
    if v_h !~ '^[a-z0-9_]{5,32}$' then raise exception 'Telegram usernames use letters, numbers and underscores (5 to 32).'; end if;
    handle := '@' || v_h; url := 'https://t.me/' || v_h;

  elsif p_platform = 'snapchat' then
    if v_host is not null then
      if v_host not in ('snapchat.com','www.snapchat.com') then raise exception 'Snapchat links must be on snapchat.com.'; end if;
      v_m := regexp_match(v_path, '^/add/([A-Za-z0-9._-]{3,15})$');
      if v_m is null then raise exception 'Paste your Snapchat link, for example snapchat.com/add/yourname.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    v_h := lower(v_h);
    if v_h !~ '^[a-z0-9._-]{3,15}$' then raise exception 'Snapchat usernames use letters, numbers, dots, dashes and underscores (3 to 15).'; end if;
    handle := '@' || v_h; url := 'https://www.snapchat.com/add/' || v_h;

  elsif p_platform = 'threads' then
    if v_host is not null then
      if v_host not in ('threads.net','www.threads.net','threads.com','www.threads.com') then raise exception 'Threads links must be on threads.net.'; end if;
      v_m := regexp_match(v_path, '^/@([A-Za-z0-9._]{1,30})$');
      if v_m is null then raise exception 'Paste your Threads profile link, for example threads.net/@yourname.'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    v_h := lower(v_h);
    if v_h !~ '^[a-z0-9._]{1,30}$' then raise exception 'Threads handles use letters, numbers, dots and underscores (up to 30).'; end if;
    handle := '@' || v_h; url := 'https://www.threads.net/@' || v_h;

  elsif p_platform = 'whatsapp_channel' then
    if v_host is not null then
      if v_host not in ('whatsapp.com','www.whatsapp.com') then raise exception 'WhatsApp Channel links must be on whatsapp.com.'; end if;
      v_m := regexp_match(v_path, '^/channel/([A-Za-z0-9]{10,40})$');
      if v_m is null then raise exception 'Paste your WhatsApp Channel link, for example whatsapp.com/channel/…'; end if;
      v_h := v_m[1];
    else v_h := v; end if;
    if v_h !~ '^[A-Za-z0-9]{10,40}$' then raise exception 'WhatsApp Channel codes use letters and numbers (10 to 40).'; end if;
    handle := 'channel/' || v_h; url := 'https://www.whatsapp.com/channel/' || v_h;

  else
    raise exception 'Unsupported platform.';
  end if;
  return next;
end;
$function$;
revoke all on function public.nk_parse_social_link(text,text) from public, anon, authenticated;

-- Replaces the caller's (or their company's) set of social links atomically.
create or replace function public.set_lister_social_links(links jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_uid uuid := auth.uid();
  v_owner uuid;
  v_type text;
  v_item jsonb;
  v_platform text;
  v_input text;
  v_vis boolean;
  v_ord integer := 0;
  v_handle text;
  v_url text;
  v_keep text[] := '{}';
  v_blocked text[] := array['nyumba254','nyumba.254','nyumba_254','admin','support','official','verified'];
  v_b text;
begin
  if v_uid is null then raise exception 'Please sign in.'; end if;
  if links is null or jsonb_typeof(links) <> 'array' then raise exception 'Invalid request.'; end if;
  if jsonb_array_length(links) > 8 then raise exception 'You can add up to 8 social links.'; end if;
  v_owner := public.effective_seller_id();
  select account_type into v_type from public.profiles where id = v_owner;
  if v_type is null or v_type = 'buyer' then raise exception 'Social links are only available to listers.'; end if;

  for v_item in select * from jsonb_array_elements(links) loop
    v_platform := lower(btrim(coalesce(v_item->>'platform', '')));
    v_input := coalesce(nullif(btrim(v_item->>'url'), ''), nullif(btrim(v_item->>'handle'), ''));
    v_vis := coalesce((v_item->>'is_visible')::boolean, true);
    if v_platform = any (v_keep) then raise exception 'Each platform can only be added once.'; end if;
    select p.handle, p.url into v_handle, v_url from public.nk_parse_social_link(v_platform, v_input) p;
    if not public.is_admin() then
      foreach v_b in array v_blocked loop
        if position(v_b in lower(v_handle || ' ' || v_url)) > 0 and v_platform <> 'website' then
          raise exception '%: handles that look like Nyumba254 staff or verification are not allowed.', initcap(replace(v_platform,'_',' '));
        end if;
      end loop;
      if v_platform = 'website' then
        foreach v_b in array v_blocked loop
          if position(v_b in lower(v_handle)) > 0 then
            raise exception 'Website: addresses that look like Nyumba254 staff or verification are not allowed.';
          end if;
        end loop;
      end if;
    end if;
    insert into public.lister_social_links(user_id, platform, handle, url, display_order, is_visible)
    values (v_owner, v_platform, v_handle, v_url, v_ord, v_vis)
    on conflict (user_id, platform) do update
      set handle = excluded.handle, url = excluded.url, display_order = excluded.display_order,
          is_visible = excluded.is_visible, updated_at = now();
    v_keep := v_keep || v_platform;
    v_ord := v_ord + 1;
  end loop;

  delete from public.lister_social_links where user_id = v_owner and not (platform = any (v_keep));

  perform public.nk_log_activity(v_owner, v_uid, 'lister_page', 'social_links_updated', 'lister_social_links', v_owner::text,
    'Updated social links (' || coalesce(array_length(v_keep, 1), 0) || ' saved)', jsonb_build_object('platforms', to_jsonb(v_keep)));

  return public.get_my_social_links();
end;
$function$;
revoke all on function public.set_lister_social_links(jsonb) from public, anon;
grant execute on function public.set_lister_social_links(jsonb) to authenticated;

create or replace function public.get_my_social_links()
returns jsonb
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'platform', l.platform, 'handle', l.handle, 'url', l.url, 'is_visible', l.is_visible,
    'hidden_by_admin', exists (select 1 from public.social_link_moderation m where m.link_id = l.id and m.released_at is null),
    'hidden_reason', (select m.reason from public.social_link_moderation m where m.link_id = l.id and m.released_at is null order by m.created_at desc limit 1)
  ) order by l.display_order, l.created_at), '[]'::jsonb)
  from public.lister_social_links l
  where auth.uid() is not null and l.user_id = public.effective_seller_id();
$function$;
revoke all on function public.get_my_social_links() from public, anon;
grant execute on function public.get_my_social_links() to authenticated;

-- Public read. Only through a visible, non-suspended Lister Page.
create or replace function public.get_lister_social_links(p_handle text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_handle text;
  v_user uuid;
begin
  v_handle := public.get_lister_page_handle(p_handle);
  if v_handle is null then return '[]'::jsonb; end if;
  select id into v_user from public.profiles where lower(handle) = lower(v_handle) and is_disabled is not true limit 1;
  if v_user is null or public.is_seller_suspended(v_user) then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('platform', l.platform, 'handle', l.handle, 'url', l.url) order by l.display_order, l.created_at)
    from public.lister_social_links l
    where l.user_id = v_user and l.is_visible
      and not exists (select 1 from public.social_link_moderation m where m.link_id = l.id and m.released_at is null)
  ), '[]'::jsonb);
end;
$function$;
revoke all on function public.get_lister_social_links(text) from public;
grant execute on function public.get_lister_social_links(text) to anon, authenticated;

-- Aggregate click counter with a per-visitor-per-day throttle.
create or replace function public.record_social_click(p_handle text, p_platform text, p_visitor text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user uuid;
  v_hash text;
  v_day date := (now() at time zone 'Africa/Nairobi')::date;
begin
  if p_platform is null or p_platform not in ('instagram','facebook','tiktok','x','youtube','linkedin','telegram','snapchat','threads','whatsapp_channel','website') then return; end if;
  if p_visitor is null or char_length(p_visitor) < 8 or char_length(p_visitor) > 80 then return; end if;
  select p.id into v_user from public.profiles p
  where lower(p.handle) = lower(public.get_lister_page_handle(p_handle)) limit 1;
  if v_user is null then return; end if;
  if not exists (select 1 from public.lister_social_links l where l.user_id = v_user and l.platform = p_platform and l.is_visible) then return; end if;
  v_hash := md5(p_visitor || '|' || v_day::text || '|' || v_user::text || '|' || p_platform);
  delete from public.lister_social_click_seen where day < v_day - 1;
  insert into public.lister_social_click_seen(visitor_hash, day) values (v_hash, v_day) on conflict do nothing;
  if not found then return; end if;
  insert into public.lister_social_clicks(user_id, platform, day, clicks) values (v_user, p_platform, v_day, 1)
  on conflict (user_id, platform, day) do update set clicks = public.lister_social_clicks.clicks + 1;
end;
$function$;
revoke all on function public.record_social_click(text,text,text) from public;
grant execute on function public.record_social_click(text,text,text) to anon, authenticated;

create or replace function public.get_my_social_click_totals()
returns table (platform text, clicks bigint)
language sql
stable
security definer
set search_path = public
as $function$
  select c.platform, sum(c.clicks)::bigint
  from public.lister_social_clicks c
  where auth.uid() is not null and c.user_id = public.effective_seller_id()
    and c.day >= date_trunc('month', (now() at time zone 'Africa/Nairobi'))::date
  group by c.platform;
$function$;
revoke all on function public.get_my_social_click_totals() from public, anon;
grant execute on function public.get_my_social_click_totals() to authenticated;

-- Admin: hide or restore one link. Logged in admin_logs and in the lister's Activity.
create or replace function public.admin_set_social_link_hidden(p_user uuid, p_platform text, p_hidden boolean, p_reason text)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_link uuid;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_hidden and char_length(btrim(coalesce(p_reason, ''))) < 5 then raise exception 'A reason of at least 5 characters is required.'; end if;
  select id into v_link from public.lister_social_links where user_id = p_user and platform = p_platform;
  if v_link is null then raise exception 'Link not found.'; end if;
  if p_hidden then
    insert into public.social_link_moderation(link_id, hidden_by, reason) values (v_link, auth.uid(), btrim(p_reason));
  else
    update public.social_link_moderation set released_at = now() where link_id = v_link and released_at is null;
  end if;
  insert into public.admin_logs(admin_id, admin_name, action, target_type, target_id, details)
  values (auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), 'admin'),
          case when p_hidden then 'hide_social_link' else 'restore_social_link' end, 'profile', p_user::text,
          p_platform || coalesce(': ' || nullif(btrim(p_reason), ''), ''));
  perform public.nk_log_activity(p_user, auth.uid(), 'lister_page',
    case when p_hidden then 'social_link_hidden' else 'social_link_restored' end, 'lister_social_links', v_link::text,
    case when p_hidden then 'A social link (' || p_platform || ') was hidden by Nyumba254 review' else 'A social link (' || p_platform || ') was restored' end,
    jsonb_build_object('platform', p_platform, 'reason', case when p_hidden then btrim(p_reason) else null end));
end;
$function$;
revoke all on function public.admin_set_social_link_hidden(uuid,text,boolean,text) from public, anon;
grant execute on function public.admin_set_social_link_hidden(uuid,text,boolean,text) to authenticated;

commit;
