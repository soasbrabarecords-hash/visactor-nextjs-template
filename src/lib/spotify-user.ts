import "server-only";

import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import {
  clearCurrentWorkspaceSpotifyConnection,
  getEffectiveSpotifyCredentials,
  getCurrentWorkspaceContext,
  getCurrentWorkspaceSpotifyStoredAuth,
  syncCurrentWorkspaceSpotifyConnection,
} from "@/lib/workspaces";

const SPOTIFY_ACCESS_TOKEN_COOKIE = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const SPOTIFY_STATE_COOKIE = "spotify_auth_state";
const SPOTIFY_NEXT_COOKIE = "spotify_auth_next";
const SPOTIFY_WORKSPACE_COOKIE = "spotify_auth_workspace_id";
const SPOTIFY_PRODUCTION_REDIRECT_URI =
  "https://system.soasbraba.com/api/spotify/auth/callback";

export type SpotifyOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

type SpotifyUserPlaylistsResponse = {
  items?: SpotifyUserPlaylistObject[];
  next?: string | null;
  total?: number;
};

type SpotifyCurrentUserResponse = {
  id?: string;
  display_name?: string | null;
  email?: string | null;
  product?: string | null;
  images?: Array<{
    url?: string;
  }>;
};

type SpotifyUserPlaylistObject = {
  id?: string;
  name?: string;
  description?: string | null;
  public?: boolean | null;
  collaborative?: boolean;
  external_urls?: {
    spotify?: string;
  };
  images?: Array<{
    url?: string;
  }>;
  owner?: {
    id?: string;
    display_name?: string;
  };
  tracks?: {
    total?: number;
    items?: SpotifyPlaylistTrackItem[];
    next?: string | null;
  };
};

type SpotifyPlaylistTracksResponse = {
  items?: SpotifyPlaylistTrackItem[];
  next?: string | null;
  total?: number;
};

type SpotifyPlaylistTrackItem = {
  track?: {
    id?: string;
    name?: string;
    duration_ms?: number;
    popularity?: number;
    external_urls?: {
      spotify?: string;
    };
    album?: {
      name?: string;
      images?: Array<{
        url?: string;
      }>;
    };
    artists?: Array<{
      name?: string;
    }>;
  } | null;
};

export type SpotifyAccountPlaylist = {
  id: string;
  name: string;
  ownerId: string;
  ownerName: string;
  imageUrl: string | null;
  tracksTotal: number;
  spotifyUrl: string;
  isPublic: boolean;
  isCollaborative: boolean;
};

export type SpotifyEditablePlaylistTrack = {
  id: string;
  name: string;
  artists: string;
  albumName: string;
  imageUrl: string | null;
  durationLabel: string;
  popularity: number;
  spotifyUrl: string;
};

export type SpotifyEditablePlaylist = SpotifyAccountPlaylist & {
  description: string;
  tracks: SpotifyEditablePlaylistTrack[];
};

export type SpotifyAccountPlaylistsResult =
  | {
      connected: true;
      playlists: SpotifyAccountPlaylist[];
    }
  | {
      connected: false;
      playlists: [];
      message: string;
    };

export type SpotifyEditablePlaylistResult =
  | {
      connected: true;
      playlist: SpotifyEditablePlaylist;
    }
  | {
      connected: false;
      playlist: null;
      message: string;
    };

export type SpotifyConnectionStatusResult =
  | {
      connected: true;
      account: {
        id: string;
        displayName: string;
        email: string | null;
        product: string | null;
        imageUrl: string | null;
      };
    }
  | {
      connected: false;
      account: null;
      message: string;
    };

export type SpotifyWorkspaceDiagnosticsResult =
  | {
      success: true;
      workspace: {
        id: string;
        name: string;
      } | null;
      integration: SpotifyWorkspaceDiagnosticsIntegration;
      spotifyUser: {
        id: string | null;
        displayName: string | null;
        email: string | null;
        product: string | null;
      } | null;
      playlistsCheck: {
        status: number;
        ok: boolean;
        total: number | null;
        itemsCount: number;
        firstItems: Array<{
          id: string;
          name: string;
          ownerId: string;
          tracksTotal: number;
        }>;
        message: string | null;
      };
      selectedPlaylistCheck: {
        playlistId: string | null;
        detail: {
          status: number;
          ok: boolean;
          name: string | null;
          ownerId: string | null;
          tracksTotal: number | null;
          embeddedItemsCount: number;
          message: string | null;
        } | null;
        tracks: {
          status: number;
          ok: boolean;
          total: number | null;
          itemsCount: number;
          firstItems: Array<{
            id: string | null;
            name: string | null;
          }>;
          message: string | null;
        } | null;
      };
    }
  | {
      success: false;
      message: string;
      workspace: {
        id: string;
        name: string;
      } | null;
      integration: SpotifyWorkspaceDiagnosticsIntegration;
    };

type SpotifyWorkspaceDiagnosticsIntegration = {
  appMode: string | null;
  connectionStatus: string | null;
  accountLabel: string | null;
  accountId: string | null;
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  tokenExpiresAt: string | null;
  grantedScopes: string | null;
};

type SpotifyWorkspaceDiagnosticsSuccess = Extract<
  SpotifyWorkspaceDiagnosticsResult,
  { success: true }
>;
type SpotifyWorkspaceDiagnosticsDetailCheck =
  SpotifyWorkspaceDiagnosticsSuccess["selectedPlaylistCheck"]["detail"];
type SpotifyWorkspaceDiagnosticsTracksCheck =
  SpotifyWorkspaceDiagnosticsSuccess["selectedPlaylistCheck"]["tracks"];

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

type ResolvedSpotifySession = {
  source: "workspace" | "cookie";
  accessToken: string | null;
  refreshToken: string | null;
};

type SpotifyTokenOptions = {
  requireWorkspace?: boolean;
  forceRefresh?: boolean;
};

const SPOTIFY_WORKSPACE_REQUIRED_MESSAGE =
  "Conecte uma conta Spotify para adicionar músicas às playlists.";

const CURRENT_USER_CACHE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_PLAYLISTS_CACHE_TTL_MS = 90 * 1000;
const EDITABLE_PLAYLIST_CACHE_TTL_MS = 3 * 60 * 1000;
const PLAYLIST_TRACK_IDS_TTL_MS = 2 * 60 * 1000;

const spotifyCurrentUserCache = new Map<string, CacheEntry<SpotifyCurrentUserResponse>>();
const spotifyAccountPlaylistsCache = new Map<string, CacheEntry<SpotifyAccountPlaylist[]>>();
const spotifyEditablePlaylistCache = new Map<string, CacheEntry<SpotifyEditablePlaylist>>();
const spotifyPlaylistTrackIdsCache = new Map<string, CacheEntry<string[]>>();
const spotifyPlaylistsInFlight = new Map<string, Promise<SpotifyAccountPlaylist[]>>();
const spotifyEditablePlaylistsInFlight = new Map<string, Promise<SpotifyEditablePlaylist>>();
const spotifyPlaylistTrackIdsInFlight = new Map<string, Promise<string[]>>();
const spotifyRateLimitUntilByScope = new Map<string, number>();

function buildTokenCacheKey(accessToken: string) {
  return accessToken.trim();
}

function getCachedValue<T>(cache: Map<string, CacheEntry<T>>, key: string) {
  const entry = cache.get(key);

  if (!entry) {
    return null;
  }

  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }

  return entry.value;
}

function setCachedValue<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number,
) {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlMs,
  });

  return value;
}

function getRemainingRateLimitSeconds(scope: string) {
  const blockedUntil = spotifyRateLimitUntilByScope.get(scope) ?? 0;

  return Math.max(0, Math.ceil((blockedUntil - Date.now()) / 1000));
}

function throwIfRateLimited(scope: string, label: string) {
  const remainingSeconds = getRemainingRateLimitSeconds(scope);

  if (remainingSeconds > 0) {
    throw new Error(
      `${label} 429: rate limit atingido. Tente novamente em ${remainingSeconds} segundos.`,
    );
  }
}

function registerRateLimit(scope: string, retryAfterHeader: string | null) {
  const retryAfterSeconds = Number.parseInt(retryAfterHeader ?? "", 10);

  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    spotifyRateLimitUntilByScope.set(
      scope,
      Date.now() + retryAfterSeconds * 1000,
    );
  }
}

function clearRateLimit(scope: string) {
  spotifyRateLimitUntilByScope.delete(scope);
}

function clearSpotifyReadCachesForToken(accessToken: string) {
  const cacheKey = buildTokenCacheKey(accessToken);

  spotifyCurrentUserCache.delete(cacheKey);
  spotifyAccountPlaylistsCache.delete(cacheKey);

  for (const editableKey of spotifyEditablePlaylistCache.keys()) {
    if (editableKey.startsWith(`${cacheKey}:`)) {
      spotifyEditablePlaylistCache.delete(editableKey);
    }
  }
}

function buildPlaylistTrackCacheKey(accessToken: string, playlistId: string) {
  return `${buildTokenCacheKey(accessToken)}:${playlistId}`;
}

function getCachedPlaylistTrackIds(cacheKey: string) {
  return getCachedValue(spotifyPlaylistTrackIdsCache, cacheKey);
}

function setCachedPlaylistTrackIds(cacheKey: string, trackIds: string[]) {
  return setCachedValue(
    spotifyPlaylistTrackIdsCache,
    cacheKey,
    Array.from(new Set(trackIds)),
    PLAYLIST_TRACK_IDS_TTL_MS,
  );
}

function updateCachedPlaylistTrackIds(
  accessToken: string,
  playlistId: string,
  updater: (trackIds: string[]) => string[],
) {
  const cacheKey = buildPlaylistTrackCacheKey(accessToken, playlistId);
  const currentTrackIds = getCachedPlaylistTrackIds(cacheKey);

  if (!currentTrackIds) {
    return;
  }

  setCachedPlaylistTrackIds(cacheKey, updater(currentTrackIds));
}

function clearSpotifyEditablePlaylistCache(
  accessToken: string,
  playlistId: string,
) {
  const cacheKey = `${buildTokenCacheKey(accessToken)}:${playlistId}`;
  spotifyEditablePlaylistCache.delete(cacheKey);
}

function clearSpotifyAccountPlaylistCache(accessToken: string) {
  const cacheKey = buildTokenCacheKey(accessToken);
  spotifyAccountPlaylistsCache.delete(cacheKey);
}

function mapSpotifyConnectionAccount(profile: SpotifyCurrentUserResponse) {
  if (!profile.id) {
    throw new Error("Spotify user profile unavailable.");
  }

  return {
    id: profile.id,
    displayName: profile.display_name?.trim() || "Conta Spotify",
    email: profile.email?.trim() || null,
    product: profile.product?.trim() || null,
    imageUrl: profile.images?.[0]?.url?.trim() || null,
  };
}

function extractSpotifyTrackId(trackUri: string) {
  return trackUri.replace(/^spotify:track:/, "").trim();
}

async function getSpotifyOAuthEnv() {
  const credentials = await getEffectiveSpotifyCredentials();

  if (!credentials?.clientId || !credentials.clientSecret) {
    return null;
  }

  return {
    clientId: credentials.clientId,
    clientSecret: credentials.clientSecret,
  };
}

function isUsableWorkspaceAccessToken(tokenExpiresAt: string | null | undefined) {
  if (!tokenExpiresAt) {
    return true;
  }

  const expiresAt = new Date(tokenExpiresAt).getTime();

  if (!Number.isFinite(expiresAt)) {
    return true;
  }

  return expiresAt > Date.now() + 60 * 1000;
}

async function resolveSpotifySession(
  options: SpotifyTokenOptions = {},
): Promise<ResolvedSpotifySession | null> {
  const workspaceAuth = await getCurrentWorkspaceSpotifyStoredAuth().catch(
    () => null,
  );

  if (
    workspaceAuth?.accessToken &&
    isUsableWorkspaceAccessToken(workspaceAuth.tokenExpiresAt)
  ) {
    return {
      source: "workspace",
      accessToken: workspaceAuth.accessToken,
      refreshToken: workspaceAuth.refreshToken,
    };
  }

  if (workspaceAuth?.refreshToken) {
    return {
      source: "workspace",
      accessToken: null,
      refreshToken: workspaceAuth.refreshToken,
    };
  }

  if (workspaceAuth?.appMode === "workspace_app") {
    return null;
  }

  if (workspaceAuth && workspaceAuth.connectionStatus !== "connected") {
    return null;
  }

  if (options.requireWorkspace) {
    return null;
  }

  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken =
    cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value ?? null;

  if (accessToken || refreshToken) {
    return {
      source: "cookie",
      accessToken,
      refreshToken,
    };
  }

  return null;
}

function getCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    maxAge,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function getSpotifyCredentialsHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`, "utf-8").toString("base64")}`;
}

export function getSpotifyRedirectUri(origin: string) {
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI?.trim() ||
    (process.env.NODE_ENV === "production"
      ? SPOTIFY_PRODUCTION_REDIRECT_URI
      : null) ||
    `${origin}/api/spotify/auth/callback`;

  return redirectUri.replace(/\/+$/, "");
}

export async function buildSpotifyAuthorizeUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const env = await getSpotifyOAuthEnv();

  if (!env) {
    throw new Error("Spotify environment variables are not configured.");
  }

  const params = new URLSearchParams({
    client_id: env.clientId,
    response_type: "code",
    redirect_uri: getSpotifyRedirectUri(origin),
    scope:
      "playlist-read-private playlist-read-collaborative playlist-modify-private playlist-modify-public ugc-image-upload user-read-email user-read-private user-top-read user-follow-read streaming user-read-playback-state user-modify-playback-state",
    show_dialog: "true",
    state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export function setSpotifyStateCookie(response: NextResponse, state: string) {
  response.cookies.set(
    SPOTIFY_STATE_COOKIE,
    state,
    getCookieOptions(10 * 60),
  );
}

export function setSpotifyNextCookie(response: NextResponse, nextPath: string) {
  response.cookies.set(
    SPOTIFY_NEXT_COOKIE,
    nextPath,
    getCookieOptions(10 * 60),
  );
}

export function setSpotifyWorkspaceCookie(
  response: NextResponse,
  workspaceId: string,
) {
  response.cookies.set(
    SPOTIFY_WORKSPACE_COOKIE,
    workspaceId,
    getCookieOptions(10 * 60),
  );
}

export async function getSpotifyStateCookie() {
  const cookieStore = await cookies();

  return cookieStore.get(SPOTIFY_STATE_COOKIE)?.value ?? null;
}

export async function getSpotifyNextCookie() {
  const cookieStore = await cookies();

  return cookieStore.get(SPOTIFY_NEXT_COOKIE)?.value ?? null;
}

export async function getSpotifyWorkspaceCookie() {
  const cookieStore = await cookies();

  return cookieStore.get(SPOTIFY_WORKSPACE_COOKIE)?.value ?? null;
}

export function clearSpotifyStateCookie(response: NextResponse) {
  response.cookies.set(SPOTIFY_STATE_COOKIE, "", getCookieOptions(0));
}

export function clearSpotifyNextCookie(response: NextResponse) {
  response.cookies.set(SPOTIFY_NEXT_COOKIE, "", getCookieOptions(0));
}

export function clearSpotifyWorkspaceCookie(response: NextResponse) {
  response.cookies.set(SPOTIFY_WORKSPACE_COOKIE, "", getCookieOptions(0));
}

export function setSpotifyAuthCookies(
  response: NextResponse,
  token: SpotifyOAuthTokenResponse,
) {
  response.cookies.set(
    SPOTIFY_ACCESS_TOKEN_COOKIE,
    token.access_token,
    getCookieOptions(Math.max(60, token.expires_in - 60)),
  );

  if (token.refresh_token) {
    response.cookies.set(
      SPOTIFY_REFRESH_TOKEN_COOKIE,
      token.refresh_token,
      getCookieOptions(60 * 60 * 24 * 30),
    );
  }
}

export function clearSpotifyAuthCookies(response: NextResponse) {
  response.cookies.set(SPOTIFY_ACCESS_TOKEN_COOKIE, "", getCookieOptions(0));
  response.cookies.set(SPOTIFY_REFRESH_TOKEN_COOKIE, "", getCookieOptions(0));
  clearSpotifyStateCookie(response);
  clearSpotifyNextCookie(response);
  clearSpotifyWorkspaceCookie(response);
}

export async function exchangeSpotifyCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const env = await getSpotifyOAuthEnv();

  if (!env) {
    throw new Error("Spotify environment variables are not configured.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: getSpotifyCredentialsHeader(env.clientId, env.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const errBody = await response.json().catch(() => ({})) as { error?: string; error_description?: string };
    throw new Error(`Spotify auth error: ${errBody.error ?? response.status} — ${errBody.error_description ?? "unknown"}`);
  }

  return (await response.json()) as SpotifyOAuthTokenResponse;
}

async function getSpotifyErrorMessage(response: Response, fallback: string) {
  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string | { message?: string; status?: number };
        error_description?: string;
        message?: string;
      }
    | null;
  const spotifyMessage =
    typeof payload?.error === "string"
      ? payload.error_description || payload.error
      : payload?.error?.message || payload?.message;

  return spotifyMessage ? `${fallback}: ${spotifyMessage}` : fallback;
}

function classifySpotifyError(status: number, message: string | null) {
  const normalized = (message ?? "").toLowerCase();

  if (status === 401 || normalized.includes("token")) return "invalid_token";
  if (normalized.includes("scope")) return "missing_scope";
  if (status === 403) return "forbidden";
  return "spotify_api_error";
}

async function refreshSpotifyToken(refreshToken: string) {
  const env = await getSpotifyOAuthEnv();

  if (!env) {
    throw new Error("Spotify environment variables are not configured.");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: getSpotifyCredentialsHeader(env.clientId, env.clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await getSpotifyErrorMessage(
      response,
      `Spotify refresh error ${response.status}`,
    );
    throw new Error(
      `status_code=${response.status} category=${classifySpotifyError(response.status, message)} message=${message}`,
    );
  }

  return (await response.json()) as SpotifyOAuthTokenResponse;
}

export async function syncSpotifyWorkspaceConnection(
  token: SpotifyOAuthTokenResponse,
) {
  const workspace = await getCurrentWorkspaceContext().catch(() => null);

  try {
    const profile = await fetchSpotifyCurrentUserWithToken(token.access_token);

    await syncCurrentWorkspaceSpotifyConnection({
      providerAccountId: profile.id?.trim() || null,
      providerAccountLabel:
        profile.display_name?.trim() || profile.email?.trim() || null,
      grantedScopes: token.scope?.trim() || null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token ?? undefined,
      expiresInSeconds: token.expires_in,
    });
  } catch {
    if (workspace?.spotifyIntegration.appMode === "workspace_app") {
      throw new Error(
        "Spotify conectou, mas nao foi possivel salvar a sessao no workspace.",
      );
    }

    // sync da conexao no workspace nao deve quebrar o auth principal
  }
}

export async function clearSpotifyWorkspaceConnection() {
  try {
    await clearCurrentWorkspaceSpotifyConnection();
  } catch {
    // limpeza de metadata do workspace nao deve quebrar logout
  }
}

function formatDuration(milliseconds: number | undefined) {
  if (!milliseconds || milliseconds <= 0) {
    return "—";
  }

  const totalSeconds = Math.round(milliseconds / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

async function fetchSpotifyCurrentUserWithToken(accessToken: string) {
  const cacheKey = buildTokenCacheKey(accessToken);
  const cachedProfile = getCachedValue(spotifyCurrentUserCache, cacheKey);

  if (cachedProfile?.id) {
    return cachedProfile;
  }

  const response = await fetch("https://api.spotify.com/v1/me", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Spotify user profile.");
  }

  const profile = (await response.json()) as SpotifyCurrentUserResponse;

  if (!profile.id) {
    throw new Error("Spotify user profile unavailable.");
  }

  return setCachedValue(
    spotifyCurrentUserCache,
    cacheKey,
    profile,
    CURRENT_USER_CACHE_TTL_MS,
  );
}

function mapSpotifyAccountPlaylist(
  playlist: SpotifyUserPlaylistObject,
): SpotifyAccountPlaylist | null {
  if (!playlist.id || !playlist.name) {
    return null;
  }

  return {
    id: playlist.id,
    name: playlist.name,
    ownerId: playlist.owner?.id || "",
    ownerName: playlist.owner?.display_name?.trim() || "Spotify",
    imageUrl: playlist.images?.[0]?.url?.trim() || null,
    tracksTotal:
      typeof playlist.tracks?.total === "number" ? playlist.tracks.total : 0,
    spotifyUrl:
      playlist.external_urls?.spotify ||
      `https://open.spotify.com/playlist/${playlist.id}`,
    isPublic: Boolean(playlist.public),
    isCollaborative: Boolean(playlist.collaborative),
  };
}

function mapSpotifyEditablePlaylistTrack(
  item: SpotifyPlaylistTrackItem,
): SpotifyEditablePlaylistTrack | null {
  const track = item.track;

  if (!track?.id || !track.name) {
    return null;
  }

  return {
    id: track.id,
    name: track.name,
    artists:
      track.artists
        ?.map((artist) => artist.name)
        .filter(Boolean)
        .join(", ") || "Artista nao informado",
    albumName: track.album?.name || "Album nao informado",
    imageUrl: track.album?.images?.[0]?.url?.trim() || null,
    durationLabel: formatDuration(track.duration_ms),
    popularity: typeof track.popularity === "number" ? track.popularity : 0,
    spotifyUrl:
      track.external_urls?.spotify ||
      `https://open.spotify.com/track/${track.id}`,
  };
}

function mapSpotifyPlaylistTrackItems(items: SpotifyPlaylistTrackItem[] = []) {
  return items
    .map((item) => mapSpotifyEditablePlaylistTrack(item))
    .filter(Boolean) as SpotifyEditablePlaylistTrack[];
}

async function fetchSpotifyPlaylistTrackTotalWithToken(
  accessToken: string,
  playlistId: string,
) {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=tracks(total)`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      await getSpotifyErrorMessage(
        response,
        `Spotify playlist total error ${response.status}`,
      ),
    );
  }

  const detail = (await response.json().catch(() => null)) as
    | SpotifyUserPlaylistObject
    | null;

  if (typeof detail?.tracks?.total !== "number") {
    throw new Error(
      `Spotify playlist total error ${response.status}: tracks.total ausente na resposta.`,
    );
  }

  return detail.tracks.total;
}

async function enrichSpotifyPlaylistTotals(
  accessToken: string,
  playlists: SpotifyAccountPlaylist[],
) {
  if (playlists.length === 0) {
    return playlists;
  }

  const enrichedPlaylists = await Promise.all(
    playlists.slice(0, 50).map(async (playlist) => {
      const tracksTotal = await fetchSpotifyPlaylistTrackTotalWithToken(
        accessToken,
        playlist.id,
      );

      return {
        ...playlist,
        tracksTotal,
      };
    }),
  );

  return [
    ...enrichedPlaylists,
    ...playlists.slice(enrichedPlaylists.length),
  ];
}

async function fetchSpotifyAccountPlaylistsWithToken(
  accessToken: string,
  { force = false }: { force?: boolean } = {},
) {
  const cacheKey = buildTokenCacheKey(accessToken);
  const cachedPlaylists = getCachedValue(spotifyAccountPlaylistsCache, cacheKey);

  if (!force && cachedPlaylists) {
    return cachedPlaylists;
  }

  const inFlight = spotifyPlaylistsInFlight.get(cacheKey);

  if (!force && inFlight) {
    return inFlight;
  }

  throwIfRateLimited("spotify:me:playlists", "Spotify playlists error");

  const requestPromise = (async () => {
    const currentUser = await fetchSpotifyCurrentUserWithToken(accessToken);
    const playlists: SpotifyAccountPlaylist[] = [];
    let nextUrl:
      | string
      | null = "https://api.spotify.com/v1/me/playlists?limit=50";

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        const errBody = (await response.json().catch(() => ({}))) as {
          error?: { message?: string; status?: number };
        };

        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          registerRateLimit("spotify:me:playlists", retryAfter);
          throw new Error(
            `Spotify playlists error 429: rate limit atingido. Tente novamente em ${retryAfter ?? "alguns"} segundos.`,
          );
        }

        throw new Error(
          `Spotify playlists error ${response.status}: ${errBody?.error?.message ?? "unknown"}`,
        );
      }

      clearRateLimit("spotify:me:playlists");

      const payload = (await response.json()) as SpotifyUserPlaylistsResponse;

      for (const playlist of payload.items ?? []) {
        if (playlist.owner?.id !== currentUser.id) {
          continue;
        }

        const mappedPlaylist = mapSpotifyAccountPlaylist(playlist);

        if (mappedPlaylist) {
          playlists.push(mappedPlaylist);
        }
      }

      nextUrl = payload.next ?? null;
    }

    const playlistsWithDetails = await enrichSpotifyPlaylistTotals(
      accessToken,
      playlists,
    );

    return setCachedValue(
      spotifyAccountPlaylistsCache,
      cacheKey,
      playlistsWithDetails,
      ACCOUNT_PLAYLISTS_CACHE_TTL_MS,
    );
  })();

  if (!force) {
    spotifyPlaylistsInFlight.set(cacheKey, requestPromise);
  }

  try {
    return await requestPromise;
  } finally {
    if (!force) {
      spotifyPlaylistsInFlight.delete(cacheKey);
    }
  }
}

async function fetchSpotifyPlaylistTracksWithToken(
  accessToken: string,
  playlistId: string,
) {
  throwIfRateLimited("spotify:playlist:tracks", "Spotify tracks error");

  const tracks: SpotifyEditablePlaylistTrack[] = [];
  let nextUrl: string | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        registerRateLimit("spotify:playlist:tracks", retryAfter);
        throw new Error(`Spotify tracks error 429: rate limit atingido. Tente novamente em ${retryAfter ?? "alguns"} segundos.`);
      }
      throw new Error(
        await getSpotifyErrorMessage(
          response,
          `Spotify tracks error ${response.status}: Failed to fetch Spotify playlist tracks.`,
        ),
      );
    }

    clearRateLimit("spotify:playlist:tracks");

    const payload = (await response.json()) as SpotifyPlaylistTracksResponse;

    for (const item of payload.items ?? []) {
      const track = mapSpotifyEditablePlaylistTrack(item);

      if (track) {
        tracks.push(track);
      }
    }

    nextUrl = payload.next ?? null;
  }

  return tracks;
}

async function fetchSpotifyPlaylistTrackIdsWithToken(
  accessToken: string,
  playlistId: string,
  { force = false }: { force?: boolean } = {},
) {
  const cacheKey = buildPlaylistTrackCacheKey(accessToken, playlistId);
  const scope = `spotify:playlist:track-ids:${playlistId}`;

  if (!force) {
    const cachedTrackIds = getCachedPlaylistTrackIds(cacheKey);

    if (cachedTrackIds) {
      return cachedTrackIds;
    }

    const inFlight = spotifyPlaylistTrackIdsInFlight.get(cacheKey);

    if (inFlight) {
      return inFlight;
    }
  }

  throwIfRateLimited(scope, "Spotify tracks error");

  const requestPromise = (async () => {
    const trackIds: string[] = [];
    let nextUrl:
      | string
      | null = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?fields=items(track(id)),next&limit=50`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      });

      if (!response.ok) {
        if (response.status === 429) {
          registerRateLimit(scope, response.headers.get("Retry-After"));
        }

        const err = (await response.json().catch(() => ({}))) as {
          error?: { message?: string };
        };

        throw new Error(err?.error?.message ?? `Spotify error ${response.status}`);
      }

      clearRateLimit(scope);

      const payload = (await response.json()) as {
        items?: Array<{ track?: { id?: string | null } | null }>;
        next?: string | null;
      };

      for (const item of payload.items ?? []) {
        if (item.track?.id) {
          trackIds.push(item.track.id);
        }
      }

      nextUrl = payload.next ?? null;
    }

    return setCachedPlaylistTrackIds(cacheKey, trackIds);
  })();

  spotifyPlaylistTrackIdsInFlight.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    spotifyPlaylistTrackIdsInFlight.delete(cacheKey);
  }
}

async function addTrackToPlaylistWithToken(
  accessToken: string,
  playlistId: string,
  trackUri: string,
) {
  const existingTrackIds = await fetchSpotifyPlaylistTrackIdsWithToken(
    accessToken,
    playlistId,
  );
  const trackId = extractSpotifyTrackId(trackUri);

  if (existingTrackIds.includes(trackId)) {
    return {
      alreadyExists: true,
    };
  }

  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uris: [trackUri],
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(err?.error?.message ?? `Spotify error ${response.status}`);
  }

  updateCachedPlaylistTrackIds(accessToken, playlistId, (trackIds) => [
    ...trackIds,
    trackId,
  ]);

  return {
    alreadyExists: false,
  };
}

async function fetchSpotifyEditablePlaylistWithToken(
  accessToken: string,
  playlistId: string,
) {
  const cacheKey = `${buildTokenCacheKey(accessToken)}:${playlistId}`;
  const cachedPlaylist = getCachedValue(spotifyEditablePlaylistCache, cacheKey);

  if (cachedPlaylist) {
    return cachedPlaylist;
  }

  const inFlight = spotifyEditablePlaylistsInFlight.get(cacheKey);

  if (inFlight) {
    return inFlight;
  }

  throwIfRateLimited("spotify:playlist:details", "Spotify playlist error");

  const requestPromise = (async () => {
    const currentUser = await fetchSpotifyCurrentUserWithToken(accessToken);
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        registerRateLimit("spotify:playlist:details", retryAfter);
        throw new Error(
          `Spotify playlist error 429: rate limit atingido. Tente novamente em ${retryAfter ?? "alguns"} segundos.`,
        );
      }

      throw new Error(
        await getSpotifyErrorMessage(
          response,
          `Spotify playlist error ${response.status}: Failed to fetch Spotify playlist.`,
        ),
      );
    }

    clearRateLimit("spotify:playlist:details");

    const playlist = (await response.json()) as SpotifyUserPlaylistObject;

    if (playlist.owner?.id !== currentUser.id) {
      throw new Error(
        `owner_mismatch: playlist pertence a ${playlist.owner?.id ?? "desconhecido"}, conta conectada ${currentUser.id}.`,
      );
    }

    const mappedPlaylist = mapSpotifyAccountPlaylist(playlist);

    if (!mappedPlaylist) {
      throw new Error("Spotify playlist unavailable.");
    }

    let tracks: SpotifyEditablePlaylistTrack[];

    try {
      tracks = await fetchSpotifyPlaylistTracksWithToken(accessToken, playlistId);
    } catch (error) {
      const embeddedTracks = mapSpotifyPlaylistTrackItems(playlist.tracks?.items);

      if (embeddedTracks.length === 0 && (playlist.tracks?.total ?? 0) > 0) {
        throw error;
      }

      tracks = embeddedTracks;
    }

    return setCachedValue(
      spotifyEditablePlaylistCache,
      cacheKey,
      {
        ...mappedPlaylist,
        description: playlist.description?.trim() || "",
        tracks,
      },
      EDITABLE_PLAYLIST_CACHE_TTL_MS,
    );
  })();

  spotifyEditablePlaylistsInFlight.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    spotifyEditablePlaylistsInFlight.delete(cacheKey);
  }
}

export async function fetchSpotifyAccountPlaylists({
  force = false,
}: {
  force?: boolean;
} = {}): Promise<{
  result: SpotifyAccountPlaylistsResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  try {
    const { data: playlists, refreshedToken } = await withSpotifyToken((token) =>
      fetchSpotifyAccountPlaylistsWithToken(token, { force }),
    );
    return {
      result: {
        connected: true,
        playlists,
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        connected: false,
        playlists: [],
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar playlists do Spotify.",
      },
      refreshedToken: null,
    };
  }
}

export async function fetchSpotifyConnectionStatus(): Promise<{
  result: SpotifyConnectionStatusResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  try {
    const { data: profile, refreshedToken } = await withSpotifyToken((token) =>
      fetchSpotifyCurrentUserWithToken(token),
    );

    return {
      result: {
        connected: true,
        account: mapSpotifyConnectionAccount(profile),
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        connected: false,
        account: null,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar a conexao do Spotify.",
      },
      refreshedToken: null,
    };
  }
}

export async function fetchSpotifyEditablePlaylist(
  playlistId: string,
): Promise<{
  result: SpotifyEditablePlaylistResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  try {
    const { data: playlist, refreshedToken } = await withSpotifyToken((token) =>
      fetchSpotifyEditablePlaylistWithToken(token, playlistId),
    );
    return {
      result: {
        connected: true,
        playlist,
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        connected: false,
        playlist: null,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel carregar a playlist do Spotify.",
      },
      refreshedToken: null,
    };
  }
}

function getSpotifyDiagnosticMessage(payload: unknown) {
  const data = payload as
    | {
        error?: string | { message?: string; status?: number };
        error_description?: string;
        message?: string;
      }
    | null;

  if (!data) {
    return null;
  }

  if (typeof data.error === "string") {
    return data.error_description || data.error;
  }

  return data.error?.message || data.message || null;
}

async function fetchSpotifyDiagnosticJson<T>(
  accessToken: string,
  url: string,
) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as T | null;

  return {
    status: response.status,
    ok: response.ok,
    payload,
    message: response.ok
      ? null
      : `status_code=${response.status} category=${classifySpotifyError(
          response.status,
          getSpotifyDiagnosticMessage(payload),
        )} message=${getSpotifyDiagnosticMessage(payload) ?? "unknown"}`,
  };
}

function buildSpotifyIntegrationDiagnostics(
  auth: Awaited<ReturnType<typeof getCurrentWorkspaceSpotifyStoredAuth>>,
): SpotifyWorkspaceDiagnosticsIntegration {
  return {
    appMode: auth?.appMode ?? null,
    connectionStatus: auth?.connectionStatus ?? null,
    accountLabel: auth?.providerAccountLabel ?? null,
    accountId: auth?.providerAccountId ?? null,
    hasAccessToken: Boolean(auth?.accessToken),
    hasRefreshToken: Boolean(auth?.refreshToken),
    tokenExpiresAt: auth?.tokenExpiresAt ?? null,
    grantedScopes: auth?.grantedScopes ?? null,
  };
}

export async function fetchSpotifyWorkspaceDiagnostics({
  playlistId,
}: {
  playlistId?: string | null;
} = {}): Promise<{
  result: SpotifyWorkspaceDiagnosticsResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  const workspace = await getCurrentWorkspaceContext().catch(() => null);
  const auth = await getCurrentWorkspaceSpotifyStoredAuth().catch(() => null);
  const workspaceSummary = workspace
    ? {
        id: workspace.workspace.id,
        name: workspace.workspace.name,
      }
    : null;
  const integration = buildSpotifyIntegrationDiagnostics(auth);

  try {
    const { data, refreshedToken } = await withSpotifyToken(async (token) => {
      const profile = await fetchSpotifyCurrentUserWithToken(token);
      if (
        auth?.providerAccountId &&
        profile.id &&
        auth.providerAccountId !== profile.id
      ) {
        throw new Error(
          `token_workspace_mismatch: token pertence a ${profile.id}, mas o workspace esta vinculado a ${auth.providerAccountId}.`,
        );
      }
      const playlistsResponse =
        await fetchSpotifyDiagnosticJson<SpotifyUserPlaylistsResponse>(
          token,
          "https://api.spotify.com/v1/me/playlists?limit=10",
        );
      const playlists = playlistsResponse.payload?.items ?? [];
      const firstItems = playlists
        .map((playlist) => mapSpotifyAccountPlaylist(playlist))
        .filter(Boolean)
        .slice(0, 10) as SpotifyAccountPlaylist[];
      const selectedPlaylistId = playlistId?.trim() || firstItems[0]?.id || null;
      let detailCheck: SpotifyWorkspaceDiagnosticsDetailCheck = null;
      let tracksCheck: SpotifyWorkspaceDiagnosticsTracksCheck = null;

      if (selectedPlaylistId) {
        const detailResponse =
          await fetchSpotifyDiagnosticJson<SpotifyUserPlaylistObject>(
            token,
            `https://api.spotify.com/v1/playlists/${selectedPlaylistId}?fields=id,name,owner(id,display_name),tracks(total,items(track(id,name))),snapshot_id`,
          );
        const detailPayload = detailResponse.payload;

        detailCheck = {
          status: detailResponse.status,
          ok: detailResponse.ok,
          name: detailPayload?.name ?? null,
          ownerId: detailPayload?.owner?.id ?? null,
          tracksTotal:
            typeof detailPayload?.tracks?.total === "number"
              ? detailPayload.tracks.total
              : null,
          embeddedItemsCount: detailPayload?.tracks?.items?.length ?? 0,
          message: detailResponse.message,
        };

        const tracksResponse =
          await fetchSpotifyDiagnosticJson<SpotifyPlaylistTracksResponse>(
            token,
            `https://api.spotify.com/v1/playlists/${selectedPlaylistId}/tracks?fields=items(track(id,name)),total,next&limit=1`,
          );
        const tracksPayload = tracksResponse.payload;

        tracksCheck = {
          status: tracksResponse.status,
          ok: tracksResponse.ok,
          total:
            typeof tracksPayload?.total === "number"
              ? tracksPayload.total
              : null,
          itemsCount: tracksPayload?.items?.length ?? 0,
          firstItems: (tracksPayload?.items ?? []).slice(0, 10).map((item) => ({
            id: item.track?.id ?? null,
            name: item.track?.name ?? null,
          })),
          message: tracksResponse.message,
        };
      }

      return {
        success: true,
        workspace: workspaceSummary,
        integration,
        spotifyUser: profile
          ? {
              id: profile.id ?? null,
              displayName: profile.display_name ?? null,
              email: profile.email ?? null,
              product: profile.product ?? null,
            }
          : null,
        playlistsCheck: {
          status: playlistsResponse.status,
          ok: playlistsResponse.ok,
          total:
            typeof playlistsResponse.payload?.total === "number"
              ? playlistsResponse.payload.total
              : null,
          itemsCount: playlists.length,
          firstItems: firstItems.map((playlist) => ({
            id: playlist.id,
            name: playlist.name,
            ownerId: playlist.ownerId,
            tracksTotal: playlist.tracksTotal,
          })),
          message: playlistsResponse.message,
        },
        selectedPlaylistCheck: {
          playlistId: selectedPlaylistId,
          detail: detailCheck,
          tracks: tracksCheck,
        },
      } satisfies SpotifyWorkspaceDiagnosticsResult;
    }, {
      requireWorkspace: auth?.appMode === "workspace_app",
      forceRefresh: auth?.appMode === "workspace_app",
    });

    return {
      result: data,
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Nao foi possivel testar a conexao Spotify.",
        workspace: workspaceSummary,
        integration,
      },
      refreshedToken: null,
    };
  }
}

// ─── Edição de Playlist ───────────────────────────────────────────────────────

export type SpotifyMutationResult =
  | { success: true }
  | { success: false; message: string };

export type SpotifyMutationResponse = {
  result: SpotifyMutationResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
};

export async function withSpotifyToken<T>(
  fn: (accessToken: string) => Promise<T>,
  options: SpotifyTokenOptions = {},
): Promise<{ data: T; refreshedToken: SpotifyOAuthTokenResponse | null }> {
  const session = await resolveSpotifySession(options);

  if (!session?.accessToken && !session?.refreshToken) {
    throw new Error(
      options.requireWorkspace
        ? SPOTIFY_WORKSPACE_REQUIRED_MESSAGE
        : "Spotify ainda nao conectado.",
    );
  }

  if (session.accessToken && !options.forceRefresh) {
    try {
      return { data: await fn(session.accessToken), refreshedToken: null };
    } catch (err) {
      if (!session.refreshToken) throw err;
    }
  }

  if (!session.refreshToken) throw new Error("Spotify session unavailable.");

  const refreshedToken = await refreshSpotifyToken(session.refreshToken);

  await syncSpotifyWorkspaceConnection({
    ...refreshedToken,
    refresh_token: refreshedToken.refresh_token ?? session.refreshToken,
  });

  return { data: await fn(refreshedToken.access_token), refreshedToken };
}

async function removeTrackFromPlaylistWithToken(
  accessToken: string,
  playlistId: string,
  trackUri: string,
  snapshotId: string,
) {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tracks: [{ uri: trackUri }],
        snapshot_id: snapshotId,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? "Falha ao remover faixa da playlist.");
  }

  const data = await response.json() as { snapshot_id?: string };
  return data.snapshot_id ?? snapshotId;
}

async function reorderPlaylistTracksWithToken(
  accessToken: string,
  playlistId: string,
  rangeStart: number,
  insertBefore: number,
  snapshotId: string,
) {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range_start: rangeStart,
        insert_before: insertBefore,
        range_length: 1,
        snapshot_id: snapshotId,
      }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? "Falha ao reordenar faixas da playlist.");
  }

  const data = await response.json() as { snapshot_id?: string };
  return data.snapshot_id ?? snapshotId;
}

async function updatePlaylistDetailsWithToken(
  accessToken: string,
  playlistId: string,
  name: string,
  description: string,
) {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(err?.error?.message ?? "Falha ao atualizar detalhes da playlist.");
  }
}

async function fetchPlaylistSnapshotIdWithToken(
  accessToken: string,
  playlistId: string,
): Promise<string> {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}?fields=snapshot_id`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
    },
  );
  if (!response.ok) throw new Error("Falha ao buscar snapshot_id da playlist.");
  const data = await response.json() as { snapshot_id?: string };
  return data.snapshot_id ?? "";
}

async function replacePlaylistTracksWithToken(
  accessToken: string,
  playlistId: string,
  uris: string[],
) {
  if (uris.length <= 100) {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(err?.error?.message ?? `Spotify error ${response.status}`);
    }

    const data = (await response.json()) as { snapshot_id?: string };
    return data.snapshot_id ?? "";
  }

  const firstBatch = uris.slice(0, 100);
  const putResponse = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uris: firstBatch }),
      cache: "no-store",
    },
  );

  if (!putResponse.ok) {
    const err = (await putResponse.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(err?.error?.message ?? `Spotify error ${putResponse.status}`);
  }

  const putData = (await putResponse.json()) as { snapshot_id?: string };
  let snapshotId = putData.snapshot_id ?? "";

  for (let index = 100; index < uris.length; index += 100) {
    const batch = uris.slice(index, index + 100);

    await new Promise((resolve) => setTimeout(resolve, 100));

    const postResponse = await fetch(
      `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          uris: batch,
          position: index,
        }),
        cache: "no-store",
      },
    );

    if (!postResponse.ok) {
      const err = (await postResponse.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(err?.error?.message ?? `Spotify error ${postResponse.status}`);
    }

    const postData = (await postResponse.json()) as { snapshot_id?: string };
    snapshotId = postData.snapshot_id ?? snapshotId;
  }

  return snapshotId;
}

export async function fetchSpotifyPlaylistTrackIds(
  playlistId: string,
): Promise<{
  result:
    | { success: true; trackIds: string[] }
    | { success: false; message: string };
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  try {
    const { data: trackIds, refreshedToken } = await withSpotifyToken((token) =>
      fetchSpotifyPlaylistTrackIdsWithToken(token, playlistId),
    );

    return {
      result: {
        success: true,
        trackIds,
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao buscar faixas.",
      },
      refreshedToken: null,
    };
  }
}

export async function addTrackToPlaylist(
  playlistId: string,
  trackUri: string,
): Promise<{
  result:
    | { success: true; alreadyExists: boolean }
    | { success: false; message: string };
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  try {
    const { data, refreshedToken } = await withSpotifyToken(async (token) => {
      const result = await addTrackToPlaylistWithToken(token, playlistId, trackUri);
      clearSpotifyAccountPlaylistCache(token);
      clearSpotifyEditablePlaylistCache(token, playlistId);
      return result;
    }, { requireWorkspace: true });

    return {
      result: {
        success: true,
        alreadyExists: data.alreadyExists,
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao adicionar faixa.",
      },
      refreshedToken: null,
    };
  }
}

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackUri: string,
  snapshotId: string,
): Promise<{
  result:
    | { success: true; snapshotId: string }
    | { success: false; message: string };
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  try {
    const { data: newSnapshotId, refreshedToken } = await withSpotifyToken(
      async (token) => {
        const nextSnapshotId = await removeTrackFromPlaylistWithToken(
          token,
          playlistId,
          trackUri,
          snapshotId,
        );
        const trackId = extractSpotifyTrackId(trackUri);

        updateCachedPlaylistTrackIds(token, playlistId, (trackIds) =>
          trackIds.filter((currentTrackId) => currentTrackId !== trackId),
        );
        clearSpotifyAccountPlaylistCache(token);
        clearSpotifyEditablePlaylistCache(token, playlistId);

        return nextSnapshotId;
      },
    );

    return {
      result: {
        success: true,
        snapshotId: newSnapshotId,
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao remover faixa.",
      },
      refreshedToken: null,
    };
  }
}

export async function reorderPlaylistTracks(
  playlistId: string,
  rangeStart: number,
  insertBefore: number,
  snapshotId: string,
): Promise<{ result: { success: true; snapshotId: string } | { success: false; message: string }; refreshedToken: SpotifyOAuthTokenResponse | null }> {
  try {
    const { data: newSnapshotId, refreshedToken } = await withSpotifyToken(
      async (token) => {
        const nextSnapshotId = await reorderPlaylistTracksWithToken(
          token,
          playlistId,
          rangeStart,
          insertBefore,
          snapshotId,
        );
        clearSpotifyEditablePlaylistCache(token, playlistId);
        return nextSnapshotId;
      },
    );
    return { result: { success: true, snapshotId: newSnapshotId }, refreshedToken };
  } catch (error) {
    return {
      result: {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao reordenar faixas.",
      },
      refreshedToken: null,
    };
  }
}

export async function replacePlaylistTracks(
  playlistId: string,
  uris: string[],
): Promise<{
  result:
    | { success: true; snapshotId: string }
    | { success: false; message: string };
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  try {
    const { data: snapshotId, refreshedToken } = await withSpotifyToken(
      async (token) => {
        const nextSnapshotId = await replacePlaylistTracksWithToken(
          token,
          playlistId,
          uris,
        );
        const trackIds = uris.map(extractSpotifyTrackId).filter(Boolean);
        const cacheKey = buildPlaylistTrackCacheKey(token, playlistId);

        setCachedPlaylistTrackIds(cacheKey, trackIds);
        clearSpotifyAccountPlaylistCache(token);
        clearSpotifyEditablePlaylistCache(token, playlistId);

        return nextSnapshotId;
      },
    );

    return {
      result: {
        success: true,
        snapshotId,
      },
      refreshedToken,
    };
  } catch (error) {
    return {
      result: {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Erro ao substituir faixas da playlist.",
      },
      refreshedToken: null,
    };
  }
}

export async function updatePlaylistDetails(
  playlistId: string,
  name: string,
  description: string,
): Promise<SpotifyMutationResponse> {
  try {
    const { refreshedToken } = await withSpotifyToken(async (token) => {
      await updatePlaylistDetailsWithToken(token, playlistId, name, description);
      clearSpotifyReadCachesForToken(token);
    });
    return { result: { success: true }, refreshedToken };
  } catch (error) {
    return {
      result: {
        success: false,
        message: error instanceof Error ? error.message : "Erro ao atualizar playlist.",
      },
      refreshedToken: null,
    };
  }
}

export async function fetchPlaylistSnapshotId(
  playlistId: string,
): Promise<{ snapshotId: string; refreshedToken: SpotifyOAuthTokenResponse | null }> {
  const { data: snapshotId, refreshedToken } = await withSpotifyToken((token) =>
    fetchPlaylistSnapshotIdWithToken(token, playlistId),
  );
  return { snapshotId, refreshedToken };
}

// ---------------------------------------------------------------------------
// createPlaylist
// ---------------------------------------------------------------------------
async function createPlaylistWithToken(
  accessToken: string,
  userId: string,
  name: string,
  description: string,
  isPublic: boolean,
): Promise<string> {
  const response = await fetch(
    `https://api.spotify.com/v1/users/${userId}/playlists`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, description, public: isPublic }),
    },
  );

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Erro ao criar playlist.");
  }

  const data = (await response.json()) as { id: string };
  return data.id;
}

async function uploadPlaylistCoverWithToken(
  accessToken: string,
  playlistId: string,
  base64Jpeg: string,
): Promise<void> {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/images`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
      },
      body: base64Jpeg,
    },
  );

  if (!response.ok) {
    // Capa é opcional — não lança erro, só loga
    // upload de capa falhou — nao critico, continua
  }
}

async function uploadPlaylistCoverStrictWithToken(
  accessToken: string,
  playlistId: string,
  base64Jpeg: string,
): Promise<void> {
  const response = await fetch(
    `https://api.spotify.com/v1/playlists/${playlistId}/images`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "image/jpeg",
      },
      body: base64Jpeg,
    },
  );

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      err?.error?.message ?? "Falha ao atualizar capa da playlist.",
    );
  }
}

export async function uploadPlaylistCover(
  playlistId: string,
  base64Jpeg: string,
): Promise<SpotifyMutationResponse> {
  try {
    const { refreshedToken } = await withSpotifyToken((token) =>
      uploadPlaylistCoverStrictWithToken(token, playlistId, base64Jpeg),
    );
    return { result: { success: true }, refreshedToken };
  } catch (error) {
    return {
      result: {
        success: false,
        message:
          error instanceof Error ? error.message : "Erro ao atualizar capa.",
      },
      refreshedToken: null,
    };
  }
}

export async function createSpotifyPlaylist(
  name: string,
  description: string,
  isPublic: boolean,
  base64CoverJpeg: string | null,
  trackUris: string[] = [],
): Promise<{ playlistId: string; refreshedToken: SpotifyOAuthTokenResponse | null }> {
  const { data: playlistId, refreshedToken } = await withSpotifyToken(async (token) => {
    const user = await fetchSpotifyCurrentUserWithToken(token);
    const id = await createPlaylistWithToken(token, user.id ?? "", name, description, isPublic);
    if (base64CoverJpeg) {
      await uploadPlaylistCoverWithToken(token, id, base64CoverJpeg);
    }
    const uniqueTrackUris = Array.from(new Set(trackUris));
    if (uniqueTrackUris.length > 0) {
      await replacePlaylistTracksWithToken(token, id, uniqueTrackUris);
    }
    clearSpotifyReadCachesForToken(token);
    return id;
  });

  return { playlistId, refreshedToken };
}
