import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ArtistRole } from "@/lib/label-os-taxonomy";
import type {
  LabelArtist,
  LabelArtistInput,
  LabelOsStats,
  LabelTrack,
  LabelTrackInput,
  TrackParticipant,
  TrackParticipantInput,
} from "@/lib/label-os-types";

function isMissingColumnError(error: { message?: string } | null | undefined, column: string) {
  return Boolean(
    error?.message?.includes(`Could not find the '${column}' column`) ||
      error?.message?.includes(`column "${column}" does not exist`),
  );
}

function isMissingRelationError(error: { message?: string; code?: string } | null | undefined) {
  return Boolean(
    error?.code === "PGRST200" ||
      error?.code === "PGRST205" ||
      error?.message?.includes("Could not find a relationship") ||
      error?.message?.includes("schema cache"),
  );
}

function requiresArtistRolesPersistence(roles?: ArtistRole[]) {
  if (!Array.isArray(roles) || roles.length === 0) return false;
  return !(roles.length === 1 && roles[0] === "artist");
}

export type {
  LabelArtist,
  LabelArtistInput,
  LabelOsStats,
  LabelTrack,
  LabelTrackInput,
  TrackParticipant,
  TrackParticipantInput,
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
    if (requiresArtistRolesPersistence(input.roles)) {
      throw new Error(
        "Seu banco ainda nao tem a coluna roles em label_artists. Rode a migration 20260502_add_roles_to_label_os.sql no Supabase para salvar compositor, interprete e produtor musical.",
      );
    }

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
    if (requiresArtistRolesPersistence(input.roles)) {
      throw new Error(
        "Seu banco ainda nao tem a coluna roles em label_artists. Rode a migration 20260502_add_roles_to_label_os.sql no Supabase para salvar compositor, interprete e produtor musical.",
      );
    }

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
    .select("*")
    .eq("track_id", trackId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getTrackParticipants: ${error.message}`);

  const rows = (data ?? []) as TrackParticipant[];
  const artistIds = Array.from(
    new Set(rows.map((row) => row.artist_id).filter((value): value is string => Boolean(value))),
  );
  const entityIds = Array.from(
    new Set(rows.map((row) => row.entity_id).filter((value): value is string => Boolean(value))),
  );

  let artistsById = new Map<string, Pick<LabelArtist, "id" | "name" | "artist_name">>();
  if (artistIds.length > 0) {
    const artistsResult = await supabase
      .from("label_artists")
      .select("id, name, artist_name")
      .in("id", artistIds);

    if (artistsResult.error) {
      throw new Error(`getTrackParticipants artists: ${artistsResult.error.message}`);
    }

    artistsById = new Map(
      ((artistsResult.data ?? []) as Pick<LabelArtist, "id" | "name" | "artist_name">[]).map(
        (artist) => [artist.id, artist],
      ),
    );
  }

  let entitiesById = new Map<
    string,
    { id: string; name: string; display_name: string | null; type: string }
  >();
  if (entityIds.length > 0) {
    const entitiesResult = await supabase
      .from("label_entities")
      .select("id, name, display_name, type")
      .in("id", entityIds);

    if (entitiesResult.error && !isMissingRelationError(entitiesResult.error)) {
      throw new Error(`getTrackParticipants entities: ${entitiesResult.error.message}`);
    }

    entitiesById = new Map(
      (
        (entitiesResult.data ?? []) as {
          id: string;
          name: string;
          display_name: string | null;
          type: string;
        }[]
      ).map((entity) => [entity.id, entity]),
    );
  }

  return rows.map((row) => ({
    ...row,
    label_artists: row.artist_id ? artistsById.get(row.artist_id) : undefined,
    label_entities: row.entity_id ? entitiesById.get(row.entity_id) : undefined,
  }));
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
