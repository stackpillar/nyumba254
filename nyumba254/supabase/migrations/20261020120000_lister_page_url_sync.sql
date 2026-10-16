-- Lister Page URL sync (B4). Idempotent.
-- Rollback: drop function public.get_lister_page_handle(text);
--   and recreate public.public_account_profiles without page_handle/page_visibility.
begin;

create or replace view public.public_account_profiles
with (security_barrier = true)
as
  select p.id,
         p.full_name,
         p.created_at,
         p.verification_status = 'verified' as identity_verified,
         p.account_type,
         case when p.account_type = 'company' and c.duplicate_review_required
              then null else p.verified_role end as verified_role,
         case when p.handle is not null
                and p.lister_page_visibility = 'public'
                and exists (
                  select 1 from public.platform_settings s
                  where s.key = 'lister_pages_enabled'
                    and lower(trim(both '"' from s.value::text)) in ('true','1')
                ) then p.handle end as page_handle,
         p.lister_page_visibility as page_visibility
  from public.profiles p
  left join public.company_profiles c on c.profile_id = p.id
  where p.is_disabled is not true
    and public.is_public_lister(p.id);
revoke all on public.public_account_profiles from anon, authenticated;
grant select on public.public_account_profiles to anon, authenticated;

-- Resolves a UUID, legacy storefront slug or handle to the canonical handle.
-- Hidden pages and suspended accounts resolve to null.
create or replace function public.get_lister_page_handle(p_lookup text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_lookup text := btrim(coalesce(p_lookup, ''));
  v_handle text;
begin
  if v_lookup = '' then return null; end if;
  select p.handle into v_handle
  from public.profiles p
  where p.handle is not null
    and p.lister_page_visibility in ('public','unlisted')
    and p.is_disabled is not true
    and (
      p.id::text = lower(v_lookup)
      or p.storefront_slug = v_lookup
      or lower(p.handle) = lower(v_lookup)
    )
  limit 1;
  if v_handle is null then return null; end if;
  if public.get_public_lister_page(v_handle) is null then return null; end if;
  return v_handle;
end;
$function$;
revoke all on function public.get_lister_page_handle(text) from public;
grant execute on function public.get_lister_page_handle(text) to anon, authenticated;

-- Old handles keep redirecting for 90 days only.
do $alias$
declare v_def text;
begin
  v_def := pg_get_functiondef('public.get_public_lister_page(text)'::regprocedure);
  if position('interval ''90 days''' in v_def) = 0 then
    v_def := replace(v_def,
      'and h.profile_id = p.id',
      'and h.profile_id = p.id and h.replaced_at > now() - interval ''90 days''');
    execute v_def;
  end if;
end;
$alias$;

commit;
