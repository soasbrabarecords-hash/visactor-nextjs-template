import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  type ChartSnapshotTrackInput,
  replaceChartSnapshotAtomically,
  upsertChartSnapshot,
  upsertChartSnapshotTracks,
} from "./chart-snapshots";
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
  spotify_track_uri?: string | null;
};

export type SpotifyChartsImportResult = {
  insertedCount: number;
  skippedCount: number;
  errors: string[];
  debug?: {
    parsedRows: number;
    validRows: number;
    entriesSaved: boolean;
    snapshotCreated: boolean;
    tracksSaved: number;
    tracksError: string | null;
  };
};

function normalizeString(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeStringArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) {
    return value.map((item) => item.trim()).filter((item) => item.length > 0);
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
  spotify_track_id: string | null;
  country: string;
  chart_name: string;
  chart_date: string;
  rank_position: number;
}) {
  return [
    row.country,
    row.chart_name,
    row.chart_date,
    row.spotify_track_id ?? `rank:${row.rank_position}`,
  ].join("::");
}

function validateRow(
  row: SpotifyChartImportRow,
  index: number,
):
  | {
      entry: SpotifyChartEntryInput;
      snapshot: SupabaseStreamSnapshotInput | null;
    }
  | {
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

  if (!trackName) {
    return { error: `Row ${index + 1}: missing track_name.` };
  }

  if (!artistName) {
    return { error: `Row ${index + 1}: missing artist_name.` };
  }

  if (!country) {
    return {
      error: `Row ${index + 1}: missing country for ${spotifyTrackId}.`,
    };
  }

  if (!chartDate) {
    return {
      error: `Row ${index + 1}: invalid chart_date for ${spotifyTrackId}.`,
    };
  }

  if (!rankPosition || rankPosition <= 0) {
    return {
      error: `Row ${index + 1}: invalid rank_position for ${spotifyTrackId}.`,
    };
  }

  if (dailyStreams !== null && dailyStreams < 0) {
    return { error: `Row ${index + 1}: invalid daily_streams.` };
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
      daily_streams: dailyStreams === null ? null : Math.trunc(dailyStreams),
      captured_at: capturedAt,
      chart_type: chartName,
      rank: Math.trunc(rankPosition),
      artist_names: artistName,
      spotify_track_uri:
        normalizeString(row.spotify_track_uri) ??
        (spotifyTrackId ? `spotify:track:${spotifyTrackId}` : null),
      streams: dailyStreams === null ? null : Math.trunc(dailyStreams),
      raw_row: { ...row },
    },
    snapshot:
      spotifyTrackId && spotifyUrl && dailyStreams !== null
        ? {
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
            previous_rank:
              previousRank === null ? null : Math.trunc(previousRank),
            captured_at: capturedAt,
          }
        : null,
  };
}

async function upsertTrackStreamSnapshots(
  rows: SupabaseStreamSnapshotInput[],
): Promise<boolean> {
  if (rows.length === 0) {
    return false;
  }

  const supabase = createAdminClient();

  if (!supabase) {
    return false;
  }

  const { error } = await supabase.from("track_stream_snapshots").upsert(rows, {
    onConflict: "spotify_track_id,country,chart_name,chart_date",
    ignoreDuplicates: false,
  });

  return !error;
}

export async function importSpotifyChartRows(
  rows: SpotifyChartImportRow[],
  options: {
    persistStreamSnapshots?: boolean;
    persistLegacyEntries?: boolean;
    persistSnapshotAtomically?: boolean;
  } = {},
): Promise<SpotifyChartsImportResult> {
  const errors: string[] = [];
  const entryRows: SpotifyChartEntryInput[] = [];
  const snapshotRows: SupabaseStreamSnapshotInput[] = [];
  const seenKeys = new Set<string>();
  let skippedCount = 0;

  const parsedRows = rows.length;

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
    if (validated.snapshot) {
      snapshotRows.push(validated.snapshot);
    }
  });

  const validRows = entryRows.length;

  if (entryRows.length === 0) {
    return {
      insertedCount: 0,
      skippedCount,
      errors: [
        ...errors,
        `[debug] parsedRows=${parsedRows} validRows=0 — todas as rows falharam na validação.`,
      ],
      debug: {
        parsedRows,
        validRows: 0,
        entriesSaved: false,
        snapshotCreated: false,
        tracksSaved: 0,
        tracksError: null,
      },
    };
  }

  // The historical worker deliberately bypasses this compatibility table. Its
  // identity is track-based, so replaying an old rank with a corrected track
  // can retain two rows for the same position. Daily/latest keeps its exact
  // existing behavior because persistLegacyEntries defaults to true.
  const shouldPersistLegacyEntries = options.persistLegacyEntries !== false;
  const entriesSaved = shouldPersistLegacyEntries
    ? await upsertSpotifyChartEntries(entryRows)
    : true;
  if (shouldPersistLegacyEntries && !entriesSaved) {
    errors.push(
      `[debug] spotify_chart_entries: falha no upsert (não crítico, continuando).`,
    );
  }

  const shouldPersistStreamSnapshots = options.persistStreamSnapshots !== false;
  const snapshotsSaved = shouldPersistStreamSnapshots
    ? await upsertTrackStreamSnapshots(snapshotRows)
    : true;
  if (shouldPersistStreamSnapshots && !snapshotsSaved) {
    errors.push(
      "[debug] track_stream_snapshots: falha no upsert (não crítico).",
    );
  }

  // ── Salvar histórico diário estruturado (chart_snapshots) ──────────────────
  const byDateCountry = new Map<string, SpotifyChartEntryInput[]>();
  for (const entry of entryRows) {
    const key = `${entry.chart_date}::${entry.country}`;
    const group = byDateCountry.get(key) ?? [];
    group.push(entry);
    byDateCountry.set(key, group);
  }

  let snapshotCreated = false;
  let tracksSaved = 0;
  let tracksError: string | null = null;

  for (const [, group] of byDateCountry) {
    const first = group[0];
    if (!first) continue;

    const sortedGroup = [...group].sort(
      (a, b) => a.rank_position - b.rank_position,
    );

    const trackInputs: ChartSnapshotTrackInput[] = sortedGroup.map((e) => ({
      chart_date: e.chart_date,
      position: e.rank_position,
      previous_position: e.previous_rank ?? null,
      spotify_track_id: e.spotify_track_id,
      track_name: e.track_name,
      artist_name: e.artist_name,
      streams: e.daily_streams ?? null,
      genre: e.genre ?? null,
      image_url: e.image_url ?? null,
    }));

    if (options.persistSnapshotAtomically) {
      const atomicResult = await replaceChartSnapshotAtomically(
        {
          chart_date: first.chart_date,
          country: first.country,
          chart_type: first.chart_name,
          source: first.source_type,
          total_tracks: group.length,
        },
        trackInputs,
      );

      if (atomicResult.error || !atomicResult.snapshotId) {
        tracksError = atomicResult.error;
        errors.push(
          `[debug] atomic chart snapshot (${first.chart_date}): ${atomicResult.error ?? "resultado ausente"}`,
        );
        continue;
      }

      snapshotCreated = true;
      tracksSaved = atomicResult.count;
      continue;
    }

    const snapshot = await upsertChartSnapshot({
      chart_date: first.chart_date,
      country: first.country,
      chart_type: first.chart_name,
      source: first.source_type,
      total_tracks: group.length,
    });

    if (!snapshot) {
      const msg = `[debug] chart_snapshot upsert falhou para ${first.chart_date} (country=${first.country}).`;
      errors.push(msg);
      continue;
    }

    snapshotCreated = true;

    const tracksResult = await upsertChartSnapshotTracks(
      snapshot.id,
      trackInputs,
    );
    tracksSaved = tracksResult.count;
    tracksError = tracksResult.error;

    if (tracksResult.error) {
      errors.push(
        `[debug] chart_snapshot_tracks (${first.chart_date}): ${tracksResult.error}`,
      );
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  return {
    insertedCount: entryRows.length,
    skippedCount,
    errors,
    debug: {
      parsedRows,
      validRows,
      entriesSaved,
      snapshotCreated,
      tracksSaved,
      tracksError,
    },
  };
}
