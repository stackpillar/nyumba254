-- Public Lister Pages for the sitemap (service role only).
-- Only 'public' visibility pages with at least one active listing. Unlisted and hidden are excluded.
-- Rollback: drop function public.get_sitemap_lister_pages();
begin;

create or replace function public.get_sitemap_lister_pages()
returns table (handle text, lastmod timestamptz)
language sql
stable
security definer
set search_path = public
as $function$
  select p.handle, max(l.updated_at)
  from public.profiles p
  join public.listings l on l.seller_id = p.id
  where p.handle is not null
    and p.lister_page_visibility = 'public'
    and p.is_disabled is not true
    and public.is_public_lister(p.id)
    and l.status = 'active'
    and coalesce(l.is_disabled, false) = false
    and coalesce(l.recycle_bin, false) = false
    and exists (
      select 1 from public.platform_settings s
      where s.key = 'lister_pages_enabled'
        and lower(trim(both '"' from s.value::text)) in ('true','1')
    )
  group by p.handle
  order by p.handle
  limit 5000;
$function$;
revoke all on function public.get_sitemap_lister_pages() from public, anon, authenticated;
grant execute on function public.get_sitemap_lister_pages() to service_role;

commit;
