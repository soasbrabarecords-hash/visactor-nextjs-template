create table if not exists public.music_track_snapshots (
  id uuid primary key default gen_random_uuid(),
  market text not null,
  genre text not null,
  track_id text not null,
  snapshot_date date not null default ((now() at time zone 'utc')::date),
  captured_at timestamptz not null default timezone('utc', now()),
  track_name text not null,
  artists text not null,
  album_name text not null,
  cover_url text,
  spotify_url text not null,
  popularity integer not null default 0,
  signal_count integer not null default 0,
  source_mode text not null default 'search',
  explicit boolean not null default false
);

create unique index if not exists music_track_snapshots_market_genre_track_day_key
  on public.music_track_snapshots (market, genre, track_id, snapshot_date);

create index if not exists music_track_snapshots_market_genre_date_idx
  on public.music_track_snapshots (market, genre, snapshot_date desc);

create index if not exists music_track_snapshots_track_date_idx
  on public.music_track_snapshots (track_id, snapshot_date desc);
