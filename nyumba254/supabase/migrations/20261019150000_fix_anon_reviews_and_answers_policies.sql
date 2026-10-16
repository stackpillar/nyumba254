-- Anonymous visitors cannot read profiles columns used inside these SELECT policies.
-- Use security-definer helpers so public reviews and Quick Answers load without a login.

alter policy reviews_public_select on public.reviews
  using (status = 'published' or public.is_admin());

create or replace function public.lister_page_is_visible(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select exists (
    select 1 from public.profiles p
    where p.id = p_profile_id and p.lister_page_visibility in ('public', 'unlisted')
  );
$function$;
revoke all on function public.lister_page_is_visible(uuid) from public;
grant execute on function public.lister_page_is_visible(uuid) to anon, authenticated;

drop policy if exists lister_quick_answers_public_or_owner_read on public.lister_quick_answers;
create policy lister_quick_answers_public_or_owner_read on public.lister_quick_answers
  for select to anon, authenticated using (
    lister_id = public.effective_seller_id() or (
      public.is_public_lister(lister_id)
      and public.lister_page_is_visible(lister_id)
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
