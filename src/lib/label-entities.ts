import "server-only";
import type { LabelEntity, LabelEntityInput } from "@/lib/label-entities-types";
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

function requiresEntityRolesPersistence(roles?: LabelEntityInput["roles"]) {
  return Array.isArray(roles) && roles.length > 0;
}

// Re-exportar para conveniência de server components
export { ENTITY_TYPES } from "@/lib/label-entities-types";
export type {
  EntityType,
  LabelEntity,
  LabelEntityInput,
} from "@/lib/label-entities-types";

// ─── Queries ──────────────────────────────────────────────

export async function getLabelEntities(): Promise<LabelEntity[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`getLabelEntities: ${error.message}`);
  return ((data ?? []) as LabelEntity[]).map((entity) => ({
    ...entity,
    roles: Array.isArray(entity.roles) ? entity.roles : [],
  }));
}

export async function searchLabelEntities(
  query: string,
): Promise<LabelEntity[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .or(`name.ilike.%${query}%,display_name.ilike.%${query}%`)
    .order("name", { ascending: true })
    .limit(20);

  if (error) throw new Error(`searchLabelEntities: ${error.message}`);
  return ((data ?? []) as LabelEntity[]).map((entity) => ({
    ...entity,
    roles: Array.isArray(entity.roles) ? entity.roles : [],
  }));
}

export async function getLabelEntityById(
  id: string,
): Promise<LabelEntity | null> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();

  if (error) return null;
  return {
    ...(data as LabelEntity),
    roles: Array.isArray((data as LabelEntity).roles)
      ? (data as LabelEntity).roles
      : [],
  };
}

export async function createLabelEntity(
  input: LabelEntityInput,
): Promise<LabelEntity> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("label_entities")
    .insert({ ...input, workspace_id: workspaceId })
    .select()
    .single();

  if (isMissingColumnError(error, "roles")) {
    if (requiresEntityRolesPersistence(input.roles)) {
      throw new Error(
        "Seu banco ainda nao tem a coluna roles em label_entities. Rode a migration 20260502_add_roles_to_label_os.sql no Supabase para salvar funcoes adicionais da entidade.",
      );
    }

    const { roles: _roles, ...fallbackInput } = input;

    const retry = await supabase
      .from("label_entities")
      .insert({ ...fallbackInput, workspace_id: workspaceId })
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(`createLabelEntity: ${error.message}`);
  return {
    ...(data as LabelEntity),
    roles: Array.isArray((data as LabelEntity).roles)
      ? (data as LabelEntity).roles
      : (input.roles ?? []),
  };
}

export async function updateLabelEntity(
  id: string,
  input: Partial<LabelEntityInput>,
): Promise<LabelEntity> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  let { data, error } = await supabase
    .from("label_entities")
    .update(input)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (isMissingColumnError(error, "roles")) {
    if (requiresEntityRolesPersistence(input.roles)) {
      throw new Error(
        "Seu banco ainda nao tem a coluna roles em label_entities. Rode a migration 20260502_add_roles_to_label_os.sql no Supabase para salvar funcoes adicionais da entidade.",
      );
    }

    const { roles: _roles, ...fallbackInput } = input;
    const retry = await supabase
      .from("label_entities")
      .update(fallbackInput)
      .eq("id", id)
      .eq("workspace_id", workspaceId)
      .select()
      .single();

    data = retry.data;
    error = retry.error;
  }

  if (error) throw new Error(`updateLabelEntity: ${error.message}`);
  return {
    ...(data as LabelEntity),
    roles: Array.isArray((data as LabelEntity).roles)
      ? (data as LabelEntity).roles
      : (input.roles ?? []),
  };
}
