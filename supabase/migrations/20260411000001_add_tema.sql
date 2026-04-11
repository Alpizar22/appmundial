-- Add tema column to sync visual theme across devices
alter table public.profiles
  add column if not exists tema text not null default 'default';
