// Tipos e constantes compartilhados entre server e client components.
// NÃO importar "server-only" aqui.

export const ENTITY_TYPES = [
  { value: "artist", label: "Artista" },
  { value: "label", label: "Gravadora" },
  { value: "publisher", label: "Editora" },
  { value: "producer", label: "Produtor" },
  { value: "composer", label: "Compositor" },
  { value: "manager", label: "Manager" },
  { value: "company", label: "Empresa" },
  { value: "other", label: "Outro" },
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number]["value"];

export type LabelEntity = {
  id: string;
  name: string;
  display_name: string | null;
  type: EntityType;
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

export type LabelEntityInput = Omit<LabelEntity, "id" | "created_at">;
