import "server-only";

import { createClient } from "@/lib/supabase/server";

// ─── Types ────────────────────────────────────────────────

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
  notes: string | null;
  created_at: string;
};

export type LabelEntityInput = Omit<LabelEntity, "id" | "created_at">;

// ─── Queries ──────────────────────────────────────────────

export async function getLabelEntities(): Promise<LabelEntity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getLabelEntities: ${error.message}`);
  return (data ?? []) as LabelEntity[];
}

export async function searchLabelEntities(query: string): Promise<LabelEntity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("*")
    .or(`name.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(20);

  if (error) throw new Error(`searchLabelEntities: ${error.message}`);
  return (data ?? []) as LabelEntity[];
}

export async function getLabelEntityById(id: string): Promise<LabelEntity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as LabelEntity;
}

export async function createLabelEntity(input: LabelEntityInput): Promise<LabelEntity> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .insert(input)
    .select()
    .single();

  if (error) throw new Error(`createLabelEntity: ${error.message}`);
  return data as LabelEntity;
}
