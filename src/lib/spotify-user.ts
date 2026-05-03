import "server-only";

import { Buffer } from "node:buffer";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

const SPOTIFY_ACCESS_TOKEN_COOKIE = "spotify_access_token";
const SPOTIFY_REFRESH_TOKEN_COOKIE = "spotify_refresh_token";
const SPOTIFY_STATE_COOKIE = "spotify_auth_state";
const SPOTIFY_NEXT_COOKIE = "spotify_auth_next";
const SPOTIFY_PRODUCTION_REDIRECT_URI =
  "https://system.soasbraba.com/api/spotify/auth/callback";

type SpotifyOAuthTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  scope?: string;
};

type SpotifyUserPlaylistsResponse = {
  items?: SpotifyUserPlaylistObject[];
  next?: string | null;
};

type SpotifyCurrentUserResponse = {
  id?: string;
  display_name?: string | null;
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
  };
};

type SpotifyPlaylistTracksResponse = {
  items?: SpotifyPlaylistTrackItem[];
  next?: string | null;
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

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const CURRENT_USER_CACHE_TTL_MS = 5 * 60 * 1000;
const ACCOUNT_PLAYLISTS_CACHE_TTL_MS = 90 * 1000;
const EDITABLE_PLAYLIST_CACHE_TTL_MS = 3 * 60 * 1000;

const spotifyCurrentUserCache = new Map<string, CacheEntry<SpotifyCurrentUserResponse>>();
const spotifyAccountPlaylistsCache = new Map<string, CacheEntry<SpotifyAccountPlaylist[]>>();
const spotifyEditablePlaylistCache = new Map<string, CacheEntry<SpotifyEditablePlaylist>>();
const spotifyPlaylistsInFlight = new Map<string, Promise<SpotifyAccountPlaylist[]>>();
const spotifyEditablePlaylistsInFlight = new Map<string, Promise<SpotifyEditablePlaylist>>();
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

function getSpotifyOAuthEnv() {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return {
    clientId,
    clientSecret,
  };
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

export function buildSpotifyAuthorizeUrl({
  origin,
  state,
}: {
  origin: string;
  state: string;
}) {
  const env = getSpotifyOAuthEnv();

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

export async function getSpotifyStateCookie() {
  const cookieStore = await cookies();

  return cookieStore.get(SPOTIFY_STATE_COOKIE)?.value ?? null;
}

export async function getSpotifyNextCookie() {
  const cookieStore = await cookies();

  return cookieStore.get(SPOTIFY_NEXT_COOKIE)?.value ?? null;
}

export function clearSpotifyStateCookie(response: NextResponse) {
  response.cookies.set(SPOTIFY_STATE_COOKIE, "", getCookieOptions(0));
}

export function clearSpotifyNextCookie(response: NextResponse) {
  response.cookies.set(SPOTIFY_NEXT_COOKIE, "", getCookieOptions(0));
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
}

export async function exchangeSpotifyCode({
  code,
  redirectUri,
}: {
  code: string;
  redirectUri: string;
}) {
  const env = getSpotifyOAuthEnv();

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

async function refreshSpotifyToken(refreshToken: string) {
  const env = getSpotifyOAuthEnv();

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
    throw new Error("Failed to refresh Spotify account session.");
  }

  return (await response.json()) as SpotifyOAuthTokenResponse;
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

async function fetchSpotifyAccountPlaylistsWithToken(accessToken: string) {
  const cacheKey = buildTokenCacheKey(accessToken);
  const cachedPlaylists = getCachedValue(spotifyAccountPlaylistsCache, cacheKey);

  if (cachedPlaylists) {
    return cachedPlaylists;
  }

  const inFlight = spotifyPlaylistsInFlight.get(cacheKey);

  if (inFlight) {
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
      const errBody = await response.json().catch(() => ({})) as { error?: { message?: string; status?: number } };
      if (response.status === 429) {
        const retryAfter = response.headers.get("Retry-After");
        registerRateLimit("spotify:me:playlists", retryAfter);
        throw new Error(`Spotify playlists error 429: rate limit atingido. Tente novamente em ${retryAfter ?? "alguns"} segundos.`);
      }
      throw new Error(`Spotify playlists error ${response.status}: ${errBody?.error?.message ?? "unknown"}`);
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

    return setCachedValue(
      spotifyAccountPlaylistsCache,
      cacheKey,
      playlists,
      ACCOUNT_PLAYLISTS_CACHE_TTL_MS,
    );
  })();

  spotifyPlaylistsInFlight.set(cacheKey, requestPromise);

  try {
    return await requestPromise;
  } finally {
    spotifyPlaylistsInFlight.delete(cacheKey);
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
      throw new Error(`Spotify tracks error ${response.status}: Failed to fetch Spotify playlist tracks.`);
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
    throw new Error("Failed to fetch Spotify playlist.");
  }

  clearRateLimit("spotify:playlist:details");

  const playlist = (await response.json()) as SpotifyUserPlaylistObject;

  if (playlist.owner?.id !== currentUser.id) {
    throw new Error("Esta playlist nao foi criada pela conta Spotify conectada.");
  }

  const mappedPlaylist = mapSpotifyAccountPlaylist(playlist);

  if (!mappedPlaylist) {
    throw new Error("Spotify playlist unavailable.");
  }

    return setCachedValue(
      spotifyEditablePlaylistCache,
      cacheKey,
      {
        ...mappedPlaylist,
        description: playlist.description?.trim() || "",
        tracks: await fetchSpotifyPlaylistTracksWithToken(accessToken, playlistId),
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

export async function fetchSpotifyAccountPlaylists(): Promise<{
  result: SpotifyAccountPlaylistsResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return {
      result: {
        connected: false,
        playlists: [],
        message: "Spotify ainda nao conectado.",
      },
      refreshedToken: null,
    };
  }

  try {
    if (accessToken) {
      try {
        return {
          result: {
            connected: true,
            playlists: await fetchSpotifyAccountPlaylistsWithToken(accessToken),
          },
          refreshedToken: null,
        };
      } catch (error) {
        if (!refreshToken) {
          throw error;
        }
      }
    }

    if (!refreshToken) {
      throw new Error("Spotify session unavailable.");
    }

    const refreshedToken = await refreshSpotifyToken(refreshToken);

    return {
      result: {
        connected: true,
        playlists: await fetchSpotifyAccountPlaylistsWithToken(
          refreshedToken.access_token,
        ),
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

export async function fetchSpotifyEditablePlaylist(
  playlistId: string,
): Promise<{
  result: SpotifyEditablePlaylistResult;
  refreshedToken: SpotifyOAuthTokenResponse | null;
}> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return {
      result: {
        connected: false,
        playlist: null,
        message: "Spotify ainda nao conectado.",
      },
      refreshedToken: null,
    };
  }

  try {
    if (accessToken) {
      try {
        return {
          result: {
            connected: true,
            playlist: await fetchSpotifyEditablePlaylistWithToken(
              accessToken,
              playlistId,
            ),
          },
          refreshedToken: null,
        };
      } catch (error) {
        if (!refreshToken) {
          throw error;
        }
      }
    }

    if (!refreshToken) {
      throw new Error("Spotify session unavailable.");
    }

    const refreshedToken = await refreshSpotifyToken(refreshToken);

    return {
      result: {
        connected: true,
        playlist: await fetchSpotifyEditablePlaylistWithToken(
          refreshedToken.access_token,
          playlistId,
        ),
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
): Promise<{ data: T; refreshedToken: SpotifyOAuthTokenResponse | null }> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(SPOTIFY_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = cookieStore.get(SPOTIFY_REFRESH_TOKEN_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    throw new Error("Spotify ainda nao conectado.");
  }

  if (accessToken) {
    try {
      return { data: await fn(accessToken), refreshedToken: null };
    } catch (err) {
      if (!refreshToken) throw err;
    }
  }

  if (!refreshToken) throw new Error("Spotify session unavailable.");

  const refreshedToken = await refreshSpotifyToken(refreshToken);
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

export async function removeTrackFromPlaylist(
  playlistId: string,
  trackUri: string,
  snapshotId: string,
): Promise<SpotifyMutationResponse> {
  try {
    const { refreshedToken } = await withSpotifyToken((token) =>
      removeTrackFromPlaylistWithToken(token, playlistId, trackUri, snapshotId),
    );
    return { result: { success: true }, refreshedToken };
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
    const { data: newSnapshotId, refreshedToken } = await withSpotifyToken((token) =>
      reorderPlaylistTracksWithToken(token, playlistId, rangeStart, insertBefore, snapshotId),
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
): Promise<{ playlistId: string; refreshedToken: SpotifyOAuthTokenResponse | null }> {
  const { data: playlistId, refreshedToken } = await withSpotifyToken(async (token) => {
    const user = await fetchSpotifyCurrentUserWithToken(token);
    const id = await createPlaylistWithToken(token, user.id ?? "", name, description, isPublic);
    if (base64CoverJpeg) {
      await uploadPlaylistCoverWithToken(token, id, base64CoverJpeg);
    }
    clearSpotifyReadCachesForToken(token);
    return id;
  });

  return { playlistId, refreshedToken };
}
