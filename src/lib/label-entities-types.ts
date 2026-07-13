// Tipos e constantes compartilhados entre server e client components.
// NÃO importar "server-only" aqui.
import type { EntityFunction, EntityType } from "@/lib/label-os-taxonomy";
import { ENTITY_CATEGORY_OPTIONS } from "@/lib/label-os-taxonomy";

export type { EntityType };

export const ENTITY_TYPES = ENTITY_CATEGORY_OPTIONS;

export type LabelEntity = {
  id: string;
  workspace_id: string;
  name: string;
  display_name: string | null;
  type: EntityType;
  roles: EntityFunction[];
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

export type LabelEntityInput = Omit<
  LabelEntity,
  "id" | "workspace_id" | "created_at"
>;
