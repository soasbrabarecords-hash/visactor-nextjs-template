-- ============================================================
-- Label OS — FASE 4: Tabelas de splits profissionais
-- Rode esse arquivo no SQL Editor do Supabase
-- NÃO remove label_track_participants (compatibilidade mantida)
-- ============================================================

-- 1. Obra — compositores e splits de publishing
create table if not exists label_track_compositions (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid references label_tracks(id) on delete cascade,
  entity_id   uuid references label_entities(id) on delete cascade,
  role        text default 'composer',
  percentage  numeric default 0,
  created_at  timestamptz default now()
);

alter table label_track_compositions enable row level security;
create policy "authenticated full access" on label_track_compositions
  for all to authenticated using (true) with check (true);

-- 2. Fonograma — master splits por grupo
create table if not exists label_track_master_splits (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid references label_tracks(id) on delete cascade,
  entity_id   uuid references label_entities(id) on delete cascade,
  group_type  text not null, -- interpreter | phonographic_producer | musician
  role        text,
  percentage  numeric default 0,
  created_at  timestamptz default now()
);

alter table label_track_master_splits enable row level security;
create policy "authenticated full access" on label_track_master_splits
  for all to authenticated using (true) with check (true);

-- 3. Royalties Share
create table if not exists label_track_royalty_splits (
  id          uuid primary key default gen_random_uuid(),
  track_id    uuid references label_tracks(id) on delete cascade,
  entity_id   uuid references label_entities(id) on delete cascade,
  role        text,
  percentage  numeric default 0,
  recoupable  boolean default false,
  notes       text,
  created_at  timestamptz default now()
);

alter table label_track_royalty_splits enable row level security;
create policy "authenticated full access" on label_track_royalty_splits
  for all to authenticated using (true) with check (true);
