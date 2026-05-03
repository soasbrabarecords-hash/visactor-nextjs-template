import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ArtistRole } from "@/lib/label-os-taxonomy";

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  return Boolean(
    error?.message?.includes(`Could not find the '${column}' column`) ||
      error?.message?.includes(`column "${column}" does not exist`),
  );
}

// ─── Types ────────────────────────────────────────────────

export type LabelArtist = {
  id: string;
  name: string;
  artist_name: string | null;
  roles: ArtistRole[];
  email: string | null;
  phone: string | null;
  instagram: string | null;
  spotify_url: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  document: string | null;
  birth_date: string | null;
  notes: string | null;
  created_at: string;
};

export type LabelArtistInput = Omit<LabelArtist, "id" | "created_at">;

export type LabelTrack = {
  id: string;
  title: string;
  version: string | null;
  isrc: string | null;
  upc: string | null;
  release_date: string | null;
  status: string;
  genre: string | null;
  subgenre: string | null;
  bpm: number | null;
  key: string | null;
  explicit: boolean;
  cover_url: string | null;
  audio_url: string | null;
  contract_url: string | null;
  notes: string | null;
  lyrics: string | null;
  created_at: string;
};

export type LabelTrackInput = Omit<LabelTrack, "id" | "created_at">;

export type TrackParticipant = {
  id: string;
  track_id: string;
  artist_id: string | null;
  entity_id: string | null;
  role: string;
  royalty_percentage: number;
  publishing_percentage: number;
  master_percentage: number;
  created_at: string;
  label_artists?: Pick<LabelArtist, "id" | "name" | "artist_name">;
  label_entities?: {
    id: string;
    name: string;
    display_name: string | null;
    type: string;
  };
};

export type TrackParticipantInput = Omit<
  TrackParticipant,
  "id" | "created_at" | "label_artists"
>;

export type LabelOsStats = {
  totalTracks: number;
  totalArtists: number;
  draftTracks: number;
  releasedTracks: number;
};

// ─── Artists ──────────────────────────────────────────────

export async function getLabelArtists(): Promise<LabelArtist[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_artists")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getLabelArtists: ${error.message}`);
  return ((data ?? []) as LabelArtist[]).map((artist) => ({
    ...artist,
    roles: Array.isArray(artist.roles) && artist.roles.length > 0 ? artist.roles : ["artist"],
  }));
}

export async function getLabelArtistById(
  id: string,
): Promise<LabelArtist | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_artists")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return {
    ...(data as LabelArtist),
    roles:
      Array.isArray((data as LabelArtist).roles) && (data as LabelArtist).roles.length > 0
        ? (data as LabelArtist).roles
        : ["artist"],
  };
}

export async function updateLabelArtist(
  id: string,
  input: Partial<LabelArtistInput>,
): Promise<LabelArtist> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("label_artists")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (isMissingColumnError(error, "roles")) {
    const { roles: _roles, ...fallbackInput } = input;

    const retry = await supabase
      .from("label_artists")
      .update(fallbackInput)
      .eq("id", id)
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(`updateLabelArtist: ${error.message}`);
  return {
    ...(data as LabelArtist),
    roles:
      Array.isArray((data as LabelArtist).roles) && (data as LabelArtist).roles.length > 0
        ? (data as LabelArtist).roles
        : (input.roles?.length ? input.roles : ["artist"]),
  };
}

export async function createLabelArtist(
  input: LabelArtistInput,
): Promise<LabelArtist> {
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("label_artists")
    .insert(input)
    .select()
    .single();

  if (isMissingColumnError(error, "roles")) {
    const { roles: _roles, ...fallbackInput } = input;

    const retry = await supabase
      .from("label_artists")
      .insert(fallbackInput)
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(`createLabelArtist: ${error.message}`);
  return {
    ...(data as LabelArtist),
    roles:
      Array.isArray((data as LabelArtist).roles) && (data as LabelArtist).roles.length > 0
        ? (data as LabelArtist).roles
        : (input.roles?.length ? input.roles : ["artist"]),
  };
}

// ─── Tracks ───────────────────────────────────────────────

export async function getLabelTracks(): Promise<LabelTrack[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_tracks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getLabelTracks: ${error.message}`);
  return ((data ?? []) as LabelTrack[]).map((track) => ({
    ...track,
    subgenre: track.subgenre ?? null,
  }));
}

export async function getLabelTrackById(
  id: string,
): Promise<LabelTrack | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_tracks")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return { ...(data as LabelTrack), subgenre: (data as LabelTrack).subgenre ?? null };
}

export async function createLabelTrack(
  input: LabelTrackInput,
): Promise<LabelTrack> {
  const supabase = await createClient();
  let payload: Partial<LabelTrackInput> = { ...input };
  let data: LabelTrack | null = null;
  let error: { message?: string } | null = null;

  for (const optionalColumn of ["subgenre", "lyrics"] as const) {
    const response = await supabase
      .from("label_tracks")
      .insert(payload)
      .select()
      .single();

    data = response.data as LabelTrack | null;
    error = response.error;

    if (!isMissingColumnError(error, optionalColumn)) {
      break;
    }

    const { [optionalColumn]: _ignored, ...fallbackPayload } = payload;
    payload = fallbackPayload;
  }

  if (error) throw new Error(`createLabelTrack: ${error.message}`);
  return {
    ...(data as LabelTrack),
    subgenre: (data as LabelTrack).subgenre ?? input.subgenre ?? null,
  };
}

export async function updateLabelTrack(
  id: string,
  input: Partial<LabelTrackInput>,
): Promise<LabelTrack> {
  const supabase = await createClient();
  let payload: Partial<LabelTrackInput> = { ...input };
  let data: LabelTrack | null = null;
  let error: { message?: string } | null = null;

  for (const optionalColumn of ["subgenre", "lyrics"] as const) {
    const response = await supabase
      .from("label_tracks")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    data = response.data as LabelTrack | null;
    error = response.error;

    if (!isMissingColumnError(error, optionalColumn)) {
      break;
    }

    const { [optionalColumn]: _ignored, ...fallbackPayload } = payload;
    payload = fallbackPayload;
  }

  if (error) throw new Error(`updateLabelTrack: ${error.message}`);
  return {
    ...(data as LabelTrack),
    subgenre: (data as LabelTrack).subgenre ?? input.subgenre ?? null,
  };
}

// ─── Participants ─────────────────────────────────────────

export async function getTrackParticipants(
  trackId: string,
): Promise<TrackParticipant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_participants")
    .select("*, label_artists(id, name, artist_name), label_entities(id, name, display_name, type)")
    .eq("track_id", trackId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getTrackParticipants: ${error.message}`);
  return (data ?? []) as TrackParticipant[];
}

export async function addTrackParticipant(
  input: TrackParticipantInput,
): Promise<TrackParticipant> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_participants")
    .insert(input)
    .select()
    .single();

  if (isMissingColumnError(error, "entity_id")) {
    throw new Error(
      "addTrackParticipant: Seu banco ainda nao tem a coluna entity_id em label_track_participants. Rode a migration 20260428_add_entity_id_to_participants.sql no Supabase.",
    );
  }

  if (error) throw new Error(`addTrackParticipant: ${error.message}`);
  return data as TrackParticipant;
}

// ─── Stats ────────────────────────────────────────────────

export async function getLabelOsStats(): Promise<LabelOsStats> {
  const supabase = await createClient();

  const [tracksRes, artistsRes] = await Promise.all([
    supabase.from("label_tracks").select("status"),
    supabase.from("label_artists").select("id", { count: "exact", head: true }),
  ]);

  const tracks = (tracksRes.data ?? []) as { status: string }[];
  const totalArtists = artistsRes.count ?? 0;

  return {
    totalTracks: tracks.length,
    totalArtists,
    draftTracks: tracks.filter((t) => t.status === "draft").length,
    releasedTracks: tracks.filter((t) => t.status === "released").length,
  };
}

// ─── Storage ──────────────────────────────────────────────

export async function uploadLabelFile(
  bucket: "label-audio" | "label-covers" | "label-contracts",
  file: File,
  path: string,
): Promise<string> {
  const supabase = await createClient();
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    upsert: true,
  });

  if (error) throw new Error(`uploadLabelFile(${bucket}): ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
