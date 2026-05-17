import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type WorkspaceRow = {
  id: string;
  name: string;
  slug: string;
  owner_user_id: string;
};

type WorkspaceMembershipRow = {
  workspace_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
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

type WorkspaceDbClient =
  | Awaited<ReturnType<typeof createClient>>
  | NonNullable<ReturnType<typeof createAdminClient>>;

async function getWorkspaceDbClient(): Promise<WorkspaceDbClient> {
  return createAdminClient() ?? (await createClient());
}

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function buildWorkspaceName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name.trim()
        : "";

  if (metadataName) {
    return metadataName;
  }

  const emailPrefix = user.email?.split("@")[0]?.trim();

  if (emailPrefix) {
    return emailPrefix;
  }

  return "Meu workspace";
}

function buildWorkspaceSlug(name: string, userId: string) {
  const base = slugify(name) || "workspace";
  return `${base}-${userId.slice(0, 8)}`;
}

async function ensureWorkspaceDefaults(workspaceId: string) {
  const supabase = await getWorkspaceDbClient();

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
          app_mode: "global_app",
          connection_status: "not_connected",
        },
        { onConflict: "workspace_id,provider" },
      ),
      client.from("workspace_integrations").upsert(
        {
          workspace_id: workspaceId,
          provider: "openai",
          app_mode: "global_app",
          connection_status: "not_connected",
        },
        { onConflict: "workspace_id,provider" },
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

async function bootstrapWorkspaceForCurrentUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const supabase = await getWorkspaceDbClient();
  const name = buildWorkspaceName(user);
  const slug = buildWorkspaceSlug(name, user.id);
  const workspaceId = crypto.randomUUID();

  const { error: workspaceError } = await supabase
    .from("workspaces")
    .insert({
      id: workspaceId,
      name,
      slug,
      owner_user_id: user.id,
    });

  if (workspaceError) {
    throw new Error(`bootstrapWorkspace(workspace): ${workspaceError.message}`);
  }

  const { error: membershipError } = await supabase
    .from("workspace_memberships")
    .insert({
      workspace_id: workspaceId,
      user_id: user.id,
      role: "owner",
    });

  if (membershipError) {
    throw new Error(
      `bootstrapWorkspace(membership): ${membershipError.message}`,
    );
  }

  await ensureWorkspaceDefaults(workspaceId);

  return {
    id: workspaceId,
    name,
    slug,
    owner_user_id: user.id,
  } satisfies WorkspaceRow;
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

  let membership: WorkspaceMembershipRow | null = null;

  const { data: membershipRows, error: membershipError } = await dataClient
    .from("workspace_memberships")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1);

  if (membershipError) {
    throw new Error(
      `getCurrentWorkspaceContext(membership): ${membershipError.message}`,
    );
  }

  membership = ((membershipRows ?? [])[0] as WorkspaceMembershipRow | undefined) ?? null;

  let workspace: WorkspaceRow | null = null;

  if (!membership) {
    workspace = await bootstrapWorkspaceForCurrentUser(user);
    membership = {
      workspace_id: workspace.id,
      role: "owner",
    };
  } else {
    const { data: workspaceRow, error: workspaceError } = await dataClient
      .from("workspaces")
      .select("id, name, slug, owner_user_id")
      .eq("id", membership.workspace_id)
      .single();

    if (workspaceError) {
      throw new Error(
        `getCurrentWorkspaceContext(workspace): ${workspaceError.message}`,
      );
    }

    workspace = workspaceRow as WorkspaceRow;
    await ensureWorkspaceDefaults(workspace.id);
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
          "workspace_id, provider, app_mode, connection_status, app_client_id, app_client_secret, provider_account_id, provider_account_label, granted_scopes",
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
      appMode: spotifyIntegration?.app_mode ?? DEFAULT_SPOTIFY_INTEGRATION.appMode,
      connectionStatus:
        spotifyIntegration?.connection_status ??
        DEFAULT_SPOTIFY_INTEGRATION.connectionStatus,
      appClientId:
        spotifyIntegration?.app_client_id ??
        DEFAULT_SPOTIFY_INTEGRATION.appClientId,
      hasAppClientSecret:
        spotifyIntegration?.app_client_secret != null
          ? Boolean(spotifyIntegration.app_client_secret)
          : DEFAULT_SPOTIFY_INTEGRATION.hasAppClientSecret,
      providerAccountId:
        spotifyIntegration?.provider_account_id ??
        DEFAULT_SPOTIFY_INTEGRATION.providerAccountId,
      providerAccountLabel:
        spotifyIntegration?.provider_account_label ??
        DEFAULT_SPOTIFY_INTEGRATION.providerAccountLabel,
      grantedScopes:
        spotifyIntegration?.granted_scopes ??
        DEFAULT_SPOTIFY_INTEGRATION.grantedScopes,
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

  if (!["owner", "admin"].includes(workspace.membership.role)) {
    throw new Error("Sem permissao para editar a integracao.");
  }

  const dataClient = await getWorkspaceDbClient();
  const normalizedClientId = input.appClientId?.trim() || null;
  const normalizedClientSecret = input.appClientSecret?.trim() || null;
  const currentHasSecret = workspace.spotifyIntegration.hasAppClientSecret;

  if (
    input.appMode === "workspace_app" &&
    (!normalizedClientId || (!normalizedClientSecret && !currentHasSecret))
  ) {
    throw new Error(
      "Para usar a app do workspace, preencha Client ID e Client Secret.",
    );
  }

  const payload: Record<string, unknown> = {
    app_mode: input.appMode,
    updated_at: new Date().toISOString(),
  };

  if (normalizedClientId !== null) {
    payload.app_client_id = normalizedClientId;
  }

  if (normalizedClientSecret !== null) {
    payload.app_client_secret = normalizedClientSecret;
  }

  const { error } = await dataClient
    .from("workspace_integrations")
    .update(payload)
    .eq("workspace_id", workspace.workspace.id)
    .eq("provider", "spotify");

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

  if (!["owner", "admin"].includes(workspace.membership.role)) {
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
    throw new Error("Sem permissao para editar o workspace.");
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
      "id, workspace_id, connection_status, access_token, refresh_token, token_expires_at, provider_account_id, provider_account_label, granted_scopes",
    )
    .eq("workspace_id", workspace.workspace.id)
    .eq("provider", "spotify")
    .single();

  if (error) {
    throw new Error(`getCurrentWorkspaceSpotifyStoredAuth: ${error.message}`);
  }

  const row = data as WorkspaceIntegrationRow;

  return {
    workspaceId: row.workspace_id,
    integrationId: row.id ?? null,
    connectionStatus: row.connection_status,
    accessToken: row.access_token ?? null,
    refreshToken: row.refresh_token ?? null,
    tokenExpiresAt: row.token_expires_at ?? null,
    providerAccountId: row.provider_account_id,
    providerAccountLabel: row.provider_account_label,
    grantedScopes: row.granted_scopes,
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
    .update(payload)
    .eq("workspace_id", workspace.workspace.id)
    .eq("provider", "spotify");

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
