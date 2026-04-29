create extension if not exists pgcrypto;

create table if not exists public.music_chart_snapshots (
  id uuid primary key default gen_random_uuid(),
  track_id text not null,
  track_name text not null,
  artist_name text not null,
  album_name text,
  image_url text,
  spotify_url text not null,
  popularity integer not null default 0,
  country text not null,
  genre text not null,
  rank_position integer not null,
  source text not null,
  captured_at timestamptz not null default now()
);

create index if not exists music_chart_snapshots_track_idx
  on public.music_chart_snapshots (track_id, captured_at desc);

create index if not exists music_chart_snapshots_market_idx
  on public.music_chart_snapshots (country, genre, captured_at desc, rank_position asc);

create table if not exists public.music_chart_movements (
  id uuid primary key default gen_random_uuid(),
  track_id text not null,
  country text not null,
  genre text not null,
  current_rank integer not null,
  previous_rank integer,
  rank_change integer,
  movement_type text not null,
  days_on_chart integer not null default 1,
  last_seen_at timestamptz not null default now()
);

create unique index if not exists music_chart_movements_unique_idx
  on public.music_chart_movements (track_id, country, genre, last_seen_at);

create table if not exists public.playlist_snapshots (
  id uuid primary key default gen_random_uuid(),
  playlist_id text not null,
  playlist_name text not null,
  followers bigint not null default 0,
  total_tracks integer not null default 0,
  score integer not null default 0,
  captured_at timestamptz not null default now()
);

create index if not exists playlist_snapshots_playlist_idx
  on public.playlist_snapshots (playlist_id, captured_at desc);

create table if not exists public.playlist_track_snapshots (
  id uuid primary key default gen_random_uuid(),
  playlist_id text not null,
  track_id text not null,
  track_name text not null,
  artist_name text not null,
  popularity integer not null default 0,
  position integer not null default 0,
  captured_at timestamptz not null default now()
);

create index if not exists playlist_track_snapshots_playlist_idx
  on public.playlist_track_snapshots (playlist_id, captured_at desc, position asc);

create index if not exists playlist_track_snapshots_track_idx
  on public.playlist_track_snapshots (track_id, captured_at desc);
