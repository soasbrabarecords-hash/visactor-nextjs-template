import "server-only";

const PLAYLIST_COLUMNS = "id,created_at,url,name,followers,tracks,score";

type SupabasePlaylistRow = {
  id: string | number | null;
  created_at: string | null;
  url: string | null;
  name: string | null;
  followers: number | string | null;
  tracks: number | string | null;
  score: number | string | null;
};

type SupabaseSelectResponse = {
  message?: string;
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

export async function fetchPlaylistsFromSupabase(): Promise<SupabasePlaylistRow[]> {
  const env = getSupabaseEnv();

  if (!env) {
    return [];
  }

  const response = await fetch(
    `${env.url}/rest/v1/playlists?select=${encodeURIComponent(PLAYLIST_COLUMNS)}&order=followers.desc.nullslast`,
    {
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | SupabaseSelectResponse
      | null;
    throw new Error(
      errorPayload?.message ?? "Failed to fetch playlists from Supabase.",
    );
  }

  return (await response.json()) as SupabasePlaylistRow[];
}
