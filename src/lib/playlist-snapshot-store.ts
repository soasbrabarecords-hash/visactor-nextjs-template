import "server-only";

type SupabaseSnapshotResponse = {
  message?: string;
};

export type PlaylistSnapshotRow = {
  playlist_id: string | null;
  playlist_name: string | null;
  followers: number | string | null;
  total_tracks: number | string | null;
  score: number | string | null;
  captured_at: string | null;
};

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const PLAYLIST_SNAPSHOTS_TTL_MS = 2 * 60 * 1000;
let playlistSnapshotsCache: CacheEntry<PlaylistSnapshotRow[]> | null = null;
let playlistSnapshotsInFlight: Promise<PlaylistSnapshotRow[]> | null = null;

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

export async function fetchPlaylistSnapshots(): Promise<PlaylistSnapshotRow[]> {
  if (
    playlistSnapshotsCache &&
    playlistSnapshotsCache.expiresAt > Date.now()
  ) {
    return playlistSnapshotsCache.value;
  }

  if (playlistSnapshotsInFlight) {
    return playlistSnapshotsInFlight;
  }

  const env = getSupabaseEnv();

  if (!env) {
    return [];
  }

  const url = new URL(`${env.url}/rest/v1/playlist_snapshots`);
  url.searchParams.set(
    "select",
    "playlist_id,playlist_name,followers,total_tracks,score,captured_at",
  );
  url.searchParams.set("order", "captured_at.desc");
  url.searchParams.set("limit", "500");

  playlistSnapshotsInFlight = (async () => {
    const response = await fetch(url.toString(), {
      headers: buildHeaders(env),
      cache: "no-store",
    }).catch(() => null);

    if (!response || !response.ok) {
      return [];
    }

    const payload = (await response.json().catch(() => null)) as
      | PlaylistSnapshotRow[]
      | SupabaseSnapshotResponse
      | null;

    const rows = Array.isArray(payload) ? payload : [];
    playlistSnapshotsCache = {
      value: rows,
      expiresAt: Date.now() + PLAYLIST_SNAPSHOTS_TTL_MS,
    };

    return rows;
  })();

  try {
    return await playlistSnapshotsInFlight;
  } finally {
    playlistSnapshotsInFlight = null;
  }
}
