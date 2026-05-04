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

export async function fetchPlaylistsFromSupabase(): Promise<SupabasePlaylistRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select(PLAYLIST_COLUMNS)
    .order("followers", { ascending: false, nullsFirst: false });

  if (error) {
    throw new Error(error.message || "Failed to fetch playlists from Supabase.");
  }

  return (data ?? []) as SupabasePlaylistRow[];
}

export async function fetchPlaylistByIdFromSupabase(
  id: string,
): Promise<SupabasePlaylistRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("playlists")
    .select(PLAYLIST_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to fetch playlist from Supabase.");
  }

  return (data as SupabasePlaylistRow | null) ?? null;
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
}
