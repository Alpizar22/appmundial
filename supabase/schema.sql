-- whatif.lat — Supabase schema
-- Momentos icónicos + variables predefinidas + historias generadas

create extension if not exists "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.momentos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  titulo text not null,
  titulo_en text,
  descripcion text not null,
  año integer,
  equipos text[],
  tags text[],
  imagen_emoji text default '⚽',
  activo boolean default true,
  orden integer default 0,
  created_at timestamptz not null default now()
);

create index if not exists momentos_activo_orden_idx
  on public.momentos (activo, orden);

create table if not exists public.variables (
  id uuid primary key default gen_random_uuid(),
  momento_id uuid not null references public.momentos(id) on delete cascade,
  texto text not null,
  texto_en text,
  tipo text,
  created_at timestamptz not null default now()
);

create index if not exists variables_momento_idx
  on public.variables (momento_id);

create table if not exists public.historias (
  id uuid primary key default gen_random_uuid(),
  momento_id uuid references public.momentos(id) on delete set null,
  variable_id uuid references public.variables(id) on delete set null,
  variable_custom text,
  narrativa text not null,
  user_id uuid references auth.users(id) on delete set null,
  compartidas integer not null default 0,
  likes integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists historias_created_idx
  on public.historias (created_at desc);

create index if not exists historias_momento_idx
  on public.historias (momento_id, created_at desc);

-- ============================================================
-- RLS
-- ============================================================

alter table public.momentos enable row level security;
alter table public.variables enable row level security;
alter table public.historias enable row level security;

drop policy if exists "momentos_read_anyone" on public.momentos;
create policy "momentos_read_anyone"
  on public.momentos for select
  to anon, authenticated
  using (activo = true);

drop policy if exists "variables_read_anyone" on public.variables;
create policy "variables_read_anyone"
  on public.variables for select
  to anon, authenticated
  using (true);

drop policy if exists "historias_read_anyone" on public.historias;
create policy "historias_read_anyone"
  on public.historias for select
  to anon, authenticated
  using (true);

drop policy if exists "historias_insert_anyone" on public.historias;
create policy "historias_insert_anyone"
  on public.historias for insert
  to anon, authenticated
  with check (true);

drop policy if exists "historias_delete_owner" on public.historias;
create policy "historias_delete_owner"
  on public.historias for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- RPCs (counters via SECURITY DEFINER to bypass RLS safely)
-- ============================================================

create or replace function public.incrementar_compartidas(historia_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.historias set compartidas = compartidas + 1 where id = historia_id;
end;
$$;

create or replace function public.incrementar_likes(historia_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.historias set likes = likes + 1 where id = historia_id;
end;
$$;

grant execute on function public.incrementar_compartidas(uuid) to anon, authenticated;
grant execute on function public.incrementar_likes(uuid) to anon, authenticated;

-- ============================================================
-- SEED: 10 momentos icónicos + variables
-- ============================================================

insert into public.momentos (slug, titulo, titulo_en, descripcion, año, equipos, tags, imagen_emoji, orden)
values
  ('remontada-barcelona-psg-2017',
   'La Remontada 6-1 Barcelona vs PSG',
   'The 6-1 Comeback Barcelona vs PSG',
   'Octavos de Champions 2016/17. El Barça remonta el 0-4 de la ida con un 6-1 histórico en el Camp Nou, sellado por el gol de Sergi Roberto en el 95''.',
   2017, array['Barcelona','PSG'], array['Champions','remontada','Camp Nou'], '🔥', 1),

  ('maracanazo-1950',
   'El Maracanazo Brasil vs Uruguay 1950',
   'The Maracanazo Brazil vs Uruguay 1950',
   'Final del Mundial 1950. Brasil solo necesitaba empatar en casa ante 200.000 aficionados. Uruguay ganó 2-1 con gol de Ghiggia y silenció el Maracaná.',
   1950, array['Brasil','Uruguay'], array['Mundial','Maracaná','final'], '🇺🇾', 2),

  ('mano-de-dios-1986',
   'La Mano de Dios: Argentina vs Inglaterra 1986',
   'Hand of God: Argentina vs England 1986',
   'Cuartos del Mundial México 86. Maradona anota con la mano y luego el "gol del siglo". Argentina 2-1 Inglaterra.',
   1986, array['Argentina','Inglaterra'], array['Mundial','Maradona','México 86'], '✋', 3),

  ('remontada-champions-2018',
   'Real Madrid 3-1 Liverpool, final Champions 2018',
   'Real Madrid 3-1 Liverpool, 2018 Champions Final',
   'Kiev, 2018. Karius comete dos errores garrafales, Bale marca la chilena del año y el Madrid gana su tercera Champions consecutiva.',
   2018, array['Real Madrid','Liverpool'], array['Champions','final','Bale','Karius'], '👑', 4),

  ('islandia-inglaterra-euro-2016',
   'Islandia elimina a Inglaterra, Euro 2016',
   'Iceland knocks out England, Euro 2016',
   'Octavos Euro 2016. Islandia, país de 330.000 habitantes, elimina a Inglaterra 2-1 con el famoso "huh!" thunderclap.',
   2016, array['Islandia','Inglaterra'], array['Euro','sorpresa','underdog'], '🇮🇸', 5),

  ('grecia-campeon-euro-2004',
   'Grecia campeón de Europa 2004',
   'Greece European Champion 2004',
   'Euro 2004 en Portugal. Grecia (150-1 antes del torneo) elimina al anfitrión en la final con gol de Charisteas. Uno de los mayores batacazos.',
   2004, array['Grecia','Portugal'], array['Euro','underdog','Rehhagel'], '🏆', 6),

  ('alemania-brasil-7-1-2014',
   'Alemania 7-1 Brasil, semifinal Mundial 2014',
   'Germany 7-1 Brazil, 2014 World Cup semifinal',
   'Belo Horizonte, 2014. Alemania humilla a Brasil como local con 5 goles en 29 minutos. La peor derrota de la historia brasileña.',
   2014, array['Alemania','Brasil'], array['Mundial','Mineirazo','semifinal'], '😱', 7),

  ('leicester-campeon-premier-2016',
   'Leicester campeón de la Premier League 2015/16',
   'Leicester Premier League Champion 2015/16',
   'Leicester, con cuota 5000-1, gana la Premier con Ranieri, Vardy y Mahrez. El mayor cuento de hadas del fútbol moderno.',
   2016, array['Leicester City'], array['Premier','underdog','Ranieri','Vardy'], '🦊', 8),

  ('argentina-mundial-2022',
   'Argentina campeón del Mundo 2022',
   'Argentina World Champion 2022',
   'Qatar 2022. Argentina vence a Francia 3-3 (4-2 en penales) en la mejor final de la historia. Messi levanta la copa que le faltaba.',
   2022, array['Argentina','Francia'], array['Mundial','Messi','Mbappé','final'], '🐐', 9),

  ('espana-mundial-2010',
   'España campeona del Mundo 2010',
   'Spain World Champion 2010',
   'Sudáfrica 2010. Iniesta marca en el minuto 116 ante Países Bajos y España conquista su primer Mundial con el tiki-taka.',
   2010, array['España','Países Bajos'], array['Mundial','Iniesta','tiki-taka','final'], '🇪🇸', 10)
on conflict (slug) do nothing;

-- Variables por momento (3-4 cada uno)
do $$
declare
  m_id uuid;
begin
  -- Remontada Barcelona-PSG
  select id into m_id from public.momentos where slug = 'remontada-barcelona-psg-2017';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si el árbitro no pita el penal de Suárez?', 'What if the ref doesn''t call Suárez''s penalty?', 'decision'),
    (m_id, '¿Y si Cavani mete el 6-2 y elimina al Barça?', 'What if Cavani scores 6-2 and knocks out Barça?', 'gol'),
    (m_id, '¿Y si Messi está lesionado?', 'What if Messi is injured?', 'lesion'),
    (m_id, '¿Y si Sergi Roberto falla el gol del 95''?', 'What if Sergi Roberto misses the 95th-minute goal?', 'gol');

  -- Maracanazo
  select id into m_id from public.momentos where slug = 'maracanazo-1950';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si Barbosa ataja el gol de Ghiggia?', 'What if Barbosa saves Ghiggia''s goal?', 'gol'),
    (m_id, '¿Y si Brasil juega con Zizinho al 100%?', 'What if Brazil plays with a fit Zizinho?', 'lesion'),
    (m_id, '¿Y si el partido se juega en Uruguay?', 'What if the match is played in Uruguay?', 'decision');

  -- Mano de Dios
  select id into m_id from public.momentos where slug = 'mano-de-dios-1986';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si el árbitro anula la Mano de Dios?', 'What if the ref disallows the Hand of God?', 'decision'),
    (m_id, '¿Y si Maradona es expulsado antes?', 'What if Maradona is sent off earlier?', 'expulsion'),
    (m_id, '¿Y si Inglaterra empata al final?', 'What if England equalizes late?', 'gol'),
    (m_id, '¿Y si el VAR existiera en 1986?', 'What if VAR existed in 1986?', 'decision');

  -- Final Champions 2018
  select id into m_id from public.momentos where slug = 'remontada-champions-2018';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si Karius no comete errores?', 'What if Karius doesn''t make blunders?', 'decision'),
    (m_id, '¿Y si Salah no se lesiona por Ramos?', 'What if Salah isn''t injured by Ramos?', 'lesion'),
    (m_id, '¿Y si Bale no entra desde el banquillo?', 'What if Bale doesn''t come off the bench?', 'decision');

  -- Islandia-Inglaterra
  select id into m_id from public.momentos where slug = 'islandia-inglaterra-euro-2016';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si Rooney no falla ocasiones claras?', 'What if Rooney converts his chances?', 'gol'),
    (m_id, '¿Y si Hodgson pone a Vardy de titular?', 'What if Hodgson starts Vardy?', 'decision'),
    (m_id, '¿Y si Islandia recibe una expulsión temprana?', 'What if Iceland gets an early red card?', 'expulsion');

  -- Grecia 2004
  select id into m_id from public.momentos where slug = 'grecia-campeon-euro-2004';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si Portugal contrata a Rehhagel?', 'What if Portugal hires Rehhagel?', 'fichaje'),
    (m_id, '¿Y si Charisteas no marca en la final?', 'What if Charisteas doesn''t score in the final?', 'gol'),
    (m_id, '¿Y si Figo se retira antes de la Euro?', 'What if Figo retires before the Euro?', 'decision');

  -- Alemania 7-1 Brasil
  select id into m_id from public.momentos where slug = 'alemania-brasil-7-1-2014';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si Neymar no se rompe la vértebra?', 'What if Neymar doesn''t break his vertebra?', 'lesion'),
    (m_id, '¿Y si Thiago Silva no está suspendido?', 'What if Thiago Silva isn''t suspended?', 'expulsion'),
    (m_id, '¿Y si Julio César ataja el primer gol?', 'What if Julio César saves the first goal?', 'gol'),
    (m_id, '¿Y si Scolari cambia de esquema al 3-0?', 'What if Scolari switches formation at 3-0?', 'decision');

  -- Leicester 2016
  select id into m_id from public.momentos where slug = 'leicester-campeon-premier-2016';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si Vardy no encadena 11 partidos anotando?', 'What if Vardy doesn''t score in 11 straight games?', 'gol'),
    (m_id, '¿Y si Mahrez ficha por Arsenal en enero?', 'What if Mahrez signs for Arsenal in January?', 'fichaje'),
    (m_id, '¿Y si Ranieri es despedido en noviembre?', 'What if Ranieri is fired in November?', 'decision');

  -- Argentina 2022
  select id into m_id from public.momentos where slug = 'argentina-mundial-2022';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si Arabia Saudita no gana en fase de grupos?', 'What if Saudi Arabia doesn''t win in the group stage?', 'gol'),
    (m_id, '¿Y si Mbappé mete el hat-trick del triunfo?', 'What if Mbappé scores a winning hat-trick?', 'gol'),
    (m_id, '¿Y si Emiliano Martínez no ataja a Kolo Muani?', 'What if Emiliano Martínez doesn''t save Kolo Muani?', 'decision'),
    (m_id, '¿Y si Di María está lesionado para la final?', 'What if Di María is injured for the final?', 'lesion');

  -- España 2010
  select id into m_id from public.momentos where slug = 'espana-mundial-2010';
  insert into public.variables (momento_id, texto, texto_en, tipo) values
    (m_id, '¿Y si De Jong es expulsado por la patada a Xabi Alonso?', 'What if De Jong is sent off for the kick on Xabi Alonso?', 'expulsion'),
    (m_id, '¿Y si Robben marca el mano a mano ante Casillas?', 'What if Robben scores one-on-one against Casillas?', 'gol'),
    (m_id, '¿Y si Iniesta no marca en el minuto 116?', 'What if Iniesta doesn''t score in the 116th minute?', 'gol');
end $$;
