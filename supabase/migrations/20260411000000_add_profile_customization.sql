-- Add titulo and avatar_emoji columns to profiles table
-- Run once in Supabase SQL Editor or via migration

alter table public.profiles
  add column if not exists titulo text not null default 'Coleccionista';

alter table public.profiles
  add column if not exists avatar_emoji text not null default '⚽';

-- Allow users to update their own profile customization
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Allow upsert (insert) so ProfilePage can create the row if missing
drop policy if exists "profiles_upsert_own" on public.profiles;
create policy "profiles_upsert_own" on public.profiles
  for insert with check (auth.uid() = id);
