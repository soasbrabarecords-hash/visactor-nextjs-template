-- ============================================================
-- Label OS — Adicionar birth_date à tabela label_artists
-- Rode esse arquivo no SQL Editor do Supabase
-- ============================================================

alter table label_artists
  add column if not exists birth_date date;
