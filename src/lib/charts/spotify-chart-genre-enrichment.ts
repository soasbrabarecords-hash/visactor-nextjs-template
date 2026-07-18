import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { enrichTrackProfile } from "@/lib/track-profile-engine";
import type {
  TrackGenreProfile,
  TrackGenreSource,
} from "@/types/track-profile";

export const SPOTIFY_CHART_GENRE_ENRICHMENT_DEFAULT_LIMIT = 60;
export const SPOTIFY_CHART_GENRE_ENRICHMENT_MAX_LIMIT = 100;
export const SPOTIFY_CHART_GENRE_ENRICHMENT_DEFAULT_BUDGET_MS = 120_000;
export const SPOTIFY_CHART_GENRE_ENRICHMENT_RETRY_DAYS = 30;

const PROFILE_BATCH_SIZE = 100;
const CHART_COUNTRIES = ["BR", "GLOBAL"] as const;
const EXTERNAL_SOURCE_IDS = new Set([
  "spotify_artist_genres",
  "musicbrainz",
  "lastfm_track",
  "lastfm_artist",
]);

type ChartCountry = (typeof CHART_COUNTRIES)[number];

type SnapshotRow = {
  id: string;
  country: string;
  chart_date: string;
};

type SnapshotTrackRow = {
  snapshot_id: string;
  position: number;
  spotify_track_id: string | null;
  track_name: string;
  artist_name: string | null;
};

export type SpotifyChartGenreCandidate = {
  spotifyTrackId: string;
  name: string;
  artists: string;
  chartCountry: ChartCountry;
  position: number;
};

export type SpotifyChartGenreStoredProfile = {
  spotify_track_id: string;
  genre_sources: TrackGenreSource[] | null;
  last_enriched_at: string | null;
};

function chunks<T>(values: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function normalizeLimit(value: number | undefined) {
  return Math.min(
    SPOTIFY_CHART_GENRE_ENRICHMENT_MAX_LIMIT,
    Math.max(
      1,
      Math.trunc(value ?? SPOTIFY_CHART_GENRE_ENRICHMENT_DEFAULT_LIMIT),
    ),
  );
}

function hasAutomaticEnrichmentAttempt(
  sources: TrackGenreSource[] | null | undefined,
) {
  return (sources ?? []).some((item) => EXTERNAL_SOURCE_IDS.has(item.id));
}

export function shouldEnrichSpotifyChartGenreProfile(
  profile: SpotifyChartGenreStoredProfile | undefined,
  now = new Date(),
  retryDays = SPOTIFY_CHART_GENRE_ENRICHMENT_RETRY_DAYS,
) {
  if (!profile || !hasAutomaticEnrichmentAttempt(profile.genre_sources)) {
    return true;
  }

  const lastEnrichedAt = profile.last_enriched_at
    ? new Date(profile.last_enriched_at).getTime()
    : Number.NaN;

  if (!Number.isFinite(lastEnrichedAt)) {
    return true;
  }

  return now.getTime() - lastEnrichedAt >= retryDays * 24 * 60 * 60 * 1000;
}

function latestSnapshots(rows: SnapshotRow[]) {
  const latest = new Map<ChartCountry, SnapshotRow>();

  for (const row of rows) {
    const country = row.country.trim().toUpperCase() as ChartCountry;
    if (
      CHART_COUNTRIES.includes(country) &&
      (!latest.has(country) ||
        row.chart_date > (latest.get(country)?.chart_date ?? ""))
    ) {
      latest.set(country, row);
    }
  }

  return CHART_COUNTRIES.flatMap((country) => {
    const snapshot = latest.get(country);
    return snapshot ? [snapshot] : [];
  });
}

function orderCandidates(tracks: SnapshotTrackRow[], snapshots: SnapshotRow[]) {
  const snapshotById = new Map(
    snapshots.map((snapshot) => [
      snapshot.id,
      snapshot.country.trim().toUpperCase() as ChartCountry,
    ]),
  );
  const byCountry = new Map<ChartCountry, SnapshotTrackRow[]>();

  for (const track of tracks) {
    const country = snapshotById.get(track.snapshot_id);
    if (!country) continue;
    const bucket = byCountry.get(country) ?? [];
    bucket.push(track);
    byCountry.set(country, bucket);
  }

  for (const bucket of byCountry.values()) {
    bucket.sort((left, right) => left.position - right.position);
  }

  const ordered: SpotifyChartGenreCandidate[] = [];
  const seenTrackIds = new Set<string>();
  const maxTracks = Math.max(
    0,
    ...Array.from(byCountry.values(), (bucket) => bucket.length),
  );

  for (let index = 0; index < maxTracks; index += 1) {
    for (const country of CHART_COUNTRIES) {
      const track = byCountry.get(country)?.[index];
      const spotifyTrackId = track?.spotify_track_id?.trim() ?? "";
      if (!track || !spotifyTrackId || seenTrackIds.has(spotifyTrackId)) {
        continue;
      }
      seenTrackIds.add(spotifyTrackId);
      ordered.push({
        spotifyTrackId,
        name: track.track_name,
        artists: track.artist_name?.trim() || "Artista não informado",
        chartCountry: country,
        position: track.position,
      });
    }
  }

  return ordered;
}

async function loadSpotifyChartGenreCandidates(now: Date) {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for chart genre enrichment.",
    );
  }

  const { data: snapshotData, error: snapshotError } = await admin
    .from("chart_snapshots")
    .select("id,country,chart_date")
    .eq("chart_type", "top-songs")
    .in("country", [...CHART_COUNTRIES])
    .order("chart_date", { ascending: false })
    .limit(20);

  if (snapshotError) {
    throw new Error(
      `Could not load recent chart snapshots: ${snapshotError.message}`,
    );
  }

  const snapshots = latestSnapshots((snapshotData ?? []) as SnapshotRow[]);
  if (snapshots.length === 0) {
    return { candidates: [], eligibleCount: 0 };
  }

  const { data: trackData, error: trackError } = await admin
    .from("chart_snapshot_tracks")
    .select("snapshot_id,position,spotify_track_id,track_name,artist_name")
    .in(
      "snapshot_id",
      snapshots.map((snapshot) => snapshot.id),
    )
    .not("spotify_track_id", "is", null)
    .lte("position", 200)
    .order("position", { ascending: true });

  if (trackError) {
    throw new Error(
      `Could not load chart tracks for genre enrichment: ${trackError.message}`,
    );
  }

  const ordered = orderCandidates(
    (trackData ?? []) as SnapshotTrackRow[],
    snapshots,
  );
  const storedRows: SpotifyChartGenreStoredProfile[] = [];

  for (const batch of chunks(
    ordered.map((track) => track.spotifyTrackId),
    PROFILE_BATCH_SIZE,
  )) {
    const { data, error } = await admin
      .from("track_genre_profiles")
      .select("spotify_track_id,genre_sources,last_enriched_at")
      .in("spotify_track_id", batch);

    if (error) {
      throw new Error(`Could not load stored genre profiles: ${error.message}`);
    }

    storedRows.push(...((data ?? []) as SpotifyChartGenreStoredProfile[]));
  }

  const storedByTrackId = new Map(
    storedRows.map((profile) => [profile.spotify_track_id, profile]),
  );
  const candidates = ordered.filter((track) =>
    shouldEnrichSpotifyChartGenreProfile(
      storedByTrackId.get(track.spotifyTrackId),
      now,
    ),
  );

  return { candidates, eligibleCount: candidates.length };
}

function normalizeError(error: unknown) {
  return error instanceof Error ? error.message : "Unknown enrichment error.";
}

export async function processSpotifyChartGenreCandidates(
  candidates: SpotifyChartGenreCandidate[],
  input: {
    limit?: number;
    concurrency?: number;
    maxDurationMs?: number;
    now?: () => number;
    enrich?: (
      candidate: SpotifyChartGenreCandidate,
    ) => Promise<TrackGenreProfile>;
  } = {},
) {
  const limit = normalizeLimit(input.limit);
  const selected = candidates.slice(0, limit);
  const concurrency = Math.min(
    6,
    Math.max(1, Math.trunc(input.concurrency ?? 4)),
  );
  const maxDurationMs = Math.max(
    1,
    Math.trunc(
      input.maxDurationMs ?? SPOTIFY_CHART_GENRE_ENRICHMENT_DEFAULT_BUDGET_MS,
    ),
  );
  const now = input.now ?? Date.now;
  const startedAt = now();
  const enrich =
    input.enrich ??
    ((candidate: SpotifyChartGenreCandidate) =>
      enrichTrackProfile({
        spotifyTrackId: candidate.spotifyTrackId,
        name: candidate.name,
        artists: candidate.artists,
        chartCountry: candidate.chartCountry,
      }));
  const results: Array<{
    spotifyTrackId: string;
    primaryGenre: string | null;
    subgenres: string[];
    confidence: number | null;
    success: boolean;
    error?: string;
  }> = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < selected.length) {
      if (now() - startedAt >= maxDurationMs) return;
      const candidate = selected[nextIndex];
      nextIndex += 1;

      try {
        const profile = await enrich(candidate);
        results.push({
          spotifyTrackId: candidate.spotifyTrackId,
          primaryGenre: profile.primaryGenre,
          subgenres: profile.subgenres,
          confidence: profile.genreConfidence,
          success: true,
        });
      } catch (error) {
        results.push({
          spotifyTrackId: candidate.spotifyTrackId,
          primaryGenre: null,
          subgenres: [],
          confidence: null,
          success: false,
          error: normalizeError(error),
        });
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, selected.length) }, () =>
      worker(),
    ),
  );

  return {
    requestedLimit: input.limit ?? null,
    appliedLimit: limit,
    selected: selected.length,
    processed: results.length,
    classified: results.filter(
      (result) => result.success && result.primaryGenre !== "desconhecido",
    ).length,
    unknown: results.filter(
      (result) => result.success && result.primaryGenre === "desconhecido",
    ).length,
    failed: results.filter((result) => !result.success).length,
    stoppedForTimeBudget: nextIndex < selected.length,
    durationMs: now() - startedAt,
    results,
  };
}

export async function enrichLatestSpotifyChartGenres(
  input: {
    limit?: number;
    concurrency?: number;
    maxDurationMs?: number;
    now?: () => number;
    candidates?: SpotifyChartGenreCandidate[];
    enrich?: (
      candidate: SpotifyChartGenreCandidate,
    ) => Promise<TrackGenreProfile>;
  } = {},
) {
  const nowDate = new Date((input.now ?? Date.now)());
  const loaded = input.candidates
    ? { candidates: input.candidates, eligibleCount: input.candidates.length }
    : await loadSpotifyChartGenreCandidates(nowDate);
  const batch = await processSpotifyChartGenreCandidates(loaded.candidates, {
    limit: input.limit,
    concurrency: input.concurrency,
    maxDurationMs: input.maxDurationMs,
    now: input.now,
    enrich: input.enrich,
  });

  return {
    ...batch,
    eligible: loaded.eligibleCount,
    remaining: Math.max(0, loaded.eligibleCount - batch.processed),
  };
}
