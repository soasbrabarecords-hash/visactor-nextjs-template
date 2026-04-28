-- ============================================================
-- Label OS — Adicionar birth_date à tabela label_entities
-- Rode esse arquivo no SQL Editor do Supabase
-- ============================================================

alter table label_entities
  add column if not exists birth_date date;
