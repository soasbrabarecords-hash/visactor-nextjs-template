import "server-only";
import { requireLabelWorkspaceId } from "@/lib/label-os-workspace";
import { createClient } from "@/lib/supabase/server";
import type {
  TrackComposition,
  TrackCompositionInput,
  TrackCompositionUpdate,
  TrackMasterSplit,
  TrackMasterSplitInput,
  TrackMasterSplitUpdate,
  TrackRoyaltySplit,
  TrackRoyaltySplitInput,
} from "./label-splits-types";
import type { EntityFunction, EntityType } from "@/lib/label-os-taxonomy";

function isMissingTableOrRelationError(
  error: { message?: string; code?: string } | null | undefined,
) {
  return Boolean(
    error?.code === "PGRST205" ||
    error?.message?.includes("Could not find a relationship") ||
    error?.message?.includes("does not exist") ||
    error?.message?.includes("relation") ||
    error?.message?.includes("schema cache"),
  );
}

function validatePercentage(percentage: number | undefined) {
  if (percentage === undefined) return;
  if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
    throw new Error("O percentual precisa estar entre 0 e 100.");
  }
}

async function requireCompatibleEntity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
  entityId: string,
  roles: EntityFunction[],
  categories: EntityType[],
) {
  const { data, error } = await supabase
    .from("label_entities")
    .select("id,roles,type")
    .eq("id", entityId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error || !data) {
    throw new Error("A pessoa ou entidade selecionada não pertence ao workspace ativo.");
  }
  const entityRoles = Array.isArray(data.roles) ? data.roles : [];
  if (
    !roles.some((role) => entityRoles.includes(role)) &&
    !categories.includes(data.type as EntityType)
  ) {
    throw new Error(
      "A categoria ou as funções deste cadastro não são compatíveis com esta linha.",
    );
  }
}

function splitWriteError(error: { message: string; code?: string }) {
  if (error.code === "23505") {
    throw new Error("Esta pessoa ou entidade já foi adicionada com a mesma função.");
  }
  throw error;
}

function masterCompatibility(groupType: TrackMasterSplitInput["group_type"]) {
  return {
    interpreter: {
      roles: ["interpreter", "artist"] as EntityFunction[],
      categories: ["artist"] as EntityType[],
    },
    phonographic_producer: {
      roles: [
        "phonographic_producer",
        "label",
        "record_company",
      ] as EntityFunction[],
      categories: ["label", "imprint", "company", "producer"] as EntityType[],
    },
    musician: {
      roles: [
        "musician",
        "interpreter",
        "artist",
        "music_producer",
      ] as EntityFunction[],
      categories: ["artist", "producer"] as EntityType[],
    },
  }[groupType];
}

// ── Obra / Composições ────────────────────────────────────────────────────────

export async function getTrackCompositions(
  trackId: string,
): Promise<TrackComposition[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_compositions")
    .select(
      `id, workspace_id, track_id, entity_id, role, percentage, created_at,
       label_entities!entity_id(name, display_name, type)`,
    )
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId)
    .order("created_at");

  if (error) {
    if (isMissingTableOrRelationError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const ent = row.label_entities as {
      name: string;
      display_name: string | null;
      type: string;
    } | null;
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      track_id: row.track_id as string,
      entity_id: row.entity_id as string,
      role: row.role as string,
      percentage: row.percentage as number,
      created_at: row.created_at as string,
      entity_name: ent?.name,
      entity_display_name: ent?.display_name ?? null,
      entity_type: ent?.type,
    };
  });
}

export async function addTrackComposition(
  input: TrackCompositionInput,
): Promise<TrackComposition> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  validatePercentage(input.percentage);
  await requireCompatibleEntity(
    supabase,
    workspaceId,
    input.entity_id,
    ["composer"],
    ["composer"],
  );
  const { data, error } = await supabase
    .from("label_track_compositions")
    .insert({ ...input, workspace_id: workspaceId })
    .select()
    .single();

  if (error) splitWriteError(error);
  return data as TrackComposition;
}

export async function updateTrackComposition(
  trackId: string,
  id: string,
  input: TrackCompositionUpdate,
): Promise<TrackComposition> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  validatePercentage(input.percentage);
  const { data, error } = await supabase
    .from("label_track_compositions")
    .update(input)
    .eq("id", id)
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();
  if (error) splitWriteError(error);
  return data as TrackComposition;
}

export async function deleteTrackComposition(
  trackId: string,
  id: string,
): Promise<void> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("label_track_compositions")
    .delete()
    .eq("id", id)
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
}

// ── Fonograma / Master Splits ─────────────────────────────────────────────────

export async function getTrackMasterSplits(
  trackId: string,
): Promise<TrackMasterSplit[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_master_splits")
    .select(
      `id, workspace_id, track_id, entity_id, group_type, role, percentage, created_at,
       label_entities!entity_id(name, display_name, type)`,
    )
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId)
    .order("created_at");

  if (error) {
    if (isMissingTableOrRelationError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const ent = row.label_entities as {
      name: string;
      display_name: string | null;
      type: string;
    } | null;
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      track_id: row.track_id as string,
      entity_id: row.entity_id as string,
      group_type: row.group_type as TrackMasterSplit["group_type"],
      role: row.role as string | null,
      percentage: row.percentage as number,
      created_at: row.created_at as string,
      entity_name: ent?.name,
      entity_display_name: ent?.display_name ?? null,
      entity_type: ent?.type,
    };
  });
}

export async function addTrackMasterSplit(
  input: TrackMasterSplitInput,
): Promise<TrackMasterSplit> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  validatePercentage(input.percentage);
  const compatibility = masterCompatibility(input.group_type);
  await requireCompatibleEntity(
    supabase,
    workspaceId,
    input.entity_id,
    compatibility.roles,
    compatibility.categories,
  );
  const { data, error } = await supabase
    .from("label_track_master_splits")
    .insert({ ...input, workspace_id: workspaceId })
    .select()
    .single();

  if (error) splitWriteError(error);
  return data as TrackMasterSplit;
}

export async function updateTrackMasterSplit(
  trackId: string,
  id: string,
  input: TrackMasterSplitUpdate,
): Promise<TrackMasterSplit> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  validatePercentage(input.percentage);
  if (input.group_type) {
    const { data: existing, error: existingError } = await supabase
      .from("label_track_master_splits")
      .select("entity_id,group_type")
      .eq("id", id)
      .eq("track_id", trackId)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (existingError || !existing) {
      throw new Error("Participação do fonograma não encontrada.");
    }
    if (existing.group_type !== input.group_type) {
      const compatibility = masterCompatibility(input.group_type);
      await requireCompatibleEntity(
        supabase,
        workspaceId,
        existing.entity_id,
        compatibility.roles,
        compatibility.categories,
      );
    }
  }
  const { data, error } = await supabase
    .from("label_track_master_splits")
    .update(input)
    .eq("id", id)
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId)
    .select()
    .single();
  if (error) splitWriteError(error);
  return data as TrackMasterSplit;
}

export async function deleteTrackMasterSplit(
  trackId: string,
  id: string,
): Promise<void> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("label_track_master_splits")
    .delete()
    .eq("id", id)
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
}

// ── Royalties ─────────────────────────────────────────────────────────────────

export async function getTrackRoyaltySplits(
  trackId: string,
): Promise<TrackRoyaltySplit[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_royalty_splits")
    .select(
      `id, workspace_id, track_id, entity_id, role, percentage, recoupable, notes, created_at,
       label_entities!entity_id(name, display_name, type)`,
    )
    .eq("track_id", trackId)
    .eq("workspace_id", workspaceId)
    .order("created_at");

  if (error) {
    if (isMissingTableOrRelationError(error)) return [];
    throw error;
  }

  return (data ?? []).map((row: Record<string, unknown>) => {
    const ent = row.label_entities as {
      name: string;
      display_name: string | null;
      type: string;
    } | null;
    return {
      id: row.id as string,
      workspace_id: row.workspace_id as string,
      track_id: row.track_id as string,
      entity_id: row.entity_id as string,
      role: row.role as string | null,
      percentage: row.percentage as number,
      recoupable: row.recoupable as boolean,
      notes: row.notes as string | null,
      created_at: row.created_at as string,
      entity_name: ent?.name,
      entity_display_name: ent?.display_name ?? null,
      entity_type: ent?.type,
    };
  });
}

export async function addTrackRoyaltySplit(
  input: TrackRoyaltySplitInput,
): Promise<TrackRoyaltySplit> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_track_royalty_splits")
    .insert({ ...input, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw error;
  return data as TrackRoyaltySplit;
}

export async function deleteTrackRoyaltySplit(id: string): Promise<void> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("label_track_royalty_splits")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);
  if (error) throw error;
}
