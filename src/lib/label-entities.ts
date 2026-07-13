import "server-only";
import type { LabelEntity, LabelEntityInput } from "@/lib/label-entities-types";
import type { EntityFunction, EntityKind } from "@/lib/label-os-taxonomy";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeEntity(entity: LabelEntity): LabelEntity {
  return {
    ...entity,
    entity_kind: entity.entity_kind ??
      (["artist", "producer", "composer"].includes(entity.type)
        ? "person"
        : "company"),
    roles: Array.isArray(entity.roles) ? entity.roles : [],
    spotify_artist_id: entity.spotify_artist_id ?? null,
    publisher_entity_id: entity.publisher_entity_id ?? null,
    pix_key: entity.pix_key ?? null,
    bank_details: entity.bank_details ?? null,
    legacy_artist_id: entity.legacy_artist_id ?? null,
  };
}

function entityWriteError(scope: string, error: { message: string; code?: string }) {
  if (error.code === "23505") {
    throw new Error(
      "Já existe uma pessoa ou entidade com este documento ou esta identidade neste workspace.",
    );
  }
  throw new Error(`${scope}: ${error.message}`);
}

async function validatePublisher(
  workspaceId: string,
  publisherEntityId: string | null | undefined,
) {
  if (!publisherEntityId) return;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("id,roles")
    .eq("id", publisherEntityId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) {
    throw new Error("A editora vinculada não pertence ao workspace ativo.");
  }
  if (!Array.isArray(data.roles) || !data.roles.includes("publisher")) {
    throw new Error("A entidade vinculada precisa ter a função Editora.");
  }
}

// Re-exportar para conveniência de server components
export { ENTITY_TYPES } from "@/lib/label-entities-types";
export type {
  EntityType,
  LabelEntity,
  LabelEntityInput,
} from "@/lib/label-entities-types";

// ─── Queries ──────────────────────────────────────────────

export async function getLabelEntities(options?: {
  roles?: EntityFunction[];
  kind?: EntityKind;
}): Promise<LabelEntity[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  let request = supabase
    .from("label_entities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (options?.roles?.length) request = request.overlaps("roles", options.roles);
  if (options?.kind) request = request.eq("entity_kind", options.kind);
  const { data, error } = await request;

  if (error) throw new Error(`getLabelEntities: ${error.message}`);
  return ((data ?? []) as LabelEntity[]).map(normalizeEntity);
}

export async function searchLabelEntities(
  query: string,
  roles: EntityFunction[] = [],
): Promise<LabelEntity[]> {
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const safeQuery = query.replace(/[%_,().]/g, " ").trim();
  if (!safeQuery) return [];
  let request = supabase
    .from("label_entities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .or(`name.ilike.%${safeQuery}%,display_name.ilike.%${safeQuery}%`)
    .order("name", { ascending: true })
    .limit(20);
  if (roles.length) request = request.overlaps("roles", roles);
  const { data, error } = await request;

  if (error) throw new Error(`searchLabelEntities: ${error.message}`);
  return ((data ?? []) as LabelEntity[]).map(normalizeEntity);
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
  return normalizeEntity(data as LabelEntity);
}

export async function getLabelEntityByLegacyArtistId(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  const workspaceId = await requireLabelWorkspaceId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("label_entities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .or(`id.eq.${id},legacy_artist_id.eq.${id}`)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return normalizeEntity(data as LabelEntity);
}

export async function createLabelEntity(
  input: LabelEntityInput,
): Promise<LabelEntity> {
  const workspaceId = await requireLabelWorkspaceId();
  await validatePublisher(workspaceId, input.publisher_entity_id);
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

  if (error) entityWriteError("createLabelEntity", error);
  return normalizeEntity(data as LabelEntity);
}

export async function updateLabelEntity(
  id: string,
  input: Partial<LabelEntityInput>,
): Promise<LabelEntity> {
  const workspaceId = await requireLabelWorkspaceId();
  await validatePublisher(workspaceId, input.publisher_entity_id);
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

  if (error) entityWriteError("updateLabelEntity", error);
  return normalizeEntity(data as LabelEntity);
}
