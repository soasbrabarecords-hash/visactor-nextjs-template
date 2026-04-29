-- ============================================================
-- Spotify Charts — histórico diário persistido
-- Tabelas: chart_snapshots + chart_snapshot_tracks
-- ============================================================

-- 1. chart_snapshots — um registro por data de chart importado
create table if not exists public.chart_snapshots (
  id               uuid primary key default gen_random_uuid(),
  chart_date       date unique not null,
  source           text not null default 'spotify_charts_csv',
  country          text not null default 'BR',
  chart_type       text not null default 'top_200_daily',
  original_filename text,
  total_tracks     integer not null default 0,
  imported_at      timestamptz not null default now()
);

alter table public.chart_snapshots enable row level security;
create policy "authenticated full access" on public.chart_snapshots
  for all to authenticated using (true) with check (true);

create index if not exists chart_snapshots_date_idx
  on public.chart_snapshots (chart_date desc);

-- 2. chart_snapshot_tracks — faixas de cada snapshot diário
create table if not exists public.chart_snapshot_tracks (
  id               uuid primary key default gen_random_uuid(),
  snapshot_id      uuid not null references public.chart_snapshots(id) on delete cascade,
  chart_date       date not null,
  position         integer not null,
  previous_position integer,
  spotify_track_id text,
  track_name       text not null,
  artist_name      text,
  streams          bigint,
  kworb_streams_24h bigint,
  genre            text,
  created_at       timestamptz not null default now()
);

alter table public.chart_snapshot_tracks enable row level security;
create policy "authenticated full access" on public.chart_snapshot_tracks
  for all to authenticated using (true) with check (true);

-- unique: uma faixa por posição por snapshot
create unique index if not exists chart_snapshot_tracks_snapshot_position_key
  on public.chart_snapshot_tracks (snapshot_id, position);

create index if not exists chart_snapshot_tracks_date_pos_idx
  on public.chart_snapshot_tracks (chart_date, position asc);

create index if not exists chart_snapshot_tracks_track_id_idx
  on public.chart_snapshot_tracks (spotify_track_id, chart_date desc);
