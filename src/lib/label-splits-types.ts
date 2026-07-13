// Shared types for professional splits (FASE 4)
// NO server-only import — safe for both server and client components

export type TrackComposition = {
  id: string;
  workspace_id: string;
  track_id: string;
  entity_id: string;
  role: string;
  percentage: number;
  created_at: string;
  // joined
  entity_name?: string;
  entity_display_name?: string | null;
  entity_type?: string;
};

export type TrackCompositionInput = {
  track_id: string;
  entity_id: string;
  role: string;
  percentage: number;
};

// Fonograma group types
export const MASTER_GROUP_TYPES = [
  { value: "interpreter", label: "Intérprete" },
  { value: "phonographic_producer", label: "Produtor Fonográfico" },
  { value: "musician", label: "Músico" },
] as const;

export type MasterGroupType = (typeof MASTER_GROUP_TYPES)[number]["value"];

export type TrackMasterSplit = {
  id: string;
  workspace_id: string;
  track_id: string;
  entity_id: string;
  group_type: MasterGroupType;
  role: string | null;
  percentage: number;
  created_at: string;
  // joined
  entity_name?: string;
  entity_display_name?: string | null;
  entity_type?: string;
};

export type TrackMasterSplitInput = {
  track_id: string;
  entity_id: string;
  group_type: MasterGroupType;
  role?: string;
  percentage: number;
};

export type TrackRoyaltySplit = {
  id: string;
  workspace_id: string;
  track_id: string;
  entity_id: string;
  role: string | null;
  percentage: number;
  recoupable: boolean;
  notes: string | null;
  created_at: string;
  // joined
  entity_name?: string;
  entity_display_name?: string | null;
  entity_type?: string;
};

export type TrackRoyaltySplitInput = {
  track_id: string;
  entity_id: string;
  role?: string;
  percentage: number;
  recoupable?: boolean;
  notes?: string;
};
