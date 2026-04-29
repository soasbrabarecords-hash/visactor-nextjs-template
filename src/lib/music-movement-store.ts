import "server-only";

export type MusicChartMovementInput = {
  spotify_track_id: string;
  current_rank: number;
  previous_rank: number | null;
  rank_change: number | null;
  movement_type: string;
  popularity_current: number;
  popularity_previous: number | null;
  popularity_change: number | null;
  days_on_chart: number;
  saturation_count: number;
  opportunity_score: number;
  intelligence_tags: string[];
  country: string;
  genre: string;
  snapshot_day: string;
  calculated_at: string;
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

export async function upsertMusicChartMovements(
  rows: MusicChartMovementInput[],
): Promise<boolean> {
  const env = getSupabaseEnv();

  if (!env || rows.length === 0) {
    return false;
  }

  const url = new URL(`${env.url}/rest/v1/music_chart_movements`);
  url.searchParams.set(
    "on_conflict",
    "country,genre,spotify_track_id,snapshot_day",
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

  if (!response || !response.ok) {
    return false;
  }

  return true;
}
