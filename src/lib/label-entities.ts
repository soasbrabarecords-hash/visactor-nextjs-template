import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { LabelEntity, LabelEntityInput } from "@/lib/label-entities-types";

// Re-exportar para conveniência de server components
export { ENTITY_TYPES } from "@/lib/label-entities-types";
export type { EntityType, LabelEntity, LabelEntityInput } from "@/lib/label-entities-types";

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
