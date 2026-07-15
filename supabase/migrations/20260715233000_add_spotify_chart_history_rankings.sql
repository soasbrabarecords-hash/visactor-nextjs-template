create or replace function public.get_spotify_chart_history_rankings(
  p_window_days integer default 30,
  p_countries text[] default array['BR']::text[],
  p_primary_genre text default null,
  p_limit integer default 20
)
returns table (
  spotify_track_id text,
  track_name text,
  artist_name text,
  primary_genre text,
  genre_confidence integer,
  countries text[],
  chart_days integer,
  chart_appearances bigint,
  total_streams bigint,
  average_daily_streams bigint,
  best_position integer,
  average_position numeric,
  first_chart_date date,
  last_chart_date date,
  current_position_br integer,
  current_position_global integer,
  position_7d_br integer,
  position_7d_global integer,
  image_url text,
  latest_chart_date date,
  window_start_date date,
  available_days integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select
      greatest(1, least(coalesce(p_window_days, 30), 365))::integer as window_days,
      case
        when coalesce(cardinality(p_countries), 0) = 0 then array['BR']::text[]
        else p_countries
      end as countries,
      nullif(btrim(lower(p_primary_genre)), '') as primary_genre,
      greatest(1, least(coalesce(p_limit, 20), 50))::integer as result_limit
  ),
  bounds as (
    select
      max(snapshot.chart_date)::date as latest_date,
      input.window_days,
      input.countries,
      input.primary_genre,
      input.result_limit
    from public.spotify_chart_complete_snapshots snapshot
    cross join input
    where snapshot.chart_type = 'top-songs'
      and snapshot.country = any(input.countries)
    group by input.window_days, input.countries, input.primary_genre, input.result_limit
  ),
  window_rows as (
    select
      snapshot.country,
      snapshot.chart_date,
      track.spotify_track_id,
      track.track_name,
      coalesce(track.artist_name, '') as artist_name,
      track.position,
      track.streams,
      track.image_url,
      profile.primary_genre,
      profile.genre_confidence,
      bounds.latest_date,
      (bounds.latest_date - (bounds.window_days - 1))::date as window_start_date,
      bounds.window_days,
      bounds.result_limit
    from bounds
    join public.spotify_chart_complete_snapshots snapshot
      on snapshot.chart_type = 'top-songs'
     and snapshot.country = any(bounds.countries)
     and snapshot.chart_date between
       (bounds.latest_date - (bounds.window_days - 1))::date
       and bounds.latest_date
    join public.chart_snapshot_tracks track
      on track.snapshot_id = snapshot.snapshot_id
    left join public.track_genre_profiles profile
      on profile.spotify_track_id = track.spotify_track_id
    where nullif(btrim(track.spotify_track_id), '') is not null
      and (
        bounds.primary_genre is null
        or profile.primary_genre = bounds.primary_genre
      )
  ),
  ranked as (
    select
      rows.spotify_track_id,
      (array_agg(rows.track_name order by rows.chart_date desc))[1] as track_name,
      (array_agg(rows.artist_name order by rows.chart_date desc))[1] as artist_name,
      max(rows.primary_genre) as primary_genre,
      max(rows.genre_confidence)::integer as genre_confidence,
      array_agg(distinct rows.country order by rows.country) as countries,
      count(distinct rows.chart_date)::integer as chart_days,
      count(*)::bigint as chart_appearances,
      sum(coalesce(rows.streams, 0))::bigint as total_streams,
      round(avg(rows.streams) filter (where rows.streams is not null))::bigint
        as average_daily_streams,
      min(rows.position)::integer as best_position,
      round(avg(rows.position)::numeric, 1) as average_position,
      min(rows.chart_date)::date as first_chart_date,
      max(rows.chart_date)::date as last_chart_date,
      min(rows.position) filter (
        where rows.country = 'BR' and rows.chart_date = rows.latest_date
      )::integer as current_position_br,
      min(rows.position) filter (
        where rows.country = 'GLOBAL' and rows.chart_date = rows.latest_date
      )::integer as current_position_global,
      min(rows.position) filter (
        where rows.country = 'BR' and rows.chart_date = rows.latest_date - 7
      )::integer as position_7d_br,
      min(rows.position) filter (
        where rows.country = 'GLOBAL' and rows.chart_date = rows.latest_date - 7
      )::integer as position_7d_global,
      (array_agg(rows.image_url order by rows.chart_date desc)
        filter (where rows.image_url is not null))[1] as image_url,
      max(rows.latest_date)::date as latest_chart_date,
      min(rows.window_start_date)::date as window_start_date,
      count(distinct rows.chart_date)::integer as available_days,
      max(rows.result_limit)::integer as result_limit
    from window_rows rows
    group by rows.spotify_track_id
  )
  select
    ranked.spotify_track_id,
    ranked.track_name,
    ranked.artist_name,
    ranked.primary_genre,
    ranked.genre_confidence,
    ranked.countries,
    ranked.chart_days,
    ranked.chart_appearances,
    ranked.total_streams,
    ranked.average_daily_streams,
    ranked.best_position,
    ranked.average_position,
    ranked.first_chart_date,
    ranked.last_chart_date,
    ranked.current_position_br,
    ranked.current_position_global,
    ranked.position_7d_br,
    ranked.position_7d_global,
    ranked.image_url,
    ranked.latest_chart_date,
    ranked.window_start_date,
    ranked.available_days
  from ranked
  order by
    ranked.total_streams desc nulls last,
    ranked.chart_days desc,
    ranked.best_position asc,
    ranked.spotify_track_id
  limit (select result_limit from input);
$$;

revoke all on function public.get_spotify_chart_history_rankings(
  integer,
  text[],
  text,
  integer
) from public, anon, authenticated;

grant execute on function public.get_spotify_chart_history_rankings(
  integer,
  text[],
  text,
  integer
) to service_role;

comment on function public.get_spotify_chart_history_rankings(
  integer,
  text[],
  text,
  integer
) is
  'Read-only historical Top 200 ranking across every complete daily snapshot in the requested window.';
