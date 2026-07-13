import "server-only";
import { requireLabelWorkspaceId } from "@/lib/label-os-workspace";
import { createClient } from "@/lib/supabase/server";
import type {
  TrackComposition,
  TrackCompositionInput,
  TrackMasterSplit,
  TrackMasterSplitInput,
  TrackRoyaltySplit,
  TrackRoyaltySplitInput,
} from "./label-splits-types";

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
  const { data, error } = await supabase
    .from("label_track_compositions")
    .insert({ ...input, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw error;
  return data as TrackComposition;
}

export async function deleteTrackComposition(id: string): Promise<void> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("label_track_compositions")
    .delete()
    .eq("id", id)
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
  const { data, error } = await supabase
    .from("label_track_master_splits")
    .insert({ ...input, workspace_id: workspaceId })
    .select()
    .single();

  if (error) throw error;
  return data as TrackMasterSplit;
}

export async function deleteTrackMasterSplit(id: string): Promise<void> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("label_track_master_splits")
    .delete()
    .eq("id", id)
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
