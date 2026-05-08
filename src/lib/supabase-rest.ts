import "server-only";

import { createClient } from "@/lib/supabase/server";

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

const PLAYLIST_COLUMNS =
  "id,created_at,url,name,image_url,followers,tracks,score";

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const PLAYLISTS_CACHE_TTL_MS = 2 * 60 * 1000;
const PLAYLIST_BY_ID_CACHE_TTL_MS = 2 * 60 * 1000;

let playlistsCache: CacheEntry<SupabasePlaylistRow[]> | null = null;
let playlistsInFlight: Promise<SupabasePlaylistRow[]> | null = null;
const playlistByIdCache = new Map<
  string,
  CacheEntry<SupabasePlaylistRow | null>
>();
const playlistByIdInFlight = new Map<
  string,
  Promise<SupabasePlaylistRow | null>
>();

function clearPlaylistCaches(id?: string) {
  playlistsCache = null;

  if (id) {
    playlistByIdCache.delete(id);
    playlistByIdInFlight.delete(id);
    return;
  }

  playlistByIdCache.clear();
  playlistByIdInFlight.clear();
}

export async function fetchPlaylistsFromSupabase(): Promise<SupabasePlaylistRow[]> {
  if (playlistsCache && playlistsCache.expiresAt > Date.now()) {
    return playlistsCache.value;
  }

  if (playlistsInFlight) {
    return playlistsInFlight;
  }

  const supabase = await createClient();
  playlistsInFlight = (async () => {
    const { data, error } = await supabase
      .from("playlists")
      .select(PLAYLIST_COLUMNS)
      .order("followers", { ascending: false, nullsFirst: false });

    if (error) {
      throw new Error(
        error.message || "Failed to fetch playlists from Supabase.",
      );
    }

    const rows = (data ?? []) as SupabasePlaylistRow[];
    playlistsCache = {
      value: rows,
      expiresAt: Date.now() + PLAYLISTS_CACHE_TTL_MS,
    };

    return rows;
  })();

  try {
    return await playlistsInFlight;
  } finally {
    playlistsInFlight = null;
  }
}

export async function fetchPlaylistByIdFromSupabase(
  id: string,
): Promise<SupabasePlaylistRow | null> {
  const cachedEntry = playlistByIdCache.get(id);

  if (cachedEntry && cachedEntry.expiresAt > Date.now()) {
    return cachedEntry.value;
  }

  const inFlight = playlistByIdInFlight.get(id);

  if (inFlight) {
    return inFlight;
  }

  const supabase = await createClient();
  const request = (async () => {
    const { data, error } = await supabase
      .from("playlists")
      .select(PLAYLIST_COLUMNS)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new Error(
        error.message || "Failed to fetch playlist from Supabase.",
      );
    }

    const row = (data as SupabasePlaylistRow | null) ?? null;
    playlistByIdCache.set(id, {
      value: row,
      expiresAt: Date.now() + PLAYLIST_BY_ID_CACHE_TTL_MS,
    });

    return row;
  })();

  playlistByIdInFlight.set(id, request);

  try {
    return await request;
  } finally {
    playlistByIdInFlight.delete(id);
  }
}

export async function insertPlaylistIntoSupabase(
  input: SupabaseInsertPlaylistInput,
): Promise<SupabasePlaylistRow> {
  const supabase = await createClient();
  const payload = {
    url: input.url,
    name: input.name ?? null,
    image_url: input.image_url ?? null,
    followers: input.followers ?? null,
    tracks: input.tracks ?? null,
    score: input.score ?? null,
  };

  const { data, error } = await supabase
    .from("playlists")
    .insert(payload)
    .select(PLAYLIST_COLUMNS)
    .single();

  if (error) {
    throw new Error(
      error.message || "Failed to insert playlist into Supabase.",
    );
  }

  clearPlaylistCaches(String(data.id));
  return data as SupabasePlaylistRow;
}

export async function updatePlaylistInSupabase(
  id: string,
  input: SupabaseUpdatePlaylistInput,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("playlists").update(input).eq("id", id);

  if (error) {
    throw new Error(
      error.message || "Failed to update playlist in Supabase.",
    );
  }

  clearPlaylistCaches(id);
}
