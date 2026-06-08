import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  ACTIVE_WORKSPACE_COOKIE,
  canUseGlobalSpotifyApp,
  selectCurrentWorkspace,
  type ModuleRole,
  type WorkspaceRole,
  type WorkspaceSummary,
} from "@/lib/workspace-access";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  type: string | null;
  status: string;
  owner_user_id: string | null;
};

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: WorkspaceRole | "editor";
};

type WorkspaceSettingsRow = {
  workspace_id: string;
  default_market: string;
  release_window_days: number;
  suggestion_score_threshold: number;
  prioritize_followed_artists: boolean;
  prioritize_top_tracks: boolean;
};

type WorkspaceIntegrationRow = {
  id?: string;
  workspace_id: string;
  provider: string;
  app_mode: "global_app" | "workspace_app";
  connection_status: "not_connected" | "connected" | "error";
  app_client_id: string | null;
  app_client_secret: string | null;
  provider_account_id: string | null;
  provider_account_label: string | null;
  granted_scopes: string | null;
  access_token?: string | null;
  refresh_token?: string | null;
  token_expires_at?: string | null;
};

export type WorkspaceContext = {
  workspace: {
    id: string;
    name: string;
    slug: string;
  };
  membership: {
    role: WorkspaceMembershipRow["role"];
  };
  settings: {
    defaultMarket: string;
    releaseWindowDays: number;
    suggestionScoreThreshold: number;
    prioritizeFollowedArtists: boolean;
    prioritizeTopTracks: boolean;
  };
  spotifyIntegration: {
    appMode: WorkspaceIntegrationRow["app_mode"];
    connectionStatus: WorkspaceIntegrationRow["connection_status"];
    appClientId: string | null;
    hasAppClientSecret: boolean;
    hasAccessToken: boolean;
    hasRefreshToken: boolean;
    tokenExpiresAt: string | null;
    providerAccountId: string | null;
    providerAccountLabel: string | null;
    grantedScopes: string | null;
  };
  openaiIntegration: {
    appMode: WorkspaceIntegrationRow["app_mode"];
    connectionStatus: WorkspaceIntegrationRow["connection_status"];
    model: string | null;
    hasApiKey: boolean;
  };
};

export type WorkspaceSpotifyIntegrationInput = {
  appMode: "global_app" | "workspace_app";
  appClientId?: string | null;
  appClientSecret?: string | null;
};

export type WorkspaceSettingsInput = {
  workspaceName?: string | null;
  defaultMarket: string;
  releaseWindowDays: number;
  suggestionScoreThreshold: number;
  prioritizeFollowedArtists: boolean;
  prioritizeTopTracks: boolean;
};

export type WorkspaceOpenAIIntegrationInput = {
  appMode: "global_app" | "workspace_app";
  apiKey?: string | null;
  model?: string | null;
};

export type EffectiveSpotifyCredentials = {
  clientId: string;
  clientSecret: string;
  source: "global_app" | "workspace_app";
  workspaceId: string | null;
};

export type EffectiveOpenAICredentials = {
  apiKey: string;
  model: string;
  source: "global_app" | "workspace_app";
  workspaceId: string | null;
};

export type WorkspaceSpotifyStoredAuth = {
  workspaceId: string;
  integrationId: string | null;
  appMode: WorkspaceIntegrationRow["app_mode"];
  connectionStatus: WorkspaceIntegrationRow["connection_status"];
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: string | null;
  providerAccountId: string | null;
  providerAccountLabel: string | null;
  grantedScopes: string | null;
};

const DEFAULT_WORKSPACE_SETTINGS = {
  defaultMarket: "BR",
  releaseWindowDays: 21,
  suggestionScoreThreshold: 70,
  prioritizeFollowedArtists: true,
  prioritizeTopTracks: true,
} as const;

const DEFAULT_SPOTIFY_INTEGRATION = {
  appMode: "global_app",
  connectionStatus: "not_connected",
  appClientId: null,
  hasAppClientSecret: false,
  hasAccessToken: false,
  hasRefreshToken: false,
  tokenExpiresAt: null,
  providerAccountId: null,
  providerAccountLabel: null,
  grantedScopes: null,
} as const;

const DEFAULT_OPENAI_INTEGRATION = {
  appMode: "global_app",
  connectionStatus: "not_connected",
  model: null,
  hasApiKey: false,
} as const;
const PLAYLIST_OS_INTEGRATION_MANAGER_ROLES = new Set<ModuleRole>([
  "admin",
  "curador",
  "cliente",
]);

function getDefaultSpotifyAppMode(workspace: { slug?: string | null }) {
  return canUseGlobalSpotifyApp(workspace) ? "global_app" : "workspace_app";
}

function getEffectiveSpotifyAppMode(
  workspace: { slug?: string | null },
  storedMode: WorkspaceIntegrationRow["app_mode"] | null | undefined,
) {
  return canUseGlobalSpotifyApp(workspace)
    ? storedMode ?? "global_app"
    : "workspace_app";
}

type WorkspaceDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>;

async function getWorkspaceDbClient(): Promise<WorkspaceDbClient> {
  return createAdminClient() ?? (await createClient());
}

async function ensureWorkspaceDefaults(workspaceId: string, workspaceSlug: string) {
  const supabase = await getWorkspaceDbClient();
  const spotifyAppMode = getDefaultSpotifyAppMode({ slug: workspaceSlug });

  const runUpserts = async (
    client:
      | Awaited<ReturnType<typeof createClient>>
      | NonNullable<ReturnType<typeof createAdminClient>>,
  ) =>
    Promise.all([
      client.from("workspace_settings").upsert(
        {
          workspace_id: workspaceId,
        },
        { onConflict: "workspace_id" },
      ),
      client.from("workspace_integrations").upsert(
        {
          workspace_id: workspaceId,
          provider: "spotify",
          app_mode: spotifyAppMode,
          connection_status: "not_connected",
        },
        { onConflict: "workspace_id,provider", ignoreDuplicates: true },
      ),
      client.from("workspace_integrations").upsert(
        {
          workspace_id: workspaceId,
          provider: "openai",
          app_mode: "global_app",
          connection_status: "not_connected",
        },
        { onConflict: "workspace_id,provider", ignoreDuplicates: true },
      ),
    ]);

  const [
    { error: settingsError },
    { error: spotifyIntegrationError },
    { error: openaiIntegrationError },
  ] =
    await runUpserts(supabase);

  if (settingsError) {
    throw new Error(`ensureWorkspaceDefaults(settings): ${settingsError.message}`);
  }

  if (spotifyIntegrationError) {
    throw new Error(
      `ensureWorkspaceDefaults(spotify): ${spotifyIntegrationError.message}`,
    );
  }

  if (openaiIntegrationError) {
    throw new Error(
      `ensureWorkspaceDefaults(openai): ${openaiIntegrationError.message}`,
    );
  }
}

function normalizeWorkspaceRole(role: string | null | undefined): WorkspaceRole {
  if (role === "owner" || role === "admin" || role === "viewer") {
    return role;
  }

  return "member";
}

async function canManagePlaylistOsWorkspaceSettings(workspace: WorkspaceContext) {
  if (workspace.membership.role === "owner" || workspace.membership.role === "admin") {
    return true;
  }

  const supabase = await createClient();
  const dataClient = createAdminClient() ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return false;
  }

  const [
    { data: moduleRow, error: moduleError },
    { data: roleRow, error: roleError },
  ] = await Promise.all([
    dataClient
      .from("workspace_modules")
      .select("is_enabled")
      .eq("workspace_id", workspace.workspace.id)
      .eq("module_key", "playlist_os")
      .maybeSingle(),
    dataClient
      .from("module_roles")
      .select("role")
      .eq("workspace_id", workspace.workspace.id)
      .eq("user_id", user.id)
      .eq("module_key", "playlist_os")
      .maybeSingle(),
  ]);

  if (moduleError || roleError || !moduleRow?.is_enabled) {
    return false;
  }

  const role = roleRow?.role as ModuleRole | null | undefined;

  return role ? PLAYLIST_OS_INTEGRATION_MANAGER_ROLES.has(role) : false;
}

const getCurrentWorkspaceContextUncached = async (): Promise<WorkspaceContext | null> => {
  const supabase = await createClient();
  const dataClient = createAdminClient() ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: accessRows, error: accessError } = await dataClient
    .from("workspace_users")
    .select("workspace_id, role, status, created_at")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (accessError) {
    throw new Error(
      `getCurrentWorkspaceContext(access): ${accessError.message}`,
    );
  }

  let workspaceAccessRows = (accessRows ?? []) as Array<{
    workspace_id: string;
    role: string | null;
  }>;

  if (workspaceAccessRows.length === 0) {
    const { data: membershipRows, error: membershipError } = await dataClient
      .from("workspace_memberships")
      .select("workspace_id, role, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    if (membershipError) {
      throw new Error(
        `getCurrentWorkspaceContext(membership): ${membershipError.message}`,
      );
    }

    workspaceAccessRows = ((membershipRows ?? []) as Array<{
      workspace_id: string;
      role: string | null;
    }>).map((row) => ({
      workspace_id: row.workspace_id,
      role: normalizeWorkspaceRole(row.role),
    }));
  }

  if (workspaceAccessRows.length === 0) {
    return null;
  }

  const workspaceIds = Array.from(
    new Set(workspaceAccessRows.map((row) => row.workspace_id)),
  );

  const { data: workspaceRows, error: workspaceError } = await dataClient
    .from("workspaces")
    .select("id, name, slug, type, status, owner_user_id")
    .in("id", workspaceIds);

  if (workspaceError) {
    throw new Error(
      `getCurrentWorkspaceContext(workspace): ${workspaceError.message}`,
    );
  }

  const accessRoleByWorkspaceId = new Map(
    workspaceAccessRows.map((row) => [
      row.workspace_id,
      normalizeWorkspaceRole(row.role),
    ]),
  );

  const accessibleWorkspaces = ((workspaceRows ?? []) as WorkspaceRow[])
    .map((workspaceRow): WorkspaceSummary | null => {
      const role = accessRoleByWorkspaceId.get(workspaceRow.id);

      if (!role) {
        return null;
      }

      return {
        id: workspaceRow.id,
        name: workspaceRow.name,
        slug: workspaceRow.slug,
        type: workspaceRow.type,
        status: workspaceRow.status ?? "active",
        role,
      };
    })
    .filter(Boolean) as WorkspaceSummary[];

  const cookieStore = await cookies();
  const activeWorkspaceId =
    cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value ?? null;
  const selectedWorkspace = selectCurrentWorkspace(
    accessibleWorkspaces,
    activeWorkspaceId,
  );

  if (!selectedWorkspace) {
    return null;
  }

  const workspace = ((workspaceRows ?? []) as WorkspaceRow[]).find(
    (row) => row.id === selectedWorkspace.id,
  );

  if (!workspace) {
    return null;
  }

  const membership: WorkspaceMembershipRow = {
    workspace_id: selectedWorkspace.id,
    role: selectedWorkspace.role,
  };

  if (selectedWorkspace.role === "owner" || selectedWorkspace.role === "admin") {
    await ensureWorkspaceDefaults(workspace.id, workspace.slug);
  }

  const [
    { data: settingsRow, error: settingsError },
    { data: spotifyIntegrationRow, error: spotifyIntegrationError },
    { data: openaiIntegrationRow, error: openaiIntegrationError },
  ] =
    await Promise.all([
      dataClient
        .from("workspace_settings")
        .select(
          "workspace_id, default_market, release_window_days, suggestion_score_threshold, prioritize_followed_artists, prioritize_top_tracks",
        )
        .eq("workspace_id", workspace.id)
        .maybeSingle(),
      dataClient
        .from("workspace_integrations")
        .select(
          "workspace_id, provider, app_mode, connection_status, app_client_id, app_client_secret, provider_account_id, provider_account_label, access_token, refresh_token, token_expires_at, granted_scopes",
        )
        .eq("workspace_id", workspace.id)
        .eq("provider", "spotify")
        .maybeSingle(),
      dataClient
        .from("workspace_integrations")
        .select(
          "workspace_id, provider, app_mode, connection_status, app_client_id, app_client_secret",
        )
        .eq("workspace_id", workspace.id)
        .eq("provider", "openai")
        .maybeSingle(),
    ]);

  if (settingsError) {
    throw new Error(
      `getCurrentWorkspaceContext(settings): ${settingsError.message}`,
    );
  }

  if (spotifyIntegrationError) {
    throw new Error(
      `getCurrentWorkspaceContext(spotify): ${spotifyIntegrationError.message}`,
    );
  }

  if (openaiIntegrationError) {
    throw new Error(
      `getCurrentWorkspaceContext(openai): ${openaiIntegrationError.message}`,
    );
  }

  const settings = settingsRow as WorkspaceSettingsRow | null;
  const spotifyIntegration = spotifyIntegrationRow as WorkspaceIntegrationRow | null;
  const openaiIntegration = openaiIntegrationRow as WorkspaceIntegrationRow | null;
  const spotifyAppMode = getEffectiveSpotifyAppMode(
    workspace,
    spotifyIntegration?.app_mode,
  );
  const spotifyStoredSessionBelongsToMode =
    canUseGlobalSpotifyApp(workspace) ||
    spotifyIntegration?.app_mode === "workspace_app";
  const spotifyConnectionStatus =
    spotifyStoredSessionBelongsToMode
      ? spotifyIntegration?.connection_status ??
        DEFAULT_SPOTIFY_INTEGRATION.connectionStatus
      : "not_connected";

  return {
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
    membership: {
      role: membership.role,
    },
    settings: {
      defaultMarket:
        settings?.default_market ?? DEFAULT_WORKSPACE_SETTINGS.defaultMarket,
      releaseWindowDays:
        settings?.release_window_days ??
        DEFAULT_WORKSPACE_SETTINGS.releaseWindowDays,
      suggestionScoreThreshold:
        settings?.suggestion_score_threshold ??
        DEFAULT_WORKSPACE_SETTINGS.suggestionScoreThreshold,
      prioritizeFollowedArtists:
        settings?.prioritize_followed_artists ??
        DEFAULT_WORKSPACE_SETTINGS.prioritizeFollowedArtists,
      prioritizeTopTracks:
        settings?.prioritize_top_tracks ??
        DEFAULT_WORKSPACE_SETTINGS.prioritizeTopTracks,
    },
    spotifyIntegration: {
      appMode: spotifyAppMode,
      connectionStatus: spotifyConnectionStatus,
      appClientId:
        spotifyIntegration?.app_client_id ??
        DEFAULT_SPOTIFY_INTEGRATION.appClientId,
      hasAppClientSecret:
        spotifyIntegration?.app_client_secret != null
          ? Boolean(spotifyIntegration.app_client_secret)
          : DEFAULT_SPOTIFY_INTEGRATION.hasAppClientSecret,
      hasAccessToken:
        spotifyStoredSessionBelongsToMode && spotifyIntegration?.access_token != null
          ? Boolean(spotifyIntegration.access_token)
          : DEFAULT_SPOTIFY_INTEGRATION.hasAccessToken,
      hasRefreshToken:
        spotifyStoredSessionBelongsToMode && spotifyIntegration?.refresh_token != null
          ? Boolean(spotifyIntegration.refresh_token)
          : DEFAULT_SPOTIFY_INTEGRATION.hasRefreshToken,
      tokenExpiresAt:
        spotifyStoredSessionBelongsToMode
          ? spotifyIntegration?.token_expires_at ??
            DEFAULT_SPOTIFY_INTEGRATION.tokenExpiresAt
          : DEFAULT_SPOTIFY_INTEGRATION.tokenExpiresAt,
      providerAccountId:
        spotifyStoredSessionBelongsToMode
          ? spotifyIntegration?.provider_account_id ??
            DEFAULT_SPOTIFY_INTEGRATION.providerAccountId
          : DEFAULT_SPOTIFY_INTEGRATION.providerAccountId,
      providerAccountLabel:
        spotifyStoredSessionBelongsToMode
          ? spotifyIntegration?.provider_account_label ??
            DEFAULT_SPOTIFY_INTEGRATION.providerAccountLabel
          : DEFAULT_SPOTIFY_INTEGRATION.providerAccountLabel,
      grantedScopes:
        spotifyStoredSessionBelongsToMode
          ? spotifyIntegration?.granted_scopes ??
            DEFAULT_SPOTIFY_INTEGRATION.grantedScopes
          : DEFAULT_SPOTIFY_INTEGRATION.grantedScopes,
    },
    openaiIntegration: {
      appMode: openaiIntegration?.app_mode ?? DEFAULT_OPENAI_INTEGRATION.appMode,
      connectionStatus:
        openaiIntegration?.connection_status ??
        DEFAULT_OPENAI_INTEGRATION.connectionStatus,
      model: openaiIntegration?.app_client_id ?? DEFAULT_OPENAI_INTEGRATION.model,
      hasApiKey:
        openaiIntegration?.app_client_secret != null
          ? Boolean(openaiIntegration.app_client_secret)
          : DEFAULT_OPENAI_INTEGRATION.hasApiKey,
    },
  };
};

export const getCurrentWorkspaceContext = cache(
  getCurrentWorkspaceContextUncached,
);

export async function updateCurrentWorkspaceSpotifyIntegration(
  input: WorkspaceSpotifyIntegrationInput,
) {
  const workspace = await getCurrentWorkspaceContext();

  if (!workspace) {
    throw new Error("Workspace indisponivel.");
  }

  if (!(await canManagePlaylistOsWorkspaceSettings(workspace))) {
    throw new Error("Sem permissao para editar a integracao.");
  }

  const dataClient = await getWorkspaceDbClient();
  const appMode = canUseGlobalSpotifyApp(workspace.workspace)
    ? input.appMode
    : "workspace_app";
  const normalizedClientId = input.appClientId?.trim() || null;
  const normalizedClientSecret = input.appClientSecret?.trim() || null;
  const currentHasSecret = workspace.spotifyIntegration.hasAppClientSecret;
  const clientIdChanged =
    normalizedClientId !== null &&
    normalizedClientId !== workspace.spotifyIntegration.appClientId;
  const appModeChanged = appMode !== workspace.spotifyIntegration.appMode;
  const credentialsChanged =
    appMode === "workspace_app" &&
    (appModeChanged || clientIdChanged || normalizedClientSecret !== null);

  if (
    appMode === "workspace_app" &&
    (!normalizedClientId || (!normalizedClientSecret && !currentHasSecret))
  ) {
    throw new Error(
      "Para usar a app do workspace, preencha Client ID e Client Secret.",
    );
  }

  const payload: Record<string, unknown> = {
    workspace_id: workspace.workspace.id,
    provider: "spotify",
    app_mode: appMode,
    connection_status: credentialsChanged
      ? "not_connected"
      : workspace.spotifyIntegration.connectionStatus,
    updated_at: new Date().toISOString(),
  };

  if (normalizedClientId !== null) {
    payload.app_client_id = normalizedClientId;
  }

  if (normalizedClientSecret !== null) {
    payload.app_client_secret = normalizedClientSecret;
  }

  if (credentialsChanged) {
    payload.provider_account_id = null;
    payload.provider_account_label = null;
    payload.access_token = null;
    payload.refresh_token = null;
    payload.token_expires_at = null;
    payload.granted_scopes = null;
  }

  const { error } = await dataClient
    .from("workspace_integrations")
    .upsert(payload, { onConflict: "workspace_id,provider" });

  if (error) {
    throw new Error(`updateCurrentWorkspaceSpotifyIntegration: ${error.message}`);
  }

  return getCurrentWorkspaceContext();
}

export async function updateCurrentWorkspaceOpenAIIntegration(
  input: WorkspaceOpenAIIntegrationInput,
) {
  const workspace = await getCurrentWorkspaceContext();

  if (!workspace) {
    throw new Error("Workspace indisponivel.");
  }

  if (!(await canManagePlaylistOsWorkspaceSettings(workspace))) {
    throw new Error("Sem permissao para editar a integracao.");
  }

  const dataClient = await getWorkspaceDbClient();
  const normalizedApiKey = input.apiKey?.trim() || null;
  const normalizedModel = input.model?.trim() || "gpt-5.5";
  const currentHasApiKey = workspace.openaiIntegration.hasApiKey;

  if (
    input.appMode === "workspace_app" &&
    !normalizedApiKey &&
    !currentHasApiKey
  ) {
    throw new Error("Para usar a chave do workspace, preencha a API key.");
  }

  const payload: Record<string, unknown> = {
    app_mode: input.appMode,
    app_client_id: normalizedModel,
    connection_status:
      input.appMode === "workspace_app" || process.env.OPENAI_API_KEY?.trim()
        ? "connected"
        : "not_connected",
    updated_at: new Date().toISOString(),
  };

  if (normalizedApiKey !== null) {
    payload.app_client_secret = normalizedApiKey;
  }

  const { error } = await dataClient
    .from("workspace_integrations")
    .upsert(
      {
        workspace_id: workspace.workspace.id,
        provider: "openai",
        ...payload,
      },
      { onConflict: "workspace_id,provider" },
    );

  if (error) {
    throw new Error(`updateCurrentWorkspaceOpenAIIntegration: ${error.message}`);
  }

  return getCurrentWorkspaceContext();
}

export async function updateCurrentWorkspaceSettings(
  input: WorkspaceSettingsInput,
) {
  const workspace = await getCurrentWorkspaceContext();

  if (!workspace) {
    throw new Error("Workspace indisponivel.");
  }

  if (!["owner", "admin"].includes(workspace.membership.role)) {
    if (!(await canManagePlaylistOsWorkspaceSettings(workspace))) {
      throw new Error("Sem permissao para editar o workspace.");
    }
  }

  const workspaceName = input.workspaceName?.trim() || workspace.workspace.name;
  const defaultMarket = input.defaultMarket.trim().toUpperCase() || "BR";
  const releaseWindowDays = Math.max(1, Math.min(90, input.releaseWindowDays));
  const suggestionScoreThreshold = Math.max(
    0,
    Math.min(100, input.suggestionScoreThreshold),
  );

  const supabase = await getWorkspaceDbClient();

  const [{ error: workspaceError }, { error: settingsError }] =
    await Promise.all([
      supabase
        .from("workspaces")
        .update({
          name: workspaceName,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workspace.workspace.id),
      supabase
        .from("workspace_settings")
        .update({
          default_market: defaultMarket,
          release_window_days: releaseWindowDays,
          suggestion_score_threshold: suggestionScoreThreshold,
          prioritize_followed_artists: input.prioritizeFollowedArtists,
          prioritize_top_tracks: input.prioritizeTopTracks,
          updated_at: new Date().toISOString(),
        })
        .eq("workspace_id", workspace.workspace.id),
    ]);

  if (workspaceError) {
    throw new Error(`updateCurrentWorkspaceSettings(workspace): ${workspaceError.message}`);
  }

  if (settingsError) {
    throw new Error(`updateCurrentWorkspaceSettings(settings): ${settingsError.message}`);
  }

  return getCurrentWorkspaceContext();
}

export async function getEffectiveSpotifyCredentials(): Promise<EffectiveSpotifyCredentials | null> {
  const globalClientId = process.env.SPOTIFY_CLIENT_ID?.trim() || "";
  const globalClientSecret = process.env.SPOTIFY_CLIENT_SECRET?.trim() || "";
  const workspace = await getCurrentWorkspaceContext().catch(() => null);

  if (
    workspace?.spotifyIntegration.appMode === "workspace_app" &&
    workspace.spotifyIntegration.appClientId &&
    workspace.spotifyIntegration.hasAppClientSecret
  ) {
    const supabase = await getWorkspaceDbClient();
    const { data, error } = await supabase
      .from("workspace_integrations")
      .select("workspace_id, app_client_id, app_client_secret")
      .eq("workspace_id", workspace.workspace.id)
      .eq("provider", "spotify")
      .single();

    if (error) {
      throw new Error(`getEffectiveSpotifyCredentials: ${error.message}`);
    }

    const row = data as Pick<
      WorkspaceIntegrationRow,
      "workspace_id" | "app_client_id" | "app_client_secret"
    >;

    if (row.app_client_id && row.app_client_secret) {
      return {
        clientId: row.app_client_id,
        clientSecret: row.app_client_secret,
        source: "workspace_app",
        workspaceId: row.workspace_id,
      };
    }
  }

  if (!globalClientId || !globalClientSecret) {
    return null;
  }

  return {
    clientId: globalClientId,
    clientSecret: globalClientSecret,
    source: "global_app",
    workspaceId: workspace?.workspace.id ?? null,
  };
}

export async function getEffectiveOpenAICredentials(): Promise<EffectiveOpenAICredentials | null> {
  const globalApiKey = process.env.OPENAI_API_KEY?.trim() || "";
  const globalModel =
    process.env.OPENAI_PLAYLISTS_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-5.5";
  const workspace = await getCurrentWorkspaceContext().catch(() => null);
  const workspaceModel = workspace?.openaiIntegration.model?.trim() || globalModel;

  if (
    workspace?.openaiIntegration.appMode === "workspace_app" &&
    workspace.openaiIntegration.hasApiKey
  ) {
    const supabase = await getWorkspaceDbClient();
    const { data, error } = await supabase
      .from("workspace_integrations")
      .select("workspace_id, app_client_id, app_client_secret")
      .eq("workspace_id", workspace.workspace.id)
      .eq("provider", "openai")
      .single();

    if (error) {
      throw new Error(`getEffectiveOpenAICredentials: ${error.message}`);
    }

    const row = data as Pick<
      WorkspaceIntegrationRow,
      "workspace_id" | "app_client_id" | "app_client_secret"
    >;

    if (row.app_client_secret) {
      return {
        apiKey: row.app_client_secret,
        model: row.app_client_id?.trim() || workspaceModel,
        source: "workspace_app",
        workspaceId: row.workspace_id,
      };
    }
  }

  if (!globalApiKey) {
    return null;
  }

  return {
    apiKey: globalApiKey,
    model: workspaceModel,
    source: "global_app",
    workspaceId: workspace?.workspace.id ?? null,
  };
}

export async function getCurrentWorkspaceSpotifyStoredAuth(): Promise<WorkspaceSpotifyStoredAuth | null> {
  const workspace = await getCurrentWorkspaceContext();

  if (!workspace) {
    return null;
  }

  const supabase = await getWorkspaceDbClient();
  const { data, error } = await supabase
    .from("workspace_integrations")
    .select(
      "id, workspace_id, app_mode, connection_status, access_token, refresh_token, token_expires_at, provider_account_id, provider_account_label, granted_scopes",
    )
    .eq("workspace_id", workspace.workspace.id)
    .eq("provider", "spotify")
    .single();

  if (error) {
    throw new Error(`getCurrentWorkspaceSpotifyStoredAuth: ${error.message}`);
  }

  const row = data as WorkspaceIntegrationRow;
  const appMode = getEffectiveSpotifyAppMode(
    workspace.workspace,
    row.app_mode,
  );
  const storedSessionBelongsToMode =
    canUseGlobalSpotifyApp(workspace.workspace) || row.app_mode === "workspace_app";

  return {
    workspaceId: row.workspace_id,
    integrationId: row.id ?? null,
    appMode,
    connectionStatus: storedSessionBelongsToMode
      ? row.connection_status
      : "not_connected",
    accessToken: storedSessionBelongsToMode ? row.access_token ?? null : null,
    refreshToken: storedSessionBelongsToMode ? row.refresh_token ?? null : null,
    tokenExpiresAt: storedSessionBelongsToMode
      ? row.token_expires_at ?? null
      : null,
    providerAccountId: storedSessionBelongsToMode
      ? row.provider_account_id
      : null,
    providerAccountLabel: storedSessionBelongsToMode
      ? row.provider_account_label
      : null,
    grantedScopes: storedSessionBelongsToMode ? row.granted_scopes : null,
  };
}

export async function syncCurrentWorkspaceSpotifyConnection(input: {
  providerAccountId: string | null;
  providerAccountLabel: string | null;
  grantedScopes: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  expiresInSeconds?: number | null;
}) {
  const workspace = await getCurrentWorkspaceContext();

  if (!workspace) {
    return;
  }

  const supabase = await getWorkspaceDbClient();
  const tokenExpiresAt =
    typeof input.expiresInSeconds === "number" && input.expiresInSeconds > 0
      ? new Date(Date.now() + input.expiresInSeconds * 1000).toISOString()
      : null;

  const payload: Record<string, unknown> = {
    workspace_id: workspace.workspace.id,
    provider: "spotify",
    app_mode: workspace.spotifyIntegration.appMode,
    connection_status: "connected",
    provider_account_id: input.providerAccountId,
    provider_account_label: input.providerAccountLabel,
    granted_scopes: input.grantedScopes,
    updated_at: new Date().toISOString(),
  };

  if (input.accessToken !== undefined) {
    payload.access_token = input.accessToken;
  }

  if (input.refreshToken !== undefined) {
    payload.refresh_token = input.refreshToken;
  }

  if (tokenExpiresAt) {
    payload.token_expires_at = tokenExpiresAt;
  }

  const { error } = await supabase
    .from("workspace_integrations")
    .upsert(payload, { onConflict: "workspace_id,provider" });

  if (error) {
    throw new Error(`syncCurrentWorkspaceSpotifyConnection: ${error.message}`);
  }
}

export async function clearCurrentWorkspaceSpotifyConnection() {
  const workspace = await getCurrentWorkspaceContext();

  if (!workspace) {
    return;
  }

  const supabase = await getWorkspaceDbClient();
  const { error } = await supabase
    .from("workspace_integrations")
    .update({
      connection_status: "not_connected",
      provider_account_id: null,
      provider_account_label: null,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      granted_scopes: null,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspace.workspace.id)
    .eq("provider", "spotify");

  if (error) {
    throw new Error(`clearCurrentWorkspaceSpotifyConnection: ${error.message}`);
  }
}
