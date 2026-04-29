import "server-only";

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

// ── Upsert snapshot header ────────────────────────────────────────────────────

export async function upsertChartSnapshot(
  input: ChartSnapshotInput,
): Promise<ChartSnapshot | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_snapshots")
    .upsert(
      {
        chart_date: input.chart_date,
        source: input.source ?? "spotify_charts_csv",
        country: input.country ?? "BR",
        chart_type: input.chart_type ?? "top_200_daily",
        original_filename: input.original_filename ?? null,
        total_tracks: input.total_tracks,
        imported_at: new Date().toISOString(),
      },
      { onConflict: "chart_date" },
    )
    .select()
    .single();

  if (error) {
    process.stderr.write(`upsertChartSnapshot error: ${error.message}\n`);
    return null;
  }

  return data as ChartSnapshot;
}

// ── Upsert snapshot tracks ────────────────────────────────────────────────────

export async function upsertChartSnapshotTracks(
  snapshotId: string,
  tracks: ChartSnapshotTrackInput[],
): Promise<number> {
  if (tracks.length === 0) return 0;

  const supabase = await createClient();

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

  const { error } = await supabase
    .from("chart_snapshot_tracks")
    .upsert(rows, { onConflict: "snapshot_id,position" });

  if (error) {
    process.stderr.write(`upsertChartSnapshotTracks error: ${error.message}\n`);
    return 0;
  }

  return tracks.length;
}

// ── List available dates ──────────────────────────────────────────────────────

export async function getSnapshotDates(country = "BR"): Promise<string[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_snapshots")
    .select("chart_date")
    .eq("country", country)
    .order("chart_date", { ascending: false });

  if (error) return [];

  // Deduplica e mantém a ordem DESC — chart_date é string ISO, ordem lexicográfica = cronológica
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const r of data ?? []) {
    if (!seen.has(r.chart_date)) {
      seen.add(r.chart_date);
      unique.push(r.chart_date);
    }
  }
  return unique;
}

// ── Get snapshot header for a date ───────────────────────────────────────────

export async function getSnapshotByDate(
  chartDate: string,
  country = "BR",
): Promise<ChartSnapshot | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_snapshots")
    .select("*")
    .eq("chart_date", chartDate)
    .eq("country", country)
    .maybeSingle();

  if (error || !data) return null;
  return data as ChartSnapshot;
}

// ── Get snapshot tracks (raw) for a date ─────────────────────────────────────

export async function getSnapshotTracks(
  snapshotId: string,
): Promise<ChartSnapshotTrack[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("chart_snapshot_tracks")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("position", { ascending: true });

  if (error) return [];
  return (data ?? []) as ChartSnapshotTrack[];
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
  // 1. Get target snapshot
  const snapshot = await getSnapshotByDate(chartDate, country);
  if (!snapshot) return { snapshot: null, tracks: [], previousDate: null };

  const rawTracks = await getSnapshotTracks(snapshot.id);

  // 1b. Enrich image_url from spotify_chart_entries (same spotify_track_id)
  const supabase = await createClient();
  const trackIds = rawTracks
    .map((t) => t.spotify_track_id)
    .filter((id): id is string => !!id);

  const imageUrlMap = new Map<string, string>();
  if (trackIds.length > 0) {
    const { data: entryRows } = await supabase
      .from("spotify_chart_entries")
      .select("spotify_track_id,image_url")
      .in("spotify_track_id", trackIds)
      .not("image_url", "is", null)
      .limit(trackIds.length * 2);

    for (const row of entryRows ?? []) {
      if (row.spotify_track_id && row.image_url && !imageUrlMap.has(row.spotify_track_id)) {
        imageUrlMap.set(row.spotify_track_id, row.image_url);
      }
    }
  }

  const currentTracks: ChartSnapshotTrack[] = rawTracks.map((t) => ({
    ...t,
    image_url: t.image_url ?? (t.spotify_track_id ? imageUrlMap.get(t.spotify_track_id) ?? null : null),
  }));

  // 2. Find previous snapshot date
  const { data: prevData } = await supabase
    .from("chart_snapshots")
    .select("id, chart_date")
    .eq("country", country)
    .lt("chart_date", chartDate)
    .order("chart_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  const previousDate = prevData?.chart_date ?? null;

  if (!previousDate || !prevData?.id) {
    // No previous snapshot — all tracks are "new"
    const tracks = currentTracks.map((t) => ({
      ...t,
      position_change: null,
      status: "new" as const,
      stream_change: null,
      stream_growth_percent: null,
    }));
    return { snapshot, tracks, previousDate: null };
  }

  // 3. Load previous snapshot tracks (index by spotify_track_id)
  const prevTracks = await getSnapshotTracks(prevData.id);
  const prevByTrackId = new Map<string, ChartSnapshotTrack>();
  const prevByName = new Map<string, ChartSnapshotTrack>();

  for (const t of prevTracks) {
    if (t.spotify_track_id) prevByTrackId.set(t.spotify_track_id, t);
    // Fallback key: track_name + artist_name lowercased
    const nameKey = `${t.track_name?.toLowerCase()}::${t.artist_name?.toLowerCase() ?? ""}`;
    prevByName.set(nameKey, t);
  }

  // 4. Build enriched tracks
  const tracks: ChartSnapshotTrackWithMovement[] = currentTracks.map((t) => {
    const prev =
      (t.spotify_track_id ? prevByTrackId.get(t.spotify_track_id) : undefined) ??
      prevByName.get(`${t.track_name?.toLowerCase()}::${t.artist_name?.toLowerCase() ?? ""}`);

    if (!prev) {
      return {
        ...t,
        position_change: null,
        status: "new" as const,
        stream_change: null,
        stream_growth_percent: null,
      };
    }

    const posChange = prev.position - t.position; // positive = subiu (menor número = melhor)
    const status =
      posChange > 0 ? "up" : posChange < 0 ? "down" : "stable";

    const streamChange =
      t.streams !== null && prev.streams !== null
        ? t.streams - prev.streams
        : null;

    const streamGrowthPct =
      streamChange !== null && prev.streams !== null && prev.streams > 0
        ? Math.round((streamChange / prev.streams) * 10000) / 100
        : null;

    return {
      ...t,
      position_change: posChange,
      status,
      stream_change: streamChange,
      stream_growth_percent: streamGrowthPct,
    };
  });

  return { snapshot, tracks, previousDate };
}
