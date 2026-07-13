import "server-only";
import type { ReadinessContractEvidence } from "@/lib/label-contract-types";
import type { LabelEntity } from "@/lib/label-entities-types";
import type {
  LabelArtist,
  LabelTrack,
  TrackParticipant,
} from "@/lib/label-os-types";
import { requireLabelWorkspaceId } from "@/lib/label-os-workspace";
import { evaluateTrackReadiness } from "@/lib/label-readiness";
import type {
  LabelTrackReadiness,
  LabelTrackReadinessInput,
  LabelTrackTask,
  LabelTrackTaskInput,
  TrackReadinessBundle,
} from "@/lib/label-readiness-types";
import type {
  TrackComposition,
  TrackMasterSplit,
  TrackRoyaltySplit,
} from "@/lib/label-splits-types";
import { createClient } from "@/lib/supabase/server";

type TableError = { message: string } | null;

function throwQueryError(scope: string, error: TableError) {
  if (error) throw new Error(`${scope}: ${error.message}`);
}

function groupByTrack<T extends { track_id: string }>(rows: T[]) {
  const grouped = new Map<string, T[]>();
  rows.forEach((row) => {
    const current = grouped.get(row.track_id) ?? [];
    current.push(row);
    grouped.set(row.track_id, current);
  });
  return grouped;
}

function buildBundle(
  track: LabelTrack,
  participants: TrackParticipant[],
  compositions: TrackComposition[],
  masterSplits: TrackMasterSplit[],
  royaltySplits: TrackRoyaltySplit[],
  entities: LabelEntity[],
  manual: LabelTrackReadiness | null,
  tasks: LabelTrackTask[],
  contracts: ReadinessContractEvidence[],
): TrackReadinessBundle {
  const input = {
    track,
    participants,
    compositions,
    masterSplits,
    royaltySplits,
    entities,
    manual,
    tasks,
    contracts,
  };

  return { ...input, result: evaluateTrackReadiness(input) };
}

async function getWorkspaceReadinessRows(trackId?: string) {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const tracksQuery = supabase
    .from("label_tracks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  const participantsQuery = supabase
    .from("label_track_participants")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const compositionsQuery = supabase
    .from("label_track_compositions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const masterQuery = supabase
    .from("label_track_master_splits")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const royaltiesQuery = supabase
    .from("label_track_royalty_splits")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const readinessQuery = supabase
    .from("label_track_readiness")
    .select("*")
    .eq("workspace_id", workspaceId);
  const tasksQuery = supabase
    .from("label_track_tasks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  const contractsQuery = supabase
    .from("label_contracts")
    .select("track_id,status,pdf_path,signed_pdf_path")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (trackId) {
    tracksQuery.eq("id", trackId);
    participantsQuery.eq("track_id", trackId);
    compositionsQuery.eq("track_id", trackId);
    masterQuery.eq("track_id", trackId);
    royaltiesQuery.eq("track_id", trackId);
    readinessQuery.eq("track_id", trackId);
    tasksQuery.eq("track_id", trackId);
    contractsQuery.eq("track_id", trackId);
  }

  const [
    tracksResult,
    participantsResult,
    compositionsResult,
    masterResult,
    royaltiesResult,
    entitiesResult,
    artistsResult,
    readinessResult,
    tasksResult,
    contractsResult,
  ] = await Promise.all([
    tracksQuery,
    participantsQuery,
    compositionsQuery,
    masterQuery,
    royaltiesQuery,
    supabase.from("label_entities").select("*").eq("workspace_id", workspaceId),
    supabase.from("label_artists").select("*").eq("workspace_id", workspaceId),
    readinessQuery,
    tasksQuery,
    contractsQuery,
  ]);

  throwQueryError("getLabelReadiness tracks", tracksResult.error);
  throwQueryError("getLabelReadiness participants", participantsResult.error);
  throwQueryError("getLabelReadiness compositions", compositionsResult.error);
  throwQueryError("getLabelReadiness master", masterResult.error);
  throwQueryError("getLabelReadiness royalties", royaltiesResult.error);
  throwQueryError("getLabelReadiness entities", entitiesResult.error);
  throwQueryError("getLabelReadiness artists", artistsResult.error);
  throwQueryError("getLabelReadiness manual", readinessResult.error);
  throwQueryError("getLabelReadiness tasks", tasksResult.error);
  throwQueryError("getLabelReadiness contracts", contractsResult.error);

  return {
    tracks: (tracksResult.data ?? []) as LabelTrack[],
    participants: (participantsResult.data ?? []) as TrackParticipant[],
    compositions: (compositionsResult.data ?? []) as TrackComposition[],
    masterSplits: (masterResult.data ?? []) as TrackMasterSplit[],
    royaltySplits: (royaltiesResult.data ?? []) as TrackRoyaltySplit[],
    entities: (entitiesResult.data ?? []) as LabelEntity[],
    artists: (artistsResult.data ?? []) as LabelArtist[],
    readiness: (readinessResult.data ?? []) as LabelTrackReadiness[],
    tasks: (tasksResult.data ?? []) as LabelTrackTask[],
    contracts: (contractsResult.data ?? []) as Array<
      ReadinessContractEvidence & { track_id: string }
    >,
  };
}

function buildAllBundles(
  rows: Awaited<ReturnType<typeof getWorkspaceReadinessRows>>,
): TrackReadinessBundle[] {
  const participantsByTrack = groupByTrack(rows.participants);
  const compositionsByTrack = groupByTrack(rows.compositions);
  const masterByTrack = groupByTrack(rows.masterSplits);
  const royaltiesByTrack = groupByTrack(rows.royaltySplits);
  const tasksByTrack = groupByTrack(rows.tasks);
  const contractsByTrack = groupByTrack(rows.contracts);
  const readinessByTrack = new Map(
    rows.readiness.map((item) => [item.track_id, item]),
  );

  return rows.tracks.map((track) =>
    buildBundle(
      track,
      participantsByTrack.get(track.id) ?? [],
      compositionsByTrack.get(track.id) ?? [],
      masterByTrack.get(track.id) ?? [],
      royaltiesByTrack.get(track.id) ?? [],
      rows.entities,
      readinessByTrack.get(track.id) ?? null,
      tasksByTrack.get(track.id) ?? [],
      contractsByTrack.get(track.id) ?? [],
    ),
  );
}

export async function getLabelReadinessDashboardData(): Promise<{
  bundles: TrackReadinessBundle[];
  artists: LabelArtist[];
}> {
  const rows = await getWorkspaceReadinessRows();
  return { bundles: buildAllBundles(rows), artists: rows.artists };
}

export async function getTrackReadinessBundle(
  trackId: string,
): Promise<TrackReadinessBundle | null> {
  const rows = await getWorkspaceReadinessRows(trackId);
  const track = rows.tracks.find((item) => item.id === trackId);
  if (!track) return null;

  const artistsById = new Map(
    rows.artists.map((artist) => [artist.id, artist]),
  );
  const entitiesById = new Map(
    rows.entities.map((entity) => [entity.id, entity]),
  );
  const participants = rows.participants
    .filter((item) => item.track_id === trackId)
    .map((item) => ({
      ...item,
      label_artists: item.artist_id
        ? (() => {
            const artist = artistsById.get(item.artist_id);
            return artist
              ? {
                  id: artist.id,
                  name: artist.name,
                  artist_name: artist.artist_name,
                }
              : undefined;
          })()
        : undefined,
      label_entities: item.entity_id
        ? (() => {
            const entity = entitiesById.get(item.entity_id);
            return entity
              ? {
                  id: entity.id,
                  name: entity.name,
                  display_name: entity.display_name,
                  type: entity.type,
                }
              : undefined;
          })()
        : undefined,
    }));
  const withEntity = <T extends { entity_id: string }>(item: T) => {
    const entity = entitiesById.get(item.entity_id);
    return {
      ...item,
      entity_name: entity?.name,
      entity_display_name: entity?.display_name,
      entity_type: entity?.type,
    };
  };

  return buildBundle(
    track,
    participants,
    rows.compositions
      .filter((item) => item.track_id === trackId)
      .map(withEntity),
    rows.masterSplits
      .filter((item) => item.track_id === trackId)
      .map(withEntity),
    rows.royaltySplits
      .filter((item) => item.track_id === trackId)
      .map(withEntity),
    rows.entities,
    rows.readiness.find((item) => item.track_id === trackId) ?? null,
    rows.tasks.filter((item) => item.track_id === trackId),
    rows.contracts.filter((item) => item.track_id === trackId),
  );
}

export async function upsertTrackReadiness(
  trackId: string,
  input: LabelTrackReadinessInput,
): Promise<LabelTrackReadiness> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("label_track_readiness")
    .upsert(
      {
        ...input,
        workspace_id: workspaceId,
        track_id: trackId,
        created_by: authData.user?.id ?? null,
      },
      { onConflict: "workspace_id,track_id" },
    )
    .select()
    .single();

  if (error) throw new Error(`upsertTrackReadiness: ${error.message}`);
  return data as LabelTrackReadiness;
}

export async function createTrackTask(
  trackId: string,
  input: LabelTrackTaskInput,
): Promise<LabelTrackTask> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("label_track_tasks")
    .insert({
      ...input,
      workspace_id: workspaceId,
      track_id: trackId,
      created_by: authData.user?.id ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`createTrackTask: ${error.message}`);
  return data as LabelTrackTask;
}

export async function updateTrackTask(
  trackId: string,
  taskId: string,
  input: Partial<LabelTrackTaskInput>,
): Promise<LabelTrackTask> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_tasks")
    .update(input)
    .eq("id", taskId)
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (error) throw new Error(`updateTrackTask: ${error.message}`);
  return data as LabelTrackTask;
}

export async function deleteTrackTask(
  trackId: string,
  taskId: string,
): Promise<void> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("label_track_tasks")
    .delete()
    .eq("id", taskId)
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId);

  if (error) throw new Error(`deleteTrackTask: ${error.message}`);
}
