import "server-only";

import {
  type SpotifyChartEntryInput,
  upsertSpotifyChartEntries,
} from "./spotify-charts-store";

type SupabaseStreamSnapshotInput = {
  spotify_track_id: string;
  track_name: string;
  artist_name: string;
  artist_ids: string[];
  album_name: string;
  image_url: string | null;
  spotify_url: string;
  country: string;
  genre: string | null;
  chart_name: string;
  chart_date: string;
  daily_streams: number;
  rank_position: number | null;
  previous_rank: number | null;
  captured_at: string;
};

export type SpotifyChartImportRow = {
  spotify_track_id?: string | null;
  track_name?: string | null;
  artist_name?: string | null;
  artist_ids?: string[] | string | null;
  album_name?: string | null;
  image_url?: string | null;
  spotify_url?: string | null;
  country?: string | null;
  genre?: string | null;
  chart_name?: string | null;
  source_type?: string | null;
  chart_date?: string | null;
  rank_position?: number | string | null;
  previous_rank?: number | string | null;
  movement_type?: string | null;
  daily_streams?: number | string | null;
  captured_at?: string | null;
};

export type SpotifyChartsImportResult = {
  insertedCount: number;
  skippedCount: number;
  errors: string[];
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return null;
  }

  return {
    url,
    anonKey,
  };
}

function buildHeaders(env: { anonKey: string }) {
  return {
    apikey: env.anonKey,
    Authorization: `Bearer ${env.anonKey}`,
  };
}

function normalizeString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStringArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);
  }

  return [];
}

function normalizeNumber(value: number | string | null | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function normalizeDate(value: string | null | undefined) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeTimestamp(value: string | null | undefined) {
  const normalized = normalizeString(value);

  if (!normalized) {
    return new Date().toISOString();
  }

  const parsed = new Date(normalized);

  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }

  return parsed.toISOString();
}

function dedupeKeyOf(row: {
  spotify_track_id: string;
  country: string;
  chart_name: string;
  chart_date: string;
}) {
  return [
    row.country,
    row.chart_name,
    row.chart_date,
    row.spotify_track_id,
  ].join("::");
}

function validateRow(
  row: SpotifyChartImportRow,
  index: number,
): {
  entry: SpotifyChartEntryInput;
  snapshot: SupabaseStreamSnapshotInput;
} | {
  error: string;
} {
  const spotifyTrackId = normalizeString(row.spotify_track_id);
  const trackName = normalizeString(row.track_name);
  const artistName = normalizeString(row.artist_name);
  const albumName = normalizeString(row.album_name) ?? "";
  const spotifyUrl = normalizeString(row.spotify_url);
  const country = normalizeString(row.country);
  const chartDate = normalizeDate(row.chart_date);
  const rankPosition = normalizeNumber(row.rank_position);
  const dailyStreams = normalizeNumber(row.daily_streams);

  if (!spotifyTrackId) {
    return { error: `Row ${index + 1}: missing spotify_track_id.` };
  }

  if (!trackName) {
    return { error: `Row ${index + 1}: missing track_name for ${spotifyTrackId}.` };
  }

  if (!artistName) {
    return { error: `Row ${index + 1}: missing artist_name for ${spotifyTrackId}.` };
  }

  if (!spotifyUrl) {
    return { error: `Row ${index + 1}: missing spotify_url for ${spotifyTrackId}.` };
  }

  if (!country) {
    return { error: `Row ${index + 1}: missing country for ${spotifyTrackId}.` };
  }

  if (!chartDate) {
    return { error: `Row ${index + 1}: invalid chart_date for ${spotifyTrackId}.` };
  }

  if (!rankPosition || rankPosition <= 0) {
    return { error: `Row ${index + 1}: invalid rank_position for ${spotifyTrackId}.` };
  }

  if (dailyStreams === null || dailyStreams < 0) {
    return { error: `Row ${index + 1}: invalid daily_streams for ${spotifyTrackId}.` };
  }

  const artistIds = normalizeStringArray(row.artist_ids);
  const genre = normalizeString(row.genre);
  const chartName = normalizeString(row.chart_name) ?? "top-songs";
  const sourceType = normalizeString(row.source_type) ?? "spotify_chart";
  const previousRank = normalizeNumber(row.previous_rank);
  const movementType = normalizeString(row.movement_type);
  const capturedAt = normalizeTimestamp(row.captured_at);
  const imageUrl = normalizeString(row.image_url);

  return {
    entry: {
      spotify_track_id: spotifyTrackId,
      track_name: trackName,
      artist_name: artistName,
      artist_ids: artistIds,
      album_name: albumName,
      image_url: imageUrl,
      spotify_url: spotifyUrl,
      country,
      genre,
      chart_name: chartName,
      source_type: sourceType,
      chart_date: chartDate,
      rank_position: Math.trunc(rankPosition),
      previous_rank: previousRank === null ? null : Math.trunc(previousRank),
      movement_type: movementType,
      daily_streams: Math.trunc(dailyStreams),
      captured_at: capturedAt,
    },
    snapshot: {
      spotify_track_id: spotifyTrackId,
      track_name: trackName,
      artist_name: artistName,
      artist_ids: artistIds,
      album_name: albumName,
      image_url: imageUrl,
      spotify_url: spotifyUrl,
      country,
      genre,
      chart_name: chartName,
      chart_date: chartDate,
      daily_streams: Math.trunc(dailyStreams),
      rank_position: Math.trunc(rankPosition),
      previous_rank: previousRank === null ? null : Math.trunc(previousRank),
      captured_at: capturedAt,
    },
  };
}

async function upsertTrackStreamSnapshots(
  rows: SupabaseStreamSnapshotInput[],
): Promise<boolean> {
  const env = getSupabaseEnv();

  if (!env || rows.length === 0) {
    return false;
  }

  const url = new URL(`${env.url}/rest/v1/track_stream_snapshots`);
  url.searchParams.set(
    "on_conflict",
    "spotify_track_id,country,chart_name,chart_date",
  );

  const response = await fetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders(env),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(rows),
    cache: "no-store",
  }).catch(() => null);

  return Boolean(response?.ok);
}

export async function importSpotifyChartRows(
  rows: SpotifyChartImportRow[],
): Promise<SpotifyChartsImportResult> {
  const errors: string[] = [];
  const entryRows: SpotifyChartEntryInput[] = [];
  const snapshotRows: SupabaseStreamSnapshotInput[] = [];
  const seenKeys = new Set<string>();
  let skippedCount = 0;

  rows.forEach((row, index) => {
    const validated = validateRow(row, index);

    if ("error" in validated) {
      skippedCount += 1;
      errors.push(validated.error);
      return;
    }

    const dedupeKey = dedupeKeyOf(validated.entry);

    if (seenKeys.has(dedupeKey)) {
      skippedCount += 1;
      return;
    }

    seenKeys.add(dedupeKey);
    entryRows.push(validated.entry);
    snapshotRows.push(validated.snapshot);
  });

  if (entryRows.length === 0) {
    return {
      insertedCount: 0,
      skippedCount,
      errors,
    };
  }

  const entriesSaved = await upsertSpotifyChartEntries(entryRows);

  if (!entriesSaved) {
    return {
      insertedCount: 0,
      skippedCount: skippedCount + entryRows.length,
      errors: [...errors, "Failed to upsert spotify_chart_entries."],
    };
  }

  const snapshotsSaved = await upsertTrackStreamSnapshots(snapshotRows);

  if (!snapshotsSaved) {
    errors.push("Failed to upsert track_stream_snapshots.");
  }

  return {
    insertedCount: entryRows.length,
    skippedCount,
    errors,
  };
}
