begin;

alter table public.profiles
  add column if not exists profile_location text,
  add column if not exists public_phone_visible boolean not null default false;

insert into public.platform_settings (key, value)
values ('storefront_free_enabled', '1'::jsonb)
on conflict (key) do nothing;

create table if not exists public.account_type_change_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  current_account_type text not null
    check (current_account_type in ('buyer', 'owner', 'caretaker', 'agent', 'company')),
  requested_account_type text not null
    check (requested_account_type in ('buyer', 'owner', 'caretaker', 'agent', 'company')),
  reason text not null check (length(btrim(reason)) between 10 and 1000),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null,
  check (current_account_type <> requested_account_type)
);
create unique index if not exists account_type_change_requests_one_pending
  on public.account_type_change_requests(profile_id)
  where status = 'pending';
create index if not exists account_type_change_requests_pending_idx
  on public.account_type_change_requests(submitted_at desc)
  where status = 'pending';
alter table public.account_type_change_requests enable row level security;
drop policy if exists account_type_change_requests_read_own_or_admin
  on public.account_type_change_requests;
create policy account_type_change_requests_read_own_or_admin
  on public.account_type_change_requests for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.account_type_change_requests
  from public, anon, authenticated;
grant select on public.account_type_change_requests to authenticated;

create table if not exists public.role_verification_submissions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  account_type text not null
    check (account_type in ('owner', 'caretaker', 'agent', 'company')),
  document_paths text[] not null
    check (cardinality(document_paths) between 1 and 5),
  applicant_note text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  admin_note text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles(id) on delete set null
);
create unique index if not exists role_verification_one_pending
  on public.role_verification_submissions(profile_id)
  where status = 'pending';
create index if not exists role_verification_pending_idx
  on public.role_verification_submissions(submitted_at desc)
  where status = 'pending';
alter table public.role_verification_submissions enable row level security;
drop policy if exists role_verification_read_own_or_admin
  on public.role_verification_submissions;
create policy role_verification_read_own_or_admin
  on public.role_verification_submissions for select to authenticated
  using (profile_id = auth.uid() or public.is_admin());
revoke insert, update, delete on public.role_verification_submissions
  from public, anon, authenticated;
grant select on public.role_verification_submissions to authenticated;

create or replace function public.cancel_stale_role_verification_on_role_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.account_type is distinct from old.account_type then
    update public.role_verification_submissions
    set status = 'rejected',
        admin_note = 'Your selected role changed before review. Submit evidence for your current role.',
        reviewed_at = now(),
        reviewed_by = null
    where profile_id = new.id and status = 'pending';
  end if;
  return new;
end;
$function$;
drop trigger if exists cancel_stale_role_verification_on_role_change on public.profiles;
create trigger cancel_stale_role_verification_on_role_change
  after update of account_type on public.profiles
  for each row execute function public.cancel_stale_role_verification_on_role_change();

drop policy if exists role_verification_docs_own_upload on storage.objects;
create policy role_verification_docs_own_upload on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'role-verification'
  );
drop policy if exists role_verification_docs_own_unsubmitted_delete on storage.objects;
create policy role_verification_docs_own_unsubmitted_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
    and (storage.foldername(name))[2] = 'role-verification'
    and not exists (
      select 1
      from public.role_verification_submissions s
      where s.profile_id = auth.uid()
        and name = any(s.document_paths)
    )
  );
drop policy if exists role_verification_docs_admin_read on storage.objects;
create policy role_verification_docs_admin_read on storage.objects
  for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_admin());

create or replace function public.submit_account_type_change_request(
  p_account_type text,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_current_type text;
  v_disabled boolean;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_account_type is null
     or p_account_type not in ('buyer', 'owner', 'caretaker', 'agent', 'company') then
    raise exception 'Choose a supported account type';
  end if;
  if p_reason is null or length(btrim(p_reason)) not between 10 and 1000 then
    raise exception 'Explain the requested role change in 10 to 1000 characters';
  end if;

  select account_type, is_disabled
    into v_current_type, v_disabled
  from public.profiles
  where id = v_user_id
  for update;
  if not found or v_disabled then
    raise exception 'This account cannot request a role change';
  end if;
  if v_current_type is null then
    raise exception 'Choose an account type before requesting a role change';
  end if;
  if v_current_type = p_account_type then
    raise exception 'The requested role is already selected';
  end if;

  insert into public.account_type_change_requests
    (profile_id, current_account_type, requested_account_type, reason)
  values (v_user_id, v_current_type, p_account_type, btrim(p_reason))
  returning id into v_request_id;
  return v_request_id;
exception
  when unique_violation then
    raise exception 'You already have a role change request awaiting review';
end;
$function$;

create or replace function public.admin_review_account_type_change_request(
  p_request_id uuid,
  p_approved boolean,
  p_admin_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_request public.account_type_change_requests%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;

  select * into v_request
  from public.account_type_change_requests
  where id = p_request_id
  for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'This role change request is no longer pending';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_request.profile_id
  for update;
  if not found then
    raise exception 'The requesting profile no longer exists';
  end if;
  if p_approved and v_profile.account_type is distinct from v_request.current_account_type then
    raise exception 'The account role changed after this request was submitted; review the latest profile';
  end if;
  if p_admin_note is not null and length(p_admin_note) > 1000 then
    raise exception 'Admin note must be 1000 characters or fewer';
  end if;

  if p_approved then
    insert into public.role_history(profile_id, previous_account_type, new_account_type)
    values (v_profile.id, v_profile.account_type, v_request.requested_account_type);

    perform set_config('nyumba254.account_type_rpc', '1', true);
    update public.profiles
    set account_type = v_request.requested_account_type,
        account_type_set_at = now(),
        account_type_first_set_at = coalesce(account_type_first_set_at, now()),
        account_type_correction_used = true,
        account_type_cooldown_until = now() + interval '7 days',
        onboarding_completed = true,
        verified_role = null
    where id = v_profile.id;

    if v_profile.account_type in ('agent', 'company')
       and v_request.requested_account_type not in ('agent', 'company') then
      insert into public.viewing_fee_history
        (object_type, object_id, changed_by, old_fee, new_fee)
      select 'listing', f.listing_id, auth.uid(), f.viewing_fee, 0
      from public.listing_viewing_fees f
      join public.listings l on l.id = f.listing_id
      where l.seller_id = v_profile.id and f.viewing_fee > 0;
      delete from public.listing_viewing_fees f
      using public.listings l
      where f.listing_id = l.id and l.seller_id = v_profile.id;
    end if;

    insert into public.notifications(seller_id, type, title, body, link)
    values (
      v_profile.id,
      'profile',
      'Role change approved',
      'Your account role is now ' || v_request.requested_account_type || '.',
      '/dashboard.html'
    );
  elsif p_admin_note is not null and length(btrim(p_admin_note)) > 0 then
    insert into public.notifications(seller_id, type, title, body, link)
    values (
      v_profile.id,
      'profile',
      'Role change request update',
      'Your role change request was not approved. ' || btrim(p_admin_note),
      '/dashboard.html'
    );
  end if;

  update public.account_type_change_requests
  set status = case when p_approved then 'approved' else 'rejected' end,
      admin_note = nullif(btrim(p_admin_note), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_request_id;
  return case when p_approved then 'approved' else 'rejected' end;
end;
$function$;

create or replace function public.submit_role_verification(
  p_document_paths text[],
  p_applicant_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid := auth.uid();
  v_role text;
  v_disabled boolean;
  v_submission_id uuid;
  v_path text;
begin
  if v_user_id is null then
    raise exception 'Authentication is required';
  end if;
  if p_document_paths is null or cardinality(p_document_paths) not between 1 and 5 then
    raise exception 'Upload between one and five role-supporting documents';
  end if;
  if p_applicant_note is not null and length(p_applicant_note) > 1000 then
    raise exception 'Note must be 1000 characters or fewer';
  end if;
  foreach v_path in array p_document_paths loop
    if v_path is null
       or v_path !~ ('^' || v_user_id::text || '/role-verification/[A-Za-z0-9._-]+$') then
      raise exception 'A role-verification document path is invalid';
    end if;
    if not exists (
      select 1 from storage.objects
      where bucket_id = 'verification-docs' and name = v_path
    ) then
      raise exception 'A role-verification document was not uploaded successfully';
    end if;
  end loop;

  select account_type, is_disabled
    into v_role, v_disabled
  from public.profiles
  where id = v_user_id
  for update;
  if not found or v_disabled then
    raise exception 'This account cannot submit role verification';
  end if;
  if v_role is null or v_role not in ('owner', 'caretaker', 'agent', 'company') then
    raise exception 'Select an owner, caretaker, agent, or company role first';
  end if;
  if exists (
    select 1 from public.profiles
    where id = v_user_id and verified_role = v_role
  ) then
    raise exception 'Your selected role is already verified';
  end if;

  insert into public.role_verification_submissions
    (profile_id, account_type, document_paths, applicant_note)
  values (v_user_id, v_role, p_document_paths, nullif(btrim(p_applicant_note), ''))
  returning id into v_submission_id;
  return v_submission_id;
exception
  when unique_violation then
    raise exception 'A role-verification submission is already awaiting review';
end;
$function$;

create or replace function public.admin_review_role_verification(
  p_submission_id uuid,
  p_approved boolean,
  p_admin_note text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_submission public.role_verification_submissions%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Administrator access is required';
  end if;
  if p_admin_note is not null and length(p_admin_note) > 1000 then
    raise exception 'Admin note must be 1000 characters or fewer';
  end if;

  select * into v_submission
  from public.role_verification_submissions
  where id = p_submission_id
  for update;
  if not found or v_submission.status <> 'pending' then
    raise exception 'This role-verification submission is no longer pending';
  end if;
  select * into v_profile
  from public.profiles
  where id = v_submission.profile_id
  for update;
  if not found then
    raise exception 'The submitting profile no longer exists';
  end if;
  if p_approved and v_profile.account_type is distinct from v_submission.account_type then
    raise exception 'The account role changed after submission; reject this stale verification';
  end if;

  if p_approved then
    perform set_config('nyumba254.role_verification_rpc', '1', true);
    update public.profiles
    set verified_role = v_submission.account_type
    where id = v_profile.id;
  end if;

  update public.role_verification_submissions
  set status = case when p_approved then 'approved' else 'rejected' end,
      admin_note = nullif(btrim(p_admin_note), ''),
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = p_submission_id;

  insert into public.notifications(seller_id, type, title, body, link)
  values (
    v_profile.id,
    'profile',
    case when p_approved then 'Role verified' else 'Role verification update' end,
    case when p_approved
      then 'Your ' || v_submission.account_type || ' role is verified.'
      else 'Your role verification needs changes.' ||
        case when nullif(btrim(p_admin_note), '') is null then '' else ' ' || btrim(p_admin_note) end
    end,
    '/dashboard.html'
  );
  return case when p_approved then 'approved' else 'rejected' end;
end;
$function$;

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
  )
  select p.id,
         p.storefront_slug,
         p.full_name,
         p.bio,
         p.profile_location,
         case when p.public_phone_visible and p.hide_buyer_contact is not true
              then p.phone end,
         p.created_at,
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
         case when p.account_type = 'company' then c.website end,
         coalesce((select enabled from free_storefront), false)
           or (
             p.subscription_plan = 'elite'
             and coalesce(p.subscription_tier, 'none') <> 'none'
             and (p.subscription_expires_at is null or p.subscription_expires_at > now())
           )
  from public.profiles p
  left join public.company_profiles c on c.profile_id = p.id
  where p.is_disabled is not true
    and (
      (p_lookup ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and p.id::text = lower(p_lookup))
      or
      (p_lookup !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       and p.storefront_slug = p_lookup)
    );
$function$;

revoke all on function public.submit_account_type_change_request(text, text) from public, anon;
grant execute on function public.submit_account_type_change_request(text, text) to authenticated;
revoke all on function public.admin_review_account_type_change_request(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_account_type_change_request(uuid, boolean, text) to authenticated;
revoke all on function public.submit_role_verification(text[], text) from public, anon;
grant execute on function public.submit_role_verification(text[], text) to authenticated;
revoke all on function public.admin_review_role_verification(uuid, boolean, text) from public, anon;
grant execute on function public.admin_review_role_verification(uuid, boolean, text) to authenticated;
revoke all on function public.get_public_storefront_profile(text) from public;
grant execute on function public.get_public_storefront_profile(text) to anon, authenticated;

commit;
