-- ============================================================
-- Label OS — FASE 3: Adicionar entity_id em label_track_participants
-- Rode esse arquivo no SQL Editor do Supabase
-- NÃO remove artist_id — compatibilidade mantida
-- ============================================================

alter table label_track_participants
  add column if not exists entity_id uuid references label_entities(id) on delete set null;
