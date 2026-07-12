import "server-only";

import { fetchSpotifyTracksByIds } from "@/lib/spotify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ChartSnapshot = {
  id: string;
  chart_date: string;
  source: string;
  country: string;
  chart_type: string;
  original_filename: string | null;
  total_tracks: number;
  imported_at: string;
};

export type ChartSnapshotTrack = {
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

export type ChartSnapshotTrackWithMovement = ChartSnapshotTrack & {
  position_change: number | null;   // positive = subiu, negative = caiu, 0 = stable
  status: "new" | "up" | "down" | "stable";
  stream_change: number | null;
  stream_growth_percent: number | null;
};

export type ChartSnapshotInput = {
  chart_date: string;
  source?: string;
  country?: string;
  chart_type?: string;
  original_filename?: string | null;
  total_tracks: number;
};

export type ChartSnapshotTrackInput = {
  chart_date: string;
  position: number;
  previous_position?: number | null;
  spotify_track_id?: string | null;
  track_name: string;
  artist_name?: string | null;
  streams?: number | null;
  genre?: string | null;
  image_url?: string | null;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const SNAPSHOT_CACHE_TTL_MS = 2 * 60 * 1000;
const snapshotDatesCache = new Map<string, CacheEntry<string[]>>();
const snapshotDatesInFlight = new Map<string, Promise<string[]>>();
const snapshotByDateCache = new Map<string, CacheEntry<ChartSnapshot | null>>();
const snapshotByDateInFlight = new Map<
  string,
  Promise<ChartSnapshot | null>
>();
const snapshotTracksCache = new Map<
  string,
  CacheEntry<ChartSnapshotTrack[]>
>();
const snapshotTracksInFlight = new Map<
  string,
  Promise<ChartSnapshotTrack[]>
>();
const snapshotComparisonCache = new Map<
  string,
  CacheEntry<{
    snapshot: ChartSnapshot | null;
    tracks: ChartSnapshotTrackWithMovement[];
    previousDate: string | null;
  }>
>();
const snapshotComparisonInFlight = new Map<
  string,
  Promise<{
    snapshot: ChartSnapshot | null;
    tracks: ChartSnapshotTrackWithMovement[];
    previousDate: string | null;
  }>
>();

function clearSnapshotCaches() {
  snapshotDatesCache.clear();
  snapshotDatesInFlight.clear();
  snapshotByDateCache.clear();
  snapshotByDateInFlight.clear();
  snapshotTracksCache.clear();
  snapshotTracksInFlight.clear();
  snapshotComparisonCache.clear();
  snapshotComparisonInFlight.clear();
}

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + SNAPSHOT_CACHE_TTL_MS,
  });

  return value;
}

// ── Upsert snapshot header ────────────────────────────────────────────────────
//
// Uses select-then-update-or-insert to avoid depending on a unique constraint
// that may not exist in the production database.

export async function upsertChartSnapshot(
  input: ChartSnapshotInput,
): Promise<ChartSnapshot | null> {
  const supabase = createAdminClient();

  if (!supabase) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is required to write chart snapshots.");
  }

  const country = input.country ?? "BR";
  const chartDate = input.chart_date;

  // 1. Check if a snapshot already exists for this date + country
  const { data: existing } = await supabase
    .from("chart_snapshots")
    .select("*")
    .eq("chart_date", chartDate)
    .eq("country", country)
    .maybeSingle();

  if (existing) {
    // 2a. Update total_tracks and imported_at on the existing row
    const { data: updated, error: updateError } = await supabase
      .from("chart_snapshots")
      .update({
        total_tracks: input.total_tracks,
        imported_at: new Date().toISOString(),
        source: input.source ?? existing.source ?? "spotify_charts_csv",
        chart_type: input.chart_type ?? existing.chart_type ?? "top_200_daily",
        original_filename: input.original_filename ?? existing.original_filename ?? null,
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (updateError) {
      process.stderr.write(`upsertChartSnapshot update error: ${updateError.message}\n`);
      return existing as ChartSnapshot; // return existing row even if update fails
    }

    clearSnapshotCaches();
    return updated as ChartSnapshot;
  }

  // 2b. Insert a new snapshot row
  const { data: inserted, error: insertError } = await supabase
    .from("chart_snapshots")
    .insert({
      chart_date: chartDate,
      source: input.source ?? "spotify_charts_csv",
      country,
      chart_type: input.chart_type ?? "top_200_daily",
      original_filename: input.original_filename ?? null,
      total_tracks: input.total_tracks,
      imported_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    process.stderr.write(`upsertChartSnapshot insert error: ${insertError.message}\n`);
    return null;
  }

  clearSnapshotCaches();
  return inserted as ChartSnapshot;
}

// ── Upsert snapshot tracks ────────────────────────────────────────────────────

export async function upsertChartSnapshotTracks(
  snapshotId: string,
  tracks: ChartSnapshotTrackInput[],
): Promise<{ count: number; error: string | null }> {
  if (tracks.length === 0) return { count: 0, error: null };

  const supabase = createAdminClient();

  if (!supabase) {
    return {
      count: 0,
      error: "SUPABASE_SERVICE_ROLE_KEY is required to write chart snapshot tracks.",
    };
  }

  const rows = tracks.map((t) => ({
    snapshot_id: snapshotId,
    chart_date: t.chart_date,
    position: t.position,
    previous_position: t.previous_position ?? null,
    spotify_track_id: t.spotify_track_id ?? null,
    track_name: t.track_name,
    artist_name: t.artist_name ?? null,
    streams: t.streams ?? null,
    genre: t.genre ?? null,
    image_url: t.image_url ?? null,
  }));

  // Tenta upsert com onConflict — requer unique constraint (snapshot_id, position)
  const { error } = await supabase
    .from("chart_snapshot_tracks")
    .upsert(rows, { onConflict: "snapshot_id,position" });

  if (error) {
    const msg = `upsertChartSnapshotTracks error: ${error.message} (code: ${error.code})`;
    process.stderr.write(msg + "\n");

    // Fallback: deleta as faixas existentes do snapshot e insere do zero
    process.stderr.write(`upsertChartSnapshotTracks fallback: deletando tracks do snapshot ${rows[0]?.snapshot_id} e reinserindo...\n`);
    const { error: deleteError } = await supabase
      .from("chart_snapshot_tracks")
      .delete()
      .eq("snapshot_id", rows[0]?.snapshot_id ?? "");

    if (deleteError) {
      const msg2 = `upsertChartSnapshotTracks fallback delete error: ${deleteError.message}`;
      process.stderr.write(msg2 + "\n");
      return { count: 0, error: `${msg} | fallback: ${msg2}` };
    }

    const { error: insertError } = await supabase
      .from("chart_snapshot_tracks")
      .insert(rows);

    if (insertError) {
      const msg3 = `upsertChartSnapshotTracks fallback insert error: ${insertError.message}`;
      process.stderr.write(msg3 + "\n");
      return { count: 0, error: `${msg} | fallback: ${msg3}` };
    }

    clearSnapshotCaches();
    return { count: tracks.length, error: null };
  }

  clearSnapshotCaches();
  return { count: tracks.length, error: null };
}

// ── List available dates ──────────────────────────────────────────────────────

export async function getSnapshotDates(country = "BR"): Promise<string[]> {
  const cacheKey = country.trim().toUpperCase();
  const cachedValue = getCachedValue(snapshotDatesCache, cacheKey);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const inFlight = snapshotDatesInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const supabase = await createClient();
  const request = (async () => {
    const { data, error } = await supabase
      .from("chart_snapshots")
      .select("chart_date")
      .eq("country", country)
      .order("chart_date", { ascending: false });

    if (error) {
      return [];
    }

    const seen = new Set<string>();
    const unique: string[] = [];
    for (const row of data ?? []) {
      if (!seen.has(row.chart_date)) {
        seen.add(row.chart_date);
        unique.push(row.chart_date);
      }
    }

    return setCachedValue(snapshotDatesCache, cacheKey, unique);
  })();

  snapshotDatesInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    snapshotDatesInFlight.delete(cacheKey);
  }
}

// ── Get snapshot header for a date ───────────────────────────────────────────

export async function getSnapshotByDate(
  chartDate: string,
  country = "BR",
): Promise<ChartSnapshot | null> {
  const cacheKey = `${country.trim().toUpperCase()}:${chartDate}`;
  const cachedValue = getCachedValue(snapshotByDateCache, cacheKey);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const inFlight = snapshotByDateInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const supabase = await createClient();
  const request = (async () => {
    const { data, error } = await supabase
      .from("chart_snapshots")
      .select("*")
      .eq("chart_date", chartDate)
      .eq("country", country)
      .maybeSingle();

    return setCachedValue(
      snapshotByDateCache,
      cacheKey,
      error || !data ? null : (data as ChartSnapshot),
    );
  })();

  snapshotByDateInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    snapshotByDateInFlight.delete(cacheKey);
  }
}

// ── Get snapshot tracks (raw) for a date ─────────────────────────────────────

export async function getSnapshotTracks(
  snapshotId: string,
): Promise<ChartSnapshotTrack[]> {
  const cacheKey = snapshotId.trim();
  const cachedValue = getCachedValue(snapshotTracksCache, cacheKey);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const inFlight = snapshotTracksInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const supabase = await createClient();
  const request = (async () => {
    const { data, error } = await supabase
      .from("chart_snapshot_tracks")
      .select("*")
      .eq("snapshot_id", snapshotId)
      .order("position", { ascending: true });

    return setCachedValue(
      snapshotTracksCache,
      cacheKey,
      error ? [] : ((data ?? []) as ChartSnapshotTrack[]),
    );
  })();

  snapshotTracksInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    snapshotTracksInFlight.delete(cacheKey);
  }
}

// ── Get snapshot with movement comparison ─────────────────────────────────────
//
// Compares current date's tracks against the previous available snapshot.
// Returns tracks enriched with position_change, status, stream_change, etc.

export async function getSnapshotWithComparison(
  chartDate: string,
  country = "BR",
): Promise<{
  snapshot: ChartSnapshot | null;
  tracks: ChartSnapshotTrackWithMovement[];
  previousDate: string | null;
}> {
  const cacheKey = `${country.trim().toUpperCase()}:${chartDate}`;
  const cachedValue = getCachedValue(snapshotComparisonCache, cacheKey);

  if (cachedValue !== null) {
    return cachedValue;
  }

  const inFlight = snapshotComparisonInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  const request = (async () => {
    const snapshot = await getSnapshotByDate(chartDate, country);
    if (!snapshot) {
      return setCachedValue(snapshotComparisonCache, cacheKey, {
        snapshot: null,
        tracks: [],
        previousDate: null,
      });
    }

    const rawTracks = await getSnapshotTracks(snapshot.id);
    const supabase = await createClient();
    const trackIds = rawTracks
      .map((track) => track.spotify_track_id)
      .filter((id): id is string => Boolean(id));

    const imageUrlMap = new Map<string, string>();
    if (trackIds.length > 0) {
      const { data: entryRows } = await supabase
        .from("spotify_chart_entries")
        .select("spotify_track_id,image_url")
        .in("spotify_track_id", trackIds)
        .not("image_url", "is", null)
        .limit(trackIds.length * 2);

      for (const row of entryRows ?? []) {
        if (
          row.spotify_track_id &&
          row.image_url &&
          !imageUrlMap.has(row.spotify_track_id)
        ) {
          imageUrlMap.set(row.spotify_track_id, row.image_url);
        }
      }

      const missingImageTrackIds = Array.from(
        new Set(trackIds.filter((trackId) => !imageUrlMap.has(trackId))),
      );

      if (missingImageTrackIds.length > 0) {
        const spotifyMarket =
          country.trim().toUpperCase() === "GLOBAL"
            ? "US"
            : country.trim().toUpperCase();
        const spotifyTracks = await fetchSpotifyTracksByIds(
          missingImageTrackIds,
          spotifyMarket,
        ).catch((error) => {
          process.stderr.write(
            `Failed to recover chart cover images from Spotify: ${error instanceof Error ? error.message : "unknown error"}\n`,
          );
          return [];
        });

        for (const track of spotifyTracks) {
          if (track.coverUrl) {
            imageUrlMap.set(track.id, track.coverUrl);
          }
        }
      }
    }

    const currentTracks: ChartSnapshotTrack[] = rawTracks.map((track) => ({
      ...track,
      image_url:
        track.image_url ??
        (track.spotify_track_id
          ? imageUrlMap.get(track.spotify_track_id) ?? null
          : null),
    }));

    const { data: previousSnapshot } = await supabase
      .from("chart_snapshots")
      .select("id, chart_date")
      .eq("country", country)
      .lt("chart_date", chartDate)
      .order("chart_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    const previousDate = previousSnapshot?.chart_date ?? null;

    if (!previousDate || !previousSnapshot?.id) {
      return setCachedValue(snapshotComparisonCache, cacheKey, {
        snapshot,
        tracks: currentTracks.map((track) => ({
          ...track,
          position_change: null,
          status: "new" as const,
          stream_change: null,
          stream_growth_percent: null,
        })),
        previousDate: null,
      });
    }

    const previousTracks = await getSnapshotTracks(previousSnapshot.id);
    const previousByTrackId = new Map<string, ChartSnapshotTrack>();
    const previousByName = new Map<string, ChartSnapshotTrack>();

    for (const track of previousTracks) {
      if (track.spotify_track_id) {
        previousByTrackId.set(track.spotify_track_id, track);
      }
      previousByName.set(
        `${track.track_name?.toLowerCase()}::${track.artist_name?.toLowerCase() ?? ""}`,
        track,
      );
    }

    const tracks: ChartSnapshotTrackWithMovement[] = currentTracks.map((track) => {
      const previousTrack =
        (track.spotify_track_id
          ? previousByTrackId.get(track.spotify_track_id)
          : undefined) ??
        previousByName.get(
          `${track.track_name?.toLowerCase()}::${track.artist_name?.toLowerCase() ?? ""}`,
        );

      if (!previousTrack) {
        return {
          ...track,
          position_change: null,
          status: "new" as const,
          stream_change: null,
          stream_growth_percent: null,
        };
      }

      const positionChange = previousTrack.position - track.position;
      const status =
        positionChange > 0 ? "up" : positionChange < 0 ? "down" : "stable";

      const streamChange =
        track.streams !== null && previousTrack.streams !== null
          ? track.streams - previousTrack.streams
          : null;

      const streamGrowthPercent =
        streamChange !== null &&
        previousTrack.streams !== null &&
        previousTrack.streams > 0
          ? Math.round((streamChange / previousTrack.streams) * 10000) / 100
          : null;

      return {
        ...track,
        position_change: positionChange,
        status,
        stream_change: streamChange,
        stream_growth_percent: streamGrowthPercent,
      };
    });

    return setCachedValue(snapshotComparisonCache, cacheKey, {
      snapshot,
      tracks,
      previousDate,
    });
  })();

  snapshotComparisonInFlight.set(cacheKey, request);

  try {
    return await request;
  } finally {
    snapshotComparisonInFlight.delete(cacheKey);
  }
}
