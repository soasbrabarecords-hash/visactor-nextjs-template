import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ArtistRole } from "@/lib/label-os-taxonomy";

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
  return (data ?? []) as LabelArtist[];
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
  return data as LabelArtist;
}

export async function updateLabelArtist(
  id: string,
  input: Partial<LabelArtistInput>,
): Promise<LabelArtist> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_artists")
    .update(input)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`updateLabelArtist: ${error.message}`);
  return data as LabelArtist;
}

export async function createLabelArtist(
  input: LabelArtistInput,
): Promise<LabelArtist> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_artists")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`createLabelArtist: ${error.message}`);
  return data as LabelArtist;
}

// ─── Tracks ───────────────────────────────────────────────

export async function getLabelTracks(): Promise<LabelTrack[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_tracks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getLabelTracks: ${error.message}`);
  return (data ?? []) as LabelTrack[];
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
  return data as LabelTrack;
}

export async function createLabelTrack(
  input: LabelTrackInput,
): Promise<LabelTrack> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_tracks")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`createLabelTrack: ${error.message}`);
  return data as LabelTrack;
}

// ─── Participants ─────────────────────────────────────────

export async function getTrackParticipants(
  trackId: string,
): Promise<TrackParticipant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_participants")
    .select("*, label_artists(id, name, artist_name)")
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
