create table if not exists public.spotify_chart_entries (
  id uuid primary key default gen_random_uuid(),
  spotify_track_id text not null,
  track_name text not null,
  artist_name text not null,
  artist_ids jsonb not null default '[]'::jsonb,
  album_name text not null default '',
  image_url text,
  spotify_url text not null,
  country text not null,
  genre text,
  chart_name text not null default 'top-songs',
  source_type text not null default 'spotify_chart',
  chart_date date not null,
  rank_position integer not null,
  previous_rank integer,
  movement_type text,
  daily_streams bigint,
  captured_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists spotify_chart_entries_country_chart_day_track_key
  on public.spotify_chart_entries (country, chart_name, chart_date, spotify_track_id);

create index if not exists spotify_chart_entries_country_genre_day_idx
  on public.spotify_chart_entries (country, genre, chart_date desc);

create index if not exists spotify_chart_entries_country_chart_rank_idx
  on public.spotify_chart_entries (country, chart_name, chart_date desc, rank_position asc);

create table if not exists public.track_stream_snapshots (
  id uuid primary key default gen_random_uuid(),
  spotify_track_id text not null,
  track_name text not null,
  artist_name text not null,
  artist_ids jsonb not null default '[]'::jsonb,
  album_name text not null default '',
  image_url text,
  spotify_url text not null,
  country text not null,
  genre text,
  chart_name text not null default 'top-songs',
  chart_date date not null,
  daily_streams bigint not null,
  rank_position integer,
  previous_rank integer,
  captured_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists track_stream_snapshots_track_country_chart_day_key
  on public.track_stream_snapshots (spotify_track_id, country, chart_name, chart_date);

create index if not exists track_stream_snapshots_country_day_idx
  on public.track_stream_snapshots (country, chart_name, chart_date desc);

create index if not exists track_stream_snapshots_track_day_idx
  on public.track_stream_snapshots (spotify_track_id, chart_date desc);
