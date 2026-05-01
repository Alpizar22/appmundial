create table if not exists notas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  carta_numero integer not null check (carta_numero >= 1 and carta_numero <= 800),
  prioridad text not null default 'media' check (prioridad in ('alta', 'media', 'baja')),
  texto text not null default '',
  created_at timestamptz not null default now()
);

alter table notas enable row level security;

create policy "Users manage own notas"
  on notas for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index notas_user_id_idx on notas (user_id);
