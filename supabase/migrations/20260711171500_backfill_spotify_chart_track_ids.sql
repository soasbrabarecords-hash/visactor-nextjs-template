update public.spotify_chart_entries
set spotify_track_id = split_part(raw_row ->> 'spotify_track_uri', ':', 3),
    spotify_track_uri = raw_row ->> 'spotify_track_uri'
where spotify_track_id is null
  and coalesce(raw_row ->> 'spotify_track_uri', '')
    ~ '^spotify:track:[A-Za-z0-9]{22}$';
