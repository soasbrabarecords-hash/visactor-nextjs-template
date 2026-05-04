do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'chart_snapshots'
  ) then
    execute 'alter table public.chart_snapshots enable row level security';
    execute 'drop policy if exists "authenticated full access" on public.chart_snapshots';
    execute 'drop policy if exists "authenticated can read chart snapshots" on public.chart_snapshots';

    execute '
      create policy "authenticated can read chart snapshots"
      on public.chart_snapshots
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'chart_snapshot_tracks'
  ) then
    execute 'alter table public.chart_snapshot_tracks enable row level security';
    execute 'drop policy if exists "authenticated full access" on public.chart_snapshot_tracks';
    execute 'drop policy if exists "authenticated can read chart snapshot tracks" on public.chart_snapshot_tracks';

    execute '
      create policy "authenticated can read chart snapshot tracks"
      on public.chart_snapshot_tracks
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'label_artists'
  ) then
    execute 'alter table public.label_artists enable row level security';
    execute 'drop policy if exists "authenticated full access" on public.label_artists';
    execute 'drop policy if exists "authenticated can read label artists" on public.label_artists';
    execute 'drop policy if exists "authenticated can insert label artists" on public.label_artists';
    execute 'drop policy if exists "authenticated can update label artists" on public.label_artists';
    execute 'drop policy if exists "authenticated can delete label artists" on public.label_artists';

    execute '
      create policy "authenticated can read label artists"
      on public.label_artists
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can insert label artists"
      on public.label_artists
      for insert
      to authenticated
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can update label artists"
      on public.label_artists
      for update
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can delete label artists"
      on public.label_artists
      for delete
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'label_entities'
  ) then
    execute 'alter table public.label_entities enable row level security';
    execute 'drop policy if exists "authenticated full access" on public.label_entities';
    execute 'drop policy if exists "authenticated can read label entities" on public.label_entities';
    execute 'drop policy if exists "authenticated can insert label entities" on public.label_entities';
    execute 'drop policy if exists "authenticated can update label entities" on public.label_entities';
    execute 'drop policy if exists "authenticated can delete label entities" on public.label_entities';

    execute '
      create policy "authenticated can read label entities"
      on public.label_entities
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can insert label entities"
      on public.label_entities
      for insert
      to authenticated
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can update label entities"
      on public.label_entities
      for update
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can delete label entities"
      on public.label_entities
      for delete
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'label_tracks'
  ) then
    execute 'alter table public.label_tracks enable row level security';
    execute 'drop policy if exists "authenticated full access" on public.label_tracks';
    execute 'drop policy if exists "authenticated can read label tracks" on public.label_tracks';
    execute 'drop policy if exists "authenticated can insert label tracks" on public.label_tracks';
    execute 'drop policy if exists "authenticated can update label tracks" on public.label_tracks';
    execute 'drop policy if exists "authenticated can delete label tracks" on public.label_tracks';

    execute '
      create policy "authenticated can read label tracks"
      on public.label_tracks
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can insert label tracks"
      on public.label_tracks
      for insert
      to authenticated
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can update label tracks"
      on public.label_tracks
      for update
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can delete label tracks"
      on public.label_tracks
      for delete
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;

  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'label_track_participants'
  ) then
    execute 'alter table public.label_track_participants enable row level security';
    execute 'drop policy if exists "authenticated full access" on public.label_track_participants';
    execute 'drop policy if exists "authenticated can read label track participants" on public.label_track_participants';
    execute 'drop policy if exists "authenticated can insert label track participants" on public.label_track_participants';
    execute 'drop policy if exists "authenticated can update label track participants" on public.label_track_participants';
    execute 'drop policy if exists "authenticated can delete label track participants" on public.label_track_participants';

    execute '
      create policy "authenticated can read label track participants"
      on public.label_track_participants
      for select
      to authenticated
      using (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can insert label track participants"
      on public.label_track_participants
      for insert
      to authenticated
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can update label track participants"
      on public.label_track_participants
      for update
      to authenticated
      using (auth.uid() is not null)
      with check (auth.uid() is not null)
    ';
    execute '
      create policy "authenticated can delete label track participants"
      on public.label_track_participants
      for delete
      to authenticated
      using (auth.uid() is not null)
    ';
  end if;
end $$;
