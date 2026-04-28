-- ============================================================
-- Label OS — FASE 2: Tabela label_entities
-- Rode esse arquivo no SQL Editor do Supabase
-- ============================================================

-- 1. Criar tabela
create table if not exists label_entities (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  display_name     text,
  type             text not null default 'artist',
  email            text,
  phone            text,
  instagram        text,
  spotify_url      text,
  apple_music_url  text,
  youtube_url      text,
  document         text,
  notes            text,
  created_at       timestamptz default now()
);

-- 2. RLS
alter table label_entities enable row level security;

create policy "authenticated full access" on label_entities
  for all to authenticated using (true) with check (true);

-- 3. Migrar dados existentes de label_artists → label_entities
-- (apenas artistas que ainda não estejam lá por name)
insert into label_entities (name, display_name, type, email, phone, instagram, spotify_url, apple_music_url, youtube_url, document, notes, created_at)
select
  la.name,
  la.artist_name,
  'artist',
  la.email,
  la.phone,
  la.instagram,
  la.spotify_url,
  la.apple_music_url,
  la.youtube_url,
  la.document,
  la.notes,
  la.created_at
from label_artists la
where not exists (
  select 1 from label_entities le
  where lower(le.name) = lower(la.name)
);
