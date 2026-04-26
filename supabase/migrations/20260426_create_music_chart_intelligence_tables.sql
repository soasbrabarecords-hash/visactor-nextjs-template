create extension if not exists pgcrypto;

create table if not exists public.music_chart_snapshots (
  id uuid primary key default gen_random_uuid()
);

alter table public.music_chart_snapshots
  add column if not exists spotify_track_id text,
  add column if not exists track_name text,
  add column if not exists artist_name text,
  add column if not exists artist_ids jsonb not null default '[]'::jsonb,
  add column if not exists album_name text,
  add column if not exists image_url text,
  add column if not exists spotify_url text,
  add column if not exists popularity integer not null default 0,
  add column if not exists rank_position integer not null default 0,
  add column if not exists source_type text not null default 'search',
  add column if not exists source_name text not null default 'Search fallback',
  add column if not exists country text,
  add column if not exists genre text not null default 'all',
  add column if not exists saturation_count integer not null default 1,
  add column if not exists snapshot_day date not null default ((now() at time zone 'utc')::date),
  add column if not exists captured_at timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'music_chart_snapshots'
      and column_name = 'track_id'
  ) then
    execute '
      update public.music_chart_snapshots
      set
        spotify_track_id = coalesce(spotify_track_id, track_id),
        source_name = coalesce(source_name, source, ''Search fallback''),
        source_type = coalesce(source_type, source, ''search''),
        snapshot_day = coalesce(snapshot_day, (captured_at at time zone ''utc'')::date)
      where spotify_track_id is null or source_name is null or source_type is null
    ';
  end if;
end $$;

create unique index if not exists music_chart_snapshots_country_genre_track_day_key
  on public.music_chart_snapshots (country, genre, spotify_track_id, snapshot_day);

create index if not exists music_chart_snapshots_country_genre_rank_idx
  on public.music_chart_snapshots (country, genre, snapshot_day desc, rank_position asc);

create index if not exists music_chart_snapshots_track_day_idx
  on public.music_chart_snapshots (spotify_track_id, snapshot_day desc);

create table if not exists public.music_chart_movements (
  id uuid primary key default gen_random_uuid()
);

alter table public.music_chart_movements
  add column if not exists spotify_track_id text,
  add column if not exists current_rank integer not null default 0,
  add column if not exists previous_rank integer,
  add column if not exists rank_change integer,
  add column if not exists movement_type text not null default 'new',
  add column if not exists popularity_current integer not null default 0,
  add column if not exists popularity_previous integer,
  add column if not exists popularity_change integer,
  add column if not exists days_on_chart integer not null default 1,
  add column if not exists saturation_count integer not null default 1,
  add column if not exists opportunity_score numeric(6,2) not null default 0,
  add column if not exists intelligence_tags jsonb not null default '[]'::jsonb,
  add column if not exists country text,
  add column if not exists genre text not null default 'all',
  add column if not exists snapshot_day date not null default ((now() at time zone 'utc')::date),
  add column if not exists calculated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'music_chart_movements'
      and column_name = 'track_id'
  ) then
    execute '
      update public.music_chart_movements
      set
        spotify_track_id = coalesce(spotify_track_id, track_id),
        snapshot_day = coalesce(snapshot_day, (last_seen_at at time zone ''utc'')::date),
        calculated_at = coalesce(calculated_at, last_seen_at)
      where spotify_track_id is null
    ';
  end if;
end $$;

create unique index if not exists music_chart_movements_country_genre_track_day_key
  on public.music_chart_movements (country, genre, spotify_track_id, snapshot_day);

create index if not exists music_chart_movements_country_genre_rank_idx
  on public.music_chart_movements (country, genre, snapshot_day desc, current_rank asc);

create index if not exists music_chart_movements_track_day_idx
  on public.music_chart_movements (spotify_track_id, snapshot_day desc);
