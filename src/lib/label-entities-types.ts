// Tipos e constantes compartilhados entre server e client components.
// NÃO importar "server-only" aqui.
import type {
  EntityFunction,
  EntityKind,
  EntityType,
} from "@/lib/label-os-taxonomy";
import { ENTITY_CATEGORY_OPTIONS } from "@/lib/label-os-taxonomy";

export type { EntityType };

export const ENTITY_TYPES = ENTITY_CATEGORY_OPTIONS;

export type LabelEntity = {
  id: string;
  workspace_id: string;
  name: string;
  display_name: string | null;
  type: EntityType;
  entity_kind: EntityKind;
  roles: EntityFunction[];
  email: string | null;
  phone: string | null;
  instagram: string | null;
  spotify_url: string | null;
  spotify_artist_id: string | null;
  apple_music_url: string | null;
  youtube_url: string | null;
  document: string | null;
  birth_date: string | null;
  ipi_cae: string | null;
  rights_society: string | null;
  publisher_name: string | null;
  publisher_entity_id: string | null;
  payment_data_complete: boolean;
  pix_key: string | null;
  bank_details: string | null;
  legacy_artist_id: string | null;
  notes: string | null;
  created_at: string;
};

export type LabelEntityInput = Omit<
  LabelEntity,
  "id" | "workspace_id" | "created_at"
>;
