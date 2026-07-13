import "server-only";

import { createClient } from "@/lib/supabase/server";
import { getCurrentWorkspaceContext } from "@/lib/workspaces";
import {
  artistOsResources,
  getArtistOsResourceConfig,
  type ArtistOsResourceKey,
} from "@/lib/artist-os-config";
import type { ArtistOsArtistOption, ArtistOsRecord } from "@/lib/artist-os-types";
export type { ArtistOsArtistOption, ArtistOsRecord } from "@/lib/artist-os-types";

export type ArtistOsResourceResult = {
  rows: ArtistOsRecord[];
  artists: ArtistOsArtistOption[];
  tableReady: boolean;
  error: string | null;
};

export type ArtistOsDashboardData = {
  tableReady: boolean;
  error: string | null;
  artists: ArtistOsRecord[];
  shows: ArtistOsRecord[];
  deals: ArtistOsRecord[];
  brandDeals: ArtistOsRecord[];
  finance: ArtistOsRecord[];
  contracts: ArtistOsRecord[];
  tasks: ArtistOsRecord[];
};

const moneyFields = new Set([
  "default_fee",
  "default_commission",
  "fee_value",
  "deposit_value",
  "remaining_value",
  "estimated_budget",
  "negotiated_value",
  "amount",
  "value",
]);

const booleanFields = new Set(["logistics_included", "advisor_approval"]);
const NO_WORKSPACE_MESSAGE =
  "Nenhum workspace vinculado. Peça acesso a um administrador.";

function isMissingTableError(error: { code?: string; message?: string } | null | undefined) {
  return Boolean(
    error?.code === "42P01" ||
      error?.code === "PGRST205" ||
      error?.message?.includes("does not exist") ||
      error?.message?.includes("Could not find the table") ||
      error?.message?.includes("schema cache"),
  );
}

function toNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizePayload(resource: ArtistOsResourceKey, input: Record<string, unknown>) {
  const config = artistOsResources[resource];
  const allowed = new Set(config.fields.map((field) => field.key));
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (!allowed.has(key)) continue;

    if (moneyFields.has(key)) {
      payload[key] = toNumber(value);
      continue;
    }

    if (booleanFields.has(key)) {
      payload[key] = Boolean(value);
      continue;
    }

    if (value === "") {
      payload[key] = null;
      continue;
    }

    payload[key] = value;
  }

  if (resource === "artists") {
    payload.artist_type = payload.artist_type ?? "artista";
    payload.status = payload.status ?? "ativo";
    payload.country = payload.country ?? "BR";
  }

  if (resource === "shows") {
    payload.status = payload.status ?? "lead";
    payload.country = payload.country ?? "BR";
  }

  if (resource === "deals") payload.status = payload.status ?? "frio";
  if (resource === "brand-deals") payload.status = payload.status ?? "prospeccao";
  if (resource === "finance") {
    payload.status = payload.status ?? "previsto";
    payload.transaction_type = payload.transaction_type ?? "entrada";
  }
  if (resource === "contracts") payload.status = payload.status ?? "aguardando";
  if (resource === "tasks") {
    payload.status = payload.status ?? "pendente";
    payload.priority = payload.priority ?? "media";
  }

  return payload;
}

function sortRows(resource: ArtistOsResourceKey, rows: ArtistOsRecord[]) {
  if (resource === "shows") {
    return [...rows].sort((a, b) =>
      String(a.event_date ?? "9999-99-99").localeCompare(String(b.event_date ?? "9999-99-99")),
    );
  }

  if (resource === "tasks") {
    return [...rows].sort((a, b) =>
      String(a.due_at ?? "9999-99-99").localeCompare(String(b.due_at ?? "9999-99-99")),
    );
  }

  return [...rows].sort((a, b) =>
    String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")),
  );
}

function mockRows(resource: ArtistOsResourceKey): ArtistOsRecord[] {
  const now = new Date().toISOString();

  if (resource === "artists") {
    return [
      {
        id: "mock-artist-1",
        stage_name: "Artista Demo",
        full_name: "Nome completo",
        artist_type: "artista",
        city: "Sao Paulo",
        state: "SP",
        country: "BR",
        default_fee: 25000,
        default_commission: 20,
        status: "ativo",
        created_at: now,
      },
    ];
  }

  if (resource === "shows") {
    return [
      {
        id: "mock-show-1",
        artist_id: "mock-artist-1",
        event_name: "Festival Demo",
        city: "Porto Alegre",
        state: "RS",
        event_date: new Date().toISOString().slice(0, 10),
        fee_value: 32000,
        status: "negociando",
        created_at: now,
      },
    ];
  }

  if (resource === "finance") {
    return [
      {
        id: "mock-finance-1",
        artist_id: "mock-artist-1",
        transaction_type: "entrada",
        category: "show",
        description: "Sinal Festival Demo",
        amount: 12000,
        due_date: new Date().toISOString().slice(0, 10),
        status: "previsto",
        created_at: now,
      },
    ];
  }

  if (resource === "tasks") {
    return [
      {
        id: "mock-task-1",
        title: "Confirmar logística do próximo show",
        assignee: "Equipe",
        priority: "urgente",
        status: "pendente",
        due_at: new Date().toISOString().slice(0, 10),
        created_at: now,
      },
    ];
  }

  return [];
}

async function getWorkspaceId() {
  const workspace = await getCurrentWorkspaceContext().catch(() => null);
  return workspace?.workspace.id ?? null;
}

async function requireWorkspaceId() {
  const workspaceId = await getWorkspaceId();

  if (!workspaceId) {
    throw new Error(NO_WORKSPACE_MESSAGE);
  }

  return workspaceId;
}

export async function getArtistOsArtistsOptions(): Promise<ArtistOsArtistOption[]> {
  const result = await getArtistOsResource("artists");
  return result.rows.map((artist) => ({
    id: artist.id,
    name: String(artist.stage_name ?? "Artista sem nome"),
    status: typeof artist.status === "string" ? artist.status : null,
  }));
}

export async function getArtistOsResource(
  resource: ArtistOsResourceKey,
): Promise<ArtistOsResourceResult> {
  const config = artistOsResources[resource];
  const supabase = await createClient();
  const workspaceId = await getWorkspaceId();

  if (!workspaceId) {
    return {
      rows: [],
      artists: [],
      tableReady: false,
      error: NO_WORKSPACE_MESSAGE,
    };
  }

  const { data, error } = await supabase
    .from(config.table)
    .select("*")
    .eq("workspace_id", workspaceId)
    .limit(500);

  if (error) {
    if (isMissingTableError(error)) {
      const rows = mockRows(resource);
      const artists =
        resource === "artists"
          ? rows.map((artist) => ({
              id: artist.id,
              name: String(artist.stage_name ?? "Artista Demo"),
              status: String(artist.status ?? "ativo"),
            }))
          : await getArtistOsArtistsOptions().catch(() => []);

      return {
        rows,
        artists,
        tableReady: false,
        error: "Tabelas do Business OS ainda nao aplicadas no Supabase. Exibindo dados demo.",
      };
    }

    return {
      rows: [],
      artists: [],
      tableReady: false,
      error: error.message,
    };
  }

  const artists =
    resource === "artists"
      ? ((data ?? []) as ArtistOsRecord[]).map((artist) => ({
          id: artist.id,
          name: String(artist.stage_name ?? "Artista sem nome"),
          status: typeof artist.status === "string" ? artist.status : null,
        }))
      : await getArtistOsArtistsOptions().catch(() => []);

  return {
    rows: sortRows(resource, (data ?? []) as ArtistOsRecord[]),
    artists,
    tableReady: true,
    error: null,
  };
}

async function getCurrentUserId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function createArtistOsRecord(
  resource: ArtistOsResourceKey,
  input: Record<string, unknown>,
) {
  const config = getArtistOsResourceConfig(resource);
  if (!config) throw new Error("Recurso Business OS invalido.");

  const supabase = await createClient();
  const workspaceId = await requireWorkspaceId();
  const createdBy = await getCurrentUserId();
  const payload = {
    ...normalizePayload(resource, input),
    workspace_id: workspaceId,
    created_by: createdBy,
  };

  const { data, error } = await supabase
    .from(config.table)
    .insert(payload)
    .select()
    .single();

  if (isMissingTableError(error)) {
    throw new Error("A migration do Business OS ainda nao foi aplicada no Supabase.");
  }

  if (error) throw new Error(`createArtistOsRecord: ${error.message}`);
  return data as ArtistOsRecord;
}

export async function updateArtistOsRecord(
  resource: ArtistOsResourceKey,
  id: string,
  input: Record<string, unknown>,
) {
  const config = getArtistOsResourceConfig(resource);
  if (!config) throw new Error("Recurso Business OS invalido.");

  const supabase = await createClient();
  const workspaceId = await requireWorkspaceId();
  const payload = {
    ...normalizePayload(resource, input),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from(config.table)
    .update(payload)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select()
    .single();

  if (isMissingTableError(error)) {
    throw new Error("A migration do Business OS ainda nao foi aplicada no Supabase.");
  }

  if (error) throw new Error(`updateArtistOsRecord: ${error.message}`);
  return data as ArtistOsRecord;
}

export async function deleteArtistOsRecord(resource: ArtistOsResourceKey, id: string) {
  const config = getArtistOsResourceConfig(resource);
  if (!config) throw new Error("Recurso Business OS invalido.");

  const supabase = await createClient();
  const workspaceId = await requireWorkspaceId();
  const { error } = await supabase
    .from(config.table)
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (isMissingTableError(error)) {
    throw new Error("A migration do Business OS ainda nao foi aplicada no Supabase.");
  }

  if (error) throw new Error(`deleteArtistOsRecord: ${error.message}`);
  return { success: true };
}

export async function getArtistOsDashboardData(): Promise<ArtistOsDashboardData> {
  const [artists, shows, deals, brandDeals, finance, contracts, tasks] =
    await Promise.all([
      getArtistOsResource("artists"),
      getArtistOsResource("shows"),
      getArtistOsResource("deals"),
      getArtistOsResource("brand-deals"),
      getArtistOsResource("finance"),
      getArtistOsResource("contracts"),
      getArtistOsResource("tasks"),
    ]);

  const results = [artists, shows, deals, brandDeals, finance, contracts, tasks];
  const tableReady = results.every((result) => result.tableReady);
  const error = results.find((result) => result.error)?.error ?? null;

  return {
    tableReady,
    error,
    artists: artists.rows,
    shows: shows.rows,
    deals: deals.rows,
    brandDeals: brandDeals.rows,
    finance: finance.rows,
    contracts: contracts.rows,
    tasks: tasks.rows,
  };
}
