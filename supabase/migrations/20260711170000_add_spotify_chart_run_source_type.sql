alter table public.spotify_chart_runs
  add column if not exists source_type text;

comment on column public.spotify_chart_runs.source_type is
  'Backend source used by the run: spotify_official or kworb.';
