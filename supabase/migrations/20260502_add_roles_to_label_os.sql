-- ============================================================
-- Label OS — roles para artistas e entidades
-- ============================================================

alter table if exists label_artists
  add column if not exists roles text[] not null default '{}'::text[];

alter table if exists label_entities
  add column if not exists roles text[] not null default '{}'::text[];
