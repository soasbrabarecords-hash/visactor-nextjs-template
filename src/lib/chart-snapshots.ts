import "server-only";

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

    return { count: tracks.length, error: null };
  }

  return { count: tracks.length, error: null };
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
