import "server-only";
import {
  ARTIST_ROLE_OPTIONS,
  type ArtistRole,
} from "@/lib/label-os-taxonomy";
import {
  createLabelEntity,
  getLabelEntities,
  getLabelEntityByLegacyArtistId,
  updateLabelEntity,
} from "@/lib/label-entities";
import type {
  LabelEntity,
  LabelEntityInput,
} from "@/lib/label-entities-types";
import type {
  LabelArtist,
  LabelArtistInput,
  LabelOsStats,
  LabelTrack,
  LabelTrackInput,
  TrackParticipant,
  TrackParticipantInput,
} from "@/lib/label-os-types";
import { requireLabelWorkspaceId } from "@/lib/label-os-workspace";
import { createClient } from "@/lib/supabase/server";

function isMissingColumnError(
  error: { message?: string } | null | undefined,
  column: string,
) {
  return Boolean(
    error?.message?.includes(`Could not find the '${column}' column`) ||
    error?.message?.includes(`column "${column}" does not exist`),
  );
}

function isMissingRelationError(
  error: { message?: string; code?: string } | null | undefined,
) {
  return Boolean(
    error?.code === "PGRST200" ||
    error?.code === "PGRST205" ||
    error?.message?.includes("Could not find a relationship") ||
    error?.message?.includes("schema cache"),
  );
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

const ARTIST_ROLES = new Set<string>(
  ARTIST_ROLE_OPTIONS.map((option) => option.value),
);

function entityAsArtist(entity: LabelEntity): LabelArtist {
  const roles = entity.roles.filter((role): role is ArtistRole =>
    ARTIST_ROLES.has(role),
  );
  return {
    id: entity.id,
    workspace_id: entity.workspace_id,
    name: entity.name,
    artist_name: entity.display_name,
    roles: roles.length ? roles : ["artist"],
    email: entity.email,
    phone: entity.phone,
    instagram: entity.instagram,
    spotify_url: entity.spotify_url,
    apple_music_url: entity.apple_music_url,
    youtube_url: entity.youtube_url,
    document: entity.document,
    birth_date: entity.birth_date,
    notes: entity.notes,
    created_at: entity.created_at,
  };
}

export async function getLabelArtists(): Promise<LabelArtist[]> {
  const entities = await getLabelEntities({ roles: ["artist"] });
  return entities.map(entityAsArtist);
}

export async function getLabelArtistById(
  id: string,
): Promise<LabelArtist | null> {
  const entity = await getLabelEntityByLegacyArtistId(id);
  return entity ? entityAsArtist(entity) : null;
}

export async function updateLabelArtist(
  id: string,
  input: Partial<LabelArtistInput>,
): Promise<LabelArtist> {
  const current = await getLabelEntityByLegacyArtistId(id);
  if (!current) throw new Error("Artista não encontrado na base unificada.");
  const payload: Partial<LabelEntityInput> = {};
  if (input.name !== undefined) payload.name = input.name;
  if (input.artist_name !== undefined) payload.display_name = input.artist_name;
  if (input.roles !== undefined) payload.roles = input.roles;
  if (input.email !== undefined) payload.email = input.email;
  if (input.phone !== undefined) payload.phone = input.phone;
  if (input.instagram !== undefined) payload.instagram = input.instagram;
  if (input.spotify_url !== undefined) payload.spotify_url = input.spotify_url;
  if (input.apple_music_url !== undefined) payload.apple_music_url = input.apple_music_url;
  if (input.youtube_url !== undefined) payload.youtube_url = input.youtube_url;
  if (input.document !== undefined) payload.document = input.document;
  if (input.birth_date !== undefined) payload.birth_date = input.birth_date;
  if (input.notes !== undefined) payload.notes = input.notes;
  const updated = await updateLabelEntity(current.id, payload);
  return entityAsArtist(updated);
}

export async function createLabelArtist(
  input: LabelArtistInput,
): Promise<LabelArtist> {
  const entity = await createLabelEntity({
    name: input.name,
    display_name: input.artist_name,
    type: "artist",
    entity_kind: "person",
    roles: input.roles?.length ? input.roles : ["artist"],
    email: input.email,
    phone: input.phone,
    instagram: input.instagram,
    spotify_url: input.spotify_url,
    spotify_artist_id: null,
    apple_music_url: input.apple_music_url,
    youtube_url: input.youtube_url,
    document: input.document,
    birth_date: input.birth_date,
    ipi_cae: null,
    rights_society: null,
    publisher_name: null,
    publisher_entity_id: null,
    payment_data_complete: false,
    pix_key: null,
    bank_details: null,
    legacy_artist_id: null,
    notes: input.notes,
  });
  return entityAsArtist(entity);
}

// ─── Tracks ───────────────────────────────────────────────

export async function getLabelTracks(): Promise<LabelTrack[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_tracks")
    .select("*")
    .eq("workspace_id", workspaceId)
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
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_tracks")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) return null;
  return {
    ...(data as LabelTrack),
    subgenre: (data as LabelTrack).subgenre ?? null,
  };
}

export async function createLabelTrack(
  input: LabelTrackInput,
): Promise<LabelTrack> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  let payload: Partial<LabelTrackInput> = { ...input };
  let data: LabelTrack | null = null;
  let error: { message?: string } | null = null;

  for (const optionalColumn of ["subgenre", "lyrics"] as const) {
    const response = await supabase
      .from("label_tracks")
      .insert({ ...payload, workspace_id: workspaceId })
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
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  let payload: Partial<LabelTrackInput> = { ...input };
  let data: LabelTrack | null = null;
  let error: { message?: string } | null = null;

  for (const optionalColumn of ["subgenre", "lyrics"] as const) {
    const response = await supabase
      .from("label_tracks")
      .update(payload)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
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
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_participants")
    .select("*")
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(`getTrackParticipants: ${error.message}`);

  const rows = (data ?? []) as TrackParticipant[];
  const artistIds = Array.from(
    new Set(
      rows
        .map((row) => row.artist_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const entityIds = Array.from(
    new Set(
      rows
        .map((row) => row.entity_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  let artistsById = new Map<
    string,
    Pick<LabelArtist, "id" | "name" | "artist_name">
  >();
  if (artistIds.length > 0) {
    const artistsResult = await supabase
      .from("label_artists")
      .select("id, name, artist_name")
      .eq("workspace_id", workspaceId)
      .in("id", artistIds);

    if (artistsResult.error) {
      throw new Error(
        `getTrackParticipants artists: ${artistsResult.error.message}`,
      );
    }

    artistsById = new Map(
      (
        (artistsResult.data ?? []) as Pick<
          LabelArtist,
          "id" | "name" | "artist_name"
        >[]
      ).map((artist) => [artist.id, artist]),
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
      .eq("workspace_id", workspaceId)
      .in("id", entityIds);

    if (entitiesResult.error && !isMissingRelationError(entitiesResult.error)) {
      throw new Error(
        `getTrackParticipants entities: ${entitiesResult.error.message}`,
      );
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
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_participants")
    .insert({ ...input, workspace_id: workspaceId })
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
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();

  const [tracksRes, artistsRes] = await Promise.all([
    supabase
      .from("label_tracks")
      .select("status")
      .eq("workspace_id", workspaceId),
    supabase
      .from("label_entities")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .contains("roles", ["artist"]),
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
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const workspacePath = path.startsWith(`${workspaceId}/`)
    ? path
    : `${workspaceId}/${path.replace(/^\/+/, "")}`;
  const { error } = await supabase.storage
    .from(bucket)
    .upload(workspacePath, file, {
      upsert: true,
    });

  if (error) throw new Error(`uploadLabelFile(${bucket}): ${error.message}`);

  const { data } = supabase.storage.from(bucket).getPublicUrl(workspacePath);
  return data.publicUrl;
}
