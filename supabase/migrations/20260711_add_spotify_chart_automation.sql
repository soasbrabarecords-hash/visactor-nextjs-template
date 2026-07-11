-- Spotify Charts automatic daily ingestion. This does not depend on Spotify OAuth.

create table if not exists public.spotify_chart_entries (
  id uuid primary key default gen_random_uuid(),
  chart_type text not null,
  country text not null,
  chart_date date not null,
  rank integer not null,
  previous_rank integer,
  track_name text not null,
  artist_names text not null,
  spotify_track_uri text,
  spotify_track_id text,
  streams bigint,
  raw_row jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  artist_name text not null default '',
  artist_ids jsonb not null default '[]'::jsonb,
  album_name text not null default '',
  image_url text,
  spotify_url text,
  genre text,
  chart_name text not null default 'top-songs',
  source_type text not null default 'spotify_chart',
  rank_position integer not null,
  movement_type text,
  daily_streams bigint,
  captured_at timestamptz not null default now()
);

alter table public.spotify_chart_entries
  add column if not exists chart_type text,
  add column if not exists rank integer,
  add column if not exists artist_names text,
  add column if not exists spotify_track_uri text,
  add column if not exists streams bigint,
  add column if not exists raw_row jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.spotify_chart_entries
  alter column spotify_track_id drop not null,
  alter column spotify_url drop not null;

update public.spotify_chart_entries
set
  chart_type = coalesce(chart_type, chart_name, 'top-songs'),
  rank = coalesce(rank, rank_position),
  artist_names = coalesce(artist_names, artist_name, ''),
  spotify_track_uri = coalesce(
    spotify_track_uri,
    case
      when spotify_track_id is not null then 'spotify:track:' || spotify_track_id
      else null
    end
  ),
  streams = coalesce(streams, daily_streams)
where chart_type is null
   or rank is null
   or artist_names is null
   or (streams is null and daily_streams is not null)
   or (spotify_track_uri is null and spotify_track_id is not null);

alter table public.spotify_chart_entries
  alter column chart_type set not null,
  alter column rank set not null,
  alter column artist_names set not null;

create unique index if not exists spotify_chart_entries_automatic_track_key
  on public.spotify_chart_entries (chart_type, country, chart_date, spotify_track_id)
  where spotify_track_id is not null;

create unique index if not exists spotify_chart_entries_automatic_rank_fallback_key
  on public.spotify_chart_entries (chart_type, country, chart_date, rank)
  where spotify_track_id is null;

create table if not exists public.spotify_chart_runs (
  id uuid primary key default gen_random_uuid(),
  chart_type text not null,
  country text not null,
  chart_date date not null,
  source_url text,
  source_type text,
  status text not null,
  rows_count integer not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists spotify_chart_runs_latest_idx
  on public.spotify_chart_runs (started_at desc);

alter table public.spotify_chart_entries enable row level security;
alter table public.spotify_chart_runs enable row level security;

do $migration$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('spotify_chart_entries', 'spotify_chart_runs')
      and cmd in ('ALL', 'INSERT', 'UPDATE', 'DELETE')
      and roles && array['public'::name, 'anon'::name]
  loop
    execute format(
      'drop policy %I on %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'spotify_chart_entries'
      and cmd in ('SELECT', 'ALL')
      and roles @> array['authenticated'::name]
  ) then
    create policy "authenticated can read spotify chart entries"
      on public.spotify_chart_entries
      for select
      to authenticated
      using (true);
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'spotify_chart_runs'
      and cmd in ('SELECT', 'ALL')
      and roles @> array['authenticated'::name]
  ) then
    create policy "authenticated can read spotify chart runs"
      on public.spotify_chart_runs
      for select
      to authenticated
      using (true);
  end if;
end
$migration$;

-- The original schema used chart_date as globally unique, which prevents BR and
-- Global snapshots from coexisting on the same day.
alter table public.chart_snapshots
  drop constraint if exists chart_snapshots_chart_date_key;

create unique index if not exists chart_snapshots_country_type_date_key
  on public.chart_snapshots (country, chart_type, chart_date);
