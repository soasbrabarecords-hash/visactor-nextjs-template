import "server-only";

type SupabaseSnapshotResponse = {
  message?: string;
};

export type MusicTrackSnapshotRow = {
  market: string | null;
  genre: string | null;
  track_id: string | null;
  snapshot_date: string | null;
  captured_at: string | null;
  track_name: string | null;
  artists: string | null;
  album_name: string | null;
  cover_url: string | null;
  spotify_url: string | null;
  popularity: number | string | null;
  signal_count: number | string | null;
  source_mode: string | null;
  explicit: boolean | null;
};

export type MusicTrackSnapshotInput = {
  market: string;
  genre: string;
  track_id: string;
  snapshot_date: string;
  captured_at: string;
  track_name: string;
  artists: string;
  album_name: string;
  cover_url: string | null;
  spotify_url: string;
  popularity: number;
  signal_count: number;
  source_mode: string;
  explicit: boolean;
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

export async function upsertMusicTrackSnapshots(
  rows: MusicTrackSnapshotInput[],
): Promise<boolean> {
  const env = getSupabaseEnv();

  if (!env || rows.length === 0) {
    return false;
  }

  const url = new URL(`${env.url}/rest/v1/music_track_snapshots`);
  url.searchParams.set("on_conflict", "market,genre,track_id,snapshot_date");

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

export async function fetchMusicTrackSnapshots({
  market,
  genre,
  days = 30,
}: {
  market: string;
  genre: string;
  days?: number;
}): Promise<MusicTrackSnapshotRow[]> {
  const env = getSupabaseEnv();

  if (!env) {
    return [];
  }

  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - Math.max(days - 1, 0));

  const url = new URL(`${env.url}/rest/v1/music_track_snapshots`);
  url.searchParams.set(
    "select",
    "market,genre,track_id,snapshot_date,captured_at,track_name,artists,album_name,cover_url,spotify_url,popularity,signal_count,source_mode,explicit",
  );
  url.searchParams.set("market", `eq.${market}`);
  url.searchParams.set("genre", `eq.${genre}`);
  url.searchParams.set("snapshot_date", `gte.${sinceDate.toISOString().slice(0, 10)}`);
  url.searchParams.set("order", "snapshot_date.desc,captured_at.desc,signal_count.desc");

  const response = await fetch(url.toString(), {
    headers: buildHeaders(env),
    cache: "no-store",
  }).catch(() => null);

  if (!response || !response.ok) {
    return [];
  }

  const payload = (await response.json().catch(() => null)) as
    | MusicTrackSnapshotRow[]
    | SupabaseSnapshotResponse
    | null;

  return Array.isArray(payload) ? payload : [];
}
