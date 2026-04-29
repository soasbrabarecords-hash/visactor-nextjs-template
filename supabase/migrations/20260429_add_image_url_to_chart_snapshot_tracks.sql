-- ============================================================
-- Adiciona coluna image_url em chart_snapshot_tracks
-- Permite exibir capa do álbum na página Spotify Charts — Histórico
-- ============================================================

alter table public.chart_snapshot_tracks
  add column if not exists image_url text;
