-- Historical Spotify Charts writes must be all-or-nothing. The daily 10h
-- importer does not call this function; it remains on its existing path.

create or replace function public.replace_spotify_chart_snapshot_v1(
  p_chart_date date,
  p_country text,
  p_chart_type text,
  p_source text,
  p_tracks jsonb
)
returns table(snapshot_id uuid, tracks_count integer)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_snapshot_id uuid;
  v_track_count integer;
  v_unique_positions integer;
  v_unique_track_ids integer;
  v_min_position integer;
  v_max_position integer;
  v_invalid_rows integer;
  v_inserted integer;
begin
  if p_chart_date is null
    or nullif(btrim(p_country), '') is null
    or p_chart_type <> 'top-songs'
    or nullif(btrim(p_source), '') is null
  then
    raise exception 'Invalid Top 200 snapshot identity.';
  end if;

  if p_tracks is null or jsonb_typeof(p_tracks) <> 'array' then
    raise exception 'Top 200 tracks must be a JSON array.';
  end if;

  select
    count(*),
    count(distinct track.position),
    count(distinct nullif(btrim(track.spotify_track_id), '')),
    min(track.position),
    max(track.position),
    count(*) filter (
      where track.position is null
        or track.position < 1
        or track.position > 200
        or nullif(btrim(track.spotify_track_id), '') is null
        or nullif(btrim(track.track_name), '') is null
    )
  into
    v_track_count,
    v_unique_positions,
    v_unique_track_ids,
    v_min_position,
    v_max_position,
    v_invalid_rows
  from jsonb_to_recordset(p_tracks) as track(
    position integer,
    spotify_track_id text,
    track_name text
  );

  if v_track_count <> 200
    or v_unique_positions <> 200
    or v_unique_track_ids <> 200
    or v_min_position <> 1
    or v_max_position <> 200
    or v_invalid_rows <> 0
  then
    raise exception
      'Incomplete Top 200 snapshot: rows=%, positions=%, track_ids=%, range=%..%, invalid=%',
      v_track_count,
      v_unique_positions,
      v_unique_track_ids,
      v_min_position,
      v_max_position,
      v_invalid_rows;
  end if;

  insert into public.chart_snapshots (
    chart_date,
    source,
    country,
    chart_type,
    total_tracks,
    imported_at
  )
  values (
    p_chart_date,
    btrim(p_source),
    upper(btrim(p_country)),
    p_chart_type,
    200,
    now()
  )
  on conflict (country, chart_type, chart_date)
  do update set
    source = excluded.source,
    total_tracks = excluded.total_tracks,
    imported_at = excluded.imported_at
  returning id into v_snapshot_id;

  delete from public.chart_snapshot_tracks
  where chart_snapshot_tracks.snapshot_id = v_snapshot_id;

  insert into public.chart_snapshot_tracks (
    snapshot_id,
    chart_date,
    position,
    previous_position,
    spotify_track_id,
    track_name,
    artist_name,
    streams,
    genre,
    image_url
  )
  select
    v_snapshot_id,
    p_chart_date,
    track.position,
    track.previous_position,
    nullif(btrim(track.spotify_track_id), ''),
    btrim(track.track_name),
    nullif(btrim(track.artist_name), ''),
    track.streams,
    nullif(btrim(track.genre), ''),
    nullif(btrim(track.image_url), '')
  from jsonb_to_recordset(p_tracks) as track(
    position integer,
    previous_position integer,
    spotify_track_id text,
    track_name text,
    artist_name text,
    streams bigint,
    genre text,
    image_url text
  )
  order by track.position;

  get diagnostics v_inserted = row_count;

  if v_inserted <> 200 then
    raise exception 'Atomic Top 200 insert wrote % rows instead of 200.', v_inserted;
  end if;

  return query select v_snapshot_id, v_inserted;
end
$function$;

revoke all on function public.replace_spotify_chart_snapshot_v1(
  date,
  text,
  text,
  text,
  jsonb
) from public, anon, authenticated;

grant execute on function public.replace_spotify_chart_snapshot_v1(
  date,
  text,
  text,
  text,
  jsonb
) to service_role;
