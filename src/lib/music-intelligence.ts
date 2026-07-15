import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type MusicIntelligenceSnapshotRef,
  type MusicIntelligenceSourceTrack,
  buildMusicIntelligenceModel,
  createEmptyMusicIntelligenceResponse,
} from "@/lib/music-intelligence-model";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type {
  MusicIntelligenceCountry,
  MusicIntelligenceResponse,
} from "@/types/music-intelligence";

type CompleteSnapshotRow = {
  snapshot_id: string;
  country: MusicIntelligenceCountry;
  chart_date: string;
  tracks_count: number;
};

type SnapshotTrackRow = {
  id: string;
  snapshot_id: string;
  chart_date: string;
  position: number;
  previous_position: number | null;
  spotify_track_id: string | null;
  track_name: string;
  artist_name: string | null;
  streams: number | null;
  image_url: string | null;
};

type BackfillCampaignGateRow = {
  phase_key: string;
  status: string;
  window_days: number;
  expected_job_count: number;
  linked_job_count: number;
  covered_job_count: number;
  pending_job_count: number;
  retry_pending_job_count: number;
  running_job_count: number;
  failed_job_count: number;
};

const CACHE_TTL_MS = 2 * 60 * 1000;
const SNAPSHOT_PAGE_SIZE = 1000;
const TRACK_PAGE_SIZE = 1000;
const SNAPSHOT_BATCH_SIZE = 20;
const TRACK_OFFSETS = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21,
  22, 23, 24, 25, 26, 27, 28, 29, 30, 60, 90, 180, 365,
] as const;

let responseCache: {
  value: MusicIntelligenceResponse;
  expiresAt: number;
} | null = null;
let responseInFlight: Promise<MusicIntelligenceResponse> | null = null;

function subtractDays(date: string, amount: number) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() - amount);
  return next.toISOString().slice(0, 10);
}

function chunk<T>(values: T[], size: number) {
  const chunks: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

async function loadCompleteSnapshots(client: SupabaseClient) {
  const rows: CompleteSnapshotRow[] = [];

  for (let offset = 0; ; offset += SNAPSHOT_PAGE_SIZE) {
    const { data, error } = await client
      .from("spotify_chart_complete_snapshots")
      .select("snapshot_id,country,chart_date,tracks_count")
      .in("country", ["BR", "GLOBAL"])
      .eq("chart_type", "top-songs")
      .order("chart_date", { ascending: false })
      .order("country", { ascending: true })
      .range(offset, offset + SNAPSHOT_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Music Intelligence snapshots failed: ${error.message}`);
    }

    const page = (data ?? []) as CompleteSnapshotRow[];
    rows.push(...page);
    if (page.length < SNAPSHOT_PAGE_SIZE) {
      break;
    }
  }

  return rows;
}

function findLatestCommonDate(rows: CompleteSnapshotRow[]) {
  const brDates = rows
    .filter((row) => row.country === "BR")
    .map((row) => row.chart_date)
    .sort((left, right) => right.localeCompare(left));
  const globalDates = new Set(
    rows.filter((row) => row.country === "GLOBAL").map((row) => row.chart_date),
  );

  return brDates.find((date) => globalDates.has(date)) ?? null;
}

function selectAnalysisSnapshots(
  rows: CompleteSnapshotRow[],
  latestDate: string,
  validatedMaxWindow: number,
) {
  const selectedDates = new Set(
    TRACK_OFFSETS.filter(
      (offset) => offset === 0 || offset <= validatedMaxWindow,
    ).map((offset) => subtractDays(latestDate, offset)),
  );
  return rows.filter(
    (row) => row.chart_date <= latestDate && selectedDates.has(row.chart_date),
  );
}

async function loadSnapshotTracks(
  client: SupabaseClient,
  snapshotIds: string[],
) {
  const tracks: SnapshotTrackRow[] = [];

  for (const snapshotBatch of chunk(snapshotIds, SNAPSHOT_BATCH_SIZE)) {
    for (let offset = 0; ; offset += TRACK_PAGE_SIZE) {
      const { data, error } = await client
        .from("chart_snapshot_tracks")
        .select(
          "id,snapshot_id,chart_date,position,previous_position,spotify_track_id,track_name,artist_name,streams,image_url",
        )
        .in("snapshot_id", snapshotBatch)
        .order("chart_date", { ascending: false })
        .order("snapshot_id", { ascending: true })
        .order("position", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + TRACK_PAGE_SIZE - 1);

      if (error) {
        throw new Error(`Music Intelligence tracks failed: ${error.message}`);
      }

      const page = (data ?? []) as SnapshotTrackRow[];
      tracks.push(...page);
      if (page.length < TRACK_PAGE_SIZE) {
        break;
      }
    }
  }

  return tracks;
}

async function loadFallbackImages(
  client: SupabaseClient,
  tracks: SnapshotTrackRow[],
  latestDate: string,
) {
  const missingIds = Array.from(
    new Set(
      tracks
        .filter(
          (track) =>
            track.chart_date === latestDate &&
            !track.image_url &&
            track.spotify_track_id,
        )
        .map((track) => track.spotify_track_id as string),
    ),
  );
  const images = new Map<string, string>();

  for (const trackIds of chunk(missingIds, 75)) {
    const { data, error } = await client
      .from("spotify_chart_entries")
      .select("spotify_track_id,image_url,chart_date")
      .in("spotify_track_id", trackIds)
      .eq("chart_date", latestDate)
      .not("image_url", "is", null)
      .order("chart_date", { ascending: false })
      .order("spotify_track_id", { ascending: true })
      .limit(trackIds.length * 2);

    if (error) {
      continue;
    }

    for (const row of data ?? []) {
      if (
        row.spotify_track_id &&
        row.image_url &&
        !images.has(row.spotify_track_id)
      ) {
        images.set(row.spotify_track_id, row.image_url);
      }
    }
  }

  return images;
}

function isHealthyCampaign(row: BackfillCampaignGateRow, window: number) {
  const expected = window * 2;
  return (
    row.status === "completed" &&
    row.window_days === window &&
    row.expected_job_count === expected &&
    row.linked_job_count === expected &&
    row.covered_job_count === expected &&
    row.pending_job_count === 0 &&
    row.retry_pending_job_count === 0 &&
    row.running_job_count === 0 &&
    row.failed_job_count === 0
  );
}

async function loadValidatedMaxWindow(): Promise<number> {
  const admin = createAdminClient();
  if (!admin) {
    return 0;
  }

  const { data, error } = await admin
    .from("spotify_chart_backfill_campaigns")
    .select(
      "phase_key,status,window_days,expected_job_count,linked_job_count,covered_job_count,pending_job_count,retry_pending_job_count,running_job_count,failed_job_count",
    )
    .eq("rollout_key", "spotify-charts-historical-v1")
    .in("phase_key", [
      "core-30d",
      "core-60d",
      "core-79d",
      "core-180d",
      "core-365d",
    ]);

  if (error) {
    return 0;
  }

  const campaigns = (data ?? []) as BackfillCampaignGateRow[];
  const gates = [
    { phaseKey: "core-365d", campaignWindow: 365, analysisWindow: 365 },
    { phaseKey: "core-180d", campaignWindow: 180, analysisWindow: 180 },
    { phaseKey: "core-79d", campaignWindow: 79, analysisWindow: 60 },
    { phaseKey: "core-60d", campaignWindow: 60, analysisWindow: 60 },
    { phaseKey: "core-30d", campaignWindow: 30, analysisWindow: 30 },
  ] as const;

  for (const gate of gates) {
    const campaign = campaigns.find((row) => row.phase_key === gate.phaseKey);
    if (campaign && isHealthyCampaign(campaign, gate.campaignWindow)) {
      return gate.analysisWindow;
    }
  }

  return 0;
}

async function buildResponse() {
  const client = await createClient();
  const [snapshotRows, validatedMaxWindow] = await Promise.all([
    loadCompleteSnapshots(client),
    loadValidatedMaxWindow(),
  ]);

  if (snapshotRows.length === 0) {
    return createEmptyMusicIntelligenceResponse();
  }

  const snapshots: MusicIntelligenceSnapshotRef[] = snapshotRows.map((row) => ({
    snapshotId: row.snapshot_id,
    country: row.country,
    chartDate: row.chart_date,
    tracksCount: row.tracks_count,
  }));

  const latestDate = findLatestCommonDate(snapshotRows);
  if (!latestDate) {
    return buildMusicIntelligenceModel({
      snapshots,
      tracks: [],
      validatedMaxWindow,
    });
  }

  const selectedSnapshots = selectAnalysisSnapshots(
    snapshotRows,
    latestDate,
    validatedMaxWindow,
  );
  const trackRows = await loadSnapshotTracks(
    client,
    selectedSnapshots.map((snapshot) => snapshot.snapshot_id),
  );
  const fallbackImageUrls = await loadFallbackImages(
    client,
    trackRows,
    latestDate,
  );
  const tracks: MusicIntelligenceSourceTrack[] = trackRows.map((row) => ({
    id: row.id,
    snapshotId: row.snapshot_id,
    chartDate: row.chart_date,
    position: row.position,
    previousPosition: row.previous_position,
    spotifyTrackId: row.spotify_track_id,
    trackName: row.track_name,
    artistName: row.artist_name,
    streams: row.streams,
    imageUrl: row.image_url,
  }));

  return buildMusicIntelligenceModel({
    snapshots,
    tracks,
    fallbackImageUrls,
    validatedMaxWindow,
  });
}

export async function getMusicIntelligence(): Promise<MusicIntelligenceResponse> {
  if (responseCache && responseCache.expiresAt > Date.now()) {
    return responseCache.value;
  }

  if (responseInFlight) {
    return responseInFlight;
  }

  responseInFlight = buildResponse();
  try {
    const value = await responseInFlight;
    responseCache = {
      value,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    return value;
  } finally {
    responseInFlight = null;
  }
}
