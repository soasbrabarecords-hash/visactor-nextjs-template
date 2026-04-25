import "server-only";

const PLAYLIST_COLUMNS = "id,created_at,url,name,image_url,followers,tracks,score";

export type SupabasePlaylistRow = {
  id: string | number | null;
  created_at: string | null;
  url: string | null;
  name: string | null;
  image_url: string | null;
  followers: number | string | null;
  tracks: number | string | null;
  score: number | string | null;
};

type SupabaseSelectResponse = {
  message?: string;
};

type SupabaseInsertPlaylistInput = {
  url: string;
  name?: string | null;
  image_url?: string | null;
  followers?: number | null;
  tracks?: number | null;
  score?: number | null;
};

type SupabaseUpdatePlaylistInput = {
  url?: string;
  name?: string | null;
  image_url?: string | null;
  followers?: number | null;
  tracks?: number | null;
  score?: number | null;
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

export async function fetchPlaylistByIdFromSupabase(
  id: string,
): Promise<SupabasePlaylistRow | null> {
  const env = getSupabaseEnv();

  if (!env) {
    return null;
  }

  const response = await fetch(
    `${env.url}/rest/v1/playlists?select=${encodeURIComponent(PLAYLIST_COLUMNS)}&id=eq.${encodeURIComponent(id)}&limit=1`,
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
      errorPayload?.message ?? "Failed to fetch playlist from Supabase.",
    );
  }

  const rows = (await response.json()) as SupabasePlaylistRow[];
  return rows[0] ?? null;
}

export async function insertPlaylistIntoSupabase(
  input: SupabaseInsertPlaylistInput,
): Promise<SupabasePlaylistRow> {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const payload = {
    url: input.url,
    name: input.name ?? null,
    image_url: input.image_url ?? null,
    followers: input.followers ?? null,
    tracks: input.tracks ?? null,
    score: input.score ?? null,
  };

  const response = await fetch(`${env.url}/rest/v1/playlists`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: env.anonKey,
      Authorization: `Bearer ${env.anonKey}`,
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | SupabaseSelectResponse
      | null;

    throw new Error(
      errorPayload?.message ?? "Failed to insert playlist into Supabase.",
    );
  }

  const rows = (await response.json()) as SupabasePlaylistRow[];
  const insertedRow = rows[0];

  if (!insertedRow) {
    throw new Error("Supabase did not return the inserted playlist.");
  }

  return insertedRow;
}

export async function updatePlaylistInSupabase(
  id: string,
  input: SupabaseUpdatePlaylistInput,
): Promise<void> {
  const env = getSupabaseEnv();

  if (!env) {
    throw new Error("Supabase environment variables are not configured.");
  }

  const response = await fetch(
    `${env.url}/rest/v1/playlists?id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        apikey: env.anonKey,
        Authorization: `Bearer ${env.anonKey}`,
      },
      body: JSON.stringify(input),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | SupabaseSelectResponse
      | null;

    throw new Error(
      errorPayload?.message ?? "Failed to update playlist in Supabase.",
    );
  }
}
