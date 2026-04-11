-- Create profiles table (idempotent)
create table if not exists public.profiles (
  id        uuid references auth.users on delete cascade primary key,
  is_pro    boolean      not null default false,
  pro_since timestamptz,
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Users can read only their own profile
do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles' and policyname = 'Users can read own profile'
  ) then
    create policy "Users can read own profile"
      on public.profiles for select
      using (auth.uid() = id);
  end if;
end $$;

-- Auto-create a profile row on new user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Drop and recreate trigger to ensure idempotency
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
