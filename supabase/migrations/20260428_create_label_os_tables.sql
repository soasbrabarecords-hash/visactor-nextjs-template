-- ============================================================
-- Label OS — Schema inicial
-- Rode esse arquivo no SQL Editor do Supabase
-- ============================================================

-- 1. Artistas
create table if not exists label_artists (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  artist_name       text,
  email             text,
  phone             text,
  instagram         text,
  spotify_url       text,
  apple_music_url   text,
  youtube_url       text,
  document          text,
  notes             text,
  created_at        timestamptz default now()
);

-- 2. Faixas
create table if not exists label_tracks (
  id               uuid primary key default gen_random_uuid(),
  title            text not null,
  version          text,
  isrc             text,
  upc              text,
  release_date     date,
  status           text default 'draft',
  genre            text,
  bpm              integer,
  key              text,
  explicit         boolean default false,
  cover_url        text,
  audio_url        text,
  contract_url     text,
  notes            text,
  created_at       timestamptz default now()
);

-- 3. Participantes por faixa (splits)
create table if not exists label_track_participants (
  id                    uuid primary key default gen_random_uuid(),
  track_id              uuid references label_tracks(id) on delete cascade,
  artist_id             uuid references label_artists(id) on delete cascade,
  role                  text not null,
  royalty_percentage    numeric default 0,
  publishing_percentage numeric default 0,
  master_percentage     numeric default 0,
  created_at            timestamptz default now()
);

-- ============================================================
-- Storage buckets
-- Crie manualmente no Supabase Dashboard > Storage:
--   label-audio     (privado)
--   label-covers    (público)
--   label-contracts (privado)
-- ============================================================

-- ============================================================
-- RLS (Row Level Security)
-- O projeto usa autenticação Supabase (middleware valida session).
-- Habilite RLS e adicione as políticas abaixo.
-- Se ainda não quiser usar RLS, comente este bloco.
-- ============================================================

alter table label_artists enable row level security;
alter table label_tracks enable row level security;
alter table label_track_participants enable row level security;

-- Política: usuário autenticado pode fazer tudo
create policy "authenticated full access" on label_artists
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on label_tracks
  for all to authenticated using (true) with check (true);

create policy "authenticated full access" on label_track_participants
  for all to authenticated using (true) with check (true);
