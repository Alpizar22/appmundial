-- ============================================================
-- SoccerSticker — schema completo (pega en Supabase SQL Editor)
-- ============================================================

-- ── user_cards ──────────────────────────────────────────────
-- Estructura nueva: carta_id TEXT ('mexico_3'), cantidad INT
-- Se hace DROP CASCADE para limpiar cualquier estado intermedio

drop table if exists public.user_cards cascade;

create table public.user_cards (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  carta_id   text        not null,
  cantidad   integer     not null default 1 check (cantidad >= 1),
  created_at timestamptz not null default now(),
  unique (user_id, carta_id)
);

create index user_cards_user_id_idx on public.user_cards (user_id);

alter table public.user_cards enable row level security;

create policy "user_cards_select_own" on public.user_cards
  for select using (auth.uid() = user_id);

create policy "user_cards_insert_own" on public.user_cards
  for insert with check (auth.uid() = user_id);

create policy "user_cards_update_own" on public.user_cards
  for update using (auth.uid() = user_id);

create policy "user_cards_delete_own" on public.user_cards
  for delete using (auth.uid() = user_id);


-- ── trade_posts ─────────────────────────────────────────────

create table if not exists public.trade_posts (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users (id) on delete cascade,
  offer_card text        not null,
  want_card  text        not null,
  created_at timestamptz not null default now(),
  active     boolean     not null default true,
  lat        double precision,
  lng        double precision
);

create index if not exists trade_posts_active_created_idx
  on public.trade_posts (active, created_at desc);

alter table public.trade_posts enable row level security;

drop policy if exists "trade_posts_select_auth" on public.trade_posts;
create policy "trade_posts_select_auth" on public.trade_posts
  for select using (auth.role() = 'authenticated');

drop policy if exists "trade_posts_insert_own" on public.trade_posts;
create policy "trade_posts_insert_own" on public.trade_posts
  for insert with check (auth.uid() = user_id);

drop policy if exists "trade_posts_update_own" on public.trade_posts;
create policy "trade_posts_update_own" on public.trade_posts
  for update using (auth.uid() = user_id);

drop policy if exists "trade_posts_delete_own" on public.trade_posts;
create policy "trade_posts_delete_own" on public.trade_posts
  for delete using (auth.uid() = user_id);


-- ── profiles ─────────────────────────────────────────────────

create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  is_pro       boolean     not null default false,
  pro_since    timestamptz,
  titulo       text,
  avatar_emoji text,
  tema         text        not null default 'default',
  created_at   timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);


-- ── conversations + messages ─────────────────────────────────

create table if not exists public.conversations (
  id                uuid        primary key default gen_random_uuid(),
  participant_small uuid        not null references auth.users (id) on delete cascade,
  participant_large uuid        not null references auth.users (id) on delete cascade,
  created_at        timestamptz not null default now(),
  check (participant_small < participant_large),
  unique (participant_small, participant_large)
);

create index if not exists conversations_participant_small_idx
  on public.conversations (participant_small);
create index if not exists conversations_participant_large_idx
  on public.conversations (participant_large);

create table if not exists public.messages (
  id              uuid        primary key default gen_random_uuid(),
  conversation_id uuid        not null references public.conversations (id) on delete cascade,
  sender_id       uuid        not null references auth.users (id) on delete cascade,
  body            text        not null
    check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at      timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversations_select_member" on public.conversations;
create policy "conversations_select_member" on public.conversations
  for select using (auth.uid() = participant_small or auth.uid() = participant_large);

drop policy if exists "conversations_insert_compatible" on public.conversations;
create policy "conversations_insert_compatible" on public.conversations
  for insert with check (
    (auth.uid() = participant_small or auth.uid() = participant_large)
    and participant_small < participant_large
    and exists (
      select 1
      from public.trade_posts my
      inner join public.trade_posts their
        on their.user_id = case
          when auth.uid() = participant_small then participant_large
          else participant_small
        end
      where my.user_id = auth.uid()
        and coalesce(my.active, true)
        and coalesce(their.active, true)
        and my.offer_card = their.want_card
        and my.want_card = their.offer_card
    )
  );

drop policy if exists "messages_select_member" on public.messages;
create policy "messages_select_member" on public.messages
  for select using (
    exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.participant_small or auth.uid() = c.participant_large)
    )
  );

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.participant_small or auth.uid() = c.participant_large)
    )
  );


-- ── notas ───────────────────────────────────────────────────

create table if not exists public.notas (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null references auth.users (id) on delete cascade,
  carta_numero text        not null,
  prioridad    text        not null default 'media'
    check (prioridad in ('alta', 'media', 'baja')),
  texto        text        not null default '',
  created_at   timestamptz not null default now()
);

alter table public.notas enable row level security;

drop policy if exists "notas_select_own" on public.notas;
create policy "notas_select_own" on public.notas
  for select using (auth.uid() = user_id);

drop policy if exists "notas_insert_own" on public.notas;
create policy "notas_insert_own" on public.notas
  for insert with check (auth.uid() = user_id);

drop policy if exists "notas_delete_own" on public.notas;
create policy "notas_delete_own" on public.notas
  for delete using (auth.uid() = user_id);


-- ── Realtime ─────────────────────────────────────────────────
-- Ignorá el error si messages ya estaba en la publicación
alter publication supabase_realtime add table public.messages;
