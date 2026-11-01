-- PROPOSED, NOT APPLIED. Additive only. Needed for push notifications from the Android app.
create table if not exists public.app_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null default 'android',
  updated_at timestamptz not null default now()
);
create index if not exists app_push_tokens_user_idx on public.app_push_tokens(user_id);
alter table public.app_push_tokens enable row level security;

create policy "own tokens select" on public.app_push_tokens for select using (auth.uid() = user_id);
create policy "own tokens insert" on public.app_push_tokens for insert with check (auth.uid() = user_id);
create policy "own tokens update" on public.app_push_tokens for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tokens delete" on public.app_push_tokens for delete using (auth.uid() = user_id);
