begin;

create or replace function public.is_public_lister(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $function$
  select exists (
    select 1
    from public.listings l
    join public.profiles p on p.id = l.seller_id
    where l.seller_id = p_profile_id
      and l.status in ('active', 'occupied')
      and l.is_disabled is false
      and l.recycle_bin is false
      and p.is_disabled is not true
  );
$function$;
revoke all on function public.is_public_lister(uuid) from public;
grant execute on function public.is_public_lister(uuid) to anon, authenticated;

drop policy if exists "Anyone can check email/phone availability" on public.profiles;
drop policy if exists profiles_public_listers_read on public.profiles;
create policy profiles_public_listers_read on public.profiles
  for select to anon
  using (public.is_public_lister(id));
revoke select on table public.profiles from anon;
grant select (id, full_name, created_at, verification_status, account_type, verified_role)
  on table public.profiles to anon;

drop view if exists public.public_account_profiles;
create view public.public_account_profiles
with (security_barrier = true)
as
  select p.id,
         p.full_name,
         p.created_at,
         p.verification_status = 'verified' as identity_verified,
         p.account_type,
         case when p.account_type = 'company' and c.duplicate_review_required
              then null else p.verified_role end as verified_role
  from public.profiles p
  left join public.company_profiles c on c.profile_id = p.id
  where p.is_disabled is not true
    and public.is_public_lister(p.id);
revoke all on public.public_account_profiles from anon, authenticated;
grant select on public.public_account_profiles to anon, authenticated;

create or replace function public.get_public_account_profile(p_profile_id uuid)
returns table (
  id uuid,
  full_name text,
  bio text,
  created_at timestamptz,
  identity_verified boolean,
  account_type text,
  verified_role text,
  company_name text,
  company_type text,
  company_logo_url text,
  company_description text,
  company_website text
)
language sql
stable
security definer
set search_path = public
as $function$
  select p.id, p.full_name, p.bio, p.created_at,
         p.verification_status = 'verified',
         p.account_type,
         case when p.account_type = 'company' and c.duplicate_review_required
              then null else p.verified_role end,
         case when p.account_type = 'company' then c.company_name end,
         case when p.account_type = 'company' then c.company_type end,
         case when p.account_type = 'company'
                    and p.verified_role = 'company'
                    and c.duplicate_review_required is not true
              then c.logo_url end,
         case when p.account_type = 'company' then c.description end,
         case when p.account_type = 'company' then c.website end
  from public.profiles p
  left join public.company_profiles c on c.profile_id = p.id
  where p.id = p_profile_id
    and p.is_disabled is not true
    and (auth.uid() = p.id or public.is_admin());
$function$;
revoke all on function public.get_public_account_profile(uuid) from public, anon;
grant execute on function public.get_public_account_profile(uuid) to authenticated;

create or replace function public.get_public_storefront_profile(p_lookup text)
returns table (
  id uuid,
  storefront_slug text,
  full_name text,
  bio text,
  profile_location text,
  public_phone text,
  created_at timestamptz,
  identity_verified boolean,
  account_type text,
  verified_role text,
  company_name text,
  company_type text,
  company_logo_url text,
  company_description text,
  company_website text,
  storefront_available boolean
)
language sql
stable
security definer
set search_path = public
as $function$
  with free_storefront as (
    select lower(trim(both '"' from coalesce(s.value::text, 'false')))
      in ('true', '1') as enabled
    from (select 1) seed
    left join public.platform_settings s on s.key = 'storefront_free_enabled'
  ),
  storefront_access as (
    select p.id,
           fs.enabled
             or (
               p.subscription_plan = 'elite'
               and coalesce(p.subscription_tier, 'none') <> 'none'
               and (p.subscription_expires_at is null or p.subscription_expires_at > now())
             ) as available
    from public.profiles p
    cross join free_storefront fs
  )
  select p.id,
         p.storefront_slug,
         p.full_name,
         case when access.available then p.bio end,
         case when access.available then p.profile_location end,
         case when access.available
                    and p.public_phone_visible
                    and p.hide_buyer_contact is not true
              then p.phone end,
         p.created_at,
         p.verification_status = 'verified',
         p.account_type,
         case when p.account_type = 'company' and c.duplicate_review_required
              then null else p.verified_role end,
         case when access.available and p.account_type = 'company' then c.company_name end,
         case when access.available and p.account_type = 'company' then c.company_type end,
         case when access.available
                    and p.account_type = 'company'
                    and p.verified_role = 'company'
                    and c.duplicate_review_required is not true
              then c.logo_url end,
         case when access.available and p.account_type = 'company' then c.description end,
         case when access.available and p.account_type = 'company' then c.website end,
         access.available
  from public.profiles p
  join storefront_access access on access.id = p.id
  left join public.company_profiles c on c.profile_id = p.id
  where p.is_disabled is not true
    and public.is_public_lister(p.id)
    and (
      (p_lookup ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and p.id::text = lower(p_lookup))
      or
      (p_lookup !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and p.storefront_slug = p_lookup)
    );
$function$;
revoke all on function public.get_public_storefront_profile(text) from public;
grant execute on function public.get_public_storefront_profile(text) to anon, authenticated;

commit;
