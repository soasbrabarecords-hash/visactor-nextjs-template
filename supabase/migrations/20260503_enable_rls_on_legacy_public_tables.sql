do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'playlists'
  ) then
    execute 'alter table public.playlists enable row level security';

    execute 'drop policy if exists "authenticated can read playlists" on public.playlists';
    execute 'drop policy if exists "authenticated can insert playlists" on public.playlists';
    execute 'drop policy if exists "authenticated can update playlists" on public.playlists';

    execute '
      create policy "authenticated can read playlists"
      on public.playlists
      for select
      to authenticated
      using (auth.uid() is not null)
    ';

    execute '
      create policy "authenticated can insert playlists"
      on public.playlists
      for insert
      to authenticated
      with check (auth.uid() is not null)
    ';

    execute '
      create policy "authenticated can update playlists"
      on public.playlists
      for update
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null)
    ';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'spotify_chart_entries'
  ) then
    execute 'alter table public.spotify_chart_entries enable row level security';
    execute 'drop policy if exists "authenticated can read spotify chart entries" on public.spotify_chart_entries';

    execute '
      create policy "authenticated can read spotify chart entries"
      on public.spotify_chart_entries
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'track_stream_snapshots'
  ) then
    execute 'alter table public.track_stream_snapshots enable row level security';
    execute 'drop policy if exists "authenticated can read track stream snapshots" on public.track_stream_snapshots';

    execute '
      create policy "authenticated can read track stream snapshots"
      on public.track_stream_snapshots
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;
end $$;
