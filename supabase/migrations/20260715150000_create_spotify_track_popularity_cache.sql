create table if not exists public.spotify_track_popularity_cache (
  track_id text primary key,
  popularity integer not null check (popularity between 1 and 100),
  track_name text not null,
  artist_name text not null,
  album_name text not null default '',
  image_url text,
  spotify_url text not null,
  source text not null default 'spotify' check (source = 'spotify'),
  captured_at timestamptz not null default timezone('utc', now())
);

alter table public.spotify_track_popularity_cache enable row level security;

drop policy if exists "authenticated can read Spotify popularity cache"
  on public.spotify_track_popularity_cache;

create policy "authenticated can read Spotify popularity cache"
  on public.spotify_track_popularity_cache
  for select
  to authenticated
  using (auth.uid() is not null);

grant select on public.spotify_track_popularity_cache to authenticated;
revoke insert, update, delete on public.spotify_track_popularity_cache
  from anon, authenticated;
