import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type SpotifyChartEntryRow = {
  id?: string | null;
  spotify_track_id: string | null;
  track_name: string | null;
  artist_name: string | null;
  artist_ids: string[] | null;
  album_name: string | null;
  image_url: string | null;
  spotify_url: string | null;
  country: string | null;
  genre: string | null;
  chart_name: string | null;
  source_type: string | null;
  chart_date: string | null;
  rank_position: number | string | null;
  previous_rank: number | string | null;
  movement_type: string | null;
  daily_streams: number | string | null;
  captured_at: string | null;
};

export type SpotifyChartEntryInput = {
  spotify_track_id: string | null;
  track_name: string;
  artist_name: string;
  artist_ids: string[];
  album_name: string;
  image_url: string | null;
  spotify_url: string | null;
  country: string;
  genre: string | null;
  chart_name: string;
  source_type: string;
  chart_date: string;
  rank_position: number;
  previous_rank: number | null;
  movement_type: string | null;
  daily_streams: number | null;
  captured_at: string;
  chart_type: string;
  rank: number;
  artist_names: string;
  spotify_track_uri: string | null;
  streams: number | null;
  raw_row: Record<string, unknown>;
};

export type TrackStreamSnapshotRow = {
  id?: string | null;
  spotify_track_id: string | null;
  track_name: string | null;
  artist_name: string | null;
  artist_ids: string[] | null;
  album_name: string | null;
  image_url: string | null;
  spotify_url: string | null;
  country: string | null;
  genre: string | null;
  chart_name: string | null;
  chart_date: string | null;
  daily_streams: number | string | null;
  rank_position: number | string | null;
  previous_rank: number | string | null;
  captured_at: string | null;
};

type ChartSnapshotTrackRaw = {
  id: string;
  snapshot_id: string;
  chart_date: string;
  position: number;
  previous_position: number | null;
  spotify_track_id: string | null;
  track_name: string;
  artist_name: string | null;
  streams: number | null;
  kworb_streams_24h: number | null;
  genre: string | null;
  image_url: string | null;
  created_at: string;
};

function getAdminOrThrow() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required to write chart legacy tables safely.",
    );
  }

  return admin;
}

export async function fetchSpotifyChartEntries({
  country,
  genre,
  chartDate,
  chartName,
  limit = 200,
}: {
  country?: string;
  genre?: string;
  chartDate?: string;
  chartName?: string;
  limit?: number;
} = {}): Promise<SpotifyChartEntryRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("spotify_chart_entries")
    .select(
      "id,spotify_track_id,track_name,artist_name,artist_ids,album_name,image_url,spotify_url,country,genre,chart_name,source_type,chart_date,rank_position,previous_rank,movement_type,daily_streams,captured_at",
    )
    .order("chart_date", { ascending: false })
    .order("rank_position", { ascending: true })
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (country) {
    query = query.eq("country", country);
  }

  if (genre) {
    query = query.eq("genre", genre);
  }

  if (chartDate) {
    query = query.eq("chart_date", chartDate);
  }

  if (chartName) {
    query = query.eq("chart_name", chartName);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []) as SpotifyChartEntryRow[];
}

export async function upsertSpotifyChartEntries(
  rows: SpotifyChartEntryInput[],
): Promise<boolean> {
  if (rows.length === 0) {
    return false;
  }

  const supabase = getAdminOrThrow();
  const identifiedRows = rows.filter((row) => Boolean(row.spotify_track_id));
  const fallbackRows = rows.filter((row) => !row.spotify_track_id);
  let hasError = false;

  if (identifiedRows.length > 0) {
    const { error } = await supabase
      .from("spotify_chart_entries")
      .upsert(identifiedRows, {
        onConflict: "country,chart_name,chart_date,spotify_track_id",
        ignoreDuplicates: false,
      });
    hasError = hasError || Boolean(error);
  }

  for (const row of fallbackRows) {
    const { error: deleteError } = await supabase
      .from("spotify_chart_entries")
      .delete()
      .eq("country", row.country)
      .eq("chart_name", row.chart_name)
      .eq("chart_date", row.chart_date)
      .eq("rank_position", row.rank_position)
      .is("spotify_track_id", null);

    if (deleteError) {
      hasError = true;
      continue;
    }

    const { error: insertError } = await supabase
      .from("spotify_chart_entries")
      .insert(row);
    hasError = hasError || Boolean(insertError);
  }

  return !hasError;
}

export async function fetchLatestSpotifyChartEntries({
  country,
  genre,
  chartName,
  limit = 200,
}: {
  country?: string;
  genre?: string;
  chartName?: string;
  limit?: number;
} = {}): Promise<SpotifyChartEntryRow[]> {
  const latestRows = await fetchSpotifyChartEntries({
    country,
    genre,
    chartName,
    limit: 1,
  });
  const latestChartDate = latestRows[0]?.chart_date;

  if (!latestChartDate) {
    return [];
  }

  return fetchSpotifyChartEntries({
    country,
    genre,
    chartName,
    chartDate: latestChartDate,
    limit,
  });
}

function snapshotTrackToEntryRow(
  row: ChartSnapshotTrackRaw,
  country: string,
): SpotifyChartEntryRow {
  const trackId = row.spotify_track_id?.trim() ?? null;
  return {
    id: row.id,
    spotify_track_id: trackId,
    track_name: row.track_name,
    artist_name: row.artist_name,
    artist_ids: null,
    album_name: null,
    image_url: row.image_url?.trim() || null,
    spotify_url: trackId ? `https://open.spotify.com/track/${trackId}` : null,
    country,
    genre: row.genre,
    chart_name: "top-songs",
    source_type: "spotify_charts_csv",
    chart_date: row.chart_date,
    rank_position: row.position,
    previous_rank: row.previous_position,
    movement_type: null,
    daily_streams: row.streams,
    captured_at: row.created_at,
  };
}

export async function fetchLatestFromSnapshotTracks({
  country = "BR",
  genre,
  limit = 200,
}: {
  country?: string;
  genre?: string;
  limit?: number;
} = {}): Promise<SpotifyChartEntryRow[]> {
  const supabase = await createClient();

  const { data: snapshotRows } = await supabase
    .from("chart_snapshots")
    .select("chart_date")
    .eq("country", country)
    .order("chart_date", { ascending: false })
    .limit(1);

  const latestDate = snapshotRows?.[0]?.chart_date ?? null;

  if (!latestDate) {
    return fetchLatestSpotifyChartEntries({ country, genre, limit });
  }

  let tracksQuery = supabase
    .from("chart_snapshot_tracks")
    .select(
      "id,snapshot_id,chart_date,position,previous_position,spotify_track_id,track_name,artist_name,streams,kworb_streams_24h,genre,image_url,created_at",
    )
    .eq("chart_date", latestDate)
    .order("position", { ascending: true })
    .limit(limit);

  if (genre && genre !== "all") {
    tracksQuery = tracksQuery.eq("genre", genre);
  }

  const { data: tracksPayload } = await tracksQuery;

  if (!tracksPayload || tracksPayload.length === 0) {
    return fetchLatestSpotifyChartEntries({ country, genre, limit });
  }

  return (tracksPayload as ChartSnapshotTrackRaw[]).map((row) =>
    snapshotTrackToEntryRow(row, country),
  );
}

export async function fetchTrackStreamSnapshots({
  trackIds,
  country,
  chartName,
  sinceDate,
  limit = 500,
}: {
  trackIds?: string[];
  country?: string;
  chartName?: string;
  sinceDate?: string;
  limit?: number;
} = {}): Promise<TrackStreamSnapshotRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("track_stream_snapshots")
    .select(
      "id,spotify_track_id,track_name,artist_name,artist_ids,album_name,image_url,spotify_url,country,genre,chart_name,chart_date,daily_streams,rank_position,previous_rank,captured_at",
    )
    .order("chart_date", { ascending: false })
    .order("rank_position", { ascending: true })
    .order("captured_at", { ascending: false })
    .limit(limit);

  if (trackIds && trackIds.length > 0) {
    query = query.in("spotify_track_id", trackIds);
  }

  if (country) {
    query = query.eq("country", country);
  }

  if (chartName) {
    query = query.eq("chart_name", chartName);
  }

  if (sinceDate) {
    query = query.gte("chart_date", sinceDate);
  }

  const { data, error } = await query;

  if (error) {
    return [];
  }

  return (data ?? []) as TrackStreamSnapshotRow[];
}
