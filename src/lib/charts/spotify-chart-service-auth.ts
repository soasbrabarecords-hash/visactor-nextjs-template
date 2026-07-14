import { Buffer } from "node:buffer";
import "server-only";
import { getSpotifyAccountsTokenUrl } from "@/lib/charts/spotify-chart-source-resolver";
import { createAdminClient } from "@/lib/supabase/admin";

type SpotifyChartServiceIntegration = {
  id: string;
  workspace_id: string;
  app_mode: "global_app" | "workspace_app";
  app_client_id: string | null;
  app_client_secret: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  updated_at: string;
};

type SpotifyRefreshResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
};

type CachedServiceToken = {
  integrationId: string;
  accessToken: string;
  expiresAt: number;
};

let cachedServiceToken: CachedServiceToken | null = null;

export function isSpotifyChartsServiceWorkspaceConfigured() {
  return Boolean(process.env.SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID?.trim());
}

function isUsableToken(expiresAt: string | null) {
  if (!expiresAt) return false;
  const timestamp = new Date(expiresAt).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now() + 60_000;
}

function readIntegrationCredentials(row: SpotifyChartServiceIntegration) {
  if (
    row.app_mode === "workspace_app" &&
    row.app_client_id?.trim() &&
    row.app_client_secret?.trim()
  ) {
    return {
      clientId: row.app_client_id.trim(),
      clientSecret: row.app_client_secret.trim(),
    };
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() || "";

  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

async function listServiceIntegrations() {
  const admin = createAdminClient();

  if (!admin) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for the historical Spotify Charts source.",
    );
  }

  const preferredWorkspaceId =
    process.env.SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID?.trim();

  if (!preferredWorkspaceId) {
    throw new Error(
      "SPOTIFY_CHARTS_SOURCE_WORKSPACE_ID is required for the historical Spotify Charts source.",
    );
  }

  const query = admin
    .from("workspace_integrations")
    .select(
      "id,workspace_id,app_mode,app_client_id,app_client_secret,access_token,refresh_token,token_expires_at,updated_at",
    )
    .eq("provider", "spotify")
    .eq("connection_status", "connected")
    .eq("workspace_id", preferredWorkspaceId)
    .not("refresh_token", "is", null)
    .order("updated_at", { ascending: false })
    .limit(10);

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Nao foi possivel localizar a sessao de servico do Spotify: ${error.message}`,
    );
  }

  return (data ?? []) as SpotifyChartServiceIntegration[];
}

async function refreshServiceToken(row: SpotifyChartServiceIntegration) {
  const credentials = readIntegrationCredentials(row);

  if (!row.refresh_token || !credentials) {
    throw new Error("Sessao Spotify sem refresh token ou credenciais do app.");
  }

  const response = await fetch(getSpotifyAccountsTokenUrl(), {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${credentials.clientId}:${credentials.clientSecret}`,
        "utf8",
      ).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: row.refresh_token,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const payload = (await response
    .json()
    .catch(() => null)) as SpotifyRefreshResponse | null;

  if (!response.ok || !payload?.access_token) {
    throw new Error(`Spotify token refresh retornou HTTP ${response.status}.`);
  }

  const expiresIn = Math.max(60, Number(payload.expires_in ?? 3600));
  const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();
  const admin = createAdminClient();

  if (!admin) {
    throw new Error("Supabase admin indisponivel ao renovar Spotify.");
  }

  const updatePayload: Record<string, unknown> = {
    access_token: payload.access_token,
    token_expires_at: expiresAt,
    updated_at: new Date().toISOString(),
  };

  if (payload.refresh_token) {
    updatePayload.refresh_token = payload.refresh_token;
  }

  const { error } = await admin
    .from("workspace_integrations")
    .update(updatePayload)
    .eq("id", row.id)
    .eq("workspace_id", row.workspace_id)
    .eq("provider", "spotify");

  if (error) {
    throw new Error(
      `Nao foi possivel salvar o token renovado: ${error.message}`,
    );
  }

  cachedServiceToken = {
    integrationId: row.id,
    accessToken: payload.access_token,
    expiresAt: new Date(expiresAt).getTime(),
  };

  return payload.access_token;
}

export async function getSpotifyChartsServiceAccessToken() {
  if (
    cachedServiceToken &&
    cachedServiceToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedServiceToken.accessToken;
  }

  const integrations = await listServiceIntegrations();
  const errors: string[] = [];

  for (const integration of integrations) {
    if (
      integration.access_token &&
      isUsableToken(integration.token_expires_at)
    ) {
      const expiresAt = new Date(
        integration.token_expires_at as string,
      ).getTime();
      cachedServiceToken = {
        integrationId: integration.id,
        accessToken: integration.access_token,
        expiresAt,
      };
      return integration.access_token;
    }

    try {
      return await refreshServiceToken(integration);
    } catch (error) {
      errors.push(
        error instanceof Error ? error.message : "falha ao renovar sessao",
      );
    }
  }

  throw new Error(
    `Nenhuma conta Spotify de servico esta pronta para Charts historico${
      errors.length > 0 ? `: ${errors.join("; ")}` : "."
    }`,
  );
}

export function clearSpotifyChartsServiceTokenCache() {
  cachedServiceToken = null;
}
