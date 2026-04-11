-- Ejecuta este script en Supabase → SQL Editor (una sola vez)

create table if not exists public.user_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  card_number int not null check (card_number >= 1 and card_number <= 800),
  quantity int not null default 1 check (quantity >= 1),
  unique (user_id, card_number)
);

create table if not exists public.trade_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  offer_card int not null check (offer_card >= 1 and offer_card <= 800),
  want_card int not null check (want_card >= 1 and want_card <= 800),
  created_at timestamptz not null default now(),
  active boolean not null default true,
  lat double precision,
  lng double precision
);

create index if not exists user_cards_user_id_idx on public.user_cards (user_id);
create index if not exists trade_posts_active_created_idx on public.trade_posts (active, created_at desc);

alter table public.trade_posts add column if not exists lat double precision;
alter table public.trade_posts add column if not exists lng double precision;

alter table public.user_cards enable row level security;
alter table public.trade_posts enable row level security;

drop policy if exists "user_cards_select_own" on public.user_cards;
create policy "user_cards_select_own" on public.user_cards
  for select using (auth.uid() = user_id);

drop policy if exists "user_cards_insert_own" on public.user_cards;
create policy "user_cards_insert_own" on public.user_cards
  for insert with check (auth.uid() = user_id);

drop policy if exists "user_cards_update_own" on public.user_cards;
create policy "user_cards_update_own" on public.user_cards
  for update using (auth.uid() = user_id);

drop policy if exists "user_cards_delete_own" on public.user_cards;
create policy "user_cards_delete_own" on public.user_cards
  for delete using (auth.uid() = user_id);

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

-- —— Chat (conversaciones entre usuarios con intercambio compatible) ——

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  participant_small uuid not null references auth.users (id) on delete cascade,
  participant_large uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  check (participant_small < participant_large),
  unique (participant_small, participant_large)
);

create index if not exists conversations_participant_small_idx on public.conversations (participant_small);
create index if not exists conversations_participant_large_idx on public.conversations (participant_large);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references auth.users (id) on delete cascade,
  body text not null check (char_length(trim(body)) > 0 and char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists messages_conversation_created_idx on public.messages (conversation_id, created_at);

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
      inner join public.trade_posts their on their.user_id = case
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
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.participant_small or auth.uid() = c.participant_large)
    )
  );

drop policy if exists "messages_insert_member" on public.messages;
create policy "messages_insert_member" on public.messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1
      from public.conversations c
      where c.id = messages.conversation_id
        and (auth.uid() = c.participant_small or auth.uid() = c.participant_large)
    )
  );

-- Realtime: si ya estaba la tabla en la publicación, ignorá el error en el editor
alter publication supabase_realtime add table public.messages;
